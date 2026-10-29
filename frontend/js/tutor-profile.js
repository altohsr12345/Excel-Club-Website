import { apiFetch, apiPost, errorDetail, getMe, logout } from "./supabaseClient.js";
import { el, setBusy, showMessage, wireHeader } from "./ui.js";
import { tutorCard } from "./tutorCard.js";

wireHeader();
document.getElementById("logout").addEventListener("click", logout);

const $ = (id) => document.getElementById(id);
const message = $("auth-message");
message.addEventListener("click", () => (message.hidden = true));
const form = $("profile-form");
const search = $("subject-search");
const list = $("suggestions");

const MAX_SUBJECTS = 30;

let subjects = [];        // the whole list, from /api/subjects
let byId = new Map();
let picked = [];          // subject ids, in the order the tutor added them
let saved = null;         // last saved profile, for the status line

const label = (s) => `${s.level} ${s.name}`;

// ── Preview + status ────────────────────────────────────────────────────────
function current() {
  return {
    display_name: form.display_name.value.trim(),
    grade: form.grade.value ? Number(form.grade.value) : null,
    bio: form.bio.value.trim(),
    listed: form.listed.checked,
    subject_ids: picked,
  };
}

function renderPreview() {
  const p = current();
  $("preview").replaceChildren(tutorCard({ ...p, subjects: picked.map(id => byId.get(id)) }));
  $("bio-count").textContent = `${form.bio.value.length} / 400`;

  const dirty = saved && JSON.stringify(p) !== JSON.stringify(pick(saved));
  let status;
  if (!saved?.exists) status = "Not saved yet, so visitors can't see you.";
  else if (saved.hidden_by_admin) status = "Hidden by an admin.";
  else if (!saved.listed) status = "Hidden: you've turned off “show me on the tutors page”.";
  else status = "Visible on the tutors page.";
  $("status").textContent = dirty ? `${status} You have unsaved changes.` : status;
}

/** the fields current() returns, from a saved profile, so the two can be compared */
function pick(p) {
  return { display_name: p.display_name, grade: p.grade, bio: p.bio, listed: p.listed, subject_ids: p.subject_ids };
}

function fill(p) {
  saved = p;
  form.display_name.value = p.display_name || "";
  form.grade.value = p.grade ?? "";
  form.bio.value = p.bio || "";
  form.listed.checked = p.listed;
  picked = p.subject_ids.filter(id => byId.has(id));
  $("hidden-notice").hidden = !p.hidden_by_admin;
  renderChips();
  renderPreview();
}

// ── Subject picker ──────────────────────────────────────────────────────────
function renderChips() {
  $("chips").replaceChildren(...picked.map(id => {
    const s = byId.get(id);
    const remove = el("button", { type: "button", text: "×", "aria-label": `Remove ${label(s)}` });
    remove.addEventListener("click", () => {
      picked = picked.filter(x => x !== id);
      renderChips();
      renderPreview();
    });
    return el("span", { className: "chip" }, [label(s), remove]);
  }));
}

/** every word typed has to appear in "level name", so "as phy" finds AS Physics */
function showSuggestions() {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = subjects.filter(s =>
    !picked.includes(s.id) && words.every(w => label(s).toLowerCase().includes(w)));

  const items = [];
  let level = null;
  for (const s of found) {
    if (s.level !== level) {
      level = s.level;
      items.push(el("li", { className: "suggestion-head", text: level }));
    }
    const btn = el("button", { className: "suggestion", type: "button", role: "option", text: s.name });
    btn.addEventListener("click", () => add(s.id));
    items.push(el("li", {}, [btn]));
  }
  if (!items.length) {
    items.push(el("li", { className: "suggestion-head",
                          text: words.length ? "no subject matches that" : "you've picked every subject" }));
  }
  list.replaceChildren(...items);
  list.hidden = false;
}

function add(id) {
  if (picked.length >= MAX_SUBJECTS) {
    return showMessage(message, `That's the maximum of ${MAX_SUBJECTS} subjects.`, "error");
  }
  picked.push(id);
  search.value = "";
  renderChips();
  renderPreview();
  showSuggestions();
  search.focus();
}

function wirePicker() {
  search.addEventListener("input", showSuggestions);
  search.addEventListener("focus", showSuggestions);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") list.hidden = true;
    if (e.key === "Enter") {
      e.preventDefault();   // dont submit the form from the search box
      list.querySelector("button")?.click();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list.querySelector("button")?.focus();
    }
  });
  list.addEventListener("keydown", (e) => {
    const items = [...list.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[i + 1]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); (items[i - 1] ?? search).focus(); }
    if (e.key === "Escape")    { list.hidden = true; search.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (!$("picker").contains(e.target)) list.hidden = true;
  });
}

// ── Save ────────────────────────────────────────────────────────────────────
function wireForm() {
  form.addEventListener("input", renderPreview);
  form.addEventListener("change", renderPreview);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button[type=submit]");
    setBusy(button, true, "Saving…");
    const res = await apiPost("/api/tutor/profile", current(), "PUT");
    setBusy(button, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");
    fill(await res.json());
    showMessage(message, saved.listed && !saved.hidden_by_admin
      ? "Saved. Your profile is on the tutors page."
      : "Saved. Your profile isn't visible to visitors right now.", "success");
  });

  window.addEventListener("beforeunload", (e) => {
    if (saved && JSON.stringify(current()) !== JSON.stringify(pick(saved))) e.preventDefault();
  });
}

// ── Start: tutors and admins only ───────────────────────────────────────────
const { profile, status } = await getMe();
if (status !== 200) {
  window.location.replace("login.html");
} else if (!(profile.approved && ["tutor", "admin"].includes(profile.role))) {
  window.location.replace("account.html");
} else {
  const [subjectsRes, profileRes] = await Promise.all([apiFetch("/api/subjects"), apiFetch("/api/tutor/profile")]);
  $("loading").hidden = true;
  if (!subjectsRes.ok || !profileRes.ok) {
    const bad = subjectsRes.ok ? profileRes : subjectsRes;
    showMessage(message, `Couldn't load your profile (${await errorDetail(bad)}).`, "error");
  } else {
    subjects = await subjectsRes.json();
    byId = new Map(subjects.map(s => [s.id, s]));
    $("editor").hidden = false;
    wirePicker();
    wireForm();
    fill(await profileRes.json());
  }
}
