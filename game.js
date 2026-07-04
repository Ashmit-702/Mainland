// MAINLAND — game.js — Fixed freeze + deep gameplay

const canvas = document.getElementById("game-canvas");
const ctx    = canvas.getContext("2d");

// ── Menu canvas particles ─────────────────────
const menuCanvas = document.getElementById("menu-canvas");
const mctx       = menuCanvas.getContext("2d");
let menuParticles = [];

function initMenuParticles() {
  menuCanvas.width  = window.innerWidth;
  menuCanvas.height = window.innerHeight;
  menuParticles = Array.from({ length: 60 }, () => ({
    x: Math.random() * menuCanvas.width,
    y: Math.random() * menuCanvas.height,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.5 - 0.1,
    a: Math.random() * 0.7 + 0.2,
    colour: Math.random() > 0.6 ? "#d4aa3a" : Math.random() > 0.5 ? "#3cb8a8" : "#6040c0",
  }));
}

function animateMenuParticles() {
  if (Game.state !== "menu") return;
  requestAnimationFrame(animateMenuParticles);
  mctx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
  for (const p of menuParticles) {
    p.x += p.vx; p.y += p.vy;
    if (p.y < -5) { p.y = menuCanvas.height + 5; p.x = Math.random() * menuCanvas.width; }
    mctx.save(); mctx.globalAlpha = p.a;
    mctx.fillStyle = p.colour;
    mctx.beginPath(); mctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); mctx.fill();
    mctx.restore();
  }
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  if (menuCanvas) { menuCanvas.width = window.innerWidth; menuCanvas.height = window.innerHeight; }
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
initMenuParticles();
animateMenuParticles();

// ── Input ─────────────────────────────────────
const Keys = {};
window.addEventListener("keydown", e => { Keys[e.key] = true; Keys[e.code] = true; handleKeyDown(e); });
window.addEventListener("keyup",   e => { Keys[e.key] = false; Keys[e.code] = false; });

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000" : "";

// ══ GAME ══════════════════════════════════════
const Game = {
  state:       "menu",
  tick:        0,
  floorNumber: 1,
  dungeon:     null,
  player:      null,
  enemies:     [],
  boss:        null,
  npcs:        [],
  items:       new Map(),
  arrows:      [],       // Arrow projectiles
  particles:   [],       // Visual fx particles
  activeNPC:   null,
  bossIntro:   false,
  _loopRunning: false,
  _pendingLevelUp: false,

  async start() {
    this.floorNumber = 1;
    this.player = null;
    this.particles = [];
    await this.loadFloor(1, false);
    Screens.show("game-screen");
    Screens.hideAllOverlays();
    if (!this._loopRunning) { this._loopRunning = true; requestAnimationFrame(() => this.loop()); }
  },

  restart() {
    // ── FIX: full state reset before restart ──
    this.state       = "menu";
    this.floorNumber = 1;
    this.dungeon     = null;
    this.player      = null;
    this.enemies     = [];
    this.boss        = null;
    this.npcs        = [];
    this.items       = new Map();
    this.arrows      = [];
    this.particles   = [];
    this.activeNPC   = null;
    this.bossIntro   = false;
    this._pendingLevelUp = false;
    Dialogue.close();
    Screens.hideAllOverlays();
    Screens.show("menu-screen");
    initMenuParticles();
    animateMenuParticles();
  },

  async loadFloor(n, carryPlayer = true) {
    Screens.showOverlay("loading-screen");
    document.getElementById("loading-text").textContent =
      n % 3 === 0 ? `Summoning ${n === 9 ? "Mahishasura" : "Vritra"}…`
                  : `Carving floor ${n} from stone…`;

    const res  = await fetch(`${API_BASE}/api/floor`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ floor_number: n, seed: Math.floor(Math.random() * 999999) }),
    });
    const data = await res.json();
    this.dungeon = new Dungeon(data);

    if (carryPlayer && this.player) {
      this.player.gx = this.dungeon.playerStart.gx;
      this.player.gy = this.dungeon.playerStart.gy;
      this.player.x  = this.player.gx * TILE + TILE / 2;
      this.player.y  = this.player.gy * TILE + TILE / 2;
      this.player.floorsCleared++;
    } else {
      this.player = new Player(this.dungeon.playerStart.gx, this.dungeon.playerStart.gy);
    }

    const scale = 1 + (n - 1) * 0.25;
    this.enemies = data.enemies.map(e => new Enemy(e.name, e.gx, e.gy, scale));
    this.boss      = null; this.bossIntro = false;
    if (data.boss) this.boss = new Enemy(data.boss.name, data.boss.gx, data.boss.gy, 1 + (Math.floor(n / 3) - 1) * 0.3, true);
    this.npcs  = data.npcs.map(n => new NPC(n.name, n.gx, n.gy));
    this.items.clear();
    for (const it of data.items) this.items.set(`${it.gx},${it.gy}`, it.name);
    this.arrows = []; this.particles = [];

    UI.setFloor(n); UI.hideBoss(); UI.setKills(this.player?.kills ?? 0);
    Screens.hideOverlay("loading-screen");
    this.state = "playing";
    Screens.hideAllOverlays();
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    this.tick++;
    if (this.state === "playing") this.update();
    this.draw();
  },

  update() {
    if (!this.player || !this.dungeon) return;

    this.player.update(this.dungeon, Keys);
    cameraFollow(this.player);

    // arrows
    const allEnemies = this.boss ? [...this.enemies, this.boss] : [...this.enemies];
    for (const a of this.arrows) a.update(this.dungeon, allEnemies);
    this.arrows = this.arrows.filter(a => a.alive);

    // enemies
    for (const e of this.enemies) e.update(this.player, this.dungeon);
    const justDied = this.enemies.filter(e => e.hp <= 0 && !e._xpGiven);
    for (const e of justDied) {
      e._xpGiven = true;
      const leveled = this.player.gainXp(e.xpValue);
      this.player.gold += Math.floor(Math.random() * 10 + 5);
      this.player.kills++;
      UI.setKills(this.player.kills);
      UI.toast(`${e.name} defeated! +${e.xpValue} XP`, "good");
      this._spawnDeathParticles(e.x, e.y, e.colour);
      if (leveled) { this._pendingLevelUp = true; UI.showLevelUp(this.player); this.state = "levelup"; }
    }
    this.enemies = this.enemies.filter(e => !e.isDeadDone);

    // boss
    if (this.boss) {
      if (!this.bossIntro && Math.abs(this.boss.gx - this.player.gx) < 9 && Math.abs(this.boss.gy - this.player.gy) < 9) {
        this.bossIntro = true; UI.showBoss(this.boss);
        UI.toast(`⚔ ${this.boss.name} awakens!`, "bad");
        this._fetchBossTaunt();
      }
      this.boss.update(this.player, this.dungeon);
      UI.updateBoss(this.boss);
      if (this.boss.phase2Done && !this.boss._phase2Announced) {
        this.boss._phase2Announced = true;
        UI.toast(`${this.boss.name} ENRAGES!`, "bad");
        this._spawnDeathParticles(this.boss.x, this.boss.y, "#ff5050");
      }
      if (this.boss.hp <= 0 && !this.boss._xpGiven) {
        this.boss._xpGiven = true;
        const leveled = this.player.gainXp(this.boss.xpValue);
        this.player.gold += 100; this.player.kills++;
        UI.toast(`${this.boss.name} has fallen! +${this.boss.xpValue} XP`, "good");
        this._spawnDeathParticles(this.boss.x, this.boss.y, this.boss.colour);
        UI.hideBoss();
        if (leveled) { this._pendingLevelUp = true; UI.showLevelUp(this.player); this.state = "levelup"; }
      }
      if (this.boss.isDeadDone) this.boss = null;
    }

    for (const npc of this.npcs) npc.update();

    // particles
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; p.r *= 0.95; }
    this.particles = this.particles.filter(p => p.life > 0);

    // item pickup
    const key = `${this.player.gx},${this.player.gy}`;
    if (this.items.has(key)) {
      const name = this.items.get(key); this.items.delete(key);
      this.player.pickItem(name);
      UI.toast(`Found ${name} — ${ITEM_DEFS[name]?.desc || ""}`, "info");
    }

    UI.updatePlayer(this.player);
    UI.drawMinimap(this.player, this.boss ? [...this.enemies, this.boss] : this.enemies, this.npcs, this.dungeon);

    // stairs
    const atStairs = this.player.gx === this.dungeon.stairsPos.gx && this.player.gy === this.dungeon.stairsPos.gy;
    if (atStairs && this.enemies.length === 0 && !this.boss) {
      this.state = "floor_clear";
      UI.showFloorClearStats(this.player, this.floorNumber);
      if (this.floorNumber >= 9) {
        UI.showVictoryStats(this.player);
        Screens.showOverlay("victory-screen");
        this.state = "victory";
      } else {
        Screens.showOverlay("floor-clear-screen");
      }
    }

    // ── FIX: death check — properly transitions state ──
    if (!this.player.isAlive && this.state === "playing") {
      this.state = "gameover";
      UI.showDeathStats(this.player, this.floorNumber);
      Screens.showOverlay("gameover-screen");
    }
  },

  draw() {
    ctx.fillStyle = "#050310"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.dungeon) return;

    this.dungeon.draw(ctx, Camera.x, Camera.y, this.tick);
    this.dungeon.drawItems(ctx, Camera.x, Camera.y, this.items, this.tick);

    for (const npc  of this.npcs)    npc.draw(ctx, Camera.x, Camera.y);
    for (const e    of this.enemies) e.draw(ctx, Camera.x, Camera.y);
    if (this.boss) this.boss.draw(ctx, Camera.x, Camera.y);

    // particles
    for (const p of this.particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.colour;
      ctx.beginPath(); ctx.arc(p.x - Camera.x, p.y - Camera.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    for (const a of this.arrows) a.draw(ctx, Camera.x, Camera.y);
    if (this.player) this.player.draw(ctx, Camera.x, Camera.y);

    // controls bar
    if (this.state === "playing") {
      ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.font = "11px 'Crimson Pro',serif"; ctx.textAlign = "left";
      ctx.fillText("WASD: move  ·  Space: attack  ·  Shift: dash  ·  Q: shoot arrow  ·  E: talk", 14, canvas.height - 12);
    }
  },

  _spawnDeathParticles(x, y, colour) {
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 3 + 1;
      this.particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2,
        colour, r: Math.random() * 5 + 2, life: 30 + Math.floor(Math.random() * 20), maxLife: 50 });
    }
  },

  _doAttack() {
    const targets = this.boss && this.boss.hp > 0 ? [...this.enemies, this.boss] : [...this.enemies];
    this.player.doAttack(targets);
  },

  _shootArrow() {
    const a = this.player.shootArrow();
    if (a) { this.arrows.push(a); UI.toast("Arrow loosed!", ""); }
    else UI.toast("No arrows!", "bad");
  },

  _startDialogue(npc) {
    this.activeNPC = npc; this.state = "dialogue";
    if (!npc.talked) {
      npc.talked = true;
      Dialogue.open(npc.name, npc.role, npc.greeting, line => this._sendToAI(line));
    } else {
      Dialogue.loading(npc.name, npc.role);
      this._fetchDialogue("(Arjun approaches again)");
    }
  },

  _sendToAI(line) { Dialogue.loading(this.activeNPC.name, this.activeNPC.role); this._fetchDialogue(line); },

  async _fetchDialogue(playerLine) {
    const npc = this.activeNPC;
    try {
      const res  = await fetch(`${API_BASE}/api/dialogue`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ npc_name: npc.name, npc_role: npc.role, player_line: playerLine, history: npc.history }),
      });
      const data = await res.json();
      const reply = data.reply || "…";
      npc.remember(playerLine, reply);
      Dialogue.open(npc.name, npc.role, reply, line => this._sendToAI(line));
    } catch { Dialogue.setResponse("The winds drown my words, Arjun…"); }
  },

  async _fetchBossTaunt() {
    if (!this.boss) return;
    try {
      const res  = await fetch(`${API_BASE}/api/boss_taunt`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ boss_name: this.boss.name, lore: this.boss.lore }),
      });
      const data = await res.json();
      if (data.taunt) UI.toast(`"${data.taunt}"`, "bad");
    } catch {}
  },

  _endDialogue() { Dialogue.close(); this.state = "playing"; this.activeNPC = null; },
};

// ── Camera ────────────────────────────────────
const Camera = { x: 0, y: 0 };
function cameraFollow(t) { Camera.x = t.x - canvas.width / 2; Camera.y = t.y - canvas.height / 2; }

// ── Keyboard ──────────────────────────────────
function handleKeyDown(e) {
  if (Game.state === "playing") {
    if (e.code === "Space")      { e.preventDefault(); Game._doAttack(); }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { e.preventDefault(); Game.player.dash(); }
    if (e.code === "KeyQ")       { e.preventDefault(); Game._shootArrow(); }
    if (e.key  === "e" || e.key === "E") {
      for (const npc of Game.npcs) { if (npc.inRange(Game.player)) { Game._startDialogue(npc); return; } }
    }
  }
  if (Game.state === "dialogue") {
    if (!document.getElementById("dialogue-input-wrap").classList.contains("hidden")) return;
    if (e.code === "Space")      { e.preventDefault(); Dialogue.isDone() ? Dialogue.openInput() : Dialogue.skipType(); }
    if (e.key  === "e" || e.key === "E") Game._endDialogue();
  }
}

// ── Buttons ───────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => Game.start());

document.getElementById("btn-descend").addEventListener("click", async () => {
  Screens.hideOverlay("floor-clear-screen");
  Game.floorNumber++;
  await Game.loadFloor(Game.floorNumber, true);
});

document.getElementById("btn-levelup-ok").addEventListener("click", () => {
  Screens.hideOverlay("levelup-screen");
  Game._pendingLevelUp = false;
  // only return to playing if not already in another state
  if (Game.state === "levelup") Game.state = "playing";
});
