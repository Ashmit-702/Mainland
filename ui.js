// MAINLAND — ui.js

const UI = {
  hpBar:     document.getElementById("hp-bar"),
  hpText:    document.getElementById("hp-text"),
  xpBar:     document.getElementById("xp-bar"),
  dashBar:   document.getElementById("dash-bar"),
  lvEl:      document.getElementById("s-lv"),
  atkEl:     document.getElementById("s-atk"),
  defEl:     document.getElementById("s-def"),
  goldEl:    document.getElementById("s-gold"),
  arrowsEl:  document.getElementById("s-arrows"),
  floorLbl:  document.getElementById("floor-label"),
  zoneEl:    document.getElementById("zone-label"),
  killEl:    document.getElementById("kill-count"),
  bossWrap:  document.getElementById("boss-bar-wrap"),
  bossName:  document.getElementById("boss-name-label"),
  bossBar:   document.getElementById("boss-hp-bar"),
  bossPhase: document.getElementById("boss-phase-label"),
  toastLog:  document.getElementById("toast-log"),
  mmCtx:     document.getElementById("minimap").getContext("2d"),

  updatePlayer(p) {
    const hpR = Math.max(0, p.hp / p.maxHp) * 100;
    this.hpBar.style.width = hpR + "%";
    this.hpBar.style.background =
      hpR < 25 ? "linear-gradient(90deg,#701010,#b02020)"
    : hpR < 50 ? "linear-gradient(90deg,#803020,#c05030)"
               : "linear-gradient(90deg,#a03030,#e05050)";
    this.hpText.textContent  = `${p.hp}/${p.maxHp}`;
    this.xpBar.style.width   = (p.xp / p.xpToNext * 100) + "%";
    if (this.dashBar) this.dashBar.style.width = (p.dashRatio * 100) + "%";
    this.lvEl.textContent    = p.level;
    this.atkEl.textContent   = p.attack;
    this.defEl.textContent   = p.defense;
    this.goldEl.textContent  = "⛁ " + p.gold;
    this.arrowsEl.textContent= p.arrows;
  },

  setFloor(n, zoneName) {
    if (this.floorLbl) this.floorLbl.textContent = `Floor ${n}`;
    if (this.zoneEl && zoneName) this.zoneEl.textContent = zoneName;
  },

  setKills(n) { if (this.killEl) this.killEl.textContent = n; },

  showBoss(boss) {
    this.bossWrap.classList.remove("hidden");
    this.bossName.textContent  = boss.name;
    this.bossPhase.textContent = "";
    this.updateBoss(boss);
  },
  updateBoss(boss) {
    if (!boss || boss.hp <= 0) { this.bossWrap.classList.add("hidden"); return; }
    this.bossBar.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + "%";
    if (boss.phase2Done) this.bossPhase.textContent = "⚡ ENRAGED";
  },
  hideBoss() { this.bossWrap.classList.add("hidden"); },

  toast(text, type = "") {
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = text;
    this.toastLog.appendChild(el);
    while (this.toastLog.children.length > 5)
      this.toastLog.removeChild(this.toastLog.firstChild);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 600); }, 3200);
  },

  showDeathStats(p, floor) {
    const el = document.getElementById("death-stats");
    if (el) el.innerHTML =
      `<strong>Floor reached:</strong> ${floor}<br>
       <strong>Level:</strong> ${p.level}<br>
       <strong>Kills:</strong> ${p.kills}<br>
       <strong>Gold:</strong> ${p.gold}`;
  },

  showVictoryStats(p) {
    const el = document.getElementById("victory-stats");
    if (el) el.innerHTML =
      `<strong>Final level:</strong> ${p.level}<br>
       <strong>Total kills:</strong> ${p.kills}<br>
       <strong>Gold:</strong> ${p.gold}<br>
       <strong>Floors cleared:</strong> ${p.floorsCleared}`;
  },

  showFloorClearStats(p, floor, zoneName) {
    const sub   = document.getElementById("floor-clear-sub");
    const stats = document.getElementById("floor-clear-stats");
    if (sub)   sub.textContent = floor % 3 === 0
      ? "The boss falls. Silence reclaims the hall."
      : `${zoneName || "The floor"} — darkness retreats.`;
    if (stats) stats.innerHTML =
      `<strong>Floor ${floor} cleared</strong><br>
       Level ${p.level} · ${p.kills} kills · ⛁ ${p.gold}`;
  },

  drawMinimap(player, enemies, npcs, dungeon) {
    dungeon.drawMinimap(this.mmCtx, player, enemies, npcs);
  },

  showNarrative(text, duration=4500) {
    let el = document.getElementById("narrative-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "narrative-overlay";
      el.style.cssText =
        "position:fixed;bottom:110px;left:50%;transform:translateX(-50%);" +
        "max-width:520px;width:90%;text-align:center;z-index:50;pointer-events:none;" +
        "font-family:'Crimson Pro',serif;font-size:1.1rem;font-style:italic;" +
        "color:rgba(230,220,200,0.92);text-shadow:0 2px 20px rgba(0,0,0,0.95);" +
        "transition:opacity 1s;opacity:0;";
      document.body.appendChild(el);
    }
    clearTimeout(this._narrativeTimer);
    el.textContent = text;
    el.style.opacity = "1";
    this._narrativeTimer = setTimeout(() => { el.style.opacity = "0"; }, duration);
  },
};

// ── Dialogue — info only, no reply input ──
const Dialogue = {
  wrap:      document.getElementById("dialogue-wrap"),
  speakerEl: document.getElementById("dialogue-speaker"),
  roleEl:    document.getElementById("dialogue-role"),
  textEl:    document.getElementById("dialogue-text"),
  hintEl:    document.getElementById("dialogue-hint"),
  _timer: null, _dotTimer: null, _full: "", _shown: 0,

  open(speaker, role, text) {
    clearInterval(this._dotTimer);
    this.speakerEl.textContent = speaker;
    if (this.roleEl) this.roleEl.textContent = role ? `· ${role}` : "";
    this.wrap.classList.remove("hidden");
    this.textEl.className = "";
    this._typewrite(text);
  },

  loading(speaker, role) {
    this.speakerEl.textContent = speaker;
    if (this.roleEl) this.roleEl.textContent = role ? `· ${role}` : "";
    this.textEl.className = "dialogue-loading";
    this.wrap.classList.remove("hidden");
    clearInterval(this._dotTimer);
    let d = 0;
    this._dotTimer = setInterval(() => {
      this.textEl.textContent = "thinking" + ".".repeat(d++ % 4);
    }, 300);
  },

  _typewrite(text) {
    clearInterval(this._timer);
    this._full = text; this._shown = 0; this.textEl.textContent = "";
    this._timer = setInterval(() => {
      this._shown = Math.min(this._full.length, this._shown + 2);
      this.textEl.textContent = this._full.slice(0, this._shown);
      if (this._shown >= this._full.length) clearInterval(this._timer);
    }, 18);
  },

  close() {
    clearInterval(this._timer);
    clearInterval(this._dotTimer);
    this.wrap.classList.add("hidden");
  },

  isOpen() { return !this.wrap.classList.contains("hidden"); },
};

// ── Screens ───────────────────────────────
const Screens = {
  show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  },
  showOverlay(id)  { document.getElementById(id)?.classList.remove("hidden"); },
  hideOverlay(id)  { document.getElementById(id)?.classList.add("hidden"); },
  hideAllOverlays() {
    ["gameover-screen","victory-screen","floor-clear-screen","loading-screen","levelup-screen"]
      .forEach(id => this.hideOverlay(id));
  },
};
