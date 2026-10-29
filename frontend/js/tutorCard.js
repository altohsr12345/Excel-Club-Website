import { el } from "./ui.js";

/**
 * One tutor card, as shown on the public tutors page. The profile editor uses it for its live preview,
 * so both always look the same. Everything goes in through textContent (via el), never innerHTML,
 * because names and bios are typed by tutors.
 *
 * t = { display_name, grade, bio, subjects } where subjects are {level, name} objects,
 * or plain strings for the old hard-coded tutors.
 */
export function tutorCard(t) {
  const subjects = t.subjects.map(s => typeof s === "string"
    ? el("li", { text: s })
    : el("li", {}, [el("b", { text: s.level }), ` ${s.name}`]));

  return el("article", { className: "tcard" }, [
    el("div", { className: "tcard-head" }, [
      el("h3", { className: "tcard-name", text: t.display_name || "Your name" }),
      ...(t.grade ? [el("span", { className: "tcard-grade", text: `Grade ${t.grade}` })] : []),
    ]),
    subjects.length
      ? el("ul", { className: "tcard-subjects" }, subjects)
      : el("p", { className: "tcard-empty", text: "No subjects yet" }),
    ...(t.bio ? [el("p", { className: "tcard-bio", text: t.bio })] : []),
  ]);
}
