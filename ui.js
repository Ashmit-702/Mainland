// ─────────────────────────────────────────────
//  MAINLAND — ui.js
//  HUD updates, dialogue controller, toasts
// ─────────────────────────────────────────────

// ── HUD ──────────────────────────────────────
const UI = {
  hpBar:      document.getElementById("hp-bar"),
  hpText:     document.getElementById("hp-text"),
  xpBar:      document.getElementById("xp-bar"),
  lvEl:       document.getElementById("s-lv"),
  atkEl:      document.getElementById("s-atk"),
  defEl:      document.getElementById("s-def"),
  goldEl:     document.getElementById("s-gold"),
  floorLabel: document.getElementById("floor-label"),
  bossWrap:   document.getElementById("boss-bar-wrap"),
  bossName:   document.getElementById("boss-name-label"),
  bossBar:    document.getElementById("boss-hp-bar"),
  toastLog:   document.getElementById("toast-log"),
  mmCtx:      document.getElementById("minimap").getContext("2d"),

  updatePlayer(p) {
    const hpRatio = Math.max(0, p.hp / p.maxHp) * 100;
    this.hpBar.style.width  = hpRatio + "%";
    this.hpBar.style.background = hpRatio < 30 ? "#ff8c00" : "#c84b3c";
    this.hpText.textContent = `${p.hp}/${p.maxHp}`;
    this.xpBar.style.width  = (p.xp / p.xpToNext * 100) + "%";
    this.lvEl.textContent   = p.level;
    this.atkEl.textContent  = p.attack;
    this.defEl.textContent  = p.defense;
    this.goldEl.textContent = "⛁ " + p.gold;
  },

  setFloor(n) {
    this.floorLabel.textContent = `Floor ${n}`;
  },

  showBoss(boss) {
    this.bossWrap.classList.remove("hidden");
    this.bossName.textContent = boss.name;
    this.updateBoss(boss);
  },

  updateBoss(boss) {
    if (boss && boss.hp > 0) {
      const r = Math.max(0, boss.hp / boss.maxHp) * 100;
      this.bossBar.style.width = r + "%";
    } else {
      this.bossWrap.classList.add("hidden");
    }
  },

  hideBoss() { this.bossWrap.classList.add("hidden"); },

  toast(text, duration = 130) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    this.toastLog.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, (duration - 30) * (1000 / 60)); // roughly frames → ms
    setTimeout(() => el.remove(), duration * (1000 / 60));
  },

  clearToasts() { this.toastLog.innerHTML = ""; },
};

// ── Dialogue controller ───────────────────────
const Dialogue = {
  wrap:      document.getElementById("dialogue-wrap"),
  speakerEl: document.getElementById("dialogue-speaker"),
  textEl:    document.getElementById("dialogue-text"),
  inputWrap: document.getElementById("dialogue-input-wrap"),
  inputEl:   document.getElementById("dialogue-input"),
  btnSend:   document.getElementById("btn-send"),
  hintEl:    document.getElementById("dialogue-hint"),

  _typeTimer: null,
  _fullText:  "",
  _shown:     0,
  _onSend:    null,

  open(speaker, text, onSend) {
    this._onSend = onSend;
    this.speakerEl.textContent = speaker;
    this.inputWrap.classList.add("hidden");
    this.hintEl.classList.remove("hidden");
    this.wrap.classList.remove("hidden");
    this._typewrite(text);

    this.btnSend.onclick = () => this._submitInput();
    this.inputEl.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); this._submitInput(); }
    };
  },

  loading(speaker) {
    this.speakerEl.textContent = speaker;
    this.textEl.textContent    = "";
    this.textEl.className      = "dialogue-loading";
    this.inputWrap.classList.add("hidden");
    this.hintEl.classList.add("hidden");
    this.wrap.classList.remove("hidden");
    this._animateDots();
  },

  _dotTimer: null,
  _animateDots() {
    clearInterval(this._dotTimer);
    let d = 0;
    this._dotTimer = setInterval(() => {
      this.textEl.textContent = "thinking" + ".".repeat((d++ % 4));
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
    clearInterval(this._typeTimer);
    this._fullText = text;
    this._shown    = 0;
    this.textEl.textContent = "";
    this._typeTimer = setInterval(() => {
      this._shown = Math.min(this._fullText.length, this._shown + 1);
      this.textEl.textContent = this._fullText.slice(0, this._shown);
      if (this._shown >= this._fullText.length) clearInterval(this._typeTimer);
    }, 25);
  },

  skipType() {
    clearInterval(this._typeTimer);
    this._shown = this._fullText.length;
    this.textEl.textContent = this._fullText;
  },

  isDone() { return this._shown >= this._fullText.length; },

  openInput() {
    this.inputWrap.classList.remove("hidden");
    this.hintEl.classList.add("hidden");
    this.inputEl.value = "";
    this.inputEl.focus();
  },

  _submitInput() {
    const val = this.inputEl.value.trim();
    if (!val) return;
    this.inputEl.value = "";
    this.inputWrap.classList.add("hidden");
    if (this._onSend) this._onSend(val);
  },

  close() {
    clearInterval(this._typeTimer);
    clearInterval(this._dotTimer);
    this.wrap.classList.add("hidden");
    this.inputEl.blur();
  },

  isOpen() { return !this.wrap.classList.contains("hidden"); },
};

// ── Screen helpers ────────────────────────────
const Screens = {
  show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  },
  showOverlay(id)  { document.getElementById(id)?.classList.remove("hidden"); },
  hideOverlay(id)  { document.getElementById(id)?.classList.add("hidden"); },
  hideAllOverlays() {
    ["gameover-screen","victory-screen","floor-clear-screen","loading-screen"]
      .forEach(id => this.hideOverlay(id));
  },
};
