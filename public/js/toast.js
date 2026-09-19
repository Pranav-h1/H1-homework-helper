// Small confirmations and warnings that appear briefly and get out of the way.
//
// They sit where they can't cover anything that matters: bottom-right on a desktop, clear of the
// dock and the composer; top of the screen on a phone, clear of the keyboard and the bottom bar.
// Hovering one keeps it on screen, so a message someone is reading doesn't vanish mid-sentence.
const container = document.getElementById("toastContainer");
const MAX_VISIBLE = 3;

const ICONS = {
  success: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  error: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12.5"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  warning: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
};

function dismiss(el) {
  if (!el.isConnected || el.classList.contains("toast-out")) return;
  el.classList.add("toast-out");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 400); // in case animationend never fires (reduced motion)
}

export function showToast(message, type, duration) {
  if (!container) return;
  const kind = type === "error" || type === "success" || type === "warning" ? type : "info";
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  // The container is a polite live region, so ordinary toasts are read out when there's a pause;
  // an error interrupts.
  if (kind === "error") el.setAttribute("role", "alert");

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = ICONS[kind];

  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;

  el.append(icon, text);
  container.appendChild(el);

  // Keep the stack short: the oldest makes way.
  const live = [...container.querySelectorAll(".toast:not(.toast-out)")];
  if (live.length > MAX_VISIBLE) live.slice(0, live.length - MAX_VISIBLE).forEach(dismiss);

  let remaining = duration || (kind === "error" ? 5200 : 3200);
  let started = Date.now();
  let timer = setTimeout(() => dismiss(el), remaining);
  el.addEventListener("mouseenter", () => {
    clearTimeout(timer);
    remaining -= Date.now() - started;
  });
  el.addEventListener("mouseleave", () => {
    started = Date.now();
    timer = setTimeout(() => dismiss(el), Math.max(1200, remaining));
  });
  el.addEventListener("click", () => dismiss(el));
}
