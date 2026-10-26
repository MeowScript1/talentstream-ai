import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_user_from_token
from app.models.interview import Interview
from app.models.application import Application
from google.genai import types
from app.ai_engine.client import get_client

router = APIRouter(prefix="/ws", tags=["websockets"])

MODEL_ID = 'gemini-2.5-flash-lite'

SYSTEM_PROMPT = """
You are an expert AI recruiter conducting a technical interview for the position of {job_title}.
The candidate's resume summary is: {resume_summary}

Conduct the interview professionally. Ask one question at a time.
Wait for the candidate's response. Evaluate it, then ask the next question or follow-up.
Keep your responses concise and conversational.
Do not ask more than 5 main questions.
When you are done with the interview, clearly say: "[INTERVIEW_COMPLETE]"
"""

# Store active connections
active_connections = {}

@router.websocket("/interview/{application_id}")
async def websocket_endpoint(websocket: WebSocket, application_id: uuid.UUID, token: str, db: AsyncSession = Depends(get_db)):
    # Authenticate and authorize before accepting, so a rejected client only
    # sees a failed handshake. Missing application and someone else's
    # application get the same answer to avoid leaking which IDs exist.
    user = await get_user_from_token(token, db)
    if user is None:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    res_app = await db.execute(
        select(Application).where(Application.id == application_id).options(selectinload(Application.job))
    )
    app_ref = res_app.scalar_one_or_none()
    if app_ref is None or app_ref.candidate_id != user.id:
        await websocket.close(code=1008, reason="Not authorized for this interview")
        return

    await websocket.accept()

    result = await db.execute(select(Interview).where(Interview.application_id == application_id))
    interview = result.scalar_one_or_none()

    if not interview:
        # Create interview record if it doesn't exist
        interview = Interview(
            application_id=application_id,
            status='in_progress',
            started_at=datetime.utcnow()
        )
        db.add(interview)
        await db.commit()
        await db.refresh(interview)
        
    if interview.status == 'completed':
        await websocket.send_json({"type": "system", "text": "This interview has already been completed."})
        await websocket.close(code=1000)
        return

    # Initialize chat with system prompt
    sys_prompt = SYSTEM_PROMPT.format(
        job_title=app_ref.job.title,
        resume_summary=app_ref.ats_summary or "No summary available."
    )
    
    # Send initial prompt to get the AI's first greeting
    try:
        # Create an async chat session with the new SDK
        chat = get_client().aio.chats.create(
            model=MODEL_ID,
            config=types.GenerateContentConfig(
                system_instruction=sys_prompt,
            )
        )
        initial_response = await chat.send_message(
            "Start the interview by greeting the candidate and asking the first question."
        )
        
        # Send AI's first greeting to user
        msg_text = initial_response.text
        interview.transcript.append({"role": "ai", "content": msg_text})
        await db.commit()
        await websocket.send_json({"type": "message", "role": "ai", "text": msg_text})
        
    except Exception as e:
        print(f"Failed to start AI chat: {e}")
        await websocket.send_json({"type": "system", "text": "Failed to connect to AI interviewer."})
        await websocket.close(code=1011)
        return

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("type") == "message":
                user_msg = payload.get("text", "")
                
                # Save user message
                interview.transcript.append({"role": "user", "content": user_msg})
                # Using flag_modified because SQLAlchemy json column mutations aren't auto-detected easily without it
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(interview, "transcript")
                await db.commit()
                
                # Send to AI
                try:
                    ai_response = await chat.send_message(user_msg)
                    ai_text = ai_response.text
                    
                    if "[INTERVIEW_COMPLETE]" in ai_text:
                        ai_text = ai_text.replace("[INTERVIEW_COMPLETE]", "").strip()
                        interview.status = 'completed'
                        interview.completed_at = datetime.utcnow()
                        
                        # In a real app, trigger a background task to evaluate the entire transcript and generate score/feedback
                        interview.ai_score = 85 # Mock score
                        interview.ai_feedback = "Strong technical answers, good communication."
                        
                    interview.transcript.append({"role": "ai", "content": ai_text})
                    flag_modified(interview, "transcript")
                    await db.commit()
                    
                    await websocket.send_json({"type": "message", "role": "ai", "text": ai_text})
                    
                    if interview.status == 'completed':
                        await websocket.send_json({"type": "system", "text": "Interview completed. Thank you!"})
                        await websocket.close(code=1000)
                        break
                        
                except Exception as e:
                    print(f"AI error: {e}")
                    await websocket.send_json({"type": "error", "text": "The AI interviewer encountered an error. Please try again."})
                    
    except WebSocketDisconnect:
        # Save state on disconnect
        print(f"Client disconnected from interview {application_id}")
