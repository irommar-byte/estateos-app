import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';
import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY, resolvePresentation } from '@/lib/crm/clientJourney';

/** Dzisiejsze pokazy CRM dla agenta (iPad rail). */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji.' }, { status: 403 });
  }

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  // also include next 36h for evening planning
  const horizon = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const schedule = await fetchUpcomingScheduleEvents(agencyUserId);
  const fromSchedule = schedule
    .filter((ev) => ev.kind === 'presentation' || ev.kind === 'acquisition')
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
      client: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 200,
  });

  const byClient = new Map<number, typeof acts>();
  for (const row of acts) {
    const list = byClient.get(row.client.id) || [];
    list.push(row);
    byClient.set(row.client.id, list);
  }

  const fromActivities = [...byClient.entries()]
    .map(([clientId, rows]) => {
      const slot = resolvePresentation(rows);
      if (!slot || slot.heldAt) return null;
      const t = new Date(slot.startsAt).getTime();
      if (Number.isNaN(t) || t < start.getTime() || t > horizon.getTime()) return null;
      const client = rows[0].client;
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
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    kind: string;
    title: string;
    clientName: string;
    location: string;
    startsAt: string;
    status: string;
    clientId: number | null;
    offerId: number | null;
  }>;

  const merged = [...fromActivities, ...fromSchedule.filter((s) => s.kind === 'presentation')];
  const seen = new Set<string>();
  const items = [];
  for (const item of merged.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())) {
    const key = `${item.clientId}-${item.startsAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return NextResponse.json({ success: true, items: items.slice(0, 20), dateLabel: now.toLocaleDateString('pl-PL') });
}
