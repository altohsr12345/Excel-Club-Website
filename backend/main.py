import os
from pathlib import Path
from typing import Any
import math

import numpy as np
import gspread as gs
import pandas as pd
from fastapi import FastAPI, APIRouter, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

DATA = Path(__file__).resolve().parent / ".."

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000","http://127.0.0.1:8000"],
    allow_methods=["GET"]
)
#temporary origins for now

def parse_duration(val: str):
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



def load_sessions() -> pd.DataFrame:
    df = pd.read_csv(DATA / "sample_sessions.csv")
    print(df)
    df.columns = df.columns.str.strip().str.lower()
    df["minutes"] = df["duration"].map(parse_duration)
    print(df)
    bad = df["minutes"].isna().sum()
    if bad:
        print(f"{bad} unreadable")
    return df


@app.get("/")
def test():
    return "test"

@app.get("/api/stats/overview")
def overview():
    df = load_sessions()
    return {
        "total_sessions": len(df),
        "total_time": round(float(df["minutes"].sum()) / 60, 1),
        "distinct_tutor": int(df["tutor name"].nunique()),
        "distinct_stdts": int
    }
#valueerror??????

@app.get("/api/stats/subject")
def subject(top: int=5):
    df = load_sessions()
    counts = df["subject"].value_counts().head(top)
    return [{"subject": name, "sessions": int(n)} for name, n in counts.items()]
#this works ok test
