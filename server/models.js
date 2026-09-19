// The models H1 may run on, and which one it's running on now.
//
// H1 presents one AI to students — "the H1 model" — and which vendor is behind it stays a server
// detail that never reaches the browser. What this adds is the ability for H1's creator to
// change that engine from inside the app instead of editing environment variables and
// redeploying: keep a list of models, mark one active, and every AI request uses it.
//
// A model can only be made active if its provider actually has an API key on this server. There
// is no point offering a switch that would break the app the moment it's flipped.
const crypto = require("crypto");
const { PROVIDER_NAMES, isProviderConfigured } = require("./providers");

const MODEL_ID = /^[A-Za-z0-9._:@/-]{1,120}$/;
let cached = { row: null, at: 0 };
const CACHE_MS = 5000;

function clearCache() {
  cached = { row: null, at: 0 };
}

function validate({ provider, modelId, label }) {
  const p = String(provider || "").trim().toLowerCase();
  const m = String(modelId || "").trim();
  const l = String(label || "").trim() || m;
  if (!PROVIDER_NAMES.includes(p)) return { error: "That isn't a provider H1 knows about." };
  if (!MODEL_ID.test(m)) return { error: "That doesn't look like a model name." };
  if ([...l].length > 60) return { error: "Keep the name under 60 characters." };
  return { provider: p, modelId: m, label: l };
}

async function list(db) {
  const r = await db.query("SELECT id, provider, model_id, label, is_active, created_at FROM h1_models ORDER BY created_at");
  return r.rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    modelId: row.model_id,
    label: row.label,
    active: Boolean(row.is_active),
    configured: isProviderConfigured(row.provider),
    createdAt: Number(row.created_at),
  }));
}

async function add(db, input) {
  const clean = validate(input);
  if (clean.error) return clean;
  const id = crypto.randomBytes(8).toString("hex");
  try {
    await db.query("INSERT INTO h1_models (id, provider, model_id, label, is_active, created_at) VALUES ($1, $2, $3, $4, FALSE, $5)", [
      id,
      clean.provider,
      clean.modelId,
      clean.label,
      Date.now(),
    ]);
  } catch (err) {
    if (err && err.code === "23505") return { error: "That model is already on the list." };
    throw err;
  }
  return { id };
}

async function remove(db, id) {
  const r = await db.query("DELETE FROM h1_models WHERE id = $1 RETURNING is_active", [id]);
  clearCache();
  return { removed: r.rowCount > 0, wasActive: Boolean(r.rows[0] && r.rows[0].is_active) };
}

// Exactly one model is active. Passing null goes back to whatever the environment says, which is
// also what happens if the active model is deleted.
async function setActive(db, id) {
  if (!id) {
    await db.query("UPDATE h1_models SET is_active = FALSE WHERE is_active");
    clearCache();
    return { active: null };
  }
  const found = await db.query("SELECT provider, model_id FROM h1_models WHERE id = $1", [id]);
  if (!found.rows[0]) return { error: "That model isn't on the list." };
  if (!isProviderConfigured(found.rows[0].provider)) {
    return { error: "This server has no API key for that provider, so switching to it would stop H1 answering." };
  }
  await db.transaction(async (tx) => {
    await tx.query("UPDATE h1_models SET is_active = FALSE WHERE is_active");
    await tx.query("UPDATE h1_models SET is_active = TRUE WHERE id = $1", [id]);
  });
  clearCache();
  return { active: id };
}

// The active model, or null when H1 should use what the environment configured.
async function getActive(db) {
  if (!db) return null;
  if (Date.now() - cached.at < CACHE_MS) return cached.row;
  try {
    const r = await db.query("SELECT id, provider, model_id, label FROM h1_models WHERE is_active LIMIT 1");
    const row = r.rows[0] ? { id: r.rows[0].id, provider: r.rows[0].provider, modelId: r.rows[0].model_id, label: r.rows[0].label } : null;
    cached = { row, at: Date.now() };
    return row;
  } catch {
    return null;
  }
}

module.exports = { list, add, remove, setActive, getActive, clearCache };
