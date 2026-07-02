# ─────────────────────────────────────────────
#  POST /api/dialogue
#  Body: { npc_name, npc_role, player_line, history: [{player,npc}] }
#  Returns: { reply }
# ─────────────────────────────────────────────

import json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from gemini import generate

FALLBACKS = {
    "Draupadi": "Arjun, the Mainland crumbles. Seek the Brahmastra.",
    "Karna":    "We meet again, Arjun. Prove your worth.",
    "Shakuni":  "Every dungeon is a dice game, son of Pandu.",
    "Gandhari": "I see your path through blindfolded eyes.",
    "Bhima":    "Brother! I cleared half this floor already.",
}


def handler(request, response):
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.status_code = 204
        return response

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Content-Type"] = "application/json"

    try:
        body = json.loads(request.body)
        npc_name   = body.get("npc_name", "Stranger")
        npc_role   = body.get("npc_role", "wanderer")
        player_line = body.get("player_line", "Hello")
        history    = body.get("history", [])[-6:]   # cap context

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

        reply = generate(prompt)
        if not reply:
            reply = FALLBACKS.get(npc_name, "The wind swallows my words, Arjun.")

        response.status_code = 200
        response.body = json.dumps({"reply": reply})
    except Exception as e:
        response.status_code = 500
        response.body = json.dumps({"error": str(e), "reply": "..."})

    return response
