// ===== Basis-Physik-Werte (müssen VOR dem ersten Aufruf gesetzt sein) =====
let baseGravity = 2600;
let baseJumpStrength = 950; // hier kannst du später fein-tunen
let gravity = baseGravity;
let jumpStrength = baseJumpStrength;

// ===== Canvas & Resize =====
const runnerCanvas = document.getElementById("runnerCanvas");
const rctx = runnerCanvas.getContext("2d");

let rWidth = 800;
let rHeight = 450;

// passt die Physik an die aktuelle Canvas-Höhe an
function updatePhysicsByHeight() {
  const scale = rHeight / 450; // Referenzhöhe 450px
  gravity = baseGravity * scale;
  jumpStrength = baseJumpStrength * scale;
}

function resizeRunnerCanvas() {
  const wrapper = document.querySelector(".canvas-wrapper");
  const availableWidth = wrapper.clientWidth - 20;
  const maxWidth = 800;
  rWidth = Math.min(availableWidth, maxWidth);
  rHeight = rWidth / (16 / 9);

  runnerCanvas.width = rWidth;
  runnerCanvas.height = rHeight;

  updatePhysicsByHeight();
}

window.addEventListener("resize", resizeRunnerCanvas);
resizeRunnerCanvas();

// ===== Audio =====
const sfxJump = document.getElementById("runnerJumpSfx");
const sfxLand = document.getElementById("runnerLandSfx");
const sfxCrash = document.getElementById("runnerCrashSfx");

function playSfx(audioEl) {
  if (!audioEl) return;
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {});
}

// ===== Welt & Spieler =====
let player, obstacles, groundY;
let gameSpeed = 320;
let maxGameSpeed = 700;
let obstacleTimer = 0;
let obstacleDelay = 1.4;

let distance = 0;
let highscoreRunner = Number(localStorage.getItem("runner_highscore") || 0);
document.getElementById("runnerHighscore").textContent = highscoreRunner;

// Leben
const maxLives = 3;
let lives = maxLives;
const livesEl = document.getElementById("lives");

// Zustände
let runnerRunning = false;
let isPaused = false;
let lastTime = 0;

// Lauf-Animation
let runAnimTime = 0;

// Staub-Partikel
let dustParticles = [];

// Tag/Nacht
let worldTime = 0; // 0..1

// ===== Hilfsfunktionen =====
function drawBlock(x, y, w, h, colorFront, colorTop) {
  rctx.fillStyle = colorFront;
  rctx.fillRect(x, y, w, h);

  const topHeight = h * 0.25;
  rctx.fillStyle = colorTop;
  rctx.beginPath();
  rctx.moveTo(x, y);
  rctx.lineTo(x + w, y);
  rctx.lineTo(x + w * 0.9, y - topHeight);
  rctx.lineTo(x + w * 0.1, y - topHeight);
  rctx.closePath();
  rctx.fill();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

function updateLivesDisplay() {
  livesEl.textContent = "♥".repeat(lives);
}

// ===== Setup =====
function resetRunner() {
  groundY = rHeight * 0.8;

  const baseWidth = rWidth * 0.06;
  const baseHeight = rHeight * 0.18;

  player = {
    x: rWidth * 0.18,
    y: groundY - baseHeight,
    width: baseWidth,
    height: baseHeight,
    vy: 0,
    grounded: true
  };

  obstacles = [];
  distance = 0;
  gameSpeed = 320;
  obstacleDelay = 1.4;
  obstacleTimer = 0;
  runAnimTime = 0;
  dustParticles = [];
  lives = maxLives;
  updateLivesDisplay();
  document.getElementById("distance").textContent = 0;
}

// Soft-Reset nach Treffer
function softResetAfterHit() {
  const baseWidth = rWidth * 0.06;
  const baseHeight = rHeight * 0.18;

  player.x = rWidth * 0.18;
  player.y = groundY - baseHeight;
  player.width = baseWidth;
  player.height = baseHeight;
  player.vy = 0;
  player.grounded = true;

  obstacles = [];
  obstacleTimer = 0;
}

// Hindernisse
function spawnObstacle() {
  const type = Math.random() < 0.55 ? "stone" : "tree";
  let width, height;

  if (type === "stone") {
    width = rWidth * lerp(0.04, 0.07, Math.random());
    height = rHeight * lerp(0.08, 0.14, Math.random());
  } else {
    width = rWidth * lerp(0.05, 0.08, Math.random());
    height = rHeight * lerp(0.2, 0.3, Math.random());
  }

  obstacles.push({
    x: rWidth + width,
    y: groundY - height,
    width,
    height,
    type,
    passed: false
  });
}

function startRunner() {
  resetRunner();
  runnerRunning = true;
  isPaused = false;
  lastTime = performance.now();
}

function togglePause() {
  if (!runnerRunning) return;
  isPaused = !isPaused;
}

// ===== Staub =====
function spawnDust() {
  const footY = groundY;
  const centerX = player.x + player.width * 0.5;
  const count = 10;

  for (let i = 0; i < count; i++) {
    const dir = Math.random() * Math.PI;
    const speed = 80 + Math.random() * 140;
    dustParticles.push({
      x: centerX,
      y: footY,
      vx: Math.cos(dir) * speed,
      vy: -Math.sin(dir) * speed * 0.6,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.3,
      size: 3 + Math.random() * 4
    });
  }
}

function updateDust(dt) {
  dustParticles.forEach(p => {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 900 * dt;
  });
  dustParticles = dustParticles.filter(p => p.life < p.maxLife);
}

function drawDust() {
  for (const p of dustParticles) {
    const alpha = 1 - p.life / p.maxLife;
    rctx.fillStyle = `rgba(148,163,184,${alpha.toFixed(2)})`;
    rctx.beginPath();
    rctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    rctx.fill();
  }
}

// ===== Steuerung =====
function runnerJump() {
  if (!runnerRunning || isPaused) return;
  if (player.grounded) {
    player.vy = -jumpStrength;
    player.grounded = false;
    playSfx(sfxJump);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (!runnerRunning) {
      startRunner();
    } else {
      runnerJump();
    }
  } else if (e.code === "KeyP") {
    togglePause();
  }
});

runnerCanvas.addEventListener("click", () => {
  if (!runnerRunning) {
    startRunner();
  } else {
    runnerJump();
  }
});

runnerCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (!runnerRunning) {
    startRunner();
  } else {
    runnerJump();
  }
}, { passive: false });

// ===== Update =====
function updateRunner(dt) {
  worldTime = (worldTime + dt * 0.03) % 1;

  updateDust(dt);

  if (!runnerRunning || isPaused) return;

  runAnimTime += dt * 8;

  const prevGrounded = player.grounded;

  // Physik
  player.vy += gravity * dt;
  player.y += player.vy * dt;

  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (player.grounded && !prevGrounded) {
    spawnDust();
    playSfx(sfxLand);
  }

  // Hindernisse bewegen
  for (const o of obstacles) {
    o.x -= gameSpeed * dt;
  }

  // Entfernen & Distanz
  obstacles = obstacles.filter(o => {
    if (!o.passed && o.x + o.width < player.x) {
      o.passed = true;
      distance += o.type === "stone" ? 4 : 7;
      document.getElementById("distance").textContent = distance;

      if (gameSpeed < maxGameSpeed) {
        gameSpeed += 18;
      }
      obstacleDelay = Math.max(0.7, obstacleDelay - 0.02);
    }
    return o.x + o.width > -40;
  });

  // Neue Hindernisse
  obstacleTimer += dt;
  if (obstacleTimer > obstacleDelay) {
    obstacleTimer = 0;
    spawnObstacle();
  }

  // Kollision
  for (const o of obstacles) {
    if (
      player.x < o.x + o.width &&
      player.x + player.width > o.x &&
      player.y < o.y + o.height &&
      player.y + player.height > o.y
    ) {
      handleHit();
      break;
    }
  }
}

function handleHit() {
  playSfx(sfxCrash);
  lives -= 1;
  if (lives < 0) lives = 0;
  updateLivesDisplay();

  if (lives > 0) {
    softResetAfterHit();
  } else {
    endRunnerGame();
  }
}

// ===== Zeichnen =====
function drawBackground() {
  const horizonY = groundY - rHeight * 0.45;

  const daySkyTop = [56, 189, 248];
  const daySkyBottom = [37, 99, 235];
  const nightSkyTop = [15, 23, 42];
  const nightSkyBottom = [2, 6, 23];

  const t = (Math.sin(worldTime * Math.PI * 2 - Math.PI / 2) + 1) / 2;

  const skyTop = lerpColor(daySkyTop, nightSkyTop, t);
  const skyBottom = lerpColor(daySkyBottom, nightSkyBottom, t);

  const grad = rctx.createLinearGradient(0, 0, 0, rHeight);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(1, skyBottom);
  rctx.fillStyle = grad;
  rctx.fillRect(0, 0, rWidth, rHeight);

  // Straße
  rctx.fillStyle = "#020617";
  rctx.beginPath();
  rctx.moveTo(0, groundY);
  rctx.lineTo(rWidth, groundY);
  rctx.lineTo(rWidth * 0.7, horizonY);
  rctx.lineTo(rWidth * 0.3, horizonY);
  rctx.closePath();
  rctx.fill();

  // Grasfläche
  const grassDay = [22, 163, 74];
  const grassNight = [4, 78, 50];
  rctx.fillStyle = lerpColor(grassDay, grassNight, t);
  rctx.fillRect(0, groundY, rWidth, rHeight - groundY);

  // Boden-Blöcke
  const blockW = rWidth * 0.06;
  const blockH = rHeight * 0.08;
  for (let x = -blockW; x < rWidth + blockW; x += blockW * 0.9) {
    drawBlock(
      x,
      groundY - blockH * 0.4,
      blockW,
      blockH,
      lerpColor([34, 197, 94], [21, 128, 61], t),
      lerpColor([74, 222, 128], [34, 197, 94], t)
    );
  }

  // Linien auf der Straße
  rctx.strokeStyle = "rgba(148,163,184,0.4)";
  rctx.lineWidth = 1;
  const lines = 8;
  for (let i = 1; i <= lines; i++) {
    const lt = i / (lines + 1);
    const y = lerp(groundY, horizonY, lt);
    const left = lerp(0, rWidth * 0.3, lt);
    const right = lerp(rWidth, rWidth * 0.7, lt);
    rctx.beginPath();
    rctx.moveTo(left, y);
    rctx.lineTo(right, y);
    rctx.stroke();
  }

  // Berge
  const hillBaseY = horizonY + rHeight * 0.1;
  const hillDay = [15, 23, 42];
  const hillNight = [3, 7, 18];

  rctx.fillStyle = lerpColor(hillDay, hillNight, t);
  rctx.beginPath();
  rctx.moveTo(-50, hillBaseY);
  rctx.lineTo(rWidth * 0.25, hillBaseY - rHeight * 0.18);
  rctx.lineTo(rWidth * 0.5, hillBaseY);
  rctx.lineTo(rWidth * 0.75, hillBaseY - rHeight * 0.2);
  rctx.lineTo(rWidth + 50, hillBaseY);
  rctx.lineTo(rWidth + 50, rHeight);
  rctx.lineTo(-50, rHeight);
  rctx.closePath();
  rctx.fill();
}

function drawPlayer() {
  const p = player;

  let bob = 0;
  if (runnerRunning && !isPaused && p.grounded) {
    bob = Math.sin(runAnimTime * 2) * (p.height * 0.04);
  }

  const headH = p.height * 0.28;
  const bodyH = p.height * 0.42;
  const legH = p.height * 0.30;

  const headY = p.y - bob;
  const bodyY = headY + headH;
  const legY = bodyY + bodyH;

  let swing;
  if (runnerRunning && !isPaused && p.grounded) {
    swing = Math.sin(runAnimTime * 6);
  } else if (!p.grounded) {
    swing = 0.7;
  } else {
    swing = 0;
  }

  const legOffset = p.width * 0.08;
  const leftX = p.x + p.width * 0.05 + swing * legOffset;
  const rightX = p.x + p.width * 0.6 - swing * legOffset;

  rctx.fillStyle = "#1d4ed8";
  rctx.fillRect(leftX, legY, p.width * 0.35, legH);
  rctx.fillRect(rightX, legY, p.width * 0.35, legH);

  drawBlock(
    p.x,
    bodyY,
    p.width,
    bodyH,
    "#22c55e",
    "#4ade80"
  );

  drawBlock(
    p.x + p.width * 0.05,
    headY,
    p.width * 0.9,
    headH,
    "#facc15",
    "#fde047"
  );

  rctx.fillStyle = "rgba(0,0,0,0.12)";
  rctx.fillRect(p.x + p.width * 0.05, headY, p.width * 0.25, headH);

  rctx.fillStyle = "#0f172a";
  const eyeSize = headH * 0.16;
  const eyeY = headY + headH * 0.36;
  rctx.fillRect(p.x + p.width * 0.55, eyeY, eyeSize, eyeSize);
  rctx.fillRect(p.x + p.width * 0.72, eyeY, eyeSize, eyeSize);
}

function drawObstacle(o) {
  if (o.type === "stone") {
    drawBlock(
      o.x,
      o.y,
      o.width,
      o.height,
      "#6b7280",
      "#9ca3af"
    );
  } else {
    const trunkH = o.height * 0.35;
    const trunkW = o.width * 0.26;
    const trunkX = o.x + (o.width - trunkW) / 2;
    const trunkY = o.y + o.height - trunkH;

    drawBlock(
      trunkX,
      trunkY,
      trunkW,
      trunkH,
      "#78350f",
      "#92400e"
    );

    const crownH = o.height * 0.6;
    const crownY = o.y;
    drawBlock(
      o.x,
      crownY,
      o.width,
      crownH,
      "#15803d",
      "#22c55e"
    );
  }
}

function drawRunner() {
  rctx.clearRect(0, 0, rWidth, rHeight);
  drawBackground();

  for (const o of obstacles) drawObstacle(o);
  drawDust();
  drawPlayer();

  if (!runnerRunning) {
    rctx.fillStyle = "rgba(15,23,42,0.65)";
    rctx.fillRect(0, 0, rWidth, rHeight);
    rctx.fillStyle = "#e5e7eb";
    rctx.textAlign = "center";
    rctx.font = `${Math.floor(rHeight * 0.06)}px Arial`;
    rctx.fillText("Klicke / tippe oder drücke Leertaste zum Starten", rWidth / 2, rHeight / 2);
  } else if (isPaused) {
    rctx.fillStyle = "rgba(15,23,42,0.55)";
    rctx.fillRect(0, 0, rWidth, rHeight);
    rctx.fillStyle = "#e5e7eb";
    rctx.textAlign = "center";
    rctx.font = `${Math.floor(rHeight * 0.06)}px Arial`;
    rctx.fillText("Pausiert – P drücken oder Button klicken zum Fortsetzen", rWidth / 2, rHeight / 2);
  }
}

// ===== Game Loop =====
function runnerLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  updateRunner(dt);
  drawRunner();

  requestAnimationFrame(runnerLoop);
}

function endRunnerGame() {
  runnerRunning = false;
  isPaused = false;

  if (distance > highscoreRunner) {
    highscoreRunner = distance;
    localStorage.setItem("runner_highscore", String(highscoreRunner));
    document.getElementById("runnerHighscore").textContent = highscoreRunner;
    alert("Neue Bestleistung! Distanz: " + distance + " m");
  } else {
    alert("Game Over! Distanz: " + distance + " m");
  }
}

// ===== Init =====
resetRunner();
lastTime = performance.now();
requestAnimationFrame(runnerLoop);
