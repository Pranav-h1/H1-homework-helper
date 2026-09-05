const overlay = document.getElementById("modalOverlay");
const panel = document.getElementById("modalPanel");
const titleEl = document.getElementById("modalTitle");
const messageEl = document.getElementById("modalMessage");
const inputEl = document.getElementById("modalInput");
const cancelBtn = document.getElementById("modalCancelBtn");
const confirmBtn = document.getElementById("modalConfirmBtn");
const closeBtn = document.getElementById("modalCloseBtn");

let onConfirm = null;
let lastFocused = null;

function close() {
  overlay.hidden = true;
  onConfirm = null;
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

export function promptForText(title, currentValue, onConfirmCb) {
  openModal({ title, inputValue: currentValue, confirmLabel: "Save", onConfirm: onConfirmCb });
}
