import { parseClientOfferFeedback, type ClientOfferSentiment } from '../utils/clientPortalFeedback';

export type OfferStackId = 'new' | 'like' | 'maybe' | 'dislike';

export const OFFER_STACKS: Array<{ id: OfferStackId; title: string; hint: string }> = [
  { id: 'new', title: 'Nowe do oceny', hint: 'Najpierw te — agent i asystent czekają na Twoją decyzję.' },
  { id: 'like', title: 'Chcę oglądać', hint: 'Miejsca, które chcesz zobaczyć na żywo.' },
  { id: 'maybe', title: 'Do przemyślenia', hint: 'Wracasz do nich, gdy porównasz z nowymi.' },
  { id: 'dislike', title: 'Nie pasuje', hint: 'Świadomie odłożone — asystent nie proponuje ich ponownie.' },
];

export function matchStackId(clientFeedback: string | null | undefined): OfferStackId {
  const sentiment: ClientOfferSentiment | null = parseClientOfferFeedback(clientFeedback).sentiment;
  if (sentiment === 'like' || sentiment === 'maybe' || sentiment === 'dislike') return sentiment;
  return 'new';
}

export function groupPortalOfferStacks<T extends { id: number; notifiedAt?: string | null; clientFeedback?: string | null }>(
  matches: T[],
): Record<OfferStackId, T[]> {
  const grouped: Record<OfferStackId, T[]> = { new: [], like: [], maybe: [], dislike: [] };
  const sorted = [...matches].sort((a, b) => {
    const byDate = String(b.notifiedAt || '').localeCompare(String(a.notifiedAt || ''));
    return byDate || b.id - a.id;
  });
  for (const match of sorted) grouped[matchStackId(match.clientFeedback)].push(match);
  return grouped;
}

function polishPlural(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export type AssistantPulse = {
  mode: 'waiting_checkback' | 'waiting_reaction' | 'preparing' | 'watching';
  badge: string;
  title: string;
  body: string;
  cta: string | null;
  busy: boolean;
};

export function resolveAssistantPulse(input: {
  intelligenceEnabled: boolean;
  pendingNewCount: number;
  unscoredCount: number;
  pendingCheckback: boolean;
}): AssistantPulse | null {
  const pending = Math.max(0, input.pendingNewCount);
  const queued = Math.max(0, input.unscoredCount);

  if (input.pendingCheckback) {
    return {
      mode: 'waiting_checkback',
      badge: 'Pytanie otwarte',
      title: 'Asystent czeka na Twoją odpowiedź powyżej',
      body: 'Dopóki nie wybierzesz, kolejna oferta nie pójdzie — asystent nie zgaduje za Ciebie.',
      cta: null,
      busy: false,
    };
  }

  if (pending > 0) {
    const pendingLabel = `${pending} ${polishPlural(pending, 'nową ofertę', 'nowe oferty', 'nowych ofert')}`;
    const queuedLine =
      queued > 0
        ? ` W tle trzymamy jeszcze ${queued} ${polishPlural(queued, 'dopasowanie', 'dopasowania', 'dopasowań')} — nie pokażemy ich, zanim nie ocenisz tego, co już dostałeś.`
        : ' Kolejną kartę wyśle, gdy będzie miał na czym oprzeć wybór.';
    return {
      mode: 'waiting_reaction',
      badge: 'Czeka na Ciebie',
      title: 'Najpierw oceń to, co już dostałeś',
      body: `Masz ${pendingLabel} do decyzji. Asystent jest włączony i uczy się z Twoich reakcji.${queuedLine}`,
      cta: 'Przejdź do nowych ofert',
      busy: false,
    };
  }

  if (queued > 0) {
    return {
      mode: 'preparing',
      badge: 'Dobiera ofertę',
      title: 'Szykujemy następną propozycję',
      body: `W tle jest ${queued} ${polishPlural(queued, 'dopasowanie', 'dopasowania', 'dopasowań')}. Karta pojawi się tutaj, gdy asystent wybierze jedną pewną — nie losową.`,
      cta: null,
      busy: true,
    };
  }

  if (input.intelligenceEnabled) {
    return {
      mode: 'watching',
      badge: 'Czuwa',
      title: 'Rynek jest pod obserwacją',
      body: 'Nie ma teraz nowej karty w kolejce. Asystent wróci, gdy pojawi się coś pewnego względem Twoich kryteriów.',
      cta: null,
      busy: false,
    };
  }

  return null;
}
