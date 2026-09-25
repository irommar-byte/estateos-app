import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';
import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY, resolvePresentation } from '@/lib/crm/clientJourney';

type ShowingItem = {
  id: string;
  kind: string;
  title: string;
  clientName: string;
  location: string;
  startsAt: string;
  status: string;
  clientId: number | null;
  offerId: number | null;
  role: 'BUYER' | 'SELLER' | null;
};

/** Dzisiejsze pokazy CRM dla agenta (iPad rail) — tylko kupujący (gość na wizycie). */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji.' }, { status: 403 });
  }

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const horizon = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const schedule = await fetchUpcomingScheduleEvents(agencyUserId);
  const fromSchedule: ShowingItem[] = schedule
    .filter((ev) => ev.kind === 'presentation')
    .filter((ev) => {
      const t = new Date(ev.startsAt).getTime();
      return t >= start.getTime() && t <= horizon.getTime();
    })
    .map((ev) => {
      const href = String(ev.href || '');
      const m = href.match(/clientId=(\d+)/);
      return {
        id: ev.id,
        kind: ev.kind,
        title: ev.title,
        clientName: ev.subtitle,
        location: ev.location || '',
        startsAt: ev.startsAt,
        status: ev.status,
        clientId: m ? Number(m[1]) : null,
        offerId: null as number | null,
        role: null as 'BUYER' | 'SELLER' | null,
      };
    });

  const acts = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId,
      kind: {
        in: [
          JOURNEY_ACTIVITY.PRESENTATION,
          JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
          JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
        ],
      },
      client: { status: 'ACTIVE' },
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, type: true } },
    },
    take: 200,
  });

  const byClient = new Map<number, typeof acts>();
  for (const row of acts) {
    const list = byClient.get(row.client.id) || [];
    list.push(row);
    byClient.set(row.client.id, list);
  }

  const fromActivities: ShowingItem[] = [...byClient.entries()]
    .map(([clientId, rows]) => {
      const slot = resolvePresentation(rows);
      if (!slot || slot.heldAt) return null;
      const t = new Date(slot.startsAt).getTime();
      if (Number.isNaN(t) || t < start.getTime() || t > horizon.getTime()) return null;
      const client = rows[0].client;
      const buyerId = slot.buyerClientId || (client.type === 'BUYER' ? client.id : null);
      // Rail = tylko gość na wizycie (kupujący), nigdy właściciel.
      if (client.type === 'SELLER') return null;
      if (buyerId && buyerId !== clientId) return null;
      if (client.type !== 'BUYER') return null;
      return {
        id: `pres-${clientId}-${slot.startsAt}`,
        kind: 'presentation' as const,
        title: 'Prezentacja nieruchomości',
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        location: slot.location || '',
        startsAt: slot.startsAt,
        status: slot.status,
        clientId,
        offerId: slot.offerId,
        role: 'BUYER' as const,
      };
    })
    .filter(Boolean) as ShowingItem[];

  // Resolve roles for schedule-sourced rows and drop sellers.
  const scheduleClientIds = [
    ...new Set(fromSchedule.map((s) => s.clientId).filter((id): id is number => Boolean(id))),
  ];
  const scheduleClients = scheduleClientIds.length
    ? await prisma.agencyClient.findMany({
        where: { id: { in: scheduleClientIds }, agencyUserId },
        select: { id: true, type: true, firstName: true, lastName: true },
      })
    : [];
  const typeById = new Map(scheduleClients.map((c) => [c.id, c.type]));
  const filteredSchedule = fromSchedule.filter((item) => {
    if (!item.clientId) return false;
    const type = typeById.get(item.clientId);
    if (type === 'SELLER') return false;
    item.role = type === 'BUYER' ? 'BUYER' : null;
    return type === 'BUYER';
  });

  const merged = [...fromActivities, ...filteredSchedule];
  const seen = new Set<string>();
  const items: ShowingItem[] = [];
  for (const item of merged.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())) {
    const key = `${item.offerId || 'x'}-${item.startsAt}-${item.clientId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return NextResponse.json({
    success: true,
    items: items.slice(0, 20),
    dateLabel: now.toLocaleDateString('pl-PL'),
  });
}
