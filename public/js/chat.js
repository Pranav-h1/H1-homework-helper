import { renderMarkdown } from "./markdown.js";
import { safeGet, safeSet } from "./storage.js";
import { showToast } from "./toast.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { appState, AI_MODES, setMode, onModeChange } from "./state.js";
import { switchView } from "./nav.js";
import { confirmDanger, promptForText, openListPicker } from "./modal.js";
import { generatePracticeFromSource } from "./moreTools.js";
import { getProjects as getStudyProjects, linkNote } from "./projectsStore.js";
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
import { tryHandleAiCommand, resolveSlashCommand, longCommandPrompt, commandPromptForAttachments, SLASH_COMMANDS } from "./aiCommands.js";
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
  attachText,
  LONG_TEXT_CHARS,
} from "./chatAttachments.js";
import { getFile, deleteFilesForConversation, clearAllFiles, isPersistent } from "./fileStore.js";
import { formatBytes } from "./fileReaders.js";
import { decorateCodeBlocks } from "./codeBlocks.js";

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

/* ---------------------------------------------------------
   Scrolling
   The log is the one scroll region. It follows new output only while the student is already
   at the bottom; if they've scrolled up to read, nothing moves and a "New reply" pill appears
   instead. A long answer is revealed from its first line, not its last.
   --------------------------------------------------------- */
const NEAR_BOTTOM_PX = 140;
let followOutput = true;
let unreadReply = false;
let jumpBtn = null;

function prefersReducedMotion() {
  return document.documentElement.classList.contains("force-reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function distanceFromBottom() {
  return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight;
}

function isNearBottom() {
  return distanceFromBottom() < NEAR_BOTTOM_PX;
}

function scrollLogTo(top, smooth) {
  chatLog.scrollTo({ top, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
}

function scrollChatToBottom(smooth = false) {
  if (!autoScrollEnabled()) return;
  scrollLogTo(chatLog.scrollHeight, smooth);
  followOutput = true;
  unreadReply = false;
  updateJumpButton();
}

// A new answer: show it from the top if it's taller than most of the screen, otherwise just
// bring it fully into view.
function revealAnswer(row) {
  if (!autoScrollEnabled() || !followOutput) {
    unreadReply = true;
    updateJumpButton();
    return;
  }
  const tall = row.offsetHeight > chatLog.clientHeight * 0.7;
  // Reading a long answer from its top means deliberately leaving the bottom — stop following,
  // or the next size change (maths being typeset) would drag the view back down.
  if (tall) followOutput = false;
  scrollLogTo(tall ? row.offsetTop - 12 : chatLog.scrollHeight, true);
  unreadReply = false;
  updateJumpButton();
}

// Messages change height after they're drawn — maths is typeset when KaTeX arrives (often in the
// very frame a reply is appended), images decode. While following the conversation, stay pinned
// to the bottom through that growth; landing exactly on the newest line matters more than
// finishing a smooth-scroll that was aimed at the old, shorter height.
const rowObserver =
  typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        if (followOutput && autoScrollEnabled() && distanceFromBottom() > 1) chatLog.scrollTop = chatLog.scrollHeight;
      })
    : null;

function watchRow(row) {
  if (rowObserver) rowObserver.observe(row);
}

function updateJumpButton() {
  if (!jumpBtn) return;
  const far = distanceFromBottom() > Math.max(240, chatLog.clientHeight * 0.4);
  const show = far || (unreadReply && !isNearBottom());
  jumpBtn.hidden = !show;
  jumpBtn.querySelector("span").textContent = unreadReply ? "New reply" : "Jump to latest";
  jumpBtn.classList.toggle("has-unread", unreadReply);
}

function initScrollBehaviour() {
  chatLog.tabIndex = 0;
  chatLog.setAttribute("aria-label", "Conversation");
  jumpBtn = document.createElement("button");
  jumpBtn.type = "button";
  jumpBtn.className = "chat-jump";
  jumpBtn.hidden = true;
  jumpBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg><span>Jump to latest</span>';
  jumpBtn.addEventListener("click", () => {
    // Animating through thousands of pixels of conversation isn't a jump; only glide when the
    // latest message is close.
    scrollLogTo(chatLog.scrollHeight, distanceFromBottom() < chatLog.clientHeight * 3);
    unreadReply = false;
    followOutput = true;
    updateJumpButton();
  });
  chatLog.insertAdjacentElement("afterend", jumpBtn);

  let ticking = false;
  chatLog.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        followOutput = isNearBottom();
        if (followOutput) unreadReply = false;
        updateJumpButton();
      });
    },
    { passive: true }
  );

  // The pill sits just above the composer, whatever height the composer currently is.
  const chatMain = chatLog.parentElement;
  if (typeof ResizeObserver !== "undefined" && chatMain) {
    new ResizeObserver(() => chatMain.style.setProperty("--composer-h", `${chatForm.offsetHeight}px`)).observe(chatForm);
  }
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

// No avatar column: an answer is a full-width canvas and a question is a right-aligned bubble,
// which already says who's speaking — the avatar only cost every message 42px of width.
function buildMessageRow(role) {
  const row = document.createElement("div");
  row.className = `message ${role === "user" ? "user" : "ai"}`;
  const body = document.createElement("div");
  body.className = "message-body";
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
  addMessage("user", text);
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
  if (action === "detailed") return sendFollowUp("Can you go into more detail on that? Cover the underlying idea, why it works, and walk me through a worked example.");

  if (action === "practice") {
    // The answer itself is the source, so the questions test what was just explained rather
    // than the topic in general.
    generatePracticeFromSource(topicFromIndex(index).slice(0, 120), msg.content.slice(0, 3900));
    showToast("Writing practice questions from this answer…", "success", 2400);
    return;
  }

  if (action === "project") {
    const projects = getStudyProjects();
    openListPicker(
      "Add this answer to a project",
      projects.map((p) => ({
        id: p.id,
        icon: "📁",
        label: p.title,
        sublabel: [p.deadline ? `Due ${p.deadline}` : "", `${(p.linkedNoteIds || []).length} linked note${(p.linkedNoteIds || []).length === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
      })),
      (projectId) => {
        const project = projects.find((p) => p.id === projectId);
        const note = saveQuickNote(topicFromIndex(index).slice(0, 60) || "From AI Tutor", msg.content, "Projects");
        if (!note || !project) {
          showToast("Couldn't add it to that project.", "error", 2600);
          return;
        }
        linkNote(projectId, note.id);
        showToast(`Saved as a note and linked to "${project.title}".`, "success", 2800);
      },
      "You don't have any projects yet. Create one in Projects, then add answers to it from here."
    );
    return;
  }
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
    if (p === except) return;
    p.hidden = true;
    const trigger = p.parentElement && p.parentElement.querySelector(".msg-more-btn[aria-haspopup]");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}
document.addEventListener("click", () => closeAllPopovers());

// A contextual popover behind a single "•••" trigger, rather than a permanent row of
// buttons on every AI message — keeps the conversation canvas calm (see H1 material system).
const LAST_ANSWER_ACTIONS = [
  ["Regenerate", "regenerate"],
  ["Explain simpler", "simpler"],
  ["Make more detailed", "detailed"],
  ["Make shorter", "shorter"],
  ["Give example", "example"],
  ["Make harder", "harder"],
  ["Give me a hint instead", "hint"],
  ["Improve this answer", "improve"],
];

const ANY_ANSWER_ACTIONS = [
  ["Add to Notes", "notes"],
  ["💾 Save to Vault", "vault"],
  ["Add to Project", "project"],
  ["Add to Study Plan", "plan"],
  ["Create practice questions", "practice"],
  ["Turn into quiz", "quiz"],
  ["Make flashcards", "flashcards"],
];

// The menu is built when it's opened, not when the message is drawn: whether this is still the
// latest answer (which decides if "Regenerate" etc. apply) can change after it was rendered,
// and a long conversation shouldn't carry a hidden menu of buttons per message.
function buildMessagePopover(msg, index) {
  const wrap = document.createElement("div");
  wrap.className = "msg-popover-wrap";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "msg-more-btn";
  trigger.setAttribute("aria-label", "Message actions");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle></svg>';

  const popover = document.createElement("div");
  popover.className = "msg-popover";
  popover.hidden = true;
  popover.setAttribute("role", "menu");

  const choose = (action) => () => {
    // The menu closes once something is chosen; the action's own toast or view change is the
    // feedback.
    popover.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    handleAction(action, index);
  };

  function fill() {
    popover.innerHTML = "";
    const copyBtn = actionButton("Copy", "copy");
    copyBtn.addEventListener("click", () => copyText(msg.content, copyBtn));
    popover.appendChild(copyBtn);

    const readBtn = actionButton(isSpeechSupported() ? "🔊 Read aloud" : "Read aloud unavailable", "read");
    readBtn.disabled = !isSpeechSupported();
    readBtn.addEventListener("click", () => toggleReadAloud(msg.content, readBtn));
    popover.appendChild(readBtn);

    const isLast = index === messages.length - 1;
    [...(isLast ? LAST_ANSWER_ACTIONS : []), ...ANY_ANSWER_ACTIONS].forEach(([label, action]) => {
      const btn = actionButton(label, action);
      btn.setAttribute("role", "menuitem");
      btn.addEventListener("click", choose(action));
      popover.appendChild(btn);
    });
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = popover.hidden;
    closeAllPopovers();
    if (willOpen) fill();
    popover.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
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

function renderMessage(msg, index) {
  const { row, body } = buildMessageRow(msg.role);
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (msg.role === "assistant") {
    bubble.classList.add("answer");
    bubble.innerHTML = renderMarkdown(msg.content);
    decorateCodeBlocks(bubble);
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
    footer.className = "message-footer";
    const quickCopy = document.createElement("button");
    quickCopy.type = "button";
    quickCopy.className = "msg-more-btn msg-copy-btn";
    quickCopy.setAttribute("aria-label", "Copy answer");
    quickCopy.title = "Copy answer";
    quickCopy.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    quickCopy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(msg.content);
        quickCopy.classList.add("copied");
        showToast("Answer copied.", "success", 1600);
        setTimeout(() => quickCopy.classList.remove("copied"), 1400);
      } catch {
        showToast("Couldn't copy to clipboard.", "error");
      }
    });
    footer.appendChild(quickCopy);
    footer.appendChild(buildMessagePopover(msg, index));
  }

  if (msg.ts) {
    const ts = document.createElement("span");
    ts.className = "message-timestamp";
    ts.textContent = formatTime(msg.ts);
    footer.appendChild(ts);
  }
  body.appendChild(footer);

  chatLog.appendChild(row);
  watchRow(row);
  return row;
}

// A full redraw — only for opening a conversation or when earlier messages changed. Everyday
// sending and replying appends instead (see addMessage).
function renderAllMessages() {
  chatLog.querySelectorAll(".message").forEach((el) => {
    if (rowObserver) rowObserver.unobserve(el);
    el.remove();
  });
  // Redrawn messages don't replay the arrival animation — only genuinely new ones do.
  messages.forEach((msg, i) => renderMessage(msg, i).classList.add("no-enter"));
  updateEmptyState();
  unreadReply = false;
  followOutput = true;
  scrollChatToBottom();
}

function addMessage(role, content, extra) {
  const msg = { role, content, ts: Date.now(), ...extra };
  messages.push(msg);
  const row = renderMessage(msg, messages.length - 1);
  updateEmptyState();
  persist();
  if (role === "assistant") revealAnswer(row);
  else scrollChatToBottom(true);
  return msg;
}

function showTyping() {
  const { row, body } = buildMessageRow("assistant");
  row.id = "typingIndicator";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = '<span class="typing-dots" role="status" aria-label="H1 is writing a reply"><span></span><span></span><span></span></span>';
  body.appendChild(bubble);
  chatLog.appendChild(row);
  watchRow(row);
  if (followOutput) scrollChatToBottom(true);
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) {
    if (rowObserver) rowObserver.unobserve(el);
    el.remove();
  }
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
  watchRow(row);
  if (followOutput) scrollChatToBottom(true);
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
  else outgoing = commandPromptForAttachments(outgoing) || outgoing;
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
  // Too long for a message (typed, or dropped in some way the paste handler didn't see): send
  // it as an attached file rather than have the server turn it away.
  if (text.length > LONG_TEXT_CHARS) {
    // "/debug <a long program>" keeps its meaning: the program is attached, the command's
    // instruction is the message.
    const long = longCommandPrompt(text);
    attachText(long ? long.body : text).then(() => sendMessage(long ? long.prompt : ""));
    return;
  }
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
  initScrollBehaviour();
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
