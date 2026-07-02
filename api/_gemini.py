# ─────────────────────────────────────────────
#  Shared Gemini helper — imported by all API functions
# ─────────────────────────────────────────────
import os
from google import genai

SYSTEM_PROMPT = """You are the narrative engine for "Mainland", an action-RPG
set in a fractured mythic version of ancient India.
The player character is Arjun, a Pandava warrior searching for the Brahmastra.

Rules:
- Stay strictly in-character as the NPC or entity you are voicing.
- Keep every reply under 35 words.
- Speak with gravity and a mythic tone, readable for a modern player.
- Never break the fourth wall or mention you are an AI.
- Reference the player as "Arjun".
"""

MODEL = "gemini-2.0-flash"


def get_client():
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    return genai.Client(api_key=key)


def generate(prompt: str, max_tokens: int = 100) -> str:
    client = get_client()
    if not client:
        return ""
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "max_output_tokens": max_tokens,
                "temperature": 0.9,
            },
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(f"Gemini error: {e}")
        return ""
