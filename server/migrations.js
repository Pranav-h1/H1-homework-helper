// Database schema, applied in order and recorded, so every environment ends up identical and
// a migration never runs twice.
//
// Identity and ownership: every account has an internal, random, immutable id. Everything a
// user owns is keyed by (user_id, …) and every query that touches it filters on the user_id
// taken from the authenticated session — never on a username or an id sent by the browser.
const MIGRATIONS = [
  {
    version: 1,
    name: "accounts, sessions, account data, account files",
    sql: `
      CREATE TABLE h1_users (
        id                  TEXT PRIMARY KEY,
        username            TEXT NOT NULL,
        username_key        TEXT NOT NULL,
        password_hash       TEXT NOT NULL,
        account_type        TEXT NOT NULL DEFAULT 'standard',
        client_ns           TEXT NOT NULL,
        data_revision       BIGINT NOT NULL DEFAULT 0,
        created_at          BIGINT NOT NULL,
        updated_at          BIGINT NOT NULL,
        password_changed_at BIGINT NOT NULL,
        CONSTRAINT h1_users_username_key_unique UNIQUE (username_key),
        CONSTRAINT h1_users_client_ns_unique UNIQUE (client_ns),
        CONSTRAINT h1_users_account_type_check CHECK (account_type IN ('standard', 'lab'))
      );

      CREATE TABLE h1_sessions (
        token_hash          TEXT PRIMARY KEY,
        user_id             TEXT NOT NULL REFERENCES h1_users(id) ON DELETE CASCADE,
        csrf_token          TEXT NOT NULL,
        created_at          BIGINT NOT NULL,
        last_seen_at        BIGINT NOT NULL,
        idle_expires_at     BIGINT NOT NULL,
        absolute_expires_at BIGINT NOT NULL,
        rotated_at          BIGINT NOT NULL,
        user_agent          TEXT
      );
      CREATE INDEX h1_sessions_user_idx ON h1_sessions (user_id);
      CREATE INDEX h1_sessions_expiry_idx ON h1_sessions (absolute_expires_at);

      CREATE TABLE h1_user_data (
        user_id    TEXT NOT NULL REFERENCES h1_users(id) ON DELETE CASCADE,
        data_key   TEXT NOT NULL,
        value      TEXT NOT NULL,
        version    BIGINT NOT NULL,
        size_bytes INTEGER NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, data_key)
      );

      CREATE TABLE h1_user_files (
        user_id         TEXT NOT NULL REFERENCES h1_users(id) ON DELETE CASCADE,
        file_id         TEXT NOT NULL,
        conversation_id TEXT,
        record          TEXT NOT NULL,
        size_bytes      INTEGER NOT NULL,
        created_at      BIGINT NOT NULL,
        PRIMARY KEY (user_id, file_id)
      );
      CREATE INDEX h1_user_files_conversation_idx ON h1_user_files (user_id, conversation_id);
    `,
  },
];

async function migrate(db) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS h1_schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at BIGINT NOT NULL)"
  );
  for (const m of MIGRATIONS) {
    await db.transaction(async (tx) => {
      // Two server instances starting together serialize here instead of racing.
      await tx.query("SELECT pg_advisory_xact_lock(724611)");
      const done = await tx.query("SELECT 1 FROM h1_schema_migrations WHERE version = $1", [m.version]);
      if (done.rows.length) return;
      await tx.exec(m.sql);
      await tx.query("INSERT INTO h1_schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)", [m.version, m.name, Date.now()]);
    });
  }
}

module.exports = { migrate, MIGRATIONS };
