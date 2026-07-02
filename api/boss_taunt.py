# POST /api/boss_taunt
# Body: { boss_name, lore }
# Returns: { taunt }

import json, sys, os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from gemini import generate

FALLBACKS = {
    "Duryodhana": "Your arrows cannot pierce the iron of Hastinapur, Arjun.",
    "Kali":       "You dare enter the age of darkness? I am the darkness.",
}

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length))

        boss_name = body.get("boss_name", "Demon")
        lore      = body.get("lore", "")

        prompt = (
            f"You are voicing {boss_name}, a fearsome boss in Mainland ({lore}). "
            f"Give a single menacing taunt under 25 words directed at Arjun. "
            f"Pure dialogue only, no quotes, no name prefix."
        )

        taunt = generate(prompt, max_tokens=60) or FALLBACKS.get(boss_name, "Face your end, mortal.")

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"taunt": taunt}).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
