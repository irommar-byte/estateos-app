/** First letter uppercase, rest unchanged — Polish mail / UI sentences. */
export function capitalizeSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase('pl-PL') + trimmed.slice(1);
}

export function capitalizeWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('pl-PL') + part.slice(1))
    .join(' ');
}

export function formatPolishDateTime(
  date: Date,
  opts?: { weekday?: boolean; year?: boolean; time?: boolean },
): string {
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
  };
  if (opts?.weekday !== false) options.weekday = 'long';
  if (opts?.year !== false) options.year = 'numeric';
  if (opts?.time !== false) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return capitalizeSentence(date.toLocaleString('pl-PL', options));
}

export function parseMeetingLocal(raw?: string | null): Date | null {
  const m = String(raw || '').trim().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const date = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
