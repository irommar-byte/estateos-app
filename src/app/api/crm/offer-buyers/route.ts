import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { withOutboxResponse } from '@/lib/crm/clientOutbox';
import { prisma } from '@/lib/prisma';
import { saveAcquisitionPaperFile } from '@/lib/upload/acquisitionDocumentUpload';
import { parseStartsAtInput } from '@/lib/crm/clientJourney';
import {
  addBuyerToOffer,
  attachDealAttendance,
  canAccessOffer,
  getDeal,
  informSellerAboutDeal,
  listBuyerClientDeals,
  listOfferBuyerDeals,
  markDealViewed,
  requestBuyerFeedback,
  scheduleExternalViewing,
  setDealFeedback,
  setDealStatus,
  updateExternalBuyer,
  type DealSentiment,
  type DealStatus,
} from '@/lib/crm/offerBuyerDeals';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Kupujący na nieruchomości.
 *  GET ?offerId=   — wszyscy kupujący oferty (karta sprzedającego)
 *  GET ?buyerClientId= — nieruchomości, przy których kupujący jest w procesie (karta kupującego)
 *  GET ?dealId=    — jedna ścieżka kupującego
 *  POST { action, ... } albo multipart (file + dealId) — wgranie potwierdzenia prezentacji
 */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return fail('Dostęp tylko dla agencji i agentów.', 403);
  const url = new URL(req.url);
  const dealId = Number(url.searchParams.get('dealId') || 0);
  const offerId = Number(url.searchParams.get('offerId') || 0);
  const buyerClientId = Number(url.searchParams.get('buyerClientId') || 0);

  if (dealId) {
    const deal = await getDeal(agencyUserId, dealId);
    return deal ? NextResponse.json({ success: true, deal }) : fail('Nie znaleziono kupującego przy tej ofercie.', 404);
  }
  if (offerId) {
    if (!(await canAccessOffer(agencyUserId, offerId))) return fail('Nie masz dostępu do tej oferty.', 403);
    return NextResponse.json({ success: true, deals: await listOfferBuyerDeals(agencyUserId, offerId) });
  }
  if (buyerClientId) {
    const owned = await prisma.agencyClient.count({ where: { id: buyerClientId, agencyUserId } });
    if (!owned) return fail('Nie znaleziono klienta.', 404);
    return NextResponse.json({ success: true, deals: await listBuyerClientDeals(agencyUserId, buyerClientId) });
  }
  return fail('Podaj ofertę, kupującego albo ścieżkę.');
}

export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return fail('Dostęp tylko dla agencji i agentów.', 403);

  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const dealId = Number(form?.get('dealId') || 0);
    if (!dealId || !file || typeof file === 'string') return fail('Dodaj plik potwierdzenia.');
    const deal = await getDeal(agencyUserId, dealId);
    if (!deal) return fail('Nie znaleziono kupującego przy tej ofercie.', 404);
    const saved = await saveAcquisitionPaperFile({
      clientId: deal.buyer.kind === 'client' ? deal.buyer.clientId : deal.seller?.clientId || deal.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeTypeDeclared: file.type,
      originalFileName: file.name || `potwierdzenie-${deal.offerId}`,
    });
    if (!saved.ok) return fail(saved.error, saved.status);
    await attachDealAttendance({ agencyUserId, dealId, url: saved.url, name: saved.name });
    return NextResponse.json({ success: true, deal: await getDeal(agencyUserId, dealId) });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  const dealId = Number(body.dealId || 0);

  return withOutboxResponse(async () => {
    try {
      if (action === 'add_buyer') {
        const offerId = Number(body.offerId || 0);
        if (!offerId || !(await canAccessOffer(agencyUserId, offerId))) return fail('Nie masz dostępu do tej oferty.', 403);
        const newBuyer = body.newBuyer && typeof body.newBuyer === 'object' ? (body.newBuyer as Record<string, string>) : null;
        const external = body.external && typeof body.external === 'object' ? (body.external as Record<string, string>) : null;
        const id = await addBuyerToOffer({
          agencyUserId,
          offerId,
          buyerClientId: Number(body.buyerClientId || 0) || null,
          newBuyer: newBuyer ? { firstName: newBuyer.firstName, lastName: newBuyer.lastName, phone: newBuyer.phone, email: newBuyer.email } : null,
          external,
        });
        return NextResponse.json({ success: true, deal: await getDeal(agencyUserId, id) });
      }

      if (!dealId) return fail('Wybierz kupującego.');

      if (action === 'update_external') {
        const external = (body.external && typeof body.external === 'object' ? body.external : {}) as Record<string, string>;
        await updateExternalBuyer({ agencyUserId, dealId, ...external });
      } else if (action === 'schedule_external') {
        const startsAt = parseStartsAtInput(body.startsAt);
        if (!startsAt) return fail('Wybierz termin i godzinę.');
        await scheduleExternalViewing({ agencyUserId, dealId, startsAt });
      } else if (action === 'mark_viewed') {
        await markDealViewed({ agencyUserId, dealId });
      } else if (action === 'set_feedback') {
        const sentiment = String(body.sentiment || '') as DealSentiment;
        if (!['like', 'maybe', 'dislike'].includes(sentiment)) return fail('Wybierz, jak kupującemu się podobało.');
        await setDealFeedback({ agencyUserId, dealId, sentiment, note: body.note ? String(body.note) : null });
      } else if (action === 'request_feedback') {
        await requestBuyerFeedback({ agencyUserId, dealId });
      } else if (action === 'inform_seller') {
        await informSellerAboutDeal({ agencyUserId, dealId, message: body.message ? String(body.message) : null });
      } else if (action === 'set_status') {
        const status = String(body.status || '') as DealStatus;
        if (!['ACTIVE', 'PAUSED', 'LOST'].includes(status)) return fail('Nieznany status.');
        await setDealStatus({
          agencyUserId,
          dealId,
          status,
          searchOther: typeof body.searchOther === 'boolean' ? body.searchOther : undefined,
          searchNote: body.searchNote ? String(body.searchNote) : null,
        });
      } else {
        return fail('Nieznana akcja.');
      }
      return NextResponse.json({ success: true, deal: await getDeal(agencyUserId, dealId) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Coś poszło nie tak.');
    }
  });
}
