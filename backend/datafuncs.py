import math

from cachetools.func import ttl_cache

from db import sb

# supabase hands back at most 1000 rows per request, so bigger tables are read in pages
PAGE = 1000

SESSION_COLS = ("id, tutor_name, subject, planned_date, start_time, location, status, duration_minutes, "
                "session_students(students(id, full_name, profile_id))")


#just for the stupid gsheets duration structure (still used by scripts/import_sessions.py)
def parse_duration(val) -> float:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return math.nan
    parts = str(val).strip().split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return math.nan
    if len(nums) == 2:
        hour, mins = nums
        return hour * 60 + mins
    if len(nums) == 3:
        hour, mins, sec = nums
        return hour * 60 + mins + sec / 60

    return math.nan


@ttl_cache(ttl=120)
def all_sessions() -> list[dict]:
    """
    every session with its students, newest planned date first. cached for 2 mins;
    the tutor routes clear it when sessions change so the stats catch up straight away
    """
    rows, start = [], 0
    while True:
        page = (sb.table("sessions")
                  .select(SESSION_COLS)
                  .order("planned_date", desc=True)
                  .order("id", desc=True)
                  .range(start, start + PAGE - 1)
                  .execute().data)
        rows += page
        if len(page) < PAGE:
            break
        start += PAGE

    for r in rows:
        links = r.pop("session_students", None) or []
        r["students"] = [l["students"] for l in links if l.get("students")]
    return rows


def completed_sessions() -> list[dict]:
    return [s for s in all_sessions() if s["status"] == "completed"]
