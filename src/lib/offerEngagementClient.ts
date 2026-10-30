'use client';

type Event = { kind: 'photo' | 'room'; key: string; ms: number };

const queues = new Map<number, Event[]>();
let listening = false;

function flush(offerId: number) {
  const events = queues.get(offerId);
  if (!events?.length) return;
  queues.set(offerId, []);
  const body = JSON.stringify({ events });
  const url = `/api/offers/${offerId}/engagement`;
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
  } catch {
    /* fallback poniżej */
  }
  void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
}

function flushAll() {
  for (const id of queues.keys()) flush(id);
}

/** Zapis zainteresowania (zdjęcie / pokój) — wysyłane paczkami, przy zamknięciu karty przez sendBeacon. */
export function trackEngagement(offerId: number, event: Event) {
  if (typeof window === 'undefined' || !Number.isFinite(offerId) || offerId <= 0) return;
  const list = queues.get(offerId) || [];
  list.push(event);
  queues.set(offerId, list);
  if (!listening) {
    listening = true;
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll();
    });
    window.setInterval(flushAll, 15_000);
  }
  if (list.length >= 25) flush(offerId);
}
