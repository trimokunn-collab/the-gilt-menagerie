// The Gilt Menagerie — engine.
// Top-down stealth on a single canvas: cross the galleries, lift the
// treasure, mind the lanterns and the camera eyes, and leave by the
// south door once the bag holds the goal. Pure DOM/canvas, no assets,
// no network: everything is drawn and synthesised in code.
"use strict";

// ---------------------------------------------------------------- setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const COLS = MAP_ROWS[0].length;
const ROWS = MAP_ROWS.length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// Scale the backing store for crisp lines on retina displays; all
// drawing below uses world pixels.
(function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD_W * dpr;
  canvas.height = WORLD_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

const el = (id) => document.getElementById(id);
const hud = {
  loot: el("hud-loot"), lootCount: el("hud-loot-count"),
  goalState: el("hud-goal-state"), alarm: el("hud-alarm"),
  alarmState: el("hud-alarm-state"), time: el("hud-time"),
  seen: el("hud-seen"), objective: el("objective"),
};
el("hud-goal").textContent = "$" + TARGET_TAKE.toLocaleString("en-US");

// ------------------------------------------------------------- the world
// solid[c] is true for tiles that block movement and sight.
const solid = new Uint8Array(COLS * ROWS);
const tileAt = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return "#";
  return MAP_ROWS[ty][tx];
};
let startTile = { x: 12, y: 21 };
let exitTiles = [];
(function parseWorld() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP_ROWS[y][x];
      if (ch === "#" || ch === "F" || ch === "C") solid[y * COLS + x] = 1;
      if (ch === "P") startTile = { x, y };
      if (ch === "X") exitTiles.push({ x, y });
    }
  }
})();

const tileCenter = (tx, ty) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
const isSolidPx = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return solid[ty * COLS + tx] === 1;
};

// Circle vs. tile-grid collision: try the full move, then each axis.
function moveCircle(p, dx, dy) {
  const r = p.r;
  const hits = (x, y) =>
    isSolidPx(x - r, y - r) || isSolidPx(x + r, y - r) ||
    isSolidPx(x - r, y + r) || isSolidPx(x + r, y + r);
  let bumped = false;
  if (!hits(p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; return false; }
  if (!hits(p.x + dx, p.y)) { p.x += dx; } else if (dx !== 0) bumped = true;
  if (!hits(p.x, p.y + dy)) { p.y += dy; } else if (dy !== 0) bumped = true;
  return bumped;
}

// Line of sight between two points, sampled finely enough that a
// one-tile wall can never be jumped over.
function losClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidPx(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// ------------------------------------------------------------ game state
const state = {
  screen: "start",        // start | play | caught | win
  alarm: 0,               // 0..100
  take: 0, pieces: 0,
  time: 0, spotted: 0, seenNow: false,
  difficulty: 1,          // grows a little after every clean getaway
  doorOpen: false, won: false,
};

const player = { x: 0, y: 0, r: 13, face: -Math.PI / 2, sneaking: false, moving: false };
let guards = [], cameras = [], loot = [];

function resetNight(keepDifficulty) {
  if (!keepDifficulty) state.difficulty = 1;
  const s = tileCenter(startTile.x, startTile.y);
  player.x = s.x; player.y = s.y; player.face = -Math.PI / 2;
  state.alarm = 0; state.take = 0; state.pieces = 0;
  state.time = 0; state.spotted = 0; state.seenNow = false;
  state.doorOpen = false; state.won = false;
  guards = GUARDS.map((g) => {
    const wps = g.waypoints.map(([tx, ty]) => tileCenter(tx, ty));
    return {
      x: wps[0].x, y: wps[0].y, r: 14, wps, wp: 1, wait: 0,
      angle: Math.atan2(wps[1].y - wps[0].y, wps[1].x - wps[0].x),
      speed: g.speed * state.difficulty, pause: g.pause,
      fov: g.fov, range: g.range, sees: false,
    };
  });
  cameras = CAMERAS.map((c) => {
    const p = tileCenter(c.tx, c.ty);
    return { x: p.x, y: p.y, base: c.base, sweep: c.sweep, speed: c.speed,
             range: c.range, fov: c.fov, angle: c.base, t: Math.random() * 6.28, sees: false };
  });
  loot = LOOT.map((l) => {
    const p = tileCenter(l.tx, l.ty);
    return { x: p.x, y: p.y, name: l.name, value: l.value, kind: l.kind, taken: false };
  });
  syncHud();
}

// ------------------------------------------------------------ detection
// Is the thief inside this eye's cone, in range, and unhidden?
function eyeSees(eye) {
  const dx = player.x - eye.x, dy = player.y - eye.y;
  const dist = Math.hypot(dx, dy);
  if (dist > eye.range) return 0;
  let da = Math.atan2(dy, dx) - eye.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  if (Math.abs(da) > eye.fov / 2) return 0;
  if (!losClear(eye.x, eye.y, player.x, player.y)) return 0;
  return 1 - dist / eye.range;   // 0 at the rim, near 1 at the eye
}

// -------------------------------------------------------------- updates
const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "r" && state.screen !== "start") startNight(true);
  if (e.key.toLowerCase() === "m") toggleSound();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

function updatePlayer(dt) {
  let ix = 0, iy = 0;
  if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
  if (keys.has("d") || keys.has("arrowright")) ix += 1;
  if (keys.has("w") || keys.has("arrowup")) iy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) iy += 1;
  player.sneaking = keys.has("shift");
  player.moving = ix !== 0 || iy !== 0;
  if (!player.moving) return;
  const len = Math.hypot(ix, iy);
  const speed = player.sneaking ? 78 : 148;
  const dx = (ix / len) * speed * dt, dy = (iy / len) * speed * dt;
  player.face = Math.atan2(dy, dx);
  if (moveCircle(player, dx, dy)) HeistAudio.bump();
}

function updateGuard(g, dt) {
  if (g.wait > 0) {
    g.wait -= dt;
    // While paused at a waypoint, the lantern sways a little.
    g.angle += Math.sin(state.time * 1.7 + g.x) * 0.12 * dt;
    return;
  }
  const target = g.wps[g.wp];
  const dx = target.x - g.x, dy = target.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    g.wp = (g.wp + 1) % g.wps.length;
    g.wait = g.pause;
    return;
  }
  const step = Math.min(dist, g.speed * dt);
  g.x += (dx / dist) * step;
  g.y += (dy / dist) * step;
  // Turn smoothly toward the walk direction.
  const want = Math.atan2(dy, dx);
  let da = want - g.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  g.angle += da * Math.min(1, dt * 7);
}

function updateCamera(c, dt) {
  c.t += dt * c.speed;
  c.angle = c.base + Math.sin(c.t) * c.sweep;
}

function updateDetection(dt) {
  let worst = 0, seen = false;
  for (const g of guards) {
    g.sees = eyeSees(g) > 0;
    if (g.sees) { seen = true; worst = Math.max(worst, 0.55 + eyeSees(g) * 0.75); }
  }
  for (const c of cameras) {
    c.sees = eyeSees(c) > 0;
    if (c.sees) { seen = true; worst = Math.max(worst, 0.4 + eyeSees(c) * 0.6); }
  }
  const sneakFactor = player.sneaking ? 0.45 : 1;
  if (seen) {
    if (!state.seenNow) { state.spotted++; HeistAudio.spotted(); }
    state.alarm += worst * 34 * sneakFactor * state.difficulty * dt;
  } else {
    state.alarm -= 7.5 * dt;
  }
  state.seenNow = seen;
  state.alarm = Math.max(0, Math.min(100, state.alarm));
  if (state.alarm >= 100) return endNight(false);
}

function updateLoot() {
  for (const l of loot) {
    if (l.taken) continue;
    if (Math.hypot(player.x - l.x, player.y - l.y) < player.r + 15) {
      l.taken = true;
      state.take += l.value;
      state.pieces++;
      HeistAudio.loot();
      if (state.take >= TARGET_TAKE && !state.doorOpen) {
        state.doorOpen = true;
        HeistAudio.door();
      }
      syncHud();
    }
  }
}

function updateExit() {
  if (!state.doorOpen || state.won) return;
  for (const t of exitTiles) {
    const c = tileCenter(t.x, t.y);
    if (Math.hypot(player.x - c.x, player.y - c.y) < TILE * 0.55) return endNight(true);
  }
}

// ------------------------------------------------------- scoring & flow
function scoreBreakdown() {
  const timeBonus = Math.max(0, 20000 - Math.floor(state.time) * 60);
  const ghostBonus = state.spotted === 0 ? 15000 : 0;
  const seenPenalty = state.spotted * 750;
  const total = Math.max(0, state.take + timeBonus + ghostBonus - seenPenalty);
  return { timeBonus, ghostBonus, seenPenalty, total };
}

function scoreHtml(escaped) {
  const s = scoreBreakdown();
  const fmt = (n) => "$" + n.toLocaleString("en-US");
  let html = "";
  html += "<div>Treasure fenced: <strong>" + fmt(state.take) + "</strong> (" + state.pieces + " pieces)</div>";
  html += "<div>Time bonus: <strong>" + fmt(s.timeBonus) + "</strong></div>";
  if (s.ghostBonus) html += "<div>Ghost bonus (never spotted): <strong>" + fmt(s.ghostBonus) + "</strong></div>";
  if (s.seenPenalty) html += "<div>Spotted " + state.spotted + "x: <strong>-" + fmt(s.seenPenalty) + "</strong></div>";
  html += "<div class=\"score-total\">Final score: " + fmt(s.total) + "</div>";
  if (!escaped) html += "<div class=\"score-note\">The take went back on its plinths. It still counts in our hearts.</div>";
  return html;
}

function showScreen(name) {
  for (const id of ["screen-start", "screen-caught", "screen-win"]) {
    el(id).classList.toggle("hidden", id !== "screen-" + name);
  }
}

function startNight(keepDifficulty) {
  resetNight(keepDifficulty);
  state.screen = "play";
  showScreen("none");
  HeistAudio.unlock();
  HeistAudio.click();
}

function endNight(escaped) {
  if (state.screen !== "play") return;
  if (escaped) {
    state.won = true;
    state.screen = "win";
    state.difficulty = Math.round((state.difficulty + 0.12) * 100) / 100;
    el("win-score").innerHTML = scoreHtml(true);
    showScreen("win");
    HeistAudio.win();
  } else {
    state.screen = "caught";
    el("caught-score").innerHTML = scoreHtml(false);
    showScreen("caught");
    HeistAudio.alarm();
  }
}

// ------------------------------------------------------------------ HUD
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function syncHud() {
  hud.loot.textContent = "$" + state.take.toLocaleString("en-US");
  hud.lootCount.textContent = state.pieces + " / " + LOOT.length + " pieces";
  hud.goalState.textContent = state.doorOpen ? "door OPEN — go south" : "door locked";
  hud.seen.textContent = state.spotted === 0 ? "never spotted" : "spotted " + state.spotted + "x";
  hud.objective.textContent = state.doorOpen
    ? "The bag is heavy enough. Slip out the south door."
    : "Lift at least $" + TARGET_TAKE.toLocaleString("en-US") + " of treasure, then slip out the south door.";
}

function syncHudPerFrame() {
  hud.alarm.style.width = state.alarm.toFixed(1) + "%";
  hud.alarmState.textContent =
    state.alarm <= 1 ? "quiet" :
    state.alarm < 35 ? "something stirs" :
    state.alarm < 70 ? "voices raised" :
    state.alarm < 99.5 ? "THE ALARM IS RINGING" : "CAUGHT";
  hud.time.textContent = fmtTime(state.time);
  if (state.seenNow) hud.seen.textContent = "SPOTTED — break line of sight!";
  else if (state.spotted > 0) hud.seen.textContent = "spotted " + state.spotted + "x";
}

// -------------------------------------------------------------- buttons
function toggleSound() {
  const on = !HeistAudio.isEnabled();
  HeistAudio.setEnabled(on);
  el("btn-sound").textContent = "Sound: " + (on ? "on" : "off");
}
el("btn-sound").addEventListener("click", toggleSound);
el("btn-restart").addEventListener("click", () => startNight(true));
el("btn-start").addEventListener("click", () => startNight(false));
el("btn-retry").addEventListener("click", () => startNight(true));
el("btn-again").addEventListener("click", () => startNight(true));

// ------------------------------------------------------------ main loop
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  if (state.screen === "play") {
    state.time += dt;
    updatePlayer(dt);
    for (const g of guards) updateGuard(g, dt);
    for (const c of cameras) updateCamera(c, dt);
    updateDetection(dt);
    updateLoot();
    updateExit();
    syncHudPerFrame();
  }
  draw();
  requestAnimationFrame(frame);
}

// -------------------------------------------------------------- drawing
// A vision cone clipped by walls: march rays across the fan and stop
// each at the first solid tile.
function drawCone(x, y, angle, fov, range, active) {
  const rays = 26;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= rays; i++) {
    const a = angle - fov / 2 + (fov * i) / rays;
    let d = range;
    const step = 7;
    for (let t = step; t <= range; t += step) {
      if (isSolidPx(x + Math.cos(a) * t, y + Math.sin(a) * t)) { d = t - step / 2; break; }
    }
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(x, y, 8, x, y, range);
  if (active) {
    grad.addColorStop(0, "rgba(255,70,60,0.50)");
    grad.addColorStop(1, "rgba(255,70,60,0.05)");
  } else {
    grad.addColorStop(0, "rgba(255,196,86,0.34)");
    grad.addColorStop(1, "rgba(255,196,86,0.03)");
  }
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawFloor() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP_ROWS[y][x];
      const px = x * TILE, py = y * TILE;
      if (ch === "#") {
        ctx.fillStyle = "#232a52";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#2c3563";
        ctx.fillRect(px, py, TILE, 5);
        continue;
      }
      // Checkerboard marble, two quiet blues alternating.
      ctx.fillStyle = (x + y) % 2 === 0 ? "#171d3d" : "#141a35";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = "rgba(90,104,178,0.16)";
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      if (ch === "V") {
        ctx.fillStyle = "#1d1440";
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = "#8a6df0";
        ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
      }
      if (ch === "X") {
        ctx.fillStyle = state.doorOpen ? "#1d4d33" : "#3d1f26";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = state.doorOpen ? "#57c98a" : "#e5484d";
        ctx.fillRect(px + 6, py + TILE - 9, TILE - 12, 4);
      }
    }
  }
  ctx.fillStyle = "rgba(154,163,199,0.5)";
  ctx.font = "italic 13px Georgia, serif";
  ctx.textAlign = "center";
  for (const label of ROOM_LABELS) {
    ctx.fillText(label.text, label.x * TILE, label.y * TILE);
  }
}

function drawFurniture() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP_ROWS[y][x];
      const px = x * TILE, py = y * TILE;
      if (ch === "F") {
        // A cabinet: walnut body, brass trim.
        ctx.fillStyle = "#4a3220";
        ctx.fillRect(px + 5, py + 7, TILE - 10, TILE - 14);
        ctx.strokeStyle = "#c9973f";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 8.5, py + 10.5, TILE - 17, TILE - 21);
        ctx.lineWidth = 1;
      } else if (ch === "C") {
        // A display case: dark plinth, glass top, a glint inside.
        ctx.fillStyle = "#10142b";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = "rgba(150,200,255,0.20)";
        ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
        ctx.strokeStyle = "#7f8fc9";
        ctx.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(px + 13, py + TILE - 13);
        ctx.lineTo(px + 21, py + 11);
        ctx.lineTo(px + 26, py + 11);
        ctx.lineTo(px + 18, py + TILE - 13);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawLootItem(l) {
  const pulse = 0.75 + 0.25 * Math.sin(state.time * 3 + l.x * 0.05 + l.y * 0.03);
  ctx.save();
  ctx.translate(l.x, l.y);
  // A soft gilt halo so treasure reads at a glance.
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 21);
  halo.addColorStop(0, "rgba(255,214,110," + (0.5 * pulse).toFixed(3) + ")");
  halo.addColorStop(1, "rgba(255,214,110,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2;
  if (l.kind === "gem") {
    ctx.fillStyle = "#39c2d7";
    ctx.strokeStyle = "#bff3ff";
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(8, -3); ctx.lineTo(0, 12); ctx.lineTo(-8, -3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (l.kind === "painting") {
    ctx.fillStyle = "#6d4c2f";
    ctx.fillRect(-12, -10, 24, 20);
    ctx.fillStyle = "#274b73";
    ctx.fillRect(-9, -7, 18, 14);
    ctx.fillStyle = "#f5d78a";
    ctx.beginPath(); ctx.arc(3, -2, 3.4, 0, Math.PI * 2); ctx.fill();
  } else if (l.kind === "crown") {
    ctx.fillStyle = "#e8b64c";
    ctx.strokeStyle = "#fff0bd";
    ctx.beginPath();
    ctx.moveTo(-12, 8); ctx.lineTo(-12, -6); ctx.lineTo(-6, 1); ctx.lineTo(0, -10);
    ctx.lineTo(6, 1); ctx.lineTo(12, -6); ctx.lineTo(12, 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e5484d";
    ctx.beginPath(); ctx.arc(0, 3, 2.6, 0, Math.PI * 2); ctx.fill();
  } else if (l.kind === "chalice") {
    ctx.fillStyle = "#d9d4e8";
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-8, -9); ctx.lineTo(8, -9); ctx.lineTo(5, 1); ctx.lineTo(-5, 1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(-1.5, 1, 3, 6);
    ctx.fillRect(-6, 8, 12, 2.6);
  } else { // mask
    ctx.fillStyle = "#c96f2e";
    ctx.strokeStyle = "#ffd9a8";
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#141a35";
    ctx.beginPath();
    ctx.ellipse(-3.4, -2, 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.ellipse(3.4, -2, 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGuard(g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  // Lantern glow under the guard.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  glow.addColorStop(0, "rgba(255,196,86,0.25)");
  glow.addColorStop(1, "rgba(255,196,86,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  // Body: navy uniform, brass buttons, peaked cap.
  ctx.fillStyle = g.sees ? "#7a2436" : "#2e3d75";
  ctx.beginPath(); ctx.arc(0, 0, g.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#0d1126";
  ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = "#e8b64c";
  ctx.beginPath(); ctx.arc(0, 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.rotate(g.angle);
  ctx.fillStyle = "#1b2450";
  ctx.fillRect(2, -7, 11, 14);
  ctx.fillStyle = "#ffd76e";
  ctx.beginPath(); ctx.arc(15, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (g.sees) {
    ctx.fillStyle = "#ff5147";
    ctx.font = "bold 22px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 0, -g.r - 8);
  }
  ctx.restore();
}

function drawCamera(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  // Housing bolted to the wall, head turned along its sweep.
  ctx.fillStyle = "#39406e";
  ctx.fillRect(-11, -11, 22, 22);
  ctx.strokeStyle = "#7f8fc9";
  ctx.strokeRect(-11.5, -11.5, 23, 23);
  ctx.save();
  ctx.rotate(c.angle);
  ctx.fillStyle = "#1b2044";
  ctx.fillRect(0, -5, 13, 10);
  ctx.fillStyle = c.sees ? "#ff2222" : "#ff7b72";
  ctx.beginPath(); ctx.arc(13, 0, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  // The bag grows with the take.
  const bagR = 6 + Math.min(6, state.pieces * 0.7);
  ctx.fillStyle = "#8a6a25";
  ctx.beginPath(); ctx.arc(-player.r - 2, 4, bagR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5d4717"; ctx.stroke();
  // Body: dark teal coat; a pale mask when sneaking.
  ctx.fillStyle = player.sneaking ? "#123c3a" : "#175e57";
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#06201e";
  ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  ctx.save();
  ctx.rotate(player.face);
  ctx.fillStyle = "#f0e7d3";
  ctx.beginPath(); ctx.arc(6, 0, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#141a35";
  ctx.fillRect(3, -5.4, 7, 3);   // domino mask band
  ctx.restore();
  if (state.seenNow) {
    ctx.strokeStyle = "#ff5147";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, player.r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  drawFloor();
  drawFurniture();
  for (const l of loot) if (!l.taken) drawLootItem(l);
  // Cones above the floor, below the people.
  for (const g of guards) drawCone(g.x, g.y, g.angle, g.fov, g.range, g.sees);
  for (const c of cameras) drawCone(c.x, c.y, c.angle, c.fov, c.range, c.sees);
  for (const g of guards) drawGuard(g);
  for (const c of cameras) drawCamera(c);
  drawPlayer();
  // A soft vignette, and a red pulse while the alarm is hot.
  const v = ctx.createRadialGradient(
    WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.42,
    WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.86);
  v.addColorStop(0, "rgba(3,4,10,0)");
  v.addColorStop(1, "rgba(3,4,10,0.42)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  if (state.alarm > 55 && state.screen === "play") {
    ctx.strokeStyle = "rgba(229,72,77," + (0.35 + 0.3 * Math.sin(state.time * 9)).toFixed(3) + ")";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, WORLD_W - 10, WORLD_H - 10);
    ctx.lineWidth = 1;
  }
}

// ----------------------------------------------------------------- init
resetNight(false);
showScreen("start");
requestAnimationFrame(frame);
