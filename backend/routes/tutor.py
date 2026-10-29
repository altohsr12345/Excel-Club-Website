from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from auth import STAFF, require_role
from datafuncs import all_sessions
from db import sb
from routes.public import public_tutors

is_staff = require_role(*STAFF)

# tutors (and admins, who usually tutor too) log and track their own sessions here.
# reads/writes the supabase sessions tables, not the old CSV
router = APIRouter(prefix="/api/tutor", tags=["tutor"], dependencies=[Depends(is_staff)])

# embeds the students of each session through session_students
SESSION_COLS = "*, session_students(students(id, full_name, grade))"


def clean_name(name: str) -> str:
    return " ".join(name.split())


def flatten(row: dict) -> dict:
    """
    turns the nested session_students -> students embed into a plain students list
    """
    links = row.pop("session_students", None) or []
    row["students"] = [link["students"] for link in links if link.get("students")]
    return row


def minutes_between(start: str | time | None, end: str | time | None) -> int | None:
    if not start or not end:
        return None
    start, end = (t if isinstance(t, time) else time.fromisoformat(t) for t in (start, end))
    mins = (datetime.combine(date.min, end) - datetime.combine(date.min, start)).total_seconds() / 60
    if mins <= 0:
        raise HTTPException(400, "time out has to be after time in")
    return round(mins)


def own_session(session_id: int, profile: dict) -> dict:
    rows = sb.table("sessions").select("*").eq("id", session_id).eq("tutor_id", profile["id"]).execute().data
    if not rows:
        raise HTTPException(404, "no such session")
    return rows[0]


def check_students(ids: list[int]):
    found = sb.table("students").select("id").in_("id", ids).execute().data
    missing = set(ids) - {r["id"] for r in found}
    if missing:
        raise HTTPException(400, f"unknown student id(s): {sorted(missing)}")


def link_students(session_id: int, ids: list[int]):
    sb.table("session_students").insert([{"session_id": session_id, "student_id": i} for i in ids]).execute()


# students

@router.get("/students")
def search_students(q: str = "", profile: dict = Depends(is_staff)):
    """
    search box suggestions. empty search = students this tutor taught most recently
    """
    q = clean_name(q)
    if q:
        return sb.rpc("search_students", {"q": q}).execute().data

    recent, seen = [], set()
    for s in my_sessions(profile):
        for st in s["students"]:
            if st["id"] not in seen:
                seen.add(st["id"])
                recent.append(st)
    return recent[:8]


class NewStudent(BaseModel):
    full_name: str = Field(min_length=1, max_length=80)
    grade: int | None = Field(None, ge=1, le=13)
    confirm_new: bool = False


@router.post("/students")
def add_student(body: NewStudent, profile: dict = Depends(is_staff)):
    """
    adds someone to the student list. if similar names exist and confirm_new is false,
    nothing is created and the close matches come back so the tutor can pick one instead
    """
    name = clean_name(body.full_name)
    if not name:
        raise HTTPException(400, "name can't be empty")

    if not body.confirm_new:
        matches = sb.rpc("search_students", {"q": name}).execute().data
        if matches:
            return {"student": None, "matches": matches}

    try:
        row = (sb.table("students")
                 .insert({"full_name": name, "grade": body.grade, "created_by": profile["id"]})
                 .execute().data[0])
    except APIError as e:
        if e.code == "23505":
            raise HTTPException(409, "a student with that name and grade is already on the list, search for them instead")
        raise
    return {"student": row, "matches": []}


# sessions
@router.get("/sessions")
def my_sessions(profile: dict = Depends(is_staff)):
    """newest first"""
    rows = (sb.table("sessions")
              .select(SESSION_COLS)
              .eq("tutor_id", profile["id"])
              .order("planned_date", desc=True)
              .order("start_time", desc=True)
              .execute().data)
    return [flatten(r) for r in rows]


class NewSession(BaseModel):
    subject: str = Field(min_length=1, max_length=100)
    planned_date: date
    start_time: time | None = None
    planned_minutes: int | None = Field(None, ge=5, le=600)
    location: str | None = Field(None, max_length=100)
    student_ids: list[int] = Field(min_length=1, max_length=20)


@router.post("/sessions")
def create_session(body: NewSession, profile: dict = Depends(is_staff)):
    """
    tutors arrange sessions themselves (often informally), so they start out approved/scheduled
    """
    ids = list(dict.fromkeys(body.student_ids))
    check_students(ids)

    data = body.model_dump(mode="json", exclude={"student_ids"})
    data |= {"subject": data["subject"].strip(), "tutor_id": profile["id"],
             "tutor_name": profile["full_name"] or profile["email"], "status": "approved"}
    row = sb.table("sessions").insert(data).execute().data[0]
    link_students(row["id"], ids)
    all_sessions.cache_clear()
    return get_session(row["id"], profile)


@router.get("/sessions/{session_id}")
def get_session(session_id: int, profile: dict = Depends(is_staff)):
    rows = (sb.table("sessions")
              .select(SESSION_COLS)
              .eq("id", session_id)
              .eq("tutor_id", profile["id"])
              .execute().data)
    if not rows:
        raise HTTPException(404, "no such session")
    return flatten(rows[0])


class SessionUpdate(BaseModel):
    """everything optional, only fields that are sent get changed"""
    subject: str | None = Field(None, min_length=1, max_length=100)
    planned_date: date | None = None
    start_time: time | None = None
    planned_minutes: int | None = Field(None, ge=5, le=600)
    location: str | None = Field(None, max_length=100)
    status: Literal["approved", "completed", "cancelled"] | None = None
    time_in: time | None = None
    time_out: time | None = None
    recorded: bool | None = None
    tutor_comments: str | None = Field(None, max_length=2000)
    student_ids: list[int] | None = Field(None, min_length=1, max_length=20)


@router.patch("/sessions/{session_id}")
def update_session(session_id: int, body: SessionUpdate, profile: dict = Depends(is_staff)):
    """edit details, wrap a session up (times, recording, comments) or cancel it"""
    current = own_session(session_id, profile)
    changes = body.model_dump(mode="json", exclude_unset=True, exclude={"student_ids"})
    # these columns are NOT NULL, so an explicit null just means "leave it"
    for col in ("subject", "planned_date", "status", "recorded"):
        if changes.get(col, "") is None:
            del changes[col]
    merged = current | changes

    if merged["status"] == "completed" and not (merged["time_in"] and merged["time_out"]):
        raise HTTPException(400, "add the time in and time out to mark a session as done")
    if "time_in" in changes or "time_out" in changes:
        changes["duration_minutes"] = minutes_between(merged["time_in"], merged["time_out"])

    if changes:
        sb.table("sessions").update(changes).eq("id", session_id).eq("tutor_id", profile["id"]).execute()

    if body.student_ids is not None:
        ids = list(dict.fromkeys(body.student_ids))
        check_students(ids)
        sb.table("session_students").delete().eq("session_id", session_id).execute()
        link_students(session_id, ids)

    all_sessions.cache_clear()
    return get_session(session_id, profile)


# public profile (shown on the tutors page)

def profile_out(row: dict) -> dict:
    links = row.pop("tutor_subjects", None) or []
    return row | {"exists": True, "bio": row["bio"] or "", "subject_ids": [l["subject_id"] for l in links]}


@router.get("/profile")
def my_profile(profile: dict = Depends(is_staff)):
    """
    the logged in tutor's public profile. if they havent made one yet, sensible defaults with exists=False
    """
    rows = (sb.table("tutor_profiles")
              .select("display_name, grade, bio, listed, hidden_by_admin, updated_at, tutor_subjects(subject_id)")
              .eq("tutor_id", profile["id"])
              .execute().data)
    if rows:
        return profile_out(rows[0])

    first_name = (profile["full_name"] or "").split(" ")[0]
    return {"exists": False, "display_name": first_name, "grade": None, "bio": "",
            "listed": True, "hidden_by_admin": False, "updated_at": None, "subject_ids": []}


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)
    grade: int | None = Field(None, ge=7, le=13)
    bio: str = Field("", max_length=400)
    listed: bool = True
    subject_ids: list[int] = Field(default_factory=list, max_length=30)


@router.put("/profile")
def save_profile(body: ProfileUpdate, profile: dict = Depends(is_staff)):
    """
    creates or replaces the whole profile, including the subject list.
    hidden_by_admin isnt touched, tutors cant unhide themselves
    """
    name = clean_name(body.display_name)
    if not name:
        raise HTTPException(400, "display name can't be empty")

    ids = list(dict.fromkeys(body.subject_ids))
    if ids:
        found = sb.table("subjects").select("id").in_("id", ids).execute().data
        missing = set(ids) - {r["id"] for r in found}
        if missing:
            raise HTTPException(400, f"unknown subject id(s): {sorted(missing)}")

    sb.table("tutor_profiles").upsert({
        "tutor_id": profile["id"],
        "display_name": name,
        "grade": body.grade,
        "bio": body.bio.strip() or None,
        "listed": body.listed,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="tutor_id").execute()

    sb.table("tutor_subjects").delete().eq("tutor_id", profile["id"]).execute()
    if ids:
        sb.table("tutor_subjects").insert([{"tutor_id": profile["id"], "subject_id": i} for i in ids]).execute()

    public_tutors.cache_clear()
    return my_profile(profile)
