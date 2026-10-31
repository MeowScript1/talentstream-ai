"""Signalling for video meetings.

The two people's browsers set up a direct, encrypted call. This server only passes the setup messages
(offer, answer, network candidates) between them and tells each side when the other arrives or leaves.
It never sees or records the video or audio.

Rooms are kept in this process's memory, which is right for one server instance. Running several instances
would need a shared channel (for example Redis) so both people reach the same room.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.meetings import load_meeting
from app.core.database import get_db
from app.core.dependencies import get_user_from_token
from app.services.meetings import can_join

router = APIRouter(prefix="/ws", tags=["websockets"])

RELAYED = {"offer", "answer", "ice"}
MAX_MESSAGE_BYTES = 20_000

# application id -> {user id -> websocket}
rooms: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = {}


async def _send(ws: WebSocket, payload: dict) -> None:
    try:
        await ws.send_json(payload)
    except Exception:
        pass  # the other side is already gone; its own disconnect handler cleans up


@router.websocket("/meeting/{application_id}")
async def meeting_socket(websocket: WebSocket, application_id: uuid.UUID, token: str, db: AsyncSession = Depends(get_db)):
    user = await get_user_from_token(token, db)
    if user is None:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return
    try:
        _, video = await load_meeting(db, application_id, user)
    except HTTPException:
        await websocket.close(code=1008, reason="Not your meeting")
        return
    scheduled_at = video.scheduled_at
    user_id = user.id
    await db.close()  # nothing else needs the database while the call is open

    if not can_join(scheduled_at, datetime.now(timezone.utc)):
        await websocket.close(code=1008, reason="The room is not open right now")
        return

    await websocket.accept()
    room = rooms.setdefault(application_id, {})
    previous = room.get(user_id)
    if previous is not None:  # the same person joined again (new tab or a reconnect): the newest one wins
        await _send(previous, {"type": "replaced"})
        try:
            await previous.close(code=1000)
        except Exception:
            pass
    room[user_id] = websocket

    others = [ws for uid, ws in room.items() if uid != user_id]
    if others:
        await _send(websocket, {"type": "peer-present"})  # the other person was here first: wait for their offer
        await _send(others[0], {"type": "peer-joined"})  # they start the call
    else:
        await _send(websocket, {"type": "waiting"})

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw) > MAX_MESSAGE_BYTES:
                continue
            try:
                message = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(message, dict) or message.get("type") not in RELAYED:
                continue
            for uid, ws in list(room.items()):
                if uid != user_id:
                    await _send(ws, {"type": message["type"], "data": message.get("data")})
    except WebSocketDisconnect:
        pass
    finally:
        if room.get(user_id) is websocket:
            del room[user_id]
            for ws in room.values():
                await _send(ws, {"type": "peer-left"})
        if not room:
            rooms.pop(application_id, None)
