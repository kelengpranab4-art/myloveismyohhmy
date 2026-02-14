const startCameraBtn = document.getElementById("startCamera");
const captureBtn = document.getElementById("captureBtn");
const stopCameraBtn = document.getElementById("stopCamera");
const cameraVideo = document.getElementById("cameraVideo");
const cameraStatus = document.getElementById("cameraStatus");
const galleryGrid = document.getElementById("galleryGrid");
const photoCount = document.getElementById("photoCount");
const previewFrame = document.getElementById("previewFrame");
const previewList = document.getElementById("previewList");
const heartFrame = document.getElementById("heartFrame");
const filterBar = document.getElementById("filterBar");
const intro = document.getElementById("intro");
const burstField = document.getElementById("burstField");
const enterBtn = document.getElementById("enterBtn");

const heartField = document.getElementById("heartField");
const scrollButtons = document.querySelectorAll("[data-scroll]");

let stream = null;
let savedPhotos = 0;
let currentFilter = "original";
let introTimer = null;
let introFinished = false;
let introBurstInterval = null;

const filterSettings = {
  original: {
    css: "none",
    overlay: null,
    heartColor: "rgba(255, 155, 185, 0.3)",
  },
  rosy: {
    css: "saturate(1.15) brightness(1.05) contrast(1.05) hue-rotate(-6deg)",
    overlay: ["rgba(255, 170, 200, 0.35)", "rgba(255, 240, 245, 0.2)"],
    heartColor: "rgba(255, 120, 160, 0.35)",
  },
  blush: {
    css: "sepia(0.12) saturate(1.25) brightness(1.06)",
    overlay: ["rgba(255, 200, 210, 0.35)", "rgba(255, 245, 250, 0.2)"],
    heartColor: "rgba(255, 150, 180, 0.35)",
  },
  candy: {
    css: "saturate(1.35) hue-rotate(8deg) brightness(1.05)",
    overlay: ["rgba(255, 140, 180, 0.35)", "rgba(255, 230, 240, 0.22)"],
    heartColor: "rgba(255, 110, 170, 0.35)",
  },
  cupid: {
    css: "contrast(1.1) saturate(1.1) brightness(0.98)",
    overlay: ["rgba(140, 40, 70, 0.28)", "rgba(255, 200, 215, 0.2)"],
    heartColor: "rgba(180, 60, 110, 0.35)",
  },
};

function spawnHeart(x, y) {
  const heart = document.createElement("span");
  heart.className = "floating-heart";
  const size = 12 + Math.random() * 18;
  heart.style.width = `${size}px`;
  heart.style.height = `${size}px`;
  heart.style.left = `${x}px`;
  heart.style.top = `${y}px`;
  heart.style.animationDuration = `${2.6 + Math.random() * 2}s`;
  heartField.appendChild(heart);
  setTimeout(() => heart.remove(), 4200);
}

function updatePhotoCount() {
  photoCount.textContent = `${savedPhotos} saved`;
}

function drawHeartPath(ctx, x, y, size) {
  const topCurveHeight = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + size);
  ctx.bezierCurveTo(
    x + size / 2,
    y + size - topCurveHeight,
    x,
    y + size * 0.6,
    x,
    y + size * 0.35
  );
  ctx.bezierCurveTo(x, y + size * 0.1, x + size * 0.25, y, x + size / 2, y + size * 0.25);
  ctx.bezierCurveTo(
    x + size * 0.75,
    y,
    x + size,
    y + size * 0.1,
    x + size,
    y + size * 0.35
  );
  ctx.bezierCurveTo(
    x + size,
    y + size * 0.6,
    x + size / 2,
    y + size - topCurveHeight,
    x + size / 2,
    y + size
  );
  ctx.closePath();
}

function launchBurst(count = 36) {
  if (!burstField) return;
  burstField.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement("span");
    heart.className = "burst-heart";
    const angle = Math.random() * Math.PI * 2;
    const distance = 160 + Math.random() * 220;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const scale = 0.6 + Math.random() * 1.1;
    heart.style.setProperty("--x", `${x}px`);
    heart.style.setProperty("--y", `${y}px`);
    heart.style.setProperty("--s", scale.toFixed(2));
    heart.style.setProperty("--d", `${1.6 + Math.random() * 1.2}s`);
    burstField.appendChild(heart);
    setTimeout(() => heart.remove(), 2600);
  }
}

function finishIntro() {
  if (!intro || introFinished) return;
  introFinished = true;
  intro.classList.add("out");
  document.body.classList.remove("intro-active");
  if (introBurstInterval) {
    clearInterval(introBurstInterval);
    introBurstInterval = null;
  }
  setTimeout(() => intro.remove(), 1000);
}

function startIntro() {
  if (!intro) return;
  document.body.classList.add("intro-active");
  launchBurst();
  if (introBurstInterval) clearInterval(introBurstInterval);
  introBurstInterval = setInterval(() => {
    if (introFinished) return;
    launchBurst(22 + Math.floor(Math.random() * 10));
  }, 900);
  if (introTimer) clearTimeout(introTimer);
  introTimer = setTimeout(() => finishIntro(), 6800);
}

function applyFilterToVideo() {
  const filter = filterSettings[currentFilter];
  cameraVideo.style.filter = filter?.css || "none";
  if (heartFrame) {
    heartFrame.dataset.filter = currentFilter;
  }
}

function drawBokehHearts(ctx, size, color) {
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const heartSize = size * (0.05 + Math.random() * 0.05);
    const x = Math.random() * (size - heartSize);
    const y = Math.random() * (size - heartSize);
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.random() * 0.2;
    ctx.fillStyle = color;
    drawHeartPath(ctx, x, y, heartSize);
    ctx.fill();
    ctx.restore();
  }
}

function applyFilterOverlay(ctx, size) {
  const filter = filterSettings[currentFilter];
  if (!filter?.overlay) return;
  const [light, dark] = filter.overlay;
  const gradient = ctx.createRadialGradient(size * 0.3, size * 0.25, size * 0.2, size * 0.6, size * 0.6, size);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, dark);
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  drawBokehHearts(ctx, size, filter.heartColor);
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Camera access is not supported in this browser.";
    return;
  }
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    applyFilterToVideo();
    cameraStatus.textContent = "Camera ready. Center in the heart and capture.";
    captureBtn.disabled = false;
    stopCameraBtn.disabled = false;
  } catch (error) {
    cameraStatus.textContent = "Camera permission denied or unavailable.";
  }
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  cameraVideo.srcObject = null;
  captureBtn.disabled = true;
  stopCameraBtn.disabled = true;
  cameraStatus.textContent = "Camera stopped.";
}

function capturePhoto() {
  if (!stream || !cameraVideo.videoWidth) {
    cameraStatus.textContent = "Start the camera before capturing.";
    return;
  }

  const canvas = document.getElementById("photoCanvas");
  const ctx = canvas.getContext("2d");
  const size = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);

  canvas.width = size;
  canvas.height = size;

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#ffe1ea");
  gradient.addColorStop(1, "#fff6f0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.filter = filterSettings[currentFilter]?.css || "none";
  drawHeartPath(ctx, 0, 0, size);
  ctx.clip();
  ctx.drawImage(
    cameraVideo,
    (cameraVideo.videoWidth - size) / 2,
    (cameraVideo.videoHeight - size) / 2,
    size,
    size,
    0,
    0,
    size,
    size
  );
  ctx.restore();

  applyFilterOverlay(ctx, size);

  ctx.save();
  drawHeartPath(ctx, 0, 0, size);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = size * 0.03;
  ctx.shadowColor = "rgba(255, 77, 109, 0.45)";
  ctx.shadowBlur = size * 0.05;
  ctx.stroke();
  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  const shot = document.createElement("div");
  shot.className = "shot";

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Heart-framed photo";

  const actions = document.createElement("div");
  actions.className = "shot-actions";
  const timeStamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const stamp = document.createElement("span");
  stamp.textContent = timeStamp;

  const download = document.createElement("a");
  download.href = dataUrl;
  download.download = `valentine-photo-${Date.now()}.png`;
  download.textContent = "Download";

  actions.append(stamp, download);
  shot.append(img, actions);

  const placeholder = galleryGrid.querySelector(".gallery-placeholder");
  if (placeholder) placeholder.remove();

  galleryGrid.prepend(shot);
  savedPhotos += 1;
  updatePhotoCount();
  cameraStatus.textContent = "Photo captured and saved below.";
}

updatePhotoCount();
applyFilterToVideo();
startIntro();

if (intro) {
  intro.addEventListener("pointerdown", (event) => {
    if (event.target.closest("#enterBtn")) return;
    launchBurst();
  });
}

if (enterBtn) {
  enterBtn.addEventListener("click", () => {
    finishIntro();
  });
}

if (previewList && previewFrame) {
  previewList.addEventListener("click", (event) => {
    const button = event.target.closest(".preview-btn");
    if (!button) return;
    const embed = button.dataset.embed;
    if (!embed) return;
    previewFrame.src = embed;
    previewList.querySelectorAll(".preview-btn").forEach((btn) => {
      btn.classList.toggle("active", btn === button);
      btn.setAttribute("aria-pressed", btn === button ? "true" : "false");
    });
  });
}

if (filterBar) {
  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return;
    const filterId = button.dataset.filter;
    if (!filterSettings[filterId]) return;
    currentFilter = filterId;
    filterBar.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn === button);
      btn.setAttribute("aria-pressed", btn === button ? "true" : "false");
    });
    applyFilterToVideo();
  });
}

scrollButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.scroll);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.addEventListener("pointerdown", (event) => {
  spawnHeart(event.clientX, event.clientY);
});

setInterval(() => {
  const x = Math.random() * window.innerWidth;
  const y = window.innerHeight - 20 - Math.random() * 120;
  spawnHeart(x, y);
}, 1200);

startCameraBtn.addEventListener("click", startCamera);
stopCameraBtn.addEventListener("click", stopCamera);
captureBtn.addEventListener("click", capturePhoto);

window.addEventListener("beforeunload", () => {
  stopCamera();
});
