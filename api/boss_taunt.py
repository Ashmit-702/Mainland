# ─────────────────────────────────────────────
#  POST /api/boss_taunt
#  Body: { boss_name, lore }
#  Returns: { taunt }
# ─────────────────────────────────────────────

import json
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _gemini import generate

FALLBACKS = {
    "Duryodhana": "Your arrows cannot pierce the iron of Hastinapur, Arjun.",
    "Kali":       "You dare enter the age of darkness? I am the darkness.",
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
        body      = json.loads(request.body)
        boss_name = body.get("boss_name", "Demon")
        lore      = body.get("lore", "")

        prompt = (
            f"You are voicing {boss_name}, a fearsome boss in Mainland ({lore}). "
            f"Give a single menacing taunt line under 25 words directed at Arjun "
            f"as the battle begins. Pure dialogue only, no quotes, no name prefix."
        )

        taunt = generate(prompt, max_tokens=60)
        if not taunt:
            taunt = FALLBACKS.get(boss_name, "Face your end, mortal.")

        response.status_code = 200
        response.body = json.dumps({"taunt": taunt})
    except Exception as e:
        response.status_code = 500
        response.body = json.dumps({"error": str(e), "taunt": "Face your end, mortal."})

    return response
