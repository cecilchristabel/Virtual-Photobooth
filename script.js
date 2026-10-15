/* ==========================================================================
   Photobooth Studio — Architecture & Interactive Logic
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     Logic APP
     --------------------------------------------------------------------- */
  const TOTAL_SHOTS = 3;

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

  /* ---------------------------------------------------------------------
     Elemen HTML
     --------------------------------------------------------------------- */
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
  const countdownSelect = document.getElementById("countdownSelect");
  const captionInput = document.getElementById("stripCaption");
  const showDateInput = document.getElementById("showDate");
  const customFrameColor = document.getElementById("customFrameColor");
  const stripPaper = document.getElementById("stripPaper");
  const flashEl = document.getElementById("flash");
  const hintEl = document.getElementById("hint");

  const filterButtons = Array.from(document.querySelectorAll(".filter"));
  const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
  const shotSlots = Array.from(document.querySelectorAll(".shot-slot"));

  /* ---------------------------------------------------------------------
     State App
     --------------------------------------------------------------------- */
  let currentStream = null;
  let currentFilter = "none";
  let currentStripBg = "#fdf6ec";
  let isCapturing = false;
  let shots = [];
  let captureDate = null;
  let captureSession = 0; // Batalkan countdown bila pengguna keluar dari bilik.
  let cameraRequestId = 0;

  /* ---------------------------------------------------------------------
     Synthesizer Audio (Suara Beep, Shutter & Tirai)
     --------------------------------------------------------------------- */
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

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* =======================================================================
     1. Transisi "Masuk & Keluar Bilik Foto" (Curtain Transition)
     ======================================================================= */
  async function enterBooth() {
    initAudio();

    // 1. Tutup Tirai Merah
    curtainOverlay.classList.add("is-closing");
    await wait(900);

    // 2. Ganti Viewport
    landingView.classList.add("is-hidden");
    boothView.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "instant" });

    // 3. Buka Tirai Kembali
    curtainOverlay.classList.remove("is-closing");

    // Otomatis Coba Nyalakan Kamera
    startCamera();
  }

  async function exitBooth() {
    // Stop Kamera saat keluar
    stopCamera();

    // 1. Tutup Tirai Merah
    curtainOverlay.classList.add("is-closing");
    await wait(900);

    // 2. Ganti Viewport ke Landing
    boothView.classList.add("is-hidden");
    landingView.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "instant" });

    // 3. Buka Tirai Kembali
    curtainOverlay.classList.remove("is-closing");
  }

  enterBoothBtn.addEventListener("click", enterBooth);
  exitBoothBtn.addEventListener("click", exitBooth);

  /* =======================================================================
     2. Kontrol Kamera
     ======================================================================= */
  async function startCamera() {
    startBtn.disabled = true;
    startBtn.textContent = "Opening Camera…";

    const requestId = ++cameraRequestId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });

      // Cegah kamera menyala setelah pengguna menekan Exit ketika izin sedang diproses.
      if (requestId !== cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      currentStream = stream;
      video.srcObject = stream;
      await video.play();
      if (requestId !== cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraMessage.classList.add("is-hidden");
      shutterBtn.disabled = false;
      updateCountdownHint();
    } catch (err) {
      console.error("Gagal membuka kamera:", err);
      startBtn.disabled = false;
      startBtn.textContent = "Try Again";

      const reason = err && err.name === "NotAllowedError"
        ? "Camera permission denied. Please grant permission in your browser settings."
        : "Camera not found or currently in use by another application.";

      cameraMessageText.textContent = reason;
    }
  }

  function stopCamera() {
    cameraRequestId++;
    captureSession++;
    isCapturing = false;
    countdownSelect.disabled = false;
    countdownEl.textContent = "";
    countdownEl.classList.remove("is-active");
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      currentStream = null;
    }
    video.srcObject = null;
    cameraMessageText.textContent = "Camera is not active. Click the button below to activate it.";
    startBtn.disabled = false;
    startBtn.textContent = "Activate Camera";
    cameraMessage.classList.remove("is-hidden");
    shutterBtn.disabled = true;
  }

  startBtn.addEventListener("click", startCamera);

  /* =======================================================================
     3. Filter & Warna Frame
     ======================================================================= */
  function setFilter(name) {
    currentFilter = name;

    Object.values(FILTER_CLASS).forEach((cls) => {
      if (cls) video.classList.remove(cls);
    });
    if (FILTER_CLASS[name]) video.classList.add(FILTER_CLASS[name]);

    filterButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.filter === name));
    });

    if (shots.length === TOTAL_SHOTS) {
      rebuildShotsWithFilter();
    }
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });

  function setFrameColor(color, presetButton = null) {
    currentStripBg = color;
    // Beri tanda pada tombol pilihan dan update preview.
    colorButtons.forEach((button) => {
      const active = button === presetButton;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    customFrameColor.parentElement.classList.toggle("is-active", !presetButton);
    customFrameColor.value = color;
    stripPaper.style.borderColor = color;
    if (shots.length === TOTAL_SHOTS) buildStrip(shots);
  }

  colorButtons.forEach((btn) => {
    btn.addEventListener("click", () => setFrameColor(btn.dataset.color, btn));
  });
  customFrameColor.addEventListener("input", () => setFrameColor(customFrameColor.value));

  // Perubahan caption / tanggal juga langsung diterapkan pada preview dan PNG.
  function refreshStrip() {
    if (shots.length === TOTAL_SHOTS) buildStrip(shots);
  }
  captionInput.addEventListener("input", refreshStrip);
  showDateInput.addEventListener("change", refreshStrip);

  function updateCountdownHint() {
    if (!isCapturing && currentStream && shots.length !== TOTAL_SHOTS) {
      hintEl.textContent = `Press the red button to take 3 photos (${countdownSelect.value}s each).`;
    }
  }
  countdownSelect.addEventListener("change", updateCountdownHint);
  setFrameColor(currentStripBg, colorButtons[0]);

  /* =======================================================================
     4. Pengambilan Foto
     ======================================================================= */
  async function runCountdown(seconds, token) {
    for (let n = seconds; n >= 1; n--) {
      if (captureSession !== token) return false;
      countdownEl.textContent = String(n);
      playBeep(520, 0.08);

      countdownEl.classList.remove("is-active");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("is-active");

      await wait(1000);
    }
    countdownEl.textContent = "";
    countdownEl.classList.remove("is-active");
    return captureSession === token;
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

    captureCanvas.width = w;
    captureCanvas.height = h;

    const ctx = captureCanvas.getContext("2d");
    ctx.save();
    ctx.filter = FILTER_CSS[currentFilter] || "none";
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const shotCanvas = document.createElement("canvas");
    shotCanvas.width = w;
    shotCanvas.height = h;
    shotCanvas.getContext("2d").drawImage(captureCanvas, 0, 0);

    return shotCanvas;
  }

  function updateSlotThumbnail(index, canvas) {
    const slot = shotSlots[index];
    if (!slot) return;

    if (canvas) {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      slot.style.backgroundImage = `url(${dataUrl})`;
      slot.classList.add("has-image");
      slot.classList.remove("is-active");
    } else {
      slot.style.backgroundImage = "none";
      slot.classList.remove("has-image", "is-active");
    }
  }

  function resetSlots() {
    shotSlots.forEach((_, i) => updateSlotThumbnail(i, null));
  }

  async function startCaptureSequence() {
    if (isCapturing || !currentStream || video.readyState < 2) return;
    isCapturing = true;
    const token = ++captureSession;
    const seconds = Number(countdownSelect.value); // Simpan pilihan selama 1 sesi.
    countdownSelect.disabled = true;
    captureDate = new Date();

    shots = [];
    resetSlots();

    shutterBtn.disabled = true;
    downloadBtn.disabled = true;
    retakeBtn.disabled = true;

    for (let i = 0; i < TOTAL_SHOTS; i++) {
      shotSlots[i].classList.add("is-active");
      hintEl.textContent = `Foto ${i + 1} dari ${TOTAL_SHOTS} — Bersiap!`;
      
      const completed = await runCountdown(seconds, token);
      if (!completed || !currentStream) return;

      flash();
      const capturedCanvas = grabFrame();
      shots.push(capturedCanvas);

      updateSlotThumbnail(i, capturedCanvas);

      await wait(500);
      if (captureSession !== token) return;
    }

    hintEl.textContent = "Finished! Assembling photo strip...";
    buildStrip(shots);

    isCapturing = false;
    countdownSelect.disabled = false;
    shutterBtn.disabled = false;
    downloadBtn.disabled = false;
    retakeBtn.disabled = false;
    hintEl.textContent = "Like your results? Download your photo strip or retake photos.";
  }

  shutterBtn.addEventListener("click", startCaptureSequence);

  /* =======================================================================
     5. Render Canvas Strip Foto
     ======================================================================= */
  function rebuildShotsWithFilter() {
    if (!shots.length) return;

    shots = shots.map((oldCanvas) => {
      const w = oldCanvas.width;
      const h = oldCanvas.height;

      captureCanvas.width = w;
      captureCanvas.height = h;

      const ctx = captureCanvas.getContext("2d");
      ctx.save();
      ctx.filter = FILTER_CSS[currentFilter] || "none";
      ctx.drawImage(oldCanvas, 0, 0, w, h);
      ctx.restore();

      const newCanvas = document.createElement("canvas");
      newCanvas.width = w;
      newCanvas.height = h;
      newCanvas.getContext("2d").drawImage(captureCanvas, 0, 0);
      return newCanvas;
    });

    buildStrip(shots);
  }

  function buildStrip(photoCanvases) {
    if (!photoCanvases || photoCanvases.length === 0) return;

    const PADDING = 28;
    const GAP = 20;
    const CAPTION_HEIGHT = 80;
    const PHOTO_W = 500;
    
    const photoRatio = photoCanvases[0].height / photoCanvases[0].width;
    const PHOTO_H = Math.round(PHOTO_W * photoRatio);

    const stripW = PHOTO_W + PADDING * 2;
    const stripH = PADDING * 2 + PHOTO_H * photoCanvases.length + GAP * (photoCanvases.length - 1) + CAPTION_HEIGHT;

    stripCanvas.width = stripW;
    stripCanvas.height = stripH;
    const ctx = stripCanvas.getContext("2d");

    // Latar Bingkai
    ctx.fillStyle = currentStripBg;
    ctx.fillRect(0, 0, stripW, stripH);

    // Untuk frame warna kustom, pilih warna teks yang kontras secara otomatis.
    const rgb = currentStripBg.match(/[a-f0-9]{2}/gi).map((v) => parseInt(v, 16));
    const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    const isDarkBg = brightness < 140;
    const textColor = isDarkBg ? "#fdf6ec" : "#1f1b24";
    const textSubColor = isDarkBg ? "rgba(253, 246, 236, 0.75)" : "rgba(31, 27, 36, 0.7)";

    // Render Foto
    photoCanvases.forEach((canvas, i) => {
      const y = PADDING + i * (PHOTO_H + GAP);

      ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      ctx.drawImage(canvas, PADDING, y, PHOTO_W, PHOTO_H);

      ctx.shadowColor = "transparent";
      ctx.strokeStyle = isDarkBg ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(PADDING, y, PHOTO_W, PHOTO_H);
    });

    // Lubang di frame (Hole Punch)
    ctx.fillStyle = isDarkBg ? "#120f16" : "#2a2431";
    const holeRadius = 5;
    const holeGapY = 28;
    for (let y = 18; y < stripH - CAPTION_HEIGHT; y += holeGapY) {
      ctx.beginPath();
      ctx.arc(12, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(stripW - 12, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Caption pengguna dan tanggal pemotretan (jika dipilih).
    // maxWidth mencegah teks meluber keluar frame.
    const userCaption = captionInput.value.trim() || "PHOTOBOOTH STUDIO";
    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.font = "700 26px 'Fraunces', Georgia, serif";
    ctx.fillText(userCaption, stripW / 2, stripH - CAPTION_HEIGHT + (showDateInput.checked ? 36 : 48), stripW - 64);

    if (showDateInput.checked) {
      const dateStr = (captureDate || new Date()).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      ctx.font = "500 15px 'Space Grotesk', sans-serif";
      ctx.fillStyle = textSubColor;
      ctx.fillText(`• ${dateStr} •`, stripW / 2, stripH - CAPTION_HEIGHT + 60);
    }

    stripEmpty.classList.add("is-hidden");
    stripCanvas.classList.remove("is-hidden");
  }

  /* =======================================================================
     6. Download & Retake
     ======================================================================= */
  downloadBtn.addEventListener("click", () => {
    if (!shots.length) return;

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.download = `photobooth-${timestamp}.png`;
    link.href = stripCanvas.toDataURL("image/png", 1.0);
    link.click();
  });

  retakeBtn.addEventListener("click", () => {
    shots = [];
    captureDate = null;
    resetSlots();

    stripCanvas.classList.add("is-hidden");
    stripEmpty.classList.remove("is-hidden");

    downloadBtn.disabled = true;
    retakeBtn.disabled = true;
    updateCountdownHint();
  });

  window.addEventListener("beforeunload", () => {
    stopCamera();
  });
})();