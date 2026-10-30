"""Company check, employer response rate, walk-in alerts and reporter points: real numbers or an honest "not enough data"."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from sqlalchemy import delete

from app.core.config import settings
from app.jobfeed.places import canonical_city
from app.models.application import Application
from app.models.external_job import ExternalJob, JobReport
from app.models.job import Job
from app.services.trust_stats import rank_for, response_summary
from tests.helpers import API, make_pdf, post_job, register
from tests.test_jobfeed import _run_db
from tests.test_walkin_posting import _drive

NOW = datetime.now(timezone.utc)


# ---- pure rules -------------------------------------------------------------

def test_response_rate_needs_enough_applications():
    assert response_summary(4, 4, [1, 2, 3])["response_rate"] is None
    assert response_summary(5, 4, [])["response_rate"] == 80


def test_decision_speed_needs_a_few_decisions():
    assert response_summary(10, 2, [1, 3])["median_days_to_decision"] is None
    assert response_summary(10, 3, [1, 2, 9])["median_days_to_decision"] == 2


def test_ranks_climb_with_points():
    assert rank_for(0) == {"rank": "New reporter", "next_rank_at": 5}
    assert rank_for(5)["rank"] == "Scout"
    assert rank_for(49) == {"rank": "Senior scout", "next_rank_at": 50}
    assert rank_for(500) == {"rank": "Lead scout", "next_rank_at": None}


def test_city_names_are_stored_the_same_way():
    assert canonical_city("bangalore") == "Bengaluru"
    assert canonical_city("  pune ") == "Pune"
    assert canonical_city("some small town") == "Some Small Town"


# ---- company check ----------------------------------------------------------

@pytest.fixture
def seeded_company(server):
    name = f"Zyx{uuid.uuid4().hex[:6]} Traders"
    ids = []

    async def add(db):
        for i, (label, reports) in enumerate([("looks_good", 0), ("likely_scam", 4)]):
            job = ExternalJob(
                source="test_company", external_id=f"{name}-{i}", title="Role", company=name, url="https://example.com",
                trust_score=80 if label == "looks_good" else 10, trust_label=label, report_count=reports,
                dedupe_key=uuid.uuid4().hex,
            )
            db.add(job)
            await db.flush()
            ids.append(job.id)
        await db.commit()

    _run_db(add)
    yield name, ids

    async def clean(db):
        await db.execute(delete(ExternalJob).where(ExternalJob.id.in_(ids)))
        await db.commit()

    _run_db(clean)


def test_company_check_summarises_collected_listings(seeded_company):
    name, _ = seeded_company
    r = requests.get(f"{API}/feed/companies", params={"q": name[:8]})
    assert r.status_code == 200
    company = next(c for c in r.json()["results"] if c["name"] == name)
    listings = company["listings"]
    assert listings["total"] == 2 and listings["looks_genuine"] == 1 and listings["likely_fake"] == 1
    assert listings["reports"] == 4
    assert company["on_talentstream"] is None


def test_company_check_rejects_a_one_letter_search():
    assert requests.get(f"{API}/feed/companies", params={"q": "a"}).status_code == 422


# ---- employer response rate -------------------------------------------------

def test_new_employer_shows_no_made_up_response_rate():
    name = f"Fresh{uuid.uuid4().hex[:6]} Hiring"
    employer = register("employer", company_name=name)
    job = post_job(employer.headers, "Role")
    try:
        company = requests.get(f"{API}/feed/companies", params={"q": name}).json()["results"][0]
        stats = company["on_talentstream"]
        assert stats["jobs_posted"] == 1 and stats["applications"] == 0
        assert stats["response_rate"] is None and stats["median_days_to_decision"] is None
    finally:
        requests.delete(f"{API}/jobs/{job['id']}/close", headers=employer.headers)


def test_response_rate_counts_old_applications_and_ignores_new_ones():
    name = f"Rate{uuid.uuid4().hex[:6]} Hiring"
    employer = register("employer", company_name=name)
    job = post_job(employer.headers, "Role")
    candidates = [register("candidate") for _ in range(7)]
    # 5 applications are 10 days old (3 decided, one in 2 days, two in 4 days, one later), 2 are fresh and undecided
    plan = [("shortlisted", 10, 2), ("rejected", 10, 4), ("shortlisted", 10, 4), ("applied", 10, None), ("screening", 10, None),
            ("applied", 1, None), ("applied", 0, None)]

    async def add(db):
        for cand, (status, age, decided_after) in zip(candidates, plan, strict=True):
            created = NOW - timedelta(days=age)
            db.add(Application(
                job_id=uuid.UUID(job["id"]), candidate_id=uuid.UUID(cand.id), resume_url="x", status=status,
                created_at=created, decided_at=created + timedelta(days=decided_after) if decided_after else None,
            ))
        await db.commit()

    _run_db(add)
    try:
        stats = requests.get(f"{API}/feed/companies", params={"q": name}).json()["results"][0]["on_talentstream"]
        assert stats["applications"] == 5 and stats["decided"] == 3
        assert stats["response_rate"] == 60
        assert stats["median_days_to_decision"] == 4
    finally:
        async def clean(db):
            await db.execute(delete(Job).where(Job.id == uuid.UUID(job["id"])))
            await db.commit()

        _run_db(clean)


def test_deciding_on_an_application_records_when():
    employer = register("employer", company_name=f"Dec{uuid.uuid4().hex[:6]}")
    candidate = register("candidate")
    job = post_job(employer.headers, "Role")
    applied = requests.post(
        f"{API}/applications", headers=candidate.headers, data={"job_id": job["id"]}, files={"resume": ("cv.pdf", make_pdf(), "application/pdf")}
    )
    assert applied.status_code == 201, applied.text
    app_id = applied.json()["id"]
    r = requests.patch(f"{API}/applications/{app_id}/status", headers=employer.headers, json={"status": "shortlisted"})
    assert r.status_code == 200

    async def read(db):
        return (await db.get(Application, uuid.UUID(app_id))).decided_at

    assert _run_db(read) is not None
    requests.delete(f"{API}/jobs/{job['id']}/close", headers=employer.headers)


# ---- reporter points --------------------------------------------------------

def test_new_reporter_starts_at_zero():
    r = requests.get(f"{API}/feed/my-reports", headers=register("candidate").headers).json()
    assert r["reports_sent"] == 0 and r["points"] == 0 and r["rank"] == "New reporter"


def test_only_reports_the_community_agreed_with_earn_points():
    user = register("candidate")
    ids = []

    async def add(db):
        for i, count in enumerate([settings.FEED_MAX_REPORTS, 1]):  # one hidden by the community, one reported once
            job = ExternalJob(source="test_pts", external_id=f"{uuid.uuid4().hex}-{i}", title="Role", company="X", url="https://example.com",
                              report_count=count, dedupe_key=uuid.uuid4().hex)
            db.add(job)
            await db.flush()
            ids.append(job.id)
            db.add(JobReport(job_id=job.id, user_id=uuid.UUID(user.id)))
        await db.commit()

    _run_db(add)
    try:
        r = requests.get(f"{API}/feed/my-reports", headers=user.headers).json()
        assert r["reports_sent"] == 2 and r["confirmed"] == 1 and r["points"] == 5 and r["rank"] == "Scout"
    finally:
        async def clean(db):
            await db.execute(delete(ExternalJob).where(ExternalJob.id.in_(ids)))
            await db.commit()

        _run_db(clean)


def test_points_need_a_login():
    assert requests.get(f"{API}/feed/my-reports").status_code == 401


# ---- walk-in alerts ---------------------------------------------------------

def test_alert_lifecycle_and_new_drive_count():
    candidate = register("candidate")
    employer = register("employer", company_name=f"Alert{uuid.uuid4().hex[:6]} Co")
    made = requests.post(f"{API}/alerts", headers=candidate.headers, json={"city": "bangalore"})
    assert made.status_code == 200 and made.json()[0]["city"] == "Bengaluru"
    assert len(requests.post(f"{API}/alerts", headers=candidate.headers, json={"city": "Bengaluru"}).json()) == 1  # same city, one alert
    assert requests.get(f"{API}/alerts/new", headers=candidate.headers).json()["total_new"] == 0

    drive = requests.post(f"{API}/jobs", headers=employer.headers, json=_drive(location="Bangalore", venue="MG Road, Bangalore"))
    assert drive.status_code == 201, drive.text
    try:
        news = requests.get(f"{API}/alerts/new", headers=candidate.headers).json()
        assert news["total_new"] == 1 and news["cities"][0]["city"] == "Bengaluru"
        assert requests.post(f"{API}/alerts/seen", headers=candidate.headers).status_code == 204
        assert requests.get(f"{API}/alerts/new", headers=candidate.headers).json()["total_new"] == 0
    finally:
        requests.delete(f"{API}/jobs/{drive.json()['id']}/close", headers=employer.headers)

    alert_id = requests.get(f"{API}/alerts", headers=candidate.headers).json()[0]["id"]
    assert requests.delete(f"{API}/alerts/{alert_id}", headers=candidate.headers).status_code == 204
    assert requests.get(f"{API}/alerts", headers=candidate.headers).json() == []


def test_a_drive_in_another_city_is_not_news():
    candidate = register("candidate")
    employer = register("employer", company_name=f"Far{uuid.uuid4().hex[:6]} Co")
    requests.post(f"{API}/alerts", headers=candidate.headers, json={"city": "Chennai"})
    drive = requests.post(f"{API}/jobs", headers=employer.headers, json=_drive(location="Pune", venue="FC Road, Pune"))
    try:
        assert requests.get(f"{API}/alerts/new", headers=candidate.headers).json()["total_new"] == 0
    finally:
        requests.delete(f"{API}/jobs/{drive.json()['id']}/close", headers=employer.headers)


def test_alerts_are_private_and_limited():
    a, b = register("candidate"), register("candidate")
    created = requests.post(f"{API}/alerts", headers=a.headers, json={"city": "Delhi"}).json()
    assert requests.delete(f"{API}/alerts/{created[0]['id']}", headers=b.headers).status_code == 404
    for city in ["Mumbai", "Pune", "Noida", "Jaipur"]:
        assert requests.post(f"{API}/alerts", headers=a.headers, json={"city": city}).status_code == 200
    assert requests.post(f"{API}/alerts", headers=a.headers, json={"city": "Indore"}).status_code == 400
    assert requests.get(f"{API}/alerts", headers=register("employer").headers).status_code == 403
    assert requests.get(f"{API}/alerts").status_code == 401
