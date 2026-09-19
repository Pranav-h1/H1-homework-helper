// A dialog with more than one field.
//
// H1's existing modal handles "confirm this" and "type one thing". Creating an account's Space
// (name + password + confirmation) and changing a password need several fields at once, with a
// per-field error, a working state while the server answers, and no chance of the person's
// password ending up anywhere it shouldn't. It builds its own markup so nothing else in the app
// has to know about it.
const fieldSeq = { n: 0 };

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

// options:
//   title, message, confirmLabel, cancelLabel, danger
//   fields: [{ name, label, type, value, placeholder, autocomplete, maxLength, hint, reveal }]
//   validate(values) -> { field, message } | null        (checked before submitting)
//   onSubmit(values) -> anything; throw { field?, message } | Error to show an error and stay open
// Resolves with the values when it completes, or null if it was cancelled.
export function openFormDialog(options) {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;
    const overlay = makeEl("div", "modal-overlay form-dialog-overlay");
    const panel = makeEl("div", "modal form-dialog");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    const titleId = `formDialogTitle${++fieldSeq.n}`;
    panel.setAttribute("aria-labelledby", titleId);

    const header = makeEl("div", "modal-header");
    const title = makeEl("h2", null, options.title || "");
    title.id = titleId;
    const closeBtn = makeEl("button", "icon-btn");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    header.append(title, closeBtn);

    const form = makeEl("form", "form-dialog-body");
    form.noValidate = true;
    if (options.message) {
      const msg = makeEl("p", "form-dialog-message", options.message);
      form.appendChild(msg);
    }

    const inputs = new Map();
    const errors = new Map();

    (options.fields || []).forEach((field, index) => {
      const wrap = makeEl("label", "auth-field");
      const labelText = makeEl("span", "auth-label", field.label);
      const input = document.createElement("input");
      input.className = "auth-input";
      input.type = field.type || "text";
      input.value = field.value || "";
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.autocomplete) input.autocomplete = field.autocomplete;
      if (field.maxLength) input.maxLength = field.maxLength;
      if (field.type === "password") {
        input.autocapitalize = "none";
        input.spellcheck = false;
      }
      const errorEl = makeEl("span", "auth-field-error");
      errorEl.hidden = true;

      wrap.append(labelText);
      if (field.type === "password") {
        const holder = makeEl("span", "auth-password");
        const eye = makeEl("button", "auth-eye");
        eye.type = "button";
        eye.setAttribute("aria-label", "Show password");
        eye.setAttribute("aria-pressed", "false");
        eye.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        eye.addEventListener("click", () => {
          const showing = input.type === "text";
          input.type = showing ? "password" : "text";
          eye.setAttribute("aria-pressed", String(!showing));
          eye.setAttribute("aria-label", showing ? "Show password" : "Hide password");
          eye.classList.toggle("is-on", !showing);
          input.focus();
        });
        holder.append(input, eye);
        wrap.append(holder);
      } else {
        wrap.append(input);
      }
      if (field.hint) wrap.append(makeEl("span", "auth-hint", field.hint));
      wrap.append(errorEl);
      form.appendChild(wrap);
      inputs.set(field.name, input);
      errors.set(field.name, errorEl);
      if (index === 0) setTimeout(() => input.focus(), 30);
      input.addEventListener("input", () => {
        errorEl.hidden = true;
        errorEl.textContent = "";
        input.setAttribute("aria-invalid", "false");
        generalError.hidden = true;
      });
    });

    const generalError = makeEl("p", "auth-error");
    generalError.setAttribute("role", "alert");
    generalError.hidden = true;
    form.appendChild(generalError);

    const footer = makeEl("div", "modal-footer");
    const cancelBtn = makeEl("button", "btn btn-ghost", options.cancelLabel || "Cancel");
    cancelBtn.type = "button";
    const confirmBtn = makeEl("button", `btn ${options.danger ? "btn-danger" : "btn-primary"}`, options.confirmLabel || "Save");
    confirmBtn.type = "submit";
    footer.append(cancelBtn, confirmBtn);
    form.appendChild(footer);

    panel.append(header, form);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function values() {
      const out = {};
      inputs.forEach((input, name) => {
        out[name] = input.value;
      });
      return out;
    }

    function showError(message, field) {
      const target = field && errors.get(field);
      if (target) {
        target.textContent = message;
        target.hidden = false;
        const input = inputs.get(field);
        input.setAttribute("aria-invalid", "true");
        input.focus();
        input.select();
        return;
      }
      generalError.textContent = message;
      generalError.hidden = false;
    }

    let busy = false;
    function setBusy(on) {
      busy = on;
      confirmBtn.disabled = on;
      cancelBtn.disabled = on;
      confirmBtn.classList.toggle("is-busy", on);
      if (on) confirmBtn.textContent = options.busyLabel || "Working…";
      else confirmBtn.textContent = options.confirmLabel || "Save";
    }

    function finish(result) {
      // Password fields are emptied before the dialog is thrown away, so nothing is left in a
      // detached DOM node waiting to be garbage collected.
      inputs.forEach((input) => {
        input.value = "";
      });
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
      resolve(result);
    }

    function onKey(event) {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        finish(null);
      }
      if (event.key !== "Tab") return;
      // Keep focus inside the dialog.
      const focusable = panel.querySelectorAll("button:not(:disabled), input:not(:disabled)");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      generalError.hidden = true;
      const current = values();
      if (options.validate) {
        const problem = options.validate(current);
        if (problem) return showError(problem.message, problem.field);
      }
      if (!options.onSubmit) return finish(current);
      setBusy(true);
      try {
        const result = await options.onSubmit(current);
        finish(result === undefined ? current : result);
      } catch (err) {
        setBusy(false);
        showError((err && err.message) || "Something went wrong. Please try again.", err && err.field);
        // A rejected password is cleared rather than left on screen.
        (options.fields || []).forEach((f) => {
          if (f.type === "password" && (!err.field || err.field === f.name)) inputs.get(f.name).value = "";
        });
      }
    });

    cancelBtn.addEventListener("click", () => finish(null));
    closeBtn.addEventListener("click", () => finish(null));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay && !busy) finish(null);
    });
    document.addEventListener("keydown", onKey, true);
  });
}
