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
  setSpaceLock,
  onSpaceChange,
  ALL_SPACES_ID,
} from "./spacesStore.js";
import { promptForText, confirmDanger } from "./modal.js";
import { showToast } from "./toast.js";
import { openFormDialog } from "./formDialog.js";
import { makeLock, verifyLock, isUnlocked, markUnlocked, hasLock } from "./spaceLock.js";
import { isAccountMode } from "./session.js";
import { verifyPassword } from "./accountApi.js";

const SPACE_NAME_MIN = 3;
const SPACE_PASSWORD_MIN = 4;

// A Space with a password has to be opened before it can be switched to, renamed or deleted.
// Returns true when the Space is open.
async function ensureUnlocked(space) {
  if (!hasLock(space) || isUnlocked(space.id)) return true;
  const result = await openFormDialog({
    title: `Open "${space.name}"`,
    message: "This Space is password protected.",
    fields: [{ name: "password", label: "Space password", type: "password", autocomplete: "off", maxLength: 128 }],
    confirmLabel: "Open Space",
    busyLabel: "Checking…",
    cancelLabel: "Forgot it?",
    validate: (v) => (v.password ? null : { field: "password", message: "Enter this Space's password." }),
    onSubmit: async (v) => {
      const ok = await verifyLock(space.lock, v.password);
      if (!ok) throw { field: "password", message: "That isn't this Space's password." };
      markUnlocked(space.id);
      return true;
    },
  });
  if (result) return true;
  // "Forgot it?" — the way back in depends on whether there's an account to check against.
  return resetSpacePassword(space);
}

async function resetSpacePassword(space) {
  if (isAccountMode()) {
    const done = await openFormDialog({
      title: `Reset the password for "${space.name}"`,
      message: "Confirm it's you with your H1 account password, then choose a new password for this Space.",
      fields: [
        { name: "account", label: "Your H1 account password", type: "password", autocomplete: "current-password", maxLength: 128 },
        { name: "password", label: "New Space password", type: "password", autocomplete: "new-password", maxLength: 128 },
        { name: "confirm", label: "Confirm new Space password", type: "password", autocomplete: "new-password", maxLength: 128 },
      ],
      confirmLabel: "Reset password",
      busyLabel: "Checking…",
      validate: (v) => {
        if (!v.account) return { field: "account", message: "Enter your H1 account password." };
        if ([...(v.password || "")].length < SPACE_PASSWORD_MIN) return { field: "password", message: `Space passwords need at least ${SPACE_PASSWORD_MIN} characters.` };
        if (v.confirm !== v.password) return { field: "confirm", message: "The passwords don't match." };
        return null;
      },
      onSubmit: async (v) => {
        await verifyPassword(v.account);
        setSpaceLock(space.id, await makeLock(v.password));
        markUnlocked(space.id);
        showToast(`New password set for "${space.name}".`, "success");
        return true;
      },
    });
    return Boolean(done);
  }

  // No account signed in, so there's nothing to check "is it really you" against. Rather than
  // pretend otherwise, H1 says what the lock actually is and offers to remove it.
  return new Promise((resolve) => {
    confirmDanger(
      "Remove this Space's password?",
      "Without an account there's no way for H1 to confirm who you are. A Space password only asks before opening the Space on this device — it doesn't encrypt anything — so it can be removed here. Sign in to an account if you want a password that can only be reset by you.",
      "Remove password",
      () => {
        setSpaceLock(space.id, null);
        markUnlocked(space.id);
        showToast(`"${space.name}" is no longer password protected.`);
        resolve(true);
      }
    );
  });
}

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
  row.querySelector(".space-row-main").addEventListener("click", async () => {
    closePopover();
    if (manageable && !(await ensureUnlocked(space))) return;
    setCurrentSpaceId(space.id);
    refreshLabel();
    renderList();
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
    actions.querySelector('[data-act="rename"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await ensureUnlocked(space))) return;
      promptForText("Rename Space", space.name, (newName) => {
        if (newName) renameSpace(space.id, newName);
        renderList();
        refreshLabel();
      });
    });
    actions.querySelector('[data-act="delete"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await ensureUnlocked(space))) return;
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
  createBtn.addEventListener("click", async () => {
    closePopover();
    const created = await openFormDialog({
      title: "Create a Space",
      message:
        "A Space keeps a set of work together — Math, Exam Prep, a club. Its password is asked for before the Space opens on a device. It's separate from your H1 account password, and it isn't encryption: it asks at the door, it doesn't scramble what's inside.",
      fields: [
        { name: "name", label: "Space name", type: "text", placeholder: "e.g. Math, Exam Prep, Personal", maxLength: 40 },
        { name: "password", label: "Space password", type: "password", autocomplete: "new-password", maxLength: 128 },
        { name: "confirm", label: "Confirm password", type: "password", autocomplete: "new-password", maxLength: 128 },
      ],
      confirmLabel: "Create Space",
      busyLabel: "Creating…",
      validate: (v) => {
        const name = (v.name || "").trim();
        if ([...name].length < SPACE_NAME_MIN) return { field: "name", message: `Space names need at least ${SPACE_NAME_MIN} characters.` };
        if ([...(v.password || "")].length < SPACE_PASSWORD_MIN) return { field: "password", message: `Space passwords need at least ${SPACE_PASSWORD_MIN} characters.` };
        if (!v.confirm) return { field: "confirm", message: "Type the password again to confirm it." };
        if (v.confirm !== v.password) return { field: "confirm", message: "The passwords don't match." };
        return null;
      },
      onSubmit: async (v) => {
        const lock = await makeLock(v.password);
        const space = createSpace({ name: v.name.trim(), lock });
        markUnlocked(space.id);
        return space;
      },
    });
    if (!created || !created.id) return;
    setCurrentSpaceId(created.id);
    renderList();
    refreshLabel();
    listeners.forEach((cb) => cb(created.id));
    showToast(`Space "${created.name}" created.`, "success");
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
