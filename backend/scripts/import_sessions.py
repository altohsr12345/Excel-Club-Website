"""
loads a sessions spreadsheet export (like sample_sessions.csv) into the supabase tables:
students, sessions and session_students. meant for testing the site with realistic data,
and later for moving the real google sheet over.

run from backend/:
    uv run scripts/import_sessions.py --dry-run                 # just reads the file and reports, touches nothing
    uv run scripts/import_sessions.py                           # imports ../sample_sessions.csv (asks first)
    uv run scripts/import_sessions.py --tutor "Grace Liu=you@example.com"   # her sessions become yours
    uv run scripts/import_sessions.py --undo                    # deletes everything the last import added

tutors are linked to accounts by full name (case-insensitive). sessions whose tutor has no
account keep the name in tutor_name but wont show on anyone's tutor home. use --tutor to point
a name from the sheet at an existing account so you can see those sessions when logged in.

needs scripts 1-6 from the setup (the sessions/students tables) already run in supabase.
"""
import argparse
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from datafuncs import parse_duration

BACKEND = Path(__file__).resolve().parent.parent
DEFAULT_CSV = BACKEND.parent / "sample_sessions.csv"
UNDO_FILE = BACKEND / "data" / "last_import.json"   # data/ is gitignored
BATCH = 200

# sheet column -> what it holds. headers are lowercased and stripped first
COLS = {
    "request": "request date",
    "tutor": "tutor name",
    "students": "students",
    "subject": "subject",
    "date": "planned date",
    "start": "starting time\n24 hour format",
    "planned": "planned duration",
    "location": "location",
    "approved": "approved",
    "approver": "approval",
    "in": "in",
    "out": "out",
    "duration": "duration",
    "recorded": "recording of teaching\n26/27",
    "comments": "tutor comments",
}

# Approved = FALSE in the sheet. could also mean "turned down"; change to "cancelled" if that's what it meant
NOT_APPROVED_STATUS = "requested"


# ── parsing one cell at a time ────────────────────────────────────────────

def blank(v) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() == ""


def text(v) -> str | None:
    return None if blank(v) else " ".join(str(v).split())


def day(v) -> str | None:
    if blank(v):
        return None
    return datetime.strptime(str(v).strip(), "%d/%m/%Y").date().isoformat()


def clock(v) -> str | None:
    """'7:05', '17:00' or '17:00:00' -> '07:05' style"""
    if blank(v):
        return None
    m = re.fullmatch(r"(\d{1,2}):(\d{2})(?::\d{2})?", str(v).strip())
    if not m or int(m[1]) > 23 or int(m[2]) > 59:
        raise ValueError(f"not a time: {v!r}")
    return f"{int(m[1]):02d}:{m[2]}"


def minutes(v) -> int | None:
    """'1:00:00', '0:45', '1 hour', '30 mins', '1.5 hours' -> minutes. 0 counts as empty"""
    if blank(v):
        return None
    s = str(v).strip().lower()
    if ":" in s:
        mins = parse_duration(s)
    else:
        m = re.fullmatch(r"([\d.]+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)", s)
        if not m:
            raise ValueError(f"not a duration: {v!r}")
        mins = float(m[1]) * (60 if m[2].startswith("h") else 1)
    if mins is None or math.isnan(mins):
        raise ValueError(f"not a duration: {v!r}")
    return round(mins) or None


def yes(v) -> bool:
    return not blank(v) and str(v).strip().lower() in ("true", "yes", "y", "1")


def names(v) -> list[str]:
    return [n for n in (text(x) for x in str(v).split(",")) if n] if not blank(v) else []


def between(t_in: str | None, t_out: str | None) -> int | None:
    if not t_in or not t_out:
        return None
    h1, m1 = map(int, t_in.split(":"))
    h2, m2 = map(int, t_out.split(":"))
    mins = (h2 * 60 + m2) - (h1 * 60 + m1)
    return mins if mins > 0 else None


# ── reading the whole sheet ───────────────────────────────────────────────

def read_sheet(path: Path) -> tuple[list[dict], list[str]]:
    """returns (sessions ready to insert + their student names, problems found)"""
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df.columns = df.columns.str.strip().str.lower()
    missing = [c for c in COLS.values() if c not in df.columns]
    if missing:
        sys.exit(f"{path.name} is missing column(s): {missing}")

    rows, problems = [], []
    for i, r in df.iterrows():
        line = i + 2   # +1 for the header, +1 because spreadsheets count from 1
        get = lambda key: r[COLS[key]]
        if blank(get("tutor")) and blank(get("subject")) and blank(get("date")):
            continue   # empty row at the bottom of the sheet
        try:
            t_in, t_out = clock(get("in")), clock(get("out"))
            session = {
                "requested_at": day(get("request")) or day(get("date")),
                "tutor_name": text(get("tutor")),
                "subject": text(get("subject")),
                "planned_date": day(get("date")),
                "start_time": clock(get("start")),
                "planned_minutes": minutes(get("planned")),
                "location": text(get("location")),
                "status": "completed" if t_in and t_out
                          else "approved" if yes(get("approved")) else NOT_APPROVED_STATUS,
                "approved_by_name": text(get("approver")),
                "time_in": t_in,
                "time_out": t_out,
                "duration_minutes": (minutes(get("duration")) or between(t_in, t_out)) if t_in and t_out else None,
                "recorded": yes(get("recorded")),
                "tutor_comments": text(get("comments")),
            }
            for need in ("tutor_name", "subject", "planned_date"):
                if not session[need]:
                    raise ValueError(f"no {need.replace('_', ' ')}")
        except ValueError as e:
            problems.append(f"line {line}: {e}, skipped")
            continue
        rows.append({"session": session, "students": names(get("students"))})
    return rows, problems


def summary(rows: list[dict]):
    statuses = pd.Series([r["session"]["status"] for r in rows]).value_counts().to_dict()
    students = {n.lower() for r in rows for n in r["students"]}
    tutors = {r["session"]["tutor_name"] for r in rows}
    print(f"  {len(rows)} sessions  {statuses}")
    print(f"  {len(tutors)} tutors, {len(students)} different students")
    print(f"  {sum(not r['students'] for r in rows)} sessions with no students listed")


# ── writing to supabase ───────────────────────────────────────────────────

def chunks(items: list, n: int = BATCH):
    for i in range(0, len(items), n):
        yield items[i:i + n]


def save_undo(log: dict):
    UNDO_FILE.parent.mkdir(exist_ok=True)
    UNDO_FILE.write_text(json.dumps(log, indent=1))


def tutor_ids(sb, overrides: list[str]) -> dict[str, str]:
    """sheet tutor name (lowercase) -> profile id, from matching full names plus any --tutor NAME=EMAIL"""
    staff = (sb.table("profiles").select("id, full_name, email")
               .eq("approved", True).in_("role", ["tutor", "admin"]).execute().data)
    ids = {" ".join((p["full_name"] or "").split()).lower(): p["id"] for p in staff if p["full_name"]}
    by_email = {p["email"].lower(): p["id"] for p in staff if p["email"]}
    for pair in overrides:
        name, _, email = pair.partition("=")
        if not email or email.strip().lower() not in by_email:
            sys.exit(f"--tutor {pair!r}: needs NAME=EMAIL, and the email must be an approved tutor or admin")
        ids[" ".join(name.split()).lower()] = by_email[email.strip().lower()]
    return ids


def run_import(sb, rows: list[dict], overrides: list[str], source: str):
    tutors = tutor_ids(sb, overrides)   # first, so a bad --tutor stops us before anything is written
    log = {"source": source, "at": datetime.now(timezone.utc).isoformat(), "session_ids": [], "student_ids": []}
    save_undo(log)

    # students: reuse anyone already on the list (same name, no grade), add the rest
    existing = sb.table("students").select("id, full_name, grade").execute().data
    student_id = {s["full_name"].lower(): s["id"] for s in existing if s["grade"] is None}
    new_names = {}
    for r in rows:
        for n in r["students"]:
            if n.lower() not in student_id:
                new_names.setdefault(n.lower(), n)
    reused = {n.lower() for r in rows for n in r["students"]} - new_names.keys()
    for batch in chunks(list(new_names.values())):
        created = sb.table("students").insert([{"full_name": n} for n in batch]).execute().data
        for s in created:
            student_id[s["full_name"].lower()] = s["id"]
        log["student_ids"] += [s["id"] for s in created]
        save_undo(log)
    print(f"  students: {len(new_names)} added, {len(reused)} were already on the list")

    linked = 0
    for batch in chunks(rows):
        payload = []
        for r in batch:
            s = dict(r["session"])
            s["tutor_id"] = tutors.get(s["tutor_name"].lower())
            linked += bool(s["tutor_id"])
            payload.append(s)
        created = sb.table("sessions").insert(payload).execute().data
        log["session_ids"] += [c["id"] for c in created]
        save_undo(log)

        # rows come back in the order they were sent; check before relying on it for the links
        for sent, got in zip(payload, created, strict=True):
            if (sent["planned_date"], sent["tutor_name"], sent["subject"]) != (got["planned_date"], got["tutor_name"], got["subject"]):
                sys.exit("sessions came back in a different order than sent, stopping. run --undo to clean up")

        links = [{"session_id": got["id"], "student_id": student_id[n.lower()]}
                 for r, got in zip(batch, created) for n in dict.fromkeys(r["students"])]
        if links:
            sb.table("session_students").insert(links).execute()
        print(f"  sessions: {len(log['session_ids'])} / {len(rows)}")

    print(f"done. {linked} sessions linked to a tutor account, {len(rows) - linked} only have the tutor's name.")
    print(f"to remove all of it again: uv run scripts/import_sessions.py --undo")


def run_undo(sb):
    if not UNDO_FILE.exists():
        sys.exit("nothing to undo (no data/last_import.json)")
    log = json.loads(UNDO_FILE.read_text())
    print(f"removing the import of {log['source']} from {log['at']}: "
          f"{len(log['session_ids'])} sessions, {len(log['student_ids'])} students")
    for batch in chunks(log["session_ids"]):
        # the cascade would remove these anyway; doing it first makes the "still in use" check below exact
        sb.table("session_students").delete().in_("session_id", batch).execute()
        sb.table("sessions").delete().in_("id", batch).execute()

    kept = 0
    for batch in chunks(log["student_ids"]):
        # a student someone has since logged a real session with stays
        in_use = {r["student_id"] for r in sb.table("session_students").select("student_id").in_("student_id", batch).execute().data}
        removable = [i for i in batch if i not in in_use]
        kept += len(batch) - len(removable)
        if removable:
            sb.table("students").delete().in_("id", removable).execute()
    UNDO_FILE.unlink()
    print(f"done.{f' kept {kept} students who are now in other sessions.' if kept else ''}")


def main():
    parser = argparse.ArgumentParser(description="import a sessions spreadsheet export into supabase")
    parser.add_argument("csv", nargs="?", default=str(DEFAULT_CSV))
    parser.add_argument("--dry-run", action="store_true", help="read and report only, no database")
    parser.add_argument("--tutor", action="append", default=[], metavar="NAME=EMAIL",
                        help="link a tutor name from the sheet to an account (repeatable)")
    parser.add_argument("--undo", action="store_true", help="delete everything the last import added")
    parser.add_argument("--yes", action="store_true", help="don't ask before writing")
    args = parser.parse_args()

    if args.undo:
        from db import sb
        return run_undo(sb)

    path = Path(args.csv).resolve()
    rows, problems = read_sheet(path)
    print(f"{path.name}:")
    summary(rows)
    for p in problems[:20]:
        print("  !", p)
    if len(problems) > 20:
        print(f"  ! ...and {len(problems) - 20} more")
    if args.dry_run:
        print("\nfirst session as it would be saved:")
        print(json.dumps(rows[0], indent=1) if rows else "  (none)")
        return

    if UNDO_FILE.exists():
        sys.exit("an earlier import is still in the database (data/last_import.json exists). "
                 "run --undo first so you don't get everything twice")

    from db import sb
    if not args.yes and input(f"\nimport this into {os.environ['SB_URL']}? [y/N] ").strip().lower() != "y":
        sys.exit("cancelled, nothing written")
    run_import(sb, rows, args.tutor, path.name)


if __name__ == "__main__":
    main()
