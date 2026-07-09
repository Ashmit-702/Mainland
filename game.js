// MAINLAND — game.js

const canvas = document.getElementById("game-canvas");
const ctx    = canvas.getContext("2d");
const menuCanvas = document.getElementById("menu-canvas");
const mctx = menuCanvas ? menuCanvas.getContext("2d") : null;

function resizeCanvas() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  if (menuCanvas) { menuCanvas.width = window.innerWidth; menuCanvas.height = window.innerHeight; }
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── Menu particles ────────────────────────────
let menuParticles = [];
function initMenuParticles() {
  if (!menuCanvas) return;
  menuParticles = Array.from({length:80}, () => ({
    x:Math.random()*menuCanvas.width, y:Math.random()*menuCanvas.height,
    r:Math.random()*1.8+0.3, vx:(Math.random()-0.5)*0.3, vy:-Math.random()*0.6-0.1,
    a:Math.random()*0.7+0.2,
    colour:Math.random()>0.6?"#d4aa3a":Math.random()>0.5?"#3cb8a8":"#8060d0",
  }));
}
function animateMenuParticles() {
  if (Game.state !== "menu" || !mctx) return;
  requestAnimationFrame(animateMenuParticles);
  mctx.clearRect(0,0,menuCanvas.width,menuCanvas.height);
  for (const p of menuParticles) {
    p.x+=p.vx; p.y+=p.vy;
    if (p.y<-5){p.y=menuCanvas.height+5;p.x=Math.random()*menuCanvas.width;}
    mctx.save();mctx.globalAlpha=p.a;mctx.fillStyle=p.colour;
    mctx.beginPath();mctx.arc(p.x,p.y,p.r,0,Math.PI*2);mctx.fill();mctx.restore();
  }
}

// ── Input ─────────────────────────────────────
const Keys = {};
window.addEventListener("keydown", e => { Keys[e.key]=true; Keys[e.code]=true; handleKeyDown(e); });
window.addEventListener("keyup",   e => { Keys[e.key]=false; Keys[e.code]=false; });

const API_BASE = (window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")
  ? "http://localhost:3000" : "";

// Safe fetch — never throws, never blocks game loop
function safeFetch(url, body) {
  return fetch(url, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),
  })
  .then(r => r.ok ? r.json() : null)
  .catch(() => null);
}

// Death overlay vars
let deathAlpha = 0;
let deathActive = false;

// ══════════════════════════════════════════════
const Game = {
  state:         "menu",
  tick:          0,
  floorNumber:   1,
  dungeon:       null,
  player:        null,
  enemies:       [],
  boss:          null,
  npcs:          [],
  shrine:        null,
  items:         new Map(),
  arrows:        [],
  particles:     [],
  activeNPC:     null,
  bossIntro:     false,
  _loopRunning:  false,
  _totalEnemies: 0,   // FIX: track total enemies spawned on floor
  _killedCount:  0,   // FIX: track kills on this floor separately

  async start() {
    Audio.init();
    this.floorNumber = 1;
    this.player      = null;
    deathAlpha       = 0;
    deathActive      = false;
    await this.loadFloor(1, false);
    Screens.show("game-screen");
    Screens.hideAllOverlays();
    if (!this._loopRunning) {
      this._loopRunning = true;
      requestAnimationFrame(() => this.loop());
    }
  },

  restart() {
    this.state        = "menu";
    this.floorNumber  = 1;
    this.dungeon      = null;
    this.player       = null;
    this.enemies      = [];
    this.boss         = null;
    this.npcs         = [];
    this.shrine       = null;
    this.items        = new Map();
    this.arrows       = [];
    this.particles    = [];
    this.activeNPC    = null;
    this.bossIntro    = false;
    this._totalEnemies= 0;
    this._killedCount = 0;
    deathAlpha        = 0;
    deathActive       = false;
    Dialogue.close();
    Screens.hideAllOverlays();
    Screens.show("menu-screen");
    initMenuParticles();
    animateMenuParticles();
  },

  async loadFloor(n, carryPlayer=true) {
    Screens.showOverlay("loading-screen");
    document.getElementById("loading-text").textContent =
      n%3===0 ? `Summoning ${n>=9?"Kali":"Duryodhana"}…`
      : n<=3 ? "Carving the Outer Ruins…"
      : n<=6 ? "Flooding the Blood Crypts…"
             : "Opening the Void Sanctum…";

    const data = await safeFetch(`${API_BASE}/api/floor`, {
      floor_number: n,
      seed: Math.floor(Math.random() * 999999),
    });

    if (!data) {
      Screens.hideOverlay("loading-screen");
      UI.toast("Failed to load floor — retrying…", "bad");
      setTimeout(() => this.loadFloor(n, carryPlayer), 2000);
      return;
    }

    this.dungeon = new Dungeon(data);

    if (carryPlayer && this.player) {
      this.player.gx         = this.dungeon.playerStart.gx;
      this.player.gy         = this.dungeon.playerStart.gy;
      this.player.x          = this.player.gx * TILE + TILE / 2;
      this.player.y          = this.player.gy * TILE + TILE / 2;
      this.player._dead      = false;
      this.player.attackCd   = 0;   // FIX: reset attack cooldown
      this.player.invincible = 90;  // brief i-frames
      this.player.floorsCleared++;
    } else {
      this.player = new Player(this.dungeon.playerStart.gx, this.dungeon.playerStart.gy);
    }

    const scale = 1 + (n - 1) * 0.22;
    this.enemies = data.enemies.map(e => new Enemy(e.name, e.gx, e.gy, scale));

    this.boss = null; this.bossIntro = false;
    if (data.boss) {
      const bs = Math.max(1, 1 + (Math.floor(n/3) - 1) * 0.3);
      this.boss = new Enemy(data.boss.name, data.boss.gx, data.boss.gy, bs, true);
    }

    this.npcs   = data.npcs.map(d => new NPC(d.name, d.gx, d.gy));
    this.shrine = data.shrine ? new Shrine(data.shrine.gx, data.shrine.gy) : null;
    this.items.clear();
    for (const it of data.items) this.items.set(`${it.gx},${it.gy}`, it.name);

    this.arrows    = [];
    this.particles = [];
    deathAlpha     = 0;
    deathActive    = false;

    // FIX: track total enemies so we know when ALL are dead
    this._totalEnemies = this.enemies.length + (this.boss ? 1 : 0);
    this._killedCount  = 0;

    UI.setFloor(n, data.zone_name);
    UI.setKills(this.player.kills);
    UI.hideBoss();

    // Floor narrative — fire and forget, never blocks
    safeFetch(`${API_BASE}/api/narrative`, {
      kind:"floor", floor_number:n, zone_name:data.zone_name
    }).then(d => { if (d?.text) setTimeout(() => UI.showNarrative(d.text), 1000); });

    Screens.hideOverlay("loading-screen");
    Screens.hideAllOverlays();
    this.state = "playing";
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    this.tick++;
    Shake.update();
    try {
      if (this.state === "playing") this.update();
    } catch(err) {
      console.error("Update error:", err);
      // Never freeze — if update crashes, stay in playing state
    }
    this.draw();
  },

  update() {
    if (!this.player || !this.dungeon) return;

    this.player.update(this.dungeon, Keys);
    cameraFollow(this.player);

    // Arrows
    const allTargets = this.boss ? [...this.enemies, this.boss] : [...this.enemies];
    for (const a of this.arrows) a.update(this.dungeon, allTargets);
    this.arrows = this.arrows.filter(a => a.alive);

    // Enemies
    for (const e of this.enemies) e.update(this.player, this.dungeon);

    for (const e of this.enemies) {
      if (e.hp <= 0 && !e._xpGiven) {
        e._xpGiven = true;
        this._killedCount++;
        this.player.gainXp(e.xpValue);
        this.player.gold += Math.floor(Math.random() * 10 + 5);
        this.player.kills++;
        UI.setKills(this.player.kills);
        Audio.kill();
        this._spawnParticles(e.x, e.y, e.colour);
        const eName = e.name;
        safeFetch(`${API_BASE}/api/narrative`, {kind:"death", enemy_name:eName})
          .then(d => { if (d?.text) UI.toast(d.text, ""); });
      }
    }
    this.enemies = this.enemies.filter(e => !e.isDeadDone);

    // Boss
    if (this.boss) {
      if (!this.bossIntro &&
          Math.abs(this.boss.gx - this.player.gx) < 10 &&
          Math.abs(this.boss.gy - this.player.gy) < 10) {
        this.bossIntro = true;
        UI.showBoss(this.boss);
        Audio.boss(); Shake.trigger(12, 20);
        safeFetch(`${API_BASE}/api/boss_taunt`, {
          boss_name:this.boss.name, lore:this.boss.lore, phase:1
        }).then(d => { if (d?.taunt) UI.toast(`"${d.taunt}"`, "bad"); });
      }
      this.boss.update(this.player, this.dungeon);
      UI.updateBoss(this.boss);

      if (this.boss.phase2Done && !this.boss._phase2Announced) {
        this.boss._phase2Announced = true;
        UI.toast(`${this.boss.name} ENRAGES!`, "bad");
        Shake.trigger(10, 16);
        safeFetch(`${API_BASE}/api/boss_taunt`, {
          boss_name:this.boss.name, lore:this.boss.lore, phase:2
        }).then(d => { if (d?.taunt) UI.toast(`"${d.taunt}"`, "bad"); });
      }

      if (this.boss.hp <= 0 && !this.boss._xpGiven) {
        this.boss._xpGiven = true;
        this._killedCount++;
        this.player.gainXp(this.boss.xpValue);
        this.player.gold += 150;
        this.player.kills++;
        UI.toast(`${this.boss.name} has fallen!`, "good");
        Audio.kill(); Audio.levelup();
        Shake.trigger(14, 20); UI.hideBoss();
        this._spawnParticles(this.boss.x, this.boss.y, this.boss.colour, 20);
      }
      if (this.boss.isDeadDone) this.boss = null;
    }

    for (const npc of this.npcs) npc.update();
    if (this.shrine) this.shrine.update();

    // Particles
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--; p.r *= 0.94;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Item pickup
    const ikey = `${this.player.gx},${this.player.gy}`;
    if (this.items.has(ikey)) {
      const name = this.items.get(ikey);
      this.items.delete(ikey);
      this.player.pickItem(name);
      UI.toast(`Found ${name}!`, "info");
      safeFetch(`${API_BASE}/api/narrative`, {
        kind:"item", item_name:name, item_desc:ITEM_DEFS[name]?.desc||""
      }).then(d => { if (d?.text) UI.showNarrative(d.text); });
    }

    UI.updatePlayer(this.player);
    UI.drawMinimap(this.player,
      this.boss ? [...this.enemies, this.boss] : this.enemies,
      this.npcs, this.dungeon);

    // ── STAIRS ──
    // FIX: must have killed ALL enemies that spawned (not just current array)
    // This prevents empty-array-passes-every() bug
    const allKilled = this._killedCount >= this._totalEnemies;
    const nearStairs =
      Math.abs(this.player.gx - this.dungeon.stairsPos.gx) <= 1 &&
      Math.abs(this.player.gy - this.dungeon.stairsPos.gy) <= 1;

    if (nearStairs && allKilled) {
      this.state = "floor_clear";
      Audio.stairs();
      if (this.floorNumber >= 9) {
        UI.showVictoryStats(this.player);
        Screens.showOverlay("victory-screen");
      } else {
        UI.showFloorClearStats(this.player, this.floorNumber, this.dungeon.zoneName);
        Screens.showOverlay("floor-clear-screen");
      }
      return;
    }

    // Show hint if near stairs but enemies remain
    if (nearStairs && !allKilled) {
      const remaining = this._totalEnemies - this._killedCount;
      UI.toast(`${remaining} enemy${remaining>1?"s":""} remain — clear them first!`, "bad");
    }

    // ── DEATH ──
    if (!this.player.isAlive && this.state === "playing") {
      this.state  = "dying";
      deathActive = true;
      Audio.death(); Shake.trigger(15, 30);
      setTimeout(() => {
        deathActive = false;
        this.state  = "gameover";
        UI.showDeathStats(this.player, this.floorNumber);
        Screens.showOverlay("gameover-screen");
      }, 1800);
    }
  },

  draw() {
    ctx.fillStyle = "#050310";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.dungeon) return;

    this.dungeon.draw(ctx, Camera.x, Camera.y, this.tick);
    this.dungeon.drawItems(ctx, Camera.x, Camera.y, this.items, this.tick);
    for (const npc of this.npcs) npc.draw(ctx, Camera.x, Camera.y);
    if (this.shrine) this.shrine.draw(ctx, Camera.x, Camera.y);
    for (const e of this.enemies) e.draw(ctx, Camera.x, Camera.y);
    if (this.boss) this.boss.draw(ctx, Camera.x, Camera.y);

    for (const p of this.particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x - Camera.x + Shake.x, p.y - Camera.y + Shake.y, p.r, 0, Math.PI*2);
      ctx.fill(); ctx.restore();
    }

    for (const a of this.arrows) a.draw(ctx, Camera.x, Camera.y);
    if (this.player && !this.player._dead) this.player.draw(ctx, Camera.x, Camera.y);

    // Death animation
    if (deathActive || this.state === "dying") {
      deathAlpha = Math.min(1, deathAlpha + 0.012);
      ctx.fillStyle = `rgba(60,0,0,${deathAlpha * 0.92})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (deathAlpha > 0.35) {
        ctx.font      = "bold 52px 'Cinzel',serif";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(220,60,60,${(deathAlpha-0.35)*1.6})`;
        ctx.fillText("Arjun has fallen…", canvas.width/2, canvas.height/2);
      }
    }

    // Controls
    if (this.state === "playing") {
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.font = "11px 'Crimson Pro',serif";
      ctx.textAlign = "left";
      ctx.fillText(
        "WASD: move  ·  Space: attack  ·  Shift: dash  ·  Q: shoot  ·  E: talk/shrine",
        14, canvas.height - 12
      );
    }
  },

  _spawnParticles(x, y, colour, count=10) {
    for (let i=0; i<count; i++) {
      const ang = Math.random()*Math.PI*2, spd = Math.random()*4+1;
      this.particles.push({
        x, y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-2,
        colour, r:Math.random()*6+2, life:35+Math.floor(Math.random()*20), maxLife:55,
      });
    }
  },

  _doAttack() {
    if (this.state !== "playing" || !this.player) return;
    const targets = this.boss && this.boss.hp > 0
      ? [...this.enemies, this.boss] : [...this.enemies];
    this.player.doAttack(targets);
  },

  _shootArrow() {
    if (this.state !== "playing" || !this.player) return;
    const a = this.player.shootArrow();
    if (a) this.arrows.push(a);
    else UI.toast("No arrows — find a Quiver!", "bad");
  },

  _tryShrine() {
    if (!this.shrine || this.shrine.used) { UI.toast("Shrine is spent.", ""); return; }
    if (this.player.gold < 30) { UI.toast("Need ⛁30 to use shrine.", "bad"); return; }
    this.shrine.used = true;
    this.player.useShrine();
    UI.toast("Shrine mends your wounds. −⛁30", "good");
    this._spawnParticles(this.shrine.x, this.shrine.y, "#3cdc78", 12);
  },

  _startDialogue(npc) {
    this.activeNPC = npc;
    this.state     = "dialogue";
    // Show greeting immediately
    Dialogue.open(npc.name, npc.role, npc.greeting);
    // Fetch contextual line — updates text when ready, no "thinking" state
    safeFetch(`${API_BASE}/api/dialogue`, {
      npc_name:     npc.name,
      npc_role:     npc.role,
      player_line:  `I am on floor ${this.floorNumber} (${this.dungeon?.zoneName||""}), level ${this.player?.level||1}, ${this.player?.kills||0} kills.`,
      history:      npc.history.slice(-2),
      floor_number: this.floorNumber,
      player_level: this.player?.level || 1,
    }).then(d => {
      if (d?.reply && this.state === "dialogue" && this.activeNPC === npc) {
        npc.history.push({ player:"context", npc:d.reply });
        Dialogue.open(npc.name, npc.role, d.reply);
      }
      // If no reply, greeting stays — no freeze
    });
  },

  _endDialogue() {
    Dialogue.close();
    this.activeNPC = null;
    if (this.state === "dialogue") this.state = "playing";
  },
};

// ── Camera ────────────────────────────────────
const Camera = { x:0, y:0 };
function cameraFollow(t) {
  Camera.x = t.x - canvas.width  / 2;
  Camera.y = t.y - canvas.height / 2;
}

// ── Keyboard ─────────────────────────────────
function handleKeyDown(e) {
  if (Game.state === "dialogue") {
    if (e.key==="e"||e.key==="E"||e.key==="Escape") {
      e.preventDefault(); Game._endDialogue();
    }
    return;
  }
  if (Game.state !== "playing") return;

  if (e.code === "Space")   { e.preventDefault(); Game._doAttack(); return; }
  if (e.code === "ShiftLeft"||e.code==="ShiftRight") { e.preventDefault(); Game.player?.dash(); return; }
  if (e.code === "KeyQ")    { e.preventDefault(); Game._shootArrow(); return; }
  if (e.key  === "e"||e.key==="E") {
    e.preventDefault();
    if (Game.shrine?.inRange(Game.player)) { Game._tryShrine(); return; }
    for (const npc of Game.npcs) {
      if (npc.inRange(Game.player)) { Game._startDialogue(npc); return; }
    }
  }
}

// ── Buttons ───────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => Game.start());

document.getElementById("btn-descend").addEventListener("click", async () => {
  Screens.hideOverlay("floor-clear-screen");
  Game.floorNumber++;
  await Game.loadFloor(Game.floorNumber, true);
});

document.getElementById("btn-levelup-ok")?.addEventListener("click", () => {
  Screens.hideOverlay("levelup-screen");
  if (Game.state === "levelup") Game.state = "playing";
});

// ── Boot ──────────────────────────────────────
initMenuParticles();
animateMenuParticles();
