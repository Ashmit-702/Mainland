// ─────────────────────────────────────────────
//  MAINLAND — entities.js
//  Player, Enemy, NPC classes (browser canvas)
// ─────────────────────────────────────────────

const TILE = 48;

// ── shared stat tables (mirrors config.py) ──
const ENEMY_DEFS = {
  Asura:    { hp:60,  attack:12, speed:2, colour:"#b43232", xp:30,  lore:"A demon warrior cursed by Indra." },
  Rakshasa: { hp:90,  attack:18, speed:1, colour:"#8c1e8c", xp:50,  lore:"A shape-shifting night terror." },
  Naga:     { hp:45,  attack:8,  speed:3, colour:"#1e8c50", xp:20,  lore:"A serpent spirit guarding ancient gold." },
  Pishacha: { hp:70,  attack:14, speed:2, colour:"#6450c8", xp:35,  lore:"A flesh-eating phantom from the underworld." },
  Vetala:   { hp:110, attack:22, speed:1, colour:"#3c3ca0", xp:60,  lore:"An ancient vampire that inhabits corpses." },
};

const BOSS_DEFS = {
  Duryodhana: { hp:400, attack:35, speed:1, colour:"#c82828", xp:300, lore:"The iron-thighed king of Hastinapur.", phase2:0.5 },
  Kali:       { hp:600, attack:45, speed:2, colour:"#3c145a", xp:500, lore:"The demon of this dark age.", phase2:0.4 },
};

const NPC_DEFS = {
  Draupadi: { colour:"#3cb8b0", role:"sage",     greeting:"Arjun, the Mainland crumbles. Seek the Brahmastra." },
  Karna:    { colour:"#dc9632", role:"rival",    greeting:"We meet again, Arjun. Prove your worth." },
  Shakuni:  { colour:"#b450b4", role:"trickster",greeting:"Every dungeon is a dice game, son of Pandu." },
  Gandhari: { colour:"#a0c8dc", role:"oracle",   greeting:"I see your path through blindfolded eyes." },
  Bhima:    { colour:"#dc6432", role:"ally",     greeting:"Brother! I cleared half this floor already." },
};

const ITEM_DEFS = {
  Amrit:   { type:"heal",  value:40,  colour:"#3cdc78", desc:"Sacred nectar restores health." },
  Gandiva: { type:"atk",   value:10,  colour:"#d4aa3a", desc:"Arjun's divine bow amplifies power." },
  Kavach:  { type:"def",   value:8,   colour:"#64a0dc", desc:"Karna's armour, repurposed." },
  SomRas:  { type:"speed", value:2,   colour:"#c864c8", desc:"Drink of the gods — swiftness granted." },
};

// ══════════════════════════════════════════════
//  PLAYER — Arjun
// ══════════════════════════════════════════════
class Player {
  constructor(gx, gy) {
    this.gx = gx; this.gy = gy;
    this.x  = gx * TILE + TILE / 2;
    this.y  = gy * TILE + TILE / 2;

    this.hp = 120; this.maxHp = 120;
    this.attack = 20; this.defense = 0;
    this.speed  = 4;
    this.xp = 0; this.level = 1; this.gold = 0;
    this.xpToNext = 100;

    this.attackCd    = 0;
    this.invincible  = 0;
    this.attackAnim  = 0;
    this.facing      = { x: 1, y: 0 };
    this.bobTick     = 0;
    this.inventory   = [];

    this.attackRange   = TILE * 1.2;
    this.interactRange = TILE * 1.6;
  }

  update(dungeon, keys) {
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"]  || keys["a"] || keys["KeyA"]) dx = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["KeyD"]) dx =  1;
    if (keys["ArrowUp"]    || keys["w"] || keys["KeyW"]) dy = -1;
    if (keys["ArrowDown"]  || keys["s"] || keys["KeyS"]) dy =  1;

    if (dx || dy) {
      this.facing = { x: dx, y: dy };
      this._tryMove(dx, dy, dungeon);
    }

    if (this.attackCd   > 0) this.attackCd--;
    if (this.invincible > 0) this.invincible--;
    if (this.attackAnim > 0) this.attackAnim--;

    if (dx || dy) this.bobTick++;
  }

  _tryMove(dx, dy, dungeon) {
    const nx = this.x + dx * this.speed;
    const ny = this.y + dy * this.speed;
    const gx = Math.floor(nx / TILE);
    const gy = Math.floor(ny / TILE);
    if (dungeon.isWalkable(gx, gy)) {
      this.x = nx; this.y = ny;
      this.gx = gx; this.gy = gy;
    }
  }

  doAttack(enemies) {
    if (this.attackCd > 0) return [];
    this.attackCd  = 30;
    this.attackAnim = 10;
    const hit = [];
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      if (dist <= this.attackRange) {
        const dot = this.facing.x * (e.x - this.x) + this.facing.y * (e.y - this.y);
        if (dot > 0 || dist < TILE * 0.6) {
          const dmg = Math.max(1, this.attack - e.defense);
          e.takeDamage(dmg);
          hit.push(e);
        }
      }
    }
    return hit;
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    const actual = Math.max(1, amount - this.defense);
    this.hp = Math.max(0, this.hp - actual);
    this.invincible = 40;
  }

  gainXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(this.xpToNext * 1.5);
      this.maxHp  += 20;
      this.hp      = Math.min(this.hp + 20, this.maxHp);
      this.attack += 5;
      leveled = true;
    }
    return leveled;
  }

  pickItem(name) {
    const d = ITEM_DEFS[name];
    if (!d) return;
    if (d.type === "heal")  this.hp    = Math.min(this.maxHp, this.hp + d.value);
    if (d.type === "atk")   this.attack  += d.value;
    if (d.type === "def")   this.defense += d.value;
    if (d.type === "speed") this.speed   = Math.min(this.speed + d.value, 10);
    this.inventory.push(name);
  }

  get isAlive() { return this.hp > 0; }

  draw(ctx, camX, camY, tick) {
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY) + Math.round(Math.sin(this.bobTick * 0.25) * 3);

    // i-frame blink
    if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;

    // attack ring
    if (this.attackAnim > 0) {
      ctx.save();
      ctx.strokeStyle = "#d4aa3a";
      ctx.lineWidth = 2;
      ctx.globalAlpha = this.attackAnim / 10;
      ctx.beginPath();
      ctx.arc(sx, sy, TILE * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // shadow
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + 16, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = "#5078dc";
    ctx.beginPath();
    ctx.arc(sx, sy, 15, 0, Math.PI * 2);
    ctx.fill();

    // highlight
    ctx.fillStyle = "#6496f0";
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 3, 6, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    const ex = sx + this.facing.x * 6;
    const ey = sy + this.facing.y * 6 - 2;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(ex + this.facing.x, ey + this.facing.y, 1.5, 0, Math.PI * 2); ctx.fill();

    // bow arc (Gandiva symbol)
    ctx.strokeStyle = "#d4aa3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy + 6, 10, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  ENEMY
// ══════════════════════════════════════════════
class Enemy {
  constructor(name, gx, gy, floorScale = 1, isBoss = false) {
    const defs = isBoss ? BOSS_DEFS : ENEMY_DEFS;
    const d = defs[name];
    this.name    = name;
    this.isBoss  = isBoss;
    this.gx = gx; this.gy = gy;
    this.x  = gx * TILE + TILE / 2;
    this.y  = gy * TILE + TILE / 2;

    this.maxHp   = Math.floor(d.hp * floorScale);
    this.hp      = this.maxHp;
    this.attack  = Math.floor(d.attack * floorScale);
    this.defense = 0;
    this.speed   = d.speed;
    this.colour  = d.colour;
    this.xpValue = d.xp;
    this.lore    = d.lore || "";

    this.phase2Done      = false;
    this.phase2Threshold = d.phase2 ?? 0.5;

    this.state      = "idle";
    this.attackCd   = 0;
    this.hitFlash   = 0;
    this.deathAnim  = 0;
    this.aggroRange = TILE * 6;
    this.attackRange= TILE * 1.1;
    this._wanderDir = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    this._wanderT   = Math.floor(Math.random() * 60 + 30);
  }

  update(player, dungeon) {
    if (this.hp <= 0) { this.state = "dead"; this.deathAnim++; return; }
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.attackCd > 0) this.attackCd--;

    // boss phase 2
    if (this.isBoss && !this.phase2Done && this.hp / this.maxHp <= this.phase2Threshold) {
      this.phase2Done = true;
      this.speed++;
      this.attack = Math.floor(this.attack * 1.3);
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist <= this.aggroRange) this.state = "chase";
    else if (this.state !== "attack") this.state = "idle";

    if (this.state === "chase")      this._chase(player, dungeon, dist);
    else if (this.state === "idle")  this._wander(dungeon);
  }

  _chase(player, dungeon, dist) {
    if (dist > this.attackRange) {
      const dx = player.x - this.x, dy = player.y - this.y;
      const norm = Math.hypot(dx, dy) || 1;
      const nx = this.x + (dx / norm) * this.speed;
      const ny = this.y + (dy / norm) * this.speed;
      const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
      if (dungeon.isWalkable(gx, gy)) {
        this.x = nx; this.y = ny; this.gx = gx; this.gy = gy;
      }
    } else {
      this.state = "attack";
      if (this.attackCd <= 0) {
        player.takeDamage(this.attack);
        this.attackCd = 50;
      }
    }
  }

  _wander(dungeon) {
    this._wanderT--;
    if (this._wanderT <= 0) {
      this._wanderDir = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
      this._wanderT = Math.floor(Math.random() * 80 + 40);
    }
    const nx = this.x + this._wanderDir.x * this.speed * 0.4;
    const ny = this.y + this._wanderDir.y * this.speed * 0.4;
    const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
    if (dungeon.isWalkable(gx, gy)) {
      this.x = nx; this.y = ny; this.gx = gx; this.gy = gy;
    }
  }

  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); this.hitFlash = 8; }

  get isDeadDone() { return this.state === "dead" && this.deathAnim > 20; }

  draw(ctx, camX, camY, tick) {
    if (this.isDeadDone) return;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY);

    // death fade
    if (this.state === "dead") {
      const a = Math.max(0, 1 - this.deathAnim / 20);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.colour;
      ctx.beginPath();
      ctx.arc(sx, sy, this.isBoss ? 24 : 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    const r = this.isBoss ? 26 : 14;

    // phase2 glow
    if (this.isBoss && this.phase2Done) {
      ctx.strokeStyle = "#ff5050";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, r + 7, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = this.hitFlash > 0 ? "#ffffff" : this.colour;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();

    // HP bar above
    const bw = r * 2, bx = sx - r, by = sy - r - 12;
    ctx.fillStyle = "#282030";
    ctx.fillRect(bx, by, bw, 5);
    const ratio = this.hp / this.maxHp;
    ctx.fillStyle = ratio > 0.3 ? "#c84040" : "#ff8c00";
    ctx.fillRect(bx, by, Math.round(bw * ratio), 5);

    // boss name
    if (this.isBoss) {
      ctx.fillStyle = "#ffdc96";
      ctx.font = "bold 12px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.fillText(this.name, sx, by - 4);
    }
    ctx.restore();
  }
}

// ══════════════════════════════════════════════
//  NPC
// ══════════════════════════════════════════════
class NPC {
  constructor(name, gx, gy) {
    const d = NPC_DEFS[name] || { colour: "#3cb8b0", role:"wanderer", greeting:"..." };
    this.name     = name;
    this.role     = d.role;
    this.greeting = d.greeting;
    this.colour   = d.colour;
    this.gx = gx; this.gy = gy;
    this.x  = gx * TILE + TILE / 2;
    this.y  = gy * TILE + TILE / 2;
    this.bobTick = 0;
    this.talked  = false;
    this.history = [];   // [{player, npc}]
  }

  update() { this.bobTick++; }

  inRange(player) {
    return Math.hypot(player.x - this.x, player.y - this.y) <= player.interactRange;
  }

  remember(playerLine, npcReply) {
    this.history.push({ player: playerLine, npc: npcReply });
    if (this.history.length > 6) this.history.shift();
  }

  draw(ctx, camX, camY) {
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY) + Math.round(Math.sin(this.bobTick * 0.06) * 3);

    ctx.save();
    // glow ring
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.stroke();

    // body
    ctx.fillStyle = this.colour;
    ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.stroke();

    // "!" above
    ctx.fillStyle = "#ffe050";
    ctx.font = "bold 16px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.fillText("!", sx, sy - 26);

    // name
    ctx.fillStyle = "#e6dfc0";
    ctx.font = "12px 'Cinzel', serif";
    ctx.fillText(this.name, sx, sy + 32);

    ctx.restore();
  }
}
