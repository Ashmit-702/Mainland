# POST /api/dialogue
# Body: { npc_name, npc_role, player_line, history }
# Returns: { reply }

import json, sys, os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from gemini import generate

FALLBACKS = {
    "Draupadi": "Arjun, the Mainland crumbles. Seek the Brahmastra.",
    "Karna":    "We meet again, Arjun. Prove your worth.",
    "Shakuni":  "Every dungeon is a dice game, son of Pandu.",
    "Gandhari": "I see your path through blindfolded eyes.",
    "Bhima":    "Brother! I cleared half this floor already.",
}

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length))

        npc_name    = body.get("npc_name", "Stranger")
        npc_role    = body.get("npc_role", "wanderer")
        player_line = body.get("player_line", "Hello")
        history     = body.get("history", [])[-6:]

        history_txt = "\n".join(
            f"Arjun: {m['player']}\n{npc_name}: {m['npc']}"
            for m in history
        )
        prompt = (
            f"You are voicing {npc_name}, a {npc_role} figure in Mainland.\n"
            f"Conversation so far:\n{history_txt}\n\n"
            f"Arjun says: \"{player_line}\"\n"
            f"Reply only with {npc_name}'s spoken line, no quotes, no name prefix."
        )

        reply = generate(prompt) or FALLBACKS.get(npc_name, "The wind swallows my words.")

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"reply": reply}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
