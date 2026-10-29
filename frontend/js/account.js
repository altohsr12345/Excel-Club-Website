import { apiFetch, errorDetail, getMe, logout } from "./supabaseClient.js";
import { el, showMessage, table, wireHeader, ROLE_LABELS } from "./ui.js";

wireHeader();
document.getElementById("logout").addEventListener("click", logout);

const $ = (id) => document.getElementById(id);
const message = $("auth-message");

// who am I? Not logged in → back to the login page
const { profile, status } = await getMe();
if (status !== 200) {
  window.location.replace("login.html");
} else {
  render(profile);
}

function render(p) {
  if (p.approved && p.role === "admin") return window.location.replace("admin.html");

  $("loading").hidden = true;
  $("account").hidden = false;

  $("acc-name").textContent = p.full_name || "Welcome";
  $("acc-email").textContent = p.email || "";

  const roleBadge = $("acc-role");
  if (p.approved) {
    roleBadge.textContent = ROLE_LABELS[p.role] ?? p.role;
    roleBadge.className = `badge ${p.role}`;
  } else {
    roleBadge.textContent = "Pending approval";
    roleBadge.className = "badge pending";
  }

  if (!p.approved) {
    $("acc-requested").textContent = (ROLE_LABELS[p.requested_role] ?? p.requested_role).toLowerCase();
    $("pending-box").hidden = false;
    return;   // nothing else is available until approval
  }

  if (p.role === "student") loadMySessions();
  if (p.role === "tutor" || p.role === "admin") loadSubjectStats();
  if (p.role === "admin") $("admin-box").hidden = false;
}

// ── Students: their own sessions ────────────────────────────────────────────
async function loadMySessions() {
  $("student-box").hidden = false;
  const box = $("my-sessions");
  const res = await apiFetch("/api/my/sessions");
  if (!res.ok) return showMessage(message, await errorDetail(res), "error");

  const sessions = await res.json();
  if (!sessions.length) {
    box.replaceChildren(el("p", { className: "auth-muted", text: "No sessions yet." }));
    return;
  }
  const rows = sessions.map(s => el("tr", {}, [
    el("td", { text: s["planned date"] }),
    el("td", { text: s.subject }),
    el("td", { text: s["tutor name"] }),
    el("td", { text: s.duration }),
  ]));
  box.replaceChildren(table(["Date", "Subject", "Tutor", "Duration"], rows));
}

// ── Tutors/admins: subject stats ────────────────────────────────────────────
async function loadSubjectStats() {
  $("staff-box").hidden = false;
  const box = $("subject-stats");
  const res = await apiFetch("/api/stats/subject?top=5");
  if (!res.ok) return showMessage(message, await errorDetail(res), "error");

  const stats = await res.json();
  const rows = stats.map(s => el("tr", {}, [
    el("td", { text: s.subject }),
    el("td", { text: String(s.sessions), className: "num" }),
  ]));
  box.replaceChildren(table(["Subject", ["Sessions", "num"]], rows));
}
