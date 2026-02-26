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
  `;
  document.head.appendChild(style);

  const cursor = document.createElement('div');
  cursor.id = 'warp-cursor';

  const trail = document.createElement('div');
  trail.id = 'warp-cursor-trail';

  document.body.appendChild(cursor);
  document.body.appendChild(trail);

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

  const cursorSize = 10;
  const trailLength = 22;
  const magnetTargets =
    'a, button, .project-card, .depth-dot, .nav-logo, .pc-cta, .contact-link, .about-tags span';

  let magnetEl = null;

  const lerp = (a, b, t) => a + (b - a) * t;

  window.addEventListener(
    'mousemove',
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
    },
    { passive: true }
  );

  document.addEventListener('mouseover', (e) => {
    if (!e.target.closest(magnetTargets)) return;
    isHovering = true;
    cursor.classList.add('is-hovering');
    trail.classList.add('is-hovering');
  });

  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest(magnetTargets)) return;
    isHovering = false;
    cursor.classList.remove('is-hovering');
    trail.classList.remove('is-hovering');
  });

  function animate() {
    rafId = requestAnimationFrame(animate);

    const speed = isHovering ? 0.14 : 0.1;
    prevCx = cx;
    prevCy = cy;
    cx = lerp(cx, tx, speed);
    cy = lerp(cy, ty, speed);

    const dx = cx - prevCx;
    const dy = cy - prevCy;
    const angle = dx || dy ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;

    const scale = isHovering ? 1.12 : 1;
    cursor.style.transform = `translate(${cx - cursorSize / 2}px, ${cy - cursorSize / 2}px) rotate(45deg) scale(${scale})`;

    const trailSpeed = isHovering ? 0.11 : 0.08;
    trailX = lerp(trailX, tx, trailSpeed);
    trailY = lerp(trailY, ty, trailSpeed);
    trail.style.transform = `translate(${trailX - 2}px, ${trailY - 1}px) rotate(${angle}deg)`;

    let nearest = null;
    let nearestDistance = 90;

    Array.from(document.querySelectorAll(magnetTargets)).forEach((el) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(tx - centerX, ty - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = el;
      }
    });

    if (magnetEl && magnetEl !== nearest) {
      magnetEl.style.transform = '';
      magnetEl.style.transition = 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
      magnetEl = null;
    }

    if (nearest) {
      const rect = nearest.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const force = 0.28 * (1 - nearestDistance / 90);
      const mx = (tx - centerX) * force;
      const my = (ty - centerY) * force;

      if (!nearest.classList.contains('project-card')) {
        nearest.style.transition = 'transform 0.15s ease';
        nearest.style.transform = `translate(${mx}px, ${my}px)`;
      }
      magnetEl = nearest;
    }
  }

  animate();

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    trail.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    trail.style.opacity = isHovering ? '0.85' : '0.65';
  });

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
  });
})();
