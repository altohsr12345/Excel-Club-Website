from pathlib import Path
import math
from pickle import FALSE

import numpy as np
import gspread as gs
import pandas as pd
from cachetools.func import ttl_cache
from fastapi import FastAPI, APIRouter, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from auth import get_current_profile, require_role, STAFF, ROLES
from datafuncs import load_sessions
from db import sb



  #for sample sessions

app = FastAPI(title="excel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000","http://127.0.0.1:8000","http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["*"],
    allow_headers=["*"]
)
#temporary origins for now


#api routes, gonna shove them into routers

@app.get("/", include_in_schema=False)
def home():
    return RedirectResponse("/html/index.html")

@app.get("/api/me")
def me(profile=Depends(get_current_profile)):
    return profile

@app.get("/api/my/sessions")
def my_sessions(profile=Depends(require_role("student", *STAFF))):
    df = load_sessions()
    mine = df[df["students"].fillna("").str.contains(profile["full_name"], regex=False)]
    cols = ["planned date", "tutor name", "subject", "duration"]
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


#temp stuff for testing will fix later bruh this is so messy
from fastapi.staticfiles import StaticFiles

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")