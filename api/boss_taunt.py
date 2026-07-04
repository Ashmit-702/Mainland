import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = "You are the narrative engine for 'Mainland', a dark mythic RPG. Voice bosses with menace and ancient gravitas. Under 25 words. No name prefix."

FALLBACKS = {
    "Vritra":        "You carry the light of a dying realm, warrior. Let me extinguish it.",
    "Mahishasura":   "Three realms bent to my darkness. You are merely the fourth.",
}

def _generate(prompt):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key: return ""
    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": 60, "temperature": 0.9}
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(e); return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body      = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        boss_name = body.get("boss_name", "Demon")
        lore      = body.get("lore", "")
        prompt    = f"You are {boss_name} ({lore}). One menacing battle-opening taunt under 25 words directed at Arjun. No name prefix."
        taunt     = _generate(prompt) or FALLBACKS.get(boss_name, "Your blood will feed the dark, warrior.")
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"taunt": taunt}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
