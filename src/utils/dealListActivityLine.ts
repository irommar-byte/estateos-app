import { parseDealEvent, normalizeDealEvent } from './dealEventParse';

const FINALIZED_RX =
  /Decyzja właściciela: oferta została wycofana z publikacji|rezerwacja uzgodnionej ceny/i;

const shortPl = (iso: string) =>
  new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function formatActorShort(msg: any, myUserId: number, peerName: string): 'Ty' | string {
  if (String(msg?.senderId ?? '') === String(myUserId)) return 'Ty';
  const first = String(peerName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  if (first && !/^Użytkownik$/i.test(first)) return first;
  return peerName || 'kontrahent';
}

export type DealListActivityContext = {
  myUserId: number;
  peerName: string;
  peerSideLabel: string;
  dealStatus: string;
};

/**
 * Jedna linia pod tytułem transakcji na liście Dealroom — bez wchodzenia w czat:
 * etap, kto na kim czeka, co już uzgodniono (wg treści wątku).
 */
export function buildDealListActivityLine(messages: any[], ctx: DealListActivityContext): string {
  const me = Number(ctx.myUserId || 0);
  const peer = String(ctx.peerName || '').trim() || 'kontrahenta';
  const side = ctx.peerSideLabel;
  const dealStatus = String(ctx.dealStatus || '').toUpperCase();

  const sorted = [...(messages || [])].sort((a, b) => {
    const ta = new Date(a?.createdAt || 0).getTime();
    const tb = new Date(b?.createdAt || 0).getTime();
    return ta - tb;
  });

  for (const m of sorted) {
    const body = String(m?.content ?? m?.text ?? '');
    if (FINALIZED_RX.test(body)) {
      return 'Po prezentacji: oferta wycofana z publikacji — sprawdź czat (rezerwacja uzgodnień)';
    }
  }

  if (dealStatus === 'ACCEPTED') {
    return 'Etap: warunki transakcji uzgodnione — kolejne kroki w czacie';
  }
  if (dealStatus === 'REJECTED') {
    return 'Etap: negocjacja przerwana (odrzucenie) — szczegóły w czacie';
  }

  const negotiationEvents = sorted
    .map((msg) => ({ msg, event: normalizeDealEvent(parseDealEvent(msg)) }))
    .filter((e) => e.event?.entity);

  const bidEvents = negotiationEvents.filter((e) => e.event?.entity === 'BID');
  const appointmentEvents = negotiationEvents.filter((e) => e.event?.entity === 'APPOINTMENT');

  const latestBid = bidEvents[bidEvents.length - 1] || null;
  const latestAppointment = appointmentEvents[appointmentEvents.length - 1] || null;

  const acceptedAppointment =
    [...appointmentEvents]
      .reverse()
      .find((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED' && !!e.event?.proposedDate) || null;

  const acceptedPriceEvent =
    [...bidEvents]
      .reverse()
      .find((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED' && Number(e.event?.amount || 0) > 0) || null;
  const acceptedPrice = Number(acceptedPriceEvent?.event?.amount || 0);

  const describeBid = (): string | null => {
    if (!latestBid?.event) return null;
    const action = String(latestBid.event.action || '').toUpperCase();
    const amount = Number(latestBid.event.amount || 0);
    if (action === 'ACCEPTED' && amount > 0) {
      return `Cena: uzgodniona ${amount.toLocaleString('pl-PL')} PLN`;
    }
    if (action === 'REJECTED' || action === 'DECLINED') {
      return 'Cena: ostatnia propozycja odrzucona — możesz zaproponować nową w czacie';
    }
    if (action === 'PROPOSED' || action === 'COUNTERED') {
      const fromMe = Number(latestBid.msg?.senderId) === me;
      const who = formatActorShort(latestBid.msg, me, peer);
      if (fromMe) {
        return `Cena: wysłana Twoja propozycja ${amount.toLocaleString('pl-PL')} PLN — czekasz na decyzję: ${peer}`;
      }
      return `Cena: ${peer} proponuje ${amount.toLocaleString('pl-PL')} PLN — Twoja akceptacja, kontroferta lub odrzucenie`;
    }
    return null;
  };

  const describeAppointment = (): string | null => {
    if (!latestAppointment?.event) return null;
    const action = String(latestAppointment.event.action || '').toUpperCase();
    const when = latestAppointment.event.proposedDate
      ? shortPl(String(latestAppointment.event.proposedDate))
      : '';

    if (action === 'ACCEPTED' && latestAppointment.event.proposedDate) {
      return `Termin prezentacji: potwierdzony na ${shortPl(String(latestAppointment.event.proposedDate))}`;
    }
    if (action === 'REJECTED' || action === 'DECLINED') {
      return 'Termin: ostatnia propozycja odrzucona — możesz zaproponować nowy termin w czacie';
    }
    if (action === 'PROPOSED' || action === 'COUNTERED') {
      const fromMe = Number(latestAppointment.msg?.senderId) === me;
      if (fromMe) {
        return `Termin: wysłana propozycja${when ? ` (${when})` : ''} — czekasz na odpowiedź: ${peer}`;
      }
      return `Termin: ${peer} proponuje${when ? ` ${when}` : ' datę'} — Twoja akceptacja lub kontroferta w czacie`;
    }
    return null;
  };

  const bidLine = describeBid();
  const apptLine = describeAppointment();

  const latestBidAction = String(latestBid?.event?.action || '').toUpperCase();
  const latestApptAction = String(latestAppointment?.event?.action || '').toUpperCase();

  const bidNeedsMe =
    latestBid &&
    ['PROPOSED', 'COUNTERED'].includes(latestBidAction) &&
    Number(latestBid.msg?.senderId) !== me;
  const apptNeedsMe =
    latestAppointment &&
    ['PROPOSED', 'COUNTERED'].includes(latestApptAction) &&
    Number(latestAppointment.msg?.senderId) !== me;

  if (apptNeedsMe && bidNeedsMe) {
    const ta = new Date(latestAppointment!.msg?.createdAt || 0).getTime();
    const tb = new Date(latestBid!.msg?.createdAt || 0).getTime();
    if (ta >= tb) return apptLine || 'Działanie: odpowiedz na proponowany termin w czacie';
    return bidLine || 'Działanie: odpowiedz na propozycję ceny w czacie';
  }
  if (apptNeedsMe && apptLine) return apptLine;
  if (bidNeedsMe && bidLine) return bidLine;

  if (bidLine && apptLine && (latestBidAction === 'ACCEPTED' || latestApptAction === 'ACCEPTED')) {
    const parts: string[] = [];
    if (acceptedPrice > 0) parts.push(`cena ${acceptedPrice.toLocaleString('pl-PL')} PLN`);
    if (acceptedAppointment?.event?.proposedDate) {
      parts.push(`termin ${shortPl(String(acceptedAppointment.event.proposedDate))}`);
    }
    if (parts.length > 0) return `Etap: uzgodniono ${parts.join(' • ')} — reszta negocjacji w czacie`;
  }

  if (bidLine && !apptLine) return bidLine;
  if (apptLine && !bidLine) return apptLine;
  if (bidLine && apptLine) {
    return `${bidLine} | ${apptLine}`;
  }

  const hasEvents = bidEvents.length > 0 || appointmentEvents.length > 0;
  if (!hasEvents) {
    if (dealStatus === 'INITIATED' || sorted.length === 0) {
      if (side === 'Sprzedający') {
        return `Etap: start — Twoja rola: kupujący. Możesz wysłać ${peer} propozycję ceny lub terminu prezentacji`;
      }
      if (side === 'Kupujący') {
        return `Etap: start — Twoja rola: sprzedający. Czekasz na pierwszy ruch od ${peer} (cena lub termin)`;
      }
      return `Etap: rozmowa otwarta — ustal z ${peer} cenę i/lub termin prezentacji`;
    }

    const lastAttach = [...sorted]
      .reverse()
      .find((m) => {
        const c = String(m?.content || '');
        return c.startsWith('[[DEAL_ATTACHMENT]]') || c.startsWith('[[deal_attachment]]');
      });
    if (lastAttach) {
      const fromOther = Number(lastAttach.senderId) !== me && me > 0;
      return fromOther
        ? `Załącznik od ${peer} — otwórz czat, żeby zobaczyć dokument`
        : 'Wysłano załącznik — partner widzi go w czacie';
    }

    const lastPlain = [...sorted]
      .reverse()
      .find((m) => {
        const c = String(m?.content || '');
        return (
          c.length > 0 &&
          !c.startsWith('[[DEAL_EVENT]]') &&
          !c.startsWith('[[deal_event]]') &&
          !c.startsWith('[[DEAL_ATTACHMENT]]')
        );
      });
    if (lastPlain) {
      const preview = String(lastPlain.content || '').replace(/\s+/g, ' ').trim().slice(0, 72);
      return `${formatActorShort(lastPlain, me, peer)}: „${preview}${preview.length >= 72 ? '…' : ''}”`;
    }
  }

  return 'Aktywny wątek — zajrzyj do czatu po szczegóły';
}
