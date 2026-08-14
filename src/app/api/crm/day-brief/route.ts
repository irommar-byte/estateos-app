import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Wymagane logowanie.' }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const agencyUserId = await requireAgencyUserId(req);

  const [schedule, newMatches, acquisitionActs] = await Promise.all([
    fetchUpcomingScheduleEvents(userId),
    agencyUserId
      ? prisma.agencyClientMatch.count({
          where: {
            client: { agencyUserId, status: 'ACTIVE', type: 'BUYER' },
            sharedAt: null,
            notifiedAt: null,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        })
      : Promise.resolve(0),
    agencyUserId
      ? prisma.agencyClientActivity.findMany({
          where: {
            agencyUserId,
            kind: 'ACQUISITION_MEETING',
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: {
            client: { select: { firstName: true, lastName: true, id: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const todaySchedule = schedule.filter((ev) => {
    const t = new Date(ev.startsAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });

  const acquisitionToday = acquisitionActs
    .map((a) => {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      const startsAt = typeof meta.startsAt === 'string' ? meta.startsAt : null;
      if (!startsAt) return null;
      const t = new Date(startsAt).getTime();
      if (Number.isNaN(t) || t < start.getTime() || t > end.getTime()) return null;
      return {
        id: `acq-${a.id}`,
        kind: 'acquisition',
        title: a.title || `Pozyskanie · ${a.client.firstName} ${a.client.lastName}`,
        subtitle: typeof meta.location === 'string' ? meta.location : a.body,
        startsAt,
        href: `/moje-konto/crm?tab=klienci&clientId=${a.client.id}`,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    kind: string;
    title: string;
    subtitle?: string | null;
    startsAt?: string | null;
    href?: string | null;
  }>;

  const items = [
    ...acquisitionToday,
    ...todaySchedule.map((ev) => ({
      id: ev.id,
      kind: ev.kind,
      title: ev.title,
      subtitle: ev.subtitle || ev.location,
      startsAt: ev.startsAt,
      href: ev.href,
    })),
  ].sort((a, b) => {
    const at = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const bt = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    return at - bt;
  });

  return NextResponse.json({
    success: true,
    brief: {
      greeting: 'Dzień dobry',
      dateLabel: now.toLocaleDateString('pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      items,
      newMatches,
      acquisitionToday: acquisitionToday.length,
    },
  });
}
