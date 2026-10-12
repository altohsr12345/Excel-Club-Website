from fastapi import APIRouter, Depends

from auth import ROLES, get_current_profile, require_role
from datafuncs import load_sessions

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
    """TEMPORARY: matches by name against the CSV. Replace with member_id lookup later."""
    df = load_sessions()
    mine = df[df["students"].fillna("").str.contains(profile["full_name"], regex=False)]
    cols = ["planned date", "tutor name", "subject", "duration"]
    return mine[cols].fillna("").to_dict(orient="records")
