/**
 * main.js
 * Work section: scroll rotates cube through full 360°, 5 stops (72° apart).
 * Each stop shows one card — alternating left/right alignment.
 * Card fades in as you arrive, fades out as you leave.
 */
(function () {

const splash = document.getElementById('splash');
const site   = document.getElementById('site');

/* ── Explorations page has no splash — skip portfolio init entirely ── */
if (!splash) return;

let entered  = false;

/* Auto-enter if arriving from another page with a hash (e.g. /#intro, /#about) */
if (window.location.hash) {
  window.addEventListener('load', () => {
    entered = true;
    // Hide splash instantly — no text flash
    splash.classList.add('hidden');
    // Keep site hidden until burst finishes
    site.style.opacity = '0';
    // Run the cube burst rotation, then reveal site
    window.CubeAPI.triggerBurst(() => {
      window.CubeAPI.enterSiteMode();
      site.style.transition = 'opacity 0.6s ease';
      site.style.opacity = '1';
      site.classList.add('visible');
      window.dispatchEvent(new Event('site-entered'));
      requestAnimationFrame(() => {
        const target = document.querySelector(window.location.hash);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }, { once: true });
}

function enterSite() {
  if (entered) return;
  entered = true;
  window.CubeAPI.triggerBurst(() => {
    splash.classList.add('hidden');
    requestAnimationFrame(() => {
      window.CubeAPI.enterSiteMode();
      site.classList.add('visible');
      window.dispatchEvent(new Event('site-entered'));
    });
  });
}
splash.addEventListener('click', enterSite);
window.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') enterSite();
}, { once: true });

/* ── Section observer: intro / about ── */
let currentSection = 'intro';
const sectionEls = [
  { id: 'intro', el: document.getElementById('intro') },
  { id: 'about', el: document.getElementById('about') },
].filter(s => s.el);

const sectionObserver = new IntersectionObserver(entries => {
  if (!entered) return;
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    if (e.target.id !== currentSection) {
      currentSection = e.target.id;
      window.CubeAPI.setCubeSection(e.target.id);
    }
  });
}, { threshold: 0.35 });

sectionEls.forEach(s => sectionObserver.observe(s.el));

/* About reveal fallback for touch/tablet devices without hover */
const aboutSection = document.getElementById('about');
const aboutContent = document.querySelector('.about-content');
const noHoverTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

if (aboutSection && aboutContent && noHoverTouch) {
  const closeAboutReveal = (evt) => {
    if (evt && aboutSection.contains(evt.target)) return;
    aboutSection.classList.remove('about-reveal');
  };

  aboutContent.addEventListener('pointerdown', (evt) => {
    if (evt.pointerType !== 'touch' && evt.pointerType !== 'pen') return;
    evt.preventDefault();
    aboutSection.classList.toggle('about-reveal');
  }, { passive: false });

  document.addEventListener('pointerdown', closeAboutReveal, { passive: true });
}

/* ══════════════════════════════════════════════════════
   WORK — full 360° cube rotation across 5 card stops

   Scroll budget:
     [0 → 100vh]            zoom-in through WORK title
     [100vh + i × 110vh]    stop i: cube has rotated i × 72°
                             card i appears (left if i even, right if i odd)
     Final card held, then projects-reveal fades in below

   CubeAPI.setWorkAngle(deg) rotates the cube around Y
   Each card appears at its stop's 72° angle, fades in/out
   with scroll just like before.
══════════════════════════════════════════════════════ */

const workSection  = document.getElementById('work');
const workTitle    = document.querySelector('.work-title');
const workSub      = document.querySelector('.work-title-sub');
const scrollDriver = document.querySelector('.work-scroll-driver');
const cards        = Array.from(document.querySelectorAll('.project-card'));
const dots         = Array.from(document.querySelectorAll('.depth-dot'));
// Guard stacked card CTAs: only active card links can navigate.
document.addEventListener('click', e => {
  const cta = e.target.closest('.project-card .pc-cta');
  if (!cta) return;
  const card = cta.closest('.project-card');
  if (card && !card.classList.contains('is-active')) {
    e.preventDefault();
    e.stopPropagation();
  }
});
const depthLabels  = Array.from(document.querySelectorAll('.depth-label'));
const depthTrack   = document.querySelector('.depth-track');
const postWork     = document.querySelector('.projects-reveal');
const stage        = document.querySelector('.work-sticky-stage');

const N        = cards.length;          // 5

// Force opacity:0 immediately so canvas never bleeds through before scroll sets it
cards.forEach(c => { c.style.opacity = '0'; });
const ZOOM_VH  = 100;
const CARD_VH  = 110;
const TOTAL_VH = ZOOM_VH + N * CARD_VH + 40;

if (scrollDriver) scrollDriver.style.height = TOTAL_VH + 'vh';

// Card scroll-window fractions — wider hold, gentler enter/exit
const ENTER_END  = 0.18;  // fade in over first 18% of card window
const EXIT_START = 0.72;  // hold fully visible until 72%
const EXIT_END   = 0.95;  // fade out over remaining 23%

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
// Smooth cubic ease — symmetric, works identically forward and backward
function easeCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function easeIn3(t)   { return t * t * t; }
function easeOut3(t)  { return 1 - Math.pow(1 - t, 3); }
function lerp(a, b, t) { return a + (b - a) * t; }

let rafPending = false;
let lastWorkCardIdx = null;

function emitWorkCardChange(index) {
  if (index === lastWorkCardIdx) return;
  lastWorkCardIdx = index;
  window.dispatchEvent(new CustomEvent('work-card-change', { detail: { index } }));
}

function updateScroll() {
  rafPending = false;
  if (!entered || !workSection) return;

  const scrolled = -workSection.getBoundingClientRect().top;
  const vh       = window.innerHeight;
  const zoomPx   = ZOOM_VH / 100 * vh;
  const perCard  = CARD_VH  / 100 * vh;

  /* ── Phase 0: zoom-in ── */
  const zoomP = clamp01(scrolled / zoomPx);
  window.CubeAPI.setZoomProgress(zoomP);

  if (workTitle) {
    const s  = 1 + zoomP * zoomP * 3;
    const op = zoomP < 0.55 ? 1 : Math.max(0, 1 - (zoomP - 0.55) / 0.30);
    const ls = 0.22 + zoomP * 0.6;
    workTitle.style.transform     = `scale(${s})`;
    workTitle.style.opacity       = op;
    workTitle.style.letterSpacing = ls + 'em';
    workTitle.style.textIndent    = ls + 'em';
  }
  if (workSub) workSub.style.opacity = Math.max(0, 1 - zoomP * 3);

  if (zoomP > 0.05 && currentSection !== 'work') currentSection = 'work';
  else if (zoomP <= 0.05 && currentSection === 'work') {
    currentSection = 'about';
    window.CubeAPI.setCubeSection('about');
  }

  /* ── Phase 1+: card stops ── */
  const cardAreaStart = zoomPx;
  const rawSlot       = (scrolled - cardAreaStart) / perCard; // float, 0..N

  // If we've scrolled back above the work section entirely, hide all cards
  if (scrolled <= 0) {
    cards.forEach(c => {
      c.style.opacity = '0';
      c.style.pointerEvents = 'none';
      const cv = c.querySelector('.pc-canvas');
      if (cv) cv.style.visibility = 'hidden';
    });
    dots.forEach(d => d.classList.remove('active'));
    if (stage) stage.classList.remove('cards-active');
    emitWorkCardChange(-1);
    return;
  }

  // Cube rotation: 0° at card 0, full 360° at card N (wraps around)
  // Each card is 72° apart. Smooth rotation between stops.
  const rotationDeg = rawSlot * (360 / N); // 0 → 360 across all cards
  window.CubeAPI.setWorkAngle(rotationDeg);

  // Cards — symmetric smooth fade, easeOut on enter, easeIn on exit
  let activeIdx = -1;
  let maxOpacity = 0;
  cards.forEach((card, i) => {
    const frac = rawSlot - i; // 0 = card just arriving, 1 = card fully scrolled past

    let opacity;
    if (frac <= 0) {
      // Not yet reached — fully hidden
      opacity = 0;
    } else if (frac < ENTER_END) {
      // Entering: ease out (slow start → fast finish → settles)
      opacity = easeOut3(frac / ENTER_END);
    } else if (frac < EXIT_START) {
      // Fully visible hold
      opacity = 1;
    } else if (frac < EXIT_END) {
      // Exiting: ease in (slow start so card lingers, then accelerates out)
      const t = (frac - EXIT_START) / (EXIT_END - EXIT_START);
      opacity = 1 - easeIn3(t);
    } else {
      // Fully scrolled past — hidden
      opacity = 0;
    }

    if (opacity > maxOpacity) { maxOpacity = opacity; activeIdx = i; }

    card.style.opacity       = opacity;
    card.style.pointerEvents = opacity > 0.05 ? 'all' : 'none';
    card.classList.toggle('is-active', opacity > 0.5);
    const cv = card.querySelector('.pc-canvas');
    if (cv) cv.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
  });

  // Dots + label — only highlight a dot when a card is meaningfully visible
  const inPhase = rawSlot > -0.3 && rawSlot < N;
  if (stage) stage.classList.toggle('cards-active', inPhase);
  const activeForMini = inPhase && maxOpacity > 0.01 ? activeIdx : -1;
  emitWorkCardChange(activeForMini);

  // Progress track fill: 0% at card 0, 100% at card N-1
  if (depthTrack) {
    const fillPct = N <= 1 ? 0 : Math.max(0, Math.min(100, (rawSlot / (N - 1)) * 100));
    depthTrack.style.setProperty('--progress', fillPct + '%');
  }

  dots.forEach((d, i) => {
    d.classList.toggle('active', i === activeIdx && maxOpacity > 0.35 && inPhase);
    d.classList.toggle('visited', i < activeIdx && inPhase);
  });
  depthLabels.forEach((l, i) => {
    l.classList.toggle('active', i === activeIdx && maxOpacity > 0.35 && inPhase);
  });

  // Post-work
  if (postWork) postWork.classList.toggle('revealed', scrolled > cardAreaStart + N * perCard * 0.75);
}

window.addEventListener('scroll', () => {
  if (!rafPending) { rafPending = true; requestAnimationFrame(updateScroll); }
}, { passive: true });

// Clickable dots — now inside .depth-track
dots.forEach((dot, i) => {
  dot.style.cursor = 'pointer';
  dot.addEventListener('click', () => {
    if (!workSection) return;
    const vh = window.innerHeight;
    const zoomPx  = ZOOM_VH / 100 * vh;
    const perCard = CARD_VH  / 100 * vh;
    const workTop = workSection.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: workTop + zoomPx + (i + 0.4) * perCard, behavior: 'smooth' });
  });
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
});

})();
/* ════════════════════════════════════════════════════
   EXPLORATIONS PAGE — init cube in site mode directly.
   Runs only when there is no #splash (explorations has
   no splash screen — cube.js + scroll dots still work).
════════════════════════════════════════════════════ */
(function () {
  if (document.getElementById('splash')) return; // homepage handles itself

  /* Make #site immediately visible — no splash gate on this page */
  const site = document.getElementById('site');
  if (site) { site.style.opacity = '1'; site.style.transition = 'none'; }

  /* Put cube straight into site/intro mode */
  window.addEventListener('load', () => {
    if (window.CubeAPI) {
      window.CubeAPI.enterSiteMode();
      window.CubeAPI.setCubeSection('intro');
    }
  });

  /* Progress dots — scroll through sections */
  const progDots  = Array.from(document.querySelectorAll('.exp-prog-dot'));
  const faceLabel = document.getElementById('faceLabel');
  const sections  = Array.from(document.querySelectorAll('[id^="exp-section-"]'));

  if (!progDots.length) return;

  let activeIdx = 0;
  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    progDots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  /* Cube face rotations per section — uses existing CubeAPI */
  const SECTION_FACES = ['intro', 'about', 'about', 'intro', 'about'];

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const idx = parseInt(e.target.dataset.sectionIdx || '0', 10);
      setActive(idx);
      if (window.CubeAPI) window.CubeAPI.setCubeSection(SECTION_FACES[idx] || 'intro');
      if (faceLabel) faceLabel.textContent = e.target.dataset.label || '';
    });
  }, { threshold: 0.5 });

  sections.forEach((el, i) => {
    el.dataset.sectionIdx = i;
    obs.observe(el);
  });

  /* Dot click → scroll to section */
  progDots.forEach((dot, i) => {
    dot.style.cursor = 'pointer';
    dot.addEventListener('click', () => {
      if (sections[i]) sections[i].scrollIntoView({ behavior: 'smooth' });
    });
  });
})();

