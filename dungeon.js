// MAINLAND — dungeon.js — Zone-themed renderer

const FLOOR_TILE  = 0;
const WALL_TILE   = 1;
const STAIR_TILE  = 3;
const SHRINE_TILE = 4;
const DOOR_TILE   = 5;

class Dungeon {
  constructor(data) {
    this.grid        = data.grid;
    this.rooms       = data.rooms;
    this.cols        = data.cols;
    this.rows        = data.rows;
    this.playerStart = data.player_start;
    this.stairsPos   = data.stairs;
    this.shrinePos   = data.shrine || null;
    this.doorCells   = (data.door && data.door.cells) || [];
    this.enemyData   = data.enemies;
    this.bossData    = data.boss;
    this.npcData     = data.npcs;
    this.itemData    = data.items;
    this.floorNumber = data.floor_number;
    this.zone        = data.zone || 1;
    this.zoneName    = data.zone_name || "The Ruins";
  }

  get hasLockedDoor() {
    return this.doorCells.some(c => this.grid[c.gy][c.gx] === DOOR_TILE);
  }

  // Nearest still-locked door cell within range of the player, or null.
  nearestLockedDoor(player, range) {
    let best = null, bestD = Infinity;
    for (const c of this.doorCells) {
      if (this.grid[c.gy][c.gx] !== DOOR_TILE) continue;
      const cx = c.gx * TILE + TILE / 2, cy = c.gy * TILE + TILE / 2;
      const d = Math.hypot(player.x - cx, player.y - cy);
      if (d <= range && d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  unlockDoors() {
    for (const c of this.doorCells) this.grid[c.gy][c.gx] = FLOOR_TILE;
  }

  isWalkable(gx, gy) {
    gx = Math.floor(gx); gy = Math.floor(gy);
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return false;
    const t = this.grid[gy][gx];
    return t === FLOOR_TILE || t === STAIR_TILE || t === SHRINE_TILE;
  }

  draw(ctx, camX, camY, tick) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const theme = ZONE_THEMES[this.zone] || ZONE_THEMES[1];

    // Fill entire canvas — no black gaps ever
    ctx.fillStyle = theme.wall;
    ctx.fillRect(0, 0, W, H);

    // Visible tile range
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(this.cols, Math.ceil((camX + W) / TILE) + 2);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(this.rows, Math.ceil((camY + H) / TILE) + 2);

    for (let gy = r0; gy < r1; gy++) {
      for (let gx = c0; gx < c1; gx++) {
        const tile = this.grid[gy][gx];
        const sx = Math.round(gx * TILE - camX);
        const sy = Math.round(gy * TILE - camY);

        if (tile === WALL_TILE) {
          ctx.fillStyle = theme.wall;
          ctx.fillRect(sx, sy, TILE, TILE);
          // raised wall face
          ctx.fillStyle = theme.wallTop;
          ctx.fillRect(sx + 1, sy + 2, TILE - 2, TILE - 3);
          // top edge highlight
          ctx.fillStyle = theme.accent + "40";
          ctx.fillRect(sx, sy, TILE, 2);

        } else if (tile === FLOOR_TILE) {
          ctx.fillStyle = theme.floor;
          ctx.fillRect(sx, sy, TILE, TILE);
          // subtle checker
          if ((gx + gy) % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.015)";
            ctx.fillRect(sx, sy, TILE, TILE);
          }
          // grid lines
          ctx.strokeStyle = theme.accent + "18";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);

        } else if (tile === STAIR_TILE) {
          ctx.fillStyle = theme.floor;
          ctx.fillRect(sx, sy, TILE, TILE);
          const p = 0.5 + 0.5 * Math.sin(tick * 0.06);
          // zone-coloured stair glow
          const sc = this.zone === 1 ? `rgba(180,140,20,${0.6+p*0.3})`
                   : this.zone === 2 ? `rgba(180,40,40,${0.6+p*0.3})`
                   :                   `rgba(40,80,200,${0.6+p*0.3})`;
          ctx.fillStyle = sc;
          ctx.beginPath();
          ctx.roundRect(sx + 5, sy + 5, TILE - 10, TILE - 10, 5);
          ctx.fill();
          ctx.strokeStyle = "#d4aa3a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(sx + 5, sy + 5, TILE - 10, TILE - 10, 5);
          ctx.stroke();
          ctx.fillStyle = "#d4aa3a";
          ctx.font = `bold ${Math.floor(TILE * 0.38)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("↓", sx + TILE / 2, sy + TILE / 2);
          ctx.textBaseline = "alphabetic";

        } else if (tile === SHRINE_TILE) {
          ctx.fillStyle = theme.floor;
          ctx.fillRect(sx, sy, TILE, TILE);
          // shrine floor marker
          ctx.strokeStyle = "#3cdc7840";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(sx + 4, sy + 4, TILE - 8, TILE - 8, 4);
          ctx.stroke();

        } else if (tile === DOOR_TILE) {
          // Locked vault door — reads as a barred, glowing obstruction.
          ctx.fillStyle = theme.wall;
          ctx.fillRect(sx, sy, TILE, TILE);
          const p = 0.5 + 0.5 * Math.sin(tick * 0.05);
          ctx.fillStyle = "#3a2a10";
          ctx.fillRect(sx + 3, sy + 2, TILE - 6, TILE - 4);
          ctx.strokeStyle = `rgba(212,170,58,${0.55 + p * 0.35})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 3, sy + 2, TILE - 6, TILE - 4);
          // bars
          ctx.strokeStyle = "rgba(212,170,58,0.55)";
          ctx.lineWidth = 1.5;
          for (let bx = sx + 10; bx < sx + TILE - 6; bx += 8) {
            ctx.beginPath(); ctx.moveTo(bx, sy + 4); ctx.lineTo(bx, sy + TILE - 4); ctx.stroke();
          }
          // padlock glyph
          ctx.fillStyle = `rgba(240,204,96,${0.75 + p * 0.25})`;
          ctx.font = `bold ${Math.floor(TILE * 0.36)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("🔒", sx + TILE / 2, sy + TILE / 2);
          ctx.textBaseline = "alphabetic";
        }
      }
    }
  }

  drawItems(ctx, camX, camY, items, tick) {
    for (const [key, name] of items.entries()) {
      const [gx, gy] = key.split(",").map(Number);
      const d = ITEM_DEFS[name];
      if (!d) continue;
      const sx = Math.round(gx * TILE + TILE / 2 - camX + Shake.x);
      const sy = Math.round(gy * TILE + TILE / 2 - camY + Shake.y + Math.sin(tick * 0.08 + gx) * 4);
      ctx.save();
      ctx.shadowColor = d.colour;
      ctx.shadowBlur  = 8 + Math.abs(Math.sin(tick * 0.08)) * 6;
      ctx.fillStyle   = d.colour;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  drawMinimap(mmCtx, player, enemies, npcs) {
    const cw = mmCtx.canvas.width, ch = mmCtx.canvas.height;
    const tw = cw / this.cols, th = ch / this.rows;
    const theme = ZONE_THEMES[this.zone] || ZONE_THEMES[1];

    mmCtx.fillStyle = "#050310";
    mmCtx.fillRect(0, 0, cw, ch);

    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const t = this.grid[gy][gx];
        if (t === WALL_TILE) continue;
        mmCtx.fillStyle = t === STAIR_TILE  ? "#d4aa3a"
                        : t === SHRINE_TILE ? "#3cdc78"
                        : t === DOOR_TILE   ? "#f0cc60"
                        : theme.floor;
        mmCtx.fillRect(gx * tw, gy * th, tw + 0.5, th + 0.5);
      }
    }

    // enemies
    mmCtx.fillStyle = "#c84040";
    for (const e of enemies) {
      if (e.hp > 0) mmCtx.fillRect(e.gx * tw - 1, e.gy * th - 1, 3, 3);
    }
    // npcs
    mmCtx.fillStyle = "#3cb8a8";
    for (const n of npcs) mmCtx.fillRect(n.gx * tw - 1, n.gy * th - 1, 2.5, 2.5);
    // player
    mmCtx.fillStyle = "#d4aa3a";
    mmCtx.beginPath();
    mmCtx.arc(player.gx * tw, player.gy * th, 3, 0, Math.PI * 2);
    mmCtx.fill();
  }
}
