# POST /api/narrative — atmospheric text (Key 2)
import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = "You are a dark fantasy narrator. Write vivid, present-tense lines under 20 words."

FLOOR_FALLBACKS = {
    1:"Cracked stone breathes beneath your feet. The darkness below is patient.",
    2:"The walls have seen blood. They will see more.",
    3:"Something watches from the shadows. It has been waiting a long time.",
    4:"The air smells of old iron and older death.",
    5:"Every step echoes twice. The second echo is not yours.",
    6:"Duryodhana's rage has warped the stone itself here.",
    7:"The void presses in. Your torch dims without reason.",
    8:"Kali's influence seeps through the walls like ink.",
    9:"The Brahmastra is close. So is the thing guarding it.",
}
DEATH_FALLBACKS = {
    "Asura":"The demon's fire dims to ash.",
    "Rakshasa":"The shape-shifter unravels into shadow.",
    "Naga":"The serpent coils still.",
    "Pishacha":"The phantom shrieks and dissolves.",
    "Vetala":"The night-walker crumbles.",
    "Yaksha":"The guardian spirit shatters.",
    "Duryodhana":"The iron king falls at last.",
    "Kali":"Darkness recoils. The age turns.",
}

def _generate(prompt):
    key = os.environ.get("GEMINI_API_KEY_2","") or os.environ.get("GEMINI_API_KEY","")
    if not key: return ""
    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt,
            config={"system_instruction":SYSTEM_PROMPT,"max_output_tokens":50,"temperature":0.85}
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(f"Narrative error: {e}"); return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length",0))
            body   = json.loads(self.rfile.read(length))
            kind   = body.get("kind","floor")

            if kind == "floor":
                n    = int(body.get("floor_number",1))
                zone = body.get("zone_name","The Ruins")
                text = _generate(f"Describe entering floor {n} of '{zone}' in a mythic dungeon. Under 20 words, second person, present tense.") \
                       or FLOOR_FALLBACKS.get(n, "Darkness deepens around you.")

            elif kind == "item":
                name = body.get("item_name","Relic")
                desc = body.get("item_desc","")
                text = _generate(f"One line (under 15 words): Arjun finds '{name}' ({desc}) in a dark dungeon.") \
                       or f"Your hand closes around the {name}."

            elif kind == "death":
                name = body.get("enemy_name","Demon")
                text = _generate(f"One poetic line under 10 words: a {name} dies in a mythic dungeon.") \
                       or DEATH_FALLBACKS.get(name,"The demon falls.")
            else:
                text = "Silence."

            self.send_response(200); self._cors()
            self.send_header("Content-Type","application/json"); self.end_headers()
            self.wfile.write(json.dumps({"text":text}).encode())
        except Exception as e:
            print(f"Handler error: {e}")
            self.send_response(200); self._cors()
            self.send_header("Content-Type","application/json"); self.end_headers()
            self.wfile.write(json.dumps({"text":""}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
        self.send_header("Access-Control-Allow-Methods","POST, OPTIONS")
    def log_message(self,*a): pass
