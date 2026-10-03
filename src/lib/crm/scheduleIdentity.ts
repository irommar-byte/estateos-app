/** Jedna prezentacja = jeden wpis, nawet gdy leży na karcie kupującego i sprzedającego albo w dealroomie. */

export type ScheduleIdentity = {
  id: string;
  kind: string;
  startsAt: string;
  offerId?: number | null;
  clientId?: number | null;
  buyerClientId?: number | null;
  role?: 'BUYER' | 'SELLER' | null;
};

const WARSAW = 'Europe/Warsaw';

export function warsawDayKey(input: Date | string): string | null {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isSameWarsawDay(iso: string, now: Date = new Date()): boolean {
  const eventDay = warsawDayKey(iso);
  const today = warsawDayKey(now);
  return Boolean(eventDay && today && eventDay === today);
}

export function scheduleMinute(iso: string): number | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor(time / 60_000);
}

function family(kind: string): string {
  if (kind === 'presentation' || kind.startsWith('presentation')) return 'presentation';
  if (kind === 'acquisition' || kind.startsWith('acquisition')) return 'acquisition';
  if (kind.includes('open_house')) return 'open_house';
  return kind;
}

function roleRank(role?: string | null): number {
  if (role === 'BUYER') return 0;
  if (role === 'SELLER') return 2;
  return 1;
}

/** Zostawia kupującego, gdy ten sam pokaz jest też u właściciela albo jako spotkanie w dealroomie. */
export function dedupeScheduleEvents<T extends ScheduleIdentity>(events: T[]): T[] {
  const ranked = [...events].sort((a, b) => {
    const byTime = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (byTime) return byTime;
    return roleRank(a.role) - roleRank(b.role);
  });
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const event of ranked) {
    const minute = scheduleMinute(event.startsAt);
    if (minute == null) continue;
    const group = family(event.kind);
    const keys = [
      event.clientId ? `${group}:client:${event.clientId}:${minute}` : null,
      group === 'presentation' && event.offerId ? `${group}:offer:${event.offerId}:${minute}` : null,
      group === 'presentation' && event.buyerClientId ? `${group}:buyer:${event.buyerClientId}:${minute}` : null,
    ].filter((key): key is string => Boolean(key));
    const clash = keys.some((key) => {
      if (seen.has(key)) return true;
      if (!key.includes(':offer:') && !key.includes(':buyer:')) return false;
      const base = key.slice(0, key.lastIndexOf(':'));
      return seen.has(`${base}:${minute - 1}`) || seen.has(`${base}:${minute + 1}`);
    });
    if (clash) continue;
    for (const key of keys) seen.add(key);
    if (!keys.length) {
      const fallback = `${group}:id:${event.id}`;
      if (seen.has(fallback)) continue;
      seen.add(fallback);
    }
    unique.push(event);
  }
  return unique;
}
