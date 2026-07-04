import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = (
    "You are the narrative engine for 'Mainland', a dark mythic action-RPG set in a fractured ancient realm. "
    "The world draws from pan-Indian myth and folklore — spirits, demons, celestials — but is its own original world, not a retelling of any epic. "
    "The player is Arjun, a warrior chosen by unknown forces to cleanse the Mainland of ancient evil. "
    "Stay in character as the NPC you voice. Reply under 35 words. "
    "Speak with gravity and mythic weight. Never break the fourth wall. Never mention being an AI."
)

FALLBACKS = {
    "Savitri":   "Traveller, the roots of the Mainland rot beneath your feet. Seek the source.",
    "Vikrama":   "I have mapped every floor of this ruin. What do you need to know?",
    "Chanaksha": "Every demon here has a weakness. Intelligence is your sharpest weapon.",
    "Revati":    "The threads of your fate glow strangely, warrior. You are meant to be here.",
    "Bheema":    "Still alive? Good. I left a few of them for you — not many.",
    "Tara":      "Rest. I can close wounds this dungeon leaves behind.",
}

def _generate(prompt):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key: return ""
    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": 100, "temperature": 0.9}
        )
        return (resp.text or "").strip().strip('"')
    except Exception as e:
        print(e); return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body        = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        npc_name    = body.get("npc_name", "Stranger")
        npc_role    = body.get("npc_role", "wanderer")
        player_line = body.get("player_line", "Hello")
        history     = body.get("history", [])[-6:]
        history_txt = "\n".join(f"Arjun: {m['player']}\n{npc_name}: {m['npc']}" for m in history)
        prompt = (
            f"You are voicing {npc_name}, a {npc_role} encountered deep in the Mainland.\n"
            f"Prior exchange:\n{history_txt}\n\n"
            f"Arjun says: \"{player_line}\"\n"
            f"Respond only as {npc_name}. No name prefix. Under 35 words."
        )
        reply = _generate(prompt) or FALLBACKS.get(npc_name, "The dungeon's whispers swallow my words.")
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"reply": reply}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
