import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';

/**
 * Samodzielne umawianie oglądań: klient widzi wolne godziny agenta i wybiera jedną.
 * Wybór tworzy propozycję terminu (proposedBy: client, status: pending) — agent ją zatwierdza.
 */

const SLOT_MINUTES = 60;
const BUSY_MARGIN_MS = 75 * 60 * 1000;

export type FreeSlot = { startsAt: string; label: string; day: string };

function warsawParts(date: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => f.find((p) => p.type === t)?.value || '';
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), h: Number(get('hour')), wd: get('weekday') };
}

/** Data w strefie Warszawy → UTC (z uwzględnieniem DST przez porównanie offsetu). */
function warsawToUtc(y: number, m: number, d: number, h: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, 0, 0));
  const parts = warsawParts(guess);
  const diffH = parts.h - h + (parts.d !== d ? (parts.d > d ? 24 : -24) : 0);
  return new Date(guess.getTime() - diffH * 60 * 60 * 1000);
}

const DAY_LABEL = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long' });
const TIME_LABEL = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });

/** Godziny pracy: pn–pt 9–19, sob 10–14. */
function workingHours(wd: string): number[] {
  if (wd === 'Sun') return [];
  if (wd === 'Sat') return [10, 11, 12, 13];
  return [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
}

export async function listAgentFreeSlots(agencyUserId: number, days = 10): Promise<FreeSlot[]> {
  const { fetchUpcomingScheduleEvents } = await import('@/lib/crm/upcomingScheduleEvents');
  const events = await fetchUpcomingScheduleEvents(agencyUserId).catch(() => []);
  const busy = events.map((e) => new Date(e.startsAt).getTime()).filter(Number.isFinite);
  const pendingClientBookings = await prisma.agencyClientActivity
    .findMany({
      where: {
        agencyUserId,
        kind: JOURNEY_ACTIVITY.PRESENTATION,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      select: { metadata: true },
      take: 200,
    })
    .catch(() => []);
  for (const row of pendingClientBookings) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const at = new Date(String(meta.startsAt || '')).getTime();
    if (Number.isFinite(at)) busy.push(at);
  }
  const out: FreeSlot[] = [];
  const now = Date.now();
  const earliest = now + 18 * 60 * 60 * 1000;
  for (let i = 0; i <= days; i += 1) {
    const dayDate = new Date(now + i * 24 * 60 * 60 * 1000);
    const p = warsawParts(dayDate);
    for (const h of workingHours(p.wd)) {
      const start = warsawToUtc(p.y, p.m, p.d, h);
      const t = start.getTime();
      if (t < earliest) continue;
      if (busy.some((b) => Math.abs(b - t) < BUSY_MARGIN_MS)) continue;
      out.push({ startsAt: start.toISOString(), label: TIME_LABEL.format(start), day: DAY_LABEL.format(start) });
    }
  }
  return out.slice(0, 80);
}

export async function requestSelfBooking(params: {
  clientId: number;
  agencyUserId: number;
  offerId: number;
  startsAt: string;
  note?: string | null;
  requestedBy: string;
}) {
  const startsAt = new Date(params.startsAt);
  if (!Number.isFinite(startsAt.getTime())) throw new Error('Wybierz termin.');
  const free = await listAgentFreeSlots(params.agencyUserId, 14);
  if (!free.some((slot) => slot.startsAt === startsAt.toISOString())) {
    throw new Error('Ten termin jest już zajęty — proszę wybrać inny.');
  }
  const match = await prisma.agencyClientMatch.findFirst({
    where: { clientId: params.clientId, offerId: params.offerId },
    include: { offer: { select: { title: true, street: true, district: true, city: true } } },
  });
  if (!match) throw new Error('Nie znaleziono oferty.');
  const location = [match.offer.street, match.offer.district, match.offer.city].filter(Boolean).join(', ') || null;
  const note = String(params.note || '').trim().slice(0, 400) || null;
  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      offerId: params.offerId,
      kind: JOURNEY_ACTIVITY.PRESENTATION,
      title: `Klient wybrał termin oglądania · ${match.offer.title}`.slice(0, 250),
      body: [TIME_LABEL.format(startsAt), DAY_LABEL.format(startsAt), note].filter(Boolean).join(' · '),
      metadata: {
        startsAt: startsAt.toISOString(),
        proposedSlots: [startsAt.toISOString()],
        proposedBy: 'client',
        status: 'pending',
        offerId: params.offerId,
        location,
        notes: note,
        selfBooked: true,
        requestedBy: params.requestedBy,
      },
    },
  });
  return { startsAt: startsAt.toISOString(), label: `${DAY_LABEL.format(startsAt)}, ${TIME_LABEL.format(startsAt)}`, title: match.offer.title };
}
