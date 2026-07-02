import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = "You are the narrative engine for Mainland, a mythic RPG. The player is Arjun. Stay in character, reply under 35 words, mythic tone, never break the fourth wall."

FALLBACKS = {
    "Draupadi": "Arjun, the Mainland crumbles. Seek the Brahmastra.",
    "Karna":    "We meet again, Arjun. Prove your worth.",
    "Shakuni":  "Every dungeon is a dice game, son of Pandu.",
    "Gandhari": "I see your path through blindfolded eyes.",
    "Bhima":    "Brother! I cleared half this floor already.",
}

def _generate(prompt):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return ""
    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": 100, "temperature": 0.9}
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(e)
        return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        body        = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        npc_name    = body.get("npc_name", "Stranger")
        npc_role    = body.get("npc_role", "wanderer")
        player_line = body.get("player_line", "Hello")
        history     = body.get("history", [])[-6:]
        history_txt = "\n".join(f"Arjun: {m['player']}\n{npc_name}: {m['npc']}" for m in history)
        prompt      = f"You are {npc_name}, a {npc_role}.\n{history_txt}\nArjun: \"{player_line}\"\nReply as {npc_name} only, no name prefix."
        reply       = _generate(prompt) or FALLBACKS.get(npc_name, "The winds drown my words, Arjun.")
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"reply": reply}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
