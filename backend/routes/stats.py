from collections import Counter

from fastapi import APIRouter, Depends, Query

from auth import STAFF, require_role
from datafuncs import completed_sessions

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview():
    """
    this is meant to be public, bcs we get to flex our general stats on the landing page.
    only finished (completed) sessions count
    """
    done = completed_sessions()
    return {
        "total_sessions": len(done),
        "total_hours": round(sum(s["duration_minutes"] or 0 for s in done) / 60, 1),
        "distinct_tutors": len({s["tutor_name"].strip().lower() for s in done}),
        "distinct_students": len({st["id"] for s in done for st in s["students"]}),
    }


@router.get("/subject")
def subject_stats(top: int = Query(5, ge=1, le=50), profile: dict = Depends(require_role(*STAFF))):
    counts = Counter(s["subject"] for s in completed_sessions())
    return [{"subject": name, "sessions": n} for name, n in counts.most_common(top)]
