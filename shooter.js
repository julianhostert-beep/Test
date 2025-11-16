// ===== Grundeinstellungen =====
const FOV = Math.PI / 3;       // 60°
const MAX_DIST = 20;
const TILE = 1;
const CHUNK_SIZE = 16;         // 16x16 Tiles pro Chunk

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

// ===== Spieler =====
let player = {
  x: 2.5,
  y: 2.5,
  angle: 0,
  speed: 3,
};

let keys = {};
let lastTime = 0;

window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup",   (e) => { keys[e.code] = false; });

// ===== Chunk-System =====
let chunks = {}; // chunks["cx;cy"] = 2D-Array CHUNK_SIZE x CHUNK_SIZE (0 = frei, 1 = Wand)

function chunkKey(cx, cy) {
  return cx + ";" + cy;
}

function randomForChunk(cx, cy, x, y) {
  const seed = cx * 73856093 ^ cy * 19349663 ^ x * 83492791 ^ y * 2654435761;
  const s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}

function generateChunk(cx, cy) {
  const tiles = [];
  for (let y = 0; y < CHUNK_SIZE; y++) {
    tiles[y] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      if (x === 0 || y === 0 || x === CHUNK_SIZE - 1 || y === CHUNK_SIZE - 1) {
        tiles[y][x] = 1; // Rand = Wand
      } else {
        const r = randomForChunk(cx, cy, x, y);
        tiles[y][x] = r < 0.12 ? 1 : 0; // ~12% Wände
      }
    }
  }
  chunks[chunkKey(cx, cy)] = tiles;
  return tiles;
}

function getChunkTiles(cx, cy) {
  const key = chunkKey(cx, cy);
  if (!chunks[key]) return generateChunk(cx, cy);
  return chunks[key];
}

function isWall(x, y) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);

  const cx = Math.floor(tileX / CHUNK_SIZE);
  const cy = Math.floor(tileY / CHUNK_SIZE);

  const localX = tileX - cx * CHUNK_SIZE;
  const localY = tileY - cy * CHUNK_SIZE;

  const tiles = getChunkTiles(cx, cy);

  if (
    localX < 0 || localY < 0 ||
    localX >= CHUNK_SIZE || localY >= CHUNK_SIZE
  ) {
    return true;
  }
  return tiles[localY][localX] === 1;
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// ===== Gegner =====
let enemies = [];
const TARGET_ENEMIES = 8;     // gewünschte Gegner gleichzeitig

// Spawn-Position für Gegner suchen
function findSpawnPosition(radiusMin = 5, radiusMax = 12, maxTries = 80) {
  for (let i = 0; i < maxTries; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);
    const ex = player.x + Math.cos(angle) * r;
    const ey = player.y + Math.sin(angle) * r;
    if (!isWall(ex, ey)) {
      return { x: ex, y: ey };
    }
  }
  // Fallback, falls nichts Gutes gefunden
  return {
    x: player.x + (Math.random() * 2 - 1) * radiusMax,
    y: player.y + (Math.random() * 2 - 1) * radiusMax,
  };
}

function createEnemyAtRandom() {
  const pos = findSpawnPosition();
  return {
    x: pos.x,
    y: pos.y,
    alive: true,
    respawnsLeft: 2, // jeder Gegner kann 2x neu erscheinen
  };
}

function spawnEnemyNearPlayer() {
  const e = createEnemyAtRandom();
  enemies.push(e);
  return e;
}

function initEnemies() {
  enemies = [];
  for (let i = 0; i < TARGET_ENEMIES; i++) {
    spawnEnemyNearPlayer();
  }
}

function updateEnemies(dt) {
  const speed = 1.2;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(player.x, player.y, e.x, e.y);

    // Schaden, wenn sehr nah
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

    // Verfolgen, wenn in Reichweite
    if (d < 9) {
      const dirX = (player.x - e.x) / d;
      const dirY = (player.y - e.y) / d;
      const stepX = e.x + dirX * speed * dt;
      const stepY = e.y + dirY * speed * dt;

      if (!isWall(stepX, e.y)) e.x = stepX;
      if (!isWall(e.x, stepY)) e.y = stepY;
    }
  }

  // wenn zu wenige leben, neue hinzufügen
  const aliveCount = enemies.filter(e => e.alive).length;
  if (aliveCount < TARGET_ENEMIES) {
    spawnEnemyNearPlayer();
  }
}

// ===== Steuerung =====
function updatePlayer(dt) {
  const moveSpeed = player.speed * dt;
  const rotSpeed = 2.5 * dt;

  if (keys["ArrowLeft"] || keys["KeyA"]) player.angle -= rotSpeed;
  if (keys["ArrowRight"] || keys["KeyD"]) player.angle += rotSpeed;

  let dx = 0;
  let dy = 0;

  if (keys["KeyW"]) {
    dx += Math.cos(player.angle) * moveSpeed;
    dy += Math.sin(player.angle) * moveSpeed;
  }
  if (keys["KeyS"]) {
    dx -= Math.cos(player.angle) * moveSpeed;
    dy -= Math.sin(player.angle) * moveSpeed;
  }

  if (keys["KeyQ"]) {
    dx += Math.cos(player.angle - Math.PI / 2) * moveSpeed;
    dy += Math.sin(player.angle - Math.PI / 2) * moveSpeed;
  }
  if (keys["KeyE"]) {
    dx += Math.cos(player.angle + Math.PI / 2) * moveSpeed;
    dy += Math.sin(player.angle + Math.PI / 2) * moveSpeed;
  }

  const newX = player.x + dx;
  const newY = player.y + dy;

  if (!isWall(newX, player.y)) player.x = newX;
  if (!isWall(player.x, newY)) player.y = newY;
}

// ===== Schießen (mit Respawns) =====
canvas.addEventListener("click", shoot);

function shoot() {
  const rayAngle = player.angle;
  const step = 0.05;
  let hitEnemy = null;
  let minT = Infinity;

  for (let t = 0; t < MAX_DIST; t += step) {
    const rx = player.x + Math.cos(rayAngle) * t;
    const ry = player.y + Math.sin(rayAngle) * t;

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

    // Respawn: jeder Gegner kann 2× wiederkommen
    if (hitEnemy.respawnsLeft > 0) {
      hitEnemy.respawnsLeft--;
      const pos = findSpawnPosition();
      hitEnemy.x = pos.x;
      hitEnemy.y = pos.y;
      hitEnemy.alive = true;
    }
  }

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

// ===== Gegner-Figur =====
function drawEnemyFigure(xCenter, yBottom, size) {
  const headH = size * 0.25;
  const bodyH = size * 0.35;
  const legH  = size * 0.40;

  const headW = size * 0.28;
  const bodyW = size * 0.45;
  const legW  = size * 0.18;

  const headX = xCenter - headW / 2;
  const headY = yBottom - size;

  const bodyX = xCenter - bodyW / 2;
  const bodyY = headY + headH;

  const leftLegX  = xCenter - legW - legW * 0.2;
  const rightLegX = xCenter + legW * 0.2;
  const legsY     = bodyY + bodyH;

  // Beine
  ctx.fillStyle = "#14532d";
  ctx.fillRect(leftLegX,  legsY, legW, legH);
  ctx.fillRect(rightLegX, legsY, legW, legH);

  // Körper
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Kopf
  ctx.fillStyle = "#facc15";
  ctx.fillRect(headX, headY, headW, headH);

  // Augen
  const eyeSize = headH * 0.18;
  const eyeY = headY + headH * 0.4;
  const eyeOffsetX = headW * 0.1;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(headX + headW - eyeOffsetX - eyeSize,     eyeY, eyeSize, eyeSize);
  ctx.fillRect(headX + headW - eyeOffsetX - 3 * eyeSize, eyeY, eyeSize, eyeSize);
}

// ===== Rendering =====
function render3D() {
  const halfH = height / 2;

  // Tiefenpuffer
  const depthBuffer = new Array(width);

  // Hintergrund
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);

  // Himmel
  const skyGrad = ctx.createLinearGradient(0, 0, 0, halfH);
  skyGrad.addColorStop(0, "#0f766e");
  skyGrad.addColorStop(1, "#022c22");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, halfH);

  // Boden
  const groundGrad = ctx.createLinearGradient(0, halfH, 0, height);
  groundGrad.addColorStop(0, "#064e3b");
  groundGrad.addColorStop(1, "#022c22");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, halfH, width, halfH);

  // Wände (grün)
  for (let x = 0; x < width; x++) {
    const cameraX = 2 * x / width - 1;
    const rayAngle = player.angle + cameraX * (FOV / 2);
    const ray = castRay(rayAngle);
    let distWall = ray.dist;

    distWall *= Math.cos(rayAngle - player.angle);
    if (distWall < 0.0001) distWall = 0.0001;

    depthBuffer[x] = distWall;

    const wallHeight = (TILE / distWall) * (width / (2 * Math.tan(FOV / 2)));
    const clampedHeight = Math.min(height, wallHeight);
    const startY = halfH - clampedHeight / 2;

    const shade = Math.max(0.2, 1 - distWall / MAX_DIST);
    // grüne Wände
    const r = Math.floor(20 + 20 * shade);
    const g = Math.floor(120 + 100 * shade);
    const b = Math.floor(40 + 60 * shade);

    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, startY);
    ctx.lineTo(x + 0.5, startY + clampedHeight);
    ctx.stroke();
  }

  // Gegner (Figuren, mit Occlusion & am Boden)
  const enemyScreen = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.2 || d > MAX_DIST) continue;

    const angleToEnemy = Math.atan2(dy, dx) - player.angle;
    const fovHalf = FOV / 2;
    if (angleToEnemy < -fovHalf || angleToEnemy > fovHalf) continue;

    const size = Math.min(height, (TILE / d) * (width / (2 * Math.tan(FOV / 2))) * 1.2);
    const xCenter = width / 2 + (angleToEnemy / FOV) * width;
    const yBottom = height * 0.9; // Boden-nah

    enemyScreen.push({ dist: d, xCenter, size, yBottom });
  }

  enemyScreen.sort((a, b) => b.dist - a.dist);

  for (const s of enemyScreen) {
    // Bereich des Sprites in Spalten
    let left = Math.floor(s.xCenter - s.size / 2);
    let right = Math.floor(s.xCenter + s.size / 2);

    if (right < 0 || left >= width) continue;
    left = Math.max(0, left);
    right = Math.min(width - 1, right);

    let visible = false;
    for (let i = left; i <= right; i++) {
      // kleine Toleranz, damit sie nicht „zu früh“ verschwinden
      if (s.dist < depthBuffer[i] + 0.2) {
        visible = true;
        break;
      }
    }
    if (!visible) continue;

    drawEnemyFigure(s.xCenter, s.yBottom, s.size);
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

// ===== Minimap =====
function renderMinimap() {
  const size = Math.min(width, height) * 0.5;
  const tileSize = size / CHUNK_SIZE;

  const tileX = Math.floor(player.x);
  const tileY = Math.floor(player.y);
  const cx = Math.floor(tileX / CHUNK_SIZE);
  const cy = Math.floor(tileY / CHUNK_SIZE);
  const tiles = getChunkTiles(cx, cy);

  ctx.save();
  ctx.translate(10, 10);
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      ctx.fillStyle = tiles[y][x] === 1 ? "#166534" : "#020617";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  // Gegner im gleichen Chunk
  for (const e of enemies) {
    if (!e.alive) continue;
    const exTile = Math.floor(e.x);
    const eyTile = Math.floor(e.y);
    const ecx = Math.floor(exTile / CHUNK_SIZE);
    const ecy = Math.floor(eyTile / CHUNK_SIZE);
    if (ecx !== cx || ecy !== cy) continue;

    const localX = exTile - cx * CHUNK_SIZE + 0.5;
    const localY = eyTile - cy * CHUNK_SIZE + 0.5;

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(localX * tileSize, localY * tileSize, tileSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  const localX = player.x - cx * CHUNK_SIZE;
  const localY = player.y - cy * CHUNK_SIZE;

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(localX * tileSize, localY * tileSize, tileSize * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(localX * tileSize, localY * tileSize);
  ctx.lineTo(
    localX * tileSize + Math.cos(player.angle) * tileSize,
    localY * tileSize + Math.sin(player.angle) * tileSize
  );
  ctx.stroke();

  ctx.restore();
}

// ===== Game Loop =====
function resetGame() {
  player.x = 2.5;
  player.y = 2.5;
  player.angle = 0;
  kills = 0;
  health = 100;
  killsEl.textContent = kills;
  healthEl.textContent = Math.round(health);
  chunks = {};
  enemies = [];
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
