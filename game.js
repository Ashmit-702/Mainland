// ─────────────────────────────────────────────
//  MAINLAND — game.js
//  Main game loop + state machine
// ─────────────────────────────────────────────

const canvas = document.getElementById("game-canvas");
const ctx    = canvas.getContext("2d");

// ── resize canvas to fill window ─────────────
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── camera ────────────────────────────────────
const Camera = { x: 0, y: 0 };
function cameraFollow(target) {
  Camera.x = target.x - canvas.width  / 2;
  Camera.y = target.y - canvas.height / 2;
}

// ── input ─────────────────────────────────────
const Keys = {};
window.addEventListener("keydown", e => {
  Keys[e.key] = true;
  Keys[e.code] = true;
  handleKeyDown(e);
});
window.addEventListener("keyup", e => {
  Keys[e.key] = false;
  Keys[e.code] = false;
});

// ── state ─────────────────────────────────────
const State = {
  MENU:        "menu",
  PLAYING:     "playing",
  DIALOGUE:    "dialogue",
  FLOOR_CLEAR: "floor_clear",
  GAMEOVER:    "gameover",
  VICTORY:     "victory",
};

// ── API base (auto-detects local vs Vercel) ───
const API_BASE = window.location.hostname === "localhost" ||
                 window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000"
  : "";

// ══════════════════════════════════════════════
//  GAME OBJECT
// ══════════════════════════════════════════════
const Game = {
  state:        State.MENU,
  tick:         0,
  floorNumber:  1,
  dungeon:      null,
  player:       null,
  enemies:      [],
  boss:         null,
  npcs:         [],
  items:        new Map(),   // "gx,gy" → item name
  activeNPC:    null,
  bossIntro:    false,

  // ── init / restart ────────────────────────
  async start() {
    this.floorNumber = 1;
    this.player = null;
    await this.loadFloor(1, false);
    Screens.show("game-screen");
    Screens.hideAllOverlays();
    if (!this._loopRunning) { this._loopRunning = true; requestAnimationFrame(() => this.loop()); }
  },

  restart() {
    Screens.hideAllOverlays();
    this.start();
  },

  // ── floor loading (hits /api/floor) ───────
  async loadFloor(n, carryPlayer = true) {
    Screens.showOverlay("loading-screen");
    document.getElementById("loading-text").textContent =
      n % 3 === 0 ? "Summoning a boss…" : `Generating floor ${n}…`;

    const seed = Math.floor(Math.random() * 999999);
    const res  = await fetch(`${API_BASE}/api/floor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floor_number: n, seed }),
    });
    const data = await res.json();

    this.dungeon = new Dungeon(data);

    // player — carry stats, reset position
    if (carryPlayer && this.player) {
      this.player.gx = this.dungeon.playerStart.gx;
      this.player.gy = this.dungeon.playerStart.gy;
      this.player.x  = this.player.gx * TILE + TILE / 2;
      this.player.y  = this.player.gy * TILE + TILE / 2;
    } else {
      this.player = new Player(this.dungeon.playerStart.gx, this.dungeon.playerStart.gy);
    }

    // enemies
    const scale = 1 + (n - 1) * 0.25;
    this.enemies = data.enemies.map(e => new Enemy(e.name, e.gx, e.gy, scale));

    // boss
    this.boss      = null;
    this.bossIntro = false;
    if (data.boss) {
      this.boss = new Enemy(data.boss.name, data.boss.gx, data.boss.gy,
                             1 + (Math.floor(n / 3) - 1) * 0.3, true);
    }

    // NPCs
    this.npcs = data.npcs.map(n => new NPC(n.name, n.gx, n.gy));

    // items
    this.items.clear();
    for (const it of data.items) this.items.set(`${it.gx},${it.gy}`, it.name);

    UI.setFloor(n);
    UI.hideBoss();

    Screens.hideOverlay("loading-screen");
    this.state = State.PLAYING;
    Screens.hideAllOverlays();
  },

  // ── main loop ─────────────────────────────
  loop() {
    requestAnimationFrame(() => this.loop());
    this.tick++;

    if (this.state === State.PLAYING) this.update();
    this.draw();
  },

  // ── update ────────────────────────────────
  update() {
    this.player.update(this.dungeon, Keys);
    cameraFollow(this.player);

    for (const e of this.enemies) e.update(this.player, this.dungeon);
    this.enemies = this.enemies.filter(e => !e.isDeadDone);

    if (this.boss) {
      // boss intro trigger
      if (!this.bossIntro &&
          Math.abs(this.boss.gx - this.player.gx) < 8 &&
          Math.abs(this.boss.gy - this.player.gy) < 8) {
        this.bossIntro = true;
        UI.showBoss(this.boss);
        UI.toast(`⚔ ${this.boss.name} awakens!`);
        this._fetchBossTaunt();
      }
      this.boss.update(this.player, this.dungeon);
      UI.updateBoss(this.boss);

      if (this.boss.hp <= 0 && this.boss.deathAnim > 30) {
        const gained = this.player.gainXp(this.boss.xpValue);
        UI.toast(`${this.boss.name} has fallen! +${this.boss.xpValue} XP`);
        if (gained) UI.toast(`Level up! Arjun is now level ${this.player.level}`);
        this.boss = null;
        UI.hideBoss();
      }
    }

    for (const npc of this.npcs) npc.update();

    // item pickup
    const key = `${this.player.gx},${this.player.gy}`;
    if (this.items.has(key)) {
      const name = this.items.get(key);
      this.items.delete(key);
      this.player.pickItem(name);
      UI.toast(`Found ${name}! ${ITEM_DEFS[name]?.desc || ""}`);
    }

    UI.updatePlayer(this.player);

    // stairs — only passable when floor is clear
    const atStairs = this.player.gx === this.dungeon.stairsPos.gx &&
                     this.player.gy === this.dungeon.stairsPos.gy;
    if (atStairs && this.enemies.length === 0 && !this.boss) {
      this.state = State.FLOOR_CLEAR;
      if (this.floorNumber >= 9) {
        this.state = State.VICTORY;
        Screens.showOverlay("victory-screen");
      } else {
        Screens.showOverlay("floor-clear-screen");
      }
    }

    if (!this.player.isAlive) {
      this.state = State.GAMEOVER;
      Screens.showOverlay("gameover-screen");
    }

    // minimap
    UI.mmCtx.canvas.width  = 120;  // reset to clear
    this.dungeon.drawMinimap(UI.mmCtx, this.player,
      this.boss ? [...this.enemies, this.boss] : this.enemies,
      this.npcs, this.items);
  },

  // ── draw ──────────────────────────────────
  draw() {
    ctx.fillStyle = "#0a0715";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!this.dungeon) return;

    this.dungeon.draw(ctx, Camera.x, Camera.y, this.tick);
    this.dungeon.drawItems(ctx, Camera.x, Camera.y, this.items, this.tick);

    for (const npc of this.npcs) npc.draw(ctx, Camera.x, Camera.y);
    for (const e of this.enemies) e.draw(ctx, Camera.x, Camera.y, this.tick);
    if (this.boss) this.boss.draw(ctx, Camera.x, Camera.y, this.tick);

    this.player.draw(ctx, Camera.x, Camera.y, this.tick);

    // controls reminder at bottom
    if (this.state === State.PLAYING) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "12px 'Crimson Pro', serif";
      ctx.textAlign = "left";
      ctx.fillText("WASD: move  ·  Space: attack  ·  E: talk/leave", 14, canvas.height - 12);
    }
  },

  // ── combat ────────────────────────────────
  _doAttack() {
    const targets = this.boss && this.boss.hp > 0
      ? [...this.enemies, this.boss]
      : [...this.enemies];
    const hit = this.player.doAttack(targets);
    for (const e of hit) {
      if (e.hp <= 0) {
        const gained = this.player.gainXp(e.xpValue);
        this.player.gold += Math.floor(Math.random() * 10 + 5);
        UI.toast(`${e.name} defeated! +${e.xpValue} XP`);
        if (gained) UI.toast(`Level up! Arjun is now level ${this.player.level}`);
      }
    }
  },

  // ── dialogue / NPC ────────────────────────
  _startDialogue(npc) {
    this.activeNPC = npc;
    this.state     = State.DIALOGUE;

    if (!npc.talked) {
      npc.talked = true;
      Dialogue.open(npc.name, npc.greeting, (line) => this._sendToAI(line));
    } else {
      Dialogue.loading(npc.name);
      this._fetchDialogue("(Arjun approaches again)");
    }
  },

  _sendToAI(playerLine) {
    Dialogue.loading(this.activeNPC.name);
    this._fetchDialogue(playerLine);
  },

  async _fetchDialogue(playerLine) {
    const npc = this.activeNPC;
    try {
      const res = await fetch(`${API_BASE}/api/dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npc_name:    npc.name,
          npc_role:    npc.role,
          player_line: playerLine,
          history:     npc.history,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "…";
      npc.remember(playerLine, reply);
      Dialogue.setResponse(reply);
      Dialogue.open(npc.name, reply, (line) => this._sendToAI(line));
    } catch (err) {
      Dialogue.setResponse("The winds drown my words, Arjun…");
    }
  },

  async _fetchBossTaunt() {
    if (!this.boss) return;
    try {
      const res = await fetch(`${API_BASE}/api/boss_taunt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boss_name: this.boss.name, lore: this.boss.lore }),
      });
      const data = await res.json();
      if (data.taunt) UI.toast(`"${data.taunt}"`);
    } catch { /* silent fail */ }
  },

  _endDialogue() {
    Dialogue.close();
    this.state     = State.PLAYING;
    this.activeNPC = null;
  },
};

// ── keyboard handler ──────────────────────────
function handleKeyDown(e) {
  if (Game.state === State.PLAYING) {
    if (e.key === " ") { e.preventDefault(); Game._doAttack(); }
    if (e.key === "e" || e.key === "E") {
      for (const npc of Game.npcs) {
        if (npc.inRange(Game.player)) { Game._startDialogue(npc); return; }
      }
    }
  }

  if (Game.state === State.DIALOGUE) {
    if (Dialogue.isOpen() && !document.getElementById("dialogue-input-wrap").classList.contains("hidden")) return;
    if (e.key === " ") {
      e.preventDefault();
      if (Dialogue.isDone()) Dialogue.openInput();
      else Dialogue.skipType();
    }
    if (e.key === "e" || e.key === "E") Game._endDialogue();
  }
}

// ── floor clear button ────────────────────────
document.getElementById("btn-descend").addEventListener("click", async () => {
  Screens.hideOverlay("floor-clear-screen");
  Game.floorNumber++;
  await Game.loadFloor(Game.floorNumber, true);
});

// ── start button ──────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => Game.start());
