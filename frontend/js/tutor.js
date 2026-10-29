import { apiFetch, apiPatch, apiPost, errorDetail, getMe, logout } from "./supabaseClient.js";
import { el, lengthText, setBusy, showMessage, wireHeader } from "./ui.js";

wireHeader();
document.getElementById("logout").addEventListener("click", logout);

const $ = (id) => document.getElementById(id);
const message = $("auth-message");
const form = $("session-form");
message.addEventListener("click", () => (message.hidden = true));

const DEFAULT_LOCATIONS = ["Library", "Study Centre", "Online (Teams)"];
const STATUS_LABELS = { due: "needs wrap-up", approved: "scheduled", completed: "done", cancelled: "cancelled" };

let me = null;
let sessions = [];
let view = "wrapup";
const picked = new Map();   // student id -> student, for the form being filled in

// ── Dates ───────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (t) => (t ? t.slice(0, 5) : "");
const dayOf = (s) => new Date(`${s.planned_date}T00:00:00`);

function addMinutes(time, mins) {
  if (!time || !mins) return "";
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** wrapup = scheduled but its start time has passed; upcoming = still ahead; past = done or cancelled */
function bucket(s) {
  if (s.status === "completed" || s.status === "cancelled") return "past";
  const start = new Date(`${s.planned_date}T${s.start_time || "00:00:00"}`);
  return start <= new Date() ? "wrapup" : "upcoming";
}

// ── Sessions ────────────────────────────────────────────────────────────────
async function loadSessions() {
  const res = await apiFetch("/api/tutor/sessions");
  $("loading").hidden = true;
  if (!res.ok) return showMessage(message, `Couldn't load your sessions (${await errorDetail(res)}).`, "error");
  sessions = await res.json();
  $("home").hidden = false;
  render();
}

function render() {
  const groups = { wrapup: [], upcoming: [], past: [] };
  for (const s of sessions) groups[bucket(s)].push(s);

  const done = sessions.filter(s => s.status === "completed");
  const hours = done.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
  const taught = new Set(done.flatMap(s => s.students.map(st => st.id)));

  $("t-upcoming").textContent = groups.upcoming.length;
  $("t-wrapup").textContent = groups.wrapup.length;
  $("t-wrapup-tile").classList.toggle("accent", groups.wrapup.length > 0);
  $("t-hours").textContent = Number.isInteger(hours) ? hours : hours.toFixed(1);
  $("t-students").textContent = taught.size;

  const first = (me.full_name || "").split(" ")[0].toLowerCase();
  const n = groups.wrapup.length;
  $("greeting").textContent = `hi${first ? ", " + first : ""}. ` +
    (n ? `you have ${n} session${n > 1 ? "s" : ""} to wrap up.` : "log a session or check what's coming up.");

  for (const tab of document.querySelectorAll("[data-view]")) {
    const count = groups[tab.dataset.view].length;
    tab.textContent = `${tab.dataset.label} (${count})`;
  }

  // oldest unfinished first, newest finished first
  const list = groups[view].sort((a, b) =>
    (view === "past" ? -1 : 1) * `${a.planned_date}${a.start_time}`.localeCompare(`${b.planned_date}${b.start_time}`));
  const empty = { wrapup: "All caught up. Nothing to wrap up.", upcoming: "Nothing scheduled. Log a session above.", past: "No finished sessions yet." };
  $("session-list").replaceChildren(...(list.length
    ? list.map(sessionCard)
    : [el("p", { className: "auth-muted", text: empty[view] })]));

  fillDatalist("subject-options", sessions.map(s => s.subject));
  fillDatalist("location-options", [...DEFAULT_LOCATIONS, ...sessions.map(s => s.location)]);
}

function fillDatalist(id, values) {
  const unique = [...new Set(values.filter(Boolean))].sort();
  $(id).replaceChildren(...unique.map(value => el("option", { value })));
}

function replaceSession(updated) {
  sessions = sessions.map(s => (s.id === updated.id ? updated : s));
  render();
}

function sessionCard(s) {
  const where = bucket(s);
  const statusKey = where === "wrapup" ? "due" : s.status;
  const day = dayOf(s);

  const meta = [
    day.toLocaleDateString(undefined, { weekday: "short" }),
    hhmm(s.start_time),
    s.status === "completed" ? `${lengthText(s.duration_minutes)} (${hhmm(s.time_in)}–${hhmm(s.time_out)})` : lengthText(s.planned_minutes),
    s.location,
    s.status === "completed" && s.recorded ? "recorded" : "",
  ].filter(Boolean).join(" · ");

  const side = el("div", { className: "session-side" }, [
    el("span", { className: `badge ${statusKey}`, text: STATUS_LABELS[statusKey] }),
  ]);
  const card = el("article", { className: `session-card ${s.status}` }, [
    el("div", { className: "date-block" }, [
      el("span", { className: "date-day", text: String(day.getDate()) }),
      el("span", { className: "date-month", text: day.toLocaleDateString(undefined, { month: "short" }) }),
    ]),
    el("div", { className: "session-main" }, [
      el("p", { className: "session-subject", text: s.subject }),
      el("p", { className: "session-students", text: s.students.map(studentLabel).join(", ") || "No students" }),
      el("p", { className: "auth-muted", text: meta }),
      ...(s.tutor_comments ? [el("p", { className: "session-comment", text: s.tutor_comments })] : []),
    ]),
    side,
  ]);

  if (where === "wrapup") {
    const wrapBtn = el("button", { className: "auth-button small", text: "Wrap up", type: "button" });
    const wrap = wrapForm(s);
    wrapBtn.addEventListener("click", () => {
      wrap.hidden = !wrap.hidden;
      if (!wrap.hidden) wrap.querySelector("input").focus();
    });
    side.append(wrapBtn);
    card.append(wrap);
  }
  if (where !== "past") side.append(cancelButton(s));
  return card;
}

function cancelButton(s) {
  const btn = el("button", { className: "auth-button small secondary", text: "Cancel", type: "button" });
  btn.addEventListener("click", async () => {
    if (!confirm(`Cancel ${s.subject} on ${dayOf(s).toLocaleDateString()}?`)) return;
    setBusy(btn, true, "…");
    const res = await apiPatch(`/api/tutor/sessions/${s.id}`, { status: "cancelled" });
    setBusy(btn, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");
    showMessage(message, `Cancelled ${s.subject} on ${dayOf(s).toLocaleDateString()}.`, "success");
    replaceSession(await res.json());
  });
  return btn;
}

/** times, recording and comments, then it's marked as done */
function wrapForm(s) {
  const timeIn = el("input", { className: "auth-input", type: "time", required: "", value: hhmm(s.start_time) });
  const timeOut = el("input", { className: "auth-input", type: "time", required: "",
                                value: addMinutes(hhmm(s.start_time), s.planned_minutes) });
  const recorded = el("input", { type: "checkbox" });
  const comments = el("textarea", { className: "auth-input", maxlength: "2000", rows: "3",
                                    placeholder: "What did you cover? Anything the next tutor should know?" });
  const save = el("button", { className: "auth-button small", text: "Mark as done", type: "submit" });

  const wrap = el("form", { className: "wrap-form" }, [
    el("div", { className: "form-row" }, [
      el("label", { className: "auth-label grow", text: "Time in" }, [timeIn]),
      el("label", { className: "auth-label grow", text: "Time out" }, [timeOut]),
    ]),
    el("label", { className: "checkbox-label" }, [recorded, "The session was recorded"]),
    el("label", { className: "auth-label", text: "Comments" }, [comments]),
    el("div", { className: "form-actions" }, [save]),
  ]);
  wrap.hidden = true;

  wrap.addEventListener("submit", async (e) => {
    e.preventDefault();
    setBusy(save, true, "Saving…");
    const res = await apiPatch(`/api/tutor/sessions/${s.id}`, {
      status: "completed",
      time_in: timeIn.value,
      time_out: timeOut.value,
      recorded: recorded.checked,
      tutor_comments: comments.value.trim() || null,
    });
    setBusy(save, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");
    showMessage(message, `Nice, ${s.subject} on ${dayOf(s).toLocaleDateString()} is wrapped up.`, "success");
    replaceSession(await res.json());
  });
  return wrap;
}

function wireTabs() {
  const tabs = document.querySelectorAll("[data-view]");
  for (const tab of tabs) {
    tab.dataset.label = tab.textContent;
    tab.addEventListener("click", () => {
      view = tab.dataset.view;
      for (const t of tabs) {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      }
      render();
    });
  }
}

function selectTab(name) {
  document.querySelector(`[data-view="${name}"]`).click();
}

// ── New session form ────────────────────────────────────────────────────────
function wireForm() {
  const toggle = $("toggle-form");
  const setOpen = (open) => {
    form.hidden = !open;
    toggle.textContent = open ? "Close" : "+ New session";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("secondary", open);
  };
  toggle.addEventListener("click", () => {
    setOpen(form.hidden);
    if (!form.hidden) $("student-search").focus();
  });
  // on wide screens the form has its own column, so it starts (and stays) open
  const wide = window.matchMedia("(min-width: 1101px)");
  setOpen(wide.matches);
  form.planned_date.value = isoDate(new Date());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!picked.size) {
      showMessage(message, "Add at least one student to the session.", "error");
      return $("student-search").focus();
    }
    const button = form.querySelector("button[type=submit]");
    setBusy(button, true, "Saving…");
    const res = await apiPost("/api/tutor/sessions", {
      subject: form.subject.value.trim(),
      location: form.location.value.trim() || null,
      planned_date: form.planned_date.value,
      start_time: form.start_time.value || null,
      planned_minutes: Number(form.planned_minutes.value),
      student_ids: [...picked.keys()],
    });
    setBusy(button, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");

    const created = await res.json();
    sessions.unshift(created);
    showMessage(message, `Saved ${created.subject} on ${dayOf(created).toLocaleDateString()}.`, "success");

    form.reset();
    form.planned_date.value = isoDate(new Date());
    picked.clear();
    renderChips();
    closeNewStudent();
    setOpen(wide.matches);
    selectTab(bucket(created));
  });
}

// ── Student picker ──────────────────────────────────────────────────────────
const search = () => $("student-search");
const list = () => $("suggestions");
let searchSeq = 0;
let searchTimer;

const studentLabel = (st) => (st.grade ? `${st.full_name} (G${st.grade})` : st.full_name);

function wirePicker() {
  search().addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(search().value.trim()), 200);
  });
  search().addEventListener("focus", () => runSearch(search().value.trim()));
  search().addEventListener("keydown", (e) => {
    if (e.key === "Escape") list().hidden = true;
    if (e.key === "Enter") {
      e.preventDefault();   // dont submit the whole form from the search box
      list().querySelector("button")?.click();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list().querySelector("button")?.focus();
    }
  });
  list().addEventListener("keydown", (e) => {
    const items = [...list().querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[i + 1]?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); (items[i - 1] ?? search()).focus(); }
    if (e.key === "Escape")    { list().hidden = true; search().focus(); }
  });
  document.addEventListener("click", (e) => {
    if (!$("picker").contains(e.target)) list().hidden = true;
  });

  $("ns-save").addEventListener("click", () => saveNewStudent(false));
  $("ns-cancel").addEventListener("click", closeNewStudent);
  // editing the name/grade makes old "did you mean" answers stale, so check again from scratch
  for (const id of ["ns-name", "ns-grade"]) $(id).addEventListener("input", clearMatches);
}

function clearMatches() {
  $("ns-matches").replaceChildren();
  $("ns-save").hidden = false;
}

async function runSearch(q) {
  const seq = ++searchSeq;
  const res = await apiFetch(`/api/tutor/students?q=${encodeURIComponent(q)}`);
  if (seq !== searchSeq) return;   // a newer search already started
  if (!res.ok) return showMessage(message, await errorDetail(res), "error");

  const found = (await res.json()).filter(st => !picked.has(st.id));
  const items = [];
  if (!q && found.length) items.push(el("li", { className: "suggestion-head", text: "your recent students" }));
  for (const st of found) items.push(option(studentLabel(st), () => pick(st)));
  if (q) items.push(option(`+ Add “${q}” as a new student`, () => openNewStudent(q), "suggestion-add"));
  if (q && !found.length) items.unshift(el("li", { className: "suggestion-head", text: "no one on the list matches" }));

  list().replaceChildren(...items);
  list().hidden = !items.length;
}

function option(text, onPick, className = "") {
  const btn = el("button", { className: `suggestion ${className}`, type: "button", role: "option", text });
  btn.addEventListener("click", onPick);
  return el("li", {}, [btn]);
}

function pick(st) {
  picked.set(st.id, st);
  renderChips();
  search().value = "";
  list().hidden = true;
  search().focus();
}

function renderChips() {
  $("chips").replaceChildren(...[...picked.values()].map(st => {
    const remove = el("button", { type: "button", text: "×", "aria-label": `Remove ${st.full_name}` });
    remove.addEventListener("click", () => {
      picked.delete(st.id);
      renderChips();
    });
    return el("span", { className: "chip" }, [studentLabel(st), remove]);
  }));
}

function openNewStudent(name) {
  list().hidden = true;
  search().value = "";
  $("new-student").hidden = false;
  $("ns-name").value = name;
  $("ns-grade").value = "";
  clearMatches();
  $("ns-grade").focus();
}

function closeNewStudent() {
  $("new-student").hidden = true;
  clearMatches();
}

/** first try without confirm_new: if similar names exist the backend sends them back instead of saving */
async function saveNewStudent(confirmNew) {
  const name = $("ns-name").value.trim();
  if (!name) return $("ns-name").focus();

  const button = $("ns-save");
  setBusy(button, true, "Checking…");
  const res = await apiPost("/api/tutor/students", {
    full_name: name,
    grade: $("ns-grade").value ? Number($("ns-grade").value) : null,
    confirm_new: confirmNew,
  });
  setBusy(button, false);
  if (!res.ok) return showMessage(message, await errorDetail(res), "error");

  const { student, matches } = await res.json();
  if (student) {
    closeNewStudent();
    pick(student);
    return showMessage(message, `Added ${studentLabel(student)} to the student list.`, "success");
  }

  const choices = matches.map(st => {
    const btn = el("button", { className: "auth-button small secondary", type: "button", text: studentLabel(st) });
    btn.addEventListener("click", () => { closeNewStudent(); pick(st); });
    return btn;
  });
  const anyway = el("button", { className: "auth-button small", type: "button", text: "No, add a new student" });
  anyway.addEventListener("click", () => saveNewStudent(true));

  $("ns-save").hidden = true;   // the two answers below replace it
  $("ns-matches").replaceChildren(
    el("p", { className: "auth-hint", text: "These are already on the list. Is it one of them?" }),
    el("div", { className: "match-list" }, [...choices, anyway]),
  );
}

/** nudge tutors who haven't made a public profile yet */
async function checkProfile() {
  const res = await apiFetch("/api/tutor/profile");
  if (res.ok) $("profile-notice").hidden = (await res.json()).exists;
}

// ── Start: tutors and admins only (at the bottom so every helper above exists) ──
const { profile, status } = await getMe();
if (status !== 200) {
  window.location.replace("login.html");
} else if (!(profile.approved && ["tutor", "admin"].includes(profile.role))) {
  window.location.replace("account.html");
} else {
  me = profile;
  $("panel-link").hidden = me.role !== "admin";
  wireForm();
  wirePicker();
  wireTabs();
  loadSessions();
  checkProfile();
}
