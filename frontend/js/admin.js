import { apiFetch, apiPost, errorDetail, getMe } from "./supabaseClient.js";
import { el, setBusy, showMessage, wireHeader, ROLE_LABELS } from "./ui.js";

wireHeader();

const $ = (id) => document.getElementById(id);
const message = $("auth-message");
const list = $("pending-list");

// ── Admins only (the backend enforces this too — this just avoids a useless page) ──
const { profile, status } = await getMe();
if (status !== 200) {
  window.location.replace("login.html");
} else if (!(profile.approved && profile.role === "admin")) {
  $("loading").hidden = true;
  showMessage(message, "This page is for admins only.", "error");
} else {
  loadPending();
}

async function loadPending() {
  $("loading").hidden = false;
  const res = await apiFetch("/api/admin/pending");
  $("loading").hidden = true;
  if (!res.ok) return showMessage(message, await errorDetail(res), "error");

  const pending = await res.json();
  if (!pending.length) {
    list.replaceChildren(el("p", { className: "auth-muted", text: "No one is waiting for approval. 🎉" }));
    return;
  }
  list.replaceChildren(...pending.map(personCard));
}

function personCard(p) {
  const roleSelect = el("select", { className: "auth-input compact", "aria-label": `Role for ${p.full_name}` },
    Object.entries(ROLE_LABELS).map(([value, label]) => {
      const opt = el("option", { value, text: label });
      if (value === p.requested_role) opt.selected = true;
      return opt;
    })
  );

  const approveBtn = el("button", { className: "auth-button small", text: "Approve", type: "button" });
  const rejectBtn  = el("button", { className: "auth-button small danger", text: "Reject", type: "button" });

  const card = el("div", { className: "pending-card" }, [
    el("div", { className: "pending-info" }, [
      el("p", { className: "pending-name", text: p.full_name || "(no name)" }),
      el("p", { className: "auth-muted", text: p.email }),
      el("p", { className: "auth-muted small",
                text: `Applied as ${(ROLE_LABELS[p.requested_role] ?? p.requested_role).toLowerCase()} · ${new Date(p.created_at).toLocaleDateString()}` }),
    ]),
    el("div", { className: "pending-actions" }, [roleSelect, approveBtn, rejectBtn]),
  ]);

  approveBtn.addEventListener("click", async () => {
    setBusy(approveBtn, true, "…");
    const res = await apiPost("/api/admin/approve", { user_id: p.id, role: roleSelect.value });
    setBusy(approveBtn, false);
    if (!res.ok) return showMessage(message, await errorDetail(res), "error");
    showMessage(message, `Approved ${p.full_name} as ${ROLE_LABELS[roleSelect.value].toLowerCase()}.`, "success");
    loadPending();
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
