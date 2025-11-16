const raceCanvas = document.getElementById("raceCanvas");
const rctx = raceCanvas.getContext("2d");

let rWidth = 540;
let rHeight = 960;

function resizeRaceCanvas() {
  const wrapper = document.querySelector(".canvas-wrapper");
  const availableWidth = wrapper.clientWidth - 20;
  const maxWidth = 900;
  rWidth = Math.min(availableWidth, maxWidth);
  rHeight = rWidth * (16 / 9); // hochkant

  raceCanvas.width = rWidth;
  raceCanvas.height = rHeight;
}
window.addEventListener("resize", resizeRaceCanvas);
resizeRaceCanvas();

// HUD
const raceDistanceEl = document.getElementById("raceDistance");
const raceSpeedEl    = document.getElementById("raceSpeed");
const raceLivesEl    = document.getElementById("raceLives");
const raceBestEl     = document.getElementById("raceBest");

let raceBestDistance = 0;

// Steuerung
let rKeys = {};
window.addEventListener("keydown", (e) => { rKeys[e.code] = true; });
window.addEventListener("keyup",   (e) => { rKeys[e.code] = false; });

// Spielfeld / Straße
let raceState = {
  player: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  speed: 0,
  targetSpeed: 0,
  minSpeed: 40,
  maxSpeed: 220,
  distance: 0,
  lives: 3,
  roadCenter: 0.5, // 0..1 (relative Breite)
  roadWidth: 0.35, // relative Breite der Straße
  roadSegments: [],
  roadScrollY: 0,
  gameOver: false,
};

function resetRace() {
  raceState.player.width  = rWidth * 0.12;
  raceState.player.height = rHeight * 0.18;
  raceState.player.x      = rWidth / 2 - raceState.player.width / 2;
  raceState.player.y      = rHeight * 0.78;

  raceState.speed       = 80;
  raceState.targetSpeed = 120;
  raceState.distance    = 0;
  raceState.lives       = 3;
  raceState.roadCenter  = 0.5;
  raceState.roadWidth   = 0.34;
  raceState.roadSegments = [];
  raceState.roadScrollY = 0;
  raceState.gameOver    = false;

  raceDistanceEl.textContent = "0";
  raceLivesEl.textContent = "♥".repeat(raceState.lives);

  // Start-Straße erzeugen
  let y = 0;
  for (let i = 0; i < 20; i++) {
    raceState.roadSegments.push({
      center: raceState.roadCenter,
      width: raceState.roadWidth,
      y: y,
    });
    y += 80;
  }
}

function spawnRoadSegment() {
  const last = raceState.roadSegments[raceState.roadSegments.length - 1];
  let newCenter = last.center + (Math.random() * 0.3 - 0.15); // leichte Kurve
  newCenter = Math.max(0.25, Math.min(0.75, newCenter));

  const newWidth = last.width + (Math.random() * 0.06 - 0.03);
  const clampedWidth = Math.max(0.26, Math.min(0.42, newWidth));

  raceState.roadSegments.push({
    center: newCenter,
    width: clampedWidth,
    y: last.y + 80,
  });
}

// Hilfsfunktion: je nach y die aktuelle Straßenposition interpolieren
function getRoadAtY(y) {
  const segs = raceState.roadSegments;
  if (segs.length < 2) return { left: 0, right: rWidth };

  let s1 = segs[0];
  let s2 = segs[1];

  for (let i = 0; i < segs.length - 1; i++) {
    if (y >= segs[i].y && y <= segs[i + 1].y) {
      s1 = segs[i];
      s2 = segs[i + 1];
      break;
    }
  }

  const t = (y - s1.y) / (s2.y - s1.y);
  const center = s1.center + (s2.center - s1.center) * t;
  const width  = s1.width  + (s2.width  - s1.width)  * t;

  const roadPixelWidth = rWidth * width;
  const roadCenterX    = rWidth * center;
  const left  = roadCenterX - roadPixelWidth / 2;
  const right = roadCenterX + roadPixelWidth / 2;

  return { left, right };
}

function updateRace(dt) {
  if (raceState.gameOver) return;

  // Speed anpassen
  if (rKeys["KeyW"] || rKeys["ArrowUp"]) {
    raceState.targetSpeed = Math.min(raceState.targetSpeed + 80 * dt, raceState.maxSpeed);
  } else if (rKeys["KeyS"] || rKeys["ArrowDown"]) {
    raceState.targetSpeed = Math.max(raceState.targetSpeed - 80 * dt, raceState.minSpeed);
  }

  raceState.speed += (raceState.targetSpeed - raceState.speed) * 4 * dt;

  // seitlich lenken
  const steerSpeed = rWidth * 0.7; // px / sec
  if (rKeys["KeyA"] || rKeys["ArrowLeft"]) {
    raceState.player.x -= steerSpeed * dt;
  }
  if (rKeys["KeyD"] || rKeys["ArrowRight"]) {
    raceState.player.x += steerSpeed * dt;
  }
  raceState.player.x = Math.max(0, Math.min(rWidth - raceState.player.width, raceState.player.x));

  // Strecke scrollen
  const scrollY = raceState.speed * dt;
  raceState.roadScrollY += scrollY;
  raceState.distance += scrollY * 0.06;
  raceDistanceEl.textContent = Math.floor(raceState.distance);
  raceSpeedEl.textContent    = Math.round(raceState.speed) + "";

  // Segmente nach oben schieben
  for (const seg of raceState.roadSegments) {
    seg.y -= scrollY;
  }

  // neue Segmente hinzufügen
  while (raceState.roadSegments[raceState.roadSegments.length - 1].y < rHeight + 80) {
    spawnRoadSegment();
  }

  // alte entfernen
  raceState.roadSegments = raceState.roadSegments.filter(seg => seg.y > -160);

  // Kollision mit Rand der Straße (unten bei Auto)
  const carCenterY = raceState.player.y + raceState.player.height * 0.9;
  const roadAtCar  = getRoadAtY(carCenterY);

  const carLeft  = raceState.player.x + raceState.player.width * 0.1;
  const carRight = raceState.player.x + raceState.player.width * 0.9;

  let offRoad = false;
  if (carLeft < roadAtCar.left || carRight > roadAtCar.right) {
    offRoad = true;
  }

  if (offRoad) {
    // abbremsen + Leben verlieren
    raceState.targetSpeed = Math.max(raceState.targetSpeed - 160 * dt, raceState.minSpeed * 0.5);
    if (Math.random() < 0.02) { // nicht jede Sekunde spammen
      raceState.lives--;
      if (raceState.lives <= 0) {
        raceState.lives = 0;
        raceLivesEl.textContent = "";
        raceGameOver();
      } else {
        raceLivesEl.textContent = "♥".repeat(raceState.lives);
      }
    }
  }
}

function raceGameOver() {
  raceState.gameOver = true;
  const dist = Math.floor(raceState.distance);
  if (dist > raceBestDistance) raceBestDistance = dist;
  raceBestEl.textContent = raceBestDistance + " m";
  alert("Crash! Distanz: " + dist + " m");
  resetRace();
}

function drawRace() {
  // Hintergrund (grünliche Landschaft)
  const groundGrad = rctx.createLinearGradient(0, 0, 0, rHeight);
  groundGrad.addColorStop(0, "#14532d");
  groundGrad.addColorStop(1, "#022c22");
  rctx.fillStyle = groundGrad;
  rctx.fillRect(0, 0, rWidth, rHeight);

  // Straße zeichnen (Segment-Polygon)
  rctx.lineWidth = 2;
  for (let i = 0; i < raceState.roadSegments.length - 1; i++) {
    const s1 = raceState.roadSegments[i];
    const s2 = raceState.roadSegments[i + 1];

    const road1 = getRoadAtY(s1.y);
    const road2 = getRoadAtY(s2.y);

    rctx.beginPath();
    rctx.moveTo(road1.left,  s1.y);
    rctx.lineTo(road1.right, s1.y);
    rctx.lineTo(road2.right, s2.y);
    rctx.lineTo(road2.left,  s2.y);
    rctx.closePath();

    const shade = 0.4 + (i / raceState.roadSegments.length) * 0.4;
    rctx.fillStyle = `rgba(${Math.floor(40 + 40 * shade)}, ${Math.floor(40 + 40 * shade)}, ${Math.floor(40 + 40 * shade)}, 1)`;
    rctx.fill();

    // Straßenlinie
    rctx.strokeStyle = "rgba(229,231,235,0.25)";
    rctx.beginPath();
    rctx.moveTo((road1.left + road1.right) / 2, s1.y);
    rctx.lineTo((road2.left + road2.right) / 2, s2.y);
    rctx.stroke();
  }

  // Auto
  const p = raceState.player;
  rctx.save();
  rctx.translate(p.x + p.width / 2, p.y + p.height / 2);
  rctx.rotate(Math.sin(raceState.distance * 0.01) * 0.05); // leichte Wackel-Animation

  // Karosserie
  rctx.fillStyle = "#ef4444";
  rctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);

  // Dach
  rctx.fillStyle = "#fecaca";
  rctx.fillRect(-p.width*0.35, -p.height*0.15, p.width*0.7, p.height*0.6);

  // Räder
  rctx.fillStyle = "#020617";
  const rw = p.width * 0.18;
  const rh = p.height * 0.25;
  rctx.fillRect(-p.width/2 - rw*0.2, -p.height/2 + rh*0.1, rw, rh);
  rctx.fillRect( p.width/2 - rw*0.8, -p.height/2 + rh*0.1, rw, rh);
  rctx.fillRect(-p.width/2 - rw*0.2,  p.height/2 - rh*1.1, rw, rh);
  rctx.fillRect( p.width/2 - rw*0.8,  p.height/2 - rh*1.1, rw, rh);

  rctx.restore();
}

function raceLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  updateRace(dt);
  drawRace();

  requestAnimationFrame(raceLoop);
}

resetRace();
requestAnimationFrame(raceLoop);
