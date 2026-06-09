export type UpcomingScheduleEvent = {
  id: string;
  kind: 'presentation' | 'open_house_host' | 'open_house_guest';
  title: string;
  subtitle: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  status: 'confirmed' | 'pending';
  href: string | null;
};

export function splitCountdown(totalMs: number) {
  const ms = Math.max(0, totalMs);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return { days, hours, minutes, seconds };
}

export function eventCountdownState(
  ev: Pick<UpcomingScheduleEvent, 'startsAt' | 'endsAt'>,
  nowMs: number
): 'upcoming' | 'live' | 'ended' {
  const start = new Date(ev.startsAt).getTime();
  const end = ev.endsAt ? new Date(ev.endsAt).getTime() : start + 60 * 60 * 1000;
  if (nowMs >= start && nowMs <= end) return 'live';
  if (nowMs > end) return 'ended';
  return 'upcoming';
}
