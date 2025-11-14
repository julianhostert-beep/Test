// ===== Einstellungen =====
const FOV = Math.PI / 3;       // 60°
const MAX_DIST = 20;
const TILE = 1;

// ===== Canvas =====
const canvas = document.getElementById("shooterCanvas");
const ctx = canvas.getContext("2d");

let width = 800;
let height = 450;

function resizeCanvas() {
  const wrapper = document.querySelector(".canvas-wrapper");
  const availableWidth = wrapper.clientWidth - 20;
  const maxWidth = 900;
  width = Math.min(availableWidth, maxWidth);
  height = width / (16 / 9);

  canvas.width = width;
  canvas.height = height;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ===== HUD =====
const killsEl = document.getElementById("kills");
const healthEl = document.getElementById("health");
let kills = 0;
let health = 100;
killsEl.textContent = kills;
healthEl.textContent = health;

// ===== Karte (24x24, ~5x Fläche) =====
// 1 = Wand, 0 = frei
const map = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,1,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function isWall(x, y) {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  if (my < 0 || my >= map.length || mx < 0 || mx >= map[0].length) return true;
  return map[my][mx] === 1;
}

function dist(a, b, c, d) {
  const dx = c - a;
  const dy = d - b;
  return Math.sqrt(dx*dx + dy*dy);
}

// ===== Spieler =====
let player = {
  x: 3.5,
  y: 3.5,
  angle: 0,
  speed: 3,
};

let keys = {};
let lastTime = 0;

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// ===== Gegner =====
let enemies = [];
const enemySpawnPoints = [
  { x: 8.5, y: 4.5 },
  { x: 15.5, y: 5.5 },
  { x: 18.5, y: 14.5 },
  { x: 5.5, y: 15.5 },
  { x: 10.5, y: 18.5 },
];

function initEnemies() {
  enemies = enemySpawnPoints.map(sp => ({
    x: sp.x,
    y: sp.y,
    alive: true,
  }));
}

initEnemies();

// ===== Steuerung / Player-Update =====
function updatePlayer(dt) {
  const moveSpeed = player.speed * dt;
  const rotSpeed = 2.5 * dt;

  // drehen: A/D & Pfeiltasten
  if (keys["ArrowLeft"] || keys["KeyA"]) player.angle -= rotSpeed;
  if (keys["ArrowRight"] || keys["KeyD"]) player.angle += rotSpeed;

  let dx = 0;
  let dy = 0;

  // vor / zurück (W/S)
  if (keys["KeyW"]) {
    dx += Math.cos(player.angle) * moveSpeed;
    dy += Math.sin(player.angle) * moveSpeed;
  }
  if (keys["KeyS"]) {
    dx -= Math.cos(player.angle) * moveSpeed;
    dy -= Math.sin(player.angle) * moveSpeed;
  }

  // strafen: Q/E
  if (keys["KeyQ"]) {
    dx += Math.cos(player.angle - Math.PI/2) * moveSpeed;
    dy += Math.sin(player.angle - Math.PI/2) * moveSpeed;
  }
  if (keys["KeyE"]) {
    dx += Math.cos(player.angle + Math.PI/2) * moveSpeed;
    dy += Math.sin(player.angle + Math.PI/2) * moveSpeed;
  }

  const newX = player.x + dx;
  const newY = player.y + dy;

  if (!isWall(newX, player.y)) player.x = newX;
  if (!isWall(player.x, newY)) player.y = newY;
}

// ===== Gegner-Logik =====
function updateEnemies(dt) {
  const speed = 1.2;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(player.x, player.y, e.x, e.y);

    // Spieler Schaden, wenn sehr nah
    if (d < 0.4) {
      health -= 15 * dt;
      if (health <= 0) {
        health = 0;
        healthEl.textContent = Math.round(health);
        alert("Du wurdest besiegt! Kills: " + kills);
        resetGame();
        return;
      }
      continue;
    }

    if (d < 9) {
      const dirX = (player.x - e.x) / d;
      const dirY = (player.y - e.y) / d;
      const stepX = e.x + dirX * speed * dt;
      const stepY = e.y + dirY * speed * dt;

      if (!isWall(stepX, e.y)) e.x = stepX;
      if (!isWall(e.x, stepY)) e.y = stepY;
    }
  }
}

// ===== Schießen =====
canvas.addEventListener("click", shoot);

function shoot() {
  // Strahl in Blickrichtung
  const rayAngle = player.angle;
  const step = 0.05;
  let hitEnemy = null;
  let minT = Infinity;

  for (let t = 0; t < MAX_DIST; t += step) {
    const rx = player.x + Math.cos(rayAngle) * t;
    const ry = player.y + Math.sin(rayAngle) * t;

    // Wand blockiert Schuss
    if (isWall(rx, ry)) break;

    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(rx, ry, e.x, e.y);
      if (d < 0.4 && t < minT) {
        minT = t;
        hitEnemy = e;
      }
    }
  }

  if (hitEnemy) {
    hitEnemy.alive = false;
    kills++;
    killsEl.textContent = kills;
  }

  // kleiner Mündungsblitz
  const gunX = width / 2;
  const gunY = height - 40;
  ctx.fillStyle = "rgba(248,250,252,0.9)";
  ctx.beginPath();
  ctx.arc(gunX, gunY, 10, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Raycasting =====
function castRay(angle) {
  let rayX = player.x;
  let rayY = player.y;

  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  for (let t = 0; t < MAX_DIST; t += 0.02) {
    rayX = player.x + cos * t;
    rayY = player.y + sin * t;
    if (isWall(rayX, rayY)) {
      return { dist: t, hitX: rayX, hitY: rayY };
    }
  }
  return { dist: MAX_DIST, hitX: rayX, hitY: rayY };
}

// ===== Rendering =====
function render3D() {
  const halfH = height / 2;

  // Hintergrund
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);

  // Himmel
  const skyGrad = ctx.createLinearGradient(0, 0, 0, halfH);
  skyGrad.addColorStop(0, "#1d4ed8");
  skyGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, halfH);

  // Boden
  const groundGrad = ctx.createLinearGradient(0, halfH, 0, height);
  groundGrad.addColorStop(0, "#111827");
  groundGrad.addColorStop(1, "#020617");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, halfH, width, halfH);

  // Wände
  for (let x = 0; x < width; x++) {
    const cameraX = 2 * x / width - 1; // -1..1
    const rayAngle = player.angle + cameraX * (FOV / 2);
    const ray = castRay(rayAngle);
    let distWall = ray.dist;

    // Fish-Eye-Korrektur
    distWall *= Math.cos(rayAngle - player.angle);
    if (distWall < 0.0001) distWall = 0.0001;

    const wallHeight = (TILE / distWall) * (width / (2 * Math.tan(FOV / 2)));
    const clampedHeight = Math.min(height, wallHeight);
    const startY = halfH - clampedHeight / 2;

    const shade = Math.max(0.2, 1 - distWall / MAX_DIST);
    const r = Math.floor(30 + 80 * shade);
    const g = Math.floor(70 + 100 * shade);
    const b = Math.floor(120 + 120 * shade);

    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, startY);
    ctx.lineTo(x + 0.5, startY + clampedHeight);
    ctx.stroke();
  }

  // Gegner als "Billboards" zeichnen (von hinten nach vorne)
  const enemyScreen = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < 0.2 || d > MAX_DIST) continue;

    const angleToEnemy = Math.atan2(dy, dx) - player.angle;
    const fovHalf = FOV / 2;
    if (angleToEnemy < -fovHalf || angleToEnemy > fovHalf) continue;

    const size = Math.min(height, (TILE / d) * (width / (2 * Math.tan(FOV/2))) * 1.2);
    const xCenter = width / 2 + (angleToEnemy / FOV) * width;
    const yBottom = height * 0.7;

    enemyScreen.push({ dist: d, xCenter, size, yBottom });
  }

  enemyScreen.sort((a, b) => b.dist - a.dist);

  for (const s of enemyScreen) {
    const x = s.xCenter - s.size / 2;
    const y = s.yBottom - s.size;

    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(x, y, s.size, s.size);

    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(x, y + s.size * 0.65, s.size, s.size * 0.35);
  }

  // Pistole
  const gunWidth = width * 0.22;
  const gunHeight = height * 0.35;
  const gunX = width / 2 - gunWidth / 2;
  const gunY = height - gunHeight + 10;

  ctx.fillStyle = "#111827";
  ctx.fillRect(gunX, gunY, gunWidth, gunHeight);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(
    gunX + gunWidth * 0.1,
    gunY + gunHeight * 0.15,
    gunWidth * 0.8,
    gunHeight * 0.5
  );

  // Fadenkreuz
  ctx.strokeStyle = "rgba(229,231,235,0.8)";
  ctx.lineWidth = 1;
  const cx = width / 2;
  const cy = height / 2;
  const s = 8;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx + s, cy);
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s);
  ctx.stroke();
}

// große Minimap (~5x Fläche)
function renderMinimap() {
  const size = Math.min(width, height) * 0.5;   // vorher 0.35 → viel größer
  const tileSize = size / map.length;

  ctx.save();
  ctx.translate(10, 10);
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      ctx.fillStyle = map[y][x] === 1 ? "#4b5563" : "#020617";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  // Gegner
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(e.x * tileSize, e.y * tileSize, tileSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spieler
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(player.x * tileSize, player.y * tileSize, tileSize * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Blickrichtung
  ctx.strokeStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(player.x * tileSize, player.y * tileSize);
  ctx.lineTo(
    player.x * tileSize + Math.cos(player.angle) * tileSize,
    player.y * tileSize + Math.sin(player.angle) * tileSize
  );
  ctx.stroke();

  ctx.restore();
}

// ===== Game Loop =====
function resetGame() {
  player.x = 3.5;
  player.y = 3.5;
  player.angle = 0;
  kills = 0;
  health = 100;
  killsEl.textContent = kills;
  healthEl.textContent = Math.round(health);
  initEnemies();
}

function update(dt) {
  updatePlayer(dt);
  updateEnemies(dt);
  healthEl.textContent = Math.round(health);
}

function draw() {
  render3D();
  renderMinimap();
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

resetGame();
requestAnimationFrame(loop);
