(() => {
  "use strict";

  // Inisialisasi & Elemen Landing Page
  const landingView = document.getElementById("landingView");
  const teamSection = document.getElementById("team");
  const navLinks = Array.from(landingView.querySelectorAll(".nav-link"));
  const memos = Array.from(landingView.querySelectorAll(".memo-card"));

  // Efek Animasi dan Scroll
  function onScroll() {
    if (landingView.classList.contains("is-hidden")) return; // sedang di photobooth

    const scrollY = window.scrollY;
    const h = window.innerHeight;

    landingView.classList.toggle("is-scrolled", scrollY > 100);

    let idx = 0;
    if (scrollY >= h * 2.8) idx = 3;
    else if (scrollY >= h * 1.8) idx = 2;
    else if (scrollY >= h * 0.8) idx = 1;
    navLinks.forEach((l, i) => l.classList.toggle("active", i === idx));

    const teamTop = teamSection.getBoundingClientRect().top;
    teamSection.classList.toggle("in-view", teamTop < h * 0.75);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Animasi Carousel
  if (memos.length) {
    let current = 0;
    setInterval(() => {
      if (landingView.classList.contains("is-hidden")) return;
      memos[current].classList.remove("active");
      current = (current + 1) % memos.length;
      memos[current].classList.add("active");
    }, 3500);
  }
})();
