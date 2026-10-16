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

  const enterBoothBtn = document.getElementById("landingStartBtn");
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
  const buildStripBtn = document.getElementById("buildStripBtn");

  const filterButtons = Array.from(document.querySelectorAll(".filter"));
  const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
  const shotSlots = Array.from(document.querySelectorAll(".shot-slot"));
  const removeButtons = Array.from(document.querySelectorAll(".remove-shot-btn"));
  const viewButtons = Array.from(document.querySelectorAll(".view-shot-btn"));

  // Modal elements
  const photoModal = document.getElementById("photoModal");
  const modalImage = document.getElementById("modalImage");
  const closeModalBtn = document.getElementById("closeModalBtn");

  let currentStream = null;
  let currentStripBg = "#f8f7f3";
  let isCapturing = false;
  
  // Independent tracking per slot
  let shots = [null, null, null]; 
  let originalShots = [null, null, null];
  let slotFilters = ["none", "none", "none"];
  let activeSlot = 0;
  let currentFilter = "none";

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
    document.body.classList.remove("on-landing");
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
    document.body.classList.add("on-landing");
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("scroll")); // sinkronkan state landing (nav, animasi)
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
      checkCameraState();
    } catch (err) {
      console.error("Failed to open camera:", err);
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

  function updateActiveSlotUI() {
    shotSlots.forEach((s, i) => {
      s.classList.remove("is-active");
      if (i === activeSlot) s.classList.add("is-active");
    });
    
    filterButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.filter === currentFilter));
    });
    
    Object.values(FILTER_CLASS).forEach((cls) => {
      if (cls) video.classList.remove(cls);
    });
    if (FILTER_CLASS[currentFilter]) video.classList.add(FILTER_CLASS[currentFilter]);
  }

  function setFilter(name) {
    currentFilter = name;
    slotFilters[activeSlot] = name;
    updateActiveSlotUI();
    
    // Only apply to the currently selected slot, not all slots
    if (shots[activeSlot]) {
      reapplyFilterToShot(activeSlot);
    }
  }

  filterButtons.forEach((btn) => btn.addEventListener("click", () => setFilter(btn.dataset.filter)));

  colorButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      colorButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentStripBg = btn.dataset.color;
      if (isStripReady()) buildStrip();
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
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    
    const originalCanvas = document.createElement("canvas");
    originalCanvas.width = w; originalCanvas.height = h;
    originalCanvas.getContext("2d").drawImage(captureCanvas, 0, 0);
    
    return originalCanvas;
  }

  function applyFilterToCanvas(originalCanvas, filterName) {
      if (!originalCanvas) return null;
      
      const w = originalCanvas.width;
      const h = originalCanvas.height;
      const filteredCanvas = document.createElement("canvas");
      filteredCanvas.width = w;
      filteredCanvas.height = h;
      const ctx = filteredCanvas.getContext("2d");
      
      ctx.save();
      ctx.filter = FILTER_CSS[filterName] || "none";
      ctx.drawImage(originalCanvas, 0, 0, w, h);
      ctx.restore();
      
      return filteredCanvas;
  }
  
  function updateSlotThumbnail(index) {
    const slot = shotSlots[index];
    const canvas = shots[index];
    if (!slot) return;
    
    if (canvas) {
      slot.style.backgroundImage = `url(${canvas.toDataURL("image/jpeg", 0.8)})`;
      slot.classList.add("has-image");
    } else {
      slot.style.backgroundImage = "none";
      slot.classList.remove("has-image");
    }
  }

  function resetSlots() { 
      shots = [null, null, null];
      originalShots = [null, null, null];
      slotFilters = ["none", "none", "none"];
      activeSlot = 0;
      currentFilter = "none";
      
      shotSlots.forEach((_, i) => updateSlotThumbnail(i)); 
      updateActiveSlotUI();
      checkCameraState();
  }
  
  function getNextAvailableSlot() {
      return shots.findIndex(shot => shot === null);
  }

  function advanceSlot() {
      const next = getNextAvailableSlot();
      if (next !== -1) {
          activeSlot = next;
          // Carry over the current filter to the new slot for convenience
          slotFilters[activeSlot] = currentFilter; 
      }
      updateActiveSlotUI();
  }

  function checkCameraState() {
      const numShots = shots.filter(s => s !== null).length;
      const allFull = (numShots === TOTAL_SHOTS);
      
      if (allFull) {
          buildStripBtn.classList.remove("is-hidden");
          if (shots[activeSlot] !== null) {
              shutterBtn.disabled = !currentStream;
              hintEl.textContent = `Slot ${activeSlot + 1} selected. Retake or apply filter.`;
          }
      } else {
          buildStripBtn.classList.add("is-hidden");
          shutterBtn.disabled = !currentStream;
          hintEl.textContent = `Photo ${numShots + 1} of ${TOTAL_SHOTS} — Get ready!`;
      }
      
      retakeBtn.disabled = (numShots === 0);
  }

  // Allow user to click a slot to select it for retake or filter change
  shotSlots.forEach((slot, index) => {
      slot.addEventListener("click", () => {
          activeSlot = index;
          currentFilter = slotFilters[activeSlot] || "none";
          updateActiveSlotUI();
          checkCameraState();
      });
  });

  async function takeSingleShot() {
    if (isCapturing) return;
    
    isCapturing = true;
    shutterBtn.disabled = true; 
    hintEl.textContent = `Capturing slot ${activeSlot + 1}...`;
    
    await runCountdown();
    flash();
    
    const originalCanvas = grabFrame();
    originalShots[activeSlot] = originalCanvas;
    
    shots[activeSlot] = applyFilterToCanvas(originalCanvas, currentFilter);
    updateSlotThumbnail(activeSlot);
    
    isCapturing = false; 
    advanceSlot();
    checkCameraState();
  }

  shutterBtn.addEventListener("click", takeSingleShot);
  
  removeButtons.forEach((btn, index) => {
      btn.addEventListener("click", (e) => {
          e.stopPropagation(); 
          shots[index] = null;
          originalShots[index] = null;
          slotFilters[index] = "none";
          updateSlotThumbnail(index);
          
          activeSlot = index;
          currentFilter = "none";
          updateActiveSlotUI();
          
          checkCameraState();
          
          stripCanvas.classList.add("is-hidden"); 
          stripEmpty.classList.remove("is-hidden");
          downloadBtn.disabled = true;
      });
  });

  viewButtons.forEach((btn, index) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); 
      if (shots[index]) {
        modalImage.src = shots[index].toDataURL("image/jpeg", 0.9);
        photoModal.classList.remove("is-hidden");
      }
    });
  });

  closeModalBtn.addEventListener("click", () => {
    photoModal.classList.add("is-hidden");
  });

  photoModal.addEventListener("click", (e) => {
    if (e.target === photoModal) {
      photoModal.classList.add("is-hidden");
    }
  });

  function reapplyFilterToShot(index) {
      if (originalShots[index]) {
          shots[index] = applyFilterToCanvas(originalShots[index], slotFilters[index]);
          updateSlotThumbnail(index);
      }
      if (isStripReady() && !stripCanvas.classList.contains("is-hidden")) {
          buildStrip();
      }
  }

  function isStripReady() {
      return shots.filter(s => s !== null).length === TOTAL_SHOTS;
  }
  
  buildStripBtn.addEventListener("click", () => {
      if (isStripReady()) {
          buildStrip();
          buildStripBtn.classList.add("is-hidden");
          hintEl.textContent = "Finished! Download your photo strip.";
      }
  });

  function buildStrip() {
    const validShots = shots.filter(s => s !== null);
    if (validShots.length !== TOTAL_SHOTS) return;
    
    const photoCanvases = validShots;
    
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
    downloadBtn.disabled = false;
  }

  downloadBtn.addEventListener("click", () => {
    if (!isStripReady()) return;
    const link = document.createElement("a");
    link.download = `photobooth-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    link.href = stripCanvas.toDataURL("image/png", 1.0);
    link.click();
  });

  retakeBtn.addEventListener("click", () => {
    resetSlots();
    stripCanvas.classList.add("is-hidden"); stripEmpty.classList.remove("is-hidden");
    downloadBtn.disabled = true; retakeBtn.disabled = true;
    
    if (!currentStream) {
      cameraMessage.classList.remove("is-hidden");
      cameraMessageText.textContent = "Camera is not active. Click below.";
      startBtn.style.display = "inline-block";
      startBtn.disabled = false;
      startBtn.textContent = "Activate Camera";
    }
  });

  window.addEventListener("beforeunload", stopCamera);

  const uploadBtn = document.getElementById("uploadBtn");
  const uploadInput = document.getElementById("uploadInput");

  uploadBtn.addEventListener("click", () => {
    uploadInput.click();
  });

  uploadInput.addEventListener("change", async (e) => {
    const availableSlotsCount = shots.filter(s => s === null).length;
    // Allow replacing the active slot if full, else only upload into empty slots
    const allowedUploadCount = availableSlotsCount > 0 ? availableSlotsCount : 1;
    const files = Array.from(e.target.files).slice(0, allowedUploadCount);
    
    if (files.length === 0) return;

    hintEl.textContent = "Processing uploaded photos...";
    shutterBtn.disabled = true;

    for (let i = 0; i < files.length; i++) {
      // Find where to put the image: activeSlot, or next available slot
      let targetSlot = activeSlot;
      if (shots[activeSlot] !== null && getNextAvailableSlot() !== -1) {
          targetSlot = getNextAvailableSlot();
          slotFilters[targetSlot] = currentFilter;
      }
      
      const file = files[i];
      const img = await loadImage(file);
      
      const originalCanvas = createOriginalUploadCanvas(img);
      originalShots[targetSlot] = originalCanvas;
      
      shots[targetSlot] = applyFilterToCanvas(originalCanvas, slotFilters[targetSlot]);
      updateSlotThumbnail(targetSlot);
      
      activeSlot = targetSlot;
      advanceSlot();
    }
    
    checkCameraState();
    uploadInput.value = "";
  });

  function loadImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function createOriginalUploadCanvas(img) {
    const w = 640;
    const h = 480;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    const ratio = Math.max(w / img.width, h / img.height);
    const drawW = img.width * ratio;
    const drawH = img.height * ratio;
    const drawX = (w - drawW) / 2;
    const drawY = (h - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    return canvas;
  }
  
  // Initial setup call
  updateActiveSlotUI();
})();