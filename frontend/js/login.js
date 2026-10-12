import { supabase, getMe } from "./supabaseClient.js";
import { showMessage, setBusy, wireHeader } from "./ui.js";

wireHeader();

const message = document.getElementById("auth-message");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const tabs = document.querySelectorAll(".auth-tab");

// ── Tabs ────────────────────────────────────────────────────────────────────
function openPanel(panelId) {
  for (const tab of tabs) {
    const active = tab.dataset.panel === panelId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  loginForm.hidden = panelId !== "login-form";
  signupForm.hidden = panelId !== "signup-form";
  showMessage(message, "");
}

tabs.forEach(tab => tab.addEventListener("click", () => openPanel(tab.dataset.panel)));
document.querySelectorAll("[data-switch]").forEach(link =>
  link.addEventListener("click", (e) => { e.preventDefault(); openPanel(link.dataset.switch); })
);
if (window.location.hash === "#signup") openPanel("signup-form");   // login.html#signup opens sign-up

// ── Already logged in? Go straight to the account page ─────────────────────
const { status, error } = await getMe();
if (status === 200) {
  window.location.replace("account.html");
} else if (error && error !== "Not logged in") {
  // logged in to Supabase but the backend rejected it (e.g. "No profile found")
  await supabase.auth.signOut();
  showMessage(message, `Couldn't load your account (${error}). Please log in again.`, "error");
}

// ── Log in ──────────────────────────────────────────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  setBusy(button, true, "Logging in…");

  const { error } = await supabase.auth.signInWithPassword({
    email: loginForm.email.value.trim(),
    password: loginForm.password.value,
  });

  setBusy(button, false);
  if (error) return showMessage(message, error.message, "error");
  window.location.href = "account.html";
});

// ── Sign up ─────────────────────────────────────────────────────────────────
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = signupForm;

  if (f.password.value !== f.confirm.value) {
    return showMessage(message, "Passwords don't match.", "error");
  }
  const fullName = f.full_name.value.trim();
  if (!fullName) return showMessage(message, "Please enter your name.", "error");

  const button = f.querySelector("button[type=submit]");
  setBusy(button, true, "Creating account…");

  const { data, error } = await supabase.auth.signUp({
    email: f.email.value.trim(),
    password: f.password.value,
    options: {
      // read by the database trigger that creates the profiles row
      data: { full_name: fullName, requested_role: f.role.value },
      // where the confirmation email link lands (only used if "Confirm email" is on)
      emailRedirectTo: `${window.location.origin}/html/account.html`,
    },
  });

  setBusy(button, false);
  if (error) return showMessage(message, error.message, "error");

  if (data.session) {
    // "Confirm email" is OFF → logged in immediately
    window.location.href = "account.html";
  } else {
    // "Confirm email" is ON → they must click the link first
    f.reset();
    openPanel("login-form");
    showMessage(message, "Almost there! Check your email for a confirmation link, then log in.", "success");
  }
});
