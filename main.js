const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const levelValue = document.getElementById("levelValue");
const targetValue = document.getElementById("targetValue");
const progressBar = document.getElementById("progressBar");
const levelLadder = document.getElementById("levelLadder");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySubtitle = document.getElementById("overlaySubtitle");
const overlayBtn = document.getElementById("overlayBtn");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const soundToggle = document.getElementById("soundToggle");
const effectTitle = document.getElementById("effectTitle");
const effectDesc = document.getElementById("effectDesc");

const LEVELS = [
  { name: "Bloom", speed: 6, target: 120 },
  { name: "Pulse", speed: 7, target: 240 },
  { name: "Surge", speed: 8, target: 380 },
  { name: "Vortex", speed: 9, target: 540 },
  { name: "Zenith", speed: 10, target: 720 },
];

const COLORS = {
  board: "#0a0f16",
  grid: "rgba(90, 130, 190, 0.12)",
  snake: "#2ef2ff",
  head: "#6dffd7",
  food: "#33f2b1",
  boost: "#ff7a45",
  slow: "#6aa7ff",
  obstacle: "#9a6bff",
};

let cols = 24;
let rows = 36;
let cell = 18;
let offsetX = 0;
let offsetY = 0;

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let foodType = "normal";
let obstacles = new Set();
let pendingGrowth = 0;

let score = 0;
let levelIndex = 0;
let levelTarget = LEVELS[0].target;
let baseSpeed = LEVELS[0].speed;
let speedOverride = null;
let speedSteps = 0;

let running = false;
let paused = false;
let lastTime = 0;
let accumulator = 0;

let touchStart = null;
let audioEnabled = false;
let audioCtx = null;

const BEST_KEY = "neon-serpent-best";
const storedBest = Number(localStorage.getItem(BEST_KEY) || 0);
let bestScore = storedBest;

function resizeBoard() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const aspect = rect.height / rect.width;
  if (aspect > 1.5) {
    cols = 24;
    rows = 38;
  } else if (aspect > 1.2) {
    cols = 24;
    rows = 34;
  } else {
    cols = 26;
    rows = 30;
  }

  cell = Math.floor(Math.min(rect.width / cols, rect.height / rows));
  offsetX = Math.floor((rect.width - cell * cols) / 2);
  offsetY = Math.floor((rect.height - cell * rows) / 2);
}

function resetGame() {
  running = false;
  paused = false;
  accumulator = 0;
  lastTime = 0;
  levelIndex = 0;
  score = 0;
  baseSpeed = LEVELS[0].speed;
  levelTarget = LEVELS[0].target;
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  pendingGrowth = 0;
  speedOverride = null;
  speedSteps = 0;

  const startX = Math.floor(cols / 2);
  const startY = Math.floor(rows / 2);
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];

  obstacles = buildObstacles(levelIndex + 1);
  cleanupObstacles();
  spawnFood();
  updateUI();
  showOverlay("Swipe to begin", "Collect glowing orbs, dodge arcs, and climb the ladder.");
}

function cleanupObstacles() {
  const snakeSet = new Set(snake.map((seg) => `${seg.x},${seg.y}`));
  obstacles = new Set([...obstacles].filter((key) => !snakeSet.has(key)));
}

function buildObstacles(level) {
  const set = new Set();
  if (level >= 2) {
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      for (let y = cy - 1; y <= cy + 1; y += 1) {
        set.add(`${x},${y}`);
      }
    }
  }
  if (level >= 3) {
    for (let y = 4; y < rows - 4; y += 1) {
      set.add(`${Math.floor(cols / 3)},${y}`);
      set.add(`${Math.floor((cols * 2) / 3)},${y}`);
    }
  }
  if (level >= 4) {
    for (let x = 4; x < cols - 4; x += 1) {
      set.add(`${x},${Math.floor(rows / 3)}`);
      set.add(`${x},${Math.floor((rows * 2) / 3)}`);
    }
  }
  if (level >= 5) {
    for (let x = 2; x <= 4; x += 1) {
      for (let y = 2; y <= 4; y += 1) {
        set.add(`${x},${y}`);
        set.add(`${cols - 1 - x},${rows - 1 - y}`);
      }
    }
  }
  return set;
}

function spawnFood() {
  const free = [];
  const occupied = new Set([...obstacles, ...snake.map((seg) => `${seg.x},${seg.y}`)]);
  for (let x = 0; x < cols; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        free.push({ x, y });
      }
    }
  }
  if (!free.length) {
    showOverlay("You Win", "The circuit is full. Restart to run again.");
    running = false;
    return;
  }
  food = free[Math.floor(Math.random() * free.length)];
  const roll = Math.random();
  if (roll > 0.9) {
    foodType = "boost";
  } else if (roll > 0.8) {
    foodType = "slow";
  } else {
    foodType = "normal";
  }
}

function startGame() {
  running = true;
  paused = false;
  hideOverlay();
  pauseBtn.textContent = "Pause";
  updateUI();
}

function pauseGame() {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (paused) {
    showOverlay("Paused", "Tap resume or press space to continue.", false);
  } else {
    hideOverlay();
  }
}

function endGame() {
  running = false;
  showOverlay("Game Over", "Restart to attempt a new run.");
  playTone(130, 0.2);
  updateBest();
  updateUI();
}

function showOverlay(title, subtitle, showButton = true) {
  overlayTitle.textContent = title;
  overlaySubtitle.textContent = subtitle;
  overlayBtn.style.display = showButton ? "inline-flex" : "none";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function updateBest() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, String(bestScore));
  }
  bestValue.textContent = bestScore;
}

function updateUI() {
  scoreValue.textContent = score;
  bestValue.textContent = bestScore;
  levelValue.textContent = `${levelIndex + 1}`;
  targetValue.textContent = levelTarget;
  const progress = Math.min(score / levelTarget, 1);
  progressBar.style.width = `${progress * 100}%`;

  const ladderItems = [...levelLadder.querySelectorAll(".ladder-item")];
  ladderItems.forEach((item) => item.classList.remove("active"));
  const activeIndex = Math.min(levelIndex, ladderItems.length - 1);
  if (ladderItems[activeIndex]) {
    ladderItems[activeIndex].classList.add("active");
  }

  if (speedOverride) {
    effectTitle.textContent = speedOverride > baseSpeed ? "Turbo" : "Drift";
    effectDesc.textContent = speedOverride > baseSpeed
      ? "Speed boosted for a few moves."
      : "Time slowed for a few moves.";
  } else {
    effectTitle.textContent = "Stable";
    effectDesc.textContent = "No active effects. Keep collecting orbs.";
  }
}

function applyFoodEffect() {
  if (foodType === "boost") {
    score += 25;
    pendingGrowth += 2;
    speedOverride = baseSpeed + 2;
    speedSteps = 12;
    playTone(540, 0.12);
  } else if (foodType === "slow") {
    score += 8;
    pendingGrowth += 1;
    speedOverride = Math.max(3, baseSpeed - 2);
    speedSteps = 10;
    playTone(320, 0.14);
  } else {
    score += 12;
    pendingGrowth += 1;
    playTone(460, 0.1);
  }
}

function getSpeed() {
  return speedOverride || baseSpeed;
}

function checkLevelUp() {
  if (score >= levelTarget) {
    levelIndex += 1;
    const baseLevel = LEVELS[LEVELS.length - 1];
    if (levelIndex < LEVELS.length) {
      baseSpeed = LEVELS[levelIndex].speed;
      levelTarget = LEVELS[levelIndex].target;
    } else {
      const extra = levelIndex - LEVELS.length + 1;
      baseSpeed = Math.min(13, baseLevel.speed + extra * 0.6);
      levelTarget = baseLevel.target + extra * 220;
    }
    obstacles = buildObstacles(Math.min(levelIndex + 1, 5));
    cleanupObstacles();
    spawnFood();
    playTone(720, 0.18);
    showOverlay(`Level ${levelIndex + 1}`, "The arena shifts. Stay sharp.", false);
    setTimeout(() => {
      if (running && !paused) {
        hideOverlay();
      }
    }, 700);
  }
}

function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

function setDirection(x, y) {
  const proposed = { x, y };
  if (isOpposite(proposed, direction)) {
    return;
  }
  nextDirection = proposed;
  if (!running) {
    startGame();
  }
}

function step() {
  direction = nextDirection;
  const head = snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (newHead.x < 0 || newHead.y < 0 || newHead.x >= cols || newHead.y >= rows) {
    endGame();
    return;
  }

  const headKey = `${newHead.x},${newHead.y}`;
  if (obstacles.has(headKey)) {
    endGame();
    return;
  }

  if (snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
    endGame();
    return;
  }

  snake.unshift(newHead);

  if (food && newHead.x === food.x && newHead.y === food.y) {
    applyFoodEffect();
    spawnFood();
    checkLevelUp();
  } else if (pendingGrowth > 0) {
    pendingGrowth -= 1;
  } else {
    snake.pop();
  }

  if (speedSteps > 0) {
    speedSteps -= 1;
    if (speedSteps === 0) {
      speedOverride = null;
    }
  }

  updateUI();
}

function drawGrid() {
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(offsetX, offsetY, cols * cell, rows * cell);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x += 2) {
    ctx.beginPath();
    ctx.moveTo(offsetX + x * cell, offsetY);
    ctx.lineTo(offsetX + x * cell, offsetY + rows * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y += 2) {
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + y * cell);
    ctx.lineTo(offsetX + cols * cell, offsetY + y * cell);
    ctx.stroke();
  }
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawObstacles() {
  ctx.fillStyle = COLORS.obstacle;
  obstacles.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const px = offsetX + x * cell + cell * 0.12;
    const py = offsetY + y * cell + cell * 0.12;
    const size = cell * 0.76;
    roundedRect(px, py, size, size, cell * 0.2);
    ctx.fill();
  });
}

function drawFood() {
  if (!food) return;
  let color = COLORS.food;
  if (foodType === "boost") color = COLORS.boost;
  if (foodType === "slow") color = COLORS.slow;

  const cx = offsetX + food.x * cell + cell / 2;
  const cy = offsetY + food.y * cell + cell / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnake() {
  snake.forEach((seg, index) => {
    const px = offsetX + seg.x * cell + cell * 0.1;
    const py = offsetY + seg.y * cell + cell * 0.1;
    const size = cell * 0.8;
    if (index === 0) {
      ctx.fillStyle = COLORS.head;
      ctx.shadowColor = COLORS.head;
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = COLORS.snake;
      ctx.shadowBlur = 0;
    }
    roundedRect(px, py, size, size, cell * 0.28);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawObstacles();
  drawFood();
  drawSnake();
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (running && !paused) {
    accumulator += delta;
    const interval = 1 / getSpeed();
    while (accumulator >= interval) {
      step();
      accumulator -= interval;
    }
  }

  render();
  requestAnimationFrame(loop);
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") setDirection(0, -1);
  if (key === "arrowdown" || key === "s") setDirection(0, 1);
  if (key === "arrowleft" || key === "a") setDirection(-1, 0);
  if (key === "arrowright" || key === "d") setDirection(1, 0);
  if (key === " ") pauseGame();
}

function handleTouchStart(event) {
  const touch = event.touches[0];
  if (!touch) return;
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const threshold = 28;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
    setDirection(dx > 0 ? 1 : -1, 0);
  } else if (Math.abs(dy) > threshold) {
    setDirection(0, dy > 0 ? 1 : -1);
  }
  touchStart = null;
}

function playTone(freq, duration) {
  if (!audioEnabled) return;
  if (!audioCtx) audioCtx = new AudioContext();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.frequency.value = freq;
  oscillator.type = "sine";
  gain.gain.value = 0.08;
  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

soundToggle.addEventListener("click", () => {
  audioEnabled = !audioEnabled;
  soundToggle.textContent = audioEnabled ? "Sound: On" : "Sound: Off";
  if (audioEnabled && !audioCtx) {
    audioCtx = new AudioContext();
  }
});

startBtn.addEventListener("click", startGame);
overlayBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", pauseGame);
restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});

document.querySelectorAll(".dpad-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const dir = btn.dataset.dir;
    if (dir === "up") setDirection(0, -1);
    if (dir === "down") setDirection(0, 1);
    if (dir === "left") setDirection(-1, 0);
    if (dir === "right") setDirection(1, 0);
  });
});

canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
canvas.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

window.addEventListener("keydown", handleKey);
window.addEventListener("resize", () => {
  resizeBoard();
  resetGame();
});

levelLadder.addEventListener("click", (event) => {
  const item = event.target.closest(".ladder-item");
  if (!item) return;
  const level = Number(item.dataset.level || 1);
  levelIndex = Math.max(0, level - 1);
  baseSpeed = LEVELS[levelIndex].speed;
  levelTarget = LEVELS[levelIndex].target;
  obstacles = buildObstacles(level);
  cleanupObstacles();
  spawnFood();
  updateUI();
});

function init() {
  bestValue.textContent = bestScore;
  resizeBoard();
  resetGame();
  requestAnimationFrame(loop);
}

init();
