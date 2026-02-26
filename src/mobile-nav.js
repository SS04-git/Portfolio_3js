(() => {
  function initMobileNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const navInner = nav.querySelector('.nav-inner');
    const navLinks = nav.querySelector('.nav-links');
    if (!navInner || !navLinks) return;

    if (nav.querySelector('.nav-menu-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'nav-menu-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    navInner.appendChild(btn);

    const overlay = document.createElement('button');
    overlay.className = 'nav-drawer-overlay';
    overlay.type = 'button';
    overlay.setAttribute('aria-label', 'Close menu');
    document.body.appendChild(overlay);

    const closeMenu = () => {
      nav.classList.remove('nav-open');
      document.body.classList.remove('nav-drawer-open');
      btn.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      nav.classList.add('nav-open');
      document.body.classList.add('nav-drawer-open');
      btn.setAttribute('aria-expanded', 'true');
    };

    btn.addEventListener('click', () => {
      if (nav.classList.contains('nav-open')) closeMenu();
      else openMenu();
    });

    overlay.addEventListener('click', closeMenu);

    navLinks.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', closeMenu);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav, { once: true });
  } else {
    initMobileNav();
  }
})();
