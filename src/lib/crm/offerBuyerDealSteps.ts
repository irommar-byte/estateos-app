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
  type OfferSide,
  type TransactionStep,
  type TransactionStepId,
} from '@/lib/crm/offerBuyerDeals';

/**
 * Negocjacje i transakcja na ścieżce kupujący ↔ nieruchomość.
 * Wszystko, co wychodzi do sprzedającego albo kupującego, idzie przez kolejkę z akceptacją agenta.
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
    const { buildClientVoice } = await import('@/lib/crm/clientVoice');
    const voice = buildClientVoice({ clientId: seller.id, firstName: seller.firstName, salutation: seller.salutation, agentName: seller.agencyUser?.name });
    const portalUrl = seller.portalToken ? buildPortalUrl(seller.portalToken) : null;
    const text = `${buyerLabel} proponuje ${pln(offer.amount)}${neg.financing?.kind === 'mortgage' ? ' (kredyt)' : neg.financing?.kind === 'cash' ? ' (gotówka)' : ''}. Szczegóły${recommendation ? ' i moja rekomendacja' : ''} są w panelu — możesz przyjąć, odrzucić albo zaproponować swoją kwotę.`;
    const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
    const steps: Parameters<typeof deliverToClient>[0]['steps'] = [];
    if (portalUrl) steps.push({ kind: 'push', clientId: seller.id, payload: { title: 'Nowa oferta kupującego', body: text.slice(0, 170), tag: `buyer-offer-${row.id}`, url: portalUrl } });
    if (seller.email) {
      steps.push(
        emailStep({
          to: seller.email,
          subject: `Oferta kupującego: ${pln(offer.amount)}`,
          replyTo: seller.agencyUser?.email || undefined,
          html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#15171A">
            <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7A5F33">Oferta kupującego</p>
            <p style="margin:0 0 14px;font-size:15px">${esc(voice.greeting)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${esc(text)}</p>
            ${portalUrl ? `<p><a href="${portalUrl}" style="display:inline-block;background:#0E4D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Odpowiedz w panelu</a></p>` : ''}
            <p style="margin:22px 0 0;font-size:13px;color:#5B574F">Pozdrawiam,<br/>${esc(seller.agencyUser?.name || 'Twój agent')}</p></div>`,
        }),
      );
    }
    const result = await deliverToClient({ agencyUserId: params.agencyUserId, clientId: seller.id, category: 'decision', source: 'buyer_deal_offer', steps });
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
  const { buildClientVoice } = await import('@/lib/crm/clientVoice');
  const voice = buildClientVoice({ clientId: buyer.id, firstName: buyer.firstName, salutation: buyer.salutation, agentName: buyer.agencyUser?.name });
  const portalUrl = buyer.portalToken ? buildPortalUrl(buyer.portalToken) : null;
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
    {
      kind: 'chat',
      params: {
        clientId: buyer.id,
        agencyUserId: params.agencyUserId,
        linkedUserId: buyer.linkedUserId,
        from: 'agent',
        content: `${voice.chatLead}${message}`,
        activityMetadata: { offerId: deal.offerId, kind: 'deal_update' },
      },
    },
  ];
  if (portalUrl) steps.push({ kind: 'push', clientId: buyer.id, payload: { title: 'Wiadomość od agenta', body: message.slice(0, 170), tag: `deal-${deal.id}`, url: portalUrl } });
  if (buyer.email) {
    steps.push(
      emailStep({
        to: buyer.email,
        subject: 'Aktualizacja w sprawie nieruchomości',
        replyTo: buyer.agencyUser?.email || undefined,
        html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#15171A">
          <p style="margin:0 0 14px;font-size:15px">${esc(voice.greeting)}</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${esc(message)}</p>
          ${portalUrl ? `<p><a href="${portalUrl}" style="display:inline-block;background:#0E4D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Otwórz panel</a></p>` : ''}
          <p style="margin:22px 0 0;font-size:13px;color:#5B574F">Pozdrawiam,<br/>${esc(buyer.agencyUser?.name || 'Twój agent')}</p></div>`,
      }),
    );
  }
  const result = await deliverToClient({ agencyUserId: params.agencyUserId, clientId: buyer.id, category: 'decision', source: 'buyer_deal_message', steps });
  const view = params.offerId ? await getDeal(params.agencyUserId, deal.id) : null;
  const offer = view?.negotiation.offers.find((row) => row.id === params.offerId) || null;
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
  yourOffer: { amount: number; status: NegotiationOffer['status'] } | null;
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
    result.push({
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
