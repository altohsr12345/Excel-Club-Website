from fastapi import APIRouter, Depends

from auth import ROLES, get_current_profile, require_role
from datafuncs import all_sessions

router = APIRouter(prefix="/api", tags=["account"])


@router.get("/me")
def me(profile: dict = Depends(get_current_profile)):
    """
    basically any logged-in user, approved or not.
    frontend uses this to decide what to show
    """
    return profile


@router.get("/my/sessions")
def my_sessions(profile: dict = Depends(require_role(*ROLES))):
    """
    sessions this person was a student in, newest first. matched by the student-list entry linked
    to their account (students.profile_id), or failing that one with exactly their full name
    """
    name = " ".join((profile["full_name"] or "").split()).lower()

    def is_me(st: dict) -> bool:
        if st["profile_id"]:
            return st["profile_id"] == profile["id"]
        return bool(name) and " ".join(st["full_name"].split()).lower() == name

    return [{
        "planned_date": s["planned_date"],
        "tutor_name": s["tutor_name"],
        "subject": s["subject"],
        "status": s["status"],
        "duration_minutes": s["duration_minutes"],
    } for s in all_sessions() if s["status"] != "cancelled" and any(is_me(st) for st in s["students"])]
