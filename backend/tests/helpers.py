import os
import uuid
from dataclasses import dataclass

import fitz
import requests

BASE = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE}/api/v1"
PASSWORD = "Passw0rd!23"


@dataclass
class Account:
    id: str
    email: str
    headers: dict


def register(role: str, **extra) -> Account:
    email = f"{role}-{uuid.uuid4().hex[:10]}@test.dev"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": f"Test {role}", "role": role, **extra},
    )
    r.raise_for_status()
    body = r.json()
    return Account(body["user"]["id"], email, {"Authorization": f"Bearer {body['access_token']}"})


def make_pdf(text: str = "Jane Doe. Python, SQL, React.") -> bytes:
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def post_job(headers: dict, title: str = "Engineer") -> dict:
    r = requests.post(
        f"{API}/jobs",
        headers=headers,
        json={
            "title": title,
            "description": "Build and ship things with Python.",
            "requirements": ["python"],
            "job_type": "full_time",
        },
    )
    r.raise_for_status()
    return r.json()
