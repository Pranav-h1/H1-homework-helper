// The controls only H1's own account sees: which model H1 answers with, how many AI messages
// everyone else gets, and who has been using it.
//
// Nothing here is a secret kept in the page. The section is hidden for other accounts as a
// courtesy, but the server decides: every one of these requests is refused unless the session
// belongs to the lab account, so revealing the section in devtools gets you a 403 and nothing
// else.
import * as session from "./session.js";
import { showToast } from "./toast.js";
import { confirmDanger } from "./modal.js";

const el = {};
let state = null;
let loading = false;

function $(id) {
  return document.getElementById(id);
}

async function api(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const { getCsrfToken } = await import("./accountApi.js");
  if (method !== "GET") headers["X-H1-CSRF"] = getCsrfToken() || "";
  const res = await fetch(`/api/creator${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "That didn't work. Please try again.");
  return data || {};
}

function relativeAge(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

function renderModels() {
  el.modelList.innerHTML = "";
  if (!state.models.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = "No models added yet. H1 is using whatever the server's configuration says.";
    el.modelList.appendChild(empty);
    return;
  }

  state.models.forEach((model) => {
    const row = document.createElement("div");
    row.className = "creator-model" + (model.active ? " is-active" : "");

    const text = document.createElement("div");
    text.className = "creator-model-text";
    const name = document.createElement("strong");
    name.textContent = model.label;
    const detail = document.createElement("span");
    detail.textContent = model.configured
      ? `${model.provider} · ${model.modelId}`
      : `${model.provider} · ${model.modelId} — no API key on this server`;
    if (!model.configured) detail.classList.add("creator-model-warn");
    text.append(name, detail);

    const actions = document.createElement("div");
    actions.className = "creator-model-actions";

    if (model.active) {
      const badge = document.createElement("span");
      badge.className = "creator-active-badge";
      badge.textContent = "In use";
      actions.appendChild(badge);
    } else {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "btn btn-ghost";
      use.textContent = "Use this";
      use.disabled = !model.configured;
      if (!model.configured) use.title = "This server has no API key for that provider.";
      use.addEventListener("click", () => setActive(model.id));
      actions.appendChild(use);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn-sm";
    remove.setAttribute("aria-label", `Remove ${model.label}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeModel(model));
    actions.appendChild(remove);

    row.append(text, actions);
    el.modelList.appendChild(row);
  });
}

function renderAccounts() {
  el.accounts.innerHTML = "";
  const rows = [...state.accounts].sort((a, b) => b.used - a.used);
  rows.forEach((person) => {
    const row = document.createElement("div");
    row.className = "creator-account";
    const name = document.createElement("strong");
    name.textContent = person.username;
    if (person.accountType === "lab") {
      const tag = document.createElement("span");
      tag.className = "creator-badge";
      tag.textContent = "creator";
      name.appendChild(tag);
    }
    const detail = document.createElement("span");
    detail.textContent =
      person.accountType === "lab"
        ? `${person.used} messages in the last ${state.windowHours}h · no limit`
        : `${person.used} of ${state.limit} messages in the last ${state.windowHours}h · joined ${relativeAge(person.createdAt)}`;
    row.append(name, detail);
    el.accounts.appendChild(row);
  });

  if (state.guests && state.guests.devices) {
    const row = document.createElement("div");
    row.className = "creator-account";
    const name = document.createElement("strong");
    name.textContent = "Without an account";
    const detail = document.createElement("span");
    detail.textContent = `${state.guests.devices} device${state.guests.devices === 1 ? "" : "s"} · ${state.guests.used} messages in the last ${state.windowHours}h`;
    row.append(name, detail);
    el.accounts.appendChild(row);
  }
}

function render() {
  if (!state) return;
  const active = state.models.find((m) => m.active);
  el.activeNote.textContent = active
    ? `H1 is answering with ${active.label}. Every student's question goes to this model.`
    : "H1 is using the model set in the server's configuration. Add one below and press “Use this” to change it from here.";

  el.provider.innerHTML = "";
  state.providers.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.name;
    option.textContent = p.configured ? p.name : `${p.name} (no API key)`;
    el.provider.appendChild(option);
  });
  const configured = state.providers.find((p) => p.configured);
  if (configured) el.provider.value = configured.name;

  renderModels();
  renderAccounts();
  if (document.activeElement !== el.limitInput) el.limitInput.value = String(state.limit);
  el.limitNote.textContent = `Applies to every account except this one, and to anyone using H1 without an account. Counted over a rolling ${state.windowHours} hours.`;
}

function showError(message) {
  el.modelError.textContent = message || "";
  el.modelError.hidden = !message;
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    state = await api("GET", "/overview");
    render();
  } catch (err) {
    showError(err.message);
  } finally {
    loading = false;
  }
}

async function setActive(id) {
  try {
    showError("");
    const result = await api("POST", "/models/active", { id });
    state.models = result.models;
    render();
    const active = state.models.find((m) => m.active);
    showToast(active ? `H1 now answers with ${active.label}.` : "Back to the server's configured model.", "success");
  } catch (err) {
    showError(err.message);
  }
}

function removeModel(model) {
  confirmDanger(
    `Remove ${model.label}?`,
    model.active ? "It's the model H1 is using, so H1 will go back to the one set in the server's configuration." : "It'll disappear from this list. Nothing else changes.",
    "Remove",
    async () => {
      try {
        const result = await api("POST", "/models/remove", { id: model.id });
        state.models = result.models;
        render();
        showToast(`Removed ${model.label}.`, "success");
      } catch (err) {
        showError(err.message);
      }
    }
  );
}

async function addModel() {
  showError("");
  const provider = el.provider.value;
  const modelId = el.modelId.value.trim();
  const label = el.modelLabel.value.trim();
  if (!modelId) {
    showError("Type the model's id — the name the provider knows it by.");
    el.modelId.focus();
    return;
  }
  try {
    const result = await api("POST", "/models", { provider, modelId, label });
    state.models = result.models;
    el.modelId.value = "";
    el.modelLabel.value = "";
    render();
    showToast("Model added. Press “Use this” to switch H1 over to it.", "success");
  } catch (err) {
    showError(err.message);
  }
}

async function saveLimit() {
  const value = Number(el.limitInput.value);
  if (!Number.isFinite(value) || value < 0) {
    showToast("That isn't a number of messages.", "error");
    return;
  }
  try {
    const result = await api("POST", "/limit", { limit: value });
    state.limit = result.limit;
    render();
    showToast(`Everyone else now gets ${result.limit} AI messages per ${state.windowHours} hours.`, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initCreatorPanel() {
  el.section = $("creatorSection");
  if (!el.section) return;
  el.activeNote = $("creatorActiveNote");
  el.modelList = $("creatorModelList");
  el.provider = $("creatorModelProvider");
  el.modelId = $("creatorModelId");
  el.modelLabel = $("creatorModelLabel");
  el.addBtn = $("creatorAddModel");
  el.modelError = $("creatorModelError");
  el.limitInput = $("creatorLimitInput");
  el.limitNote = $("creatorLimitNote");
  el.saveLimit = $("creatorSaveLimit");
  el.accounts = $("creatorAccounts");

  el.addBtn.addEventListener("click", addModel);
  el.modelId.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addModel();
    }
  });
  el.saveLimit.addEventListener("click", saveLimit);

  const sync = () => {
    const creator = session.isCreator();
    el.section.hidden = !creator;
    if (creator && !state) load();
  };
  session.onSessionChange(sync);
  sync();

  document.addEventListener("h1:view-changed", (event) => {
    if (event.detail === "settings" && session.isCreator()) load();
  });
}
