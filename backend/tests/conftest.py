"""Shared fixtures for tests that behave like real users.

These are integration tests: they talk to a running backend (default
http://localhost:8000, override with BASE_URL) the way a browser would. They are
skipped automatically if the server isn't reachable, so they're not part of CI.

    cd backend && ./.venv/bin/uvicorn app.main:app --port 8000   # in one terminal
    cd backend && ./.venv/bin/pytest -v                          # in another
"""

import sys
from pathlib import Path

import pytest
import requests

# Let tests import the app package (used by the AI-scorer tests that need no server)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.helpers import API, BASE, make_pdf, post_job, register  # noqa: E402


@pytest.fixture(scope="session")
def server():
    try:
        requests.get(f"{BASE}/health", timeout=3).raise_for_status()
    except Exception:
        pytest.skip(f"Backend not reachable at {BASE}; start it to run these tests")
    return BASE


@pytest.fixture(scope="session")
def employer1(server):
    return register("employer", company_name="Acme One")


@pytest.fixture(scope="session")
def employer2(server):
    return register("employer", company_name="Rival Two")


@pytest.fixture(scope="session")
def candidate_a(server):
    return register("candidate")


@pytest.fixture(scope="session")
def candidate_b(server):
    return register("candidate")


@pytest.fixture(scope="session")
def job1(employer1):
    return post_job(employer1.headers, "Backend Engineer")


@pytest.fixture(scope="session")
def application_a(candidate_a, job1):
    """Candidate A's application to employer 1's job."""
    r = requests.post(
        f"{API}/applications",
        headers=candidate_a.headers,
        data={"job_id": job1["id"]},
        files={"resume": ("a.pdf", make_pdf("Candidate A. Python and SQL."), "application/pdf")},
    )
    assert r.status_code == 201, r.text
    return r.json()
