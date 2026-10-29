from cachetools.func import ttl_cache
from fastapi import APIRouter

from auth import STAFF
from db import sb

# no login needed, this is what visitors of the public tutors page see
router = APIRouter(prefix="/api", tags=["public"])

LEVELS = ["IGCSE", "AS", "A Level", "Other"]


def sort_subjects(rows: list[dict]) -> list[dict]:
    """IGCSE first, then AS, A Level, Other; alphabetical inside each level"""
    rank = lambda s: LEVELS.index(s["level"]) if s["level"] in LEVELS else len(LEVELS)
    return sorted(rows, key=lambda s: (rank(s), s["name"]))


@router.get("/subjects")
def subjects():
    """
    the fixed list tutors pick their subjects from
    """
    return sort_subjects(sb.table("subjects").select("id, level, name").execute().data)


@ttl_cache(ttl=300)
def public_tutors() -> dict:
    """cached for 5 mins; saving a profile or hiding one clears it so changes show straight away"""
    # someone who stopped being a tutor (or got unapproved) keeps their row but shouldnt be shown
    staff = sb.table("profiles").select("id").eq("approved", True).in_("role", list(STAFF)).execute().data
    staff_ids = {r["id"] for r in staff}

    rows = (sb.table("tutor_profiles")
              .select("tutor_id, display_name, grade, bio, listed, hidden_by_admin, "
                      "tutor_subjects(subjects(id, level, name))")
              .execute().data)

    tutors = []
    for r in rows:
        if r["tutor_id"] not in staff_ids or not r["listed"] or r["hidden_by_admin"]:
            continue
        links = r.get("tutor_subjects") or []
        tutors.append({
            "display_name": r["display_name"],
            "grade": r["grade"],
            "bio": r["bio"] or "",
            "subjects": sort_subjects([l["subjects"] for l in links if l.get("subjects")]),
        })

    return {
        "tutors": sorted(tutors, key=lambda t: t["display_name"].lower()),
        # TEMPORARY, while the tutors page still falls back to the old hard-coded list in functions.js:
        # first names of everyone who has a profile at all (even hidden), so a hidden or unlisted
        # tutor doesn't reappear through their old entry. drop this once that list is deleted
        "profile_names": sorted({r["display_name"].split()[0].lower() for r in rows}),
    }


@router.get("/tutors")
def tutors():
    """
    listed tutors only, and only their public fields (no ids, emails or roles)
    """
    return public_tutors()
