import os
from pathlib import Path
from typing import Any
import math

import numpy as np
import gspread as gs
import pandas as pd
from cachetools.func import ttl_cache
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client



DATA = Path(__file__).resolve().parent / ".."
STAFF = ("tutor", "admin")

load_dotenv()
sb = create_client(os.environ["SB_URL"],os.environ["SB_SECRET_KEY"])

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000","http://127.0.0.1:8000"],
    allow_methods=["*"],
    allow_headers=["*"]
)
#temporary origins for now

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
            raise HTTPException(403, "account awaiting approval")
        if profile["role"] not in roles:
            raise HTTPException(403, "not allowed")
        return profile

    return checker

#just for the stupid gsheets duration structure
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

@ttl_cache(ttl=300)
def load_sessions() -> pd.DataFrame:
    df = pd.read_csv(DATA / "sample_sessions.csv")
    df = df.dropna(subset=["tutor name"])
    df.columns = df.columns.str.strip().str.lower()
    df["minutes"] = df["duration"].map(parse_duration)
    bad = df["minutes"].isna().sum()
    if bad:
        print(f"{bad} unreadable")
    return df



#api routes

@app.get("/")
def test():
    return "test"

@app.get("/api/me")
def me(profile=Depends(get_current_profile)):
    return profile

@app.get("/api/my/sessions")
def my_sessions(profile=Depends(require_role("student", *STAFF))):
    df = load_sessions()
    mine = df[df["Students"].fillna("").str.contains(profile["full_name"], regex=False)]
    cols = ["Planned Date", "Tutor Name", "Subject", "Duration"]
    return mine[cols].fillna("").to_dict(orient="records")


@app.get("/api/stats/overview")
def overview():
    df = load_sessions()
    return {
        "total_sessions": len(df),
        "total_time": round(float(df["minutes"].sum()) / 60, 1),
        "distinct_tutor": int(df["tutor name"].nunique()),
        "distinct_stdts": int(df["students"].nunique())
    }


@app.get("/api/stats/subject")   #for admins
def subject_stats(profile=Depends(require_role(*STAFF)),top: int=5):
    df = load_sessions()
    counts = df["subject"].value_counts().head(top)
    return [{"subject": name, "sessions": int(n)} for name, n in counts.items()]
#this works ok test

@app.get("/api/admin/pending")
def pending(profile=Depends(require_role("admin"))):
    return (sb.table("profiles")
              .select("id, full_name, email, requested_role, created_at")
              .eq("approved", False).execute().data)

class Approval(BaseModel):
    user_id: str
    role: str

@app.post("/api/admin/approve")
def approve(body: Approval, profile=Depends(require_role("admin"))):
    if body.role not in ("student", "tutor", "admin"):
        raise HTTPException(400, "Bad role")
    sb.table("profiles").update({"role": body.role, "approved": True}) \
      .eq("id", body.user_id).execute()
    return {"ok": True}