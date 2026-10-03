import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';
import { isSameWarsawDay } from '@/lib/crm/scheduleIdentity';

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
  const schedule = await fetchUpcomingScheduleEvents(agencyUserId);
  const items: ShowingItem[] = schedule
    .filter((ev) => ev.kind === 'presentation')
    .filter((ev) => ev.role !== 'SELLER')
    .filter((ev) => isSameWarsawDay(ev.startsAt, now))
    .map((ev) => {
      const href = String(ev.href || '');
      const fromHref = href.match(/clientId=(\d+)/);
      const clientId = ev.clientId || (fromHref ? Number(fromHref[1]) : null);
      return {
        id: ev.id,
        kind: ev.kind,
        title: ev.title,
        clientName: ev.subtitle,
        location: ev.location || '',
        startsAt: ev.startsAt,
        status: ev.status,
        clientId,
        offerId: ev.offerId || null,
        role: ev.role || (clientId ? 'BUYER' : null),
      };
    });

  return NextResponse.json({
    success: true,
    items: items.slice(0, 20),
    dateLabel: now.toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' }),
  });
}
