from fastapi import APIRouter, Depends

from auth import STAFF, require_role
from datafuncs import distinct_students, load_sessions

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview():
    """
    this is meant to be public, bcs we get to flex our general stats on the landing page
    """
    df = load_sessions()
    return {
        "total_sessions": len(df),
        "total_hours": round(float(df["minutes"].sum()) / 60, 1),
        "distinct_tutors": int(df["tutor name"].nunique()),
        "distinct_students": distinct_students(df),
    }


@router.get("/subject")
def subject_stats(top: int = 5, profile: dict = Depends(require_role(*STAFF))):
    df = load_sessions()
    counts = df["subject"].value_counts().head(top)
    return [{"subject": name, "sessions": int(n)} for name, n in counts.items()]
