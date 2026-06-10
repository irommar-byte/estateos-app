/** Czy licytacja już się rozpoczęła (status LIVE lub SCHEDULED po starcie). */
export function auctionHasStarted(event: {
  startsAt: string;
  status: string;
  now?: number;
}): boolean {
  const now = event.now ?? Date.now();
  const start = new Date(event.startsAt).getTime();
  if (Number.isNaN(start)) return event.status === 'LIVE';
  return event.status === 'LIVE' || (event.status === 'SCHEDULED' && now >= start);
}

/** Czy użytkownik może składać oferty. */
export function auctionCanBid(event: {
  startsAt: string;
  status: string;
  effectiveEndsAt: string;
  isHost?: boolean;
  now?: number;
}): boolean {
  if (event.isHost) return false;
  if (!['LIVE', 'SCHEDULED'].includes(event.status)) return false;
  if (!auctionHasStarted(event)) return false;
  const now = event.now ?? Date.now();
  const end = new Date(event.effectiveEndsAt).getTime();
  return Number.isFinite(end) && now < end;
}

/** Ms do odliczenia: do startu (SCHEDULED) lub do końca (LIVE). */
export function auctionCountdownMs(event: {
  startsAt: string;
  status: string;
  effectiveEndsAt: string;
  now?: number;
}): number {
  const now = event.now ?? Date.now();
  if (!auctionHasStarted({ ...event, now })) {
    const start = new Date(event.startsAt).getTime();
    return Number.isFinite(start) ? Math.max(0, start - now) : 0;
  }
  const end = new Date(event.effectiveEndsAt).getTime();
  return Number.isFinite(end) ? Math.max(0, end - now) : 0;
}

/** Giełdowy kolor pilności: >2 dni zielony, <2 dni żółty, <1 dzień czerwony. */
export function countdownUrgencyColor(ms: number): string {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  if (ms > twoDays) return '#10B981';
  if (ms > oneDay) return '#F59E0B';
  return '#EF4444';
}
