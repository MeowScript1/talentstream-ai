"""Tests for the job feed: walk-in detection, the real-vs-fake trust scorer, the source parsers, and the API.

The first groups are pure (no server needed). The API group needs the running backend and its
database, like the other integration tests.
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
import requests
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.jobfeed import ingest
from app.jobfeed.sources import adzuna, remoteok, remotive
from app.jobfeed.text import dedupe_key, html_to_text
from app.jobfeed.trust import GOOD_THRESHOLD, RISKY_THRESHOLD, assess
from app.jobfeed.types import RawJob
from app.jobfeed.walkin import detect_walkin
from tests.helpers import API, register

TODAY = date(2026, 10, 26)
NOW = datetime(2026, 10, 26, tzinfo=timezone.utc)
RECENT = NOW - timedelta(days=3)
GOOD_DESC = (
    "About us: Acme builds payment software. Responsibilities: design and build APIs, review code, mentor juniors. "
    "Requirements: 5+ years of experience with TypeScript and Postgres. Benefits: remote-first, learning budget. "
) * 3


# ─────────────────────────────────────────────────────────────────────────────
# Walk-in detection
# ─────────────────────────────────────────────────────────────────────────────

def _days(text):
    info = detect_walkin(text, TODAY)
    return None if info is None else [d.isoformat() for d in info.dates]


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Walk-in Interview\nDate: 28th Oct 2026\nTime: 10:00 AM to 4:00 PM", ["2026-10-28"]),
        ("WALK IN DRIVE from 27-29 October 2026", ["2026-10-27", "2026-10-28", "2026-10-29"]),
        ("Walkin interviews on Oct 30th. Location: MG Road", ["2026-10-30"]),
        ("Walk-in on 29/10/2026 between 9am-1pm", ["2026-10-29"]),
        ("Urgent walk-in hiring tomorrow", ["2026-10-27"]),
        ("Walk in interview: 2 November, 9:30 AM - 12:30 PM", ["2026-11-02"]),
        ("Walk in interview 5th Nov 2026 10am to 1pm", ["2026-11-05"]),  # "Nov 2026" must not become "Nov 20"
        ("Walkin on October 30, 2026 at our office", ["2026-10-30"]),
    ],
)
def test_walkin_dates_are_read_correctly(text, expected):
    assert _days(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "Remote Python developer. Interview on 28 Oct 2026 via Zoom.",  # not a walk-in
        "Apply online only. No walk-ins please. Interview on 28 Oct.",  # explicitly not
        "",
    ],
)
def test_non_walkins_are_ignored(text):
    assert detect_walkin(text, TODAY) is None


def test_only_the_next_seven_days_count():
    info = detect_walkin("Walk-in on 20 December 2026", TODAY)
    assert info.within(TODAY, 7) == [] and info.first_upcoming(TODAY) == date(2026, 12, 20)
    assert detect_walkin("Walk-in drive was held on 12 October 2026", TODAY).first_upcoming(TODAY) is None
    assert detect_walkin("Walk-in on 2 November", TODAY).within(TODAY, 7) == [date(2026, 11, 2)]
    assert detect_walkin("Walk-in on 3 November", TODAY).within(TODAY, 7) == []  # 8 days away


def test_the_word_may_is_not_a_month():
    assert _days("Walk-in for freshers. Candidates may 10 apply anytime") == []


def test_walkin_time_and_venue_are_extracted():
    info = detect_walkin("Walk-in 28 Oct 2026\nTime: 10:00 AM to 4:00 PM\nVenue: Plot 12, Hitech City, Hyderabad", TODAY)
    assert info.time == "10:00 AM – 4:00 PM"
    assert info.venue == "Plot 12, Hitech City, Hyderabad"


# ─────────────────────────────────────────────────────────────────────────────
# Real vs fake
# ─────────────────────────────────────────────────────────────────────────────

def _job(**kw):
    base = dict(source="adzuna", external_id="1", title="Backend Engineer", url="https://boards.greenhouse.io/acme/jobs/1",
                company="Acme Corp", location="Bengaluru", description=GOOD_DESC, posted_at=RECENT)
    base.update(kw)
    return RawJob(**base)


def test_normal_listings_look_good():
    for job in (
        _job(),
        _job(url="https://careers.zomato.com/jobs/45", company="Zomato"),
        _job(source="remotive", url="https://remotive.com/remote-jobs/x", company="Klardaten"),
    ):
        result = assess(job, NOW)
        assert result.label == "looks_good" and result.score >= GOOD_THRESHOLD, result


@pytest.mark.parametrize(
    "title,desc,url,company",
    [
        ("DATA ENTRY - WORK FROM HOME!!!", "Urgent hiring! Earn Rs 50,000 per week. Pay Rs 2,000 registration fee (refundable). WhatsApp +91 98765 43210. Mail hr.jobs@gmail.com", "https://bit.ly/3xYzAb", "Hiring"),
        ("Customer Care Executive", "Direct joining, no interview. Salary 25000. WhatsApp your CV to 9876543210 or mail ravi@gmail.com for instant offer letter.", "https://example-jobs.in/1", "Confidential"),
        ("Typist", "Selected candidates must pay a security deposit of Rs 5000 before joining.", "https://jobs.example/9", "Reputed company"),
        ("Online Task Worker", "Guaranteed income of 30000 a week. No experience required. Contact us on Telegram to apply.", "https://t.me/x", None),
    ],
)
def test_scams_are_flagged(title, desc, url, company):
    result = assess(_job(title=title, description=desc, url=url, company=company), NOW)
    assert result.label == "likely_scam" and result.score < RISKY_THRESHOLD, result


def test_asking_for_money_caps_the_score_whatever_else_looks_good():
    result = assess(_job(description=GOOD_DESC + " A refundable security deposit is required.", source="remotive"), NOW)
    assert result.score <= 25 and result.label == "likely_scam"
    assert result.reasons[0].code == "asks_for_money"


@pytest.mark.parametrize(
    "desc",
    [
        GOOD_DESC + " We never charge any registration fee or deposit from candidates.",
        GOOD_DESC + " You will own provider configuration and reduce card processing fees and processing cost.",
        GOOD_DESC + " We do not conduct interviews over WhatsApp, Telegram, or SMS. Beware of scams.",
        GOOD_DESC + " Run campaigns across email, in-app and Telegram.",
    ],
)
def test_legitimate_wording_is_not_mistaken_for_a_scam(desc):
    assert assess(_job(description=desc), NOW).label == "looks_good"


def test_every_judgement_comes_with_reasons_sorted_by_weight():
    result = assess(_job(company=None, description="Sales role. Good salary."), NOW)
    assert result.reasons
    impacts = [abs(r.impact) for r in result.reasons]
    assert impacts == sorted(impacts, reverse=True)
    assert all(r.text for r in result.reasons)


def test_stale_postings_lose_trust():
    fresh = assess(_job(), NOW).score
    old = assess(_job(posted_at=NOW - timedelta(days=150)), NOW).score
    assert old < fresh


# ─────────────────────────────────────────────────────────────────────────────
# Sources and helpers (saved sample payloads shaped like the real APIs)
# ─────────────────────────────────────────────────────────────────────────────

def test_html_is_turned_into_readable_text():
    text = html_to_text("<p>Hello <b>team</b></p><ul><li>One</li><li>Two</li></ul><script>x()</script>")
    assert "Hello team" in text and "• One" in text and "• Two" in text and "x()" not in text


def test_same_job_on_two_platforms_gets_the_same_key():
    assert dedupe_key("Acme Corp", "Backend Engineer", "Bengaluru, India") == dedupe_key("ACME CORP.", "backend  engineer", "bengaluru")
    assert dedupe_key("Acme", "Backend Engineer", "Pune") != dedupe_key("Other Co", "Backend Engineer", "Pune")


def test_remotive_payload_is_parsed():
    jobs = remotive.parse({"0-legal-notice": "x", "jobs": [
        {"id": 7, "url": "https://remotive.com/remote-jobs/x-7", "title": " AI Trainer ", "company_name": "iMerit", "tags": ["AI"],
         "publication_date": "2026-10-22T18:40:19", "candidate_required_location": "Worldwide", "salary": "70K-80K", "description": "<p>Label videos</p>"},
        {"id": None, "title": "broken"},
    ]})
    assert len(jobs) == 1
    j = jobs[0]
    assert (j.source, j.external_id, j.title, j.company, j.remote) == ("remotive", "7", "AI Trainer", "iMerit", True)
    assert j.url == "https://remotive.com/remote-jobs/x-7" and j.posted_at.tzinfo is not None and j.description == "Label videos"


def test_remoteok_payload_skips_the_legal_notice_and_links_back():
    jobs = remoteok.parse([
        {"last_updated": 1, "legal": "API Terms of Service..."},
        {"id": "9", "position": "Engineer", "company": "Klardaten", "url": "https://remoteOK.com/remote-jobs/9", "apply_url": "https://remoteOK.com/apply/9",
         "date": "2026-10-25T12:34:21+00:00", "salary_min": 80000, "salary_max": 100000, "verified": True, "tags": ["dev"], "description": "<p>x</p>"},
    ])
    assert len(jobs) == 1 and jobs[0].verified_by_source and jobs[0].url == "https://remoteOK.com/remote-jobs/9"
    assert jobs[0].salary_text == "$80,000 – $100,000"


def test_adzuna_payload_is_parsed():
    jobs = adzuna.parse({"results": [
        {"id": "55", "title": "Walk-in Executive", "description": "Walk-in interview", "company": {"display_name": "Acme"},
         "location": {"display_name": "Hyderabad"}, "redirect_url": "https://www.adzuna.in/land/ad/55", "created": "2026-10-24T08:00:00Z",
         "salary_min": 300000, "salary_max": 400000, "salary_is_predicted": "0", "category": {"label": "Sales"}, "contract_time": "full_time"},
        {"id": "56", "title": "Predicted salary job", "redirect_url": "https://www.adzuna.in/land/ad/56", "salary_min": 1, "salary_max": 2, "salary_is_predicted": "1"},
    ]})
    assert len(jobs) == 2
    assert jobs[0].company == "Acme" and jobs[0].location == "Hyderabad" and jobs[0].salary_text
    assert jobs[1].salary_text is None  # Adzuna's own estimate is not shown as the employer's salary


def test_remote_jobs_are_never_walkins_but_listed_walkins_are():
    remote = ingest.to_row(_job(remote=True, description="Walk-in on 28 Oct 2026"), TODAY, NOW)
    assert remote["kind"] == "apply"
    local = ingest.to_row(_job(title="Walk-in Executive", description="Walk-in interview on 28 Oct 2026, 10 AM to 4 PM. Venue: Hitech City, Hyderabad"), TODAY, NOW)
    assert local["kind"] == "walkin" and local["walkin_date"] == date(2026, 10, 28)
    assert local["walkin_time"] == "10 AM – 4 PM" and "Hitech City" in local["venue"]


# ─────────────────────────────────────────────────────────────────────────────
# API (needs the running backend)
# ─────────────────────────────────────────────────────────────────────────────

def _run_db(coro_fn):
    """Run a database action on a throwaway engine (the app's engine belongs to the server's event loop)."""
    async def go():
        engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as db:
                return await coro_fn(db)
        finally:
            await engine.dispose()
    return asyncio.run(go())


@pytest.fixture
def sample_feed(server):
    """Store a walk-in, a normal job and a scam under a throwaway source name, then clean up."""
    source = f"test_{uuid.uuid4().hex[:8]}"
    today = datetime.now(ZoneInfo(settings.FEED_TIMEZONE)).date()
    soon = today + timedelta(days=2)
    soon_text = f"{soon.day} {soon.strftime('%B %Y')}"
    jobs = [
        RawJob(source, "walkin-1", "Walk-in Customer Support Executive", "https://example.com/w1", "Acme Corp", "Hyderabad",
               f"Walk-in interview on {soon_text}, 10 AM to 4 PM. Venue: Hitech City, Hyderabad. Responsibilities and requirements: " + GOOD_DESC, RECENT),
        RawJob(source, "apply-1", "Platform Engineer zzqx", "https://boards.greenhouse.io/acme/jobs/2", "Acme Corp", "Pune", GOOD_DESC, RECENT),
        RawJob(source, "scam-1", "Typing Job zzqx", "https://bit.ly/abc", "Hiring", "Delhi",
               "Pay Rs 2,000 registration fee. WhatsApp your CV to 9876543210. Earn 50,000 per week!!!", RECENT),
    ]
    now = datetime.now(timezone.utc)
    rows = [ingest.to_row(j, today, now) for j in jobs]

    async def put(db):
        await ingest.store(db, rows)
        await db.commit()

    async def drop(db):
        from sqlalchemy import delete

        from app.models.external_job import ExternalJob
        await db.execute(delete(ExternalJob).where(ExternalJob.source == source))
        await db.commit()

    _run_db(put)
    yield source
    _run_db(drop)


def _titles(params):
    r = requests.get(f"{API}/feed/jobs", params={"limit": 50, **params})
    assert r.status_code == 200, r.text
    return r.json()


def test_feed_is_public_no_login_needed(server):
    assert requests.get(f"{API}/feed/jobs").status_code == 200
    assert requests.get(f"{API}/feed/stats").status_code == 200


def test_walkin_tab_shows_only_drives_in_the_next_seven_days(sample_feed):
    data = _titles({"kind": "walkin", "q": "Customer Support"})
    walkins = [j for j in data["items"] if j["source"] == sample_feed]
    assert len(walkins) == 1
    j = walkins[0]
    assert j["kind"] == "walkin" and j["walkin_time"] == "10 AM – 4 PM" and "Hitech City" in j["venue"]
    assert j["trust_label"] == "looks_good"


def test_apply_tab_hides_scams_by_default_but_can_show_them(sample_feed):
    default = _titles({"kind": "apply", "q": "zzqx"})
    assert [j["title"] for j in default["items"]] == ["Platform Engineer zzqx"]
    assert default["hidden_risky"] == 1
    everything = _titles({"kind": "apply", "q": "zzqx", "include_risky": "true"})
    labels = {j["title"]: j["trust_label"] for j in everything["items"]}
    assert labels["Typing Job zzqx"] == "likely_scam" and labels["Platform Engineer zzqx"] == "looks_good"


def test_each_listing_links_back_to_its_source_and_explains_its_rating(sample_feed):
    job = _titles({"q": "Platform Engineer zzqx"})["items"][0]
    assert job["url"].startswith("https://") and job["source_label"]
    assert job["trust_reasons"] and all(r["text"] for r in job["trust_reasons"])


def test_reporting_needs_login_and_enough_reports_hide_a_job(sample_feed):
    target = _titles({"q": "Platform Engineer zzqx"})["items"][0]["id"]
    assert requests.post(f"{API}/feed/jobs/{target}/report", json={}).status_code == 401

    reporters = [register("candidate") for _ in range(3)]
    first = requests.post(f"{API}/feed/jobs/{target}/report", headers=reporters[0].headers, json={"reason": "Asked me for money"})
    assert first.status_code == 200 and first.json()["hidden"] is False
    again = requests.post(f"{API}/feed/jobs/{target}/report", headers=reporters[0].headers, json={})
    assert again.status_code == 409  # one report per person

    requests.post(f"{API}/feed/jobs/{target}/report", headers=reporters[1].headers, json={})
    last = requests.post(f"{API}/feed/jobs/{target}/report", headers=reporters[2].headers, json={})
    assert last.json()["hidden"] is True
    assert _titles({"q": "Platform Engineer zzqx"})["total"] == 0


def test_forcing_a_refresh_needs_the_secret_token(server):
    r = requests.post(f"{API}/feed/refresh")
    assert r.status_code == 403
    assert requests.post(f"{API}/feed/refresh", headers={"X-Ingest-Token": "wrong"}).status_code == 403


def test_venue_is_found_in_the_middle_of_a_sentence_too():
    info = detect_walkin("Walk-in on 28 Oct 2026. Venue: Plot 12, Hitech City, Hyderabad. Bring your resume and ID proof.", TODAY)
    assert info.venue == "Plot 12, Hitech City, Hyderabad"
    piped = detect_walkin("WALK IN DRIVE 28 Oct 2026 | 11 am - 3 pm | Address: Whitefield, Bengaluru | Contact HR", TODAY)
    assert piped.venue == "Whitefield, Bengaluru"


def test_broken_encoding_from_a_feed_is_repaired():
    assert html_to_text("<p>Full-timeÂ Permanent</p>") == "Full-time Permanent"
    assert html_to_text("<p>We do not interview over WhatsApp.Â Beware of scams.</p>") == "We do not interview over WhatsApp. Beware of scams."
    assert html_to_text("<p>Donâ€™t pay anything</p>") == "Don’t pay anything"
    assert html_to_text("<p>Café résumé</p>") == "Café résumé"  # correct text is left alone


@pytest.mark.parametrize(
    "broken,fixed",
    [
        ("Based in the EU Â· Remote", "Based in the EU · Remote"),
        ("GartnerÂ® Magic Quadrant", "Gartner® Magic Quadrant"),
        ("United Kingdom: Â£134,600", "United Kingdom: £134,600"),
        ("desde LATAM, Â¡queremos", "desde LATAM, ¡queremos"),
        ("cafÃ© and Ã±", "café and ñ"),
        ("Ação em São Paulo, ÂÃO", "Ação em São Paulo, ÂÃO"),  # genuine accented text must not be touched
    ],
)
def test_more_broken_encodings_are_repaired(broken, fixed):
    assert html_to_text(f"<p>{broken}</p>") == fixed
