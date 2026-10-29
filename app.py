# entrypoint for vercel, which looks for `app = FastAPI(...)` in app.py at the repo root.
# the real app lives in backend/ and imports its modules as top-level names (auth, db, routes...),
# so backend/ goes on the import path, then the whole backend app is mounted under "/".
# locally, keep running uvicorn from backend/ as before
import sys
from pathlib import Path

from fastapi import FastAPI

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from main import app as backend_app  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)  # the backend app has its own /docs
app.mount("/", backend_app)
