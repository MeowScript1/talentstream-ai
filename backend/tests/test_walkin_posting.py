"""Employers posting walk-in drives, and how those drives show up for candidates."""

import uuid
from datetime import timedelta

import pytest
import requests

from app.core.timeutil import local_today
from tests.helpers import API, make_pdf


def _drive(days_ahead=1, **overrides):
    start = local_today() + timedelta(days=days_ahead)
    body = {
        "kind": "walkin",
        "title": f"Walk-in Customer Support {uuid.uuid4().hex[:6]}",
        "description": "Walk-in drive for customer support executives. Responsibilities: handle calls and resolve queries. Requirements: good communication.",
        "requirements": ["communication"],
        "job_type": "full_time",
        "location": "Hyderabad",
        "walkin_date": start.isoformat(),
        "walkin_start_time": "10:00:00",
        "walkin_end_time": "16:00:00",
        "venue": "Plot 12, Hitech City, Hyderabad 500081",
        "walkin_notes": "Bring your resume and a photo ID. Ask for HR at reception.",
    }
    body.update(overrides)
    return body


@pytest.fixture
def post(employer1):
    """Post jobs as employer 1 and close them afterwards so they don't linger in the shared feed."""
    created = []

    def _post(body, headers=None):
        r = requests.post(f"{API}/jobs", headers=headers or employer1.headers, json=body)
        if r.status_code == 201:
            created.append(r.json()["id"])
        return r

    yield _post
    for job_id in created:
        requests.delete(f"{API}/jobs/{job_id}/close", headers=employer1.headers)


def _walkins(**params):
    r = requests.get(f"{API}/feed/jobs", params={"kind": "walkin", "limit": 50, **params})
    assert r.status_code == 200, r.text
    return r.json()


def test_employer_can_post_a_walkin_drive(post):
    r = post(_drive())
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["kind"] == "walkin" and job["venue"].startswith("Plot 12")
    assert job["walkin_start_time"] == "10:00:00" and job["walkin_end_time"] == "16:00:00"


@pytest.mark.parametrize(
    "overrides,expected",
    [
        ({"venue": None}, "venue"),
        ({"venue": "Hyd"}, "venue address"),
        ({"walkin_date": None}, "date"),
        ({"walkin_start_time": None}, "start time"),
        ({"walkin_date": (local_today() - timedelta(days=1)).isoformat()}, "past"),
        ({"walkin_date": (local_today() + timedelta(days=120)).isoformat()}, "90 days"),
        ({"walkin_end_date": (local_today() - timedelta(days=1)).isoformat()}, "before the first day"),
        ({"walkin_end_date": (local_today() + timedelta(days=40)).isoformat()}, "at most"),
        ({"walkin_end_time": "09:00:00"}, "after the start"),
    ],
)
def test_a_walkin_needs_everything_a_candidate_needs_to_turn_up(post, overrides, expected):
    r = post(_drive(**overrides))
    assert r.status_code == 422
    assert expected in r.text


def test_online_jobs_carry_no_walkin_details(post):
    r = post(_drive(kind="apply", venue="Somewhere that should be ignored"))
    assert r.status_code == 201
    assert r.json()["kind"] == "apply" and r.json()["venue"] is None and r.json()["walkin_date"] is None


def test_only_employers_can_post_walkins(candidate_a):
    assert requests.post(f"{API}/jobs", headers=candidate_a.headers, json=_drive()).status_code == 403


@pytest.mark.parametrize("kind", ["walkin", "apply"])
def test_posts_that_ask_for_money_are_refused(post, kind):
    r = post(_drive(kind=kind, description="Walk-in drive. Selected candidates must pay a refundable registration fee of Rs 2000 before joining."))
    assert r.status_code == 422
    assert "can't ask candidates for money" in r.text
    ok = post(_drive(kind=kind, description="We never charge any registration fee. Responsibilities: handle calls. Requirements: communication."))
    assert ok.status_code == 201  # saying there is no fee is fine


def test_walkins_stay_out_of_the_online_job_list_but_employers_still_see_them(post, employer1):
    job = post(_drive()).json()
    public = requests.get(f"{API}/jobs", params={"limit": 100}).json()
    assert job["id"] not in [j["id"] for j in public]
    mine = requests.get(f"{API}/jobs/mine", headers=employer1.headers).json()
    assert job["id"] in [j["id"] for j in mine]


def test_a_posted_walkin_shows_up_in_the_walkin_tab(post):
    title = f"Walk-in zzwk {uuid.uuid4().hex[:6]}"
    post(_drive(days_ahead=2, title=title))
    items = [j for j in _walkins(q=title)["items"]]
    assert len(items) == 1
    j = items[0]
    assert j["native"] is True and j["source_label"] == "TalentStream" and j["kind"] == "walkin"
    assert j["walkin_date"] == (local_today() + timedelta(days=2)).isoformat()
    assert j["walkin_time"] == "10:00 AM – 4:00 PM"
    assert j["walkin_start_time"] == "10:00" and j["walkin_end_time"] == "16:00"
    assert "Hitech City" in j["venue"] and "photo ID" in j["notes"]
    assert j["url"].startswith("https://www.google.com/maps/search/") and "Hitech" in j["url"]
    assert j["trust_label"] in ("looks_good", "be_careful") and j["trust_reasons"]


def test_only_drives_in_the_next_seven_days_are_listed(post):
    soon = f"zzsoon {uuid.uuid4().hex[:6]}"
    later = f"zzlater {uuid.uuid4().hex[:6]}"
    post(_drive(days_ahead=7, title=soon))
    post(_drive(days_ahead=8, title=later))
    assert len(_walkins(q=soon)["items"]) == 1
    assert _walkins(q=later)["items"] == []


def test_a_drive_that_already_started_is_shown_as_on_now(post):
    title = f"zzongoing {uuid.uuid4().hex[:6]}"
    post(_drive(days_ahead=0, title=title, walkin_end_date=(local_today() + timedelta(days=3)).isoformat()))
    j = _walkins(q=title)["items"][0]
    assert j["walkin_date"] == local_today().isoformat()
    assert j["walkin_end_date"] == (local_today() + timedelta(days=3)).isoformat()


def test_the_soonest_drive_comes_first(post):
    tag = uuid.uuid4().hex[:6]
    post(_drive(days_ahead=5, title=f"zzorder later {tag}"))
    post(_drive(days_ahead=1, title=f"zzorder sooner {tag}"))
    titles = [j["title"] for j in _walkins(q="zzorder")["items"] if tag in j["title"]]
    assert titles == [f"zzorder sooner {tag}", f"zzorder later {tag}"]


def test_search_finds_drives_by_venue_and_city(post):
    unique = f"Zzvenue{uuid.uuid4().hex[:6]}"
    post(_drive(venue=f"{unique} Business Park, Whitefield, Bengaluru", location="Bengaluru"))
    assert len(_walkins(q=unique)["items"]) == 1
    assert len(_walkins(q=unique, location="Bengaluru")["items"]) == 1
    assert _walkins(q=unique, location="Mumbai")["items"] == []


def test_closed_drives_disappear(post, employer1):
    title = f"zzclosed {uuid.uuid4().hex[:6]}"
    job = post(_drive(title=title)).json()
    assert len(_walkins(q=title)["items"]) == 1
    requests.delete(f"{API}/jobs/{job['id']}/close", headers=employer1.headers)
    assert _walkins(q=title)["items"] == []


def test_nobody_can_apply_to_a_walkin(post, candidate_a):
    job = post(_drive()).json()
    requests.post(
        f"{API}/users/me/resume", headers=candidate_a.headers, files={"resume": ("r.pdf", make_pdf("Candidate. Python."), "application/pdf")}
    ).raise_for_status()
    r = requests.post(f"{API}/applications", headers=candidate_a.headers, data={"job_id": job["id"]})
    assert r.status_code == 400 and "walk-in" in r.text


def test_the_walkin_count_includes_posted_drives(post):
    before = requests.get(f"{API}/feed/stats").json()["walkin_jobs_next_7_days"]
    post(_drive(title=f"zzcount {uuid.uuid4().hex[:6]}"))
    after = requests.get(f"{API}/feed/stats").json()["walkin_jobs_next_7_days"]
    assert after == before + 1


def test_employers_can_edit_a_drive_but_not_into_something_invalid(post, employer1, employer2):
    job = post(_drive()).json()
    ok = requests.patch(f"{API}/jobs/{job['id']}", headers=employer1.headers, json={"venue": "New Venue, Tower B, Gachibowli, Hyderabad"})
    assert ok.status_code == 200 and ok.json()["venue"].startswith("New Venue")
    bad = requests.patch(f"{API}/jobs/{job['id']}", headers=employer1.headers, json={"walkin_date": (local_today() - timedelta(days=2)).isoformat()})
    assert bad.status_code == 422
    other = requests.patch(f"{API}/jobs/{job['id']}", headers=employer2.headers, json={"venue": "Hijacked venue address"})
    assert other.status_code == 403
