import { renderMarkdown } from "./markdown.js";
import { safeGet, safeSet } from "./storage.js";
import { showToast } from "./toast.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { appState, AI_MODES, setMode } from "./state.js";
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
} from "./conversations.js";

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

const attachImageBtn = document.getElementById("attachImageBtn");
const attachImageInput = document.getElementById("attachImageInput");
const attachDocBtn = document.getElementById("attachDocBtn");
const attachDocInput = document.getElementById("attachDocInput");
const voiceInputBtn = document.getElementById("voiceInputBtn");
const attachedPreview = document.getElementById("attachedFilePreview");
const attachedImageThumb = document.getElementById("attachedImageThumb");
const attachedFileLabel = document.getElementById("attachedFileLabel");
const removeAttachedFileBtn = document.getElementById("removeAttachedFileBtn");

let activeConversation = null;
let messages = [];
let isSending = false;
let enterMode = safeGet("h1-enter-mode", "enter");
let pendingImage = null; // { mimeType, data (base64, no prefix) }

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

function renderMessage(msg, index, isLast) {
  const { row, body } = buildMessageRow(msg.role);
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (msg.role === "assistant") {
    bubble.innerHTML = renderMarkdown(msg.content);
  } else {
    bubble.textContent = msg.content;
    if (msg.image) {
      const thumb = document.createElement("img");
      thumb.src = `data:${msg.image.mimeType};base64,${msg.image.data}`;
      thumb.alt = "Attached image";
      thumb.style.maxWidth = "180px";
      thumb.style.borderRadius = "12px";
      thumb.style.display = "block";
      thumb.style.marginTop = "8px";
      bubble.appendChild(thumb);
    }
  }
  body.appendChild(bubble);

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.alignItems = "center";
  footer.style.gap = "8px";
  footer.style.flexWrap = "wrap";

  if (msg.role === "assistant") {
    const bar = document.createElement("div");
    bar.className = "message-action-bar";
    const copyBtn = actionButton("Copy", "copy");
    copyBtn.addEventListener("click", () => copyText(msg.content, copyBtn));
    bar.appendChild(copyBtn);

    if (isLast) {
      const regenBtn = actionButton("Regenerate", "regenerate");
      regenBtn.addEventListener("click", () => handleAction("regenerate", index));
      bar.appendChild(regenBtn);

      const simplerBtn = actionButton("Explain simpler", "simpler");
      simplerBtn.addEventListener("click", () => handleAction("simpler", index));
      bar.appendChild(simplerBtn);

      const shorterBtn = actionButton("Make shorter", "shorter");
      shorterBtn.addEventListener("click", () => handleAction("shorter", index));
      bar.appendChild(shorterBtn);

      const exampleBtn = actionButton("Give example", "example");
      exampleBtn.addEventListener("click", () => handleAction("example", index));
      bar.appendChild(exampleBtn);
    }

    const quizBtn = actionButton("Turn into quiz", "quiz");
    quizBtn.addEventListener("click", () => handleAction("quiz", index));
    bar.appendChild(quizBtn);

    const flashBtn = actionButton("Make flashcards", "flashcards");
    flashBtn.addEventListener("click", () => handleAction("flashcards", index));
    bar.appendChild(flashBtn);

    footer.appendChild(bar);
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

async function requestReply(imageForRequest) {
  setSending(true);
  showTyping();
  try {
    const reply = await sendChat(messages, appState.subject, { mode: appState.mode, image: imageForRequest });
    hideTyping();
    addMessage("assistant", reply);
  } catch (err) {
    hideTyping();
    showErrorBubble(friendlyErrorMessage(err));
  } finally {
    setSending(false);
    messageInput.focus();
  }
}

export function sendMessage(text) {
  const image = pendingImage;
  addMessage("user", text, image ? { image } : undefined);
  clearAttachment();
  logEvent("question", { source: "chat" });
  requestReply(image || undefined);
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
  const text = messageInput.value.trim();
  if (!text && !pendingImage) return;
  const finalText = text || "What can you tell me about this image?";
  messageInput.value = "";
  autoGrow(messageInput);
  sendMessage(finalText);
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (enterMode === "enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  } else if (enterMode === "ctrlenter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

messageInput.addEventListener("input", () => autoGrow(messageInput));

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

/* ---------------------------------------------------------
   Attachments: image, text document, voice input
   --------------------------------------------------------- */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function clearAttachment() {
  pendingImage = null;
  attachedPreview.hidden = true;
  attachedImageThumb.hidden = true;
  attachImageInput.value = "";
}

attachImageBtn.addEventListener("click", () => attachImageInput.click());
attachImageInput.addEventListener("change", async () => {
  const file = attachImageInput.files[0];
  if (!file) return;
  const MAX_BYTES = 6 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    showToast("That image is too large (max 6MB).", "error");
    attachImageInput.value = "";
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const [, base64] = dataUrl.split(",");
    pendingImage = { mimeType: file.type, data: base64 };
    attachedImageThumb.src = dataUrl;
    attachedImageThumb.hidden = false;
    attachedFileLabel.textContent = file.name;
    attachedPreview.hidden = false;
    messageInput.focus();
  } catch {
    showToast("Couldn't read that image.", "error");
  }
});

attachDocBtn.addEventListener("click", () => attachDocInput.click());
attachDocInput.addEventListener("change", async () => {
  const file = attachDocInput.files[0];
  if (!file) return;
  if (!/\.txt$/i.test(file.name)) {
    showToast("Only .txt files are supported for document upload right now.", "error");
    attachDocInput.value = "";
    return;
  }
  try {
    const text = await file.text();
    const trimmed = text.trim().slice(0, 4000);
    messageInput.value = messageInput.value ? `${messageInput.value}\n\n${trimmed}` : trimmed;
    autoGrow(messageInput);
    showToast(`Added "${file.name}" to your message.`, "success");
  } catch {
    showToast("Couldn't read that file.", "error");
  } finally {
    attachDocInput.value = "";
  }
});

removeAttachedFileBtn.addEventListener("click", clearAttachment);

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
  activeConversation = ensureActiveConversation(appState.subject);
  messages = activeConversation.messages || [];
  chatTitle.textContent = activeConversation.title || "Ask H1";
  renderAllMessages();
}

function clearChat() {
  if (messages.length === 0) return;
  confirmDanger("Clear this conversation?", "This can't be undone.", "Clear", () => {
    messages = [];
    persist();
    renderAllMessages();
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
  showToast("Started a new conversation.", "success", 1800);
});

function renderHistoryList() {
  const list = loadConversations();
  historyList.innerHTML = "";
  if (list.length === 0) {
    historyList.innerHTML =
      '<div class="empty-state"><div class="empty-emoji">💬</div><h2>No conversations yet</h2><p>Start your first question with Ask H1.</p></div>';
    return;
  }
  list.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "history-item" + (activeConversation && conv.id === activeConversation.id ? " active" : "");

    const main = document.createElement("button");
    main.type = "button";
    main.className = "history-item-main";
    main.innerHTML = '<div class="history-item-title"></div><div class="history-item-meta"></div>';
    main.querySelector(".history-item-title").textContent = conv.title;
    const date = new Date(conv.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" });
    main.querySelector(".history-item-meta").textContent = `${date} · ${conv.messages.length} messages`;
    main.addEventListener("click", () => {
      setActiveConversationId(conv.id);
      loadActiveIntoView();
      historyOverlay.hidden = true;
    });

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

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
        renderHistoryList();
        if (activeConversation && activeConversation.id === conv.id) {
          loadActiveIntoView();
        }
        showToast("Conversation deleted.", "success");
      });
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(main);
    item.appendChild(actions);
    historyList.appendChild(item);
  });
}

historyBtn.addEventListener("click", () => {
  renderHistoryList();
  historyOverlay.hidden = false;
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
  historyOverlay.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !historyOverlay.hidden) historyOverlay.hidden = true;
});

window.addEventListener("h1:conversation-selected", loadActiveIntoView);

export function initChat() {
  loadActiveIntoView();
}

export function clearAllConversationsData() {
  messages = [];
  renderAllMessages();
}
