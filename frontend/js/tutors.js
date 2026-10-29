import { el } from "./ui.js";
import { tutorCard } from "./tutorCard.js";

document.addEventListener('wheel', function(event) {
    if (event.ctrlKey) {
        event.preventDefault();
    }
}, { passive: false }); // disables zoom  with ctrl + scroll

document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && (
        event.key === '+' ||
        event.key === '-' ||
        event.key === '=' ||
        event.key === '0'
    )) {
        event.preventDefault();
    }
}); // also prevents zoom and stuff but with ctrl +, _, etc etc




signup.addEventListener("click", () => {
    window.location.href = "login.html";
}); // detects when our user hits signup and leads them to the gform

contacts.addEventListener("click", () => {
    document.querySelectorAll(".contact-overlay")
        .forEach(element => element.classList.toggle("show"));
});

blurcontacts.addEventListener("click", () => {
    document.querySelectorAll(".contact-overlay")
        .forEach(element => element.classList.remove("show"));
});

excelreturn.addEventListener("click", () => {
    window.location.href = "index.html";
});


// ── Tutor cards ─────────────────────────────────────────────────────────────
// profiles come from the database now (tutors edit their own). anyone who hasn't made one yet
// still shows from the old hard-coded list in functions.js, matched by first name, so the page
// isn't empty while people move over. delete that list once everyone has a profile
const container = document.querySelector("#tutorsContainer");
const subjectFilter = document.getElementById("subject-filter");
let everyone = [];
let grade = null;   // null = every grade

const firstName = (name) => name.trim().split(/\s+/)[0].toLowerCase();

/** profileNames: first names of everyone with a profile, even hidden ones, so they don't come back through here */
function oldListCards(profileNames) {
  const taken = new Set(profileNames);
  return tutors
    .filter(t => !taken.has(firstName(t.name)))
    .map(t => ({ display_name: t.name, grade: t.grade, bio: t.description, subjects: t.subjects, oldList: true }));
}

const LEVEL_PATTERNS = { "IGCSE": /igcse/, "AS": /\bas\b/, "A Level": /\b(a|al|a level)\b/ };

function teaches(t, level, name) {
  if (!t.oldList) return t.subjects.some(s => s.level === level && s.name === name);
  // old entries are free text like "IGCSE/AS Math", so match loosely: the level, plus the subject's first few letters
  const start = name.toLowerCase().slice(0, 4);
  return t.subjects.some(s => {
    const text = s.toLowerCase();
    return text.includes(start) && (!LEVEL_PATTERNS[level] || LEVEL_PATTERNS[level].test(text));
  });
}

function render() {
  const [level, name] = subjectFilter.value ? subjectFilter.value.split("|") : [];
  const shown = everyone.filter(t => (!grade || t.grade === grade) && (!level || teaches(t, level, name)));
  container.replaceChildren(...(shown.length
    ? shown.map(tutorCard)
    : [el("p", { className: "tutors-note", text: "No tutors match that yet. Try another grade or subject." })]));
}

async function getJson(path) {
  try {
    const res = await fetch(path);
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

function fillSubjectFilter(subjects) {
  if (!subjects?.length) {
    subjectFilter.hidden = true;
    return;
  }
  const groups = new Map();
  for (const s of subjects) {
    if (!groups.has(s.level)) groups.set(s.level, el("optgroup", { label: s.level }));
    groups.get(s.level).append(el("option", { value: `${s.level}|${s.name}`, text: s.name }));
  }
  subjectFilter.append(...groups.values());
  subjectFilter.addEventListener("change", render);
}

// clicking a grade shows only that grade; clicking it again shows everyone
gradeButtons.forEach(button => {
  button.addEventListener("click", () => {
    const g = Number(button.dataset.grade);
    grade = grade === g ? null : g;
    gradeButtons.forEach(b => b.classList.toggle("selected", Number(b.dataset.grade) === grade));
    render();
  });
});

container.replaceChildren(el("p", { className: "tutors-note", text: "Loading tutors…" }));
const [fromDb, subjects] = await Promise.all([getJson("/api/tutors"), getJson("/api/subjects")]);
const listed = fromDb?.tutors ?? [];
everyone = [...listed, ...oldListCards([...(fromDb?.profile_names ?? []), ...listed.map(t => firstName(t.display_name))])]
  .sort((a, b) => a.display_name.localeCompare(b.display_name));
fillSubjectFilter(subjects);
render();
