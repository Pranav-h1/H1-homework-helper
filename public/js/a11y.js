// Small accessibility fixes applied across the app at start-up.

// H1's on/off switches are <span role="switch"> inside a <label class="toggle-row"> whose first
// span says what the switch does. A span doesn't pick up its label's text, so without this a
// screen reader announces an unnamed switch. The name is the row's own visible wording (without
// any small print under it, which becomes the description instead).
export function nameUnlabelledSwitches(root = document) {
  root.querySelectorAll('[role="switch"]').forEach((sw) => {
    if (sw.getAttribute("aria-label") || sw.getAttribute("aria-labelledby")) return;
    const row = sw.closest(".toggle-row");
    const textSpan = row && [...row.children].find((c) => c !== sw && c.tagName === "SPAN");
    if (!textSpan) return;
    const own = [...textSpan.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const name = own || textSpan.textContent.replace(/\s+/g, " ").trim();
    if (!name) return;
    sw.setAttribute("aria-label", name);
    const hint = textSpan.querySelector("small, .settings-hint");
    if (hint) {
      if (!hint.id) hint.id = `${sw.id || "switch"}-hint`;
      sw.setAttribute("aria-describedby", hint.id);
    }
  });
}
