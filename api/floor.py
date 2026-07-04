# ─────────────────────────────────────────────
#  POST /api/floor
#  Body: { floor_number, seed? }
#  Returns: { rooms, corridors, enemies, npcs, items, player_start, stairs }
#  Dungeon logic is pure Python — same BSP algorithm from the desktop build
# ─────────────────────────────────────────────

import json
import random

COLS = 25
ROWS = 19

FLOOR_TILE = 0
WALL_TILE  = 1
STAIR_TILE = 3

ENEMY_POOL = ["Asura", "Rakshasa", "Naga", "Pishacha", "Vetala", "Yaksha"]
NPC_POOL   = ["Savitri", "Vikrama", "Chanaksha", "Revati", "Bheema", "Tara"]
ITEM_POOL  = ["Amrit", "Vajra", "Kavacha", "SomRas", "Quiver", "Talisman"]
BOSS_MAP   = {3: "Vritra", 6: "Vritra", 9: "Mahishasura"}


class Rect:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    @property
    def cx(self): return self.x + self.w // 2
    @property
    def cy(self): return self.y + self.h // 2

    def inner(self):
        pts = []
        for ry in range(self.y + 1, self.y + self.h - 1):
            for rx in range(self.x + 1, self.x + self.w - 1):
                pts.append((rx, ry))
        return pts

    def random_inner(self):
        rx = random.randint(self.x + 1, self.x + self.w - 2)
        ry = random.randint(self.y + 1, self.y + self.h - 2)
        return (rx, ry)

    def overlaps(self, other, m=1):
        return (self.x - m < other.x + other.w and
                self.x + self.w + m > other.x and
                self.y - m < other.y + other.h and
                self.y + self.h + m > other.y)

    def to_dict(self):
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h,
                "cx": self.cx, "cy": self.cy}


def generate_dungeon(floor_number=1, seed=None):
    if seed is not None:
        random.seed(seed)

    grid = [[WALL_TILE] * COLS for _ in range(ROWS)]
    rooms = []

    for _ in range(100):
        w = random.randint(4, 8)
        h = random.randint(4, 8)
        x = random.randint(1, COLS - w - 1)
        y = random.randint(1, ROWS - h - 1)
        r = Rect(x, y, w, h)
        if any(r.overlaps(e) for e in rooms):
            continue
        rooms.append(r)
        for rx, ry in r.inner():
            grid[ry][rx] = FLOOR_TILE

    if not rooms:
        r = Rect(2, 2, COLS - 4, ROWS - 4)
        rooms.append(r)
        for rx, ry in r.inner():
            grid[ry][rx] = FLOOR_TILE

    random.shuffle(rooms)

    def h_corridor(y, x1, x2):
        for x in range(min(x1, x2), max(x1, x2) + 1):
            if 0 <= y < ROWS and 0 <= x < COLS:
                grid[y][x] = FLOOR_TILE

    def v_corridor(x, y1, y2):
        for y in range(min(y1, y2), max(y1, y2) + 1):
            if 0 <= y < ROWS and 0 <= x < COLS:
                grid[y][x] = FLOOR_TILE

    for i in range(len(rooms) - 1):
        a, b = rooms[i], rooms[i + 1]
        if random.random() < 0.5:
            h_corridor(a.cy, a.cx, b.cx)
            v_corridor(b.cx, a.cy, b.cy)
        else:
            v_corridor(a.cx, a.cy, b.cy)
            h_corridor(b.cy, a.cx, b.cx)

    # stairs — last room centre
    sx, sy = rooms[-1].cx, rooms[-1].cy
    grid[sy][sx] = STAIR_TILE

    player_start = (rooms[0].cx, rooms[0].cy)

    # enemies
    enemies_per_room = 1 + floor_number // 2
    taken = {player_start, (sx, sy)}
    enemies = []
    for room in rooms[1:]:
        for _ in range(enemies_per_room):
            pos = room.random_inner()
            if pos not in taken:
                taken.add(pos)
                enemies.append({"name": random.choice(ENEMY_POOL),
                                "gx": pos[0], "gy": pos[1]})

    # boss
    boss = None
    if floor_number in BOSS_MAP:
        bx, by = rooms[-1].cx, rooms[-1].cy
        boss = {"name": BOSS_MAP[floor_number], "gx": bx, "gy": by}

    # NPC — one per floor
    npcs = []
    if len(rooms) > 2:
        npc_room = random.choice(rooms[1:-1])
        pos = npc_room.random_inner()
        if pos not in taken:
            taken.add(pos)
            npcs.append({"name": random.choice(NPC_POOL), "gx": pos[0], "gy": pos[1]})

    # items
    all_tiles = [t for r in rooms for t in r.inner()]
    candidates = [t for t in all_tiles if t not in taken]
    random.shuffle(candidates)
    item_count = 2 + floor_number
    items = [{"name": random.choice(ITEM_POOL), "gx": c[0], "gy": c[1]}
             for c in candidates[:item_count]]

    return {
        "grid": grid,
        "rooms": [r.to_dict() for r in rooms],
        "player_start": {"gx": player_start[0], "gy": player_start[1]},
        "stairs": {"gx": sx, "gy": sy},
        "enemies": enemies,
        "boss": boss,
        "npcs": npcs,
        "items": items,
        "floor_number": floor_number,
        "cols": COLS,
        "rows": ROWS,
    }


import random
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        import json
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length))
        floor_number = int(body.get("floor_number", 1))
        seed         = body.get("seed", random.randint(0, 999999))
        data = generate_dungeon(floor_number, seed)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
