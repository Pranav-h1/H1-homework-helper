// Provider registry. To add a new AI backend later:
//   1. Create server/providers/<name>.js exporting { isConfigured(), chat(messages, systemPrompt) }.
//   2. Register it in PROVIDERS below.
//   3. Set AI_PROVIDER=<name> and that provider's API key in the environment.
const anthropic = require("./anthropic");
const openai = require("./openai");
const gemini = require("./gemini");

const PROVIDERS = {
  anthropic,
  openai,
  gemini,
};

function currentProviderName() {
  return (process.env.AI_PROVIDER || "").trim().toLowerCase();
}

// Returns a ready-to-use provider, or null if none is configured/selected.
function getProvider() {
  const provider = PROVIDERS[currentProviderName()];
  if (!provider || !provider.isConfigured()) return null;
  return provider;
}

// Status info for health checks / diagnostics (never includes secrets).
// Full status — includes the vendor name. Server-side only (boot logs, diagnostics).
// Never send this straight to a browser: see getPublicProviderStatus below.
function getProviderStatus() {
  const name = currentProviderName();
  const provider = PROVIDERS[name];
  return {
    provider: name || null,
    known: Boolean(provider),
    configured: Boolean(provider && provider.isConfigured()),
    supportsImages: Boolean(provider && provider.supportsImages),
  };
}

// What the browser is allowed to know: whether the AI is usable and whether it can take
// images — never which vendor or model is behind it. H1 presents one AI ("the H1 model"),
// and the provider is an implementation detail that must not reach the client, since anything
// in an HTTP response is visible in devtools.
function getPublicProviderStatus() {
  const { known, configured, supportsImages } = getProviderStatus();
  return { known, configured, supportsImages };
}

module.exports = { getProvider, getProviderStatus, getPublicProviderStatus };
