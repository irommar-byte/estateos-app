/**
 * Prezentacja stanu negocjacji na karcie oferty (OfferDetail) — spójna z DealroomChat.
 */

import {
  canFinalizeTransition,
  isDealSaleFinalizedMessage,
  isDealTransactionFinalized,
} from '../contracts/parityContracts';
import { parseDealEvent } from './dealEventParse';

type Msg = { content?: unknown; text?: unknown; senderId?: unknown; createdAt?: unknown };

type BidRow = {
  event: Record<string, unknown>;
  senderId: string;
  msg: Msg;
};

export type OfferDealPricePresentation = {
  title: string;
  body: string;
  tone: 'pending' | 'confirmed' | 'finalized';
};

export type OfferDealPresentation = {
  transactionFinalized: boolean;
  agreedPrice: number;
  priceNegotiation: OfferDealPricePresentation | null;
  shouldHideBuyerNegotiationButtons: boolean;
};

const firstDefined = (...values: unknown[]) =>
  values.find((v) => v !== undefined && v !== null && v !== '');

function messageBody(m: Msg): string {
  return String(m?.content ?? m?.text ?? '');
}

function mapBidEvents(messages: Msg[]): BidRow[] {
  return messages
    .map((msg) => {
      const event = parseDealEvent(messageBody(msg)) as Record<string, unknown> | null;
      if (!event || String(event.entity || '').toUpperCase() !== 'BID') return null;
      return {
        event,
        senderId: String(msg?.senderId ?? ''),
        msg,
      };
    })
    .filter((x): x is BidRow => Boolean(x));
}

/** Kwota z wiadomości właściciela po finalnym „zamykam sprzedaż”. */
export function parseAgreedPriceFromSaleFinalizationMessage(content: string): number | null {
  const c = String(content || '');
  const m =
    c.match(/ostatecznie akceptuję cenę\s+([\d\s]+)\s*PLN/i) ||
    c.match(/akceptuję cenę\s+([\d\s]+)\s*PLN/i);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Kupujący zaakceptował cenę właściciela — czeka na finalne POTWIERDZAM. */
export function detectBuyerFinalPriceAcceptance(bidEvents: BidRow[]): { amount: number } | null {
  if (bidEvents.length < 2) return null;
  const last = bidEvents[bidEvents.length - 1];
  const prev = bidEvents[bidEvents.length - 2];
  const lastAction = String(last.event?.action || '').toUpperCase();
  const lastAmount = Number(last.event?.amount || last.event?.counterAmount || 0);
  const prevAmount = Number(prev.event?.amount || prev.event?.counterAmount || 0);
  const lastNote = String(firstDefined(last.event?.note, last.event?.message, '') || '').toLowerCase();
  const isCountered = lastAction === 'COUNTERED';
  const isExplicitIntent = String(last.event?.intent || '').toUpperCase() === 'FINAL_ACCEPTANCE';
  const isSameAmount =
    lastAmount > 0 && prevAmount > 0 && Math.round(lastAmount) === Math.round(prevAmount);
  const notesAcceptance =
    lastNote.includes('akceptuję twoją cenę') ||
    lastNote.includes('akceptuje twoja cene') ||
    lastNote.includes('ostateczne potwierdzenie') ||
    lastNote.includes('ostateczne potw');
  if (!(isExplicitIntent || (isCountered && isSameAmount && notesAcceptance))) return null;
  if (last.senderId === prev.senderId) return null;
  return { amount: lastAmount > 0 ? lastAmount : prevAmount };
}

function agreedPriceFromAcceptedBids(bidEvents: BidRow[]): number {
  const accepted = [...bidEvents]
    .reverse()
    .filter((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED')
    .filter((e) => Number(e.event?.amount || 0) > 0);
  if (!accepted.length) return 0;
  return Number(accepted[0]?.event?.amount || 0);
}

function latestBidAmount(bidEvents: BidRow[]): number {
  const last = bidEvents[bidEvents.length - 1];
  return Number(last?.event?.amount || last?.event?.counterAmount || 0);
}

function formatPln(amount: number): string {
  return `${amount.toLocaleString('pl-PL')} PLN`;
}

export function deriveOfferDealPresentation(input: {
  messages: Msg[];
  dealStatus?: string | null;
  acceptedBidId?: unknown;
}): OfferDealPresentation {
  const messages = input.messages || [];
  const dealStatus = String(input.dealStatus || '').trim().toUpperCase();
  const transactionFinalized = isDealTransactionFinalized({
    dealStatus: input.dealStatus,
    messages,
  });

  let agreedPrice = 0;
  for (const m of messages) {
    const body = messageBody(m);
    if (isDealSaleFinalizedMessage(body)) {
      const parsed = parseAgreedPriceFromSaleFinalizationMessage(body);
      if (parsed) agreedPrice = parsed;
    }
  }

  const bidEvents = mapBidEvents(messages);
  const buyerFinalAccept = detectBuyerFinalPriceAcceptance(bidEvents);
  const acceptedFromBid = agreedPriceFromAcceptedBids(bidEvents);
  const dealAgreed = canFinalizeTransition({
    dealStatus,
    acceptedBidId: input.acceptedBidId,
  });

  const latestBid = bidEvents[bidEvents.length - 1] || null;
  const latestAction = String(latestBid?.event?.action || '').toUpperCase();
  const lastNegotiatedAmount = latestBidAmount(bidEvents);

  if (!agreedPrice) {
    if (acceptedFromBid > 0) agreedPrice = acceptedFromBid;
    else if (buyerFinalAccept?.amount) agreedPrice = buyerFinalAccept.amount;
    else if (transactionFinalized && lastNegotiatedAmount > 0) agreedPrice = lastNegotiatedAmount;
  }

  const priceAcceptedOnBid = latestAction === 'ACCEPTED' && lastNegotiatedAmount > 0;
  const priceAgreedPendingOwner =
    Boolean(buyerFinalAccept?.amount) || dealAgreed || priceAcceptedOnBid;

  if (!agreedPrice && priceAgreedPendingOwner && lastNegotiatedAmount > 0) {
    agreedPrice = lastNegotiatedAmount;
  }

  let priceNegotiation: OfferDealPricePresentation | null = null;

  if (transactionFinalized && agreedPrice > 0) {
    priceNegotiation = {
      title: 'Transakcja sfinalizowana',
      body: `Uzgodniona kwota: ${formatPln(agreedPrice)}. Oferta została wycofana z rynku — szczegóły w Dealroomie.`,
      tone: 'finalized',
    };
  } else if (transactionFinalized) {
    priceNegotiation = {
      title: 'Transakcja sfinalizowana',
      body: 'Sprzedaż została zamknięta w Dealroomie. Oferta powinna zniknąć z aktywnych ogłoszeń.',
      tone: 'finalized',
    };
  } else if (priceAgreedPendingOwner && agreedPrice > 0) {
    priceNegotiation = {
      title: 'Cena: uzgodniona',
      body: buyerFinalAccept
        ? `Kwota ${formatPln(agreedPrice)} zaakceptowana przez kupującego — czeka na Twoje ostateczne potwierdzenie w Dealroomie (zielone okienko).`
        : `Uzgodniona kwota transakcyjna: ${formatPln(agreedPrice)}.`,
      tone: 'confirmed',
    };
  } else if (latestBid && agreedPrice > 0) {
    priceNegotiation = {
      title: 'Cena: w negocjacji',
      body: `Ostatnia propozycja w Dealroomie: ${formatPln(agreedPrice)}.`,
      tone: 'pending',
    };
  } else if (latestBid) {
    priceNegotiation = {
      title: 'Cena: w negocjacji',
      body: 'Trwa negocjacja w Dealroomie — otwórz czat transakcji, aby zobaczyć aktualną propozycję.',
      tone: 'pending',
    };
  }

  return {
    transactionFinalized,
    agreedPrice,
    priceNegotiation,
    shouldHideBuyerNegotiationButtons:
      transactionFinalized || (priceAgreedPendingOwner && agreedPrice > 0),
  };
}
