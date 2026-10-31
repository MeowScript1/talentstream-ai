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


# ---- one company login, several candidates at once --------------------------

def test_one_employer_login_can_run_separate_interviews_at_the_same_time(server):
    employer = register("employer", company_name=f"Busy{uuid.uuid4().hex[:6]} Co")
    job = post_job(employer.headers, "Role")
    pairs = []
    for _ in range(2):
        candidate = register("candidate")
        app_id = requests.post(
            f"{API}/applications", headers=candidate.headers, data={"job_id": job["id"]}, files={"resume": ("cv.pdf", make_pdf(), "application/pdf")}
        ).json()["id"]
        assert requests.put(f"{API}/applications/{app_id}/video-interview", headers=employer.headers, json={"scheduled_at": _in(5)}).status_code == 200
        pairs.append((candidate, app_id))

    async def run():
        (c1, a1), (c2, a2) = pairs
        async with (
            websockets.connect(f"{WS}/{a1}?token={_token(employer)}") as host1,
            websockets.connect(f"{WS}/{a2}?token={_token(employer)}") as host2,  # the same login, a second room
        ):
            assert json.loads(await host1.recv())["type"] == "waiting"
            assert json.loads(await host2.recv())["type"] == "waiting"  # joining room 2 did not kick the employer out of room 1
            async with (
                websockets.connect(f"{WS}/{a1}?token={_token(c1)}") as guest1,
                websockets.connect(f"{WS}/{a2}?token={_token(c2)}") as guest2,
            ):
                assert json.loads(await guest1.recv())["type"] == "peer-present"
                assert json.loads(await guest2.recv())["type"] == "peer-present"
                assert json.loads(await host1.recv())["type"] == "peer-joined"
                assert json.loads(await host2.recv())["type"] == "peer-joined"
                await host1.send(json.dumps({"type": "offer", "data": {"sdp": "for-candidate-1"}}))
                await host2.send(json.dumps({"type": "offer", "data": {"sdp": "for-candidate-2"}}))
                assert json.loads(await guest1.recv())["data"]["sdp"] == "for-candidate-1"  # each message reaches only its own candidate
                assert json.loads(await guest2.recv())["data"]["sdp"] == "for-candidate-2"

    try:
        asyncio.run(run())
    finally:
        requests.delete(f"{API}/jobs/{job['id']}/close", headers=employer.headers)


# ---- overlap warning --------------------------------------------------------

def _conflicts(employer, app_id, minutes):
    r = requests.get(f"{API}/applications/{app_id}/video-interview/conflicts", headers=employer.headers, params={"scheduled_at": _in(minutes)})
    assert r.status_code == 200, r.text
    return r.json()["conflicts"]


def test_overlapping_interviews_are_flagged_but_still_allowed(server):
    employer = register("employer", company_name=f"Over{uuid.uuid4().hex[:6]} Co")
    job = post_job(employer.headers, "Role")
    apps = []
    for _ in range(3):
        candidate = register("candidate")
        apps.append(
            requests.post(
                f"{API}/applications", headers=candidate.headers, data={"job_id": job["id"]}, files={"resume": ("cv.pdf", make_pdf(), "application/pdf")}
            ).json()["id"]
        )
    try:
        first, second, third = apps
        assert _conflicts(employer, first, 120) == []  # nothing booked yet
        assert requests.put(f"{API}/applications/{first}/video-interview", headers=employer.headers, json={"scheduled_at": _in(120)}).status_code == 200

        near = _conflicts(employer, second, 140)  # 20 minutes later: overlaps
        assert len(near) == 1 and near[0]["candidate_name"] == "Test candidate" and near[0]["job_title"] == "Role"
        assert _conflicts(employer, second, 160) == []  # 40 minutes later: fine
        assert _conflicts(employer, first, 120) == []  # an interview never conflicts with itself

        # it is only a warning: the overlapping time can still be booked
        assert requests.put(f"{API}/applications/{second}/video-interview", headers=employer.headers, json={"scheduled_at": _in(140)}).status_code == 200
        assert len(_conflicts(employer, third, 130)) == 2
    finally:
        requests.delete(f"{API}/jobs/{job['id']}/close", headers=employer.headers)


def test_other_companies_interviews_do_not_count_and_candidates_cannot_ask(interview):
    employer, candidate, app_id = interview  # one interview already booked 5 minutes from now
    stranger = register("employer", company_name=f"Else{uuid.uuid4().hex[:6]} Co")
    other_job = post_job(stranger.headers, "Role")
    other_candidate = register("candidate")
    other_app = requests.post(
        f"{API}/applications", headers=other_candidate.headers, data={"job_id": other_job["id"]}, files={"resume": ("cv.pdf", make_pdf(), "application/pdf")}
    ).json()["id"]
    try:
        assert _conflicts(stranger, other_app, 5) == []  # the first company's booking is not visible to this one
        bad = requests.get(f"{API}/applications/{app_id}/video-interview/conflicts", headers=candidate.headers, params={"scheduled_at": _in(5)})
        assert bad.status_code == 403
        assert requests.get(f"{API}/applications/{app_id}/video-interview/conflicts", headers=stranger.headers, params={"scheduled_at": _in(5)}).status_code == 403
    finally:
        requests.delete(f"{API}/jobs/{other_job['id']}/close", headers=stranger.headers)


# ---- no-shows ---------------------------------------------------------------

from sqlalchemy import select, update  # noqa: E402

from app.models.video_interview import VideoInterview  # noqa: E402
from tests.test_jobfeed import _run_db  # noqa: E402

NOW = datetime(2026, 11, 3, 10, 0, tzinfo=timezone.utc)


def test_a_meeting_is_missed_fifteen_minutes_after_the_start_if_anyone_never_joined():
    joined = NOW
    assert meetings.attendance_state(NOW, None, None, NOW + timedelta(minutes=14))["state"] == "upcoming"
    assert meetings.attendance_state(NOW, None, None, NOW + timedelta(minutes=15)) == {"state": "missed", "absent": ["candidate", "employer"]}
    assert meetings.attendance_state(NOW, joined, None, NOW + timedelta(minutes=20)) == {"state": "missed", "absent": ["employer"]}
    assert meetings.attendance_state(NOW, None, joined, NOW + timedelta(minutes=20)) == {"state": "missed", "absent": ["candidate"]}
    assert meetings.attendance_state(NOW, joined, joined, NOW + timedelta(minutes=20))["state"] == "completed"


def test_a_missed_meeting_cannot_be_joined():
    assert not meetings.can_join(NOW, NOW + timedelta(minutes=1), "missed")
    assert meetings.can_join(NOW, NOW + timedelta(minutes=1), "upcoming")


def _move(app_id, minutes_from_now, candidate_joined=False, employer_joined=False):
    """Pretend the interview started this many minutes ago/ahead, and that these people joined."""
    async def go(db):
        now = datetime.now(timezone.utc)
        await db.execute(
            update(VideoInterview)
            .where(VideoInterview.application_id == uuid.UUID(app_id))
            .values(
                scheduled_at=now + timedelta(minutes=minutes_from_now),
                candidate_joined_at=now if candidate_joined else None,
                employer_joined_at=now if employer_joined else None,
            )
        )
        await db.commit()

    _run_db(go)


def _state(user, app_id):
    return requests.get(f"{API}/meetings/{app_id}", headers=user.headers).json()


def test_who_joined_is_recorded(interview):
    employer, candidate, app_id = interview

    async def join():
        async with websockets.connect(f"{WS}/{app_id}?token={_token(candidate)}") as ws:
            assert json.loads(await ws.recv())["type"] == "waiting"

    asyncio.run(join())

    async def read(db):
        row = await db.scalar(select(VideoInterview).where(VideoInterview.application_id == uuid.UUID(app_id)))
        return row.candidate_joined_at, row.employer_joined_at

    candidate_at, employer_at = _run_db(read)
    assert candidate_at is not None and employer_at is None


def test_both_screens_show_who_missed_and_the_room_is_closed(interview):
    employer, candidate, app_id = interview
    _move(app_id, -20, employer_joined=True)  # the employer came, the candidate did not
    for user in (employer, candidate):
        info = _state(user, app_id)
        assert info["state"] == "missed" and info["absent"] == ["candidate"] and info["can_join_now"] is False
    mine = requests.get(f"{API}/applications/mine", headers=candidate.headers).json()
    assert next(a for a in mine if a["id"] == app_id)["video_interview"]["state"] == "missed"

    async def refused():
        with pytest.raises(websockets.exceptions.InvalidStatus):
            async with websockets.connect(f"{WS}/{app_id}?token={_token(candidate)}") as ws:
                await ws.recv()

    asyncio.run(refused())


def test_an_employer_no_show_is_not_counted_against_the_candidate(interview):
    employer, candidate, app_id = interview
    _move(app_id, -20, candidate_joined=True)
    assert _state(candidate, app_id)["absent"] == ["employer"]
    status = next(a for a in requests.get(f"{API}/applications/mine", headers=candidate.headers).json() if a["id"] == app_id)["status"]
    assert status != "rejected"  # nothing is rejected automatically


def test_rescheduling_a_missed_interview_starts_fresh(interview):
    employer, candidate, app_id = interview
    _move(app_id, -20)
    assert _state(candidate, app_id)["state"] == "missed"
    assert requests.put(f"{API}/applications/{app_id}/video-interview", headers=employer.headers, json={"scheduled_at": _in(5)}).status_code == 200
    info = _state(candidate, app_id)
    assert info["state"] == "upcoming" and info["can_join_now"] is True


def test_an_interview_both_attended_is_completed_not_missed(interview):
    employer, candidate, app_id = interview
    _move(app_id, -20, candidate_joined=True, employer_joined=True)
    assert _state(employer, app_id)["state"] == "completed"
