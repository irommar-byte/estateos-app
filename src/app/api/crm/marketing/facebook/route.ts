import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  connectFacebookPage,
  disconnectFacebookPage,
  prepareGroupShares,
  promotionOverview,
  publishOfferToPage,
  recordGroupShare,
  refreshPageStats,
  removeFacebookGroup,
  saveFacebookGroup,
  marketingScopeKey,
} from '@/lib/crm/facebookPromotion';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Panel promocji na Facebooku w aplikacji agenta. GET ?offerId= → strona, grupy, zasięg. */
export async function GET(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla agentów.' }, { status: 403 });
  const offerId = Number(new URL(req.url).searchParams.get('offerId') || 0) || null;
  try {
    return NextResponse.json({ success: true, ...(await promotionOverview(userId, offerId)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nie udało się wczytać promocji.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla agentów.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  const offerId = Number(body.offerId || 0);
  const fail = (e: unknown, status = 400) =>
    NextResponse.json({ error: e instanceof Error ? e.message : String(e || 'Błąd') }, { status });
  try {
    if (action === 'connect_page') {
      const result = await connectFacebookPage({ userId, token: String(body.token || ''), pageId: body.pageId ? String(body.pageId) : null });
      return NextResponse.json({ success: result.ok, ...result });
    }
    if (action === 'disconnect_page') {
      await disconnectFacebookPage(userId);
      return NextResponse.json({ success: true });
    }
    if (action === 'save_group') {
      const group = await saveFacebookGroup({
        userId,
        id: body.id ? Number(body.id) : null,
        name: String(body.name || ''),
        url: String(body.url || ''),
        city: body.city ? String(body.city) : null,
        members: body.members === '' || body.members == null ? null : Number(String(body.members).replace(/\s/g, '')),
        note: body.note ? String(body.note) : null,
      });
      return NextResponse.json({ success: true, group });
    }
    if (action === 'remove_group') {
      await removeFacebookGroup(userId, Number(body.id));
      return NextResponse.json({ success: true });
    }
    if (action === 'publish_page') {
      if (!offerId) return fail('Wybierz ogłoszenie.');
      const result = await publishOfferToPage({
        userId,
        offerId,
        clientId: body.clientId ? Number(body.clientId) : null,
        message: body.message ? String(body.message) : null,
        visibleToClient: body.visibleToClient !== false,
        withPhotos: body.withPhotos !== false,
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === 'prepare_groups') {
      if (!offerId) return fail('Wybierz ogłoszenie.');
      const ids = Array.isArray(body.groupIds) ? body.groupIds.map(Number).filter(Number.isFinite) : [];
      const result = await prepareGroupShares({ userId, offerId, clientId: body.clientId ? Number(body.clientId) : null, groupIds: ids });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === 'record_group') {
      const result = await recordGroupShare({
        userId,
        publicationId: Number(body.publicationId),
        postUrl: body.postUrl ? String(body.postUrl) : null,
        skipped: body.skipped === true,
        visibleToClient: body.visibleToClient !== false,
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === 'refresh_stats') {
      const scopeKey = await marketingScopeKey(userId);
      const result = await refreshPageStats({ scopeKey, offerId: offerId || undefined, maxAgeMs: 10 * 60 * 1000, limit: 20 });
      return NextResponse.json({ success: true, ...result });
    }
    return fail('Nieznana akcja.');
  } catch (e) {
    return fail(e);
  }
}
