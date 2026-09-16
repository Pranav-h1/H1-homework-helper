import { renderMarkdown } from "./markdown.js";
import { safeGet, safeSet } from "./storage.js";
import { showToast } from "./toast.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { appState, AI_MODES, setMode, onModeChange } from "./state.js";
import { switchView } from "./nav.js";
import { confirmDanger, promptForText } from "./modal.js";
import { logEvent } from "./progress.js";
import {
  ensureActiveConversation,
  getActiveConversationId,
  setActiveConversationId,
  getConversation,
  updateConversationMessages,
  loadConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  toggleConversationFavorite,
} from "./conversations.js";
import { setChatContextConversation, consumeContextPrefix, consumeBrainPrefix } from "./chatContext.js";
import { tryHandleAiCommand, resolveSlashCommand, SLASH_COMMANDS } from "./aiCommands.js";
import { isSupported as isSpeechSupported, toggleReadAloud, stopSpeaking } from "./readAloud.js";
import { saveQuickNote } from "./notes.js";
import { prefillStudyPlan } from "./planner.js";
import { saveAnswer } from "./vaultStore.js";
import {
  initChatAttachments,
  clearAttachments,
  hasAttachments,
  isReading,
  commitAttachments,
  defaultPromptFor,
} from "./chatAttachments.js";
import { getFile, deleteFilesForConversation, clearAllFiles, isPersistent } from "./fileStore.js";
import { formatBytes } from "./fileReaders.js";

const chatTitle = document.getElementById("chatTitle");
const chatLog = document.getElementById("chatLog");
const emptyState = document.getElementById("emptyState");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const newChatBtn = document.getElementById("newChatBtn");
const historyBtn = document.getElementById("historyBtn");
const composerHint = document.getElementById("composerHint");
const settingsClearChatBtn = document.getElementById("settingsClearChatBtn");
const modeSelect = document.getElementById("chatModeSelect");

const historyOverlay = document.getElementById("historyOverlay");
const historyList = document.getElementById("historyList");
const historyCloseBtn = document.getElementById("historyCloseBtn");
const historyNewBtn = document.getElementById("historyNewBtn");
const historySearchInput = document.getElementById("historySearchInput");

const voiceInputBtn = document.getElementById("voiceInputBtn");

let activeConversation = null;
let messages = [];
let isSending = false;
let enterMode = safeGet("h1-enter-mode", "enter");

function autoScrollEnabled() {
  return safeGet("h1-auto-scroll", "1") !== "0";
}

function saveConversationsEnabled() {
  return safeGet("h1-save-conversations", "1") !== "0";
}

function persist() {
  if (!activeConversation || !saveConversationsEnabled()) return;
  updateConversationMessages(activeConversation.id, messages);
  const fresh = getConversation(activeConversation.id);
  if (fresh) {
    activeConversation = fresh;
    chatTitle.textContent = fresh.title;
  }
}

function scrollChatToBottom() {
  if (autoScrollEnabled()) chatLog.scrollTop = chatLog.scrollHeight;
}

function updateEmptyState() {
  emptyState.hidden = messages.length > 0;
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function buildMessageRow(role) {
  const row = document.createElement("div");
  row.className = `message ${role === "user" ? "user" : "ai"}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "H1";
  const body = document.createElement("div");
  body.className = "message-body";
  row.appendChild(avatar);
  row.appendChild(body);
  return { row, body };
}

async function copyText(text, btn) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    const original = btn.textContent;
    btn.classList.add("copied");
    btn.textContent = "Copied!";
    showToast("Copied to clipboard.", "success", 1800);
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = original;
    }, 1500);
  } catch {
    showToast("Couldn't copy to clipboard.", "error");
  }
}

function actionButton(label, action) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn-sm";
  btn.textContent = label;
  btn.dataset.action = action;
  return btn;
}

function topicFromIndex(index) {
  const prevUser = [...messages.slice(0, index)].reverse().find((m) => m.role === "user");
  const source = prevUser ? prevUser.content : messages[index].content;
  return source.trim().replace(/\s+/g, " ").slice(0, 150);
}

function sendFollowUp(text) {
  messages.push({ role: "user", content: text, ts: Date.now() });
  persist();
  requestReply();
}

function handleAction(action, index) {
  const msg = messages[index];
  if (!msg) return;

  if (action === "copy") return; // handled inline where the button is created (needs the button element)

  if (action === "regenerate") {
    messages.splice(index, 1);
    persist();
    renderAllMessages();
    requestReply();
    return;
  }

  if (action === "simpler") return sendFollowUp("Can you explain your last answer more simply?");
  if (action === "shorter") return sendFollowUp("Can you make your last answer shorter and more to the point?");
  if (action === "example") return sendFollowUp("Can you give a concrete example for that?");
  if (action === "harder") return sendFollowUp("Can you give me a harder, more challenging version of this?");
  if (action === "hint") return sendFollowUp("Instead of the full answer, can you just give me a hint so I can try it myself?");
  if (action === "improve") return sendFollowUp("Can you improve that answer — keep the same core idea, but make it clearer and more correct?");

  if (action === "notes") {
    const topic = topicFromIndex(index);
    saveQuickNote(topic.slice(0, 60) || "From AI Tutor", msg.content);
    showToast("Saved to Notes.", "success", 2000);
    return;
  }

  if (action === "vault") {
    saveAnswer({ question: topicFromIndex(index), answer: msg.content, subject: appState.subject });
    showToast("Saved to your Vault.", "success", 2000);
    return;
  }

  if (action === "plan") {
    const topic = topicFromIndex(index);
    switchView("planner");
    prefillStudyPlan(topic);
    showToast("Topic filled in — review and click \"Build plan\".", "success", 2600);
    return;
  }

  if (action === "quiz" || action === "flashcards") {
    const topic = topicFromIndex(index);
    switchView(action === "quiz" ? "quiz" : "flashcards");
    const input = document.getElementById(action === "quiz" ? "quizTopic" : "flashTopic");
    if (input) {
      input.value = topic;
      input.focus();
    }
    showToast(`Topic filled in from the chat — review it and generate ${action === "quiz" ? "your quiz" : "flashcards"}.`);
  }
}

function closeAllPopovers(except) {
  document.querySelectorAll(".msg-popover").forEach((p) => {
    if (p !== except) p.hidden = true;
  });
}
document.addEventListener("click", () => closeAllPopovers());

// A contextual popover behind a single "•••" trigger, rather than a permanent row of
// buttons on every AI message — keeps the conversation canvas calm (see H1 material system).
function buildMessagePopover(msg, index, isLast) {
  const wrap = document.createElement("div");
  wrap.className = "msg-popover-wrap";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "msg-more-btn";
  trigger.setAttribute("aria-label", "Message actions");
  trigger.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle></svg>';

  const popover = document.createElement("div");
  popover.className = "msg-popover";
  popover.hidden = true;
  popover.setAttribute("role", "menu");

  const copyBtn = actionButton("Copy", "copy");
  copyBtn.addEventListener("click", () => copyText(msg.content, copyBtn));
  popover.appendChild(copyBtn);

  const readBtn = actionButton(isSpeechSupported() ? "🔊 Read aloud" : "Read aloud unavailable", "read");
  readBtn.disabled = !isSpeechSupported();
  readBtn.addEventListener("click", () => toggleReadAloud(msg.content, readBtn));
  popover.appendChild(readBtn);

  if (isLast) {
    [
      ["Regenerate", "regenerate"],
      ["Explain simpler", "simpler"],
      ["Make shorter", "shorter"],
      ["Give example", "example"],
      ["Make harder", "harder"],
      ["Give me a hint instead", "hint"],
      ["Improve this answer", "improve"],
    ].forEach(([label, action]) => {
      const btn = actionButton(label, action);
      btn.addEventListener("click", () => handleAction(action, index));
      popover.appendChild(btn);
    });
  }

  [
    ["Add to Notes", "notes"],
    ["💾 Save to Vault", "vault"],
    ["Add to Study Plan", "plan"],
    ["Turn into quiz", "quiz"],
    ["Make flashcards", "flashcards"],
  ].forEach(([label, action]) => {
    const btn = actionButton(label, action);
    btn.addEventListener("click", () => handleAction(action, index));
    popover.appendChild(btn);
  });

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = popover.hidden;
    closeAllPopovers();
    popover.hidden = !willOpen;
  });
  popover.addEventListener("click", (e) => e.stopPropagation());

  wrap.appendChild(trigger);
  wrap.appendChild(popover);
  return wrap;
}

const ATTACH_BADGE = { pdf: "PDF", "pdf-scanned": "PDF", docx: "DOC", pptx: "PPT", xlsx: "XLS", text: "TXT" };

function attachmentSubtitle(ref) {
  if (ref.kind === "image") return ref.size ? formatBytes(ref.size) : "Image";
  const unit = ref.format === "pptx" ? "slide" : ref.format === "xlsx" ? "sheet" : "page";
  const bits = [];
  if (ref.pages) bits.push(`${ref.pages} ${unit}${ref.pages === 1 ? "" : "s"}`);
  if (ref.size) bits.push(formatBytes(ref.size));
  if (ref.truncated) bits.push("partly sent");
  return bits.join(" · ") || "Document";
}

// The files a student sent, shown inside their own message: thumbnails for pictures (click
// for the full image), a labelled card for documents. Older messages that embedded a single
// image directly still render.
function renderAttachmentStrip(msg) {
  const refs = msg.attachments || [];
  if (!refs.length && !msg.image) return null;
  const strip = document.createElement("div");
  strip.className = "bubble-attachments";

  if (msg.image) {
    const url = `data:${msg.image.mimeType};base64,${msg.image.data}`;
    strip.appendChild(imageTile(url, "Attached image", () => Promise.resolve(url)));
  }

  refs.forEach((ref) => {
    if (ref.kind === "image") {
      strip.appendChild(
        imageTile(ref.thumb, ref.name, async () => {
          const rec = await getFile(ref.id);
          return rec && rec.data ? `data:${rec.mimeType};base64,${rec.data}` : ref.thumb;
        })
      );
      return;
    }
    const card = document.createElement("div");
    card.className = "bubble-file";
    const badge = document.createElement("span");
    badge.className = "attach-badge";
    badge.dataset.format = ref.format || "file";
    badge.textContent = ATTACH_BADGE[ref.format] || (/\.([a-z0-9]+)$/i.exec(ref.name || "") || [, "FILE"])[1].slice(0, 4).toUpperCase();
    const meta = document.createElement("span");
    meta.className = "bubble-file-meta";
    const name = document.createElement("span");
    name.className = "bubble-file-name";
    name.textContent = ref.name;
    const sub = document.createElement("span");
    sub.className = "bubble-file-sub";
    sub.textContent = attachmentSubtitle(ref);
    meta.appendChild(name);
    meta.appendChild(sub);
    card.appendChild(badge);
    card.appendChild(meta);
    strip.appendChild(card);
  });
  return strip;
}

function imageTile(thumbUrl, label, loadFull) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bubble-image";
  btn.setAttribute("aria-label", `View ${label}`);
  const img = document.createElement("img");
  img.src = thumbUrl || "";
  img.alt = label;
  img.loading = "lazy";
  btn.appendChild(img);
  btn.addEventListener("click", async () => openLightbox(await loadFull(), label));
  return btn;
}

let lightbox = null;
function openLightbox(url, label) {
  if (!url) return;
  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.innerHTML =
      '<button type="button" class="image-lightbox-close" aria-label="Close image">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      "</button><img alt=\"\" />";
    const close = () => {
      lightbox.hidden = true;
    };
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.closest(".image-lightbox-close")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox && !lightbox.hidden) close();
    });
    document.body.appendChild(lightbox);
  }
  const img = lightbox.querySelector("img");
  img.src = url;
  img.alt = label || "";
  lightbox.hidden = false;
  lightbox.querySelector(".image-lightbox-close").focus();
}

function renderMessage(msg, index, isLast) {
  const { row, body } = buildMessageRow(msg.role);
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (msg.role === "assistant") {
    bubble.innerHTML = renderMarkdown(msg.content);
  } else {
    const text = document.createElement("div");
    text.className = "bubble-text";
    text.textContent = msg.content;
    const strip = renderAttachmentStrip(msg);
    if (strip) bubble.appendChild(strip);
    bubble.appendChild(text);
  }
  body.appendChild(bubble);

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.alignItems = "center";
  footer.style.gap = "8px";
  footer.style.flexWrap = "wrap";

  if (msg.role === "assistant") {
    footer.appendChild(buildMessagePopover(msg, index, isLast));
  }

  if (msg.ts) {
    const ts = document.createElement("span");
    ts.className = "message-timestamp";
    ts.textContent = formatTime(msg.ts);
    footer.appendChild(ts);
  }
  body.appendChild(footer);

  chatLog.appendChild(row);
  return row;
}

function renderAllMessages() {
  chatLog.querySelectorAll(".message").forEach((el) => el.remove());
  messages.forEach((msg, i) => renderMessage(msg, i, i === messages.length - 1));
  updateEmptyState();
  scrollChatToBottom();
}

function addMessage(role, content, extra) {
  const msg = { role, content, ts: Date.now(), ...extra };
  messages.push(msg);
  renderAllMessages();
  persist();
  return msg;
}

function showTyping() {
  const { row, body } = buildMessageRow("assistant");
  row.id = "typingIndicator";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  body.appendChild(bubble);
  chatLog.appendChild(row);
  scrollChatToBottom();
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

function showErrorBubble(text) {
  const { row, body } = buildMessageRow("assistant");
  row.classList.add("error");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  body.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "message-actions";
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "icon-btn-sm";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", () => {
    row.remove();
    requestReply();
  });
  actions.appendChild(retryBtn);
  body.appendChild(actions);

  chatLog.appendChild(row);
  scrollChatToBottom();
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function setSending(state) {
  isSending = state;
  sendBtn.disabled = state;
  messageInput.disabled = state;
}

// How much document text the client sends in one request. The server enforces its own budget
// on top; this just avoids uploading text the server would only cut off.
const CLIENT_DOC_BUDGET = 140000;
const HISTORY_SENT = 20;

// Builds what's actually sent: each message's typed text, plus the real contents of any files
// attached to it, fetched back out of IndexedDB. Files are re-sent with every request so a
// follow-up like "what does page 3 say?" works — the model only ever sees what's in the
// request. Images are limited to the two most recent messages that had any, since re-sending
// every photo in a long conversation would be slow and rarely useful; document text is
// budgeted newest-first so the oldest files are the ones that get dropped.
async function buildRequestMessages(requestMessages, prefix) {
  const recent = requestMessages.slice(-HISTORY_SENT);
  const offset = requestMessages.length - recent.length;

  const imageTurns = new Set();
  for (let i = recent.length - 1; i >= 0 && imageTurns.size < 2; i--) {
    const m = recent[i];
    if (m.role !== "user") continue;
    const hasImages = Boolean(m.image) || (m.attachments || []).some((a) => a.kind === "image" || a.format === "pdf-scanned");
    if (hasImages) imageTurns.add(i);
  }

  let docBudget = CLIENT_DOC_BUDGET;
  const out = new Array(recent.length);
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const isLast = i + offset === requestMessages.length - 1;
    const entry = { role: m.role, content: isLast && prefix ? prefix + m.content : m.content };

    if (m.role === "user") {
      const images = [];
      const documents = [];
      if (m.image && imageTurns.has(i)) images.push({ mimeType: m.image.mimeType, data: m.image.data });

      for (const ref of m.attachments || []) {
        const rec = await getFile(ref.id);
        if (!rec) {
          documents.push({
            name: ref.name,
            text: "[This file was attached earlier but its contents aren't available on this device any more. If you need it, ask the student to attach it again.]",
          });
          continue;
        }
        if (rec.kind === "image") {
          if (imageTurns.has(i)) images.push({ mimeType: rec.mimeType, data: rec.data });
          continue;
        }
        if (rec.images && rec.images.length && imageTurns.has(i)) rec.images.forEach((img) => images.push(img));
        if (rec.text) {
          if (docBudget <= 0) {
            documents.push({ name: rec.name, text: "[Not included — the files in this conversation are more than H1 can read at once.]" });
            continue;
          }
          const text = rec.text.slice(0, docBudget);
          docBudget -= text.length;
          documents.push({ name: rec.name, text, truncated: Boolean(rec.truncated) || text.length < rec.text.length });
        }
      }
      if (images.length) entry.images = images.slice(0, 8);
      if (documents.length) entry.documents = documents;
    }
    out[i] = entry;
  }
  return out;
}

async function requestReply() {
  // Captured now, not read again after the await — if the user switches to a different
  // conversation while this request is in flight, the reply must land in the conversation
  // that actually asked for it, not whatever happens to be on screen when it resolves.
  const requestConversationId = activeConversation ? activeConversation.id : null;
  const requestMessages = messages;
  setSending(true);
  showTyping();
  try {
    // Two prefixes ride along on the outgoing message only (never stored or rendered):
    // what the student attached by hand, and what the Second Brain knows about how their
    // studying is actually going. The brain briefing is sized against whatever room is left
    // under the backend's per-message cap, so attachments never get squeezed out by it.
    const lastMessage = requestMessages[requestMessages.length - 1];
    const contextPrefix = consumeContextPrefix();
    const brainPrefix = consumeBrainPrefix(lastMessage ? lastMessage.content : "", contextPrefix);
    const payload = await buildRequestMessages(requestMessages, brainPrefix + contextPrefix);
    const reply = await sendChat(payload, appState.subject, { mode: appState.mode, language: appState.language });
    hideTyping();
    if (activeConversation && activeConversation.id === requestConversationId) {
      addMessage("assistant", reply);
    } else {
      requestMessages.push({ role: "assistant", content: reply, ts: Date.now() });
      if (saveConversationsEnabled()) updateConversationMessages(requestConversationId, requestMessages);
      showToast("A reply finished in another conversation — check History.", "success", 3200);
    }
  } catch (err) {
    hideTyping();
    if (activeConversation && activeConversation.id === requestConversationId) {
      showErrorBubble(friendlyErrorMessage(err));
    }
  } finally {
    setSending(false);
    messageInput.focus();
  }
}

export async function sendMessage(text) {
  const withFiles = hasAttachments();
  let outgoing = (text || "").trim();

  // "/quiz fractions", "/hint", "/notes save this" etc. — deterministic, and only checked when
  // nothing is attached: a message with files always goes to the AI with those files.
  if (!withFiles) {
    if (!outgoing) return;
    const slash = resolveSlashCommand(outgoing);
    if (slash) {
      if (slash.action === "handled") return;
      outgoing = slash.text;
    } else if (tryHandleAiCommand(outgoing)) {
      // Actionable natural-language requests ("make flashcards from this", "open my Math
      // space") are routed to the real H1 feature instead of becoming a normal AI turn.
      return;
    }
    addMessage("user", outgoing);
    logEvent("question", { source: "chat" });
    requestReply();
    return;
  }

  setSending(true);
  let refs = [];
  try {
    refs = await commitAttachments(activeConversation ? activeConversation.id : "unsaved");
  } catch {
    setSending(false);
    showToast("Couldn't prepare your files. Try attaching them again.", "error", 3600);
    return;
  }
  clearAttachments();
  if (!outgoing) outgoing = defaultPromptFor(refs);
  if (!isPersistent()) {
    showToast("Your browser isn't letting H1 store files, so these attachments will only last until you reload.", "error", 4200);
  }
  addMessage("user", outgoing, { attachments: refs });
  logEvent("question", { source: "chat", attachments: refs.length });
  requestReply();
}

// Entry point for quick actions / hero search elsewhere in the app.
export function openChatWithMessage(text) {
  switchView("chat");
  if (!text) {
    messageInput.focus();
    return;
  }
  sendMessage(text);
}

export function prefillChat(text) {
  switchView("chat");
  messageInput.value = text;
  autoGrow(messageInput);
  messageInput.focus();
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (isSending) return;
  if (isReading()) {
    showToast("Still reading your files — send again in a moment.", "error", 2400);
    return;
  }
  const text = messageInput.value.trim();
  if (!text && !hasAttachments()) return;
  messageInput.value = "";
  autoGrow(messageInput);
  sendMessage(text);
});

/* ---------------------------------------------------------
   Slash command menu — shows real, discoverable commands as
   soon as the composer starts with "/", instead of hidden
   functionality only power users would ever find.
   --------------------------------------------------------- */
const slashMenu = document.getElementById("slashMenu");
let slashMenuMatches = [];
let slashMenuActiveIndex = -1;

function insertSlashCommand(name) {
  messageInput.value = `/${name} `;
  autoGrow(messageInput);
  closeSlashMenu();
  messageInput.focus();
}

function renderSlashMenu() {
  slashMenu.innerHTML = "";
  slashMenuMatches.forEach((cmd, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slash-menu-item" + (i === slashMenuActiveIndex ? " active" : "");
    btn.setAttribute("role", "option");
    btn.innerHTML = `<strong></strong><span></span>`;
    btn.querySelector("strong").textContent = `/${cmd.name}`;
    btn.querySelector("span").textContent = cmd.hint;
    btn.addEventListener("click", () => insertSlashCommand(cmd.name));
    slashMenu.appendChild(btn);
  });
}

function openSlashMenu(query) {
  slashMenuMatches = SLASH_COMMANDS.filter((c) => c.name.startsWith(query));
  if (slashMenuMatches.length === 0) {
    closeSlashMenu();
    return;
  }
  slashMenuActiveIndex = 0;
  slashMenu.hidden = false;
  renderSlashMenu();
}

function closeSlashMenu() {
  slashMenu.hidden = true;
  slashMenuMatches = [];
  slashMenuActiveIndex = -1;
}

function syncSlashMenu() {
  const value = messageInput.value;
  const match = value.match(/^\/(\S*)$/);
  if (match) {
    openSlashMenu(match[1].toLowerCase());
  } else {
    closeSlashMenu();
  }
}

messageInput.addEventListener("keydown", (e) => {
  if (!slashMenu.hidden) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      slashMenuActiveIndex = (slashMenuActiveIndex + 1) % slashMenuMatches.length;
      renderSlashMenu();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      slashMenuActiveIndex = (slashMenuActiveIndex - 1 + slashMenuMatches.length) % slashMenuMatches.length;
      renderSlashMenu();
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertSlashCommand(slashMenuMatches[slashMenuActiveIndex].name);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeSlashMenu();
      return;
    }
  }

  if (e.key !== "Enter") return;
  if (enterMode === "enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  } else if (enterMode === "ctrlenter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

messageInput.addEventListener("input", () => {
  autoGrow(messageInput);
  syncSlashMenu();
});

chatForm.addEventListener("submit", () => closeSlashMenu());

export function setEnterMode(mode) {
  enterMode = mode;
  composerHint.textContent =
    mode === "ctrlenter" ? "Ctrl + Enter to send · Enter for a new line" : "Enter to send · Shift + Enter for a new line";
}
setEnterMode(enterMode);

/* ---------------------------------------------------------
   AI tutor mode selector
   --------------------------------------------------------- */
AI_MODES.forEach((m) => {
  const opt = document.createElement("option");
  opt.value = m.value;
  opt.textContent = `${m.icon} ${m.label}`;
  opt.title = m.description;
  modeSelect.appendChild(opt);
});
modeSelect.value = appState.mode;
modeSelect.addEventListener("change", () => {
  setMode(modeSelect.value);
  const found = AI_MODES.find((m) => m.value === modeSelect.value);
  if (found) showToast(`Mode: ${found.label} — ${found.description}`, "success", 2200);
});

// The mode can also change from outside this dropdown (e.g. the "/teach" slash command) —
// keep the visible selector honest about which mode is actually active either way.
onModeChange((mode) => {
  modeSelect.value = mode;
});

/* ---------------------------------------------------------
   Voice input (file, photo and screenshot attachments live in chatAttachments.js)
   --------------------------------------------------------- */
// Voice input via the Web Speech API — only shown when the browser actually supports it.
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognitionCtor) {
  voiceInputBtn.hidden = false;
  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  let listening = false;

  recognition.addEventListener("result", (e) => {
    const transcript = e.results[0][0].transcript;
    messageInput.value = messageInput.value ? `${messageInput.value} ${transcript}` : transcript;
    autoGrow(messageInput);
  });
  recognition.addEventListener("end", () => {
    listening = false;
    voiceInputBtn.classList.remove("voice-recording");
  });
  recognition.addEventListener("error", () => {
    listening = false;
    voiceInputBtn.classList.remove("voice-recording");
    showToast("Couldn't hear that — try again.", "error");
  });

  voiceInputBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      listening = true;
      voiceInputBtn.classList.add("voice-recording");
    } catch {
      // recognition already running or unavailable in this state — ignore
    }
  });
}

function loadActiveIntoView() {
  stopSpeaking();
  activeConversation = ensureActiveConversation(appState.subject);
  messages = activeConversation.messages || [];
  chatTitle.textContent = activeConversation.title || "Ask H1";
  renderAllMessages();
  setChatContextConversation(activeConversation.id);
}

function clearChat() {
  if (messages.length === 0) return;
  confirmDanger("Clear this conversation?", "This can't be undone.", "Clear", () => {
    messages = [];
    persist();
    renderAllMessages();
    if (activeConversation) deleteFilesForConversation(activeConversation.id);
    showToast("Chat cleared.", "success");
  });
}

clearChatBtn.addEventListener("click", clearChat);
settingsClearChatBtn.addEventListener("click", clearChat);

newChatBtn.addEventListener("click", () => {
  activeConversation = createConversation(appState.subject);
  messages = [];
  chatTitle.textContent = activeConversation.title;
  renderAllMessages();
  setChatContextConversation(activeConversation.id);
  showToast("Started a new conversation.", "success", 1800);
});

function renderHistoryList() {
  const query = historySearchInput.value.trim().toLowerCase();
  let list = loadConversations();
  if (query) {
    list = list.filter((conv) => {
      if (conv.title.toLowerCase().includes(query)) return true;
      return conv.messages.some((m) => m.content && m.content.toLowerCase().includes(query));
    });
  }
  // Pinned conversations surface first, most-recent within each group — matches how
  // Favorites/Spaces already treat "pinned" content as promoted rather than reordering by pin time.
  list = [...list].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  historyList.innerHTML = "";
  if (list.length === 0) {
    historyList.innerHTML = query
      ? '<div class="empty-state"><div class="empty-emoji">🔍</div><h2>No matches</h2><p>Try a different search term.</p></div>'
      : '<div class="empty-state"><div class="empty-emoji">💬</div><h2>No conversations yet</h2><p>Start your first question with Ask H1.</p></div>';
    return;
  }
  list.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "history-item" + (activeConversation && conv.id === activeConversation.id ? " active" : "");

    const main = document.createElement("button");
    main.type = "button";
    main.className = "history-item-main";
    main.innerHTML = '<div class="history-item-title"></div><div class="history-item-meta"></div>';
    main.querySelector(".history-item-title").textContent = (conv.favorite ? "📌 " : "") + conv.title;
    const date = new Date(conv.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" });
    main.querySelector(".history-item-meta").textContent = `${date} · ${conv.messages.length} messages`;
    main.addEventListener("click", () => {
      setActiveConversationId(conv.id);
      loadActiveIntoView();
      historyOverlay.hidden = true;
    });

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "icon-btn-sm";
    pinBtn.textContent = conv.favorite ? "Unpin" : "Pin";
    pinBtn.title = conv.favorite ? "Remove from pinned" : "Pin this conversation";
    pinBtn.addEventListener("click", () => {
      toggleConversationFavorite(conv.id);
      renderHistoryList();
    });

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "icon-btn-sm";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", () => {
      promptForText("Rename conversation", conv.title, (newTitle) => {
        renameConversation(conv.id, newTitle);
        renderHistoryList();
        if (activeConversation && activeConversation.id === conv.id) {
          activeConversation.title = newTitle.trim() || conv.title;
          chatTitle.textContent = activeConversation.title;
        }
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      confirmDanger("Delete this conversation?", "This can't be undone.", "Delete", () => {
        deleteConversation(conv.id);
        deleteFilesForConversation(conv.id);
        renderHistoryList();
        if (activeConversation && activeConversation.id === conv.id) {
          loadActiveIntoView();
        }
        showToast("Conversation deleted.", "success");
      });
    });

    actions.appendChild(pinBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(main);
    item.appendChild(actions);
    historyList.appendChild(item);
  });
}

historySearchInput.addEventListener("input", renderHistoryList);

historyBtn.addEventListener("click", () => {
  historySearchInput.value = "";
  renderHistoryList();
  historyOverlay.hidden = false;
  historySearchInput.focus();
});
historyCloseBtn.addEventListener("click", () => {
  historyOverlay.hidden = true;
});
historyOverlay.addEventListener("click", (e) => {
  if (e.target === historyOverlay) historyOverlay.hidden = true;
});
historyNewBtn.addEventListener("click", () => {
  activeConversation = createConversation(appState.subject);
  messages = [];
  chatTitle.textContent = activeConversation.title;
  renderAllMessages();
  setChatContextConversation(activeConversation.id);
  historyOverlay.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !historyOverlay.hidden) historyOverlay.hidden = true;
});

window.addEventListener("h1:conversation-selected", loadActiveIntoView);

export function initChat() {
  initChatAttachments({
    onChange: () => {
      messageInput.placeholder = hasAttachments() || isReading()
        ? "Ask about what you attached — or just press send"
        : "Ask H1 anything — or attach a file, photo or screenshot";
    },
  });
  loadActiveIntoView();
}

export function clearAllConversationsData() {
  messages = [];
  clearAllFiles();
  renderAllMessages();
}
