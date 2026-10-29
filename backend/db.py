import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# backend/.env locally, whatever folder you start from. on vercel there's no file and
# the keys come from the project's environment variables instead
load_dotenv(Path(__file__).resolve().parent / ".env")

sb = create_client(os.environ["SB_URL"],os.environ["SB_SECRET_KEY"])