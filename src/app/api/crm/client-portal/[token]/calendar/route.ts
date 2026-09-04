import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY, resolveMeeting, resolvePresentation } from '@/lib/crm/clientJourney';
import { buildCalendarIcs } from '@/lib/crm/calendarLinks';

type RouteCtx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const kind = new URL(req.url).searchParams.get('kind') === 'meeting' ? 'meeting' : 'presentation';
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: {
      firstName: true,
      lastName: true,
      agencyUser: { select: { name: true, companyName: true } },
      activities: {
        where: {
          kind: {
            in: [
              JOURNEY_ACTIVITY.MEETING,
              JOURNEY_ACTIVITY.MEETING_CHANGE,
              JOURNEY_ACTIVITY.MEETING_CONFIRMED,
              JOURNEY_ACTIVITY.PRESENTATION,
              JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
              JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true, metadata: true },
      },
    },
  });
  if (!client) return NextResponse.json({ error: 'Nie znaleziono panelu.' }, { status: 404 });

  const slot = kind === 'meeting' ? resolveMeeting(client.activities) : resolvePresentation(client.activities);
  if (!slot?.startsAt) return NextResponse.json({ error: 'Brak terminu.' }, { status: 404 });

  const agency = client.agencyUser.companyName || 'EstateOS';
  const title =
    kind === 'meeting'
      ? `Spotkanie z agentem · ${agency}`
      : `Prezentacja nieruchomości · ${agency}`;
  const ics = buildCalendarIcs({
    title,
    startsAt: new Date(slot.startsAt),
    location: slot.location,
    description: `${client.agencyUser.name || 'Agent'} · ${[client.firstName, client.lastName].filter(Boolean).join(' ')}`,
    uid: `portal-${kind}-${token}@estateos.pl`,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
