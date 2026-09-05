const container = document.getElementById("toastContainer");

export function showToast(message, type, duration) {
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add("toast-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // fallback in case animationend never fires
  }, duration || 3200);
}
