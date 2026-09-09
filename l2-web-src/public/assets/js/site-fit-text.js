(function () {
  const SELECTOR = [
    '.n-title',
    '.dashboard-title',
    '.section-title',
    '.faq-hero h1',
    '.shop-hero__title',
    '.rates-board__head h2',
    'h2.nst-brand',
    '.hero-wrapper > h2',
    '.nc-feature-card h3'
  ].join(',');

  const MIN_PX = 13;

  function availableWidth(el) {
    const parent = el.parentElement;
    if (!parent) return el.clientWidth || 0;
    const styles = window.getComputedStyle(parent);
    const pad =
      (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    // Prefer nearest card / wrapper if parent is too loose
    let box = parent;
    if (parent.clientWidth > window.innerWidth * 0.95) {
      const card = el.closest('.nostalgie-card, .faq-block, .shop-container, .donate-wrapper, .np-card, .mk, .nc-feature-card');
      if (card) box = card;
    }
    const w = box.clientWidth - pad;
    return Math.max(40, w - 8);
  }

  function fitOne(el) {
    if (!el || !el.textContent || !el.textContent.trim()) return;

    el.style.whiteSpace = 'nowrap';
    el.style.overflowWrap = 'normal';
    el.style.wordBreak = 'normal';
    el.style.hyphens = 'none';
    el.style.fontSize = '';
    el.style.letterSpacing = '';

    const base = parseFloat(window.getComputedStyle(el).fontSize) || 24;
    let size = base;
    const maxW = availableWidth(el);
    let guard = 0;

    while (el.scrollWidth > maxW && size > MIN_PX && guard++ < 60) {
      size -= 0.5;
      el.style.fontSize = size + 'px';
      el.style.letterSpacing = Math.max(0.02, 0.08 * (size / base)) + 'em';
    }
  }

  function fitAll() {
    document.querySelectorAll(SELECTOR).forEach(fitOne);
  }

  let t = 0;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(fitAll, 40);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitAll);
  } else {
    fitAll();
  }
  window.addEventListener('load', fitAll);
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitAll);
  }
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(schedule);
    document.querySelectorAll('.nostalgie-card, .n-header, .faq-wrapper, .shop-container').forEach(function (el) {
      ro.observe(el);
    });
  }
})();
