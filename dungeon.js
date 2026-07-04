// MAINLAND — dungeon.js

const FLOOR_TILE = 0;
const WALL_TILE  = 1;
const STAIR_TILE = 3;

class Dungeon {
  constructor(data) {
    this.grid        = data.grid;
    this.rooms       = data.rooms;
    this.cols        = data.cols;
    this.rows        = data.rows;
    this.playerStart = data.player_start;
    this.stairsPos   = data.stairs;
    this.enemyData   = data.enemies;
    this.bossData    = data.boss;
    this.npcData     = data.npcs;
    this.itemData    = data.items;
    this.floorNumber = data.floor_number;
  }

  isWalkable(gx, gy) {
    gx = Math.floor(gx); gy = Math.floor(gy);
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return false;
    return this.grid[gy][gx] === FLOOR_TILE || this.grid[gy][gx] === STAIR_TILE;
  }

  draw(ctx, camX, camY, tick) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    // Fill ENTIRE canvas with dark void first — no black gaps
    ctx.fillStyle = "#08051a";
    ctx.fillRect(0, 0, W, H);

    const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
    const endCol   = Math.min(this.cols, Math.ceil((camX + W) / TILE) + 2);
    const startRow = Math.max(0, Math.floor(camY / TILE) - 1);
    const endRow   = Math.min(this.rows, Math.ceil((camY + H) / TILE) + 2);

    for (let gy = startRow; gy < endRow; gy++) {
      for (let gx = startCol; gx < endCol; gx++) {
        const tile = this.grid[gy][gx];
        const sx = Math.round(gx * TILE - camX);
        const sy = Math.round(gy * TILE - camY);

        if (tile === WALL_TILE) {
          ctx.fillStyle = "#0e0820";
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = "#160c2e";
          ctx.fillRect(sx + 1, sy + 2, TILE - 2, TILE - 2);
          // top highlight
          ctx.fillStyle = "#1e1040";
          ctx.fillRect(sx, sy, TILE, 3);

        } else if (tile === FLOOR_TILE) {
          ctx.fillStyle = "#1e1638";
          ctx.fillRect(sx, sy, TILE, TILE);
          if ((gx + gy) % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.018)";
            ctx.fillRect(sx, sy, TILE, TILE);
          }
          // subtle grid line
          ctx.strokeStyle = "rgba(100,80,160,0.12)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);

        } else if (tile === STAIR_TILE) {
          ctx.fillStyle = "#1e1638";
          ctx.fillRect(sx, sy, TILE, TILE);
          const pulse = 0.5 + 0.5 * Math.sin(tick * 0.06);
          const r = Math.floor(180 * pulse + 60);
          const g = Math.floor(140 * pulse + 60);
          ctx.fillStyle = `rgba(${r},${g},20,0.85)`;
          ctx.beginPath();
          ctx.roundRect(sx + 5, sy + 5, TILE - 10, TILE - 10, 5);
          ctx.fill();
          ctx.strokeStyle = "#d4aa3a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(sx + 5, sy + 5, TILE - 10, TILE - 10, 5);
          ctx.stroke();
          ctx.fillStyle = "#d4aa3a";
          ctx.font = `bold ${Math.floor(TILE * 0.4)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("↓", sx + TILE / 2, sy + TILE / 2);
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
      const sx = Math.round(gx * TILE + TILE / 2 - camX);
      const sy = Math.round(gy * TILE + TILE / 2 - camY + Math.sin(tick * 0.08 + gx) * 4);
      ctx.save();
      ctx.shadowColor = d.colour;
      ctx.shadowBlur  = 10 + Math.sin(tick * 0.1) * 5;
      ctx.fillStyle   = d.colour;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  drawMinimap(mmCtx, player, enemies, npcs) {
    const cw = mmCtx.canvas.width;
    const ch = mmCtx.canvas.height;
    const tw = cw / this.cols;
    const th = ch / this.rows;
    mmCtx.clearRect(0, 0, cw, ch);
    mmCtx.fillStyle = "#050310";
    mmCtx.fillRect(0, 0, cw, ch);
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const t = this.grid[gy][gx];
        if (t === WALL_TILE) continue;
        mmCtx.fillStyle = t === STAIR_TILE ? "#d4aa3a" : "#2a1e50";
        mmCtx.fillRect(gx * tw, gy * th, tw + 0.5, th + 0.5);
      }
    }
    mmCtx.fillStyle = "#c84040";
    for (const e of enemies) {
      if (e.hp > 0) mmCtx.fillRect(e.gx * tw - 1, e.gy * th - 1, 3, 3);
    }
    mmCtx.fillStyle = "#3cb8a8";
    for (const n of npcs) mmCtx.fillRect(n.gx * tw - 1, n.gy * th - 1, 3, 3);
    mmCtx.fillStyle = "#d4aa3a";
    mmCtx.beginPath();
    mmCtx.arc(player.gx * tw, player.gy * th, 3, 0, Math.PI * 2);
    mmCtx.fill();
  }
}
