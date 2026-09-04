function utcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function googleCalendarUrl(params: {
  title: string;
  startsAt: Date;
  location?: string | null;
  description?: string | null;
}): string {
  const ends = new Date(params.startsAt.getTime() + 60 * 60 * 1000);
  const search = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${utcStamp(params.startsAt)}/${utcStamp(ends)}`,
  });
  if (params.location) search.set('location', params.location);
  if (params.description) search.set('details', params.description);
  return `https://calendar.google.com/calendar/render?${search.toString()}`;
}

export function splitCountdown(totalMs: number) {
  const ms = Math.max(0, totalMs);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1_000),
  };
}
