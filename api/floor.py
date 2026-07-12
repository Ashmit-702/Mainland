# POST /api/floor — BSP dungeon generator
# Returns full floor data as JSON
#
# STRUCTURE: 6 exploration floors + Floor 7 "The Final War" (a scripted
# multi-wave siege arena instead of a normal room-by-room floor). Each of the
# 6 exploration floors introduces exactly one ally in a fixed order, so the
# story unfolds the same way every run instead of via random NPC luck.

import json, random
from http.server import BaseHTTPRequestHandler

COLS = 45
ROWS = 33
TOTAL_FLOORS = 7

FLOOR_TILE  = 0
WALL_TILE   = 1
STAIR_TILE  = 3
SHRINE_TILE = 4
DOOR_TILE   = 5   # locked vault door — requires a key held by an NPC on the floor

# Zone definitions — floors 1-6 only. Floor 7 (The Field of Kurukshetra) is
# generated separately by generate_final_war().
ZONES = {
    1: {"name": "The Outer Ruins",   "floors": [1,2], "enemies": ["Asura","Naga","Pishacha"]},
    2: {"name": "The Blood Crypts",  "floors": [3,4], "enemies": ["Rakshasa","Vetala","Yaksha"]},
    3: {"name": "The Void Sanctum",  "floors": [5,6], "enemies": ["Asura","Rakshasa","Naga","Vetala","Pishacha","Yaksha"]},
}
ALL_ENEMY_KINDS = ["Asura","Rakshasa","Naga","Pishacha","Vetala","Yaksha"]

# Each exploration floor introduces exactly one character, in story order.
# Floor 6 deliberately introduces no one — the calm-before-the-storm floor.
NPC_INTRO_MAP = {1: "Draupadi", 2: "Shakuni", 3: "Bhima", 4: "Karna", 5: "Gandhari"}

ITEM_POOL       = ["Amrit","Vajra","Kavacha","SomRas","Quiver","Talisman"]
VAULT_ITEM_POOL = ["Vajra","Kavacha","Talisman","Amrit"]  # vault rewards skew stronger


def get_zone(floor_number):
    if floor_number <= 2: return 1
    if floor_number <= 4: return 2
    return 3  # floors 5, 6


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


def try_place_vault(grid, rooms, cols, rows):
    """Carve a small gated vault room in untouched wall space, connected to the
    nearest existing room through exactly one DOOR_TILE cell. Returns
    (door_cells, vault_item_cells) or (None, None) if no space could be found."""
    for _ in range(60):
        w = random.randint(3, 4)
        h = random.randint(3, 4)
        x = random.randint(2, cols - w - 3)
        y = random.randint(2, rows - h - 3)

        ok = True
        for ry in range(y - 1, y + h + 1):
            for rx in range(x - 1, x + w + 1):
                if not (0 <= rx < cols and 0 <= ry < rows) or grid[ry][rx] != WALL_TILE:
                    ok = False; break
            if not ok: break
        if not ok:
            continue

        vr = Rect(x, y, w, h)
        nearest = min(rooms, key=lambda r: (r.cx - vr.cx) ** 2 + (r.cy - vr.cy) ** 2)

        for (ix, iy) in vr.inner():
            grid[iy][ix] = FLOOR_TILE

        if random.random() < 0.5:
            for cx in range(min(vr.cx, nearest.cx), max(vr.cx, nearest.cx) + 1):
                if grid[vr.cy][cx] == WALL_TILE: grid[vr.cy][cx] = FLOOR_TILE
            for cy in range(min(vr.cy, nearest.cy), max(vr.cy, nearest.cy) + 1):
                if grid[cy][nearest.cx] == WALL_TILE: grid[cy][nearest.cx] = FLOOR_TILE
        else:
            for cy in range(min(vr.cy, nearest.cy), max(vr.cy, nearest.cy) + 1):
                if grid[cy][vr.cx] == WALL_TILE: grid[cy][vr.cx] = FLOOR_TILE
            for cx in range(min(vr.cx, nearest.cx), max(vr.cx, nearest.cx) + 1):
                if grid[nearest.cy][cx] == WALL_TILE: grid[nearest.cy][cx] = FLOOR_TILE

        door_cells = []
        for ry in range(vr.y, vr.y + vr.h):
            for rx in range(vr.x, vr.x + vr.w):
                on_border = rx in (vr.x, vr.x + vr.w - 1) or ry in (vr.y, vr.y + vr.h - 1)
                if on_border and grid[ry][rx] == FLOOR_TILE:
                    grid[ry][rx] = DOOR_TILE
                    door_cells.append({"gx": rx, "gy": ry})

        if not door_cells:
            continue

        item_cells = vr.inner()
        random.shuffle(item_cells)
        return door_cells, item_cells[:2]

    return None, None


def _carve_rooms_and_corridors(room_w_range, room_h_range):
    """Shared BSP room+corridor carving used by both normal floors and the
    Final War arena. Returns (grid, rooms) with rooms shuffled."""
    grid = [[WALL_TILE]*COLS for _ in range(ROWS)]
    rooms = []
    for _ in range(160):
        w = random.randint(*room_w_range)
        h = random.randint(*room_h_range)
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
            if 0 <= y < ROWS and 0 <= x < COLS: grid[y][x] = FLOOR_TILE
    def v_corr(x, y1, y2):
        for y in range(min(y1,y2), max(y1,y2)+1):
            if 0 <= y < ROWS and 0 <= x < COLS: grid[y][x] = FLOOR_TILE

    for i in range(len(rooms)-1):
        a, b = rooms[i], rooms[i+1]
        if random.random() < 0.5:
            h_corr(a.cy, a.cx, b.cx); v_corr(b.cx, a.cy, b.cy)
        else:
            v_corr(a.cx, a.cy, b.cy); h_corr(b.cy, a.cx, b.cx)

    return grid, rooms


def generate_dungeon(floor_number=1, seed=None):
    if seed is not None:
        random.seed(seed)

    zone = get_zone(floor_number)
    grid, rooms = _carve_rooms_and_corridors((5, 10), (5, 9))

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

    # enemies — fewer floors overall, so a bit denser per room than before
    zone_enemies = ZONES[zone]["enemies"]
    enemies_per_room = 2 + floor_number // 2
    elite_chance = min(0.32, max(0, floor_number - 1) * 0.06)  # steeper ramp over 6 floors
    enemies = []
    for room in rooms[1:]:
        for _ in range(enemies_per_room):
            pos = room.random_inner()
            if pos not in taken:
                taken.add(pos)
                enemies.append({
                    "name": random.choice(zone_enemies), "gx": pos[0], "gy": pos[1],
                    "elite": random.random() < elite_chance,
                })

    # NPC — exactly one guaranteed ally per story floor, none on floor 6
    npcs = []
    intro_name = NPC_INTRO_MAP.get(floor_number)
    if intro_name:
        npc_rooms = rooms[1:-1] if len(rooms) > 2 else rooms[:1]
        nr = random.choice(npc_rooms)
        pos = nr.random_inner()
        if pos in taken:
            pos = nr.random_inner()  # one retry is enough given room size
        taken.add(pos)
        npcs.append({"name": intro_name, "gx": pos[0], "gy": pos[1]})

    # items
    all_tiles = [t for r in rooms for t in r.inner()]
    candidates = [t for t in all_tiles if t not in taken]
    random.shuffle(candidates)
    item_count = 3 + floor_number
    items = [{"name": random.choice(ITEM_POOL), "gx": c[0], "gy": c[1]}
             for c in candidates[:item_count]]

    zone_info = ZONES[zone]

    # Vault: gated by this floor's guaranteed ally, when one is present
    door = None
    if npcs and random.random() < 0.75:
        door_cells, item_cells = try_place_vault(grid, rooms, COLS, ROWS)
        if door_cells:
            npcs[0]["holds_key"] = True
            door = {"cells": door_cells}
            for (ix, iy) in item_cells:
                items.append({"name": random.choice(VAULT_ITEM_POOL), "gx": ix, "gy": iy})

    return {
        "grid": grid, "cols": COLS, "rows": ROWS,
        "rooms": [r.to_dict() for r in rooms],
        "player_start": player_start,
        "stairs": {"gx": sx, "gy": sy},
        "shrine": shrine_pos,
        "door": door,
        "enemies": enemies,
        "boss": None,
        "npcs": npcs,
        "items": items,
        "floor_number": floor_number,
        "zone": zone,
        "zone_name": zone_info["name"],
        "is_final_war": False,
    }


def generate_final_war(seed=None):
    """Floor 7 — The Field of Kurukshetra. A scripted multi-wave siege instead
    of a normal explore-and-clear floor: rank-and-file rush, then an elite
    guard, then Duryodhana's last stand, then Kali. The client drives the wave
    sequence; this just lays out the arena and the wave manifest."""
    if seed is not None:
        random.seed(seed)

    grid, rooms = _carve_rooms_and_corridors((6, 12), (6, 10))
    arena_room = max(rooms, key=lambda r: r.w * r.h)

    non_arena = [r for r in rooms if r is not arena_room] or [arena_room]
    start_room = non_arena[0]
    player_start = {"gx": start_room.cx, "gy": start_room.cy}

    # A shrine somewhere on the approach — one last blessing before the siege
    shrine_pos = None
    shrine_candidates = [r for r in non_arena if r is not start_room]
    if shrine_candidates:
        sr = random.choice(shrine_candidates)
        grid[sr.cy][sr.cx] = SHRINE_TILE
        shrine_pos = {"gx": sr.cx, "gy": sr.cy}

    # A few items scattered on the approach rooms (never inside the arena)
    taken = {(start_room.cx, start_room.cy)}
    if shrine_pos: taken.add((shrine_pos["gx"], shrine_pos["gy"]))
    approach_tiles = [t for r in non_arena for t in r.inner() if t not in taken]
    random.shuffle(approach_tiles)
    items = [{"name": random.choice(ITEM_POOL), "gx": c[0], "gy": c[1]}
             for c in approach_tiles[:4]]

    waves = [
        {"type":"grunts", "label":"The Kaurava Line Advances",
         "enemies":[random.choice(ALL_ENEMY_KINDS) for _ in range(9)]},
        {"type":"elites", "label":"The Elite Guard Answers the Call",
         "enemies":[random.choice(ALL_ENEMY_KINDS) for _ in range(5)]},
        {"type":"boss", "label":"Duryodhana's Last Stand", "boss":"Duryodhana"},
        {"type":"boss", "label":"Kali Awakens", "boss":"Kali"},
    ]

    return {
        "grid": grid, "cols": COLS, "rows": ROWS,
        "rooms": [r.to_dict() for r in rooms],
        "player_start": player_start,
        "stairs": {"gx": arena_room.cx, "gy": arena_room.cy},  # unused for progression, kept for schema
        "shrine": shrine_pos,
        "door": None,
        "enemies": [],
        "boss": None,
        "npcs": [],
        "items": items,
        "floor_number": TOTAL_FLOORS,
        "zone": 4,
        "zone_name": "The Field of Kurukshetra",
        "is_final_war": True,
        "arena": arena_room.to_dict(),
        "waves": waves,
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        floor_number = int(body.get("floor_number", 1))
        seed         = body.get("seed", random.randint(0, 999999))
        if floor_number >= TOTAL_FLOORS:
            data = generate_final_war(seed)
        else:
            data = generate_dungeon(floor_number, seed)
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def log_message(self, *a): pass
