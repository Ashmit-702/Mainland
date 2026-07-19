// MAINLAND — game.js

const canvas = document.getElementById("game-canvas");
const ctx    = canvas.getContext("2d");
const menuCanvas = document.getElementById("menu-canvas");
const mctx = menuCanvas ? menuCanvas.getContext("2d") : null;

function resizeCanvas() {
  // visualViewport tracks the actual visible area on mobile (excludes the
  // address bar/keyboard), which is more accurate than innerWidth/innerHeight
  // when the browser chrome shows/hides — prevents the canvas and HUD from
  // being sized larger than what's actually visible.
  const w = window.visualViewport ? window.visualViewport.width  : window.innerWidth;
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  canvas.width = w; canvas.height = h;
  if (menuCanvas) { menuCanvas.width = w; menuCanvas.height = h; }
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 100));
if (window.visualViewport) window.visualViewport.addEventListener("resize", resizeCanvas);

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

const TOTAL_FLOORS = 7; // 6 exploration floors + Floor 7: The Final War

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
  enemyBolts:    [],
  fireZones:     [],
  particles:     [],
  damageNumbers: [],
  activeNPC:     null,
  bossIntro:     false,
  _loopRunning:  false,
  _totalEnemies: 0,   // FIX: track total enemies spawned on floor
  _killedCount:  0,   // FIX: track kills on this floor separately
  _lastPlayerHp: null,
  comboCount:    0,
  comboTimer:    0,

  async start() {
    Audio.init();
    this.floorNumber = 1;
    this.player      = null;
    this._seenZones  = new Set();
    deathAlpha       = 0;
    deathActive      = false;
    await this.loadFloor(1, false);
    // FIX: this used to duck the menu theme at the very top of start(), in the
    // same instant as the click that first unlocks/fades it in — the fade-out
    // always won that race, so the intro theme was never actually audible on
    // the very first "Begin the Journey" click. Ducking after the floor has
    // loaded and the screen has switched gives the fade-in a moment to
    // actually be heard first, which is what "plays when I click" means.
    MenuTheme.duck();
    Screens.show("game-screen");
    Screens.hideAllOverlays();
    _maybeSuggestLandscape();
    if (!this._loopRunning) {
      this._loopRunning = true;
      requestAnimationFrame(() => this.loop());
    }
  },

  _playPrologue() {
    let i = 0;
    const step = () => {
      if (i >= PROLOGUE_LINES.length) return;
      UI.showNarrative(PROLOGUE_LINES[i], 4200);
      i++;
      setTimeout(step, 4600);
    };
    step();
  },

  restart() {
    this._resetState();
    Dialogue.close();
    Screens.hideAllOverlays();
    Screens.show("menu-screen");
    MenuTheme.restore();
    initMenuParticles();
    animateMenuParticles();
  },

  playAgain() {
    this._resetState();
    Dialogue.close();
    this.start();
  },

  _resetState() {
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
    this.enemyBolts   = [];
    this.fireZones    = [];
    this.particles    = [];
    this.damageNumbers = [];
    this.activeNPC    = null;
    this.bossIntro    = false;
    this._totalEnemies= 0;
    this._killedCount = 0;
    this._lastPlayerHp= null;
    this._seenZones   = new Set();
    this.comboCount   = 0;
    this.comboTimer   = 0;
    this.isFinalWar     = false;
    this.waveIndex       = -1;
    this.waveActive       = false;
    this.arenaTriggered  = false;
    this._waveClearedAt  = 0;
    deathAlpha        = 0;
    deathActive       = false;
    UI.setKey(false);
    UI.setSpecialArrow(0);
    UI.setCombo(0);
  },

  async loadFloor(n, carryPlayer=true) {
    Screens.showOverlay("loading-screen");
    document.getElementById("loading-text").textContent =
      n >= TOTAL_FLOORS ? "Marshaling the Field of Kurukshetra…"
      : n <= 2 ? "Carving the Outer Ruins…"
      : n <= 4 ? "Flooding the Blood Crypts…"
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

    const scale = 1 + (n - 1) * 0.26;
    this.enemies = data.enemies.map(e => new Enemy(e.name, e.gx, e.gy, scale, false, !!e.elite));

    this.boss = null; this.bossIntro = false;
    if (data.boss) {
      const bs = Math.max(1, 1 + (Math.floor(n/3) - 1) * 0.32);
      this.boss = new Enemy(data.boss.name, data.boss.gx, data.boss.gy, bs, true);
    }

    this.npcs   = data.npcs.map(d => new NPC(d.name, d.gx, d.gy, !!d.holds_key));
    this.shrine = data.shrine ? new Shrine(data.shrine.gx, data.shrine.gy) : null;
    this.items.clear();
    for (const it of data.items) this.items.set(`${it.gx},${it.gy}`, it.name);
    if (this.player) this.player.hasVaultKey = false;
    UI.setKey(false);
    this.comboCount = 0;
    this.comboTimer = 0;

    this.arrows     = [];
    this.enemyBolts = [];
    this.fireZones  = [];
    this.particles  = [];
    this.damageNumbers = [];
    deathAlpha     = 0;
    deathActive    = false;

    // FIX: track total enemies so we know when ALL are dead
    this._totalEnemies = this.enemies.length + (this.boss ? 1 : 0);
    this._killedCount  = 0;

    // Final War (floor 7) — scripted wave siege instead of stairs-gated clear
    this.isFinalWar    = this.dungeon.isFinalWar;
    this.waveIndex      = -1;
    this.waveActive      = false;
    this.arenaTriggered = false;
    this._waveClearedAt = 0;

    UI.setFloor(n, data.zone_name);
    UI.setKills(this.player.kills);
    UI.hideBoss();

    // First-time zone lore gets priority billing; floor narrative follows after.
    // Floor 1 also plays a multi-line prologue on the same overlay, so push these
    // back long enough that they don't cut the prologue off mid-sentence.
    const isNewZone = !this._seenZones.has(this.dungeon.zone);
    this._seenZones.add(this.dungeon.zone);
    const introDelay = (n === 1) ? 19000 : 0;
    const floorNarrativeDelay = (isNewZone ? 6200 : 1000) + introDelay;

    if (isNewZone && ZONE_LORE[this.dungeon.zone]) {
      setTimeout(() => UI.showNarrative(ZONE_LORE[this.dungeon.zone], 5500), 900 + introDelay);
    }

    // Floor narrative — fire and forget, never blocks
    safeFetch(`${API_BASE}/api/narrative`, {
      kind:"floor", floor_number:n, zone_name:data.zone_name
    }).then(d => { if (d?.text) setTimeout(() => UI.showNarrative(d.text), floorNarrativeDelay); });

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
    for (const a of this.arrows) {
      a.update(this.dungeon, allTargets);
      if (a.hitInfo) {
        const hi = a.hitInfo;
        this._spawnDamageNumber(hi.enemy.x, hi.enemy.y - 20, hi.dmg, hi.special, hi.special ? "#ffe080" : "#d4aa3a");
        if (hi.justWarded) {
          UI.toast(`${hi.enemy.name}'s ward flares to life — only the Vasavi Shakti can finish it now.`, "bad");
          Shake.trigger(6, 10);
        }
        if (hi.executed) {
          UI.toast("The Vasavi Shakti finds its mark!", "good");
          Shake.trigger(14, 18);
          this._spawnParticles(hi.enemy.x, hi.enemy.y, "#ffe080", 22);
        }
      }
    }
    this.arrows = this.arrows.filter(a => a.alive);

    // Enemy ranged/AoE attacks
    for (const b of this.enemyBolts) b.update(this.dungeon, this.player);
    this.enemyBolts = this.enemyBolts.filter(b => b.alive);
    for (const z of this.fireZones) z.update(this.player);
    this.fireZones = this.fireZones.filter(z => z.alive);

    // Enemies
    for (const e of this.enemies) {
      const spawn = e.update(this.player, this.dungeon);
      if (spawn) this._handleEnemySpawn(spawn);
    }

    for (const e of this.enemies) {
      if (e.hp <= 0 && !e._xpGiven) {
        e._xpGiven = true;
        this._killedCount++;
        this.player.gainXp(e.xpValue);
        let goldGain = Math.floor(Math.random() * 10 + 5);
        this._registerCombo();
        if (this.comboCount >= 2) goldGain += this.comboCount * 2;
        this.player.gold += goldGain;
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
        UI.showNarrative(this.boss.lore, 5500);
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

    // Track player damage taken (enemy/boss attacks call player.takeDamage internally)
    if (this._lastPlayerHp === null) this._lastPlayerHp = this.player.hp;
    if (this.player.hp < this._lastPlayerHp) {
      this._spawnDamageNumber(this.player.x, this.player.y - 24, this._lastPlayerHp - this.player.hp, false, "#e05050");
    }
    this._lastPlayerHp = this.player.hp;

    // Particles
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--; p.r *= 0.94;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Floating damage numbers
    for (const d of this.damageNumbers) { d.y += d.vy; d.vy += 0.02; d.life--; }
    this.damageNumbers = this.damageNumbers.filter(d => d.life > 0);

    // Kill combo decay
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) { this.comboCount = 0; UI.setCombo(0); }
    }

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

    // ── STAIRS (normal floors) / FINAL WAR (floor 7) ──
    if (this.isFinalWar) {
      this._updateFinalWar();
    } else {
      // FIX: must have killed ALL enemies that spawned (not just current array)
      // This prevents empty-array-passes-every() bug
      const allKilled = this._killedCount >= this._totalEnemies;
      const nearStairs =
        Math.abs(this.player.gx - this.dungeon.stairsPos.gx) <= 1 &&
        Math.abs(this.player.gy - this.dungeon.stairsPos.gy) <= 1;

      if (nearStairs && allKilled) {
        this.state = "floor_clear";
        Audio.stairs();
        UI.showFloorClearStats(this.player, this.floorNumber, this.dungeon.zoneName);
        Screens.showOverlay("floor-clear-screen");
        return;
      }

      // Show hint if near stairs but enemies remain
      if (nearStairs && !allKilled) {
        const remaining = this._totalEnemies - this._killedCount;
        UI.toast(`${remaining} enemy${remaining>1?"s":""} remain — clear them first!`, "bad");
      }
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
    for (const z of this.fireZones) z.draw(ctx, Camera.x, Camera.y, this.tick);
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
    for (const b of this.enemyBolts) b.draw(ctx, Camera.x, Camera.y);
    if (this.player && !this.player._dead) this.player.draw(ctx, Camera.x, Camera.y);

    for (const d of this.damageNumbers) {
      const a = Math.max(0, d.life / d.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = d.crit ? "bold 20px 'Cinzel',serif" : "bold 14px 'Cinzel',serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(String(d.amount), d.x - Camera.x + Shake.x + 1, d.y - Camera.y + Shake.y + 1);
      ctx.fillStyle = d.colour;
      ctx.fillText(String(d.amount), d.x - Camera.x + Shake.x, d.y - Camera.y + Shake.y);
      ctx.restore();
    }

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
      const hint = document.body.classList.contains("touch-device")
        ? "Joystick: move  ·  ⚔ Attack  ·  ↑ Arrow  ·  ⚡ Dash  ·  E: talk/shrine"
        : "WASD: move  ·  Space: attack  ·  Shift: dash  ·  Q: shoot  ·  R: divine arrow  ·  E: talk/shrine";
      ctx.fillText(hint, 14, canvas.height - 12);
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
    const hits = this.player.doAttack(targets);
    for (const h of hits) {
      this._spawnDamageNumber(h.enemy.x, h.enemy.y - 20, h.dmg, h.crit);
      if (h.crit) UI.toast(`Critical hit! −${h.dmg}`, "good");
      if (h.justWarded) {
        UI.toast(`${h.enemy.name}'s ward flares to life — only the Vasavi Shakti can finish it now.`, "bad");
        Shake.trigger(6, 10);
      }
    }
  },

  _spawnDamageNumber(x, y, amount, crit=false, colour=null) {
    this.damageNumbers.push({
      x, y, amount, crit,
      colour: colour || (crit ? "#ffd040" : "#f0e0c0"),
      vy: -1.4, life: 42, maxLife: 42,
    });
  },

  _shootArrow() {
    if (this.state !== "playing" || !this.player) return;
    const a = this.player.shootArrow();
    if (a) this.arrows.push(a);
    else UI.toast("No arrows — find a Quiver!", "bad");
  },

  _shootSpecialArrow() {
    if (this.state !== "playing" || !this.player) return;
    if (this.player.specialArrows <= 0) { UI.toast("No divine arrow ready.", "bad"); return; }
    const a = this.player.shootSpecialArrow();
    if (a) {
      this.arrows.push(a);
      UI.setSpecialArrow(this.player.specialArrows);
    }
  },

  _handleEnemySpawn(spawn) {
    if (spawn.type === "bolt") {
      this.enemyBolts.push(new EnemyBolt(spawn.x, spawn.y, spawn.dx, spawn.dy, spawn.dmg, spawn.colour));
      Audio.enemyShoot();
    } else if (spawn.type === "firezone") {
      this.fireZones.push(new FireZone(spawn.x, spawn.y, TILE * 1.4, spawn.dmg));
      Audio.fireCast();
    }
  },

  _registerCombo() {
    this.comboCount++;
    this.comboTimer = 150; // ~2.5s at 60fps to keep the combo alive
    UI.setCombo(this.comboCount);
    if (this.comboCount === 3) UI.toast("Combo x3!", "good");
    else if (this.comboCount === 5) UI.toast("Combo x5 — relentless!", "good");
    else if (this.comboCount >= 8 && this.comboCount % 4 === 0) UI.toast(`Combo x${this.comboCount}!`, "good");
  },

  _tryDoor() {
    const door = this.dungeon?.nearestLockedDoor(this.player, this.player.interactRange);
    if (!door) return false;
    if (this.player.hasVaultKey) {
      this.dungeon.unlockDoors();
      this.player.hasVaultKey = false;
      UI.setKey(false);
      UI.toast("The vault door grinds open.", "good");
      Audio.doorUnlock();
      Shake.trigger(5, 12);
      const cx = door.gx * TILE + TILE/2, cy = door.gy * TILE + TILE/2;
      this._spawnParticles(cx, cy, "#f0cc60", 16);
    } else {
      UI.toast("Locked. Someone nearby might carry the key…", "bad");
    }
    return true;
  },

  _tryShrine() {
    if (!this.shrine || this.shrine.used) { UI.toast("Shrine is spent.", ""); return; }
    if (this.player.gold < 30) { UI.toast("Need ⛁30 to use shrine.", "bad"); return; }
    this.shrine.used = true;
    this.player.useShrine();
    UI.toast("Shrine mends your wounds. −⛁30", "good");
    this._spawnParticles(this.shrine.x, this.shrine.y, "#3cdc78", 12);
  },

  // ── Final War (floor 7) — scripted multi-wave siege ──
  _updateFinalWar() {
    const arena = this.dungeon.arena;
    if (!arena) return;

    if (!this.arenaTriggered) {
      const inArena =
        this.player.gx >= arena.x && this.player.gx < arena.x + arena.w &&
        this.player.gy >= arena.y && this.player.gy < arena.y + arena.h;
      if (inArena) { this.arenaTriggered = true; this._startFinalWar(); }
      return;
    }

    if (this.waveActive) {
      const wave = this.dungeon.waves[this.waveIndex];
      const cleared = wave.type === "boss" ? (this.boss === null) : (this.enemies.length === 0);
      if (cleared) { this.waveActive = false; this._waveClearedAt = this.tick; }
      return;
    }

    if (this.tick - this._waveClearedAt > 90) this._advanceWave();
  },

  _startFinalWar() {
    UI.toast("The Final War begins.", "bad");
    UI.showNarrative("There is no floor beneath this one. Only the field, and what's left standing on it.", 5000);
    Shake.trigger(10, 24);
    this._waveClearedAt = this.tick;
  },

  _advanceWave() {
    this.waveIndex++;
    const waves = this.dungeon.waves;
    if (this.waveIndex >= waves.length) { this._finalWarVictory(); return; }

    const wave = waves[this.waveIndex];
    this.waveActive = true;
    UI.toast(wave.label, "bad");
    UI.showNarrative(wave.label, 3800);
    Shake.trigger(8, 16);

    if (wave.type === "boss") this._spawnWaveBoss(wave.boss);
    else this._spawnWaveEnemies(wave.enemies, wave.type === "elites");
  },

  _spawnWaveEnemies(names, elite) {
    const arena = this.dungeon.arena;
    const scale = 1 + (this.floorNumber - 1) * 0.26;
    for (const name of names) {
      const gx = arena.x + 1 + Math.floor(Math.random() * Math.max(1, arena.w - 2));
      const gy = arena.y + 1 + Math.floor(Math.random() * Math.max(1, arena.h - 2));
      this.enemies.push(new Enemy(name, gx, gy, scale, false, elite));
    }
  },

  _spawnWaveBoss(name) {
    const arena = this.dungeon.arena;
    this.boss = new Enemy(name, arena.cx, arena.cy, 1.6, true);
    this.bossIntro = false;
    UI.hideBoss(); // reappears once the existing proximity-based intro fires
  },

  _finalWarVictory() {
    this.state = "floor_clear";
    Audio.stairs();
    UI.showVictoryStats(this.player);
    Screens.showOverlay("victory-screen");
    setTimeout(() => UI.showNarrative(EPILOGUE_TEXT, 7000), 400);
  },

  _startDialogue(npc) {
    this.activeNPC = npc;
    this.state     = "dialogue";

    // Special one-time moments tied to specific characters — checked together so a
    // character who happens to both hold the key AND be Karna isn't shortchanged.
    const grantsKey   = npc.holdsKey && !npc.keyGiven && !this.player.hasVaultKey;
    const grantsArrow = npc.name === "Karna" && !this.player.gotKarnaGift;

    if (grantsKey || grantsArrow) {
      const lines = [];
      if (grantsKey) {
        npc.keyGiven = true; npc.talked = true; this.player.hasVaultKey = true;
        UI.setKey(true);
        lines.push(npc.keyLine);
        UI.toast(`${npc.name} gives you the Vault Key.`, "good");
      }
      if (grantsArrow) {
        this.player.gotKarnaGift = true;
        this.player.specialArrows += 1;
        UI.setSpecialArrow(this.player.specialArrows);
        lines.push(KARNA_ARROW_LINE);
        UI.toast("Karna gifts you the Vasavi Shakti.", "good");
      }
      Audio.keyGet();
      Dialogue.open(npc.name, npc.role, lines.join("  "));
      return;
    }

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
      already_gave_key: npc.holdsKey && npc.keyGiven,
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

  _togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      Screens.showOverlay("pause-screen");
    } else if (this.state === "paused") {
      this.state = "playing";
      Screens.hideOverlay("pause-screen");
    }
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
  if (e.key === "Escape" && (Game.state === "playing" || Game.state === "paused")) {
    e.preventDefault(); Game._togglePause();
    return;
  }
  if (Game.state !== "playing") return;

  if (e.code === "Space")   { e.preventDefault(); Game._doAttack(); return; }
  if (e.code === "ShiftLeft"||e.code==="ShiftRight") { e.preventDefault(); Game.player?.dash(); return; }
  if (e.code === "KeyQ")    { e.preventDefault(); Game._shootArrow(); return; }
  if (e.code === "KeyR")    { e.preventDefault(); Game._shootSpecialArrow(); return; }
  if (e.key  === "e"||e.key==="E") {
    e.preventDefault();
    if (Game._tryDoor()) return;
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

document.getElementById("btn-pause")?.addEventListener("click", () => Game._togglePause());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Audio.ctx && Audio.ctx.state === "suspended") {
    Audio.ctx.resume().catch(() => {});
  }
});

// ── Touch controls (mobile) ───────────────────
(function setupTouchControls() {
  // Belt-and-suspenders detection: some Android WebViews/in-app browsers report
  // ontouchstart/maxTouchPoints inconsistently, so a coarse-pointer media check
  // is included too. CSS also has its own @media(pointer:coarse) fallback so
  // controls still appear even if this JS check somehow misses.
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0 ||
                   (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  if (isTouch) document.body.classList.add("touch-device");

  const zone  = document.getElementById("touch-joystick-zone");
  const base  = document.getElementById("touch-joystick-base");
  const stick = document.getElementById("touch-joystick-stick");
  if (!zone || !base || !stick) return;

  let joystickId = null, baseX = 0, baseY = 0;
  const RADIUS = 46;
  // Current on/off state per axis, kept here (rather than re-derived from Keys
  // each call) so we can apply hysteresis: a direction needs to pass a higher
  // threshold to ENGAGE but only needs to drop below a lower threshold to stay
  // engaged. Without this, a finger sitting near the old single 0.25 boundary
  // would flicker a direction on/off every frame — that flicker is what read
  // as "not smooth" compared to keyboard input, which has no such deadzone edge.
  let active = { left:false, right:false, up:false, down:false };
  const ON = 0.18, OFF = 0.10;

  function setKeysFromVector(dx, dy) {
    active.left  = dx < -OFF && (active.left  || dx < -ON);
    active.right = dx >  OFF && (active.right || dx >  ON);
    active.up    = dy < -OFF && (active.up    || dy < -ON);
    active.down  = dy >  OFF && (active.down  || dy >  ON);
    Keys["ArrowLeft"]=Keys["a"]=Keys["KeyA"]   = active.left;
    Keys["ArrowRight"]=Keys["d"]=Keys["KeyD"]  = active.right;
    Keys["ArrowUp"]=Keys["w"]=Keys["KeyW"]     = active.up;
    Keys["ArrowDown"]=Keys["s"]=Keys["KeyS"]   = active.down;
  }
  function clearMoveKeys() {
    active = { left:false, right:false, up:false, down:false };
    setKeysFromVector(0, 0);
  }

  zone.addEventListener("touchstart", e => {
    Audio.init();
    const t = e.changedTouches[0];
    joystickId = t.identifier;
    const rect = base.getBoundingClientRect();
    baseX = rect.left + rect.width/2; baseY = rect.top + rect.height/2;
    base.classList.add("active");
    e.preventDefault();
  }, { passive:false });

  zone.addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joystickId) continue;
      let dx = t.clientX - baseX, dy = t.clientY - baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS) { dx = dx/dist*RADIUS; dy = dy/dist*RADIUS; }
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      setKeysFromVector(dx/RADIUS, dy/RADIUS);
    }
    e.preventDefault();
  }, { passive:false });

  function endJoystick(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joystickId) continue;
      joystickId = null;
      stick.style.transform = "translate(-50%,-50%)";
      base.classList.remove("active");
      clearMoveKeys();
    }
  }
  zone.addEventListener("touchend", endJoystick);
  zone.addEventListener("touchcancel", endJoystick);

  function bindTap(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("touchstart", e => { e.preventDefault(); Audio.init(); fn(); }, { passive:false });
  }
  bindTap("touch-attack",   () => Game._doAttack());
  bindTap("touch-arrow",    () => Game._shootArrow());
  bindTap("touch-special",  () => Game._shootSpecialArrow());
  bindTap("touch-dash",     () => Game.player?.dash());
  bindTap("touch-interact", () => {
    if (Game.state === "dialogue") { Game._endDialogue(); return; }
    if (Game._tryDoor()) return;
    if (Game.shrine?.inRange(Game.player)) { Game._tryShrine(); return; }
    for (const npc of Game.npcs) {
      if (npc.inRange(Game.player)) { Game._startDialogue(npc); return; }
    }
  });
})();

// ── Menu background theme ──────────────────────
// Drop your own file in as audio/mainland-intro.mp3 (or .ogg) — plays once on
// the menu (browsers require a first click/tap/key before any sound can play —
// this fires on whichever comes first). Fades out once a run starts; if you
// return to the menu it resumes only if it hadn't finished yet, never restarts.
function _fadeAudioEl(el, target, duration=800) {
  if (!el) return;
  const start = el.volume, delta = target - start, startTime = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    el.volume = start + delta * t;
    if (t < 1) requestAnimationFrame(step);
    else if (target === 0) el.pause();
  }
  requestAnimationFrame(step);
}

const MenuTheme = {
  el: null, muted: false, started: false, finished: false,

  init() {
    this.el = document.getElementById("intro-theme");
    if (!this.el) return;
    this.el.volume = 0;
    this.el.addEventListener("ended", () => { this.finished = true; });
    // FIX: this used to set `started = true` on the very first gesture event
    // seen (pointerdown fires before touchend on mobile) and never try again,
    // even if that specific attempt was rejected. Some mobile browsers only
    // treat a completed tap (touchend/click) as valid for unlocking audio,
    // not the initial touch (pointerdown) — so the first, invalid-on-mobile
    // attempt was permanently blocking the second, valid one from retrying.
    // Now it only locks in once play() actually succeeds, and keeps
    // listening on every gesture type until one works.
    const tryPlay = () => {
      if (this.started) return;
      this.el.play()
        .then(() => {
          this.started = true;
          _fadeAudioEl(this.el, this.muted ? 0 : 0.55, 1200);
          cleanup();
        })
        .catch(() => {}); // this gesture type wasn't accepted — leave listeners active for the next one
    };
    function cleanup() {
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("touchend", tryPlay);
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    }
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("touchend", tryPlay);
    window.addEventListener("click", tryPlay);
    window.addEventListener("keydown", tryPlay);
  },

  duck()   { _fadeAudioEl(this.el, 0, 700); },
  restore(){
    if (!this.el || this.muted || !this.started || this.finished) return;
    if (this.el.paused) this.el.play().catch(() => {});
    _fadeAudioEl(this.el, 0.55, 900);
  },
  toggleMute() {
    this.muted = !this.muted;
    _fadeAudioEl(this.el, this.muted ? 0 : 0.55, 400);
    const btn = document.getElementById("btn-mute-intro");
    if (btn) btn.textContent = this.muted ? "🔇" : "🔊";
  },
};

document.getElementById("btn-mute-intro")?.addEventListener("click", () => MenuTheme.toggleMute());

document.getElementById("btn-lore")?.addEventListener("click", () => {
  Screens.showOverlay("lore-screen");
});
document.getElementById("btn-lore-close")?.addEventListener("click", () => {
  Screens.hideOverlay("lore-screen");
});
document.getElementById("btn-lore-begin")?.addEventListener("click", () => {
  Screens.hideOverlay("lore-screen");
  Game.start();
});
document.getElementById("btn-dialogue-close")?.addEventListener("click", () => Game._endDialogue());

// ── Lore call-to-action ────────────────────────
// Permanently visible (not a timed hint) — the person asked for it to stay
// constant rather than fade in/out.
document.getElementById("btn-lore")?.classList.add("lore-pulse");

// ── Boot ──────────────────────────────────────
// Runtime title auto-fit — a hard guarantee against overflow that doesn't depend
// on getting font-metrics/vw-math right for every browser/engine/font-fallback
// combination. Measures the ACTUAL rendered width and shrinks until it fits.
function fitGameTitle() {
  const el = document.querySelector(".game-title");
  const container = document.querySelector(".menu-content");
  if (!el || !container) return;
  el.style.fontSize = "";
  requestAnimationFrame(() => {
    const maxWidth = container.clientWidth - 8; // small safety margin
    let fontSize = parseFloat(getComputedStyle(el).fontSize);
    // FIX: this used to step down 1px at a time capped at 60 iterations. The
    // starting size (up to 112px) plus letter-spacing routinely overflowed by
    // more than 60px on wide screens, so the loop ran out before the text
    // actually fit — and with overflow:hidden on the title, the tail end
    // (the right half of the final letter) got silently clipped, which is
    // exactly what made "MAINLAND" render as "MAINLANI". Scaling directly by
    // the width ratio converges immediately regardless of how far off the
    // starting size is; a few 1px correction passes clean up rounding.
    if (el.scrollWidth > maxWidth) {
      fontSize *= maxWidth / el.scrollWidth;
      el.style.fontSize = fontSize + "px";
    }
    let guard = 0;
    while (el.scrollWidth > maxWidth && fontSize > 18 && guard < 100) {
      fontSize -= 1;
      el.style.fontSize = fontSize + "px";
      guard++;
    }
  });
}
window.addEventListener("load", fitGameTitle);
window.addEventListener("resize", fitGameTitle);
document.fonts?.ready?.then(fitGameTitle); // re-fit once webfonts actually finish loading

function _maybeSuggestLandscape() {
  const narrowPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
  if (!narrowPortrait || document.getElementById("rotate-hint")) return;
  const el = document.createElement("div");
  el.id = "rotate-hint";
  el.innerHTML = `↻ Rotating to landscape gives more room to fight <button aria-label="Dismiss">✕</button>`;
  el.querySelector("button").addEventListener("click", () => el.remove());
  document.getElementById("game-screen")?.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
window.addEventListener("orientationchange", () => {
  document.getElementById("rotate-hint")?.remove();
});

MenuTheme.init();
initMenuParticles();
animateMenuParticles();

// ── Debug panel (opt-in via ?debug=1) ─────────
// Shows real on-device diagnostics — actual touch detection result, actual
// AudioContext state, and any uncaught JS errors — directly on screen. Meant
// for screenshotting from a real phone when something's misbehaving there,
// since remote guessing from code alone has a low hit rate for device- and
// browser-specific issues.
if (new URLSearchParams(location.search).get("debug") === "1") {
  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(0,0,0,.88);color:#0f0;font:11px/1.5 monospace;padding:8px;max-height:45vh;overflow-y:auto;white-space:pre-wrap;pointer-events:none";
  document.body.appendChild(panel);
  const errors = [];
  window.addEventListener("error", e => {
    errors.push(`JS: ${e.message} (${e.filename?.split("/").pop()}:${e.lineno})`);
    render();
  });
  // FIX: Game.start() is an async function — an error thrown anywhere inside
  // it (e.g. during the floor-load fetch chain) becomes an unhandled promise
  // rejection, which window.onerror does NOT catch. That's the likely gap
  // that let a black-screen-on-start bug hide from the first debug panel.
  window.addEventListener("unhandledrejection", e => {
    errors.push(`Promise: ${e.reason?.message || e.reason}`);
    render();
  });
  function render() {
    const ac = Audio.ctx;
    const activeScreen = document.querySelector(".screen.active")?.id || "(none active)";
    panel.textContent =
`UA: ${navigator.userAgent}
touch-device class: ${document.body.classList.contains("touch-device")}
ontouchstart: ${"ontouchstart" in window} | maxTouchPoints: ${navigator.maxTouchPoints} | pointer:coarse: ${window.matchMedia("(pointer: coarse)").matches}
AudioContext: ${ac ? ac.state : "not created yet"}
intro-theme el: ${document.getElementById("intro-theme") ? "found" : "MISSING"} | paused: ${document.getElementById("intro-theme")?.paused} | readyState: ${document.getElementById("intro-theme")?.readyState}
viewport: ${window.innerWidth}x${window.innerHeight} | dpr: ${window.devicePixelRatio}
active screen: ${activeScreen}
Game.state: ${typeof Game !== "undefined" ? Game.state : "Game undefined"} | dungeon: ${typeof Game !== "undefined" && Game.dungeon ? "loaded" : "null"} | player: ${typeof Game !== "undefined" && Game.player ? "loaded" : "null"}
errors (${errors.length}):
${errors.join("\n") || "(none)"}`;
  }
  render();
  setInterval(render, 500);
}
