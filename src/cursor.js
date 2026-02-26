/**
 * cursor.js — Warp cursor with stretch, lerp lag, and magnetic pull.
 * No dependencies. Auto-disables on touch devices.
 */
(function () {

  if (window.matchMedia('(pointer: coarse)').matches) return;

  /* ── Inject styles ── */
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { cursor: none !important; }

    #warp-cursor {
      position: fixed;
      top: 0; left: 0;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--chrome-bright, #7ecfc8);
      pointer-events: none;
      z-index: 99999;
      mix-blend-mode: difference;
      will-change: transform;
      transform-origin: center center;
    }

    #warp-cursor-ring {
      position: fixed;
      top: 0; left: 0;
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(126, 207, 200, 0.45);
      pointer-events: none;
      z-index: 99998;
      will-change: transform;
      transform-origin: center center;
      transition: opacity 0.3s ease;
    }

    #warp-cursor.is-hovering {
      background: #ffffff;
    }
    #warp-cursor-ring.is-hovering {
      border-color: rgba(126, 207, 200, 0.9);
      border-width: 1.5px;
    }
  `;
  document.head.appendChild(style);

  /* ── Create elements ── */
  const dot  = document.createElement('div'); dot.id  = 'warp-cursor';
  const ring = document.createElement('div'); ring.id = 'warp-cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  /* ── State ── */
  let mouseX = window.innerWidth  / 2;
  let mouseY = window.innerHeight / 2;

  // Dot (fast lerp)
  let dotX = mouseX, dotY = mouseY;
  // Previous dot position for velocity
  let prevDotX = dotX, prevDotY = dotY;

  // Ring (slow lerp)
  let ringX = mouseX, ringY = mouseY;

  let isHovering = false;
  let raf;

  /* ── Magnetic targets ── */
  const MAGNETIC_SELECTORS = 'a, button, .project-card, .depth-dot, .nav-logo, .pc-cta, .contact-link, .about-tags span';
  const MAGNETIC_RADIUS    = 90;   // px — how far away pull starts
  const MAGNETIC_STRENGTH  = 0.28; // 0–1 how much the element moves

  // Track which element is currently pulled
  let magnetEl = null, magnetBaseX = 0, magnetBaseY = 0;

  function getMagnetTargets() {
    return Array.from(document.querySelectorAll(MAGNETIC_SELECTORS));
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function dist(ax, ay, bx, by) {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  /* ── Mouse move ── */
  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  /* ── Hover detection for ring scale ── */
  document.addEventListener('mouseover', e => {
    if (e.target.closest(MAGNETIC_SELECTORS)) {
      isHovering = true;
      dot.classList.add('is-hovering');
      ring.classList.add('is-hovering');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(MAGNETIC_SELECTORS)) {
      isHovering = false;
      dot.classList.remove('is-hovering');
      ring.classList.remove('is-hovering');
    }
  });

  /* ── RAF loop ── */
  function tick() {
    raf = requestAnimationFrame(tick);

    // Lerp dot — fast
    const dotLerp = isHovering ? 0.12 : 0.10;
    prevDotX = dotX;
    prevDotY = dotY;
    dotX = lerp(dotX, mouseX, dotLerp);
    dotY = lerp(dotY, mouseY, dotLerp);

    // Velocity of dot
    const vx = dotX - prevDotX;
    const vy = dotY - prevDotY;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Stretch: elongate in direction of movement
    const MAX_STRETCH = 2.0;
    const MIN_SCALE   = 0.85;
    const stretchAmt  = clamp(speed * 0.22, 0, MAX_STRETCH - 1);
    const squishAmt   = clamp(1 - speed * 0.04, MIN_SCALE, 1);

    // Angle of movement
    const angle = speed > 0.1 ? Math.atan2(vy, vx) * 180 / Math.PI : 0;

    // Hover state: dot grows, no stretch
    const dotScale = isHovering ? 2.2 : 1;
    const sx = isHovering ? dotScale : (1 + stretchAmt);
    const sy = isHovering ? dotScale : squishAmt;

    // Apply dot transform — offset by half size (5px) to center
    dot.style.transform = `
      translate(${dotX - 5}px, ${dotY - 5}px)
      rotate(${angle}deg)
      scale(${sx}, ${sy})
    `;

    // Lerp ring — slightly behind dot but not far
    const ringLerp = isHovering ? 0.09 : 0.07;
    ringX = lerp(ringX, mouseX, ringLerp);
    ringY = lerp(ringY, mouseY, ringLerp);

    // Ring: scale up on hover, shrink on click feel
    const ringScale = isHovering ? 1.6 : 1.0;
    ring.style.transform = `translate(${ringX - 18}px, ${ringY - 18}px) scale(${ringScale})`;

    /* ── Magnetic pull on nearby elements ── */
    let closestEl = null, closestDist = MAGNETIC_RADIUS;
    getMagnetTargets().forEach(el => {
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const d    = dist(mouseX, mouseY, cx, cy);
      if (d < closestDist) { closestDist = d; closestEl = el; }
    });

    // Release previous magnet target if changed
    if (magnetEl && magnetEl !== closestEl) {
      magnetEl.style.transform = '';
      magnetEl.style.transition = 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
      magnetEl = null;
    }

    if (closestEl) {
      const rect   = closestEl.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const pull   = (1 - closestDist / MAGNETIC_RADIUS) * MAGNETIC_STRENGTH;
      const tx     = (mouseX - cx) * pull;
      const ty     = (mouseY - cy) * pull;

      // Don't clobber existing transforms that JS scroll sets (project cards)
      const isCard = closestEl.classList.contains('project-card');
      if (!isCard) {
        closestEl.style.transition = 'transform 0.15s ease';
        closestEl.style.transform  = `translate(${tx}px, ${ty}px)`;
      }
      magnetEl = closestEl;
    }
  }

  tick();

  /* ── Hide ring when cursor leaves window ── */
  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
  });

  /* ── Click pulse ── */
  window.addEventListener('mousedown', () => {
    dot.style.transform  += ' scale(0.7)';
    ring.style.transform += ' scale(0.75)';
  });
  window.addEventListener('mouseup', () => { /* lerp restores naturally */ });

})();