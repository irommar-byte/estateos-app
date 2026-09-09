(function () {
  const header = document.getElementById('nc-header');
  const bar = document.querySelector('.nc-header__bar');
  const spacer = document.getElementById('nc-header-spacer');
  const toggle = document.getElementById('nc-header-toggle');
  const menu = document.getElementById('nc-header-menu');
  const HARD_MOBILE_MAX = 640;
  /** Extra room required before leaving hamburger (stops flicker at the edge). */
  const EXPAND_SLACK = 28;

  let probe = null;
  let measuring = false;
  let rafId = 0;
  let lastCompact = null;

  function isCompact() {
    return !!(header && header.classList.contains('nc-header--compact'));
  }

  function syncHeight() {
    const el = bar || header;
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--nc-header-h', h + 'px');
    if (spacer) spacer.style.height = h + 'px';
  }

  function resetMenuStyle() {
    if (!menu) return;
    menu.style.opacity = '';
    menu.style.visibility = '';
    menu.style.pointerEvents = '';
    menu.style.transform = '';
  }

  function syncMenuA11y() {
    if (!menu) return;
    if (!isCompact()) {
      menu.setAttribute('aria-hidden', 'false');
      menu.classList.remove('is-open');
      resetMenuStyle();
      document.body.classList.remove('nc-menu-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    } else if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') {
      menu.setAttribute('aria-hidden', 'true');
      resetMenuStyle();
    }
  }

  function closeMenu() {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    if (isCompact()) {
      menu.setAttribute('aria-hidden', 'true');
      resetMenuStyle();
    }
    document.body.classList.remove('nc-menu-open');
  }

  function openMenu() {
    if (!toggle || !menu) return;
    syncHeight();
    toggle.setAttribute('aria-expanded', 'true');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    if (isCompact()) {
      menu.style.setProperty('opacity', '1', 'important');
      menu.style.setProperty('visibility', 'visible', 'important');
      menu.style.pointerEvents = 'auto';
      menu.style.transform = 'translateY(0)';
    }
    document.body.classList.add('nc-menu-open');
  }

  function ensureProbe() {
    if (probe || !menu || !bar) return probe;
    probe = document.createElement('div');
    probe.id = 'nc-header-fit-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
      'position:absolute',
      'left:-99999px',
      'top:0',
      'visibility:hidden',
      'pointer-events:none',
      'display:flex',
      'flex-direction:row',
      'align-items:center',
      'flex-wrap:nowrap',
      'gap:14px',
      'white-space:nowrap',
      'height:0',
      'overflow:hidden'
    ].join(';');
    bar.appendChild(probe);
    return probe;
  }

  /** Sum natural widths of nav links + action controls (desktop row). */
  function measureInlineMenuWidth() {
    const p = ensureProbe();
    if (!p || !menu) return 0;

    p.innerHTML = '';
    const nav = menu.querySelector('.nc-header__nav');
    const actions = menu.querySelector('.nc-header__actions');

    if (nav) {
      const navClone = nav.cloneNode(true);
      navClone.style.cssText = 'display:flex;flex:0 0 auto;min-width:0;';
      const ul = navClone.querySelector('ul');
      if (ul) {
        ul.style.cssText =
          'display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:18px;list-style:none;margin:0;padding:0;';
      }
      p.appendChild(navClone);
    }
    if (actions) {
      const actClone = actions.cloneNode(true);
      actClone.style.cssText =
        'display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:10px;flex:0 0 auto;';
      p.appendChild(actClone);
    }

    return Math.ceil(p.scrollWidth);
  }

  function measureNeedsCompact() {
    if (!header || !bar || !menu) return window.innerWidth <= HARD_MOBILE_MAX;
    if (window.innerWidth <= HARD_MOBILE_MAX) return true;

    const brand = bar.querySelector('.nc-header__brand');
    const styles = window.getComputedStyle(bar);
    const padL = parseFloat(styles.paddingLeft) || 0;
    const padR = parseFloat(styles.paddingRight) || 0;
    const gap = parseFloat(styles.columnGap || styles.gap) || 16;
    const barW = bar.clientWidth;
    const brandW = brand ? Math.ceil(brand.getBoundingClientRect().width) : 0;
    const toggleReserve = 48; /* room for hamburger button when compact; ignore when expanded */
    const available = barW - padL - padR - brandW - gap;
    const needed = measureInlineMenuWidth();

    const currentlyCompact = header.classList.contains('nc-header--compact');
    if (currentlyCompact) {
      // Expand only when clearly enough space (hysteresis).
      return needed > available - EXPAND_SLACK;
    }
    // Collapse as soon as it no longer fits.
    return needed > available;
  }

  function syncCompactMode() {
    if (!header || measuring) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      measuring = true;
      try {
        const needs = measureNeedsCompact();
        if (lastCompact === null) lastCompact = header.classList.contains('nc-header--compact');
        if (needs !== lastCompact) {
          if (needs) {
            // Entering hamburger: never leave a full-screen invisible hit-target.
            if (menu) {
              menu.classList.remove('is-open');
              menu.setAttribute('aria-hidden', 'true');
              resetMenuStyle();
            }
            document.body.classList.remove('nc-menu-open');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
          }
          header.classList.toggle('nc-header--compact', needs);
          lastCompact = needs;
          if (!needs) closeMenu();
        }
        syncMenuA11y();
        syncHeight();
      } finally {
        measuring = false;
      }
    });
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeMenu();
      else openMenu();
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncCompactMode, 50);
  });
  window.addEventListener('load', syncCompactMode);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncCompactMode);
  }

  const observeEl = bar || header;
  if (typeof ResizeObserver !== 'undefined' && observeEl) {
    new ResizeObserver(function () {
      if (measuring) return;
      syncCompactMode();
    }).observe(observeEl);
  }

  // Start expanded; measure once without flashing compact first.
  if (header) header.classList.remove('nc-header--compact');
  lastCompact = false;
  syncCompactMode();
})();
