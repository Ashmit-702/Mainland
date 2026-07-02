// ─────────────────────────────────────────────
//  MAINLAND — dungeon.js
//  Client-side dungeon wrapper + tile renderer
//  Dungeon DATA comes from /api/floor (Python BSP)
//  This file: wraps that data + renders tiles + minimap
// ─────────────────────────────────────────────

const FLOOR_TILE = 0;
const WALL_TILE  = 1;
const STAIR_TILE = 3;

class Dungeon {
  constructor(data) {
    this.grid        = data.grid;         // 2D array [row][col]
    this.rooms       = data.rooms;
    this.cols        = data.cols;
    this.rows        = data.rows;
    this.playerStart = data.player_start; // {gx, gy}
    this.stairsPos   = data.stairs;       // {gx, gy}
    this.enemyData   = data.enemies;      // [{name, gx, gy}]
    this.bossData    = data.boss;         // {name, gx, gy} | null
    this.npcData     = data.npcs;         // [{name, gx, gy}]
    this.itemData    = data.items;        // [{name, gx, gy}]
    this.floorNumber = data.floor_number;
  }

  isWalkable(gx, gy) {
    gx = Math.floor(gx); gy = Math.floor(gy);
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return false;
    return this.grid[gy][gx] === FLOOR_TILE || this.grid[gy][gx] === STAIR_TILE;
  }

  // ── tile rendering ────────────────────────
  draw(ctx, camX, camY, tick) {
    const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
    const endCol   = Math.min(this.cols, Math.ceil((camX + ctx.canvas.width)  / TILE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE) - 1);
    const endRow   = Math.min(this.rows, Math.ceil((camY + ctx.canvas.height) / TILE) + 1);

    for (let gy = startRow; gy < endRow; gy++) {
      for (let gx = startCol; gx < endCol; gx++) {
        const tile = this.grid[gy][gx];
        const sx = gx * TILE - camX;
        const sy = gy * TILE - camY;

        if (tile === WALL_TILE) {
          // wall — layered look
          ctx.fillStyle = "#160f28";
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = "#1e1535";
          ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "#12082e";
          ctx.fillRect(sx, sy, TILE, 3);  // top shadow

        } else if (tile === FLOOR_TILE) {
          ctx.fillStyle = "#2a1e46";
          ctx.fillRect(sx, sy, TILE, TILE);
          // checker texture
          if ((gx + gy) % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.025)";
            ctx.fillRect(sx, sy, TILE, TILE);
          }
          // subtle border
          ctx.strokeStyle = "rgba(255,255,255,0.04)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);

        } else if (tile === STAIR_TILE) {
          ctx.fillStyle = "#2a1e46";
          ctx.fillRect(sx, sy, TILE, TILE);
          const glow = 100 + Math.floor(60 * Math.sin(tick * 0.05));
          ctx.fillStyle = `rgb(${glow},${glow},30)`;
          ctx.beginPath();
          ctx.roundRect(sx + 6, sy + 6, TILE - 12, TILE - 12, 4);
          ctx.fill();
          ctx.strokeStyle = "#d4aa3a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(sx + 6, sy + 6, TILE - 12, TILE - 12, 4);
          ctx.stroke();
          // arrow down symbol
          ctx.fillStyle = "#d4aa3a";
          ctx.font = "bold 18px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("↓", sx + TILE / 2, sy + TILE / 2);
          ctx.textBaseline = "alphabetic";
        }
      }
    }
  }

  // ── items ─────────────────────────────────
  drawItems(ctx, camX, camY, items, tick) {
    for (const [key, name] of items.entries()) {
      const [gx, gy] = key.split(",").map(Number);
      const d  = ITEM_DEFS[name];
      if (!d) continue;
      const wx = gx * TILE + TILE / 2;
      const wy = gy * TILE + TILE / 2;
      const sx = Math.round(wx - camX);
      const sy = Math.round(wy - camY + Math.sin(tick * 0.08 + gx) * 4);

      ctx.save();
      // sparkle glow
      if (Math.abs(Math.sin(tick * 0.1)) > 0.7) {
        ctx.shadowColor = d.colour;
        ctx.shadowBlur  = 12;
      }
      ctx.fillStyle = d.colour;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // ── minimap ───────────────────────────────
  drawMinimap(mmCtx, player, enemies, npcs, items) {
    const cw = mmCtx.canvas.width;
    const ch = mmCtx.canvas.height;
    const tw = cw / this.cols;
    const th = ch / this.rows;

    mmCtx.clearRect(0, 0, cw, ch);
    mmCtx.fillStyle = "#0a0715";
    mmCtx.fillRect(0, 0, cw, ch);

    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const t = this.grid[gy][gx];
        if (t === WALL_TILE) continue;
        mmCtx.fillStyle = t === STAIR_TILE ? "#d4aa3a" : "#2e2050";
        mmCtx.fillRect(gx * tw, gy * th, tw, th);
      }
    }

    // enemies (red dots)
    mmCtx.fillStyle = "#c84b3c";
    for (const e of enemies) {
      if (e.hp > 0) mmCtx.fillRect(e.gx * tw - 1, e.gy * th - 1, 2.5, 2.5);
    }

    // NPCs (teal)
    mmCtx.fillStyle = "#3cb8b0";
    for (const n of npcs) mmCtx.fillRect(n.gx * tw - 1, n.gy * th - 1, 2.5, 2.5);

    // player (gold)
    mmCtx.fillStyle = "#d4aa3a";
    mmCtx.beginPath();
    mmCtx.arc(player.gx * tw, player.gy * th, 2.5, 0, Math.PI * 2);
    mmCtx.fill();
  }
}
