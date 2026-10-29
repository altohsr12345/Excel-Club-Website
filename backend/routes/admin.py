from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import ROLES, require_role
from datafuncs import all_sessions
from db import sb
from routes.public import public_tutors

is_admin = require_role("admin")

# every route in here is admin only, so new endpoints cant forget the check.
# routes that need the admin's own profile can still Depends(is_admin), fastapi reuses the same result per request
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(is_admin)])


@router.get("/pending")
def pending():
    """
    shows the accs waiting for approval; first in first out
    """
    return (sb.table("profiles")
              .select("id, full_name, email, requested_role, created_at")
              .eq("approved", False)
              .order("created_at")
              .execute().data)


class Approval(BaseModel):
    user_id: UUID
    role: str


@router.post("/approve")
def approve(body: Approval, profile: dict = Depends(is_admin)):
    if body.role not in ROLES:
        raise HTTPException(400, "bad role")
    if str(body.user_id) == profile["id"]:
        raise HTTPException(400, "you cannot change your own role")

    updated = (sb.table("profiles")
                 .update({"role": body.role, "approved": True})
                 .eq("id", str(body.user_id))
                 .execute().data)
    if not updated:
        raise HTTPException(404, "No such user")
    return {"ok": True}


class Rejection(BaseModel):
    user_id: UUID


@router.post("/reject")
def reject(body: Rejection, profile: dict = Depends(is_admin)):
    """
    rejects/deletes a pending sign up (both login + profile), but approved accs are protected
    """
    if str(body.user_id) == profile["id"]:
        raise HTTPException(400, "you cannot reject yourself")

    rows = sb.table("profiles").select("approved").eq("id", str(body.user_id)).execute().data
    if not rows:
        raise HTTPException(404, "no such user")
    if rows[0]["approved"]:
        raise HTTPException(400, "only pending accounts can be rejected")

    sb.auth.admin.delete_user(str(body.user_id))  # profile row is removed by ON DELETE CASCADE
    return {"ok": True}


@router.get("/users")
def users():
    """
    everyone already approved, for the members table on the control panel.
    public_profile is their tutors page profile ({listed, hidden_by_admin}) or None if they havent made one
    """
    rows = (sb.table("profiles")
              .select("id, full_name, email, role, created_at")
              .eq("approved", True)
              .order("full_name")
              .execute().data)
    public = {p["tutor_id"]: p for p in
              sb.table("tutor_profiles").select("tutor_id, listed, hidden_by_admin").execute().data}
    for r in rows:
        p = public.get(r["id"])
        r["public_profile"] = {"listed": p["listed"], "hidden_by_admin": p["hidden_by_admin"]} if p else None
    return rows


class Visibility(BaseModel):
    user_id: UUID
    hidden: bool


@router.post("/tutor-profile/hidden")
def hide_tutor_profile(body: Visibility):
    """
    hides (or unhides) someone's profile on the public tutors page. the tutor cant undo this themselves
    """
    updated = (sb.table("tutor_profiles")
                 .update({"hidden_by_admin": body.hidden})
                 .eq("tutor_id", str(body.user_id))
                 .execute().data)
    if not updated:
        raise HTTPException(404, "that person has no public profile")
    public_tutors.cache_clear()
    return {"ok": True}


@router.post("/role")
def change_role(body: Approval, profile: dict = Depends(is_admin)):
    """
    changes the role of someone already approved (pending ppl go through /approve)
    """
    if body.role not in ROLES:
        raise HTTPException(400, "bad role")
    if str(body.user_id) == profile["id"]:
        raise HTTPException(400, "you cannot change your own role")

    updated = (sb.table("profiles")
                 .update({"role": body.role})
                 .eq("id", str(body.user_id))
                 .eq("approved", True)
                 .execute().data)
    if not updated:
        raise HTTPException(404, "no such member")
    return {"ok": True}


@router.get("/sessions/recent")
def recent_sessions(limit: int = Query(10, ge=1, le=100)):
    """
    latest sessions by planned date, any status, with their students' names
    """
    return [{
        "planned_date": s["planned_date"],
        "tutor_name": s["tutor_name"],
        "students": ", ".join(st["full_name"] for st in s["students"]),
        "subject": s["subject"],
        "location": s["location"],
        "status": s["status"],
        "duration_minutes": s["duration_minutes"],
    } for s in all_sessions()[:limit]]
