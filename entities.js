// MAINLAND — entities.js — Deepened gameplay edition
// No Mahabharata refs · Dash · Ranged arrows · Shrine rooms · Score tracking

const TILE = 48;

// ── World lore (no Mahabharata) ──────────────
const ENEMY_DEFS = {
  Asura:    { hp:60,  attack:12, speed:2,   colour:"#b43232", xp:30,  shape:"demon",   lore:"A fire-born demon of the elder age." },
  Rakshasa: { hp:90,  attack:18, speed:1.2, colour:"#8c1e8c", xp:50,  shape:"wraith",  lore:"A shape-shifter that hunts by scent." },
  Naga:     { hp:45,  attack:8,  speed:3.5, colour:"#1e8c50", xp:20,  shape:"serpent", lore:"A serpent spirit guarding forgotten gold." },
  Pishacha: { hp:70,  attack:14, speed:2.2, colour:"#6450c8", xp:35,  shape:"ghost",   lore:"A flesh-eater born from ancient grief." },
  Vetala:   { hp:110, attack:22, speed:1,   colour:"#3c3ca0", xp:60,  shape:"vampire", lore:"A night-walker that inhabits the dead." },
  Yaksha:   { hp:80,  attack:16, speed:1.8, colour:"#c87820", xp:45,  shape:"guardian",lore:"A spirit-guardian twisted by dark rites." },
};

const BOSS_DEFS = {
  Vritra:   { hp:450, attack:38, speed:1.2, colour:"#c04020", xp:350, shape:"titan",   lore:"The serpent-titan who swallowed the world's rivers.", phase2:0.5 },
  Mahishasura: { hp:650, attack:50, speed:1.5, colour:"#4a1060", xp:550, shape:"titan", lore:"The buffalo-demon whose darkness consumed three realms.", phase2:0.4 },
};

const NPC_DEFS = {
  Savitri:   { colour:"#3cb8a8", role:"sage",      greeting:"Traveller, the Mainland's roots rot beneath your feet. Listen." },
  Vikrama:   { colour:"#dc9632", role:"wanderer",  greeting:"I have walked every floor of this ruin. Let me share what I know." },
  Chanaksha: { colour:"#b450b4", role:"strategist",greeting:"Every demon here has a weakness. Shall I share my notes?" },
  Revati:    { colour:"#a0c8dc", role:"oracle",    greeting:"The threads of your fate glow strangely, warrior. Come closer." },
  Bheema:    { colour:"#dc6432", role:"berserker", greeting:"Still standing? Good. I left a few for you — not many." },
  Tara:      { colour:"#60d0a0", role:"healer",    greeting:"Rest, warrior. I can mend wounds the dungeon leaves behind." },
};

const ITEM_DEFS = {
  Amrit:    { type:"heal",  value:50,  colour:"#3cdc78", desc:"Sacred nectar of the gods — wounds close instantly." },
  Vajra:    { type:"atk",   value:12,  colour:"#d4aa3a", desc:"Fragment of Indra's thunderbolt — power surges." },
  Kavacha:  { type:"def",   value:10,  colour:"#64a0dc", desc:"Ancient divine armour — attacks glance off." },
  SomRas:   { type:"speed", value:2,   colour:"#c864c8", desc:"The drink of celestials — you move like wind." },
  Quiver:   { type:"arrows",value:8,   colour:"#e0a050", desc:"A blessed quiver — ranged fire restored." },
  Talisman: { type:"maxhp", value:30,  colour:"#e060c0", desc:"A relic of life — your blood strengthens." },
};

// ── Projectiles ──────────────────────────────
class Arrow {
  constructor(x, y, dx, dy) {
    this.x = x; this.y = y;
    const spd = 9;
    const norm = Math.hypot(dx, dy) || 1;
    this.vx = dx / norm * spd;
    this.vy = dy / norm * spd;
    this.damage = 0; // set by player
    this.alive  = true;
    this.trail  = [];
    this.age    = 0;
  }
  update(dungeon, enemies) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();
    this.x += this.vx; this.y += this.vy; this.age++;
    const gx = Math.floor(this.x / TILE), gy = Math.floor(this.y / TILE);
    if (!dungeon.isWalkable(gx, gy) || this.age > 120) { this.alive = false; return; }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) < 18) {
        e.takeDamage(this.damage); this.alive = false; return;
      }
    }
  }
  draw(ctx, camX, camY) {
    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      ctx.globalAlpha = (i / this.trail.length) * 0.4;
      ctx.fillStyle = "#d4aa3a";
      ctx.beginPath();
      ctx.arc(t.x - camX, t.y - camY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const sx = this.x - camX, sy = this.y - camY;
    const angle = Math.atan2(this.vy, this.vx);
    ctx.translate(sx, sy); ctx.rotate(angle);
    ctx.fillStyle = "#d4aa3a";
    ctx.fillRect(-8, -1.5, 16, 3);
    ctx.fillStyle = "#f0cc60";
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ══ PLAYER ════════════════════════════════════
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
    this.arrows = 5; this.maxArrows = 5;

    this.attackCd   = 0;
    this.invincible = 0;
    this.attackAnim = 0;
    this.dashCd     = 0;
    this.dashMax    = 90;
    this.dashing    = 0;
    this.dashVx     = 0; this.dashVy = 0;
    this.facing     = { x: 1, y: 0 };
    this.bobTick    = 0;
    this.inventory  = [];
    this.kills      = 0;
    this.floorsCleared = 0;

    this.attackRange   = TILE * 1.25;
    this.interactRange = TILE * 1.7;
  }

  update(dungeon, keys) {
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"]  || keys["a"] || keys["KeyA"]) dx = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["KeyD"]) dx =  1;
    if (keys["ArrowUp"]    || keys["w"] || keys["KeyW"]) dy = -1;
    if (keys["ArrowDown"]  || keys["s"] || keys["KeyS"]) dy =  1;

    if (dx || dy) this.facing = { x: dx, y: dy };

    if (this.attackCd   > 0) this.attackCd--;
    if (this.invincible > 0) this.invincible--;
    if (this.attackAnim > 0) this.attackAnim--;
    if (this.dashCd     > 0) this.dashCd--;

    // dash movement
    if (this.dashing > 0) {
      this.dashing--;
      const nx = this.x + this.dashVx;
      const ny = this.y + this.dashVy;
      const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
      if (dungeon.isWalkable(gx, gy)) {
        this.x = nx; this.y = ny; this.gx = gx; this.gy = gy;
      } else {
        this.dashing = 0;
      }
      return;
    }

    if (dx || dy) {
      this._tryMove(dx, dy, dungeon);
      this.bobTick++;
    }
  }

  dash() {
    if (this.dashCd > 0 || this.dashing > 0) return false;
    this.dashCd = this.dashMax;
    this.dashing = 10;
    this.dashVx = this.facing.x * 10;
    this.dashVy = this.facing.y * 10;
    this.invincible = Math.max(this.invincible, 12);
    return true;
  }

  _tryMove(dx, dy, dungeon) {
    const nx = this.x + dx * this.speed;
    const ny = this.y + dy * this.speed;
    const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
    if (dungeon.isWalkable(gx, gy)) {
      this.x = nx; this.y = ny; this.gx = gx; this.gy = gy;
    }
  }

  doAttack(enemies) {
    if (this.attackCd > 0) return [];
    this.attackCd = 28; this.attackAnim = 10;
    const hit = [];
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      if (dist <= this.attackRange) {
        const dot = this.facing.x * (e.x - this.x) + this.facing.y * (e.y - this.y);
        if (dot > 0 || dist < TILE * 0.65) {
          e.takeDamage(Math.max(1, this.attack - e.defense));
          hit.push(e);
        }
      }
    }
    return hit;
  }

  shootArrow() {
    if (this.arrows <= 0) return null;
    this.arrows--;
    const a = new Arrow(this.x, this.y, this.facing.x, this.facing.y);
    a.damage = Math.floor(this.attack * 0.8);
    return a;
  }

  takeDamage(amount) {
    if (this.invincible > 0 || this.dashing > 0) return;
    this.hp = Math.max(0, this.hp - Math.max(1, amount - this.defense));
    this.invincible = 45;
  }

  gainXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(this.xpToNext * 1.5);
      this.maxHp  += 25; this.hp = Math.min(this.hp + 25, this.maxHp);
      this.attack += 5; this.defense += 1;
      leveled = true;
    }
    return leveled;
  }

  pickItem(name) {
    const d = ITEM_DEFS[name]; if (!d) return;
    if (d.type === "heal")   this.hp      = Math.min(this.maxHp, this.hp + d.value);
    if (d.type === "atk")    this.attack  += d.value;
    if (d.type === "def")    this.defense += d.value;
    if (d.type === "speed")  this.speed   = Math.min(this.speed + d.value, 10);
    if (d.type === "arrows") this.arrows  = Math.min(this.maxArrows + d.value, 20);
    if (d.type === "maxhp")  { this.maxHp += d.value; this.hp = Math.min(this.hp + d.value, this.maxHp); }
    this.inventory.push(name);
  }

  get isAlive() { return this.hp > 0; }
  get dashRatio() { return Math.max(0, 1 - this.dashCd / this.dashMax); }

  draw(ctx, camX, camY) {
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY) + Math.round(Math.sin(this.bobTick * 0.22) * 3);

    if (this.invincible > 0 && !this.dashing && Math.floor(this.invincible / 4) % 2 === 0) return;

    ctx.save();

    // dash afterimage
    if (this.dashing > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#3cb8a8";
      ctx.beginPath(); ctx.arc(sx - this.dashVx * 0.5, sy - this.dashVy * 0.5, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // attack ring
    if (this.attackAnim > 0) {
      ctx.globalAlpha = this.attackAnim / 10;
      const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, TILE * 0.75);
      grad.addColorStop(0, "rgba(212,170,58,0.4)");
      grad.addColorStop(1, "rgba(212,170,58,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, TILE * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(sx, sy + 16, 13, 5, 0, 0, Math.PI * 2); ctx.fill();

    // outer glow
    const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 22);
    glow.addColorStop(0, "rgba(80,120,220,0.4)"); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();

    // body
    const bodyGrad = ctx.createRadialGradient(sx - 4, sy - 4, 2, sx, sy, 15);
    bodyGrad.addColorStop(0, "#7090e8"); bodyGrad.addColorStop(1, "#3858b0");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(120,160,255,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.stroke();

    // eyes
    const ex = sx + this.facing.x * 6, ey = sy + this.facing.y * 6 - 2;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(ex + this.facing.x, ey + this.facing.y, 1.5, 0, Math.PI * 2); ctx.fill();

    // bow symbol
    ctx.strokeStyle = "#d4aa3a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy + 8, 9, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = "rgba(212,170,58,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx - 9, sy + 8); ctx.lineTo(sx + 9, sy + 8); ctx.stroke();

    ctx.restore();
  }
}

// ══ ENEMY ═════════════════════════════════════
class Enemy {
  constructor(name, gx, gy, floorScale = 1, isBoss = false) {
    const defs = isBoss ? BOSS_DEFS : ENEMY_DEFS;
    const d = defs[name] || Object.values(defs)[0];
    this.name    = name; this.isBoss = isBoss;
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
    this.shape   = d.shape || "demon";
    this.phase2Done      = false;
    this.phase2Threshold = d.phase2 ?? 0.5;
    this.state      = "idle";
    this.attackCd   = 0;
    this.hitFlash   = 0;
    this.deathAnim  = 0;
    this.aggroRange = TILE * (isBoss ? 8 : 6);
    this.attackRange= TILE * 1.15;
    this._wanderDir = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    this._wanderT   = Math.floor(Math.random() * 60 + 30);
    this._animTick  = Math.random() * 100;
  }

  update(player, dungeon) {
    if (this.hp <= 0) { this.state = "dead"; this.deathAnim++; return; }
    this._animTick++;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.attackCd > 0) this.attackCd--;
    if (this.isBoss && !this.phase2Done && this.hp / this.maxHp <= this.phase2Threshold) {
      this.phase2Done = true; this.speed += 1; this.attack = Math.floor(this.attack * 1.35);
    }
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist <= this.aggroRange) this.state = "chase";
    else if (this.state !== "attack") this.state = "idle";
    if (this.state === "chase") this._chase(player, dungeon, dist);
    else this._wander(dungeon);
  }

  _chase(player, dungeon, dist) {
    if (dist > this.attackRange) {
      const dx = player.x - this.x, dy = player.y - this.y;
      const norm = Math.hypot(dx, dy) || 1;
      const nx = this.x + (dx / norm) * this.speed;
      const ny = this.y + (dy / norm) * this.speed;
      const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
      if (dungeon.isWalkable(gx, gy)) { this.x = nx; this.y = ny; this.gx = gx; this.gy = gy; }
    } else {
      this.state = "attack";
      if (this.attackCd <= 0) { player.takeDamage(this.attack); this.attackCd = 50; }
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
    if (dungeon.isWalkable(gx, gy)) { this.x = nx; this.y = ny; this.gx = gx; this.gy = gy; }
  }

  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); this.hitFlash = 8; }
  get isDeadDone() { return this.state === "dead" && this.deathAnim > 25; }

  draw(ctx, camX, camY) {
    if (this.isDeadDone) return;
    const sx = Math.round(this.x - camX), sy = Math.round(this.y - camY);
    const r = this.isBoss ? 26 : 14;
    const pulse = Math.sin(this._animTick * 0.06) * 2;

    if (this.state === "dead") {
      const a = Math.max(0, 1 - this.deathAnim / 25);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = this.colour;
      ctx.beginPath(); ctx.arc(sx, sy, r * a, 0, Math.PI * 2); ctx.fill();
      // death particles
      for (let i = 0; i < 4; i++) {
        const ang = (this.deathAnim / 25) * Math.PI * 2 + i * Math.PI / 2;
        const rad = this.deathAnim * 1.5;
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = this.colour;
        ctx.beginPath(); ctx.arc(sx + Math.cos(ang) * rad, sy + Math.sin(ang) * rad, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return;
    }

    ctx.save();

    // boss phase2 outer ring
    if (this.isBoss && this.phase2Done) {
      const t = this._animTick * 0.04;
      ctx.strokeStyle = "#ff5050"; ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.arc(sx, sy, r + 10 + pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // glow
    const glowGrad = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r + 8 + pulse);
    glowGrad.addColorStop(0, this.colour + "60"); glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(sx, sy, r + 8, 0, Math.PI * 2); ctx.fill();

    // body
    ctx.fillStyle = this.hitFlash > 0 ? "#ffffff" : this.colour;
    ctx.beginPath(); ctx.arc(sx, sy + pulse * 0.3, r, 0, Math.PI * 2); ctx.fill();

    // shape details
    this._drawShape(ctx, sx, sy + pulse * 0.3, r);

    // HP bar
    const bw = r * 2, bx = sx - r, by = sy - r - 12;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
    ctx.fillStyle = this.hp / this.maxHp > 0.5 ? "#c84040" : "#ff8c00";
    ctx.fillRect(bx, by, Math.max(0, bw * this.hp / this.maxHp), 5);

    if (this.isBoss) {
      ctx.fillStyle = "#ffd080"; ctx.font = "bold 11px 'Cinzel',serif";
      ctx.textAlign = "center"; ctx.fillText(this.name, sx, by - 5);
    }
    ctx.restore();
  }

  _drawShape(ctx, sx, sy, r) {
    ctx.save(); ctx.globalAlpha = 0.6;
    if (this.shape === "serpent") {
      // forked tongue
      ctx.strokeStyle = "#50ff50"; ctx.lineWidth = 1.5;
      const t = this._animTick * 0.15;
      ctx.beginPath(); ctx.moveTo(sx, sy + r - 2);
      ctx.lineTo(sx + Math.sin(t) * 4, sy + r + 6);
      ctx.moveTo(sx + Math.sin(t) * 4, sy + r + 6);
      ctx.lineTo(sx + Math.sin(t) * 4 - 3, sy + r + 10);
      ctx.moveTo(sx + Math.sin(t) * 4, sy + r + 6);
      ctx.lineTo(sx + Math.sin(t) * 4 + 3, sy + r + 10);
      ctx.stroke();
    } else if (this.shape === "ghost") {
      // wispy bottom
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      for (let i = 0; i < 3; i++) {
        const wave = Math.sin(this._animTick * 0.1 + i) * 3;
        ctx.beginPath(); ctx.arc(sx - r + i * r + wave, sy + r - 2, 4, 0, Math.PI); ctx.fill();
      }
    } else if (this.shape === "titan") {
      // horns
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.moveTo(sx - r * 0.4, sy - r * 0.8);
      ctx.lineTo(sx - r * 0.7, sy - r * 1.4);
      ctx.lineTo(sx - r * 0.1, sy - r * 0.9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + r * 0.4, sy - r * 0.8);
      ctx.lineTo(sx + r * 0.7, sy - r * 1.4);
      ctx.lineTo(sx + r * 0.1, sy - r * 0.9); ctx.closePath(); ctx.fill();
    }
    // eyes (all shapes)
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ff2020";
    ctx.beginPath(); ctx.arc(sx - 4, sy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 4, sy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ══ NPC ═══════════════════════════════════════
class NPC {
  constructor(name, gx, gy) {
    const d = NPC_DEFS[name] || { colour:"#3cb8a8", role:"wanderer", greeting:"..." };
    this.name = name; this.role = d.role; this.greeting = d.greeting; this.colour = d.colour;
    this.gx = gx; this.gy = gy;
    this.x  = gx * TILE + TILE / 2;
    this.y  = gy * TILE + TILE / 2;
    this.bobTick = 0; this.talked = false; this.history = [];
    this._animTick = Math.random() * 100;
  }
  update() { this.bobTick++; this._animTick++; }
  inRange(player) { return Math.hypot(player.x - this.x, player.y - this.y) <= player.interactRange; }
  remember(p, r) { this.history.push({ player: p, npc: r }); if (this.history.length > 6) this.history.shift(); }

  draw(ctx, camX, camY) {
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY) + Math.round(Math.sin(this.bobTick * 0.055) * 4);
    ctx.save();

    // aura ring
    const t = this._animTick * 0.03;
    const auraA = 0.2 + Math.sin(t) * 0.1;
    ctx.strokeStyle = this.colour; ctx.lineWidth = 2; ctx.globalAlpha = auraA;
    ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // body
    const grad = ctx.createRadialGradient(sx - 4, sy - 4, 3, sx, sy, 16);
    grad.addColorStop(0, "#ffffff30"); grad.addColorStop(1, this.colour);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.stroke();

    // "!" bubble
    ctx.fillStyle = "rgba(8,6,18,0.85)"; ctx.strokeStyle = "#d4aa3a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sx - 8, sy - 42, 16, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#d4aa3a"; ctx.font = "bold 13px 'Cinzel',serif"; ctx.textAlign = "center";
    ctx.fillText("!", sx, sy - 28);

    // name
    ctx.fillStyle = "rgba(8,6,18,0.7)";
    const tw = ctx.measureText(this.name).width + 12;
    ctx.beginPath(); ctx.roundRect(sx - tw / 2, sy + 20, tw, 15, 3); ctx.fill();
    ctx.fillStyle = "#e6dfc0"; ctx.font = "11px 'Cinzel',serif";
    ctx.fillText(this.name, sx, sy + 31);

    ctx.restore();
  }
}
