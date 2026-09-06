import {
  getSpaces,
  getSpace,
  createSpace,
  renameSpace,
  setSpaceArchived,
  deleteSpace,
  toggleFavoriteSpace,
  getCurrentSpaceId,
  setCurrentSpaceId,
  onSpaceChange,
  ALL_SPACES_ID,
} from "./spacesStore.js";
import { promptForText, confirmDanger } from "./modal.js";
import { showToast } from "./toast.js";

const btn = document.getElementById("spaceSwitcherBtn");
const icon = document.getElementById("spaceSwitcherIcon");
const label = document.getElementById("spaceSwitcherLabel");
const popover = document.getElementById("spaceSwitcherPopover");
const list = document.getElementById("spaceSwitcherList");
const createBtn = document.getElementById("spaceCreateBtn");

const listeners = [];
export function onSpaceUIRefresh(cb) {
  listeners.push(cb);
}

function refreshLabel() {
  const currentId = getCurrentSpaceId();
  if (currentId === ALL_SPACES_ID) {
    icon.textContent = "🌐";
    label.textContent = "All Spaces";
    return;
  }
  const space = getSpace(currentId);
  if (!space) {
    setCurrentSpaceId(ALL_SPACES_ID);
    return;
  }
  icon.textContent = space.icon;
  label.textContent = space.name;
}

function renderList() {
  if (!list) return;
  list.innerHTML = "";
  const currentId = getCurrentSpaceId();

  const allRow = buildRow({ id: ALL_SPACES_ID, icon: "🌐", name: "All Spaces" }, currentId === ALL_SPACES_ID, false);
  list.appendChild(allRow);

  getSpaces()
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
    .forEach((s) => list.appendChild(buildRow(s, currentId === s.id, true)));
}

function buildRow(space, active, manageable) {
  const row = document.createElement("div");
  row.className = "space-row" + (active ? " active" : "");
  row.innerHTML = `
    <button type="button" class="space-row-main">
      <span>${space.icon}</span><span></span>
    </button>`;
  row.querySelector(".space-row-main span:last-child").textContent = space.favorite ? `⭐ ${space.name}` : space.name;
  row.querySelector(".space-row-main").addEventListener("click", () => {
    setCurrentSpaceId(space.id);
    closePopover();
    refreshLabel();
    listeners.forEach((cb) => cb(space.id));
    showToast(space.id === ALL_SPACES_ID ? "Showing all spaces." : `Switched to "${space.name}".`, "success", 1600);
  });

  if (manageable) {
    const actions = document.createElement("div");
    actions.className = "space-row-actions";
    actions.innerHTML = `
      <button type="button" title="Favorite" data-act="fav">★</button>
      <button type="button" title="Rename" data-act="rename">✎</button>
      <button type="button" title="Delete" data-act="delete">×</button>`;
    actions.querySelector('[data-act="fav"]').addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoriteSpace(space.id);
      renderList();
    });
    actions.querySelector('[data-act="rename"]').addEventListener("click", (e) => {
      e.stopPropagation();
      promptForText("Rename Space", space.name, (newName) => {
        if (newName) renameSpace(space.id, newName);
        renderList();
        refreshLabel();
      });
    });
    actions.querySelector('[data-act="delete"]').addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDanger("Delete this Space?", `Content in "${space.name}" isn't deleted — it just won't belong to a Space anymore.`, "Delete", () => {
        deleteSpace(space.id);
        renderList();
        refreshLabel();
        listeners.forEach((cb) => cb(getCurrentSpaceId()));
      });
    });
    row.appendChild(actions);
  }
  return row;
}

function openPopover() {
  popover.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  renderList();
}

function closePopover() {
  popover.hidden = true;
  btn.setAttribute("aria-expanded", "false");
}

if (btn) {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popover.hidden) openPopover();
    else closePopover();
  });
}

document.addEventListener("click", (e) => {
  if (popover && !popover.hidden && !popover.contains(e.target) && e.target !== btn) closePopover();
});

if (createBtn) {
  createBtn.addEventListener("click", () => {
    promptForText("Create a Space", "", (name) => {
      if (!name) return;
      const space = createSpace({ name });
      setCurrentSpaceId(space.id);
      renderList();
      refreshLabel();
      listeners.forEach((cb) => cb(space.id));
      showToast(`Space "${space.name}" created.`, "success");
    }, "e.g. Math, Exam Prep, Personal");
  });
}

// Public helper for other modules (e.g. command palette) that want to switch spaces by id.
export function switchToSpace(id) {
  setCurrentSpaceId(id);
  refreshLabel();
  listeners.forEach((cb) => cb(id));
}

export function initSpacesUI() {
  refreshLabel();
}
