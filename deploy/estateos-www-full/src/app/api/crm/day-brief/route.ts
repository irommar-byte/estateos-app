import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';
import { isSameWarsawDay } from '@/lib/crm/scheduleIdentity';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Wymagane logowanie.' }, { status: 401 });
  }

  const now = new Date();

  const agencyUserId = await requireAgencyUserId(req);

  const [schedule, newMatches] = await Promise.all([
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
  ]);

  const todaySchedule = schedule.filter((ev) => isSameWarsawDay(ev.startsAt, now));

  const items = todaySchedule
    .map((ev) => ({
      id: ev.id,
      kind: ev.kind,
      title: ev.title,
      subtitle: ev.subtitle || ev.location,
      startsAt: ev.startsAt,
      href: ev.href,
    }))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

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
      acquisitionToday: todaySchedule.filter((ev) => ev.kind === 'acquisition').length,
    },
  });
}
