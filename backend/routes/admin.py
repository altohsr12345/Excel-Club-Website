from uuid import UUID

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import ROLES, require_role
from datafuncs import load_sessions
from db import sb

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
    everyone already approved, for the members table on the control panel
    """
    return (sb.table("profiles")
              .select("id, full_name, email, role, created_at")
              .eq("approved", True)
              .order("full_name")
              .execute().data)


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
    latest sessions by planned date. still reads the CSV like everything else in datafuncs
    """
    df = load_sessions()
    dates = pd.to_datetime(df["planned date"], format="%d/%m/%Y", errors="coerce")
    recent = df.assign(_date=dates).sort_values("_date", ascending=False).head(limit)
    cols = ["planned date", "tutor name", "students", "subject", "duration", "location"]
    return recent[cols].fillna("").to_dict(orient="records")
