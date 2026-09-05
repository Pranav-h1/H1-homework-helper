import { safeGet, safeGetJson, safeSetJson } from "./storage.js";

const CONVERSATIONS_KEY = "h1-conversations";
const ACTIVE_KEY = "h1-active-conversation";
const LEGACY_HISTORY_KEY = "h1-chat-history";
const MAX_TITLE_LENGTH = 42;

function uid() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New conversation";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > MAX_TITLE_LENGTH ? text.slice(0, MAX_TITLE_LENGTH - 1) + "…" : text;
}

function migrateLegacyHistory(list) {
  const legacy = safeGetJson(LEGACY_HISTORY_KEY, null);
  if (!Array.isArray(legacy) || legacy.length === 0) return list;
  const now = Date.now();
  const migrated = {
    id: uid(),
    title: deriveTitle(legacy),
    subject: safeGet("h1-subject", "general"),
    createdAt: now,
    updatedAt: now,
    messages: legacy,
  };
  return [migrated, ...list];
}

export function loadConversations() {
  let list = safeGetJson(CONVERSATIONS_KEY, null);
  if (!Array.isArray(list)) {
    list = migrateLegacyHistory([]);
    saveConversations(list);
  }
  return list;
}

export function saveConversations(list) {
  safeSetJson(CONVERSATIONS_KEY, list);
}

export function getActiveConversationId() {
  return safeGet(ACTIVE_KEY, null);
}

export function setActiveConversationId(id) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignored
  }
}

export function createConversation(subject) {
  const now = Date.now();
  const conv = { id: uid(), title: "New conversation", subject: subject || "general", createdAt: now, updatedAt: now, messages: [] };
  const list = loadConversations();
  list.unshift(conv);
  saveConversations(list);
  setActiveConversationId(conv.id);
  return conv;
}

export function getConversation(id) {
  return loadConversations().find((c) => c.id === id) || null;
}

export function updateConversationMessages(id, messages) {
  const list = loadConversations();
  const conv = list.find((c) => c.id === id);
  if (!conv) return;
  conv.messages = messages;
  conv.updatedAt = Date.now();
  if (conv.title === "New conversation") conv.title = deriveTitle(messages);
  saveConversations(list);
}

export function renameConversation(id, title) {
  const list = loadConversations();
  const conv = list.find((c) => c.id === id);
  if (!conv) return;
  conv.title = title.trim() || conv.title;
  saveConversations(list);
}

export function deleteConversation(id) {
  const list = loadConversations().filter((c) => c.id !== id);
  saveConversations(list);
  if (getActiveConversationId() === id) {
    setActiveConversationId(list[0] ? list[0].id : null);
  }
  return list;
}

export function clearAllConversations() {
  saveConversations([]);
  setActiveConversationId(null);
}

export function ensureActiveConversation(subject) {
  let list = loadConversations();
  let activeId = getActiveConversationId();
  let conv = activeId ? list.find((c) => c.id === activeId) : null;
  if (!conv) {
    if (list.length > 0) {
      conv = list[0];
      setActiveConversationId(conv.id);
    } else {
      conv = createConversation(subject);
    }
  }
  return conv;
}
