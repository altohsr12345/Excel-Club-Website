import os
from pathlib import Path
import math

import numpy as np
import gspread as gs

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

DATA = Path(__file__).resolve().parent / "data"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500","http://127.0.0.1:8000"],
    allow_methods=["GET"]
)
#temporary for now

def parse_duration(val):
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


def load_sessions():
    df = pd.read_csv(DATA / "session.csv")
    df.columns = df.columns.str.strip().str.lower()
    df["minutes"] = df["Duration"].map(parse_duration)

    bad = df["minutes"].isna().sum()
    if bad:
        print(f"WARNING: {bad} rows have an unreadable duration")
    return df

@app.get("/api/stats")
def stats():
    df = load_sessions()
    print(df)
    return {
        "total_sessions": len(df),
        "total_time": round(float(df["Duration"].sum()) / 60, 1),
    }