// Database access for H1 accounts.
//
// One SQL dialect everywhere — PostgreSQL:
//   • production: a real PostgreSQL server via DATABASE_URL (Neon, Render Postgres, Supabase…)
//   • local development and tests: PGlite, which is PostgreSQL itself compiled to WebAssembly,
//     stored in a folder on disk (or in memory for tests). No separate install needed.
// Running the same dialect locally means the queries tested are the queries production runs.
//
// Every query in H1 goes through `query(sql, params)` with $1-style parameters — values are
// never concatenated into SQL.
const path = require("path");

function sslOption(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return undefined;
  }
  // An explicit sslmode in the URL is honoured as written.
  if (url.searchParams.has("sslmode")) return undefined;
  const host = url.hostname;
  // Local servers and Render's internal hostnames (no dots) don't use TLS.
  if (host === "localhost" || host === "127.0.0.1" || !host.includes(".")) return false;
  return { rejectUnauthorized: process.env.DATABASE_SSL !== "no-verify" };
}

async function createPostgres(connectionString) {
  const { Pool, types } = require("pg");
  // BIGINT columns (timestamps, versions) come back from pg as strings by default; PGlite
  // returns numbers. Make them agree. Every BIGINT H1 stores is far below 2^53.
  types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  const pool = new Pool({
    connectionString,
    ssl: sslOption(connectionString),
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  // An idle client dropped by the server shouldn't crash the process.
  pool.on("error", (err) => console.error("[db] idle connection error:", err.code || err.message));

  const run = (client) => async (sql, params = []) => {
    const r = await client.query(sql, params);
    return { rows: r.rows, rowCount: r.rowCount };
  };

  return {
    kind: "postgres",
    durable: true,
    query: run(pool),
    exec: async (sql) => {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({ query: run(client), exec: async (sql) => void (await client.query(sql)) });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The original error is the one worth reporting.
        }
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

// A data directory left behind by a server that was killed rather than shut down still has
// PostgreSQL's lock file in it, and PGlite then refuses to start — which would silently turn
// accounts off until someone deleted the file by hand. H1 keeps its own lock alongside the
// directory recording which process opened it: if that process is gone, the leftover lock is
// stale and safe to clear; if it's still running, H1 says so instead of corrupting the data by
// opening it twice.
function claimDataDir(resolvedDir) {
  const fs = require("fs");
  const lockPath = `${resolvedDir}.lock`;
  let holder = null;
  try {
    holder = Number(fs.readFileSync(lockPath, "utf8").trim()) || null;
  } catch {
    holder = null;
  }
  if (holder && holder !== process.pid) {
    let alive = true;
    try {
      process.kill(holder, 0);
    } catch (err) {
      alive = err && err.code === "EPERM"; // exists but owned by another user
    }
    if (alive) {
      throw Object.assign(new Error(`another H1 server (process ${holder}) is already using ${resolvedDir}`), { code: "DB_IN_USE" });
    }
    try {
      fs.rmSync(path.join(resolvedDir, "postmaster.pid"), { force: true });
      console.warn("[db] cleared a lock left behind by a previous H1 server.");
    } catch {
      // If it can't be removed, the open below fails with its own message.
    }
  }
  try {
    fs.writeFileSync(lockPath, String(process.pid));
  } catch {
    // The lock is a convenience; not being able to write it shouldn't stop H1 starting.
  }
  return () => {
    try {
      if (Number(fs.readFileSync(lockPath, "utf8").trim()) === process.pid) fs.rmSync(lockPath, { force: true });
    } catch {
      // Nothing to clean up.
    }
  };
}

async function createPglite(dataDir) {
  const { PGlite } = require("@electric-sql/pglite");
  const inMemory = dataDir === "memory://";
  let release = () => {};
  if (!inMemory) {
    const resolved = path.resolve(dataDir);
    // PGlite creates its own data directory but not the folders above it.
    require("fs").mkdirSync(path.dirname(resolved), { recursive: true });
    release = claimDataDir(resolved);
    process.once("exit", release);
  }
  const db = inMemory ? new PGlite() : new PGlite(path.resolve(dataDir));
  await db.waitReady;
  const run = (target) => async (sql, params = []) => {
    const r = await target.query(sql, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  return {
    kind: inMemory ? "pglite-memory" : "pglite",
    durable: !inMemory,
    query: run(db),
    // PGlite runs query() through the extended protocol, which takes a single statement;
    // exec() is the one that accepts a whole script. pg accepts either, so H1 uses exec()
    // wherever a migration runs several statements together.
    exec: async (sql) => {
      await db.exec(sql);
    },
    transaction: (fn) => db.transaction((tx) => fn({ query: run(tx), exec: async (sql) => void (await tx.exec(sql)) })),
    close: async () => {
      await db.close();
      release();
    },
  };
}

// Chooses the database from the environment:
//   DATABASE_URL        → PostgreSQL (production)
//   H1_DATABASE_PATH    → PGlite at that folder, or "memory://"
//   neither, not in production → PGlite in ./.data/h1-db (local development)
//   neither, in production     → none: accounts are reported unavailable rather than kept in a
//                                 database that the host would wipe on the next restart.
async function openDatabase(env = process.env) {
  if (env.DATABASE_URL) return createPostgres(env.DATABASE_URL);
  if (env.H1_DATABASE_PATH) return createPglite(env.H1_DATABASE_PATH);
  if (isProduction(env)) return null;
  return createPglite(path.join(__dirname, "..", ".data", "h1-db"));
}

function isProduction(env = process.env) {
  return env.NODE_ENV === "production" || Boolean(env.RENDER);
}

// The server's one handle on the database. `get()` resolves to the ready database (connected,
// migrated, H1 Lab account set up) or null. If connecting fails — the database is briefly down
// while H1 starts — it tries again on a later request instead of leaving accounts switched off
// until the next restart. `setup(db)` runs once per successful connection.
function createDatabaseHandle({ env = process.env, setup, retryMs = 30000 } = {}) {
  let pending = null;
  let failedAt = 0;
  let state = "starting";

  async function connect() {
    let db = null;
    try {
      db = await openDatabase(env);
      if (!db) {
        state = "not-configured";
        return null;
      }
      if (setup) await setup(db);
      state = "available";
      return db;
    } catch (err) {
      state = "unavailable";
      failedAt = Date.now();
      if (err && /PGlite/.test(String(err.message)) && !env.DATABASE_URL) {
        const where = env.H1_DATABASE_PATH || "./.data/h1-db";
        console.error(`[db] The local database at ${where} couldn't be opened. If this server was killed rather than stopped, that folder can be left unusable; delete it to start a fresh local database (anything stored in it is lost), or point DATABASE_URL at a PostgreSQL server.`);
      }
      console.error("[db] database unavailable:", err && (err.code || err.message));
      if (db) await Promise.resolve(db.close()).catch(() => {});
      throw err;
    }
  }

  return {
    get() {
      if (state === "not-configured") return Promise.resolve(null);
      if (state === "unavailable" && Date.now() - failedAt >= retryMs) pending = null;
      if (!pending) pending = connect();
      return pending.catch(() => null);
    },
    status: () => state,
    // Closed on shutdown so the data directory is left in a clean state.
    async close() {
      const db = await (pending || Promise.resolve(null)).catch(() => null);
      if (db && db.close) await db.close().catch(() => {});
    },
  };
}

module.exports = { openDatabase, createPglite, createPostgres, createDatabaseHandle, isProduction };
