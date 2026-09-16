// The chat composer's attachments: files, photos, pasted screenshots and screen captures.
//
// Four ways in, one pipeline:
//   • the + menu (any file, or photos)
//   • pasting — a Win+Shift+S / Cmd+Shift+4 screenshot lands straight in the composer
//   • dragging files onto the chat
//   • "Take a screenshot", which asks the browser to capture a screen, window or tab
//
// Every file is read in the browser the moment it's added (fileReaders.js), so the student
// sees immediately whether H1 can use it — "Word document · 4 pages of text", or a plain
// reason it can't — instead of finding out after they've sent the message.
import { readAnyFile, classifyFile, formatBytes, unsupportedReason } from "./fileReaders.js";
import { putFile } from "./fileStore.js";
import { showToast } from "./toast.js";

const MAX_ATTACHMENTS = 10;
const MAX_IMAGES = 8;
// Per-document ceiling before sending; the server applies an overall budget on top.
const MAX_DOC_CHARS = 60000;

const FORMAT_LABEL = {
  image: "Image",
  pdf: "PDF",
  "pdf-scanned": "Scanned PDF",
  docx: "Word",
  pptx: "PowerPoint",
  xlsx: "Excel",
  text: "Text",
};

const BADGE = {
  pdf: "PDF",
  "pdf-scanned": "PDF",
  docx: "DOC",
  pptx: "PPT",
  xlsx: "XLS",
};

let items = [];
let seq = 0;
let els = {};
let onChangeCb = () => {};

function uid() {
  return `att_${Date.now().toString(36)}_${(++seq).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function extensionBadge(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].slice(0, 4).toUpperCase() : "FILE";
}

// "Text" undersells a .py file; name the language when the extension says what it is.
const TEXT_KIND = {
  py: "Python", js: "JavaScript", mjs: "JavaScript", ts: "TypeScript", tsx: "TypeScript", jsx: "JavaScript",
  html: "HTML", htm: "HTML", css: "CSS", java: "Java", c: "C", cpp: "C++", h: "C header", cs: "C#",
  go: "Go", rs: "Rust", rb: "Ruby", php: "PHP", swift: "Swift", kt: "Kotlin", sql: "SQL", sh: "Shell",
  md: "Markdown", markdown: "Markdown", csv: "CSV", tsv: "TSV", json: "JSON", xml: "XML", yaml: "YAML",
  yml: "YAML", tex: "LaTeX", ipynb: "Notebook",
};

function textLabel(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return (m && TEXT_KIND[m[1].toLowerCase()]) || "Text";
}

function describe(item) {
  if (item.state === "reading") return "Reading…";
  if (item.state === "error") return item.error;
  const r = item.result;
  if (r.kind === "image") {
    return `Image · ${formatBytes(item.size)}${r.downscaled ? " · resized to send" : ""}`;
  }
  if (r.format === "pdf-scanned") {
    return `Scanned PDF · first ${r.images.length} page${r.images.length === 1 ? "" : "s"} sent as images`;
  }
  const parts = [r.format === "text" ? textLabel(item.name) : FORMAT_LABEL[r.format] || "Document"];
  if (r.pages) parts.push(`${r.pages} ${r.format === "pptx" ? "slide" : r.format === "xlsx" ? "sheet" : "page"}${r.pages === 1 ? "" : "s"}`);
  const chars = r.text.length;
  parts.push(chars > MAX_DOC_CHARS ? `first ${Math.round(MAX_DOC_CHARS / 1000)}k characters` : `${chars.toLocaleString()} characters`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  const host = els.list;
  host.innerHTML = "";
  host.hidden = items.length === 0;

  items.forEach((item) => {
    const chip = el("div", "attach-chip");
    chip.dataset.state = item.state;
    chip.dataset.id = item.id;
    chip.setAttribute("role", "listitem");

    const thumb = el("div", "attach-chip-thumb");
    const thumbUrl = item.result && (item.result.thumb || (item.result.kind === "image" ? item.result.thumb : null));
    if (item.state === "reading") {
      thumb.appendChild(el("span", "attach-spinner"));
    } else if (thumbUrl) {
      const img = document.createElement("img");
      img.src = thumbUrl;
      img.alt = "";
      thumb.appendChild(img);
    } else {
      const fmt = item.result ? item.result.format : classifyFile({ name: item.name, type: item.type });
      const badge = el("span", "attach-badge", BADGE[fmt] || extensionBadge(item.name));
      badge.dataset.format = fmt || "file";
      thumb.appendChild(badge);
    }
    chip.appendChild(thumb);

    const meta = el("div", "attach-chip-meta");
    meta.appendChild(el("span", "attach-chip-name", item.name));
    meta.appendChild(el("span", "attach-chip-sub", describe(item)));
    chip.appendChild(meta);

    const remove = el("button", "attach-chip-remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.innerHTML =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    remove.addEventListener("click", () => removeAttachment(item.id));
    chip.appendChild(remove);

    host.appendChild(chip);
  });

  onChangeCb();
}

// ---------------------------------------------------------------------------
// Adding files
// ---------------------------------------------------------------------------

export async function addFiles(fileList) {
  const files = [...fileList].filter(Boolean);
  if (files.length === 0) return;

  const room = MAX_ATTACHMENTS - items.length;
  if (room <= 0) {
    showToast(`You can attach up to ${MAX_ATTACHMENTS} files to one message.`, "error", 3200);
    return;
  }
  if (files.length > room) {
    showToast(`Only the first ${room} file${room === 1 ? "" : "s"} were added — ${MAX_ATTACHMENTS} is the most per message.`, "error", 3600);
  }

  const imageCount = () => items.filter((i) => i.state !== "error" && i.result && (i.result.kind === "image" || i.result.format === "pdf-scanned")).length;

  const added = files.slice(0, room).map((file) => {
    const item = { id: uid(), name: file.name || "pasted-image.png", size: file.size, type: file.type, state: "reading", result: null, error: "" };
    items.push(item);
    return { item, file };
  });
  render();

  await Promise.all(
    added.map(async ({ item, file }) => {
      const format = classifyFile(file);
      if (["unsupported", "heic", "legacy-office"].includes(format)) {
        item.state = "error";
        item.error = unsupportedReason(format, file);
        render();
        return;
      }
      if ((format === "image" || format === "pdf") && imageCount() >= MAX_IMAGES) {
        // A text PDF doesn't count as images, so only images are refused outright here.
        if (format === "image") {
          item.state = "error";
          item.error = `Up to ${MAX_IMAGES} images per message.`;
          render();
          return;
        }
      }
      try {
        item.result = await readAnyFile(file);
        item.state = "ready";
      } catch (err) {
        item.state = "error";
        item.error = err && err.message ? err.message : "Couldn't read that file.";
      }
      render();
    })
  );

  const failed = added.filter(({ item }) => item.state === "error");
  if (failed.length === 1) showToast(`${failed[0].item.name}: ${failed[0].item.error}`, "error", 4200);
  else if (failed.length > 1) showToast(`${failed.length} files couldn't be read — see the attachments for why.`, "error", 3600);
}

export function removeAttachment(id) {
  items = items.filter((i) => i.id !== id);
  render();
  if (els.input) els.input.focus();
}

export function clearAttachments() {
  items = [];
  render();
}

export function hasAttachments() {
  return items.some((i) => i.state === "ready");
}

export function isReading() {
  return items.some((i) => i.state === "reading");
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

// Stores the heavy content in IndexedDB (fileStore.js) and returns the light references a
// saved message carries. Items that failed to read are simply not sent — their chip already
// told the student why.
export async function commitAttachments(conversationId) {
  const ready = items.filter((i) => i.state === "ready");
  const refs = [];
  for (const item of ready) {
    const r = item.result;
    const ref = {
      id: item.id,
      kind: r.kind,
      format: r.kind === "image" ? "image" : r.format,
      name: item.name,
      size: item.size,
      thumb: r.thumb || null,
    };
    if (r.kind === "image") {
      ref.mimeType = r.mimeType;
      await putFile({ id: item.id, conversationId, kind: "image", name: item.name, mimeType: r.mimeType, data: r.data });
    } else {
      const truncated = r.text.length > MAX_DOC_CHARS;
      ref.pages = r.pages || null;
      ref.truncated = truncated;
      await putFile({
        id: item.id,
        conversationId,
        kind: "document",
        name: item.name,
        format: r.format,
        text: truncated ? r.text.slice(0, MAX_DOC_CHARS) : r.text,
        truncated,
        images: r.images ? r.images.map((img) => ({ mimeType: img.mimeType, data: img.data })) : undefined,
      });
    }
    refs.push(ref);
  }
  return refs;
}

// A sensible question when someone attaches files and presses send without typing.
export function defaultPromptFor(refs) {
  const images = refs.filter((r) => r.kind === "image").length;
  const docs = refs.length - images;
  if (docs === 0) return images === 1 ? "What can you tell me about this image?" : "What can you tell me about these images?";
  if (images === 0) return docs === 1 ? "Please read this file and summarise the key points for me." : "Please read these files and summarise the key points for me.";
  return "Please look at what I've attached and explain it to me.";
}

// ---------------------------------------------------------------------------
// Screen capture
// ---------------------------------------------------------------------------

export function canCaptureScreen() {
  return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function");
}

// Asks the browser to share a screen, window or tab, grabs one frame, and stops sharing
// straight away — the capture indicator is only up for as long as it takes to take the shot.
export async function captureScreenshot() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (err) {
    // Cancelling the picker is a normal choice, not an error worth a toast.
    if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) return;
    showToast("This browser couldn't capture the screen. Take a screenshot and paste it here with Ctrl+V instead.", "error", 4500);
    return;
  }
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Wait until a real frame is available; the first one can be blank.
    await new Promise((resolve) => {
      if (video.readyState >= 2 && video.videoWidth) resolve();
      else video.onloadeddata = () => resolve();
    });
    await new Promise((r) => setTimeout(r, 120));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("empty capture");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    await addFiles([new File([blob], `screenshot-${stamp}.png`, { type: "image/png" })]);
  } catch {
    showToast("The screenshot came back empty. Try again, or paste one with Ctrl+V.", "error", 4200);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function closeMenu() {
  if (!els.menu) return;
  els.menu.hidden = true;
  els.menuBtn.setAttribute("aria-expanded", "false");
}

function openMenu() {
  els.menu.hidden = false;
  els.menuBtn.setAttribute("aria-expanded", "true");
  const first = els.menu.querySelector("button:not([hidden])");
  if (first) first.focus();
}

export function openFilePicker() {
  if (els.fileInput) els.fileInput.click();
}

export function initChatAttachments({ onChange } = {}) {
  els = {
    list: document.getElementById("composerAttachments"),
    menuBtn: document.getElementById("attachMenuBtn"),
    menu: document.getElementById("attachMenu"),
    fileInput: document.getElementById("attachFilesInput"),
    photoInput: document.getElementById("attachPhotosInput"),
    cameraInput: document.getElementById("attachCameraInput"),
    screenshotBtn: document.getElementById("attachScreenshotBtn"),
    cameraBtn: document.getElementById("attachCameraBtn"),
    input: document.getElementById("messageInput"),
    dropZone: document.getElementById("view-chat"),
    dropOverlay: document.getElementById("chatDropOverlay"),
  };
  if (!els.list || !els.menuBtn) return;
  if (onChange) onChangeCb = onChange;

  // Only offer what this device can actually do.
  if (els.screenshotBtn) els.screenshotBtn.hidden = !canCaptureScreen();
  if (els.cameraBtn) els.cameraBtn.hidden = !window.matchMedia("(pointer: coarse)").matches;

  els.menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.menu.hidden) openMenu();
    else closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (!els.menu.hidden && !els.menu.contains(e.target) && e.target !== els.menuBtn) closeMenu();
  });
  els.menu.addEventListener("keydown", (e) => {
    const buttons = [...els.menu.querySelectorAll("button:not([hidden])")];
    const idx = buttons.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      els.menuBtn.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(idx + 1) % buttons.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length].focus();
    }
  });

  els.menu.querySelectorAll("[data-attach]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.attach;
      closeMenu();
      if (kind === "files") els.fileInput.click();
      else if (kind === "photos") els.photoInput.click();
      else if (kind === "camera") els.cameraInput.click();
      else if (kind === "screenshot") captureScreenshot();
    });
  });

  [els.fileInput, els.photoInput, els.cameraInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("change", () => {
      const files = [...input.files];
      input.value = "";
      addFiles(files);
      if (els.input) els.input.focus();
    });
  });

  // Paste: files on the clipboard (a copied screenshot is one) become attachments; plain text
  // pastes are left completely alone.
  if (els.input) {
    els.input.addEventListener("paste", (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      const files = [...(cd.files || [])];
      if (files.length === 0) {
        [...(cd.items || [])].forEach((it) => {
          if (it.kind === "file") {
            const f = it.getAsFile();
            if (f) files.push(f);
          }
        });
      }
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    });
  }

  // Drag and drop anywhere over the chat. A depth counter, because dragenter/dragleave fire
  // for every child element the pointer crosses.
  if (els.dropZone && els.dropOverlay) {
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    els.dropZone.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      els.dropOverlay.hidden = false;
    });
    els.dropZone.addEventListener("dragover", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    els.dropZone.addEventListener("dragleave", (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) els.dropOverlay.hidden = true;
    });
    els.dropZone.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      els.dropOverlay.hidden = true;
      addFiles(e.dataTransfer.files);
      if (els.input) els.input.focus();
    });
  }

  render();
}
