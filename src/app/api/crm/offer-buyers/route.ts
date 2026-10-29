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
  type TransactionStepId,
} from '@/lib/crm/offerBuyerDeals';
import {
  addNegotiationOffer,
  attachStepFile,
  decideOtherBuyers,
  messageBuyer,
  sendOfferToSeller,
  setNegotiationDetails,
  setOfferStatus,
  sendOffer,
  recordOfferResponse,
  approveOfferResponse,
  skipReservation,
  setReservation,
  setTransactionStep,
  startDealDocuments,
  startNegotiation,
} from '@/lib/crm/offerBuyerDealSteps';

const STEPS: TransactionStepId[] = ['preliminary', 'deed', 'handover', 'commission'];

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Kupujący na nieruchomości.
 *  GET ?offerId=   — wszyscy kupujący oferty (karta sprzedającego)
 *  GET ?buyerClientId= — nieruchomości, przy których kupujący jest w procesie (karta kupującego)
 *  GET ?dealId=    — jedna ścieżka kupującego
 *  POST { action, ... } albo multipart (file + dealId + kind) — potwierdzenie prezentacji albo plik etapu transakcji
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
    const kind = String(form?.get('kind') || 'attendance');
    if (!dealId || !file || typeof file === 'string') return fail('Dodaj plik.');
    const deal = await getDeal(agencyUserId, dealId);
    if (!deal) return fail('Nie znaleziono kupującego przy tej ofercie.', 404);
    const saved = await saveAcquisitionPaperFile({
      clientId: deal.buyer.kind === 'client' ? deal.buyer.clientId : deal.seller?.clientId || deal.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeTypeDeclared: file.type,
      originalFileName: file.name || `potwierdzenie-${deal.offerId}`,
    });
    if (!saved.ok) return fail(saved.error, saved.status);
    if (STEPS.includes(kind as TransactionStepId)) {
      await attachStepFile({ agencyUserId, dealId, step: kind as TransactionStepId, url: saved.url, name: saved.name });
    } else {
      await attachDealAttendance({ agencyUserId, dealId, url: saved.url, name: saved.name });
    }
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
      let otherActive = 0;

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
      } else if (action === 'start_negotiation') {
        await startNegotiation({ agencyUserId, dealId });
      } else if (action === 'add_offer') {
        const by = body.by === 'seller' ? 'seller' : 'buyer';
        await addNegotiationOffer({ agencyUserId, dealId, by, amount: body.amount, note: body.note ? String(body.note) : null });
      } else if (action === 'set_offer_status') {
        const status = String(body.status || '');
        if (!['accepted', 'rejected', 'withdrawn'].includes(status)) return fail('Nieznany status propozycji.');
        await setOfferStatus({ agencyUserId, dealId, offerId: String(body.offerId || ''), status: status as 'accepted' | 'rejected' | 'withdrawn' });
      } else if (action === 'send_offer_to_seller') {
        const kind = String(body.recommendationKind || '');
        await sendOfferToSeller({
          agencyUserId,
          dealId,
          offerId: String(body.offerId || ''),
          recommendation: body.recommendation ? String(body.recommendation) : null,
          recommendationKind: ['accept', 'counter', 'reject'].includes(kind) ? (kind as 'accept' | 'counter' | 'reject') : null,
        });
      } else if (action === 'message_buyer') {
        await messageBuyer({ agencyUserId, dealId, message: String(body.message || ''), offerId: body.offerId ? String(body.offerId) : null });
      } else if (action === 'set_negotiation') {
        await setNegotiationDetails({
          agencyUserId,
          dealId,
          financing: body.financing && typeof body.financing === 'object' ? (body.financing as Record<string, string>) : null,
          terms: body.terms && typeof body.terms === 'object' ? (body.terms as Record<string, unknown>) : null,
        });
      } else if (action === 'set_reservation') {
        otherActive = (await setReservation({ agencyUserId, dealId, until: body.until })).otherActive;
      } else if (action === 'decide_others') {
        await decideOtherBuyers({ agencyUserId, dealId, decision: body.decision === 'paused' ? 'paused' : 'backup' });
      } else if (action === 'set_step') {
        const step = String(body.step || '') as TransactionStepId;
        if (!STEPS.includes(step)) return fail('Nieznany etap transakcji.');
        otherActive = (
          await setTransactionStep({
            agencyUserId,
            dealId,
            step,
            date: body.date,
            place: body.place,
            amount: body.amount,
            note: body.note,
            done: typeof body.done === 'boolean' ? body.done : undefined,
          })
        ).otherActive;
      } else if (action === 'send_offer') {
        await sendOffer({ agencyUserId, dealId, offerId: String(body.offerId || ''), recommendation: body.recommendation ? String(body.recommendation) : null });
      } else if (action === 'record_response') {
        const kind = String(body.kind || '');
        if (!['accept', 'counter', 'reject'].includes(kind)) return fail('Wybierz odpowiedź.');
        await recordOfferResponse({ agencyUserId, dealId, offerId: String(body.offerId || ''), kind: kind as 'accept' | 'counter' | 'reject', amount: body.amount, comment: body.comment ? String(body.comment) : null });
      } else if (action === 'approve_response') {
        await approveOfferResponse({ agencyUserId, dealId, offerId: String(body.offerId || '') });
      } else if (action === 'skip_reservation') {
        await skipReservation({ agencyUserId, dealId });
      } else if (action === 'start_documents') {
        await startDealDocuments({ agencyUserId, dealId });
      } else {
        return fail('Nieznana akcja.');
      }
      return NextResponse.json({ success: true, deal: await getDeal(agencyUserId, dealId), otherActive });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Coś poszło nie tak.');
    }
  });
}
