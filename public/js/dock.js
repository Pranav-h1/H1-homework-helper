// A restrained macOS-style dock magnification: icons nearest the pointer scale up slightly,
// falling off smoothly with distance. Pure transform, no layout thrash, and it turns itself
// off for reduced-motion users.
const dock = document.getElementById("dock");

const MAX_SCALE = 1.28;
const FALLOFF_PX = 90;

function reset() {
  if (!dock) return;
  dock.querySelectorAll(".dock-item").forEach((item) => {
    item.style.setProperty("--dock-scale", "1");
  });
}

export function initDock() {
  if (!dock) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(hover: none)").matches) return; // touch devices don't get a pointer to magnetize toward

  dock.addEventListener("mousemove", (e) => {
    const items = dock.querySelectorAll(".dock-item");
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(e.clientX - center);
      const scale = 1 + Math.max(0, 1 - dist / FALLOFF_PX) * (MAX_SCALE - 1);
      item.style.setProperty("--dock-scale", scale.toFixed(3));
    });
  });

  dock.addEventListener("mouseleave", reset);
}
