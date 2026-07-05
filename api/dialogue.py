# POST /api/dialogue — NPC dialogue via Gemini (Key 1)
import json, os
from http.server import BaseHTTPRequestHandler

SYSTEM_PROMPT = """You are the narrative engine for "Mainland", a dark mythic action-RPG.
The world draws from Mahabharata mythology but is its own original realm — not a retelling.
Arjun is the player, descending through corrupted dungeon floors to recover the Brahmastra.

NPCs you may voice:
- Draupadi: wise sage, compassionate, knows ancient lore
- Karna: rival warrior, proud, respects strength, gives backhanded help  
- Shakuni: trickster, manipulative, his advice may mislead
- Gandhari: blind oracle, speaks in riddles, sees fate clearly
- Bhima: berserker ally, blunt, enthusiastic, already killed half the floor

Rules:
- Stay in character. Reply under 35 words.
- Mythic tone, gravity, modern readability.
- Never break the fourth wall. Never mention AI.
- Address the player as "Arjun".
"""

FALLBACKS = {
    "Draupadi": "Arjun, the Brahmastra lies deeper in the dark. The path is clear — your resolve must match it.",
    "Karna":    "Still alive? Surprising. The next floor will test you harder. Do not disappoint me.",
    "Shakuni":  "Ah, the Pandava prince. The treasure is close — or perhaps I lie. You decide.",
    "Gandhari": "I see without eyes, Arjun. Your fate glows ahead — bright and violent.",
    "Bhima":    "Brother! I left three alive for you. Seemed fair. Go finish them.",
}

def _get_key():
    return os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY_1", "")

def _generate(prompt):
    key = _get_key()
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
        print(f"Dialogue API error: {e}"); return ""

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body        = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        npc_name    = body.get("npc_name", "Stranger")
        npc_role    = body.get("npc_role", "wanderer")
        player_line = body.get("player_line", "")
        history     = body.get("history", [])[-6:]
        floor_number= body.get("floor_number", 1)
        player_level= body.get("player_level", 1)

        history_txt = "\n".join(
            f"Arjun: {m['player']}\n{npc_name}: {m['npc']}" for m in history)

        prompt = (
            f"You are voicing {npc_name} ({npc_role}) in Mainland.\n"
            f"Context: Arjun is on floor {floor_number}, level {player_level}.\n"
            f"Prior exchange:\n{history_txt}\n\n"
            f"Arjun says: \"{player_line}\"\n"
            f"Reply as {npc_name} only. No name prefix. Under 35 words."
        )

        reply = _generate(prompt) or FALLBACKS.get(npc_name, "The dungeon's winds swallow my words.")
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"reply": reply}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    def log_message(self, *a): pass
