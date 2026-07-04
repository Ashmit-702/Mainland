// MAINLAND — ui.js

const UI = {
  hpBar:      document.getElementById("hp-bar"),
  hpText:     document.getElementById("hp-text"),
  xpBar:      document.getElementById("xp-bar"),
  dashBar:    document.getElementById("dash-bar"),
  lvEl:       document.getElementById("s-lv"),
  atkEl:      document.getElementById("s-atk"),
  defEl:      document.getElementById("s-def"),
  goldEl:     document.getElementById("s-gold"),
  arrowsEl:   document.getElementById("s-arrows"),
  floorLabel: document.getElementById("floor-label"),
  killCount:  document.getElementById("kill-count"),
  bossWrap:   document.getElementById("boss-bar-wrap"),
  bossName:   document.getElementById("boss-name-label"),
  bossBar:    document.getElementById("boss-hp-bar"),
  bossPhase:  document.getElementById("boss-phase-label"),
  toastLog:   document.getElementById("toast-log"),
  mmCtx:      document.getElementById("minimap").getContext("2d"),

  updatePlayer(p) {
    const hpR = Math.max(0, p.hp / p.maxHp) * 100;
    this.hpBar.style.width = hpR + "%";
    this.hpBar.style.background =
      hpR < 25 ? "linear-gradient(90deg,#801010,#c02020)"
    : hpR < 50 ? "linear-gradient(90deg,#904020,#d06030)"
               : "linear-gradient(90deg,#a03030,#e05050)";
    this.hpText.textContent = `${p.hp}/${p.maxHp}`;
    this.xpBar.style.width  = (p.xp / p.xpToNext * 100) + "%";
    if (this.dashBar) this.dashBar.style.width = (p.dashRatio * 100) + "%";
    this.lvEl.textContent     = p.level;
    this.atkEl.textContent    = p.attack;
    this.defEl.textContent    = p.defense;
    this.goldEl.textContent   = "⛁ " + p.gold;
    this.arrowsEl.textContent = p.arrows;
  },

  setFloor(n) { this.floorLabel.textContent = `Floor ${n}`; },
  setKills(n)  { if (this.killCount) this.killCount.textContent = n; },

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
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 500); }, 2800);
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

  showFloorClearStats(p, floor) {
    const sub = document.getElementById("floor-clear-sub");
    const stats = document.getElementById("floor-clear-stats");
    if (sub) sub.textContent = floor % 3 === 0
      ? "The boss falls. Silence reclaims the hall."
      : "The floor is clear. Darkness retreats one step.";
    if (stats) stats.innerHTML =
      `<strong>Floor ${floor} cleared</strong><br>
       Level ${p.level} · ${p.kills} kills · ${p.gold} gold`;
  },

  // FIX: signature matches game.js call — no dungeon param
  drawMinimap(player, enemies, npcs, dungeon) {
    const mm = this.mmCtx;
    const cw = mm.canvas.width, ch = mm.canvas.height;
    dungeon.drawMinimap(mm, player, enemies, npcs);
  },
};

// ── Dialogue ─────────────────────────────────
const Dialogue = {
  wrap:      document.getElementById("dialogue-wrap"),
  speakerEl: document.getElementById("dialogue-speaker"),
  roleEl:    document.getElementById("dialogue-role"),
  textEl:    document.getElementById("dialogue-text"),
  inputWrap: document.getElementById("dialogue-input-wrap"),
  inputEl:   document.getElementById("dialogue-input"),
  btnSend:   document.getElementById("btn-send"),
  hintEl:    document.getElementById("dialogue-hint"),

  _timer: null, _dotTimer: null,
  _full: "", _shown: 0,
  _onSend: null,

  open(speaker, role, text, onSend) {
    this._onSend = onSend;
    this.speakerEl.textContent = speaker;
    if (this.roleEl) this.roleEl.textContent = role ? `· ${role}` : "";
    this.inputWrap.classList.add("hidden");
    this.hintEl.classList.remove("hidden");
    this.wrap.classList.remove("hidden");
    this.textEl.className = "";
    this._typewrite(text);

    // FIX: rebind send button and enter key every time open() is called
    this.btnSend.onclick = () => this._submit();
    this.inputEl.onkeydown = e => {
      if (e.key === "Enter") { e.preventDefault(); this._submit(); }
    };
  },

  loading(speaker, role) {
    this.speakerEl.textContent = speaker;
    if (this.roleEl) this.roleEl.textContent = role ? `· ${role}` : "";
    this.textEl.className = "dialogue-loading";
    this.inputWrap.classList.add("hidden");
    this.hintEl.classList.add("hidden");
    this.wrap.classList.remove("hidden");
    clearInterval(this._dotTimer);
    let d = 0;
    this._dotTimer = setInterval(() => {
      this.textEl.textContent = "thinking" + ".".repeat(d++ % 4);
    }, 300);
  },

  setResponse(text) {
    clearInterval(this._dotTimer);
    this.textEl.className = "";
    this._typewrite(text);
    this.inputWrap.classList.add("hidden");
    this.hintEl.classList.remove("hidden");
  },

  _typewrite(text) {
    clearInterval(this._timer);
    this._full = text; this._shown = 0;
    this.textEl.textContent = "";
    this._timer = setInterval(() => {
      this._shown = Math.min(this._full.length, this._shown + 1);
      this.textEl.textContent = this._full.slice(0, this._shown);
      if (this._shown >= this._full.length) clearInterval(this._timer);
    }, 22);
  },

  skipType() {
    clearInterval(this._timer);
    this._shown = this._full.length;
    this.textEl.textContent = this._full;
  },

  isDone() { return this._shown >= this._full.length; },

  openInput() {
    this.inputWrap.classList.remove("hidden");
    this.hintEl.classList.add("hidden");
    this.inputEl.value = "";
    this.inputEl.focus();
  },

  _submit() {
    const val = this.inputEl.value.trim();
    if (!val) return;
    this.inputEl.value = "";
    this.inputWrap.classList.add("hidden");
    if (this._onSend) this._onSend(val);
  },

  close() {
    clearInterval(this._timer);
    clearInterval(this._dotTimer);
    this.wrap.classList.add("hidden");
    this.inputEl.blur();
    this._onSend = null;
  },

  isOpen() { return !this.wrap.classList.contains("hidden"); },
};

// ── Screens ───────────────────────────────────
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
