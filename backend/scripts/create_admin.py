"""
makes an approved admin account (or promotes an existing one), since the site itself can only make students/tutors.

run from backend/:
    uv run scripts/create_admin.py --email admin@example.com --name "Excel Admin"

password is asked for in the terminal so it doesnt end up in your shell history
"""
import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from postgrest.exceptions import APIError

from db import sb


def find_profile(email: str):
    rows = sb.table("profiles").select("id, full_name, role, approved").eq("email", email).execute().data
    return rows[0] if rows else None


def ask_password() -> str:
    while True:
        pw = getpass.getpass("password for the new account (min 6 chars): ")
        if len(pw) < 6:
            print("too short, try again")
        elif pw != getpass.getpass("again: "):
            print("didnt match, try again")
        else:
            return pw


def main():
    parser = argparse.ArgumentParser(description="create or promote an excel club admin")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Excel Admin")
    args = parser.parse_args()
    email = args.email.strip().lower()

    profile = find_profile(email)
    if profile:
        print(f"{email} already has an account ({profile['full_name']}, {profile['role']}), promoting it")
    else:
        user = sb.auth.admin.create_user({
            "email": email,
            "password": ask_password(),
            "email_confirm": True,   # skip the confirmation email
            # same metadata the sign up form sends, the profiles trigger reads it
            "user_metadata": {"full_name": args.name, "requested_role": "tutor"},
        }).user
        profile = find_profile(email)
        if not profile:
            sys.exit(f"login {user.id} was made but no profiles row showed up, check the sign up trigger in supabase")

    sb.table("profiles").update({"role": "admin", "approved": True}).eq("id", profile["id"]).execute()
    print(f"done, {email} is an approved admin. log in at /html/login.html")


if __name__ == "__main__":
    try:
        main()
    except APIError as e:
        if e.code == "42501":
            sys.exit("supabase said permission denied. run this in the SQL editor first:\n"
                     "  grant select, insert, update, delete on public.profiles to service_role;")
        raise
