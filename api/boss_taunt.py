# POST /api/boss_taunt — Boss taunts via Gemini (Key 1)
import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = """You voice bosses in "Mainland", a mythic RPG.
Duryodhana: iron-willed, proud, contemptuous of Arjun, kingly menace.
Kali: ancient, cosmic evil, speaks of eras and darkness, not personal.
Reply under 25 words. Pure menace. No name prefix."""

FALLBACKS = {
    "Duryodhana": "You carry Pandu's weakness in your blood, Arjun. Today I end that bloodline.",
    "Kali":       "I am the age of darkness made flesh. You are a candle in a hurricane.",
}

def _generate(prompt):
    key = os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY_1", "")
    if not key: return ""
    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": 60, "temperature": 0.95}
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(f"Boss taunt error: {e}"); return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body      = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        boss_name = body.get("boss_name", "Demon")
        lore      = body.get("lore", "")
        phase     = body.get("phase", 1)
        prompt    = (f"You are {boss_name}. {'Phase 2 — you are enraged, wounded, furious.' if phase==2 else 'Battle opening taunt.'} "
                     f"One line under 25 words to Arjun. No name prefix.")
        taunt = _generate(prompt) or FALLBACKS.get(boss_name, "Your blood will feed the dark.")
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"taunt": taunt}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    def log_message(self, *a): pass
