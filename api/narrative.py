# POST /api/narrative — Floor entry + item lore + enemy death lines (Key 2)
import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = """You are the atmospheric narrator for "Mainland", a mythic dungeon RPG.
You write short, vivid, present-tense lines — like a dark fantasy novel's chapter opener.
Always under 25 words. Evocative, specific, haunting."""

FLOOR_FALLBACKS = {
    1: "Cracked stone breathes under your feet. Something old stirs below.",
    2: "The walls remember blood. Yours is next, if you hesitate.",
    3: "A deeper cold. The torches don't flicker here — the air is already dead.",
    4: "The crypts smell of old offerings. The bones here were once warriors.",
    5: "Something watches from the dark corners. You feel it before you see it.",
    6: "The floor trembles. Below, Duryodhana's rage has warped the stone itself.",
    7: "The void touches everything here. Your bow feels lighter. Your breath, heavier.",
    8: "Kali's influence seeps through the walls like ink. Stay sharp.",
    9: "The final depth. The Brahmastra's pull is unmistakable. So is the darkness guarding it.",
}

DEATH_FALLBACKS = {
    "Asura":    "A demon's last fire dims.",
    "Rakshasa": "The shape-shifter unravels into shadow.",
    "Naga":     "The serpent coils still, then silence.",
    "Pishacha": "The phantom shrieks and dissolves.",
    "Vetala":   "The night-walker crumbles to ash.",
    "Yaksha":   "The guardian spirit shatters like glass.",
}

def _get_key():
    return (os.environ.get("GEMINI_API_KEY_2", "") or
            os.environ.get("GEMINI_API_KEY", "") or
            os.environ.get("GEMINI_API_KEY_1", ""))

def _generate(prompt, tokens=60):
    key = _get_key()
    if not key: return ""
    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": tokens, "temperature": 0.85}
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(f"Narrative API error: {e}"); return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        kind = body.get("kind", "floor")

        if kind == "floor":
            floor_number = body.get("floor_number", 1)
            zone_name    = body.get("zone_name", "The Ruins")
            prompt = (f"Write a one-sentence atmospheric description (under 25 words) "
                      f"for floor {floor_number} of '{zone_name}' in a mythic Indian dungeon. "
                      f"Present tense, second person, haunting.")
            text = _generate(prompt) or FLOOR_FALLBACKS.get(floor_number, "The dark deepens around you.")

        elif kind == "item":
            item_name = body.get("item_name", "Relic")
            item_desc = body.get("item_desc", "")
            prompt = (f"One vivid sentence (under 20 words) about Arjun finding '{item_name}' ({item_desc}) "
                      f"in a dark dungeon. Mythic tone.")
            text = _generate(prompt, tokens=50) or f"Your hand closes around the {item_name}."

        elif kind == "death":
            enemy_name = body.get("enemy_name", "Demon")
            prompt = (f"One short poetic line (under 12 words) describing a {enemy_name} dying "
                      f"in a mythic dungeon. No dialogue.")
            text = _generate(prompt, tokens=30) or DEATH_FALLBACKS.get(enemy_name, "The demon falls.")

        else:
            text = "The darkness answers with silence."

        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"text": text}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    def log_message(self, *a): pass
