// Canvas & Kontext
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Audio
const hitSound = document.getElementById("sfx-hit");
const bgMusic = document.getElementById("music-bg");

let soundEnabled = true;
let musicEnabled = false;

// Spiellogik
let square = { x: 0, y: 0, size: 0 };
let squareSizeFactor = 0.08; // Größe relativ zur Canvas-Breite
let score = 0;
let highscore = Number(localStorage.getItem("click_highscore") || 0);
let timeLeft = 30;
let gameRunning = false;
let timerId = null;

document.getElementById("highscore").textContent = highscore;

// Canvas-Größe an Bildschirm anpassen
function resizeCanvas() {
  const wrapper = document.querySelector(".canvas-wrapper");
  const availableWidth = wrapper.clientWidth - 20; // etwas Puffer
  const maxWidth = 700;
  const canvasWidth = Math.min(availableWidth, maxWidth);
  const aspect = 7 / 4;

  canvas.width = canvasWidth;
  canvas.height = canvasWidth / aspect;

  // Quadratgröße neu berechnen
  square.size = squareSizeFactor * canvas.width;

  // Quadrat im sichtbaren Bereich halten
  if (square.x + square.size > canvas.width) {
    square.x = Math.max(0, canvas.width - square.size);
  }
  if (square.y + square.size > canvas.height) {
    square.y = Math.max(0, canvas.height - square.size);
  }
}

// Zufällige Position für das Quadrat
function randomPosition() {
  const maxX = canvas.width - square.size;
  const maxY = canvas.height - square.size;
  square.x = Math.floor(Math.random() * maxX);
  square.y = Math.floor(Math.random() * maxY);
}

// Zeichnen
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameRunning) {
    ctx.shadowColor = "rgba(96, 165, 250, 0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(square.x, square.y, square.size, square.size);
    ctx.shadowBlur = 0;
  }

  requestAnimationFrame(draw);
}

// Spiel starten
function startGame() {
  score = 0;
  timeLeft = 30;
  gameRunning = true;
  squareSizeFactor = 0.08; // zurücksetzen
  square.size = squareSizeFactor * canvas.width;
  document.getElementById("score").textContent = score;
  document.getElementById("time").textContent = timeLeft;

  randomPosition();

  if (musicEnabled) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {});
  }

  if (timerId !== null) {
    clearInterval(timerId);
  }
  timerId = setInterval(tick, 1000);
}

function tick() {
  timeLeft--;
  document.getElementById("time").textContent = timeLeft;
  if (timeLeft <= 0) {
    endGame();
  }
}

// Spiel beenden
function endGame() {
  gameRunning = false;
  clearInterval(timerId);
  if (!bgMusic.paused) {
    bgMusic.pause();
  }

  if (score > highscore) {
    highscore = score;
    localStorage.setItem("click_highscore", String(highscore));
    document.getElementById("highscore").textContent = highscore;
    alert("Neue Bestleistung! Punkte: " + score);
  } else {
    alert("Zeit vorbei! Deine Punkte: " + score);
  }
}

// Mausklick / Touch
function handlePointer(clientX, clientY) {
  if (!gameRunning) return;

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

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

    // Schwierigkeit erhöhen: Quadrat nach und nach kleiner
    if (score % 5 === 0 && squareSizeFactor > 0.035) {
      squareSizeFactor -= 0.005;
      square.size = squareSizeFactor * canvas.width;
    }
  }
}

canvas.addEventListener("click", (event) => {
  handlePointer(event.clientX, event.clientY);
});

// Touch-Unterstützung für Smartphones
canvas.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  handlePointer(touch.clientX, touch.clientY);
  event.preventDefault();
});

// Musik ein/aus
function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    bgMusic.pause();
  } else if (!gameRunning) {
    // nur abspielen, wenn schon interagiert wurde
    bgMusic.play().catch(() => {});
  }
}

// Soundeffekte ein/aus
function toggleSound() {
  soundEnabled = !soundEnabled;
}

// Canvas-Größe initial setzen & bei Fensteränderung anpassen
window.addEventListener("resize", () => {
  const oldWidth = canvas.width;
  const oldHeight = canvas.height;

  resizeCanvas();

  // Position grob proportional anpassen, wenn bereits gespielt wird
  if (oldWidth && oldHeight) {
    const scaleX = canvas.width / oldWidth;
    const scaleY = canvas.height / oldHeight;
    square.x *= scaleX;
    square.y *= scaleY;
    square.size = squareSizeFactor * canvas.width;
  }
});

// Initial
resizeCanvas();
draw();
