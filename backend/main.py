import os
from pathlib import Path


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from routes import account, admin, stats



app = FastAPI(title="excel API")


#CORS doesnt rlly matter if frontend is served from the same address as the API lol
origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5500,http://127.0.0.1:5500",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(account.router)
app.include_router(admin.router)
app.include_router(stats.router)



#api routes, gonna shove them into routes

@app.get("/", include_in_schema=False)
def home():
    return RedirectResponse("/html/index.html")

#temp stuff for testing will fix later bruh this is so messy

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")