from fastapi import Depends, Header, HTTPException

from db import sb

#just add to this if there needs to be future roles
STAFF = ("tutor", "admin")
ROLES = ("student", *STAFF)
REQ_ROLES = ("student", "tutor")

def get_current_profile(authorization: str | None = Header(None)):

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not logged in")

    token = authorization.removeprefix("Bearer ")

    try:
        user = sb.auth.get_user(token).user
    except Exception:
        raise HTTPException(401, "Invalid or expired session")

    rows = sb.table("profiles").select("*").eq("id", user.id).execute().data
    if not rows:
        raise HTTPException(401, "No profile found")
    return rows[0]

def require_role(*roles):
    def checker(profile=Depends(get_current_profile)):
        if not profile["approved"]:
            raise HTTPException(403, "account waiting approval")
        if profile["role"] not in roles:
            raise HTTPException(403, "not allowed")
        return profile

    return checker