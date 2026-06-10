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

export function countdownUrgencyColor(ms: number): string {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  if (ms > twoDays) return '#10B981';
  if (ms > oneDay) return '#F59E0B';
  return '#EF4444';
}

export function formatAuctionCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return d > 0 ? `${d}d ${time}` : time;
}
