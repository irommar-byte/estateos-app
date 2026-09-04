export function toUtcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function buildCalendarIcs(params: {
  title: string;
  startsAt: Date;
  durationMinutes?: number;
  location?: string | null;
  description?: string | null;
  uid?: string;
}): string {
  const duration = Math.max(15, params.durationMinutes || 60);
  const ends = new Date(params.startsAt.getTime() + duration * 60 * 1000);
  const uid = params.uid || `estateos-${toUtcStamp(params.startsAt)}@estateos.pl`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EstateOS//CRM//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(params.startsAt)}`,
    `DTEND:${toUtcStamp(ends)}`,
    `SUMMARY:${icsEscape(params.title.replace(/\n/g, ' '))}`,
  ];
  if (params.location) lines.push(`LOCATION:${icsEscape(params.location.replace(/\n/g, ' '))}`);
  if (params.description) lines.push(`DESCRIPTION:${icsEscape(params.description.replace(/\n/g, ' '))}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function googleCalendarUrl(params: {
  title: string;
  startsAt: Date;
  durationMinutes?: number;
  location?: string | null;
  description?: string | null;
}): string {
  const duration = Math.max(15, params.durationMinutes || 60);
  const ends = new Date(params.startsAt.getTime() + duration * 60 * 1000);
  const search = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${toUtcStamp(params.startsAt)}/${toUtcStamp(ends)}`,
  });
  if (params.location) search.set('location', params.location);
  if (params.description) search.set('details', params.description);
  return `https://calendar.google.com/calendar/render?${search.toString()}`;
}

export function outlookCalendarUrl(params: {
  title: string;
  startsAt: Date;
  durationMinutes?: number;
  location?: string | null;
  description?: string | null;
}): string {
  const duration = Math.max(15, params.durationMinutes || 60);
  const ends = new Date(params.startsAt.getTime() + duration * 60 * 1000);
  const search = new URLSearchParams({
    rru: 'addevent',
    subject: params.title,
    startdt: params.startsAt.toISOString(),
    enddt: ends.toISOString(),
    path: '/calendar/action/compose',
  });
  if (params.location) search.set('location', params.location);
  if (params.description) search.set('body', params.description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${search.toString()}`;
}

export function downloadIcsFile(filename: string, content: string) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
