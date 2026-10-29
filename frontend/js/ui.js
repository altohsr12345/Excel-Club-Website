// Small DOM helpers shared by the auth pages.

/** Show a message in a status box. kind: "info" | "error" | "success" */
export function showMessage(box, text, kind = "info") {
  box.textContent = text;
  box.className = `auth-message ${kind}`;
  box.hidden = !text;
}

/** Disable a button and swap its label while a request is running. */
export function setBusy(button, busy, busyLabel = "Please wait…") {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
}

/**
 * Create an element safely. Text always goes in via textContent,
 * so names/bios typed by users can never inject HTML or scripts.
 */
export function el(tag, { className, text, ...attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

/** Header buttons shared with the colleague's pages. */
export function wireHeader() {
  document.getElementById("excelreturn")?.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  document.getElementById("ourtutors")?.addEventListener("click", () => {
    window.location.href = "tutors.html";
  });
}

export const ROLE_LABELS = { student: "Student", tutor: "Tutor", admin: "Admin" };

/** Simple table. headers: "Name" or ["Name", "className"] for that column's header. */
export function table(headers, rows) {
  return el("div", { className: "table-wrap" }, [
    el("table", { className: "auth-table" }, [
      el("thead", {}, [el("tr", {}, headers.map(h => Array.isArray(h)
        ? el("th", { text: h[0], className: h[1] })
        : el("th", { text: h })))]),
      el("tbody", {}, rows),
    ]),
  ]);
}

/** "2026-10-28" -> "28 Oct 2026" in the visitor's own date style */
export function shortDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** 95 -> "1h 35m", 45 -> "45 min" */
export function lengthText(mins) {
  if (!mins) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m} min`;
}
