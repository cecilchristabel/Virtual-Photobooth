
(() => {
  "use strict";

  const TOTAL_SHOTS = 3;
  const DEFAULT_COUNTDOWN = 3;

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

  const enterBoothBtn = document.getElementById("landingStartBtn")
    || document.getElementById("enterBoothBtn");
  const exitBoothBtn = document.getElementById("exitBoothBtn");

  const video = document.getElementById("video");
  const captureCanvas = document.getElementById("captureCanvas");
  const stripCanvas = document.getElementById("stripCanvas");
  const stripEmpty = document.getElementById("stripEmpty");
  const stripPaper = document.getElementById("stripPaper");

  const startBtn = document.getElementById("startBtn");
  const cameraMessage = document.getElementById("cameraMessage");
  const cameraMessageText = document.getElementById("cameraMessageText");
  const shutterBtn = document.getElementById("shutterBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const retakeBtn = document.getElementById("retakeBtn");
  const buildStripBtn = document.getElementById("buildStripBtn");

  const autoCaptureBtn = document.getElementById("autoCaptureBtn");
  const captureMode = document.getElementById("captureMode");

  const countdownEl = document.getElementById("countdown");
  const countdownSelect = document.getElementById("countdownSelect");
  const captionInput = document.getElementById("stripCaption");
  const showDateInput = document.getElementById("showDate");
  const customFrameColor = document.getElementById("customFrameColor");
  const flashEl = document.getElementById("flash");
  const hintEl = document.getElementById("hint");

  const filterButtons = Array.from(document.querySelectorAll(".filter"));
  const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
  const shotSlots = Array.from(document.querySelectorAll(".shot-slot"));
  const removeButtons = Array.from(document.querySelectorAll(".remove-shot-btn"));
  const viewButtons = Array.from(document.querySelectorAll(".view-shot-btn"));

  const photoModal = document.getElementById("photoModal");
  const modalImage = document.getElementById("modalImage");
  const closeModalBtn = document.getElementById("closeModalBtn");

  const uploadBtn = document.getElementById("uploadBtn");
  const uploadInput = document.getElementById("uploadInput");

  let currentStream = null;
  let currentStripBg = "#fdf6ec";
  let currentFilter = "none";
  let activeSlot = 0;
  let isCapturing = false;

  let shots = Array(TOTAL_SHOTS).fill(null);
  let originalShots = Array(TOTAL_SHOTS).fill(null);
  let slotFilters = Array(TOTAL_SHOTS).fill("none");

  let captureDate = null;
  let captureSession = 0;
  let cameraRequestId = 0;
  let audioCtx = null;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isStripReady() {
    return shots.every((shot) => shot !== null);
  }

  function isStripVisible() {
    return !stripCanvas.classList.contains("is-hidden");
  }

  function getCountdownSeconds() {
    const n = Number(countdownSelect?.value);

    return Number.isFinite(n) && n >= 1
      ? Math.min(n, 30)
      : DEFAULT_COUNTDOWN;
  }

  function initAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  function playBeep(frequency = 440, duration = 0.1) {
    try {
      initAudio();

      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        audioCtx.currentTime + duration
      );

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);

    } catch (err) {
      console.warn("Beep unavailable:", err);
    }
  }

  function playShutterSound() {
    try {
      initAudio();

      if (!audioCtx) return;

      const buffer = audioCtx.createBuffer(
        1,
        Math.ceil(audioCtx.sampleRate * 0.08),
        audioCtx.sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();

      source.buffer = buffer;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        audioCtx.currentTime + 0.08
      );

      source.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();

    } catch (err) {
      console.warn("Shutter audio unavailable:", err);
    }
  }

  async function enterBooth() {
    initAudio();

    curtainOverlay?.classList.add("is-closing");
    await wait(900);

    landingView?.classList.add("is-hidden");
    boothView?.classList.remove("is-hidden");

    document.body.classList.remove("on-landing");
    window.scrollTo({ top: 0, behavior: "instant" });

    curtainOverlay?.classList.remove("is-closing");
    startCamera();
  }

  async function exitBooth() {
    stopCamera();

    curtainOverlay?.classList.add("is-closing");
    await wait(900);

    boothView?.classList.add("is-hidden");
    landingView?.classList.remove("is-hidden");

    document.body.classList.add("on-landing");
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("scroll"));

    curtainOverlay?.classList.remove("is-closing");
  }

  enterBoothBtn?.addEventListener("click", enterBooth);
  exitBoothBtn?.addEventListener("click", exitBooth);

  async function startCamera() {
    if (currentStream) return;

    const id = ++cameraRequestId;

    startBtn.disabled = true;
    startBtn.textContent = "Opening Camera…";

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false,
      });

      if (id !== cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      currentStream = stream;
      video.srcObject = stream;
      await video.play();

      if (id !== cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraMessage?.classList.add("is-hidden");
      checkCameraState();

    } catch (err) {
      if (id !== cameraRequestId) return;

      console.error("Failed to open camera:", err);

      startBtn.disabled = false;
      startBtn.textContent = "Try Again";

      if (cameraMessageText) {
        cameraMessageText.textContent = err?.name === "NotAllowedError"
          ? "Camera permission denied. Please grant permission in your browser settings."
          : "Camera unavailable. Use localhost/HTTPS and check camera permissions.";
      }

      cameraMessage?.classList.remove("is-hidden");
    }
  }

  function stopCamera() {
    cameraRequestId++;
    captureSession++;
    isCapturing = false;

    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      currentStream = null;
    }

    video.srcObject = null;

    if (countdownEl) {
      countdownEl.textContent = "";
      countdownEl.classList.remove("is-active");
    }

    if (countdownSelect) {
      countdownSelect.disabled = false;
    }

    cameraMessage?.classList.remove("is-hidden");

    if (cameraMessageText) {
      cameraMessageText.textContent =
        "Camera is not active. Click below to activate it.";
    }

    startBtn.disabled = false;
    startBtn.textContent = "Activate Camera";
    shutterBtn.disabled = true;

    if (autoCaptureBtn) {
      autoCaptureBtn.disabled = true;
    }
  }

  startBtn?.addEventListener("click", startCamera);

  function updateActiveSlotUI() {
    shotSlots.forEach((slot, index) => {
      slot.classList.toggle("is-active", index === activeSlot);
    });

    filterButtons.forEach((btn) => {
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.filter === currentFilter)
      );
    });

    Object.values(FILTER_CLASS).forEach((cls) => {
      if (cls) video.classList.remove(cls);
    });

    if (FILTER_CLASS[currentFilter]) {
      video.classList.add(FILTER_CLASS[currentFilter]);
    }
  }

  function setFilter(name) {
    if (isCapturing || !(name in FILTER_CSS)) return;

    currentFilter = name;
    slotFilters[activeSlot] = name;

    updateActiveSlotUI();

    if (originalShots[activeSlot]) {
      reapplyFilterToShot(activeSlot);
    }
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setFilter(btn.dataset.filter);
    });
  });

  function setFrameColor(color, presetButton = null) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;

    currentStripBg = color;

    colorButtons.forEach((button) => {
      const active = button === presetButton;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (customFrameColor) {
      customFrameColor.value = color;
      customFrameColor.parentElement?.classList.toggle(
        "is-active",
        !presetButton
      );
    }

    if (stripPaper) {
      stripPaper.style.borderColor = color;
    }

    refreshStrip();
  }

  colorButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setFrameColor(btn.dataset.color, btn);
    });
  });

  customFrameColor?.addEventListener("input", () => {
    setFrameColor(customFrameColor.value);
  });

  function refreshStrip() {
    if (isStripReady() && isStripVisible()) {
      buildStrip();
    }
  }

  captionInput?.addEventListener("input", refreshStrip);
  showDateInput?.addEventListener("change", refreshStrip);
  countdownSelect?.addEventListener("change", checkCameraState);

  function checkCameraState() {
    const count = shots.filter(Boolean).length;
    const ready = isStripReady();

    if (buildStripBtn) {
      buildStripBtn.classList.toggle(
        "is-hidden",
        !ready || isStripVisible()
      );
    }

    shutterBtn.disabled = isCapturing || !currentStream;

    if (autoCaptureBtn) {
      autoCaptureBtn.disabled = isCapturing || !currentStream;
    }

    retakeBtn.disabled = count === 0 || isCapturing;

    if (!isCapturing && hintEl) {
      hintEl.textContent = ready
        ? `Slot ${activeSlot + 1} selected. Retake, change filter, or download the strip.`
        : `Photo ${count + 1} of ${TOTAL_SHOTS} — countdown ${getCountdownSeconds()}s.`;
    }

    if (ready && !buildStripBtn && !isStripVisible()) {
      buildStrip();
    }
  }

  function clearStrip() {
    stripCanvas.classList.add("is-hidden");
    stripEmpty?.classList.remove("is-hidden");
    downloadBtn.disabled = true;
  }

  function updateSlotThumbnail(index) {
    const slot = shotSlots[index];

    if (!slot) return;

    const canvas = shots[index];

    slot.style.backgroundImage = canvas
      ? `url(${canvas.toDataURL("image/jpeg", 0.8)})`
      : "none";

    slot.classList.toggle("has-image", Boolean(canvas));
  }

  function resetSlots() {
    captureSession++;

    shots = Array(TOTAL_SHOTS).fill(null);
    originalShots = Array(TOTAL_SHOTS).fill(null);
    slotFilters = Array(TOTAL_SHOTS).fill("none");

    activeSlot = 0;
    currentFilter = "none";
    captureDate = null;

    shotSlots.forEach((_, index) => {
      updateSlotThumbnail(index);
    });

    clearStrip();
    updateActiveSlotUI();
    checkCameraState();
  }

  function getNextAvailableSlot() {
    return shots.findIndex((shot) => shot === null);
  }

  function advanceSlot() {
    const next = getNextAvailableSlot();

    if (next !== -1) {
      const previousFilter = currentFilter;
      activeSlot = next;

      if (slotFilters[next] === "none") {
        slotFilters[next] = previousFilter;
      }
    }

    currentFilter = slotFilters[activeSlot];
    updateActiveSlotUI();
  }

  shotSlots.forEach((slot, index) => {
    slot.addEventListener("click", () => {
      if (isCapturing) return;

      activeSlot = index;
      currentFilter = slotFilters[index] || "none";

      updateActiveSlotUI();
      checkCameraState();
    });
  });

  function applyFilterToCanvas(originalCanvas, filterName) {
    if (!originalCanvas) return null;

    const result = document.createElement("canvas");

    result.width = originalCanvas.width;
    result.height = originalCanvas.height;

    const ctx = result.getContext("2d");

    ctx.save();
    ctx.filter = FILTER_CSS[filterName] || "none";
    ctx.drawImage(originalCanvas, 0, 0);
    ctx.restore();

    return result;
  }

  function grabFrame() {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    captureCanvas.width = w;
    captureCanvas.height = h;

    const ctx = captureCanvas.getContext("2d");

    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const original = document.createElement("canvas");

    original.width = w;
    original.height = h;

    original.getContext("2d").drawImage(
      captureCanvas,
      0,
      0
    );

    return original;
  }

  function reapplyFilterToShot(index) {
    if (!originalShots[index]) return;

    shots[index] = applyFilterToCanvas(
      originalShots[index],
      slotFilters[index]
    );

    updateSlotThumbnail(index);
    refreshStrip();
  }

  async function runCountdown(seconds, token) {
    for (let n = seconds; n >= 1; n--) {
      if (captureSession !== token) return false;

      if (countdownEl) {
        countdownEl.textContent = String(n);
        countdownEl.classList.remove("is-active");

        void countdownEl.offsetWidth;

        countdownEl.classList.add("is-active");
      }

      playBeep(520, 0.08);
      await wait(1000);
    }

    if (countdownEl) {
      countdownEl.textContent = "";
      countdownEl.classList.remove("is-active");
    }

    return captureSession === token;
  }

  function flash() {
    playShutterSound();

    if (!flashEl) return;

    flashEl.classList.remove("is-flashing");

    void flashEl.offsetWidth;

    flashEl.classList.add("is-flashing");
  }

  function saveShot(index, original) {
    if (!captureDate) {
      captureDate = new Date();
    }

    originalShots[index] = original;

    shots[index] = applyFilterToCanvas(
      original,
      slotFilters[index]
    );

    updateSlotThumbnail(index);
    refreshStrip();
  }

  async function takeSingleShot() {
    if (isCapturing || !currentStream || video.readyState < 2) {
      return;
    }

    isCapturing = true;

    const token = ++captureSession;
    const index = activeSlot;

    shutterBtn.disabled = true;

    if (countdownSelect) {
      countdownSelect.disabled = true;
    }

    if (hintEl) {
      hintEl.textContent = `Capturing slot ${index + 1}...`;
    }

    try {
      const completed = await runCountdown(
        getCountdownSeconds(),
        token
      );

      if (!completed || !currentStream) return;

      flash();
      saveShot(index, grabFrame());
      advanceSlot();

      if (!isStripReady()) {
        clearStrip();
      }

    } finally {
      if (captureSession === token) {
        isCapturing = false;

        if (countdownSelect) {
          countdownSelect.disabled = false;
        }

        checkCameraState();
      }
    }
  }

  async function captureAllShots() {
    if (isCapturing || !currentStream || video.readyState < 2) {
      return;
    }

    isCapturing = true;

    const token = ++captureSession;
    const seconds = getCountdownSeconds();
    const selectedFilter = currentFilter;

    shots = Array(TOTAL_SHOTS).fill(null);
    originalShots = Array(TOTAL_SHOTS).fill(null);
    slotFilters = Array(TOTAL_SHOTS).fill(selectedFilter);

    captureDate = null;

    shotSlots.forEach((_, index) => {
      updateSlotThumbnail(index);
    });

    clearStrip();

    shutterBtn.disabled = true;

    if (autoCaptureBtn) {
      autoCaptureBtn.disabled = true;
    }

    if (countdownSelect) {
      countdownSelect.disabled = true;
    }

    try {
      for (let i = 0; i < TOTAL_SHOTS; i++) {
        activeSlot = i;
        currentFilter = slotFilters[i];

        updateActiveSlotUI();

        if (hintEl) {
          hintEl.textContent =
            `Photo ${i + 1} of ${TOTAL_SHOTS} — Get ready!`;
        }

        const completed = await runCountdown(
          seconds,
          token
        );

        if (!completed || !currentStream) return;

        flash();
        saveShot(i, grabFrame());

        await wait(500);

        if (captureSession !== token) return;
      }

      buildStrip();

      if (hintEl) {
        hintEl.textContent =
          "Finished! Download or edit your photo strip.";
      }

    } finally {
      if (captureSession === token) {
        isCapturing = false;

        if (countdownSelect) {
          countdownSelect.disabled = false;
        }

        checkCameraState();
      }
    }
  }

  shutterBtn.addEventListener("click", () => {
    if (captureMode?.value === "auto") {
      captureAllShots();
    } else {
      takeSingleShot();
    }
  });

  autoCaptureBtn?.addEventListener(
    "click",
    captureAllShots
  );

  removeButtons.forEach((btn, index) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (isCapturing) return;

      shots[index] = null;
      originalShots[index] = null;
      slotFilters[index] = "none";

      activeSlot = index;
      currentFilter = "none";

      if (shots.every((shot) => shot === null)) {
        captureDate = null;
      }

      updateSlotThumbnail(index);
      updateActiveSlotUI();
      clearStrip();
      checkCameraState();
    });
  });

  viewButtons.forEach((btn, index) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!shots[index] || !photoModal || !modalImage) {
        return;
      }

      modalImage.src = shots[index].toDataURL(
        "image/jpeg",
        0.9
      );

      photoModal.classList.remove("is-hidden");
    });
  });

  closeModalBtn?.addEventListener("click", () => {
    photoModal?.classList.add("is-hidden");
  });

  photoModal?.addEventListener("click", (event) => {
    if (event.target === photoModal) {
      photoModal.classList.add("is-hidden");
    }
  });

  function buildStrip() {
    if (!isStripReady()) return;

    const PADDING = 28;
    const GAP = 20;
    const CAPTION_HEIGHT = 80;
    const PHOTO_W = 500;

    const PHOTO_H = Math.round(
      PHOTO_W * shots[0].height / shots[0].width
    );

    const width = PHOTO_W + PADDING * 2;

    const height =
      PADDING * 2 +
      PHOTO_H * TOTAL_SHOTS +
      GAP * (TOTAL_SHOTS - 1) +
      CAPTION_HEIGHT;

    stripCanvas.width = width;
    stripCanvas.height = height;

    const ctx = stripCanvas.getContext("2d");

    // Warna frame
    ctx.fillStyle = currentStripBg;
    ctx.fillRect(0, 0, width, height);

    // Menentukan warna teks berdasarkan kecerahan frame
    const rgb = currentStripBg.slice(1)
      .match(/.{2}/g)
      .map((part) => parseInt(part, 16));

    const dark =
      (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 140;

    const textColor = dark
      ? "#fdf6ec"
      : "#1f1b24";

    const secondaryColor = dark
      ? "rgba(253, 246, 236, 0.75)"
      : "rgba(31, 27, 36, 0.7)";

    // Menggambar semua foto
    shots.forEach((canvas, index) => {
      const y = PADDING + index * (PHOTO_H + GAP);

      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      ctx.drawImage(
        canvas,
        PADDING,
        y,
        PHOTO_W,
        PHOTO_H
      );

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = dark
        ? "rgba(255,255,255,0.15)"
        : "rgba(0,0,0,0.1)";

      ctx.lineWidth = 2;

      ctx.strokeRect(
        PADDING,
        y,
        PHOTO_W,
        PHOTO_H
      );
    });

    // Lubang pada sisi frame
    ctx.fillStyle = dark
      ? "#120f16"
      : "#2a2431";

    for (let y = 18; y < height - CAPTION_HEIGHT; y += 28) {
      ctx.beginPath();
      ctx.arc(12, y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(width - 12, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Caption
    const caption = captionInput?.value.trim()
      || "PHOTOBOOTH STUDIO";

    const showDate = showDateInput
      ? showDateInput.checked
      : true;

    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.font = "700 26px 'Fraunces', Georgia, serif";

    ctx.fillText(
      caption,
      width / 2,
      height - CAPTION_HEIGHT + (showDate ? 36 : 48),
      width - 64
    );

    // Tanggal
    if (showDate) {
      const dateStr = (captureDate || new Date())
        .toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

      ctx.fillStyle = secondaryColor;
      ctx.font = "500 15px 'Space Grotesk', sans-serif";

      ctx.fillText(
        `• ${dateStr} •`,
        width / 2,
        height - CAPTION_HEIGHT + 60
      );
    }

    stripEmpty?.classList.add("is-hidden");
    stripCanvas.classList.remove("is-hidden");

    downloadBtn.disabled = false;
    buildStripBtn?.classList.add("is-hidden");
  }

  buildStripBtn?.addEventListener("click", () => {
    if (isStripReady()) {
      buildStrip();
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (!isStripReady()) return;

    if (!isStripVisible()) {
      buildStrip();
    }

    const link = document.createElement("a");

    link.download = `photobooth-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.png`;

    link.href = stripCanvas.toDataURL("image/png");
    link.click();
  });

  retakeBtn.addEventListener("click", () => {
    if (isCapturing) return;

    resetSlots();
  });

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = reject;

      reader.onload = () => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function createOriginalUploadCanvas(img) {
    const width = 640;
    const height = 480;

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const scale = Math.max(
      width / img.width,
      height / img.height
    );

    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;

    canvas.getContext("2d").drawImage(
      img,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );

    return canvas;
  }

  uploadBtn?.addEventListener("click", () => {
    uploadInput?.click();
  });

  uploadInput?.addEventListener("change", async (event) => {
    if (isCapturing) return;

    const available = shots.filter(
      (shot) => shot === null
    ).length;

    const files = Array.from(
      event.target.files || []
    ).slice(0, available || 1);

    if (files.length === 0) return;

    isCapturing = true;

    const token = ++captureSession;

    shutterBtn.disabled = true;

    if (hintEl) {
      hintEl.textContent = "Processing uploaded photos...";
    }

    try {
      for (const file of files) {
        if (captureSession !== token) return;

        const index = shots[activeSlot] === null
          ? activeSlot
          : (
              getNextAvailableSlot() !== -1
                ? getNextAvailableSlot()
                : activeSlot
            );

        const image = await loadImage(file);

        if (captureSession !== token) return;

        saveShot(
          index,
          createOriginalUploadCanvas(image)
        );

        advanceSlot();
      }

    } catch (err) {
      console.error("Upload failed:", err);

      if (hintEl) {
        hintEl.textContent =
          "Could not upload one of the photos.";
      }

    } finally {
      uploadInput.value = "";

      if (captureSession === token) {
        isCapturing = false;
        checkCameraState();
      }
    }
  });

  window.addEventListener("beforeunload", stopCamera);

  updateActiveSlotUI();
  clearStrip();

  const initialColorButton = colorButtons.find(
    (btn) => btn.classList.contains("is-active")
  ) || colorButtons[0] || null;

  setFrameColor(
    initialColorButton?.dataset.color || currentStripBg,
    initialColorButton
  );

  checkCameraState();
})();
