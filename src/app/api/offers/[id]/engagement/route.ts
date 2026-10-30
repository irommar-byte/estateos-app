import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import { actorMayManageOfferMedia } from '@/lib/upload/offerGalleryMaintenance';
import { resolvePortalAccess } from '@/lib/crm/portalAccess';
import { loadEngagementSummary, recordEngagement, type EngagementEvent } from '@/lib/offerEngagement';

type Ctx = { params: Promise<{ id: string }> };

/** Pomiar z przeglądarki (sendBeacon): { events: [{ kind: 'photo'|'room', key, ms }] }. Anonimowo, zagregowane. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  const text = await req.text().catch(() => '');
  let events: EngagementEvent[] = [];
  try {
    const body = JSON.parse(text || '{}') as { events?: EngagementEvent[] };
    events = Array.isArray(body.events) ? body.events : [];
  } catch {
    events = [];
  }
  await recordEngagement(offerId, events).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}

/** Podsumowanie — tylko dla agenta / właściciela oferty albo sprzedającego z jego panelu klienta (?portal=token). */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId) || offerId <= 0) return NextResponse.json({ error: 'Złe ID.' }, { status: 400 });
  const portal = new URL(req.url).searchParams.get('portal');
  let allowed = false;
  if (portal) {
    const access = await resolvePortalAccess(portal).catch(() => null);
    if (access) {
      const client = await prisma.agencyClient.findFirst({
        where: { portalToken: access.portalToken, status: 'ACTIVE' },
        select: { linkedOfferId: true },
      });
      allowed = client?.linkedOfferId === offerId;
    }
  } else {
    const userId = await resolveUploaderUserId(req);
    if (userId) {
      const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { userId: true } });
      allowed = Boolean(offer && (await actorMayManageOfferMedia(offer.userId, userId)));
    }
  }
  if (!allowed) return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  return NextResponse.json(await loadEngagementSummary(offerId), { headers: { 'Cache-Control': 'private, max-age=30' } });
}
