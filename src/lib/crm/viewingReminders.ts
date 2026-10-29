import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY, resolveMeeting, resolvePresentation, type ScheduleSlot } from '@/lib/crm/clientJourney';
import { parsePortalPermissions } from '@/lib/crm/portalAccess';
import { buildClientVoice } from '@/lib/crm/clientVoice';

/**
 * Przypomnienia przed oglądaniem / spotkaniem: dzień wcześniej i ok. 2 godziny przed.
 * Tylko dla terminów POTWIERDZONYCH przez agenta — potwierdzenie terminu jest zgodą na przypomnienie
 * (agent może je wyłączyć uprawnieniem „viewingReminders”).
 * Odpalane co godzinę z crona client-intelligence.
 */

const REMINDER_KIND = 'VIEWING_REMINDER';
const H = 60 * 60 * 1000;

const WHEN = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const TIME = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });

type Which = '24h' | '2h';

function dueWhich(startsAt: number, now: number): Which | null {
  const diff = startsAt - now;
  if (diff > 20 * H && diff <= 26 * H) return '24h';
  if (diff > 0.75 * H && diff <= 2.75 * H) return '2h';
  return null;
}

export async function scanViewingReminders(): Promise<{ sent: number }> {
  const now = Date.now();
  const seedRows = await prisma.agencyClientActivity.findMany({
    where: {
      kind: {
        in: [
          JOURNEY_ACTIVITY.PRESENTATION,
          JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
          JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
          JOURNEY_ACTIVITY.MEETING,
          JOURNEY_ACTIVITY.MEETING_CHANGE,
          JOURNEY_ACTIVITY.MEETING_CONFIRMED,
        ],
      },
      createdAt: { gte: new Date(now - 45 * 24 * H) },
    },
    select: { clientId: true },
    distinct: ['clientId'],
    take: 500,
  });
  if (!seedRows.length) return { sent: 0 };
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  let sent = 0;

  for (const { clientId } of seedRows) {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, status: 'ACTIVE' },
      select: {
        id: true,
        agencyUserId: true,
        firstName: true,
        salutation: true,
        email: true,
        portalToken: true,
        portalPermissions: true,
        agencyUser: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!client) continue;
    if (parsePortalPermissions(client.portalPermissions).viewingReminders === false) continue;
    const activities = await prisma.agencyClientActivity.findMany({
      where: {
        clientId,
        kind: {
          in: [
            ...Object.values(JOURNEY_ACTIVITY),
            REMINDER_KIND,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true, metadata: true },
    });
    const candidates: Array<{ type: 'presentation' | 'meeting'; slot: ScheduleSlot }> = [];
    const presentation = resolvePresentation(activities);
    if (presentation && !presentation.heldAt) candidates.push({ type: 'presentation', slot: presentation });
    const meeting = resolveMeeting(activities);
    if (meeting) candidates.push({ type: 'meeting', slot: meeting });

    for (const { type, slot } of candidates) {
      if (slot.status !== 'confirmed') continue;
      const startsAt = new Date(slot.startsAt).getTime();
      if (!Number.isFinite(startsAt)) continue;
      const which = dueWhich(startsAt, now);
      if (!which) continue;
      const already = activities.some((row) => {
        if (row.kind !== REMINDER_KIND) return false;
        const meta = (row.metadata || {}) as Record<string, unknown>;
        return meta.startsAt === slot.startsAt && meta.which === which && meta.type === type;
      });
      if (already) continue;

      const voice = buildClientVoice({ clientId: client.id, firstName: client.firstName, salutation: client.salutation, agentName: client.agencyUser?.name });
      const offer = slot.offerId
        ? await prisma.offer.findUnique({ where: { id: slot.offerId }, select: { title: true, street: true, district: true, city: true } })
        : null;
      const place = slot.location || (offer ? [offer.street, offer.district, offer.city].filter(Boolean).join(', ') : '');
      const what = type === 'presentation' ? 'Oglądanie' : 'Spotkanie';
      const whenLabel = which === '24h' ? `jutro o ${TIME.format(new Date(startsAt))}` : `dziś o ${TIME.format(new Date(startsAt))}`;
      const title = `${what} ${whenLabel}`;
      const body = [offer?.title, place].filter(Boolean).join(' · ') || WHEN.format(new Date(startsAt));
      const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : undefined;
      const mapsUrl = place ? `https://maps.apple.com/?q=${encodeURIComponent(place)}` : null;
      const agentPhone = client.agencyUser?.phone || '';

      const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
        {
          kind: 'push',
          clientId: client.id,
          payload: { title, body: `${body}. Gdyby coś wypadło — przełóż termin w panelu.`, tag: `reminder-${type}-${client.id}`, url: portalUrl },
        },
      ];
      if (which === '24h' && client.email) {
        const html = await buildClientMessageEmailHtml({
          agencyUserId: client.agencyUserId,
          client,
          eyebrow: 'Przypomnienie',
          title: `${what} ${whenLabel}`,
          paragraphs: [
            `Przypominam o naszym terminie. Gdyby coś wypadło, termin można przełożyć jednym kliknięciem w panelu${agentPhone ? ` albo dzwoniąc pod ${agentPhone}` : ''}.`,
          ],
          property: offer?.title ? { title: offer.title, address: place || null } : place ? { title: place } : null,
          facts: [{ label: 'Termin', value: WHEN.format(new Date(startsAt)) }],
          ctas: [
            ...(portalUrl ? [{ label: 'Otwórz panel', href: portalUrl }] : []),
            ...(mapsUrl ? [{ label: 'Pokaż na mapie', href: mapsUrl, variant: 'soft' as const }] : []),
          ],
        });
        steps.push(emailStep({ to: client.email, subject: `Przypomnienie: ${what.toLowerCase()} ${whenLabel}`, html, replyTo: client.agencyUser?.email || undefined }));
      }

      await deliverToClient({
        agencyUserId: client.agencyUserId,
        clientId: client.id,
        category: 'schedule',
        source: 'viewing_reminder',
        approved: true,
        steps,
      }).catch(() => null);
      await prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          offerId: slot.offerId,
          kind: REMINDER_KIND,
          title: `Wysłano przypomnienie: ${title}`.slice(0, 250),
          metadata: { startsAt: slot.startsAt, which, type },
        },
      });
      sent += 1;
    }
  }
  return { sent };
}
