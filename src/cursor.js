(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { cursor: none !important; }

    #warp-cursor {
      position: fixed;
      top: 0;
      left: 0;
      width: 10px;
      height: 10px;
      pointer-events: none;
      z-index: 99999;
      will-change: transform, opacity;
      transform-origin: center center;
      background: rgba(126, 207, 200, 0.95);
      border: 1px solid rgba(126, 207, 200, 0.75);
      box-shadow: 0 0 10px rgba(126, 207, 200, 0.5);
      mix-blend-mode: screen;
    }

    #warp-cursor::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 2px;
      height: 2px;
      background: rgba(255, 255, 255, 0.9);
      transform: translate(-50%, -50%);
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.7);
    }

    #warp-cursor-trail {
      position: fixed;
      top: 0;
      left: 0;
      width: 22px;
      height: 2px;
      pointer-events: none;
      z-index: 99998;
      will-change: transform, opacity;
      transform-origin: left center;
      background: linear-gradient(to right, rgba(126, 207, 200, 0.35), rgba(126, 207, 200, 0));
      filter: drop-shadow(0 0 4px rgba(126, 207, 200, 0.3));
      opacity: 0.65;
    }

    #warp-cursor.is-hovering {
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(255, 255, 255, 0.85);
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.55);
    }

    #warp-cursor-trail.is-hovering {
      background: linear-gradient(to right, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0));
      opacity: 0.85;
    }

    #warp-cursor-splash-label {
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 100000;
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 1);
      background: rgba(126, 207, 200, 1);
      border: 1px solid rgba(126, 207, 200, 0.42);
      border-radius: 999px;
      padding: 7px 12px 6px;
      box-shadow: 0 0 18px rgba(126, 207, 200, 0.16);
      white-space: nowrap;
      opacity: 0;
      will-change: transform, opacity;
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }

    #warp-cursor-splash-label.is-cube-hover {
      background: rgba(126, 207, 200, 0.26);
      border-color: rgba(126, 207, 200, 0.72);
      box-shadow: 0 0 22px rgba(126, 207, 200, 0.24);
    }
  `;
  document.head.appendChild(style);

  const cursor = document.createElement('div');
  cursor.id = 'warp-cursor';

  const trail = document.createElement('div');
  trail.id = 'warp-cursor-trail';

  const splashLabel = document.createElement('div');
  splashLabel.id = 'warp-cursor-splash-label';
  splashLabel.textContent = 'Click to enter';

  document.body.appendChild(cursor);
  document.body.appendChild(trail);
  document.body.appendChild(splashLabel);

  let rafId;
  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let cx = tx;
  let cy = ty;
  let prevCx = cx;
  let prevCy = cy;
  let trailX = tx;
  let trailY = ty;
  let isHovering = false;
  let hoverEl = null;

  const cursorSize = 10;
  const trailLength = 22;
  const magnetReleaseRadius = 120;
  const magnetPull = 0.22;
  const magnetTargets =
    'a, button, .depth-dot, .nav-logo, .pc-cta, .contact-link, .about-tags span';

  const lerp = (a, b, t) => a + (b - a) * t;
  const splash = document.getElementById('splash');

  function splashIsActive() {
    if (!splash) return false;
    const splashStyle = window.getComputedStyle(splash);
    return !splash.classList.contains('hidden') && splashStyle.display !== 'none' && splashStyle.visibility !== 'hidden';
  }

  function isNearSplashCube(x, y) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.hypot(dx, dy) < Math.min(window.innerWidth, window.innerHeight) * 0.24;
  }

  window.addEventListener(
    'mousemove',
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cursor.style.opacity = '1';
      trail.style.opacity = isHovering ? '0.85' : '0.65';
    },
    { passive: true }
  );

  function setHoverState(nextHovering) {
    if (isHovering === nextHovering) return;
    isHovering = nextHovering;
    cursor.classList.toggle('is-hovering', isHovering);
    trail.classList.toggle('is-hovering', isHovering);
  }

  function getCenter(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function distanceToEl(el, x, y) {
    const c = getCenter(el);
    return Math.hypot(x - c.x, y - c.y);
  }

  function animate() {
    rafId = requestAnimationFrame(animate);

    const pointedEl = document.elementFromPoint(tx, ty);
    const pointedInteractive = pointedEl ? pointedEl.closest(magnetTargets) : null;
    setHoverState(Boolean(pointedInteractive));

    // Stick only to the element actually under the pointer.
    if (pointedInteractive) {
      hoverEl = pointedInteractive;
    } else {
      hoverEl = null;
    }

    let targetX = tx;
    let targetY = ty;
    if (hoverEl && isHovering) {
      const center = getCenter(hoverEl);
      targetX = lerp(tx, center.x, magnetPull);
      targetY = lerp(ty, center.y, magnetPull);
    }

    const speed = isHovering ? 0.18 : 0.14;
    prevCx = cx;
    prevCy = cy;
    cx = lerp(cx, targetX, speed);
    cy = lerp(cy, targetY, speed);

    const dx = cx - prevCx;
    const dy = cy - prevCy;
    const angle = dx || dy ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;

    const scale = isHovering ? 1.12 : 1;
    cursor.style.transform = `translate(${cx - cursorSize / 2}px, ${cy - cursorSize / 2}px) rotate(45deg) scale(${scale})`;

    const trailSpeed = isHovering ? 0.11 : 0.08;
    trailX = lerp(trailX, cx, trailSpeed);
    trailY = lerp(trailY, cy, trailSpeed);
    trail.style.transform = `translate(${trailX - 2}px, ${trailY - 1}px) rotate(${angle}deg)`;

    if (splashIsActive() && isNearSplashCube(tx, ty)) {
      splashLabel.classList.add('is-cube-hover');
      splashLabel.style.opacity = '1';
      splashLabel.style.transform = `translate(${cx + 20}px, ${cy - 26}px)`;
    } else {
      splashLabel.classList.remove('is-cube-hover');
      splashLabel.style.opacity = '0';
    }
  }

  animate();

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    trail.style.opacity = '0';
    splashLabel.classList.remove('is-cube-hover');
    splashLabel.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    trail.style.opacity = isHovering ? '0.85' : '0.65';
  });

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
  });
})();
