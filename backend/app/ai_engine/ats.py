import json

from google.genai import types

from app.ai_engine.client import get_client
from app.core.config import settings

MODEL_ID = 'gemini-2.5-flash-lite'

def parse_ats_json(text: str) -> dict:
    try:
        # Strip markdown fences if Gemini still returns them despite the prompt
        if text.startswith('```json'):
            text = text[7:]
        elif text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
            
        result = json.loads(text.strip())
        
        # Ensure minimum schema
        return {
            "score": max(0, min(100, int(result.get("score", 0)))),
            "skills_matched": result.get("skills_matched", []),
            "skills_missing": result.get("skills_missing", []),
            "summary": result.get("summary", ""),
            "candidate_feedback": result.get("candidate_feedback", "")
        }
    except Exception as e:
        print(f"Failed to parse ATS response: {e}")
        return {
            "score": 0,
            "skills_matched": [],
            "skills_missing": [],
            "summary": "Parsing error from AI response.",
            "candidate_feedback": "We encountered an issue scoring your resume."
        }

async def score_resume(resume_text: str, job_title: str, job_description: str, requirements: list[str]) -> dict:
    api_key = settings.GOOGLE_API_KEY
    if not api_key or api_key.startswith("your_") or len(api_key) < 10:
        # Fallback if no valid API key is provided
        return {
            "score": 50,
            "skills_matched": [],
            "skills_missing": requirements,
            "summary": "AI scoring disabled (No valid API Key configured). Add your GOOGLE_API_KEY to backend/.env",
            "candidate_feedback": "AI scoring is not configured yet. Please ask the admin to add a Google Gemini API key."
        }
    
    from app.ai_engine.prompts import ATS_SYSTEM_PROMPT, ATS_USER_PROMPT_TEMPLATE
        
    prompt = ATS_USER_PROMPT_TEMPLATE.format(
        job_title=job_title,
        job_description=job_description,
        requirements=", ".join(requirements),
        resume_text=resume_text
    )
    
    try:
        response = await get_client().aio.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=ATS_SYSTEM_PROMPT,
                temperature=0.1,  # Low temperature for consistent scoring
            )
        )
        return parse_ats_json(response.text)
    except Exception as e:
        print(f"ATS generation failed: {e}")
        return {
            "score": 0,
            "skills_matched": [],
            "skills_missing": requirements,
            "summary": f"AI service error: {str(e)}",
            "candidate_feedback": "We encountered an issue scoring your resume."
        }
