import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

sb = create_client(os.environ["SB_URL"],os.environ["SB_SECRET_KEY"])