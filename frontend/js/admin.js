import { apiFetch, apiPost, errorDetail, getMe, logout } from "./supabaseClient.js";
import { el, setBusy, showMessage, table, wireHeader, ROLE_LABELS } from "./ui.js";

wireHeader();
document.getElementById("logout").addEventListener("click", logout);

const $ = (id) => document.getElementById(id);
const message = $("auth-message");

let me = null;
let members = [];

// ── Admins only (the backend enforces this too — this just avoids a useless page) ──
const { profile, status } = await getMe();
if (status !== 200) {
  window.location.replace("login.html");
} else if (!(profile.approved && profile.role === "admin")) {
  window.location.replace("account.html");
} else {
  me = profile;
  const firstName = (me.full_name || "").split(" ")[0].toLowerCase();
  $("greeting").textContent = `hi${firstName ? ", " + firstName : ""}. here's what's happening at excel.`;
  $("loading").hidden = true;
  $("panel").hidden = false;

  $("member-search").addEventListener("input", renderMembers);
  $("member-role").addEventListener("change", renderMembers);

  // independent sections, one failing shouldnt blank the rest
  loadOverview();
  loadPending();
  loadMembers();
  loadSubjects();
  loadRecent();
}

async function getJson(path) {
  const res = await apiFetch(path);
  if (!res.ok) {
    showMessage(message, `${path}: ${await errorDetail(res)}`, "error");
    return null;
  }
  return res.json();
}

const muted = (text) => el("p", { className: "auth-muted", text });

// ── Number tiles ────────────────────────────────────────────────────────────
async function loadOverview() {
  const o = await getJson("/api/stats/overview");
  if (!o) return;
  $("t-sessions").textContent = o.total_sessions;
  $("t-hours").textContent = Math.round(o.total_hours);
  $("t-tutors").textContent = o.distinct_tutors;
  $("t-students").textContent = o.distinct_students;
}

// ── Pending sign-ups ────────────────────────────────────────────────────────
async function loadPending() {
  const pending = await getJson("/api/admin/pending");
  if (!pending) return;
  $("t-pending").textContent = pending.length;
  $("pending-list").replaceChildren(...(pending.length
    ? pending.map(personCard)
    : [muted("No one is waiting for approval. 🎉")]));
}

function roleSelect(current, label) {
  const select = el("select", { className: "auth-input compact", "aria-label": label },
    Object.entries(ROLE_LABELS).map(([value, text]) => {
      const opt = el("option", { value, text });
      if (value === current) opt.selected = true;
      return opt;
    })
  );
  return select;
}

function personCard(p) {
  const select = roleSelect(p.requested_role, `Role for ${p.full_name}`);
  const approveBtn = el("button", { className: "auth-button small", text: "Approve", type: "button" });
  const rejectBtn  = el("button", { className: "auth-button small danger", text: "Reject", type: "button" });

  const card = el("div", { className: "pending-card" }, [
    el("div", { className: "pending-info" }, [
      el("p", { className: "pending-name", text: p.full_name || "(no name)" }),
      el("p", { className: "auth-muted", text: p.email }),
      el("p", { className: "auth-muted small",
                text: `Applied as ${(ROLE_LABELS[p.requested_role] ?? p.requested_role).toLowerCase()} · ${new Date(p.created_at).toLocaleDateString()}` }),
    ]),
    el("div", { className: "pending-actions" }, [select, approveBtn, rejectBtn]),
  ]);

  approveBtn.addEventListener("click", async () => {
    setBusy(approveBtn, true, "…");
    const res = await apiPost("/api/admin/approve", { user_id: p.id, role: select.value });
    setBusy(approveBtn, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");
    showMessage(message, `Approved ${p.full_name} as ${ROLE_LABELS[select.value].toLowerCase()}.`, "success");
    loadPending();
    loadMembers();
  });

  rejectBtn.addEventListener("click", async () => {
    if (!confirm(`Delete the sign-up for ${p.full_name} (${p.email})? This can't be undone.`)) return;
    setBusy(rejectBtn, true, "…");
    const res = await apiPost("/api/admin/reject", { user_id: p.id });
    setBusy(rejectBtn, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");
    showMessage(message, `Rejected ${p.full_name}.`, "success");
    loadPending();
  });

  return card;
}

// ── Members ─────────────────────────────────────────────────────────────────
async function loadMembers() {
  const list = await getJson("/api/admin/users");
  if (!list) return;
  members = list;
  $("t-members").textContent = members.length;
  renderMembers();
}

function renderMembers() {
  const q = $("member-search").value.trim().toLowerCase();
  const role = $("member-role").value;
  const shown = members.filter(m =>
    (!role || m.role === role) &&
    (!q || `${m.full_name} ${m.email}`.toLowerCase().includes(q)));

  if (!shown.length) {
    $("member-list").replaceChildren(muted(members.length ? "No one matches that." : "No members yet."));
    return;
  }

  const rows = shown.map(m => el("tr", {}, [
    el("td", { text: m.full_name || "(no name)" }),
    el("td", { text: m.email, className: "muted-cell" }),
    el("td", { text: new Date(m.created_at).toLocaleDateString(), className: "muted-cell" }),
    el("td", {}, [m.id === me.id ? el("span", { className: "badge admin", text: "you" }) : memberRole(m)]),
  ]));
  $("member-list").replaceChildren(table(["Name", "Email", "Joined", "Role"], rows));
}

function memberRole(m) {
  const select = roleSelect(m.role, `Role for ${m.full_name}`);
  select.addEventListener("change", async () => {
    const next = select.value;
    if (!confirm(`Make ${m.full_name} ${ROLE_LABELS[next].toLowerCase()}?`)) {
      select.value = m.role;
      return;
    }
    select.disabled = true;
    const res = await apiPost("/api/admin/role", { user_id: m.id, role: next });
    select.disabled = false;
    if (!res.ok) {
      select.value = m.role;
      return showMessage(message, await errorDetail(res), "error");
    }
    m.role = next;
    showMessage(message, `${m.full_name} is now ${ROLE_LABELS[next].toLowerCase()}.`, "success");
    renderMembers();
  });
  return select;
}

// ── Subjects ────────────────────────────────────────────────────────────────
async function loadSubjects() {
  const stats = await getJson("/api/stats/subject?top=8");
  if (!stats) return;
  if (!stats.length) return $("subject-bars").replaceChildren(muted("No sessions yet."));

  const max = Math.max(...stats.map(s => s.sessions));
  $("subject-bars").replaceChildren(...stats.map(s => {
    const fill = el("div", { className: "bar-fill" });
    fill.style.width = `${(s.sessions / max) * 100}%`;
    return el("div", { className: "bar-row" }, [
      el("span", { className: "bar-name", text: s.subject }),
      el("span", { className: "bar-count", text: String(s.sessions) }),
      el("div", { className: "bar-track" }, [fill]),
    ]);
  }));
}

// ── Recent sessions ─────────────────────────────────────────────────────────
async function loadRecent() {
  const sessions = await getJson("/api/admin/sessions/recent?limit=10");
  if (!sessions) return;
  if (!sessions.length) return $("recent-sessions").replaceChildren(muted("No sessions yet."));

  const rows = sessions.map(s => el("tr", {}, [
    el("td", { text: s["planned date"] }),
    el("td", { text: s["tutor name"] }),
    el("td", { text: s.students }),
    el("td", { text: s.subject }),
    el("td", { text: s.location, className: "muted-cell" }),
    el("td", { text: s.duration, className: "num" }),
  ]));
  $("recent-sessions").replaceChildren(
    table(["Date", "Tutor", "Students", "Subject", "Where", ["Length", "num"]], rows));
}
