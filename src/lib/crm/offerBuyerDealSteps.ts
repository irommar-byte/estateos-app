import { prisma } from '@/lib/prisma';
import {
  day,
  getDeal,
  ownedDeal,
  parseData,
  pln,
  when,
  withEvent,
  type DealData,
  type DealView,
  type Negotiation,
  type NegotiationOffer,
  type OfferResponse,
  OFFER_RESPONSE_HOURS,
  type OfferSide,
  type TransactionStep,
  type TransactionStepId,
} from '@/lib/crm/offerBuyerDeals';

/**
 * Negocjacje i transakcja na ścieżce kupujący ↔ nieruchomość.
 * Ping-pong: propozycja jednej strony → agent zatwierdza → druga strona dostaje ją od razu (push, e-mail, panel)
 * z czasem na odpowiedź 48 h. Zatwierdzenie agenta jest akceptacją wysyłki — bez drugiego kroku w kolejce.
 */

type Deal = Awaited<ReturnType<typeof ownedDeal>>;

async function save(deal: Deal, text: string, patch: (data: DealData) => DealData, extra: Record<string, unknown> = {}) {
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: { ...extra, data: withEvent(deal.data, { actor: 'agent', text }, new Date(), patch) },
  });
}

function patchNegotiation(data: DealData, change: (neg: Negotiation) => Negotiation): DealData {
  return { ...data, negotiation: change({ ...(data.negotiation || {}) }) };
}

function newId() {
  return `${Date.now().toString(36)}${Math.round(Math.random() * 1e4).toString(36)}`;
}

function money(raw: unknown): number | null {
  const n = Math.round(Number(String(raw ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dateOrNull(raw: unknown): string | null {
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Ilu innych aktywnych kupujących jest przy tej nieruchomości — pytamy agenta, co z nimi. */
async function otherActiveCount(deal: Deal) {
  return prisma.offerBuyerDeal.count({
    where: { offerId: deal.offerId, agencyUserId: deal.agencyUserId, status: 'ACTIVE', id: { not: deal.id } },
  });
}

/* ───────────────────────── negocjacje ───────────────────────── */

export async function startNegotiation(params: { agencyUserId: number; dealId: number }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const view = await getDeal(params.agencyUserId, deal.id);
  const skipped = !view?.presentation?.heldAt;
  await save(
    deal,
    skipped ? 'Klient kupuje — przechodzimy do negocjacji bez prezentacji' : 'Klient kupuje — przechodzimy do negocjacji',
    (data) =>
      patchNegotiation(data, (neg) => ({
        ...neg,
        startedAt: neg.startedAt || new Date().toISOString(),
        skippedPresentation: skipped,
      })),
    { status: 'ACTIVE' },
  );
}

export async function addNegotiationOffer(params: { agencyUserId: number; dealId: number; by: OfferSide; amount: unknown; note?: string | null }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const amount = money(params.amount);
  if (!amount) throw new Error('Podaj kwotę.');
  const note = String(params.note || '').trim().slice(0, 1000) || null;
  const at = new Date().toISOString();
  await save(
    deal,
    `${params.by === 'buyer' ? 'Kupujący proponuje' : 'Sprzedający chce'} ${pln(amount)}${note ? ` — ${note}` : ''}`,
    (data) =>
      patchNegotiation(data, (neg) => ({
        ...neg,
        startedAt: neg.startedAt || at,
        // Nowa propozycja zamyka poprzednie otwarte jako „kontroferta”.
        offers: [
          ...(neg.offers || []).map((offer) => (offer.status === 'open' ? { ...offer, status: 'countered' as const } : offer)),
          { id: newId(), at, by: params.by, amount, note, status: 'open' },
        ],
      })),
  );
}

export async function setOfferStatus(params: { agencyUserId: number; dealId: number; offerId: string; status: 'accepted' | 'rejected' | 'withdrawn' }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const view = await getDeal(params.agencyUserId, deal.id);
  const offer = view?.negotiation.offers.find((row) => row.id === params.offerId);
  if (!offer) throw new Error('Nie znaleziono tej propozycji.');
  const label = { accepted: 'Uzgodniono cenę', rejected: 'Odrzucono propozycję', withdrawn: 'Wycofano propozycję' }[params.status];
  await save(deal, `${label}: ${pln(offer.amount)}`, (data) =>
    patchNegotiation(data, (neg) => {
      const stored = neg.offers || [];
      // Kontroferta sprzedającego z panelu istnieje tylko w widoku — zapisujemy ją przy decyzji agenta.
      const offers = stored.some((row) => row.id === offer.id) ? stored : [...stored, offer];
      return {
        ...neg,
        offers: offers.map((row) => (row.id === offer.id ? { ...row, status: params.status } : row)),
        agreedPrice: params.status === 'accepted' ? offer.amount : neg.agreedPrice ?? null,
      };
    }),
  );
}

/** Propozycja kupującego trafia do panelu sprzedającego (bez danych kupującego) — po akceptacji agenta. */
export async function sendOfferToSeller(params: {
  agencyUserId: number;
  dealId: number;
  offerId: string;
  recommendation?: string | null;
  recommendationKind?: 'accept' | 'counter' | 'reject' | null;
}) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (!deal.sellerClientId) throw new Error('Ta oferta nie ma sprzedającego w Twoim CRM.');
  const view = await getDeal(params.agencyUserId, deal.id);
  const offer = view?.negotiation.offers.find((row) => row.id === params.offerId);
  if (!view || !offer || offer.by !== 'buyer') throw new Error('Wybierz propozycję kupującego.');
  const neg = view.negotiation;
  const ordinal =
    (await prisma.offerBuyerDeal.count({ where: { offerId: deal.offerId, agencyUserId: deal.agencyUserId, id: { lte: deal.id } } })) || 1;
  const weeksUntil = (iso: string | null | undefined) =>
    iso ? Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / (7 * 24 * 3600 * 1000))) : null;
  const daysUntil = (iso: string | null | undefined) =>
    iso ? Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000))) : null;
  const recommendation = String(params.recommendation || '').trim().slice(0, 2000) || null;
  const buyerLabel = `Kupujący ${ordinal}`;
  const row = await prisma.sellerBuyerOffer.create({
    data: {
      clientId: deal.sellerClientId,
      agencyUserId: params.agencyUserId,
      buyerLabel,
      amount: offer.amount,
      financing: neg.financing?.kind || 'cash',
      deposit: neg.terms?.deposit ?? null,
      deedWeeks: weeksUntil(neg.terms?.deedAt),
      handoverDays: daysUntil(neg.terms?.handoverAt),
      note: offer.note,
      recommendation,
      recommendationKind: params.recommendationKind || null,
      respondBy: new Date(Date.now() + OFFER_RESPONSE_HOURS * 3600 * 1000),
    },
    select: { id: true },
  });
  const seller = await prisma.agencyClient.findFirst({
    where: { id: deal.sellerClientId, agencyUserId: params.agencyUserId },
    select: { id: true, firstName: true, salutation: true, email: true, portalToken: true, agencyUser: { select: { name: true, email: true } } },
  });
  let queued = false;
  if (seller) {
    const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
    const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
    const { buildClientMessageEmailHtml, tidySentence } = await import('@/lib/crm/clientMessageEmail');
    const portalUrl = seller.portalToken ? buildPortalUrl(seller.portalToken) : null;
    const financing = neg.financing?.kind === 'mortgage' ? 'Kredyt' : neg.financing?.kind === 'mixed' ? 'Gotówka + kredyt' : neg.financing?.kind === 'cash' ? 'Gotówka' : '';
    const text = `${buyerLabel} proponuje ${pln(offer.amount)}. Możesz przyjąć, odrzucić albo zaproponować swoją kwotę w panelu.`;
    const steps: Parameters<typeof deliverToClient>[0]['steps'] = [];
    if (portalUrl) steps.push({ kind: 'push', clientId: seller.id, payload: { title: 'Nowa oferta kupującego', body: text.slice(0, 170), tag: `buyer-offer-${row.id}`, url: portalUrl } });
    if (seller.email) {
      const html = await buildClientMessageEmailHtml({
        agencyUserId: params.agencyUserId,
        client: seller,
        eyebrow: 'Oferta kupującego',
        title: `${pln(offer.amount)} za Twoją nieruchomość`,
        paragraphs: [
          `${buyerLabel} złożył ofertę zakupu. Poniżej najważniejsze warunki${recommendation ? ' i moja rekomendacja' : ''}.`,
          `Decyzję podejmiesz jednym kliknięciem w panelu: przyjmij, odrzuć albo zaproponuj swoją kwotę. Na odpowiedź masz ${OFFER_RESPONSE_HOURS} godziny.`,
        ],
        property: { title: view.offer.title, address: view.offer.address || null },
        facts: [
          { label: 'Proponowana cena', value: pln(offer.amount) },
          { label: 'Finansowanie', value: financing },
          { label: 'Zadatek', value: neg.terms?.deposit ? pln(neg.terms.deposit) : '' },
          { label: 'Akt notarialny', value: neg.terms?.deedAt ? day(neg.terms.deedAt) : '' },
          { label: 'Przekazanie', value: neg.terms?.handoverAt ? day(neg.terms.handoverAt) : '' },
        ],
        quote: recommendation ? { label: 'Moja rekomendacja', text: tidySentence(recommendation) } : offer.note ? { label: 'Uwagi kupującego', text: tidySentence(offer.note) } : null,
        ctas: portalUrl ? [{ label: 'Odpowiedz w panelu', href: portalUrl }] : [],
      });
      steps.push(emailStep({ to: seller.email, subject: `Oferta kupującego: ${pln(offer.amount)}`, replyTo: seller.agencyUser?.email || undefined, html }));
    }
    const result = await deliverToClient({ agencyUserId: params.agencyUserId, clientId: seller.id, category: 'decision', source: 'buyer_deal_offer', steps, approved: true });
    queued = result.queued;
  }
  const at = new Date().toISOString();
  await save(
    deal,
    queued ? `Propozycja ${pln(offer.amount)} czeka na Twoją akceptację przed wysłaniem do sprzedającego` : `Przekazano sprzedającemu propozycję ${pln(offer.amount)}`,
    (data) =>
      patchNegotiation(data, (stored) => ({
        ...stored,
        offers: (stored.offers || []).map((item) => (item.id === offer.id ? { ...item, sellerBuyerOfferId: row.id, sentToSellerAt: at } : item)),
      })),
  );
  return { queued };
}

/** Wiadomość do kupującego z CRM (np. kontroferta sprzedającego, warunki) — po akceptacji agenta. */
export async function messageBuyer(params: { agencyUserId: number; dealId: number; message: string; offerId?: string | null }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (!deal.buyerClientId) throw new Error('Kupujący spoza CRM — przekaż to jego agencji telefonicznie albo mailem.');
  const message = String(params.message || '').trim().slice(0, 2000);
  if (!message) throw new Error('Wpisz treść wiadomości.');
  const buyer = await prisma.agencyClient.findFirst({
    where: { id: deal.buyerClientId, agencyUserId: params.agencyUserId },
    select: { id: true, firstName: true, salutation: true, email: true, portalToken: true, linkedUserId: true, agencyUser: { select: { name: true, email: true } } },
  });
  if (!buyer) throw new Error('Nie znaleziono kupującego.');
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientVoice, withChatLead } = await import('@/lib/crm/clientVoice');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  const voice = buildClientVoice({ clientId: buyer.id, firstName: buyer.firstName, salutation: buyer.salutation, agentName: buyer.agencyUser?.name });
  const portalUrl = buyer.portalToken ? buildPortalUrl(buyer.portalToken) : null;
  const view = await getDeal(params.agencyUserId, deal.id);
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
    {
      kind: 'chat',
      params: {
        clientId: buyer.id,
        agencyUserId: params.agencyUserId,
        linkedUserId: buyer.linkedUserId,
        from: 'agent',
        content: withChatLead(voice, message),
        activityMetadata: { offerId: deal.offerId, kind: 'deal_update' },
      },
    },
  ];
  if (portalUrl) steps.push({ kind: 'push', clientId: buyer.id, payload: { title: 'Wiadomość od agenta', body: message.slice(0, 170), tag: `deal-${deal.id}`, url: portalUrl } });
  if (buyer.email) {
    const html = await buildClientMessageEmailHtml({
      agencyUserId: params.agencyUserId,
      client: buyer,
      eyebrow: 'Twoja nieruchomość',
      title: view?.offer.title || 'Aktualizacja w sprawie nieruchomości',
      paragraphs: message.split(/\n{2,}/),
      property: view ? { title: view.offer.title, address: view.offer.address || null } : null,
      ctas: portalUrl ? [{ label: 'Otwórz panel', href: portalUrl }] : [],
    });
    steps.push(emailStep({ to: buyer.email, subject: `Aktualizacja: ${view?.offer.title || 'Twoja nieruchomość'}`, replyTo: buyer.agencyUser?.email || undefined, html }));
  }
  const result = await deliverToClient({ agencyUserId: params.agencyUserId, clientId: buyer.id, category: 'decision', source: 'buyer_deal_message', steps });
  const offer = params.offerId ? view?.negotiation.offers.find((row) => row.id === params.offerId) || null : null;
  const at = new Date().toISOString();
  await save(
    deal,
    result.queued ? 'Wiadomość do kupującego czeka na Twoją akceptację' : 'Wysłano wiadomość do kupującego',
    (data) =>
      offer
        ? patchNegotiation(data, (neg) => {
            const stored = neg.offers || [];
            const offers = stored.some((row) => row.id === offer.id) ? stored : [...stored, offer];
            return { ...neg, offers: offers.map((row) => (row.id === offer.id ? { ...row, sentToBuyerAt: at } : row)) };
          })
        : data,
  );
  return { queued: result.queued };
}

/* ───────────────────────── ping-pong ofert ───────────────────────── */

type Notice = { pushTitle: string; text: string; eyebrow: string; title: string; paragraphs: string[]; facts?: Array<{ label: string; value: string }> };

/** Push + e-mail do klienta z CRM (sprzedający albo kupujący) — wysyłane od razu, bo agent już zatwierdził. */
async function notifyClient(agencyUserId: number, clientId: number, deal: Deal, notice: Notice) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId },
    select: { id: true, firstName: true, salutation: true, email: true, portalToken: true, agencyUser: { select: { name: true, email: true } } },
  });
  if (!client) return;
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  const view = await getDeal(agencyUserId, deal.id);
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : null;
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [];
  if (portalUrl) steps.push({ kind: 'push', clientId: client.id, payload: { title: notice.pushTitle, body: notice.text.slice(0, 170), tag: `deal-${deal.id}`, url: portalUrl } });
  if (client.email) {
    const html = await buildClientMessageEmailHtml({
      agencyUserId,
      client,
      eyebrow: notice.eyebrow,
      title: notice.title,
      paragraphs: notice.paragraphs,
      property: view ? { title: view.offer.title, address: view.offer.address || null } : null,
      facts: notice.facts,
      ctas: portalUrl ? [{ label: 'Otwórz panel', href: portalUrl }] : [],
    });
    steps.push(emailStep({ to: client.email, subject: notice.title, replyTo: client.agencyUser?.email || undefined, html }));
  }
  await deliverToClient({ agencyUserId, clientId: client.id, category: 'decision', source: 'buyer_deal_negotiation', steps, approved: true });
}

/** Kontroferta sprzedającego do panelu kupującego (karta z przyciskami) + powiadomienie. */
async function sendOfferToBuyer(deal: Deal, offer: NegotiationOffer) {
  const at = new Date().toISOString();
  if (deal.buyerClientId) {
    await notifyClient(deal.agencyUserId, deal.buyerClientId, deal, {
      pushTitle: 'Odpowiedź sprzedającego',
      text: `Sprzedający proponuje ${pln(offer.amount)}. Odpowiedz w panelu.`,
      eyebrow: 'Negocjacje',
      title: `Sprzedający proponuje ${pln(offer.amount)}`,
      paragraphs: [
        'Sprzedający odpowiedział na Twoją propozycję.',
        `W panelu możesz przyjąć tę kwotę, zaproponować swoją albo zrezygnować. Na odpowiedź masz ${OFFER_RESPONSE_HOURS} godziny.`,
      ],
      facts: [{ label: 'Kwota sprzedającego', value: pln(offer.amount) }],
    });
  }
  await save(
    deal,
    deal.buyerClientId ? `Wysłano kupującemu propozycję ${pln(offer.amount)}` : `Przekazano kupującemu propozycję ${pln(offer.amount)} (poza systemem)`,
    (data) => patchNegotiation(data, (neg) => ({ ...neg, offers: upsert(neg.offers || [], { ...offer, sentToBuyerAt: at }) })),
  );
}

function upsert(offers: NegotiationOffer[], offer: NegotiationOffer): NegotiationOffer[] {
  return offers.some((row) => row.id === offer.id) ? offers.map((row) => (row.id === offer.id ? offer : row)) : [...offers, offer];
}

/** „Zatwierdź i wyślij” — propozycja trafia do drugiej strony z zegarem 48 h. */
export async function sendOffer(params: { agencyUserId: number; dealId: number; offerId: string; recommendation?: string | null }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const view = await getDeal(params.agencyUserId, deal.id);
  const offer = view?.negotiation.offers.find((row) => row.id === params.offerId && row.status === 'open');
  if (!offer) throw new Error('Ta propozycja jest już rozstrzygnięta.');
  if (offer.by === 'buyer') {
    if (deal.sellerClientId) {
      await sendOfferToSeller({ agencyUserId: params.agencyUserId, dealId: deal.id, offerId: offer.id, recommendation: params.recommendation });
    } else {
      await save(deal, `Przekazano sprzedającemu propozycję ${pln(offer.amount)} (poza systemem)`, (data) =>
        patchNegotiation(data, (neg) => ({ ...neg, offers: upsert(neg.offers || [], { ...offer, sentToSellerAt: new Date().toISOString() }) })),
      );
    }
  } else {
    await sendOfferToBuyer(deal, offer);
  }
}

/** Odpowiedź strony zapisana przez agenta (np. przez telefon). Rozstrzyga ją potem „Zatwierdź”. */
export async function recordOfferResponse(params: {
  agencyUserId: number;
  dealId: number;
  offerId: string;
  kind: OfferResponse['kind'];
  amount?: unknown;
  comment?: string | null;
}) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const view = await getDeal(params.agencyUserId, deal.id);
  const offer = view?.negotiation.offers.find((row) => row.id === params.offerId && row.status === 'open');
  if (!offer) throw new Error('Ta propozycja jest już rozstrzygnięta.');
  const amount = params.kind === 'counter' ? money(params.amount) : null;
  if (params.kind === 'counter' && !amount) throw new Error('Podaj kwotę kontroferty.');
  const response: OfferResponse = { kind: params.kind, amount, comment: String(params.comment || '').trim().slice(0, 1000) || null, at: new Date().toISOString(), via: 'agent' };
  const side = offer.by === 'buyer' ? 'Sprzedający' : 'Kupujący';
  await save(deal, `${side}: ${params.kind === 'accept' ? 'przyjmuje' : params.kind === 'reject' ? 'odrzuca' : `proponuje ${pln(amount!)}`}`, (data) =>
    patchNegotiation(data, (neg) => ({ ...neg, offers: upsert(neg.offers || [], { ...offer, response }) })),
  );
  return approveOfferResponse({ agencyUserId: params.agencyUserId, dealId: deal.id, offerId: offer.id });
}

/** Agent zatwierdza odpowiedź strony: przyjęcie = cena uzgodniona, kontra = nowa propozycja do drugiej strony, odmowa = koniec tej propozycji. */
export async function approveOfferResponse(params: { agencyUserId: number; dealId: number; offerId: string }) {
  let deal = await ownedDeal(params.agencyUserId, params.dealId);
  const view = await getDeal(params.agencyUserId, deal.id);
  const offer = view?.negotiation.offers.find((row) => row.id === params.offerId && row.status === 'open');
  const response = offer?.response;
  if (!offer || !response) throw new Error('Brak odpowiedzi do zatwierdzenia.');
  const at = new Date().toISOString();
  const responder: OfferSide = offer.by === 'buyer' ? 'seller' : 'buyer';
  const parties = [deal.sellerClientId, deal.buyerClientId].filter((id): id is number => Boolean(id));

  if (response.kind === 'accept') {
    await save(deal, `Cena uzgodniona: ${pln(offer.amount)}`, (data) =>
      patchNegotiation(data, (neg) => ({
        ...neg,
        agreedPrice: offer.amount,
        offers: upsert(neg.offers || [], { ...offer, status: 'accepted', handledAt: at }),
      })),
    );
    for (const clientId of parties) {
      await notifyClient(params.agencyUserId, clientId, deal, {
        pushTitle: 'Cena uzgodniona',
        text: `Uzgodniliśmy cenę ${pln(offer.amount)}. Kolejny krok: rezerwacja i terminy.`,
        eyebrow: 'Negocjacje zakończone',
        title: `Cena uzgodniona: ${pln(offer.amount)}`,
        paragraphs: ['Obie strony zaakceptowały tę samą kwotę.', 'Skontaktuję się w sprawie rezerwacji, zadatku i terminów umowy.'],
        facts: [{ label: 'Uzgodniona cena', value: pln(offer.amount) }],
      });
    }
    return;
  }

  if (response.kind === 'reject') {
    await save(deal, `${responder === 'seller' ? 'Sprzedający' : 'Kupujący'} odrzuca ${pln(offer.amount)}`, (data) =>
      patchNegotiation(data, (neg) => ({ ...neg, offers: upsert(neg.offers || [], { ...offer, status: 'rejected', handledAt: at }) })),
    );
    const proposer = offer.by === 'buyer' ? deal.buyerClientId : deal.sellerClientId;
    if (proposer) {
      await notifyClient(params.agencyUserId, proposer, deal, {
        pushTitle: 'Odpowiedź na Twoją propozycję',
        text: `Propozycja ${pln(offer.amount)} nie została przyjęta. Możesz zaproponować inną kwotę.`,
        eyebrow: 'Negocjacje',
        title: `Propozycja ${pln(offer.amount)} nie została przyjęta`,
        paragraphs: ['Druga strona nie przyjęła tej kwoty.', 'Jeśli chcesz, zaproponuj inną — przekażę ją dalej.'],
      });
    }
    return;
  }

  // Kontroferta: zamykamy propozycję i wysyłamy nową od strony odpowiadającej.
  const counter: NegotiationOffer = {
    id: `${Date.now().toString(36)}c`,
    at,
    by: responder,
    amount: Number(response.amount),
    note: response.comment || null,
    status: 'open',
  };
  await save(deal, `${responder === 'seller' ? 'Sprzedający' : 'Kupujący'} proponuje ${pln(counter.amount)}`, (data) =>
    patchNegotiation(data, (neg) => ({
      ...neg,
      offers: [...upsert(neg.offers || [], { ...offer, status: 'countered', handledAt: at }), counter],
    })),
  );
  // Druga strona w systemie dostaje kontrę od razu; spoza systemu — agent przekazuje ją telefonicznie.
  const target = responder === 'seller' ? deal.buyerClientId : deal.sellerClientId;
  if (target) {
    deal = await ownedDeal(params.agencyUserId, params.dealId);
    await sendOffer({ agencyUserId: params.agencyUserId, dealId: deal.id, offerId: counter.id });
  }
}

/** Kupujący odpowiada w swoim panelu na kontrofertę sprzedającego. Trafia do agenta do zatwierdzenia. */
export async function respondToDealOfferFromPortal(params: {
  buyerClientId: number;
  dealId: number;
  offerId: string;
  kind: OfferResponse['kind'];
  amount?: unknown;
  comment?: string | null;
}) {
  const row = await prisma.offerBuyerDeal.findFirst({ where: { id: params.dealId, buyerClientId: params.buyerClientId } });
  if (!row) throw new Error('Nie znaleziono tej nieruchomości.');
  const deal = await ownedDeal(row.agencyUserId, row.id);
  const offer = (parseData(deal.data).negotiation?.offers || []).find((item) => item.id === params.offerId);
  if (!offer || offer.status !== 'open' || offer.by !== 'seller' || !offer.sentToBuyerAt) throw new Error('Ta propozycja jest już nieaktualna.');
  if (offer.response) throw new Error('Twoja odpowiedź jest już u agenta.');
  const amount = params.kind === 'counter' ? money(params.amount) : null;
  if (params.kind === 'counter' && !amount) throw new Error('Podaj swoją kwotę.');
  const response: OfferResponse = { kind: params.kind, amount, comment: String(params.comment || '').trim().slice(0, 1000) || null, at: new Date().toISOString(), via: 'panel' };
  const text = params.kind === 'accept' ? `Przyjmuje ${pln(offer.amount)}` : params.kind === 'reject' ? `Odrzuca ${pln(offer.amount)}` : `Proponuje ${pln(amount!)}`;
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: { data: withEvent(deal.data, { actor: 'buyer', text }, new Date(), (data) => patchNegotiation(data, (neg) => ({ ...neg, offers: upsert(neg.offers || [], { ...offer, response }) }))) },
  });
  const { sendNotification } = await import('@/lib/core/notification.core');
  const { crmAgentPushData } = await import('@/lib/crm/agentPush');
  await sendNotification({
    userId: deal.agencyUserId,
    type: 'CRM_EVENT',
    title: 'Kupujący odpowiedział na ofertę',
    body: `${text} — zatwierdź, żeby przekazać dalej.`,
    data: crmAgentPushData(params.buyerClientId, { notificationType: 'crm_buyer_deal', dealId: deal.id, offerId: deal.offerId }),
    idempotencyKey: `deal-response-${deal.id}-${offer.id}`,
  }).catch(() => {});
}

/** Rezerwacja pominięta — agent przechodzi od razu do umowy przedwstępnej. */
export async function skipReservation(params: { agencyUserId: number; dealId: number }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  await save(deal, 'Bez rezerwacji — przechodzimy do umowy', (data) => patchNegotiation(data, (neg) => ({ ...neg, reservationSkipped: true })));
}

export async function setNegotiationDetails(params: {
  agencyUserId: number;
  dealId: number;
  financing?: { kind?: string; bank?: string | null; decision?: string } | null;
  terms?: { deposit?: unknown; preliminaryAt?: unknown; deedAt?: unknown; handoverAt?: unknown; note?: unknown } | null;
}) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const bits: string[] = [];
  const financing = params.financing
    ? {
        kind: (['cash', 'mortgage', 'mixed'].includes(String(params.financing.kind)) ? params.financing.kind : 'cash') as 'cash' | 'mortgage' | 'mixed',
        bank: String(params.financing.bank || '').trim().slice(0, 120) || null,
        decision: (['none', 'pending', 'approved', 'rejected'].includes(String(params.financing.decision))
          ? params.financing.decision
          : 'none') as 'none' | 'pending' | 'approved' | 'rejected',
      }
    : null;
  if (financing) {
    const kind = { cash: 'gotówka', mortgage: 'kredyt', mixed: 'gotówka + kredyt' }[financing.kind];
    const decision = { none: '', pending: ', decyzja w toku', approved: ', decyzja pozytywna', rejected: ', decyzja odmowna' }[financing.decision];
    bits.push(`Finansowanie: ${kind}${financing.bank ? ` (${financing.bank})` : ''}${decision}`);
  }
  const terms = params.terms
    ? {
        deposit: money(params.terms.deposit),
        preliminaryAt: dateOrNull(params.terms.preliminaryAt),
        deedAt: dateOrNull(params.terms.deedAt),
        handoverAt: dateOrNull(params.terms.handoverAt),
        note: String(params.terms.note || '').trim().slice(0, 1000) || null,
      }
    : null;
  if (terms) {
    bits.push(
      [
        terms.deposit ? `zadatek ${pln(terms.deposit)}` : null,
        terms.preliminaryAt ? `umowa przedwstępna ${day(terms.preliminaryAt)}` : null,
        terms.deedAt ? `akt ${day(terms.deedAt)}` : null,
        terms.handoverAt ? `klucze ${day(terms.handoverAt)}` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'Zaktualizowano warunki',
    );
  }
  if (!bits.length) throw new Error('Nic do zapisania.');
  await save(deal, bits.join(' · '), (data) =>
    patchNegotiation(data, (neg) => ({
      ...neg,
      startedAt: neg.startedAt || new Date().toISOString(),
      ...(financing ? { financing } : {}),
      ...(terms ? { terms } : {}),
    })),
  );
}

export async function setReservation(params: { agencyUserId: number; dealId: number; until: unknown }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const until = dateOrNull(params.until);
  await save(deal, until ? `Rezerwacja do ${day(until)}` : 'Zdjęto rezerwację', (data) =>
    patchNegotiation(data, (neg) => ({ ...neg, reservation: until ? { until, at: new Date().toISOString() } : null })),
  );
  const neg = parseData(deal.data).negotiation;
  return { otherActive: until && !neg?.othersDecision ? await otherActiveCount(deal) : 0 };
}

/** Co z pozostałymi kupującymi po rezerwacji / umowie — decyzja agenta. */
export async function decideOtherBuyers(params: { agencyUserId: number; dealId: number; decision: 'paused' | 'backup' }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (params.decision === 'paused') {
    const others = await prisma.offerBuyerDeal.findMany({
      where: { offerId: deal.offerId, agencyUserId: deal.agencyUserId, status: 'ACTIVE', id: { not: deal.id } },
    });
    for (const other of others) {
      await prisma.offerBuyerDeal.update({
        where: { id: other.id },
        data: {
          status: 'PAUSED',
          data: withEvent(other.data, { actor: 'agent', text: 'Wstrzymane — nieruchomość zarezerwowana dla innego kupującego' }),
        },
      });
    }
  }
  await save(
    deal,
    params.decision === 'paused' ? 'Pozostali kupujący wstrzymani' : 'Pozostali kupujący zostają jako rezerwowi',
    (data) => patchNegotiation(data, (neg) => ({ ...neg, othersDecision: params.decision })),
  );
}

/* ───────────────────────── transakcja ───────────────────────── */

const STEP_LABEL: Record<TransactionStepId, string> = {
  preliminary: 'Umowa przedwstępna',
  deed: 'Akt notarialny',
  handover: 'Przekazanie kluczy',
  commission: 'Prowizja',
};

/**
 * Klucze przekazane = sprzedaż zamknięta: oferta SOLD i koniec publikacji (jak finalizacja w Dealroomie),
 * pozostali kupujący tej oferty — zamknięci z adnotacją. Wcześniej oferta zostawała aktywna na portalu.
 */
async function closeSaleAfterHandover(deal: Deal) {
  const offerId = Number((deal as { offerId?: number }).offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) return;
  try {
    const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { status: true } });
    if (offer && String(offer.status) !== 'SOLD') {
      const { endOfferPublicationInTx } = await import('@/lib/offerPublication');
      await prisma.$transaction(async (tx) => {
        await endOfferPublicationInTx(tx, { offerId, endReason: 'SOLD', offerStatus: 'SOLD' });
      });
    }
  } catch (error) {
    console.error('[crm.handover] offer close failed', error);
  }
  const others = await prisma.offerBuyerDeal.findMany({
    where: { offerId, id: { not: deal.id }, status: { in: ['ACTIVE', 'PAUSED'] } },
  });
  for (const other of others) {
    await save(other as Deal, 'Oferta sprzedana innemu kupującemu', (data) => data, { status: 'LOST' }).catch(() => undefined);
  }
}

export async function setTransactionStep(params: {
  agencyUserId: number;
  dealId: number;
  step: TransactionStepId;
  date?: unknown;
  place?: unknown;
  amount?: unknown;
  note?: unknown;
  done?: boolean;
}) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const current: TransactionStep = parseData(deal.data).transaction?.[params.step] || {};
  const next: TransactionStep = {
    ...current,
    ...(params.date !== undefined ? { date: dateOrNull(params.date) } : {}),
    ...(params.place !== undefined ? { place: String(params.place || '').trim().slice(0, 200) || null } : {}),
    ...(params.amount !== undefined ? { amount: money(params.amount) } : {}),
    ...(params.note !== undefined ? { note: String(params.note || '').trim().slice(0, 1000) || null } : {}),
    ...(params.done !== undefined ? { done: params.done, doneAt: params.done ? current.doneAt || new Date().toISOString() : null } : {}),
  };
  const label = STEP_LABEL[params.step];
  const text =
    params.done === true
      ? params.step === 'commission'
        ? `Prowizja rozliczona${next.amount ? `: ${pln(next.amount)}` : ''}`
        : `${label} — gotowe`
      : params.done === false
        ? `${label} — cofnięto oznaczenie`
        : [label, next.date ? when(next.date) : null, next.place, next.amount ? pln(next.amount) : null].filter(Boolean).join(' · ');
  await save(
    deal,
    text,
    (data) => ({
      ...data,
      transaction: { ...(data.transaction || {}), documentsStartedAt: data.transaction?.documentsStartedAt || new Date().toISOString(), [params.step]: next },
    }),
    params.step === 'handover' && params.done !== undefined ? { status: params.done ? 'WON' : 'ACTIVE' } : {},
  );
  if (params.step === 'handover' && params.done === true) await closeSaleAfterHandover(deal);
  const neg = parseData(deal.data).negotiation;
  return { otherActive: params.step === 'preliminary' && params.done && !neg?.othersDecision ? await otherActiveCount(deal) : 0 };
}

export async function startDealDocuments(params: { agencyUserId: number; dealId: number }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  await save(deal, 'Rozpoczęto przygotowanie dokumentów', (data) => ({
    ...data,
    transaction: { ...(data.transaction || {}), documentsStartedAt: data.transaction?.documentsStartedAt || new Date().toISOString() },
  }));
}

export async function attachStepFile(params: { agencyUserId: number; dealId: number; step: TransactionStepId; url: string; name: string }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  await save(deal, `${STEP_LABEL[params.step]} — dodano plik ${params.name}`, (data) => ({
    ...data,
    transaction: {
      ...(data.transaction || {}),
      [params.step]: { ...(data.transaction?.[params.step] || {}), fileUrl: params.url.slice(0, 500), fileName: params.name.slice(0, 200) },
    },
  }));
}

/* ───────────────────────── panel kupującego ───────────────────────── */

export type BuyerPortalDeal = {
  offerId: number;
  title: string;
  address: string;
  imageUrl: string | null;
  phases: DealView['phases'];
  status: string;
  dates: Array<{ label: string; at: string; done: boolean }>;
  dealId: number;
  yourOffer: { amount: number; status: NegotiationOffer['status'] } | null;
  /** Kontroferta sprzedającego czekająca na odpowiedź kupującego. */
  pendingOffer: { id: string; amount: number; deadline: string; answered: boolean } | null;
  agreedPrice: number | null;
  reservedUntil: string | null;
};

/** Ścieżka w panelu kupującego: etapy i terminy — bez danych sprzedającego i notatek agenta. */
export async function loadBuyerPortalDeals(clientId: number): Promise<BuyerPortalDeal[]> {
  const rows = await prisma.offerBuyerDeal.findMany({
    where: { buyerClientId: clientId, status: { in: ['ACTIVE', 'WON'] } },
    select: { id: true, agencyUserId: true },
  });
  const result: BuyerPortalDeal[] = [];
  for (const row of rows) {
    const view = await getDeal(row.agencyUserId, row.id);
    if (!view || (view.stage === 'interested' && view.source === 'radar')) continue;
    const tx = view.transaction;
    const terms = view.negotiation.terms || {};
    const dates: BuyerPortalDeal['dates'] = [];
    if (view.presentation) dates.push({ label: 'Oglądanie', at: view.presentation.heldAt || view.presentation.startsAt, done: Boolean(view.presentation.heldAt) });
    const prelim = tx.preliminary?.date || terms.preliminaryAt;
    if (prelim) dates.push({ label: 'Umowa przedwstępna', at: prelim, done: Boolean(tx.preliminary?.done) });
    const deed = tx.deed?.date || terms.deedAt;
    if (deed) dates.push({ label: 'Akt notarialny', at: deed, done: Boolean(tx.deed?.done) });
    const keys = tx.handover?.date || terms.handoverAt;
    if (keys) dates.push({ label: 'Przekazanie kluczy', at: keys, done: Boolean(tx.handover?.done) });
    const lastBuyerOffer = [...view.negotiation.offers].reverse().find((offer) => offer.by === 'buyer') || null;
    const sellerOpen = [...view.negotiation.offers].reverse().find((offer) => offer.status === 'open' && offer.by === 'seller' && offer.sentToBuyerAt) || null;
    result.push({
      dealId: view.id,
      pendingOffer: sellerOpen
        ? {
            id: sellerOpen.id,
            amount: sellerOpen.amount,
            deadline: new Date(new Date(sellerOpen.sentToBuyerAt!).getTime() + OFFER_RESPONSE_HOURS * 3600 * 1000).toISOString(),
            answered: Boolean(sellerOpen.response),
          }
        : null,
      offerId: view.offerId,
      title: view.offer.title,
      address: view.offer.address,
      imageUrl: view.offer.imageUrl,
      phases: view.phases,
      status:
        view.stage === 'closed'
          ? 'Gratulacje — klucze przekazane'
          : view.stage === 'deed'
            ? 'Akt podpisany'
            : view.stage === 'preliminary'
              ? 'Umowa przedwstępna podpisana'
              : view.stage === 'reserved'
                ? 'Nieruchomość zarezerwowana dla Ciebie'
                : view.stage === 'negotiation'
                  ? view.negotiation.agreedPrice
                    ? 'Cena uzgodniona — ustalamy terminy'
                    : 'Rozmawiamy o cenie i warunkach'
                  : view.presentation?.heldAt
                    ? 'Po oglądaniu'
                    : view.presentation
                      ? 'Oglądanie umówione'
                      : 'W przygotowaniu',
      dates,
      yourOffer: lastBuyerOffer ? { amount: lastBuyerOffer.amount, status: lastBuyerOffer.status } : null,
      agreedPrice: view.negotiation.agreedPrice ?? null,
      reservedUntil: view.negotiation.reservation?.until ?? null,
    });
  }
  return result;
}
