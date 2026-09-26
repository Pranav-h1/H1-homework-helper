// The index down the side of Settings.
//
// Settings is long — account, appearance, chat, AI, notifications, accessibility, privacy,
// data, the danger zone — and was one narrow column that left half the window empty. The index
// uses that space: it lists the sections that are actually showing (the creator's controls only
// appear for the creator), jumps to one on click, and follows along as the page scrolls.
const LINKS = new Map();
let observer = null;
let nav = null;

function slug(text) {
  return (
    "settings-" +
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

function sections() {
  const view = document.getElementById("view-settings");
  if (!view) return [];
  return [...view.querySelectorAll(":scope > .settings-group")].filter((s) => !s.hidden);
}

function setCurrent(id) {
  LINKS.forEach((link, key) => {
    const on = key === id;
    link.classList.toggle("is-current", on);
    if (on) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

function build() {
  if (!nav) return;
  const list = nav.querySelector("ul");
  list.innerHTML = "";
  LINKS.clear();
  if (observer) observer.disconnect();

  const scroller = document.getElementById("mainView");
  observer = new IntersectionObserver(
    (entries) => {
      // The section nearest the top of the panel is the one being read.
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setCurrent(visible[0].target.id);
    },
    { root: scroller, rootMargin: "-10% 0px -65% 0px", threshold: 0 }
  );

  sections().forEach((section, index) => {
    const heading = section.querySelector("h2");
    if (!heading) return;
    const label = (heading.firstChild && heading.firstChild.nodeType === 3 ? heading.firstChild.textContent : heading.textContent).trim();
    if (!section.id) section.id = slug(label);
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = label;
    if (section.classList.contains("danger-zone")) link.classList.add("is-danger");
    if (section.classList.contains("creator-section")) link.classList.add("is-creator");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const reduce = document.documentElement.classList.contains("force-reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      section.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      setCurrent(section.id);
      // Move focus to the section heading so keyboard users land where they asked to go.
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    });
    item.appendChild(link);
    list.appendChild(item);
    LINKS.set(section.id, link);
    observer.observe(section);
    if (index === 0) setCurrent(section.id);
  });
}

export function initSettingsNav() {
  const view = document.getElementById("view-settings");
  if (!view || document.getElementById("settingsNav")) return;
  nav = document.createElement("nav");
  nav.id = "settingsNav";
  nav.className = "settings-nav";
  nav.setAttribute("aria-label", "Settings sections");
  nav.appendChild(document.createElement("ul"));
  const header = view.querySelector(".view-header");
  if (header) header.insertAdjacentElement("afterend", nav);
  else view.prepend(nav);

  build();
  // Sections come and go (the creator's controls, the guest-import row's section), so the index
  // is rebuilt whenever Settings is opened.
  document.addEventListener("h1:view-changed", (event) => {
    if (event.detail === "settings") requestAnimationFrame(build);
  });
}
