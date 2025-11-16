const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let width = 800;
let height = 400;

function resizeCanvas() {
  const wrapper = document.querySelector(".canvas-wrapper");
  const availableWidth = wrapper.clientWidth - 24;
  const maxWidth = 700;
  width = Math.min(availableWidth, maxWidth);
  height = width * 0.6;

  canvas.width = width;
  canvas.height = height;

  // Quadratgröße an neue Breite anpassen
  square.size = width * squareSizeFactor;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Audio
const hitSound = document.getElementById("sfx-hit");
const bgMusic  = document.getElementById("music-bg");

let soundEnabled = true;
let musicEnabled = false;

// Spielzustand
let square = { x: 100, y: 100, size: 45 };
let squareSizeFactor = 0.08; // relativ zur Breite

let score = 0;
let highscore = Number(localStorage.getItem("click_highscore") || 0);
let timeLeft = 30;
let gameRunning = false;
let timerId = null;

document.getElementById("highscore").textContent = highscore;

// Hilfsfunktionen
function randomPosition() {
  const maxX = width  - square.size;
  const maxY = height - square.size;
  square.x = Math.floor(Math.random() * maxX);
  square.y = Math.floor(Math.random() * maxY);
}

function draw() {
  // Hintergrund
  ctx.clearRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#1e293b");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Spielfeld-Rahmen
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  if (gameRunning) {
    // Glow-Quadrat
    ctx.shadowColor = "rgba(96, 165, 250, 0.9)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(square.x, square.y, square.size, square.size);
    ctx.shadowBlur = 0;
  } else {
    // Hinweistext
    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.font = `${Math.floor(height * 0.08)}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("Klicke auf „Spiel starten“", width / 2, height / 2);
  }

  requestAnimationFrame(draw);
}

// Spielsteuerung
function startGame() {
  score = 0;
  timeLeft = 30;
  squareSizeFactor = 0.08;
  square.size = width * squareSizeFactor;
  gameRunning = true;

  document.getElementById("score").textContent = score;
  document.getElementById("time").textContent = timeLeft;

  randomPosition();

  if (musicEnabled) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {});
  }

  if (timerId !== null) clearInterval(timerId);
  timerId = setInterval(tick, 1000);
}

function tick() {
  timeLeft--;
  document.getElementById("time").textContent = timeLeft;
  if (timeLeft <= 0) {
    endGame();
  }
}

function endGame() {
  gameRunning = false;
  clearInterval(timerId);
  if (!bgMusic.paused) bgMusic.pause();

  if (score > highscore) {
    highscore = score;
    localStorage.setItem("click_highscore", String(highscore));
    document.getElementById("highscore").textContent = highscore;
    alert("Neue Bestleistung! Punkte: " + score);
  } else {
    alert("Zeit vorbei! Deine Punkte: " + score);
  }
}

// Klick-/Touch-Erkennung mit Skalierung
function getCanvasCoords(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX, clientY;

  if (evt.touches && evt.touches.length > 0) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  } else {
    clientX = evt.clientX;
    clientY = evt.clientY;
  }

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top)  * scaleY;
  return { x, y };
}

function handleHit(x, y) {
  if (!gameRunning) return;

  if (
    x >= square.x &&
    x <= square.x + square.size &&
    y >= square.y &&
    y <= square.y + square.size
  ) {
    score++;
    document.getElementById("score").textContent = score;
    randomPosition();

    if (soundEnabled) {
      hitSound.currentTime = 0;
      hitSound.play().catch(() => {});
    }

    // Quadrat kleiner machen → schwieriger
    if (score % 5 === 0 && squareSizeFactor > 0.035) {
      squareSizeFactor -= 0.005;
      square.size = width * squareSizeFactor;
    }
  }
}

// Maus
canvas.addEventListener("click", (evt) => {
  const { x, y } = getCanvasCoords(evt);
  handleHit(x, y);
});

// Touch
canvas.addEventListener("touchstart", (evt) => {
  const { x, y } = getCanvasCoords(evt);
  handleHit(x, y);
  evt.preventDefault();
}, { passive: false });

// Buttons
function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    bgMusic.pause();
  } else if (gameRunning) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {});
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
}

// diese Funktionen werden von den Buttons in klickspiel.html aufgerufen
window.startGame   = startGame;
window.toggleMusic = toggleMusic;
window.toggleSound = toggleSound;

// Zeichenschleife starten
draw();
