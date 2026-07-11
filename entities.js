// MAINLAND — entities.js
// Mahabharata chars, zone visuals, rich combat

const TILE = 48;

// ── Zone themes ───────────────────────────────
const ZONE_THEMES = {
  1: { floor:"#1e1638", wall:"#0e0820", wallTop:"#1a0f30", accent:"#6040a0", fog:"rgba(20,10,40,0.0)"  },
  2: { floor:"#2a0f10", wall:"#180508", wallTop:"#280a0c", accent:"#a03030", fog:"rgba(40,5,5,0.0)"    },
  3: { floor:"#080818", wall:"#050510", wallTop:"#0a0a20", accent:"#204080", fog:"rgba(5,5,20,0.0)"    },
};

// ── Entity tables ─────────────────────────────
const ENEMY_DEFS = {
  Asura:    { hp:55,  attack:11, speed:2,   colour:"#c84040", xp:30,  shape:"demon",   kind:"mystic", lore:"A fire-born demon of the elder age. It does not chase — it burns the ground you stand on." },
  Rakshasa: { hp:100, attack:19, speed:1.2, colour:"#8c1e8c", xp:50,  shape:"wraith",  kind:"melee",  lore:"A shape-shifter that hunts by scent. Slow, but it does not stop hitting once it starts." },
  Naga:     { hp:42,  attack:9,  speed:3.5, colour:"#1e9050", xp:20,  shape:"serpent", kind:"dasher", lore:"A serpent spirit guarding forgotten gold. It strikes like lightning, then coils to strike again." },
  Pishacha: { hp:60,  attack:10, speed:2.2, colour:"#6050c8", xp:35,  shape:"ghost",   kind:"archer", lore:"A flesh-eater born from ancient grief. It keeps its distance and hurls its hunger at you." },
  Vetala:   { hp:95,  attack:15, speed:1,   colour:"#3030a0", xp:60,  shape:"vampire", kind:"archer", lore:"A night-walker that inhabits the dead. Its curse-bolts drain more than they should." },
  Yaksha:   { hp:85,  attack:13, speed:1.8, colour:"#c07820", xp:45,  shape:"guardian",kind:"mystic", lore:"A spirit-guardian twisted by dark rites. It wards ground with fire it no longer controls." },
};

const BOSS_DEFS = {
  Duryodhana: { hp:500, attack:40, speed:1.2, colour:"#c02020", xp:400, shape:"titan",
    lore:"The iron-thighed king of Hastinapur, his envy warped into demon-flesh.", phase2:0.5 },
  Kali:       { hp:700, attack:55, speed:1.5, colour:"#2a0050", xp:600, shape:"void",
    lore:"The demon of this dark age — older than memory, darker than death.", phase2:0.4 },
};

const NPC_DEFS = {
  Draupadi: { colour:"#3cb8a8", role:"sage",     greeting:"Arjun. I knew you'd come this far. The Brahmastra is close — and so is the worst of it.",
              keyLine:"Take this key, Arjun. I have carried it since before you arrived — some doors should only open for a Pandava." },
  Karna:    { colour:"#dc9632", role:"rival",    greeting:"Pandava. You've made it further than I expected. Don't let that become overconfidence.",
              keyLine:"Here. A rival's debt, paid in iron. Don't mistake this for friendship — just take the key and go." },
  Shakuni:  { colour:"#b450b4", role:"trickster",greeting:"Ah, nephew. The stairs down are just ahead — or are they? I may have moved a few things.",
              keyLine:"A key, for you? How generous of me. Try not to lose it — or do. I do enjoy chaos either way." },
  Gandhari: { colour:"#a0c8dc", role:"oracle",   greeting:"I see without eyes, Arjun. Your path ends in light or fire. Perhaps both.",
              keyLine:"I have held this key since I foresaw your footsteps. Take it — the vault was always meant to open for you." },
  Bhima:    { colour:"#dc6432", role:"ally",     greeting:"Brother! The last three ran when they saw me. They won't get far. Go.",
              keyLine:"Found this on something that isn't breathing anymore. Figured you'd want it more than the corpse did." },
};

const ITEM_DEFS = {
  Amrit:    { type:"heal",   value:50, colour:"#3cdc78", desc:"Sacred nectar — wounds seal instantly." },
  Vajra:    { type:"atk",    value:12, colour:"#d4aa3a", desc:"Indra's thunderbolt fragment — strike harder." },
  Kavacha:  { type:"def",    value:10, colour:"#64a0dc", desc:"Divine armour shard — blows deflect." },
  SomRas:   { type:"speed",  value:2,  colour:"#c864c8", desc:"Drink of the celestials — move like wind." },
  Quiver:   { type:"arrows", value:8,  colour:"#e0a050", desc:"Blessed quiver — arrows replenished." },
  Talisman: { type:"maxhp",  value:30, colour:"#e060c0", desc:"Life relic — your blood strengthens." },
};

// ── Zone lore — shown once when Arjun first enters each zone ──
const ZONE_LORE = {
  1: "The Outer Ruins were once the outer wall of Indraprastha. Now the stones remember only fire, and the things that walk here remember only hunger.",
  2: "Below the ruins lie the Blood Crypts — where Duryodhana's court was buried alive rather than kneel. Their envy did not die with them.",
  3: "Past the crypts, the world stops obeying its own rules. This is the Void Sanctum, and Kali has been waiting here since before there was a 'before'.",
};

const PROLOGUE_LINES = [
  "Eighteen days. That is how long the war lasted, and how long it takes for a world to decide what to forget.",
  "Hastinapur still stands, but hollow — its throne empty, its halls quiet in the particular way a place goes quiet after too much grief.",
  "Something old stirred in the silence beneath the palace ruins. When it woke, it took the Brahmastra down into the dark with it.",
  "There is no army left to send after it. There were never enough of them left. There is only Arjun — and the dungeon that used to be a home.",
];

const KARNA_ARROW_LINE =
  "One gift, Pandava — the Vasavi Shakti. It answers only once, so choose what you aim it at with care.";

const EPILOGUE_TEXT =
  "The Brahmastra returns to Arjun's hand, and the Mainland exhales for the first time in an age. " +
  "The dark is not gone forever. But tonight, it retreats.";


const Audio = {
  ctx: null,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  },
  _play(freq, type, dur, vol=0.15, delay=0) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.type = type; o.frequency.value = freq;
      const t = this.ctx.currentTime + delay;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch(e){}
  },
  hit()     { this._play(120, "sawtooth", 0.08, 0.2); },
  playerHit(){ this._play(80,  "sawtooth", 0.15, 0.25); this._play(60, "sine", 0.2, 0.15, 0.05); },
  kill()    { this._play(200, "sine", 0.12, 0.18); this._play(150, "sine", 0.1, 0.12, 0.06); },
  shoot()   { this._play(600, "square", 0.04, 0.08); this._play(400, "square", 0.03, 0.06, 0.03); },
  pickup()  { this._play(440, "sine", 0.1, 0.12); this._play(550, "sine", 0.1, 0.1, 0.05); this._play(660, "sine", 0.1, 0.08, 0.1); },
  levelup() { [330,440,550,660].forEach((f,i) => this._play(f,"sine",0.15,0.15,i*0.08)); },
  shrine()  { [220,330,440,550,440,330].forEach((f,i) => this._play(f,"sine",0.18,0.12,i*0.1)); },
  boss()    { this._play(55,"sawtooth",0.4,0.3); this._play(45,"sawtooth",0.4,0.25,0.1); },
  dash()    { this._play(300,"sine",0.06,0.1); this._play(400,"sine",0.05,0.06,0.04); },
  death()   { this._play(100,"sawtooth",0.5,0.3); this._play(70,"sawtooth",0.4,0.4,0.1); this._play(50,"sawtooth",0.3,0.5,0.2); },
  stairs()  { [220,330,440].forEach((f,i)=>this._play(f,"sine",0.2,0.15,i*0.12)); },
  doorUnlock() { this._play(180,"square",0.15,0.22); this._play(260,"square",0.12,0.16,0.08); this._play(340,"square",0.1,0.12,0.16); },
  keyGet()  { this._play(500,"triangle",0.08,0.15); this._play(700,"triangle",0.1,0.13,0.06); },
  divineShot() { this._play(600,"sine",0.1,0.2); this._play(900,"sine",0.12,0.18,0.06); this._play(1300,"triangle",0.1,0.22,0.12); },
  enemyShoot() { this._play(220,"sawtooth",0.06,0.1); },
  fireCast()   { this._play(140,"sawtooth",0.1,0.25); this._play(90,"sawtooth",0.08,0.2,0.08); },
};

// ── Screen shake ──────────────────────────────
const Shake = {
  x:0, y:0, _t:0, _str:0,
  trigger(strength=8, frames=12) { this._str=strength; this._t=frames; },
  update() {
    if (this._t > 0) {
      this._t--;
      const s = this._str * (this._t / 12);
      this.x = (Math.random()-0.5)*s*2;
      this.y = (Math.random()-0.5)*s*2;
    } else { this.x=0; this.y=0; }
  },
};

// ── Arrow projectile ──────────────────────────
class Arrow {
  constructor(x,y,dx,dy,dmg,special=false) {
    this.x=x; this.y=y;
    const spd=special?13:10, norm=Math.hypot(dx,dy)||1;
    this.vx=dx/norm*spd; this.vy=dy/norm*spd;
    this.damage=dmg; this.alive=true; this.age=0;
    this.special=special;
    this.trail=[];
  }
  update(dungeon, enemies) {
    this.hitInfo = null;
    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>8) this.trail.shift();
    this.x+=this.vx; this.y+=this.vy; this.age++;
    if(!dungeon.isWalkable(Math.floor(this.x/TILE),Math.floor(this.y/TILE))||this.age>140){this.alive=false;return;}
    for(const e of enemies){
      if(e.hp<=0) continue;
      if(Math.hypot(e.x-this.x,e.y-this.y)<18){
        const res=e.takeDamage(this.damage, this.special);
        this.hitInfo = {enemy:e, dmg:res.dmgDealt, special:this.special, justWarded:res.justWarded, executed:res.executed};
        this.alive=false;return;
      }
    }
  }
  draw(ctx,camX,camY) {
    ctx.save();
    for(let i=0;i<this.trail.length;i++){
      const t=this.trail[i];
      ctx.globalAlpha=(i/this.trail.length)*(this.special?0.7:0.5);
      ctx.fillStyle=this.special?"#ffe080":"#d4aa3a";
      ctx.beginPath();ctx.arc(t.x-camX,t.y-camY,this.special?3:2,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    const sx=this.x-camX,sy=this.y-camY;
    const ang=Math.atan2(this.vy,this.vx);
    ctx.translate(sx,sy);ctx.rotate(ang);
    if(this.special){
      ctx.shadowColor="#ffe080";ctx.shadowBlur=14;
      ctx.fillStyle="#fff6d0";ctx.fillRect(-10,-2,20,4);
      ctx.fillStyle="#ffd040";
      ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(4,-5);ctx.lineTo(4,5);ctx.closePath();ctx.fill();
    } else {
      ctx.fillStyle="#f0cc60";ctx.fillRect(-8,-1.5,16,3);
      ctx.fillStyle="#d4aa3a";
      ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(4,-3);ctx.lineTo(4,3);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
}

// ── EnemyBolt — ranged projectile fired by archer-kind enemies at the player ──
class EnemyBolt {
  constructor(x,y,dx,dy,dmg,colour="#ff6040") {
    this.x=x; this.y=y;
    const spd=6.2, norm=Math.hypot(dx,dy)||1;
    this.vx=dx/norm*spd; this.vy=dy/norm*spd;
    this.damage=dmg; this.alive=true; this.age=0; this.colour=colour;
    this.trail=[];
  }
  update(dungeon, player) {
    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>6) this.trail.shift();
    this.x+=this.vx; this.y+=this.vy; this.age++;
    if(!dungeon.isWalkable(Math.floor(this.x/TILE),Math.floor(this.y/TILE))||this.age>160){this.alive=false;return;}
    if(Math.hypot(player.x-this.x,player.y-this.y)<16){
      player.takeDamage(this.damage);
      this.alive=false;
    }
  }
  draw(ctx,camX,camY) {
    ctx.save();
    for(let i=0;i<this.trail.length;i++){
      const t=this.trail[i];
      ctx.globalAlpha=(i/this.trail.length)*0.4;
      ctx.fillStyle=this.colour;
      ctx.beginPath();ctx.arc(t.x-camX,t.y-camY,2.5,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.shadowColor=this.colour;ctx.shadowBlur=6;
    ctx.fillStyle=this.colour;
    ctx.beginPath();ctx.arc(this.x-camX,this.y-camY,4,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

// ── FireZone — telegraphed AoE hazard cast by mystic-kind enemies ──
class FireZone {
  constructor(x,y,radius,dmg,life=170) {
    this.x=x; this.y=y; this.radius=radius; this.damage=dmg;
    this.warmup=45; this.life=life; this.maxLife=life; this.tickCd=0; this.alive=true;
  }
  update(player) {
    if(this.warmup>0){ this.warmup--; return; }
    this.life--;
    if(this.life<=0){ this.alive=false; return; }
    if(this.tickCd>0){ this.tickCd--; return; }
    if(Math.hypot(player.x-this.x,player.y-this.y)<=this.radius){
      player.takeDamage(this.damage);
      this.tickCd=26;
    }
  }
  draw(ctx,camX,camY,tick) {
    const sx=this.x-camX, sy=this.y-camY;
    ctx.save();
    if(this.warmup>0){
      const p=1-this.warmup/45;
      ctx.globalAlpha=0.55;
      ctx.strokeStyle="rgba(255,120,40,0.8)";
      ctx.lineWidth=2;
      ctx.setLineDash([6,5]);
      ctx.beginPath();ctx.arc(sx,sy,this.radius*p,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const a=Math.min(1,this.life/this.maxLife)*0.45+0.15;
      ctx.globalAlpha=a;
      const g=ctx.createRadialGradient(sx,sy,4,sx,sy,this.radius);
      g.addColorStop(0,"rgba(255,140,50,0.55)");g.addColorStop(1,"rgba(255,60,20,0)");
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,this.radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="rgba(255,150,70,0.55)";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(sx,sy,this.radius,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
}

// ══ PLAYER ════════════════════════════════════
class Player {
  constructor(gx,gy) {
    this.gx=gx;this.gy=gy;
    this.x=gx*TILE+TILE/2; this.y=gy*TILE+TILE/2;
    this.hp=120;this.maxHp=120;
    this.attack=20;this.defense=0;this.speed=4;
    this.xp=0;this.level=1;this.gold=0;
    this.xpToNext=100;
    this.arrows=5;this.maxArrows=5;
    this.attackCd=0;this.invincible=0;this.attackAnim=0;
    this.dashCd=0;this.dashMax=90;this.dashing=0;
    this.dashVx=0;this.dashVy=0;
    this.facing={x:1,y:0};
    this.bobTick=0;
    this.inventory=[];
    this.kills=0;this.floorsCleared=0;
    this.hasVaultKey=false;
    this.specialArrows=0;this.gotKarnaGift=false;
    this.attackRange=TILE*1.25;
    this.interactRange=TILE*1.8;
    this._dead=false;
  }

  update(dungeon,keys) {
    if(this._dead) return;
    let dx=0,dy=0;
    if(keys["ArrowLeft"]||keys["a"]||keys["KeyA"]) dx=-1;
    if(keys["ArrowRight"]||keys["d"]||keys["KeyD"]) dx=1;
    if(keys["ArrowUp"]||keys["w"]||keys["KeyW"])   dy=-1;
    if(keys["ArrowDown"]||keys["s"]||keys["KeyS"])  dy=1;
    if(dx||dy) this.facing={x:dx,y:dy};
    if(this.attackCd>0)  this.attackCd--;
    if(this.invincible>0)this.invincible--;
    if(this.attackAnim>0)this.attackAnim--;
    if(this.dashCd>0)    this.dashCd--;
    if(this.dashing>0){
      this.dashing--;
      const nx=this.x+this.dashVx,ny=this.y+this.dashVy;
      const gx=Math.floor(nx/TILE),gy=Math.floor(ny/TILE);
      if(dungeon.isWalkable(gx,gy)){this.x=nx;this.y=ny;this.gx=gx;this.gy=gy;}
      else this.dashing=0;
      return;
    }
    if(dx||dy){this._tryMove(dx,dy,dungeon);this.bobTick++;}
  }

  dash() {
    if(this.dashCd>0||this.dashing>0) return false;
    this.dashCd=this.dashMax;this.dashing=10;
    this.dashVx=this.facing.x*11;this.dashVy=this.facing.y*11;
    this.invincible=Math.max(this.invincible,14);
    Audio.dash(); return true;
  }

  _tryMove(dx,dy,dungeon){
    const nx=this.x+dx*this.speed,ny=this.y+dy*this.speed;
    const gx=Math.floor(nx/TILE),gy=Math.floor(ny/TILE);
    if(dungeon.isWalkable(gx,gy)){this.x=nx;this.y=ny;this.gx=gx;this.gy=gy;}
  }

  doAttack(enemies){
    // FIX: melee used to require a forward-facing dot-product check, so an enemy
    // beside or behind you (extremely common once you're surrounded) took no damage
    // even though the swing animation played. Attacks now land on anything within
    // range in a full circle around Arjun — matching what the swing VFX shows.
    if(this.attackCd>0) return [];
    this.attackCd=28;this.attackAnim=10;
    Audio.hit();
    const hit=[];
    for(const e of enemies){
      if(e.hp<=0) continue;
      const dist=Math.hypot(e.x-this.x,e.y-this.y);
      if(dist<=this.attackRange){
        const crit = Math.random() < 0.15;
        const dmg  = Math.max(1, Math.round((this.attack-e.defense) * (crit?1.75:1)));
        const res  = e.takeDamage(dmg, false);
        hit.push({enemy:e, dmg:res.dmgDealt, crit, justWarded:res.justWarded});
      }
    }
    return hit;
  }

  shootArrow(){
    if(this.arrows<=0) return null;
    this.arrows--;
    Audio.shoot();
    const a=new Arrow(this.x,this.y,this.facing.x,this.facing.y,Math.floor(this.attack*0.8));
    return a;
  }

  shootSpecialArrow(){
    // The Vasavi Shakti — Karna's gift. Limited, and worth saving for something that matters.
    if(this.specialArrows<=0) return null;
    this.specialArrows--;
    Audio.divineShot();
    const a=new Arrow(this.x,this.y,this.facing.x,this.facing.y,Math.floor(this.attack*1.6),true);
    return a;
  }

  takeDamage(amount){
    if(this.invincible>0||this.dashing>0) return;
    const dmg=Math.max(1,amount-this.defense);
    this.hp=Math.max(0,this.hp-dmg);
    this.invincible=45;
    Audio.playerHit();
    Shake.trigger(7,10);
    if(this.hp<=0) this._dead=true;
  }

  gainXp(amount){
    this.xp+=amount;let leveled=false;
    while(this.xp>=this.xpToNext){
      this.xp-=this.xpToNext;this.level++;
      this.xpToNext=Math.floor(this.xpToNext*1.5);
      this.maxHp+=25;this.hp=Math.min(this.hp+25,this.maxHp);
      this.attack+=5;this.defense+=1;
      leveled=true;
    }
    if(leveled) Audio.levelup();
    return leveled;
  }

  pickItem(name){
    const d=ITEM_DEFS[name];if(!d) return;
    if(d.type==="heal")   this.hp=Math.min(this.maxHp,this.hp+d.value);
    if(d.type==="atk")    this.attack+=d.value;
    if(d.type==="def")    this.defense+=d.value;
    if(d.type==="speed")  this.speed=Math.min(this.speed+d.value,10);
    if(d.type==="arrows") this.arrows=Math.min(this.arrows+d.value,20);
    if(d.type==="maxhp")  {this.maxHp+=d.value;this.hp=Math.min(this.hp+d.value,this.maxHp);}
    this.inventory.push(name);
    Audio.pickup();
  }

  useShrine(){
    const cost=30;
    if(this.gold<cost) return false;
    this.gold-=cost;
    this.hp=Math.min(this.maxHp,this.hp+60);
    Audio.shrine();
    return true;
  }

  get isAlive(){ return !this._dead && this.hp>0; }
  get dashRatio(){ return Math.max(0,1-this.dashCd/this.dashMax); }

  draw(ctx,camX,camY){
    const sx=Math.round(this.x-camX+Shake.x);
    const sy=Math.round(this.y-camY+Shake.y)+Math.round(Math.sin(this.bobTick*0.22)*3);
    if(this.invincible>0&&!this.dashing&&Math.floor(this.invincible/4)%2===0) return;
    ctx.save();
    if(this.dashing>0){
      ctx.globalAlpha=0.3;ctx.fillStyle="#3cb8a8";
      ctx.beginPath();ctx.arc(sx-this.dashVx*0.5,sy-this.dashVy*0.5,15,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    }
    if(this.attackAnim>0){
      const a=this.attackAnim/10;
      const ang=Math.atan2(this.facing.y,this.facing.x);
      ctx.save();
      ctx.globalAlpha=a*0.9;
      ctx.translate(sx,sy);ctx.rotate(ang);
      const swingR=this.attackRange*0.95;
      const grad=ctx.createRadialGradient(0,0,swingR*0.3,0,0,swingR);
      grad.addColorStop(0,"rgba(240,220,160,0.55)");
      grad.addColorStop(1,"rgba(212,170,58,0)");
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,swingR,-0.85,0.85);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle=`rgba(255,240,200,${a*0.8})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,swingR,-0.85,0.85);ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle="rgba(0,0,0,0.3)";
    ctx.beginPath();ctx.ellipse(sx,sy+16,13,5,0,0,Math.PI*2);ctx.fill();
    const glow=ctx.createRadialGradient(sx,sy,8,sx,sy,22);
    glow.addColorStop(0,"rgba(80,120,220,0.35)");glow.addColorStop(1,"transparent");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sx,sy,22,0,Math.PI*2);ctx.fill();
    const bg=ctx.createRadialGradient(sx-4,sy-4,2,sx,sy,15);
    bg.addColorStop(0,"#7090e8");bg.addColorStop(1,"#3858b0");
    ctx.fillStyle=bg;ctx.beginPath();ctx.arc(sx,sy,15,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="rgba(120,160,255,0.4)";ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(sx,sy,15,0,Math.PI*2);ctx.stroke();
    const ex=sx+this.facing.x*6,ey=sy+this.facing.y*6-2;
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(ex,ey,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#111";ctx.beginPath();ctx.arc(ex+this.facing.x,ey+this.facing.y,1.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#d4aa3a";ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx,sy+8,9,Math.PI,0);ctx.stroke();
    ctx.restore();
  }
}

// ══ ENEMY ═════════════════════════════════════
class Enemy {
  constructor(name,gx,gy,floorScale=1,isBoss=false,elite=false){
    const defs=isBoss?BOSS_DEFS:ENEMY_DEFS;
    const d=defs[name]||Object.values(defs)[0];
    this.name=name;this.isBoss=isBoss;
    this.isElite=!!elite&&!isBoss;
    const eliteHpMul=this.isElite?1.9:1, eliteAtkMul=this.isElite?1.35:1;
    this.gx=gx;this.gy=gy;
    this.x=gx*TILE+TILE/2;this.y=gy*TILE+TILE/2;
    this.maxHp=Math.floor(d.hp*floorScale*eliteHpMul);this.hp=this.maxHp;
    this.attack=Math.floor(d.attack*floorScale*eliteAtkMul);this.defense=this.isElite?4:0;
    this.speed=d.speed*(this.isElite?1.12:1);this.colour=d.colour;
    this.xpValue=Math.floor(d.xp*(this.isElite?2.2:1));this.lore=d.lore||"";this.shape=d.shape||"demon";
    this.phase2Done=false;this.phase2Threshold=d.phase2??0.5;
    this.state="idle";this.attackCd=0;this.hitFlash=0;this.deathAnim=0;
    this.aggroRange=TILE*(isBoss?9:6);this.attackRange=TILE*1.15;
    this.kind=isBoss?"boss":(d.kind||"melee");
    this.rangedCd=50+Math.random()*40;
    this.preferredRange=this.kind==="archer"?TILE*3.2:this.kind==="mystic"?TILE*3.6:this.attackRange;
    this.dashPhase="idle";this.dashTimer=0;this.dashDx=0;this.dashDy=0;
    this.wardThreshold=0.15;this.warded=false;
    this._wanderDir={x:Math.random()*2-1,y:Math.random()*2-1};
    this._wanderT=Math.floor(Math.random()*60+30);
    this._animTick=Math.random()*100;
    this._xpGiven=false;
    this._phase2Announced=false;
  }

  update(player,dungeon){
    if(this.hp<=0){this.state="dead";this.deathAnim++;return null;}
    this._animTick++;
    if(this.hitFlash>0)this.hitFlash--;
    if(this.attackCd>0)this.attackCd--;
    if(this.rangedCd>0)this.rangedCd--;
    if(this.isBoss&&!this.phase2Done&&this.hp/this.maxHp<=this.phase2Threshold){
      this.phase2Done=true;this.speed+=1;this.attack=Math.floor(this.attack*1.35);
    }
    const dist=Math.hypot(player.x-this.x,player.y-this.y);
    if(dist<=this.aggroRange)this.state="chase";
    else if(this.state!=="attack")this.state="idle";

    let spawn=null;
    if(this.state==="chase"){
      if(this.kind==="archer")      spawn=this._behaveArcher(player,dungeon,dist);
      else if(this.kind==="dasher") spawn=this._behaveDasher(player,dungeon,dist);
      else if(this.kind==="mystic") spawn=this._behaveMystic(player,dungeon,dist);
      else                          this._chase(player,dungeon,dist);
    } else this._wander(dungeon);
    return spawn;
  }

  _moveToward(tx,ty,dungeon,spd){
    const dx=tx-this.x,dy=ty-this.y,norm=Math.hypot(dx,dy)||1;
    const nx=this.x+(dx/norm)*spd,ny=this.y+(dy/norm)*spd;
    const gx=Math.floor(nx/TILE),gy=Math.floor(ny/TILE);
    if(dungeon.isWalkable(gx,gy)){this.x=nx;this.y=ny;this.gx=gx;this.gy=gy;}
  }
  _moveAway(tx,ty,dungeon,spd){
    const dx=this.x-tx,dy=this.y-ty,norm=Math.hypot(dx,dy)||1;
    const nx=this.x+(dx/norm)*spd,ny=this.y+(dy/norm)*spd;
    const gx=Math.floor(nx/TILE),gy=Math.floor(ny/TILE);
    if(dungeon.isWalkable(gx,gy)){this.x=nx;this.y=ny;this.gx=gx;this.gy=gy;}
  }

  _chase(player,dungeon,dist){
    if(dist>this.attackRange){
      this._moveToward(player.x,player.y,dungeon,this.speed);
    } else {
      this.state="attack";
      if(this.attackCd<=0){player.takeDamage(this.attack);this.attackCd=50;}
    }
  }

  // Archer-kind: keeps distance, peppers the player with bolts.
  _behaveArcher(player,dungeon,dist){
    if(dist<this.preferredRange*0.6) this._moveAway(player.x,player.y,dungeon,this.speed*0.8);
    else if(dist>this.preferredRange*1.3) this._moveToward(player.x,player.y,dungeon,this.speed);
    if(dist<=this.aggroRange&&this.rangedCd<=0){
      this.rangedCd=100;
      const dx=player.x-this.x,dy=player.y-this.y;
      return {type:"bolt",x:this.x,y:this.y,dx,dy,dmg:Math.floor(this.attack*0.85),colour:this.colour};
    }
    return null;
  }

  // Dasher-kind: telegraphs, then bursts toward the player at high speed.
  _behaveDasher(player,dungeon,dist){
    if(this.dashPhase==="idle"){
      if(dist<=this.preferredRange&&this.rangedCd<=0){
        this.dashPhase="telegraph";this.dashTimer=26;
        const dx=player.x-this.x,dy=player.y-this.y,norm=Math.hypot(dx,dy)||1;
        this.dashDx=dx/norm;this.dashDy=dy/norm;
      } else {
        this._chase(player,dungeon,dist);
      }
    } else if(this.dashPhase==="telegraph"){
      this.dashTimer--;
      if(this.dashTimer<=0){this.dashPhase="dashing";this.dashTimer=14;}
    } else if(this.dashPhase==="dashing"){
      this.dashTimer--;
      const nx=this.x+this.dashDx*this.speed*4.2,ny=this.y+this.dashDy*this.speed*4.2;
      const gx=Math.floor(nx/TILE),gy=Math.floor(ny/TILE);
      if(dungeon.isWalkable(gx,gy)){this.x=nx;this.y=ny;this.gx=gx;this.gy=gy;} else this.dashTimer=0;
      if(Math.hypot(player.x-this.x,player.y-this.y)<this.attackRange&&this.attackCd<=0){
        player.takeDamage(Math.floor(this.attack*1.3));this.attackCd=40;
      }
      if(this.dashTimer<=0){this.dashPhase="recover";this.dashTimer=45;this.rangedCd=110;}
    } else if(this.dashPhase==="recover"){
      this.dashTimer--;
      if(this.dashTimer<=0)this.dashPhase="idle";
    }
    return null;
  }

  // Mystic-kind: hangs back, drops a telegraphed fire zone on the player's position.
  _behaveMystic(player,dungeon,dist){
    if(dist<this.preferredRange*0.7) this._moveAway(player.x,player.y,dungeon,this.speed*0.7);
    else if(dist>this.preferredRange*1.4) this._moveToward(player.x,player.y,dungeon,this.speed*0.8);
    if(dist<=this.aggroRange*0.9&&this.rangedCd<=0){
      this.rangedCd=170;
      return {type:"firezone",x:player.x,y:player.y,dmg:Math.floor(this.attack*0.6)};
    }
    return null;
  }

  _wander(dungeon){
    this._wanderT--;
    if(this._wanderT<=0){
      this._wanderDir={x:Math.random()*2-1,y:Math.random()*2-1};
      this._wanderT=Math.floor(Math.random()*80+40);
    }
    const nx=this.x+this._wanderDir.x*this.speed*0.4;
    const ny=this.y+this._wanderDir.y*this.speed*0.4;
    const gx=Math.floor(nx/TILE),gy=Math.floor(ny/TILE);
    if(dungeon.isWalkable(gx,gy)){this.x=nx;this.y=ny;this.gx=gx;this.gy=gy;}
  }

  // Elite enemies "ward" once they drop to wardThreshold of max HP — normal hits
  // barely chip through (still killable, just slow); a special arrow shatters the
  // ward and executes them outright. Non-elite enemies just take a special-arrow
  // damage bonus. Returns {dmgDealt, justWarded, executed} so callers (melee/arrow)
  // can show accurate floating numbers and one-time ward/execute feedback.
  takeDamage(amount,special=false){
    if(this.hp<=0) return {dmgDealt:0,justWarded:false,executed:false};
    const before=this.hp;
    let justWarded=false, executed=false;
    if(this.isElite){
      const wardHp=Math.ceil(this.maxHp*this.wardThreshold);
      if(special){
        if(this.warded) executed=true;
        this.hp=0;
      } else if(this.warded){
        this.hp=Math.max(0,this.hp-amount*0.12);
      } else {
        const next=this.hp-amount;
        if(next<=wardHp){this.hp=wardHp;this.warded=true;justWarded=true;}
        else this.hp=next;
      }
    } else {
      if(special) amount=Math.round(amount*2.2);
      this.hp=Math.max(0,this.hp-amount);
    }
    this.hitFlash=8;
    return {dmgDealt:before-this.hp,justWarded,executed};
  }
  get isDeadDone(){return this.state==="dead"&&this.deathAnim>25;}

  draw(ctx,camX,camY){
    if(this.isDeadDone) return;
    const sx=Math.round(this.x-camX+Shake.x);
    const sy=Math.round(this.y-camY+Shake.y);
    const r=(this.isBoss?28:14)*(this.isElite?1.18:1);
    const pulse=Math.sin(this._animTick*0.06)*2;

    if(this.state==="dead"){
      const a=Math.max(0,1-this.deathAnim/25);
      ctx.save();ctx.globalAlpha=a;
      ctx.fillStyle=this.colour;
      ctx.beginPath();ctx.arc(sx,sy,r*a,0,Math.PI*2);ctx.fill();
      for(let i=0;i<4;i++){
        const ang=this.deathAnim/25*Math.PI*2+i*Math.PI/2;
        ctx.globalAlpha=a*0.5;ctx.fillStyle=this.colour;
        ctx.beginPath();ctx.arc(sx+Math.cos(ang)*this.deathAnim*1.5,sy+Math.sin(ang)*this.deathAnim*1.5,3,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();return;
    }

    ctx.save();
    if(this.isBoss&&this.phase2Done){
      ctx.strokeStyle="#ff4040";ctx.lineWidth=2;ctx.setLineDash([8,4]);
      ctx.beginPath();ctx.arc(sx,sy,r+10+pulse,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
    }
    // Dash telegraph — a tightening ring warns of an incoming burst.
    if(this.dashPhase==="telegraph"){
      const p=1-this.dashTimer/26;
      ctx.strokeStyle="rgba(255,220,120,0.85)";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(sx,sy,r+18-p*14,0,Math.PI*2);ctx.stroke();
    }
    const glowG=ctx.createRadialGradient(sx,sy,r*0.5,sx,sy,r+8+pulse);
    glowG.addColorStop(0,this.colour+"60");glowG.addColorStop(1,"transparent");
    ctx.fillStyle=glowG;ctx.beginPath();ctx.arc(sx,sy,r+8,0,Math.PI*2);ctx.fill();

    ctx.fillStyle=this.hitFlash>0?"#ffffff":this.colour;
    ctx.beginPath();ctx.arc(sx,sy+pulse*0.3,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=this.isElite?"rgba(240,204,96,0.85)":"rgba(0,0,0,0.4)";
    ctx.lineWidth=this.isElite?2.5:1.5;
    ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.stroke();

    // Ward shield shimmer once an elite has dropped into its warded floor.
    if(this.isElite&&this.warded){
      const wp=0.5+0.5*Math.sin(this._animTick*0.12);
      ctx.strokeStyle=`rgba(120,200,255,${0.5+wp*0.4})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(sx,sy,r+6,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=`rgba(120,200,255,${0.15+wp*0.1})`;
      ctx.beginPath();ctx.arc(sx,sy,r+6,0,Math.PI*2);ctx.fill();
    }

    this._drawShape(ctx,sx,sy+pulse*0.3,r);

    const bw=r*2,bx=sx-r,by=sy-r-12;
    ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(bx-1,by-1,bw+2,7);
    const hpR=this.hp/this.maxHp;
    ctx.fillStyle=this.isElite&&this.warded?"#5090ff":(hpR>0.5?"#c84040":"#ff8c00");
    ctx.fillRect(bx,by,Math.max(0,bw*hpR),5);

    if(this.isBoss){
      ctx.fillStyle="#ffd080";ctx.font="bold 12px 'Cinzel',serif";
      ctx.textAlign="center";ctx.fillText(this.name,sx,by-5);
    } else if(this.isElite){
      ctx.fillStyle="#f0cc60";ctx.font="bold 10px 'Cinzel',serif";
      ctx.textAlign="center";ctx.fillText(this.name+" ✦",sx,by-5);
    }
    ctx.restore();
  }

  _drawShape(ctx,sx,sy,r){
    ctx.save();ctx.globalAlpha=0.65;
    if(this.shape==="serpent"){
      const t=this._animTick*0.15;
      ctx.strokeStyle="#50ff80";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(sx,sy+r-2);
      ctx.lineTo(sx+Math.sin(t)*4,sy+r+7);
      ctx.moveTo(sx+Math.sin(t)*4,sy+r+7);
      ctx.lineTo(sx+Math.sin(t)*4-3,sy+r+11);
      ctx.moveTo(sx+Math.sin(t)*4,sy+r+7);
      ctx.lineTo(sx+Math.sin(t)*4+3,sy+r+11);
      ctx.stroke();
    } else if(this.shape==="ghost"){
      ctx.fillStyle="rgba(0,0,0,0.25)";
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.arc(sx-r+i*r+Math.sin(this._animTick*0.1+i)*3,sy+r-2,4,0,Math.PI);ctx.fill();
      }
    } else if(this.shape==="titan"||this.shape==="void"){
      ctx.fillStyle="rgba(0,0,0,0.5)";
      ctx.beginPath();ctx.moveTo(sx-r*0.4,sy-r*0.8);ctx.lineTo(sx-r*0.75,sy-r*1.5);ctx.lineTo(sx-r*0.1,sy-r*0.9);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(sx+r*0.4,sy-r*0.8);ctx.lineTo(sx+r*0.75,sy-r*1.5);ctx.lineTo(sx+r*0.1,sy-r*0.9);ctx.closePath();ctx.fill();
      if(this.shape==="void"){
        ctx.strokeStyle="rgba(100,80,255,0.4)";ctx.lineWidth=1;
        for(let i=0;i<3;i++){
          const a=this._animTick*0.02+i*Math.PI*2/3;
          ctx.beginPath();ctx.arc(sx+Math.cos(a)*r*0.6,sy+Math.sin(a)*r*0.6,3,0,Math.PI*2);ctx.stroke();
        }
      }
    }
    ctx.globalAlpha=0.9;
    ctx.fillStyle=this.isBoss?"#ff4020":"#ff2020";
    ctx.beginPath();ctx.arc(sx-4,sy-3,this.isBoss?4:2.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(sx+4,sy-3,this.isBoss?4:2.5,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

// ══ NPC ═══════════════════════════════════════
class NPC {
  constructor(name,gx,gy,holdsKey=false){
    const d=NPC_DEFS[name]||{colour:"#3cb8a8",role:"wanderer",greeting:"...",keyLine:"Here — take this."};
    this.name=name;this.role=d.role;this.greeting=d.greeting;this.colour=d.colour;this.keyLine=d.keyLine;
    this.holdsKey=holdsKey;this.keyGiven=false;
    this.gx=gx;this.gy=gy;
    this.x=gx*TILE+TILE/2;this.y=gy*TILE+TILE/2;
    this.bobTick=0;this.talked=false;this.history=[];
    this._animTick=Math.random()*100;
  }
  update(){this.bobTick++;this._animTick++;}
  inRange(player){return Math.hypot(player.x-this.x,player.y-this.y)<=player.interactRange;}
  remember(p,r){this.history.push({player:p,npc:r});if(this.history.length>6)this.history.shift();}

  draw(ctx,camX,camY){
    const sx=Math.round(this.x-camX+Shake.x);
    const sy=Math.round(this.y-camY+Shake.y)+Math.round(Math.sin(this.bobTick*0.055)*4);
    ctx.save();
    const t=this._animTick*0.03;
    const showKey=this.holdsKey&&!this.keyGiven;
    ctx.strokeStyle=showKey?"#f0cc60":this.colour;ctx.lineWidth=2;ctx.globalAlpha=0.2+Math.sin(t)*0.1;
    ctx.beginPath();ctx.arc(sx,sy,24,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;
    const g=ctx.createRadialGradient(sx-4,sy-4,3,sx,sy,16);
    g.addColorStop(0,"rgba(255,255,255,0.25)");g.addColorStop(1,this.colour);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.stroke();

    if(showKey){
      const p=0.5+0.5*Math.sin(this._animTick*0.08);
      ctx.fillStyle="rgba(8,6,18,0.85)";ctx.strokeStyle="#f0cc60";ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(sx-9,sy-44,18,18,4);ctx.fill();ctx.stroke();
      ctx.fillStyle=`rgba(240,204,96,${0.8+p*0.2})`;ctx.font="13px sans-serif";
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("🗝",sx,sy-35);ctx.textBaseline="alphabetic";
    } else {
      ctx.fillStyle="rgba(8,6,18,0.85)";ctx.strokeStyle="#d4aa3a";ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(sx-8,sy-42,16,18,4);ctx.fill();ctx.stroke();
      ctx.fillStyle="#d4aa3a";ctx.font="bold 13px 'Cinzel',serif";ctx.textAlign="center";
      ctx.fillText("!",sx,sy-28);
    }

    ctx.fillStyle="rgba(8,6,18,0.7)";
    ctx.font="11px 'Cinzel',serif";
    const tw=ctx.measureText(this.name).width+12;
    ctx.beginPath();ctx.roundRect(sx-tw/2,sy+20,tw,15,3);ctx.fill();
    ctx.fillStyle="#e6dfc0";ctx.fillText(this.name,sx,sy+31);
    ctx.restore();
  }
}

// ══ SHRINE ════════════════════════════════════
class Shrine {
  constructor(gx,gy){
    this.gx=gx;this.gy=gy;
    this.x=gx*TILE+TILE/2;this.y=gy*TILE+TILE/2;
    this.used=false;this._tick=0;
  }
  update(){this._tick++;}
  inRange(player){return Math.hypot(player.x-this.x,player.y-this.y)<=player.interactRange;}

  draw(ctx,camX,camY){
    const sx=Math.round(this.x-camX+Shake.x);
    const sy=Math.round(this.y-camY+Shake.y);
    ctx.save();
    if(this.used){
      ctx.globalAlpha=0.3;
      ctx.fillStyle="#404040";ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();
      ctx.restore();return;
    }
    const pulse=Math.sin(this._tick*0.07);
    const glow=ctx.createRadialGradient(sx,sy,5,sx,sy,28+pulse*4);
    glow.addColorStop(0,"rgba(60,220,120,0.4)");glow.addColorStop(1,"transparent");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sx,sy,32,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#1a3020";ctx.strokeStyle="#3cdc78";ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#3cdc78";ctx.font="18px serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("✦",sx,sy);ctx.textBaseline="alphabetic";
    ctx.fillStyle="rgba(8,6,18,0.85)";ctx.strokeStyle="#3cdc78";ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(sx-30,sy-42,60,16,4);ctx.fill();ctx.stroke();
    ctx.fillStyle="#3cdc78";ctx.font="10px 'Cinzel',serif";ctx.textAlign="center";
    ctx.fillText("SHRINE ⛁30",sx,sy-30);
    ctx.restore();
  }
}
