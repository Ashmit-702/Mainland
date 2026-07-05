# POST /api/floor — BSP dungeon generator
# Returns full floor data as JSON

import json, random
from http.server import BaseHTTPRequestHandler

COLS = 45
ROWS = 33

FLOOR_TILE = 0
WALL_TILE  = 1
STAIR_TILE = 3
SHRINE_TILE = 4

# Zone definitions
ZONES = {
    1: {"name": "The Outer Ruins",   "floors": [1,2,3], "enemies": ["Asura","Naga","Pishacha"],        "boss": "Duryodhana"},
    2: {"name": "The Blood Crypts",  "floors": [4,5,6], "enemies": ["Rakshasa","Vetala","Yaksha"],     "boss": "Duryodhana"},
    3: {"name": "The Void Sanctum",  "floors": [7,8,9], "enemies": ["Asura","Rakshasa","Naga","Vetala","Pishacha","Yaksha"], "boss": "Kali"},
}

NPC_POOL   = ["Draupadi","Karna","Shakuni","Gandhari","Bhima"]
ITEM_POOL  = ["Amrit","Vajra","Kavacha","SomRas","Quiver","Talisman"]
BOSS_FLOORS = {3: "Duryodhana", 6: "Duryodhana", 9: "Kali"}


def get_zone(floor_number):
    if floor_number <= 3: return 1
    if floor_number <= 6: return 2
    return 3


class Rect:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h
    @property
    def cx(self): return self.x + self.w // 2
    @property
    def cy(self): return self.y + self.h // 2
    def inner(self):
        return [(rx, ry) for ry in range(self.y+1, self.y+self.h-1)
                         for rx in range(self.x+1, self.x+self.w-1)]
    def random_inner(self):
        return (random.randint(self.x+1, self.x+self.w-2),
                random.randint(self.y+1, self.y+self.h-2))
    def overlaps(self, o, m=2):
        return (self.x-m < o.x+o.w and self.x+self.w+m > o.x and
                self.y-m < o.y+o.h and self.y+self.h+m > o.y)
    def to_dict(self):
        return {"x":self.x,"y":self.y,"w":self.w,"h":self.h,"cx":self.cx,"cy":self.cy}


def generate_dungeon(floor_number=1, seed=None):
    if seed is not None:
        random.seed(seed)

    zone = get_zone(floor_number)
    grid = [[WALL_TILE]*COLS for _ in range(ROWS)]
    rooms = []

    for _ in range(160):
        w = random.randint(5, 10)
        h = random.randint(5, 9)
        x = random.randint(1, COLS-w-1)
        y = random.randint(1, ROWS-h-1)
        r = Rect(x, y, w, h)
        if any(r.overlaps(e) for e in rooms): continue
        rooms.append(r)
        for rx, ry in r.inner():
            grid[ry][rx] = FLOOR_TILE

    if not rooms:
        r = Rect(2, 2, COLS-4, ROWS-4)
        rooms.append(r)
        for rx, ry in r.inner():
            grid[ry][rx] = FLOOR_TILE

    random.shuffle(rooms)

    def h_corr(y, x1, x2):
        for x in range(min(x1,x2), max(x1,x2)+1):
            if 0 <= y < ROWS and 0 <= x < COLS:
                grid[y][x] = FLOOR_TILE

    def v_corr(x, y1, y2):
        for y in range(min(y1,y2), max(y1,y2)+1):
            if 0 <= y < ROWS and 0 <= x < COLS:
                grid[y][x] = FLOOR_TILE

    for i in range(len(rooms)-1):
        a, b = rooms[i], rooms[i+1]
        if random.random() < 0.5:
            h_corr(a.cy, a.cx, b.cx); v_corr(b.cx, a.cy, b.cy)
        else:
            v_corr(a.cx, a.cy, b.cy); h_corr(b.cy, a.cx, b.cx)

    # stairs
    sx, sy = rooms[-1].cx, rooms[-1].cy
    grid[sy][sx] = STAIR_TILE

    # shrine — in a mid room if available
    shrine_pos = None
    if len(rooms) > 3:
        shrine_room = random.choice(rooms[len(rooms)//2:len(rooms)-1])
        shx, shy = shrine_room.cx, shrine_room.cy
        grid[shy][shx] = SHRINE_TILE
        shrine_pos = {"gx": shx, "gy": shy}

    player_start = {"gx": rooms[0].cx, "gy": rooms[0].cy}
    taken = {(rooms[0].cx, rooms[0].cy), (sx, sy)}

    # enemies
    zone_enemies = ZONES[zone]["enemies"]
    enemies_per_room = 1 + floor_number // 2
    enemies = []
    for room in rooms[1:]:
        for _ in range(enemies_per_room):
            pos = room.random_inner()
            if pos not in taken:
                taken.add(pos)
                enemies.append({"name": random.choice(zone_enemies), "gx": pos[0], "gy": pos[1]})

    # boss
    boss = None
    if floor_number in BOSS_FLOORS:
        bx, by = rooms[-1].cx, rooms[-1].cy
        boss = {"name": BOSS_FLOORS[floor_number], "gx": bx, "gy": by}

    # NPCs — 1-2 per floor
    npcs = []
    npc_rooms = rooms[1:-1] if len(rooms) > 2 else rooms[:1]
    npc_count = min(2, len(npc_rooms))
    used_npcs = set()
    for nr in random.sample(npc_rooms, npc_count):
        pos = nr.random_inner()
        if pos not in taken:
            available = [n for n in NPC_POOL if n not in used_npcs]
            if not available: available = NPC_POOL
            name = random.choice(available)
            used_npcs.add(name)
            taken.add(pos)
            npcs.append({"name": name, "gx": pos[0], "gy": pos[1]})

    # items
    all_tiles = [t for r in rooms for t in r.inner()]
    candidates = [t for t in all_tiles if t not in taken]
    random.shuffle(candidates)
    item_count = 3 + floor_number
    items = [{"name": random.choice(ITEM_POOL), "gx": c[0], "gy": c[1]}
             for c in candidates[:item_count]]

    zone_info = ZONES[zone]
    return {
        "grid": grid, "cols": COLS, "rows": ROWS,
        "rooms": [r.to_dict() for r in rooms],
        "player_start": player_start,
        "stairs": {"gx": sx, "gy": sy},
        "shrine": shrine_pos,
        "enemies": enemies,
        "boss": boss,
        "npcs": npcs,
        "items": items,
        "floor_number": floor_number,
        "zone": zone,
        "zone_name": zone_info["name"],
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        floor_number = int(body.get("floor_number", 1))
        seed         = body.get("seed", random.randint(0, 999999))
        data = generate_dungeon(floor_number, seed)
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def log_message(self, *a): pass
