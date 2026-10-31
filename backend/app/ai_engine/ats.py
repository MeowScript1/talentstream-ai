import json
import re

from google.genai import types

from app.ai_engine.client import get_client
from app.core.config import settings

# A real resume is a few thousand characters. Anything beyond this is padding or an attack,
# and it would be billed by the model on every score and re-score.
MAX_RESUME_CHARS = 20_000

_RESUME_TAG = re.compile(r"</?\s*resume\s*>", re.IGNORECASE)


def prepare_resume_text(text: str) -> str:
    """Cap the size and stop the text from closing the <resume> fence early."""
    return _RESUME_TAG.sub("", text)[:MAX_RESUME_CHARS]

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
        return _unavailable([])

def _unavailable(requirements: list[str]) -> dict:
    """The AI could not score this resume. No score is made up and no technical error text is shown."""
    return {
        "failed": True,
        "score": None,
        "skills_matched": [],
        "skills_missing": requirements,
        "summary": "Automatic scoring is not available right now. Use Re-score to try again later.",
        "candidate_feedback": "Your resume could not be scored just now. The employer can still read it.",
    }


async def score_resume(resume_text: str, job_title: str, job_description: str, requirements: list[str]) -> dict:
    api_key = settings.GOOGLE_API_KEY
    if not api_key or api_key.startswith("your_") or len(api_key) < 10:
        # No valid API key: say so instead of inventing a score
        return _unavailable(requirements)
    
    from app.ai_engine.prompts import ATS_SYSTEM_PROMPT, ATS_USER_PROMPT_TEMPLATE
        
    prompt = ATS_USER_PROMPT_TEMPLATE.format(
        job_title=job_title,
        job_description=job_description,
        requirements=", ".join(requirements),
        resume_text=prepare_resume_text(resume_text)
    )
    
    try:
        response = await get_client().aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=ATS_SYSTEM_PROMPT,
                temperature=0.1,  # Low temperature for consistent scoring
            )
        )
        return parse_ats_json(response.text)
    except Exception as e:
        print(f"ATS generation failed: {e}")
        return _unavailable(requirements)
