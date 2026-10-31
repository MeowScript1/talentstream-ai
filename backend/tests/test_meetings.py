"""Video meetings inside TalentStream: who can join and when, and that the two people reach each other."""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
import websockets

from app.ai_engine import ats
from app.services import meetings
from tests.helpers import API, BASE, make_pdf, post_job, register

WS = BASE.replace("http", "ws", 1) + "/api/v1/ws/meeting"


def _in(minutes):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


# ---- the rules --------------------------------------------------------------

def test_room_opens_ten_minutes_early_and_closes_after_three_hours():
    start = datetime(2026, 11, 3, 10, 0, tzinfo=timezone.utc)
    assert not meetings.can_join(start, start - timedelta(minutes=11))
    assert meetings.can_join(start, start - timedelta(minutes=10))
    assert meetings.can_join(start, start + timedelta(hours=3))
    assert not meetings.can_join(start, start + timedelta(hours=3, minutes=1))


def test_stun_is_always_offered_and_turn_only_when_fully_configured(monkeypatch):
    assert "stun:" in meetings.ice_servers()[0]["urls"][0] and len(meetings.ice_servers()) == 1
    monkeypatch.setattr(meetings.settings, "TURN_URLS", "turn:relay.example.com:3478, turns:relay.example.com:443")
    assert len(meetings.ice_servers()) == 1  # no credentials yet
    monkeypatch.setattr(meetings.settings, "TURN_USERNAME", "u")
    monkeypatch.setattr(meetings.settings, "TURN_CREDENTIAL", "p")
    turn = meetings.ice_servers()[1]
    assert turn["urls"] == ["turn:relay.example.com:3478", "turns:relay.example.com:443"] and turn["username"] == "u"


# ---- setup ------------------------------------------------------------------

@pytest.fixture
def interview(server):
    """An employer and candidate with a video interview that starts in 5 minutes (so the room is open)."""
    employer = register("employer", company_name=f"Room{uuid.uuid4().hex[:6]} Co")
    candidate = register("candidate")
    job = post_job(employer.headers, "Role")
    app_id = requests.post(
        f"{API}/applications", headers=candidate.headers, data={"job_id": job["id"]}, files={"resume": ("cv.pdf", make_pdf(), "application/pdf")}
    ).json()["id"]
    r = requests.put(f"{API}/applications/{app_id}/video-interview", headers=employer.headers, json={"scheduled_at": _in(5)})
    assert r.status_code == 200, r.text
    yield employer, candidate, app_id
    requests.delete(f"{API}/jobs/{job['id']}/close", headers=employer.headers)


def _token(user):
    return user.headers["Authorization"].split()[1]


# ---- details ----------------------------------------------------------------

def test_both_sides_get_meeting_details_and_nobody_else_does(interview):
    employer, candidate, app_id = interview
    mine = requests.get(f"{API}/meetings/{app_id}", headers=candidate.headers).json()
    assert mine["role"] == "candidate" and mine["can_join_now"] is True and mine["ice_servers"][0]["urls"]
    assert mine["other_name"].startswith("Room")  # the company they will meet
    theirs = requests.get(f"{API}/meetings/{app_id}", headers=employer.headers).json()
    assert theirs["role"] == "employer" and theirs["other_name"] == "Test candidate"
    assert requests.get(f"{API}/meetings/{app_id}", headers=register("candidate").headers).status_code == 404
    assert requests.get(f"{API}/meetings/{app_id}", headers=register("employer").headers).status_code == 404
    assert requests.get(f"{API}/meetings/{app_id}").status_code == 401


def test_a_meeting_far_in_the_future_is_not_open_yet(interview):
    employer, candidate, app_id = interview
    requests.put(f"{API}/applications/{app_id}/video-interview", headers=employer.headers, json={"scheduled_at": _in(60 * 26)})
    assert requests.get(f"{API}/meetings/{app_id}", headers=candidate.headers).json()["can_join_now"] is False


# ---- signalling -------------------------------------------------------------

def test_the_two_people_find_each_other_and_exchange_setup_messages(interview):
    employer, candidate, app_id = interview

    async def run():
        async with websockets.connect(f"{WS}/{app_id}?token={_token(employer)}") as host:
            assert json.loads(await host.recv())["type"] == "waiting"
            async with websockets.connect(f"{WS}/{app_id}?token={_token(candidate)}") as guest:
                assert json.loads(await guest.recv())["type"] == "peer-present"
                assert json.loads(await host.recv())["type"] == "peer-joined"  # the one who was first starts the call
                await host.send(json.dumps({"type": "offer", "data": {"sdp": "fake-offer"}}))
                assert json.loads(await guest.recv()) == {"type": "offer", "data": {"sdp": "fake-offer"}}
                await guest.send(json.dumps({"type": "answer", "data": {"sdp": "fake-answer"}}))
                assert json.loads(await host.recv())["type"] == "answer"
                await guest.send(json.dumps({"type": "ice", "data": {"candidate": "x"}}))
                assert json.loads(await host.recv())["type"] == "ice"
                await guest.send(json.dumps({"type": "something-else", "data": 1}))  # unknown kinds are not passed on
                await host.send(json.dumps({"type": "ice", "data": {"candidate": "y"}}))
                assert json.loads(await guest.recv())["data"]["candidate"] == "y"
            assert json.loads(await host.recv())["type"] == "peer-left"

    asyncio.run(run())


def test_strangers_and_closed_rooms_are_turned_away(interview):
    employer, candidate, app_id = interview

    async def refused(url):
        with pytest.raises(websockets.exceptions.InvalidStatus):
            async with websockets.connect(url) as ws:
                await ws.recv()

    async def run():
        await refused(f"{WS}/{app_id}?token={_token(register('candidate'))}")
        await refused(f"{WS}/{app_id}?token=not-a-token")
        await refused(f"{WS}/{uuid.uuid4()}?token={_token(candidate)}")
        requests.put(f"{API}/applications/{app_id}/video-interview", headers=employer.headers, json={"scheduled_at": _in(60 * 30)})
        await refused(f"{WS}/{app_id}?token={_token(candidate)}")  # scheduled too far ahead: the room is closed

    asyncio.run(run())


def test_joining_again_replaces_the_old_connection(interview):
    _, candidate, app_id = interview

    async def run():
        async with websockets.connect(f"{WS}/{app_id}?token={_token(candidate)}") as first:
            assert json.loads(await first.recv())["type"] == "waiting"
            async with websockets.connect(f"{WS}/{app_id}?token={_token(candidate)}") as second:
                assert json.loads(await second.recv())["type"] == "waiting"
                assert json.loads(await first.recv())["type"] == "replaced"

    asyncio.run(run())


# ---- AI scoring never invents a score ---------------------------------------

def test_failed_scoring_is_unscored_with_no_raw_error_text(monkeypatch):
    monkeypatch.setattr(ats.settings, "GOOGLE_API_KEY", "x" * 30)

    class Boom:
        class aio:
            class models:
                @staticmethod
                async def generate_content(**kw):
                    raise RuntimeError("404 NOT_FOUND: model retired")

    monkeypatch.setattr(ats, "get_client", lambda: Boom())
    out = asyncio.run(ats.score_resume("Python developer", "Engineer", "Build APIs", ["python"]))
    assert out["failed"] is True and out["score"] is None
    assert "404" not in out["summary"] and "NOT_FOUND" not in out["summary"]


def test_no_key_means_unscored_not_a_made_up_fifty(monkeypatch):
    monkeypatch.setattr(ats.settings, "GOOGLE_API_KEY", "")
    out = asyncio.run(ats.score_resume("Python developer", "Engineer", "Build APIs", ["python"]))
    assert out["failed"] is True and out["score"] is None


def test_the_model_name_comes_from_settings():
    assert ats.settings.GEMINI_MODEL and "2.5" not in ats.settings.GEMINI_MODEL
