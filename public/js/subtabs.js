// Generic sub-tab controller. A view section marked [data-subtab-scope] contains one
// [data-subtabs] button group (each button has [data-subtab="name"]) and one or more
// sibling [data-subtab-panel="name"] panels. Used by Homework (Tasks / Step-by-Step) and
// Tools (Utilities / Writing & Language).

export function selectSubtab(scope, name) {
  scope.querySelectorAll("[data-subtab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.subtab === name);
  });
  scope.querySelectorAll("[data-subtab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.subtabPanel !== name;
  });
}

export function selectSubtabInView(view, name) {
  const scope = document.querySelector(`[data-view-panel="${view}"][data-subtab-scope]`);
  if (scope) selectSubtab(scope, name);
}

export function initSubtabs() {
  document.querySelectorAll("[data-subtab-scope]").forEach((scope) => {
    scope.querySelectorAll("[data-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => selectSubtab(scope, btn.dataset.subtab));
    });
  });
}
