/* ==========================================================================
   Photobooth Studio — Architecture & Interactive Logic
   ========================================================================== */

(() => {
  "use strict";

  const TOTAL_SHOTS = 3;
  const COUNTDOWN_SECONDS = 3;

  const FILTER_CSS = {
    none: "none",
    bw: "grayscale(1) contrast(1.1)",
    sepia: "sepia(0.8) saturate(1.2) contrast(1.05)",
    vintage: "sepia(0.4) saturate(1.3) contrast(1.15) brightness(1.05) hue-rotate(-10deg)",
    cool: "saturate(1.1) contrast(1.05) hue-rotate(140deg) brightness(1.02)",
  };

  const FILTER_CLASS = {
    none: "",
    bw: "f-bw",
    sepia: "f-sepia",
    vintage: "f-vintage",
    cool: "f-cool",
  };

  const landingView = document.getElementById("landingView");
  const boothView = document.getElementById("boothView");
  const curtainOverlay = document.getElementById("curtainOverlay");

  const enterBoothBtn = document.getElementById("enterBoothBtn");
  const exitBoothBtn = document.getElementById("exitBoothBtn");

  const video = document.getElementById("video");
  const captureCanvas = document.getElementById("captureCanvas");
  const stripCanvas = document.getElementById("stripCanvas");
  const stripEmpty = document.getElementById("stripEmpty");

  const startBtn = document.getElementById("startBtn");
  const cameraMessage = document.getElementById("cameraMessage");
  const cameraMessageText = document.getElementById("cameraMessageText");
  const shutterBtn = document.getElementById("shutterBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const retakeBtn = document.getElementById("retakeBtn");
  const countdownEl = document.getElementById("countdown");
  const flashEl = document.getElementById("flash");
  const hintEl = document.getElementById("hint");

  const filterButtons = Array.from(document.querySelectorAll(".filter"));
  const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
  const shotSlots = Array.from(document.querySelectorAll(".shot-slot"));

  let currentStream = null;
  let currentFilter = "none";
  let currentStripBg = "#f8f7f3";
  let isCapturing = false;
  let shots = [];

  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playBeep(frequency = 440, duration = 0.1) {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playShutterSound() {
    try {
      initAudio();
      const bufferSize = audioCtx.sampleRate * 0.08;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      whiteNoise.connect(gain);
      gain.connect(audioCtx.destination);
      whiteNoise.start();
    } catch (e) {}
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function enterBooth() {
    initAudio();
    curtainOverlay.classList.add("is-closing");
    await wait(900);
    landingView.classList.add("is-hidden");
    boothView.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    curtainOverlay.classList.remove("is-closing");
    startCamera();
  }

  async function exitBooth() {
    stopCamera();
    curtainOverlay.classList.add("is-closing");
    await wait(900);
    boothView.classList.add("is-hidden");
    landingView.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    curtainOverlay.classList.remove("is-closing");
  }

  enterBoothBtn.addEventListener("click", enterBooth);
  exitBoothBtn.addEventListener("click", exitBooth);

  async function startCamera() {
    startBtn.disabled = true;
    startBtn.textContent = "Opening Camera…";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      currentStream = stream;
      video.srcObject = stream;
      await video.play();
      cameraMessage.classList.add("is-hidden");
      shutterBtn.disabled = false;
      hintEl.textContent = "Click the red button to take 3 consecutive photos.";
    } catch (err) {
      console.error("Gagal membuka kamera:", err);
      startBtn.disabled = false;
      startBtn.textContent = "Try Again";
      cameraMessageText.textContent = err && err.name === "NotAllowedError"
        ? "Camera permission denied. Please grant permission in your browser settings."
        : "Camera not found or currently in use by another application.";
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      currentStream = null;
    }
    cameraMessage.classList.remove("is-hidden");
    shutterBtn.disabled = true;
  }

  startBtn.addEventListener("click", startCamera);

  function setFilter(name) {
    currentFilter = name;
    Object.values(FILTER_CLASS).forEach((cls) => {
      if (cls) video.classList.remove(cls);
    });
    if (FILTER_CLASS[name]) video.classList.add(FILTER_CLASS[name]);
    filterButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.filter === name));
    });
    if (shots.length === TOTAL_SHOTS) rebuildShotsWithFilter();
  }

  filterButtons.forEach((btn) => btn.addEventListener("click", () => setFilter(btn.dataset.filter)));

  colorButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      colorButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentStripBg = btn.dataset.color;
      if (shots.length === TOTAL_SHOTS) buildStrip(shots);
    });
  });

  async function runCountdown() {
    for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
      countdownEl.textContent = String(n);
      playBeep(520, 0.08);
      countdownEl.classList.remove("is-active");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("is-active");
      await wait(1000);
    }
    countdownEl.textContent = "";
  }

  function flash() {
    playShutterSound();
    flashEl.classList.remove("is-flashing");
    void flashEl.offsetWidth;
    flashEl.classList.add("is-flashing");
  }

  function grabFrame() {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    captureCanvas.width = w; captureCanvas.height = h;
    const ctx = captureCanvas.getContext("2d");
    ctx.save();
    ctx.filter = FILTER_CSS[currentFilter] || "none";
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    const shotCanvas = document.createElement("canvas");
    shotCanvas.width = w; shotCanvas.height = h;
    shotCanvas.getContext("2d").drawImage(captureCanvas, 0, 0);
    return shotCanvas;
  }

  function updateSlotThumbnail(index, canvas) {
    const slot = shotSlots[index];
    if (!slot) return;
    if (canvas) {
      slot.style.backgroundImage = `url(${canvas.toDataURL("image/jpeg", 0.8)})`;
      slot.classList.add("has-image"); slot.classList.remove("is-active");
    } else {
      slot.style.backgroundImage = "none";
      slot.classList.remove("has-image", "is-active");
    }
  }

  function resetSlots() { shotSlots.forEach((_, i) => updateSlotThumbnail(i, null)); }

  async function startCaptureSequence() {
    if (isCapturing) return;
    isCapturing = true;
    shots = []; resetSlots();
    shutterBtn.disabled = true; downloadBtn.disabled = true; retakeBtn.disabled = true;

    for (let i = 0; i < TOTAL_SHOTS; i++) {
      shotSlots[i].classList.add("is-active");
      hintEl.textContent = `Foto ${i + 1} dari ${TOTAL_SHOTS} — Bersiap!`;
      await runCountdown();
      flash();
      const capturedCanvas = grabFrame();
      shots.push(capturedCanvas);
      updateSlotThumbnail(i, capturedCanvas);
      await wait(500);
    }
    hintEl.textContent = "Finished! Assembling photo strip...";
    buildStrip(shots);
    isCapturing = false; shutterBtn.disabled = false; downloadBtn.disabled = false; retakeBtn.disabled = false;
    hintEl.textContent = "Like your results? Download your photo strip or retake photos.";
  }

  shutterBtn.addEventListener("click", startCaptureSequence);

  function rebuildShotsWithFilter() {
    if (!shots.length) return;
    shots = shots.map((oldCanvas) => {
      const w = oldCanvas.width; const h = oldCanvas.height;
      captureCanvas.width = w; captureCanvas.height = h;
      const ctx = captureCanvas.getContext("2d");
      ctx.save();
      ctx.filter = FILTER_CSS[currentFilter] || "none";
      ctx.drawImage(oldCanvas, 0, 0, w, h);
      ctx.restore();
      const newCanvas = document.createElement("canvas");
      newCanvas.width = w; newCanvas.height = h;
      newCanvas.getContext("2d").drawImage(captureCanvas, 0, 0);
      return newCanvas;
    });
    buildStrip(shots);
  }

  function buildStrip(photoCanvases) {
    if (!photoCanvases || photoCanvases.length === 0) return;
    const PADDING = 28; const GAP = 20; const CAPTION_HEIGHT = 80; const PHOTO_W = 500;
    const photoRatio = photoCanvases[0].height / photoCanvases[0].width;
    const PHOTO_H = Math.round(PHOTO_W * photoRatio);
    const stripW = PHOTO_W + PADDING * 2;
    const stripH = PADDING * 2 + PHOTO_H * photoCanvases.length + GAP * (photoCanvases.length - 1) + CAPTION_HEIGHT;
    
    stripCanvas.width = stripW; stripCanvas.height = stripH;
    const ctx = stripCanvas.getContext("2d");
    
    ctx.fillStyle = currentStripBg; ctx.fillRect(0, 0, stripW, stripH);
    const isDarkBg = currentStripBg === "#2b2b2b";
    const textColor = isDarkBg ? "#f8f7f3" : "#2b2b2b";
    const textSubColor = isDarkBg ? "rgba(248, 247, 243, 0.6)" : "rgba(43, 43, 43, 0.6)";

    photoCanvases.forEach((canvas, i) => {
      const y = PADDING + i * (PHOTO_H + GAP);
      ctx.shadowColor = "rgba(0, 0, 0, 0.08)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      ctx.drawImage(canvas, PADDING, y, PHOTO_W, PHOTO_H);
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = isDarkBg ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2; ctx.strokeRect(PADDING, y, PHOTO_W, PHOTO_H);
    });

    ctx.fillStyle = isDarkBg ? "#1a1a1a" : "#e2e8f0";
    for (let y = 18; y < stripH - CAPTION_HEIGHT; y += 28) {
      ctx.beginPath(); ctx.arc(12, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(stripW - 12, y, 5, 0, Math.PI * 2); ctx.fill();
    }

    const dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    ctx.fillStyle = textColor; ctx.textAlign = "center";
    ctx.font = "700 26px 'Fraunces', Georgia, serif";
    ctx.fillText("PHOTOBOOTH STUDIO", stripW / 2, stripH - CAPTION_HEIGHT + 36);
    ctx.font = "500 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = textSubColor;
    ctx.fillText(`• ${dateStr} •`, stripW / 2, stripH - CAPTION_HEIGHT + 60);

    stripEmpty.classList.add("is-hidden"); stripCanvas.classList.remove("is-hidden");
  }

  downloadBtn.addEventListener("click", () => {
    if (!shots.length) return;
    const link = document.createElement("a");
    link.download = `photobooth-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    link.href = stripCanvas.toDataURL("image/png", 1.0);
    link.click();
  });

  retakeBtn.addEventListener("click", () => {
    shots = []; resetSlots();
    stripCanvas.classList.add("is-hidden"); stripEmpty.classList.remove("is-hidden");
    downloadBtn.disabled = true; retakeBtn.disabled = true;
    hintEl.textContent = "Click the red button to take 3 consecutive photos.";
  });

  window.addEventListener("beforeunload", stopCamera);
})();