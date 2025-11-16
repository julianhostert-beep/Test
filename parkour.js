const canvas = document.getElementById("parkourCanvas");
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

// HUD
const distanceEl = document.getElementById("distance");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");

let bestDistance = 0;

// Steuerung
let keys = {};
window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup",   (e) => { keys[e.code] = false; });

// Physik
const GRAVITY     = 2500;
const JUMP_FORCE  = 950;
const FLOOR_RATIO = 0.78;
const MAX_LIVES   = 3;

// Spielzustand
let state = {
  player: {
    x: 0,
    y: 0,
    vy: 0,
    width: 40,
    height: 70,
    onGround: false,
  },
  baseSpeed: 350,
  speedFactor: 1,
  distance: 0,
  lives: MAX_LIVES,
  obstacles: [],
  platforms: [],
  gameOver: false,
};

function resetGame() {
  const floorY = height * FLOOR_RATIO;

  state.player.width  = width * 0.05;
  state.player.height = height * 0.16;
  state.player.x      = width * 0.2;
  state.player.y      = floorY - state.player.height;
  state.player.vy     = 0;
  state.player.onGround = true;

  state.baseSpeed   = 350;
  state.speedFactor = 1;
  state.distance    = 0;
  state.lives       = MAX_LIVES;
  state.obstacles   = [];
  state.platforms   = [];
  state.gameOver    = false;

  distanceEl.textContent = "0";
  livesEl.textContent    = "♥".repeat(state.lives);

  // Bodenplattform
  const floorHeight = height * 0.1;
  state.platforms.push({
    x: 0,
    y: floorY,
    width: width * 3,
    height: floorHeight,
    isFloating: false,
  });
}

function spawnObstacle() {
  const floorY = height * FLOOR_RATIO;
  const base = state.player.height * (0.6 + Math.random() * 0.5);

  if (Math.random() < 0.7) {
    // Block auf dem Boden
    state.obstacles.push({
      x: width + Math.random() * width,
      y: floorY - base,
      width: base * (0.6 + Math.random() * 0.3),
      height: base,
    });
  } else {
    // schwebende Plattform
    const platWidth  = base * (1.5 + Math.random() * 1.5);
    const platHeight = base * 0.3;
    const platY      = floorY - state.player.height * (1.4 + Math.random() * 0.7);

    state.platforms.push({
      x: width + Math.random() * width,
      y: platY,
      width: platWidth,
      height: platHeight,
      isFloating: true,
    });
  }
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width  <= b.x ||
    a.x >= b.x + b.width ||
    a.y + a.height <= b.y ||
    a.y >= b.y + b.height
  );
}

function update(dt) {
  if (state.gameOver) return;

  const floorY = height * FLOOR_RATIO;

  // Grundgeschwindigkeit
  let speed = state.baseSpeed;
  if (keys["KeyW"])      state.speedFactor = 1.2;
  else if (keys["KeyS"]) state.speedFactor = 0.7;
  else                   state.speedFactor = 1;
  speed *= state.speedFactor;

  // seitliches Laufen
  const sideSpeed = speed * 0.6;
  if (keys["KeyA"]) state.player.x -= sideSpeed * dt;
  if (keys["KeyD"]) state.player.x += sideSpeed * dt;
  state.player.x = Math.max(10, Math.min(width * 0.7, state.player.x));

  // Springen
  if ((keys["Space"] || keys["ArrowUp"]) && state.player.onGround) {
    state.player.vy = -JUMP_FORCE;
    state.player.onGround = false;
  }

  // Vertikale Physik
  state.player.vy += GRAVITY * dt;
  state.player.y  += state.player.vy * dt;

  state.player.onGround = false;
  let playerBox = {
    x: state.player.x,
    y: state.player.y,
    width: state.player.width,
    height: state.player.height,
  };

  // Plattform-Kollision (von oben)
  for (const plat of state.platforms) {
    const platBox = {
      x: plat.x,
      y: plat.y,
      width:  plat.width,
      height: plat.height,
    };
    if (state.player.vy >= 0 && rectsOverlap(playerBox, platBox)) {
      const prevY = state.player.y - state.player.vy * dt;
      if (prevY + state.player.height <= plat.y + 4) {
        state.player.y = plat.y - state.player.height;
        state.player.vy = 0;
        state.player.onGround = true;
        playerBox.y = state.player.y;
      }
    }
  }

  // herunterfallen
  if (state.player.y > height) {
    loseLife();
    return;
  }

  // Sicherheit: nicht unter den Boden
  if (state.player.y + state.player.height > floorY + height * 0.2) {
    state.player.y  = floorY - state.player.height;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  // Scroll-Geschwindigkeit
  const moveX = speed * dt;
  state.distance += moveX * 0.05;
  distanceEl.textContent = Math.floor(state.distance);

  for (const o of state.obstacles) {
    o.x -= moveX;
  }
  for (const p of state.platforms) {
    p.x -= moveX;
  }

  state.obstacles = state.obstacles.filter(o => o.x + o.width > -50);
  state.platforms = state.platforms.filter(p => p.x + p.width > -50 || !p.isFloating);

  if (state.obstacles.length === 0 || state.obstacles[state.obstacles.length - 1].x < width * 0.6) {
    spawnObstacle();
  }

  if (state.platforms.length < 5 && Math.random() < 0.2) {
    spawnObstacle();
  }

  // Hindernis-Kollision
  playerBox = {
    x: state.player.x,
    y: state.player.y,
    width: state.player.width,
    height: state.player.height,
  };

  for (const o of state.obstacles) {
    const oBox = { x: o.x, y: o.y, width: o.width, height: o.height };
    if (rectsOverlap(playerBox, oBox)) {
      loseLife();
      break;
    }
  }
}

function loseLife() {
  state.lives--;
  if (state.lives <= 0) {
    state.gameOver = true;
    const scored = Math.floor(state.distance);
    if (scored > bestDistance) bestDistance = scored;
    bestEl.textContent = bestDistance + " m";
    livesEl.textContent = "";
    alert("Game Over! Distanz: " + scored + " m");
    resetGame();
  } else {
    livesEl.textContent = "♥".repeat(state.lives);
    const floorY = height * FLOOR_RATIO;
    state.player.y  = floorY - state.player.height;
    state.player.vy = 0;
    state.player.onGround = true;
  }
}

function draw() {
  const floorY = height * FLOOR_RATIO;

  // Himmel
  const skyGrad = ctx.createLinearGradient(0, 0, 0, floorY);
  skyGrad.addColorStop(0, "#1d4ed8");
  skyGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, floorY);

  // Boden
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, floorY, width, height - floorY);

  // Plattformen
  for (const plat of state.platforms) {
    ctx.fillStyle = plat.isFloating ? "#1f2937" : "#0f172a";
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    ctx.fillStyle = "#111827";
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height * 0.3);
  }

  // Hindernisse
  for (const o of state.obstacles) {
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(o.x, o.y, o.width, o.height);
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(o.x, o.y + o.height * 0.6, o.width, o.height * 0.4);
  }

  // Spieler-Figur
  const p = state.player;
  const headH = p.height * 0.28;
  const bodyH = p.height * 0.42;
  const legH  = p.height * 0.30;

  const headY = p.y;
  const bodyY = headY + headH;
  const legY  = bodyY + bodyH;

  const headW = p.width * 0.7;
  const bodyW = p.width;
  const legW  = p.width * 0.26;

  const headX = p.x + p.width * 0.15;
  const bodyX = p.x;

  // Beine
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(p.x + p.width * 0.05, legY, legW, legH);
  ctx.fillRect(p.x + p.width * 0.65, legY, legW, legH);

  // Körper
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Kopf
  ctx.fillStyle = "#facc15";
  ctx.fillRect(headX, headY, headW, headH);

  // Augen
  ctx.fillStyle = "#0f172a";
  const eyeSize = headH * 0.18;
  const eyeY = headY + headH * 0.4;
  ctx.fillRect(headX + headW * 0.2, eyeY, eyeSize, eyeSize);
  ctx.fillRect(headX + headW * 0.6, eyeY, eyeSize, eyeSize);
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
