'use client';

import { useEffect } from 'react';

/**
 * Mikroanimacje strony oferty: sekcje wjeżdżają łagodnie przy przewijaniu.
 * Ukrywanie włącza się dopiero po starcie skryptu (klasa na <html>), więc bez JS nic nie znika;
 * przy „ograniczeniu ruchu” wszystko jest od razu widoczne (CSS).
 */
export default function OfferRevealEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('.eos-offer-body .eos-offer-panel, .eos-offer-body .eos-reveal'));
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const viewportH = window.innerHeight;
    // To, co już jest na ekranie, zostaje widoczne od razu — animujemy tylko niżej położone sekcje.
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < viewportH * 0.92) el.classList.add('is-in');
    });
    root.classList.add('eos-reveal-ready');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    targets.forEach((el) => {
      if (!el.classList.contains('is-in')) io.observe(el);
    });
    return () => {
      io.disconnect();
      root.classList.remove('eos-reveal-ready');
    };
  }, []);
  return null;
}
