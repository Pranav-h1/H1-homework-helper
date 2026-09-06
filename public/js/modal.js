const overlay = document.getElementById("modalOverlay");
const panel = document.getElementById("modalPanel");
const titleEl = document.getElementById("modalTitle");
const messageEl = document.getElementById("modalMessage");
const inputEl = document.getElementById("modalInput");
const listEl = document.getElementById("modalList");
const cancelBtn = document.getElementById("modalCancelBtn");
const confirmBtn = document.getElementById("modalConfirmBtn");
const closeBtn = document.getElementById("modalCloseBtn");

let onConfirm = null;
let lastFocused = null;

function close() {
  overlay.hidden = true;
  onConfirm = null;
  listEl.hidden = true;
  listEl.innerHTML = "";
  confirmBtn.hidden = false;
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
}

function confirmNow() {
  const value = inputEl.hidden ? true : inputEl.value.trim();
  if (!inputEl.hidden && !value) {
    inputEl.focus();
    return;
  }
  const cb = onConfirm;
  close();
  if (cb) cb(value);
}

cancelBtn.addEventListener("click", close);
closeBtn.addEventListener("click", close);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) close();
});
confirmBtn.addEventListener("click", confirmNow);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmNow();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !overlay.hidden) close();
});

// options: { title, message, inputValue, inputPlaceholder, confirmLabel, danger, onConfirm }
// onConfirm receives `true` for a plain confirm dialog, or the trimmed string for a prompt dialog.
export function openModal(options) {
  lastFocused = document.activeElement;
  listEl.hidden = true;
  listEl.innerHTML = "";
  confirmBtn.hidden = false;
  titleEl.textContent = options.title || "";
  messageEl.textContent = options.message || "";
  messageEl.hidden = !options.message;

  const hasInput = typeof options.inputValue === "string" || options.inputPlaceholder;
  inputEl.hidden = !hasInput;
  if (hasInput) {
    inputEl.value = options.inputValue || "";
    inputEl.placeholder = options.inputPlaceholder || "";
  }

  confirmBtn.textContent = options.confirmLabel || "Confirm";
  panel.classList.toggle("modal-danger", Boolean(options.danger));
  onConfirm = options.onConfirm || null;

  overlay.hidden = false;
  if (hasInput) {
    inputEl.focus();
    inputEl.select();
  } else {
    confirmBtn.focus();
  }
}

export function confirmDanger(title, message, confirmLabel, onConfirmCb) {
  openModal({ title, message, confirmLabel: confirmLabel || "Delete", danger: true, onConfirm: onConfirmCb });
}

export function promptForText(title, currentValue, onConfirmCb, placeholder) {
  openModal({ title, inputValue: currentValue, inputPlaceholder: placeholder, confirmLabel: "Save", onConfirm: onConfirmCb });
}

// A lightweight sheet-style picker (real UI, not window.prompt) — items: [{ id, icon, label, sublabel }].
// Picking an item closes the sheet and calls onPick(item.id) immediately.
export function openListPicker(title, items, onPick, emptyMessage) {
  lastFocused = document.activeElement;
  titleEl.textContent = title || "";
  messageEl.hidden = true;
  inputEl.hidden = true;
  confirmBtn.hidden = true;
  onConfirm = null;

  listEl.innerHTML = "";
  listEl.hidden = false;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="context-empty">${emptyMessage || "Nothing available yet."}</p>`;
  } else {
    items.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "modal-list-item";
      row.innerHTML = `<span class="modal-list-icon"></span><span class="modal-list-text"><strong></strong><span></span></span>`;
      row.querySelector(".modal-list-icon").textContent = item.icon || "•";
      row.querySelector("strong").textContent = item.label;
      row.querySelector(".modal-list-text span").textContent = item.sublabel || "";
      row.addEventListener("click", () => {
        close();
        onPick(item.id);
      });
      listEl.appendChild(row);
    });
  }

  overlay.hidden = false;
  cancelBtn.focus();
}
