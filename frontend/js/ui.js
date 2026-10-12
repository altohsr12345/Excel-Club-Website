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
