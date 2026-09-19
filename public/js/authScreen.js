// The sign-in screen.
//
// It shows before anything else loads, so it deliberately depends on almost nothing: the session
// module and the DOM that is already in the page. Everything it reports comes from the server —
// the checks here exist to answer instantly while typing, never to decide anything.
import * as session from "./session.js";
import { PASSWORD_MIN, USERNAME_MIN, USERNAME_MAX, checkUsername, checkPasswords } from "./authRules.js";

const el = {};
let mode = "signin";
let busy = false;
let resolveDone = null;

function $(id) {
  return document.getElementById(id);
}

function cache() {
  el.screen = $("authScreen");
  el.tabSignIn = $("authTabSignIn");
  el.tabSignUp = $("authTabSignUp");
  el.form = $("authForm");
  el.username = $("authUsername");
  el.password = $("authPassword");
  el.confirm = $("authConfirm");
  el.confirmField = $("authConfirmField");
  el.submit = $("authSubmit");
  el.submitLabel = $("authSubmitLabel");
  el.error = $("authError");
  el.notice = $("authNotice");
  el.hint = $("authHint");
  el.guest = $("authGuestBtn");
  el.usernameError = $("authUsernameError");
  el.card = document.querySelector(".auth-card");
  el.tabs = document.querySelector(".auth-tabs");
  el.alt = document.querySelector(".auth-alt");
  el.creatorWelcome = $("authCreatorWelcome");
  el.creatorName = $("authCreatorName");
  el.guestNote = $("authGuestNote");
  el.passwordError = $("authPasswordError");
  el.confirmError = $("authConfirmError");
}

function setFieldError(node, message) {
  if (!node) return;
  node.textContent = message || "";
  node.hidden = !message;
  const input = node.previousElementSibling;
  const field = input && input.tagName === "SPAN" ? input.querySelector("input") : input;
  if (field && field.tagName === "INPUT") field.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearErrors() {
  el.error.hidden = true;
  el.error.textContent = "";
  setFieldError(el.usernameError, "");
  setFieldError(el.passwordError, "");
  setFieldError(el.confirmError, "");
}

function showError(message, field) {
  const target = field === "username" ? el.usernameError : field === "password" || field === "newPassword" ? el.passwordError : field === "confirmPassword" ? el.confirmError : null;
  if (target) {
    setFieldError(target, message);
    const input = field === "username" ? el.username : field === "confirmPassword" ? el.confirm : el.password;
    input.focus();
    input.select();
    return;
  }
  el.error.textContent = message;
  el.error.hidden = false;
}

function setNotice(message) {
  el.notice.textContent = message || "";
  el.notice.hidden = !message;
}

function setMode(next) {
  mode = next;
  const signup = next === "signup";
  el.tabSignIn.classList.toggle("is-active", !signup);
  el.tabSignUp.classList.toggle("is-active", signup);
  el.tabSignIn.setAttribute("aria-selected", String(!signup));
  el.tabSignUp.setAttribute("aria-selected", String(signup));
  el.confirmField.hidden = !signup;
  el.confirm.required = signup;
  el.password.setAttribute("autocomplete", signup ? "new-password" : "current-password");
  el.submitLabel.textContent = signup ? "Create account" : "Sign in";
  el.hint.textContent = signup
    ? `Pick a username (${USERNAME_MIN}–${USERNAME_MAX} characters) and a password of at least ${PASSWORD_MIN} characters.`
    : "Your work is saved to your account, so it's there on any device you sign in on.";
  clearErrors();
  el.username.focus();
}

function setBusy(on, label) {
  busy = on;
  el.submit.disabled = on;
  el.submit.classList.toggle("is-busy", on);
  el.tabSignIn.disabled = on;
  el.tabSignUp.disabled = on;
  el.guest.disabled = on;
  el.submitLabel.textContent = on ? label : mode === "signup" ? "Create account" : "Sign in";
}

function clearPasswords() {
  el.password.value = "";
  el.confirm.value = "";
}

async function submit(event) {
  if (event) event.preventDefault();
  if (busy) return;
  clearErrors();
  const username = el.username.value;
  const password = el.password.value;
  const confirm = el.confirm.value;

  // Instant feedback for the obvious cases, so the person isn't waiting on a round trip to be
  // told their passwords don't match. The server checks all of this again regardless.
  if (mode === "signup") {
    const uErr = checkUsername(username);
    if (uErr) return showError(uErr, "username");
    const pErr = checkPasswords(password, confirm);
    if (pErr) return showError(pErr.message, pErr.field);
  } else if (!username.trim() || !password) {
    return showError("Enter your username and password.");
  }

  setBusy(true, mode === "signup" ? "Creating your account…" : "Signing in…");
  try {
    if (mode === "signup") await session.signUp(username, password, confirm);
    else await session.signIn(username, password);
    const user = session.currentUser();
    if (user && user.accountType === "lab") {
      await welcomeCreator(user.username);
    } else {
      await confirmSuccess(mode === "signup" ? "Account created" : "Signed in");
    }
    finish("account");
  } catch (err) {
    setBusy(false);
    // Whatever went wrong, the password box is emptied rather than left sitting on screen.
    clearPasswords();
    if (err && err.code === "COOKIES_BLOCKED") {
      setNotice("Cookies are required to keep you signed in. Please allow cookies for H1 and try again.");
      el.submitLabel.textContent = "Retry sign in";
      el.password.focus();
      return;
    }
    showError((err && err.message) || "Something went wrong. Please try again.", err && err.field);
  }
}

// A beat of confirmation before the app appears, so a successful sign-in feels like one rather
// than the screen simply vanishing.
function confirmSuccess(label) {
  return new Promise((resolve) => {
    el.submit.classList.remove("is-busy");
    el.submit.classList.add("is-success");
    el.submitLabel.textContent = label;
    const reduce = document.documentElement.classList.contains("force-reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(resolve, reduce ? 0 : 420);
  });
}

// H1's own account gets a moment of acknowledgement on the way in, rather than landing in the
// same dashboard as everyone else with no sign that anything is different.
function welcomeCreator(username) {
  return new Promise((resolve) => {
    el.card.classList.add("is-creator");
    el.form.hidden = true;
    el.tabs.hidden = true;
    el.alt.hidden = true;
    setNotice("");
    el.creatorWelcome.hidden = false;
    el.creatorName.textContent = username;
    setTimeout(resolve, 1400);
  });
}

function finish(result) {
  const app = document.getElementById("app");
  if (app) {
    app.removeAttribute("aria-hidden");
    app.inert = false;
  }
  el.screen.hidden = true;
  document.documentElement.classList.remove("auth-open");
  const done = resolveDone;
  resolveDone = null;
  if (done) done({ mode: result });
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  el.tabSignIn.addEventListener("click", () => setMode("signin"));
  el.tabSignUp.addEventListener("click", () => setMode("signup"));
  el.form.addEventListener("submit", submit);
  el.guest.addEventListener("click", () => {
    session.continueAsGuest();
    finish("guest");
  });

  [["authPasswordToggle", "authPassword"], ["authConfirmToggle", "authConfirm"]].forEach(([btnId, inputId]) => {
    const btn = $(btnId);
    const input = $(inputId);
    btn.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-pressed", String(!showing));
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      btn.classList.toggle("is-on", !showing);
      input.focus();
    });
  });

  // Caps Lock catches people out constantly on a password field that shows nothing back.
  const capsWatch = (event) => {
    const on = typeof event.getModifierState === "function" && event.getModifierState("CapsLock");
    el.passwordError.hidden = !on && el.passwordError.dataset.caps !== "1" ? el.passwordError.hidden : !on;
    if (on) {
      el.passwordError.dataset.caps = "1";
      el.passwordError.textContent = "Caps Lock is on.";
      el.passwordError.hidden = false;
    } else if (el.passwordError.dataset.caps === "1") {
      el.passwordError.dataset.caps = "";
      el.passwordError.textContent = "";
      el.passwordError.hidden = true;
    }
  };
  el.password.addEventListener("keydown", capsWatch);
  el.password.addEventListener("keyup", capsWatch);
  el.confirm.addEventListener("input", () => {
    if (mode === "signup" && el.confirm.value && el.password.value && el.confirm.value !== el.password.value) setFieldError(el.confirmError, "The passwords don't match.");
    else setFieldError(el.confirmError, "");
  });
}

// Shows the screen and resolves once the person is signed in, has created an account, or has
// chosen to carry on without one.
export function showAuthScreen({ expired = false, startMode = "signin", accountsAvailable = true } = {}) {
  cache();
  wire();
  document.documentElement.classList.add("auth-open");
  const app = document.getElementById("app");
  if (app) {
    app.setAttribute("aria-hidden", "true");
    app.inert = true;
  }
  el.screen.hidden = false;
  el.creatorWelcome.hidden = true;

  if (!accountsAvailable) {
    // No database on this server, so there is nothing to sign in to. Say that, rather than
    // showing a form that would fail, and leave the one route that does work.
    el.form.hidden = true;
    el.tabs.hidden = true;
    setNotice("Accounts aren't set up on this H1 server yet, so there's nothing to sign in to. You can use H1 on this device — everything stays here.");
    el.guestNote.textContent = "Your work is saved in this browser.";
    el.guest.textContent = "Use H1 on this device";
    el.guest.focus();
    return new Promise((resolve) => {
      resolveDone = resolve;
    });
  }

  el.form.hidden = false;
  el.tabs.hidden = false;
  setNotice(expired ? "Your session has expired. Please sign in again." : "");
  if (navigator.cookieEnabled === false) {
    setNotice("Cookies are required to keep you signed in. Please allow cookies for H1 and try again.");
  }
  setMode(startMode);
  return new Promise((resolve) => {
    resolveDone = resolve;
  });
}
