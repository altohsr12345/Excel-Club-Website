import math
from pathlib import Path

import pandas as pd
from cachetools.func import ttl_cache


#will swap to supabase later once already done w feedback and initial qa
DATA = Path(__file__).resolve().parent / ".."


#just for the stupid gsheets duration structure
def parse_duration(val: str) -> float:
    if pd.isna(val):
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

@ttl_cache(ttl=300)
def load_sessions() -> pd.DataFrame:
    df = pd.read_csv(DATA / "sample_sessions.csv")
    df.columns = df.columns.str.strip().str.lower()
    df = df.dropna(subset=["tutor name"])
    df["minutes"] = df["duration"].map(parse_duration)
    bad = df["minutes"].isna().sum()
    if bad:
        print(f"{bad} unreadable")
    return df


def distinct_students(df: pd.DataFrame) -> int:
    return int(df["students"].dropna().str.split(",").explode().str.strip().nunique())

#test function for basic stat
