import {
  compareLessonToNext,
  type IntelligenceLocks,
} from '@/lib/crm/clientIntelligence';
import {
  parseClientOfferFeedback,
  type ClientOfferFeedback,
} from '@/lib/crm/clientPortalFeedback';
import type { MarketRealitySnapshot } from '@/lib/crm/buyerMarketReality';
import { formatPln, formatPpsm } from '@/lib/market/format';

export type DialogueTurnKind =
  | 'offer'
  | 'confidence'
  | 'market_reality'
  | 'relax_criterion'
  | 'handoff';

export type CheckbackOption = {
  id: string;
  label: string;
};

export type DialogueTurn = {
  kind: DialogueTurnKind;
  body: string;
  facts: string[];
  checkbackType?: string;
  options?: CheckbackOption[];
  marketSnapshot?: MarketRealitySnapshot;
  lockKey?: keyof IntelligenceLocks;
};

type OfferLike = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  hasBalcony?: boolean | null;
  floor?: number | string | null;
};

function agentLead(firstName?: string | null): string {
  const name = String(firstName || '').trim();
  return name ? `${name} — ` : '';
}

function bitsToSentences(bits: string, next: OfferLike): string[] {
  const out: string[] = [];
  for (const part of bits.split(' · ').filter(Boolean)) {
    if (part === 'Ma balkon') out.push('Ma balkon lub loggię — tego wcześniej brakowało.');
    else if (part === 'Taniej') out.push('Cena jest niższa niż przy ostatniej propozycji, którą odrzuciłeś.');
    else if (part.startsWith('Inna dzielnica (')) {
      const district = part.replace(/^Inna dzielnica \(/, '').replace(/\)$/, '');
      out.push(`Lokalizacja to ${district} — inna dzielnica niż ta odrzucona.`);
    } else if (part.startsWith('Inne piętro (')) {
      const floor = part.replace(/^Inne piętro \(/, '').replace(/\)$/, '');
      out.push(`Piętro ${floor} — inne niż w poprzedniej ofercie.`);
    } else if (part.includes('pok. zamiast')) out.push(`Układ ${part}.`);
    else out.push(part);
  }
  if (!out.length && next.district) {
    out.push(`Lokalizacja: ${[next.city, next.district].filter(Boolean).join(', ')}.`);
  }
  return out;
}

function mapReasonToClientSentence(reason: string): string | null {
  if (/balkon/i.test(reason)) return 'Ma balkon lub loggię — tego wcześniej brakowało.';
  if (/dzielnica .+ już się podobała/i.test(reason)) {
    return reason.replace('już się podobała.', 'którą już zaznaczałeś jako trafioną.');
  }
  if (/paśmie ogłoszeń/i.test(reason)) return 'Cena jest zbliżona do ofert, które już Ci się podobały.';
  if (/pok\./i.test(reason) && /zostawał|może być/i.test(reason)) {
    return 'Ma układ pokoi podobny do tego, który już zostawiałeś.';
  }
  if (/za drogo/i.test(reason)) return null;
  if (/Radar dał|Po nauce|Dotychczasowa|Spośród|parametr był|scoring traktuje|zderza się|wraca słowo|już odpadała|dostała negatywną/i.test(reason)) {
    return null;
  }
  return reason;
}

/** Pełny akapit „dlaczego ta oferta” dla klienta. */
export function buildOfferDialogueTurn(params: {
  prevOffer?: OfferLike | null;
  prevFeedback?: ClientOfferFeedback | null;
  nextOffer?: OfferLike | null;
  reasons?: string[];
  city?: string | null;
  district?: string | null;
  calibrating?: boolean;
  agentFirstName?: string | null;
}): DialogueTurn {
  const lead = agentLead(params.agentFirstName);
  const next = params.nextOffer;
  const loc = [params.city ?? next?.city, params.district ?? next?.district].filter(Boolean).join(', ');

  if (params.calibrating) {
    const body = loc
      ? `${lead}Wysyłam tę nieruchomość z ${loc}, bo najlepiej pasuje do Twojej ankiety — daj znać, czy kierunek jest dobry.`
      : `${lead}Wysyłam tę nieruchomość, bo najlepiej pasuje do Twojej ankiety — daj znać, czy kierunek jest dobry.`;
    return { kind: 'offer', body, facts: ['kalibracja ankiety'] };
  }

  const facts: string[] = [];

  if (params.prevOffer && params.prevFeedback && next) {
    const vs = compareLessonToNext(params.prevOffer, params.prevFeedback, next);
    if (vs) facts.push(...bitsToSentences(vs, next));
  }

  if (!facts.length && params.reasons?.length) {
    const mapped = params.reasons.map(mapReasonToClientSentence).find(Boolean);
    if (mapped) facts.push(mapped);
  }

  let objectionLead = '';
  if (params.prevFeedback?.phrases.length) {
    const phrases = params.prevFeedback.phrases.slice(0, 2).join(' i ');
    if (phrases) objectionLead = `Ostatnią propozycję oceniłeś m.in. jako „${phrases}”. `;
  }

  const core =
    facts.length > 0
      ? facts.join(' ')
      : loc
        ? `Wybrałem tę nieruchomość z ${loc}, bo najlepiej pasuje do Twoich kryteriów i dotychczasowych reakcji.`
        : 'Wybrałem tę nieruchomość, bo najlepiej pasuje do Twoich kryteriów i dotychczasowych reakcji.';

  const body = `${lead}${objectionLead}${core}`.trim();
  return { kind: 'offer', body, facts };
}

/** Wrapper zachowujący stary kontrakt pickIntelligenceOffer. */
export function clientFacingWhyFromDialogue(params: {
  reasons: string[];
  city?: string | null;
  district?: string | null;
  calibrating?: boolean;
  prevOffer?: OfferLike | null;
  prevFeedbackRaw?: string | null;
  nextOffer?: OfferLike | null;
  agentFirstName?: string | null;
}): string {
  const prevFeedback = params.prevFeedbackRaw
    ? parseClientOfferFeedback(params.prevFeedbackRaw)
    : null;
  return buildOfferDialogueTurn({
    reasons: params.reasons,
    city: params.city,
    district: params.district,
    calibrating: params.calibrating,
    prevOffer: params.prevOffer,
    prevFeedback,
    nextOffer: params.nextOffer,
    agentFirstName: params.agentFirstName,
  }).body;
}

export function buildConfidenceDialogueTurn(params: {
  phrase: string;
  agentFirstName?: string | null;
}): DialogueTurn {
  const lead = agentLead(params.agentFirstName);
  const phrase = params.phrase;
  let question = '';
  if (phrase === 'Za drogo') {
    question =
      'Kilka razy sygnalizowałeś „za drogo”. Czy dobrze rozumiem, że szukamy taniej niż ostatnie propozycje, które odrzuciłeś?';
  } else if (phrase === 'Brak balkonu') {
    question =
      'Kilka razy zaznaczałeś brak balkonu. Czy dobrze rozumiem, że balkon lub loggia ma być obowiązkowo?';
  } else if (phrase === 'Nie ta dzielnica') {
    question =
      'Kilka razy odrzucałeś dzielnicę. Czy dobrze rozumiem, że lokalizacja z ostatnich propozycji nie wchodzi w grę?';
  } else {
    question = `Czy dobrze rozumiem Twoją ostatnią uwagę: „${phrase}”?`;
  }

  return {
    kind: 'confidence',
    body: `${lead}${question}`,
    facts: [phrase],
    checkbackType: `confirm_${phrase.replace(/\s+/g, '_').toLowerCase()}`,
    options: [
      { id: 'yes', label: 'Tak, zgadza się' },
      { id: 'no', label: 'Nie — poprawię' },
    ],
  };
}

export function buildMarketRealityDialogueTurn(params: {
  snapshot: MarketRealitySnapshot;
  agentFirstName?: string | null;
}): DialogueTurn {
  const s = params.snapshot;
  const lead = agentLead(params.agentFirstName);
  const implied = formatPpsm(s.impliedPpsm);
  const p25 = s.p25Ppsm != null ? formatPpsm(s.p25Ppsm) : '—';
  const median = s.medianPpsm != null ? formatPpsm(s.medianPpsm) : '—';
  const budget = formatPln(s.maxPrice);
  const suggested =
    s.suggestedMaxPrice != null ? formatPln(s.suggestedMaxPrice) : null;

  const body = [
    `${lead}Kilka razy sygnalizowałeś „za drogo”, a sprawdziłem to na tle realnych transakcji notarialnych (GUGiK RCN).`,
    `W ${s.districtLabel} (${s.periodDays} dni, ${s.txnCount} aktów) mediana to ${median}, dolny kwartyl ${p25}.`,
    `Przy ${s.area} m² i budżecie ${budget} wychodzi ok. ${implied} — to poniżej dolnego kwartyla rynku.`,
    s.rcnLagNote,
    suggested
      ? `Realistycznie bliżej rynku to ok. ${suggested}. Czy idziemy dalej w obecnym budżecie, czy pokazać oferty bliżej rynku?`
      : 'Czy na pewno idziemy dalej w tym budżecie, czy chcesz zostawić go bez zmian?',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    kind: 'market_reality',
    body,
    facts: ['rcn_budget_reality', implied, p25, median],
    checkbackType: 'market_reality',
    marketSnapshot: s,
    lockKey: 'maxPrice',
    options: [
      { id: 'stay_budget', label: 'Szukaj dalej w tym budżecie' },
      ...(suggestedMaxPriceOption(s)
        ? [{ id: 'raise_budget', label: `Pokaż bliżej rynku (do ${formatPln(s.suggestedMaxPrice!)})` }]
        : []),
    ],
  };
}

function suggestedMaxPriceOption(s: MarketRealitySnapshot): boolean {
  return s.suggestedMaxPrice != null && s.suggestedMaxPrice > s.maxPrice;
}

export function buildRelaxBalconyDialogueTurn(params: {
  agentFirstName?: string | null;
  rejectCount: number;
}): DialogueTurn {
  const lead = agentLead(params.agentFirstName);
  const body = `${lead}Szukamy już dłużej z balkonem w Twoim budżecie i lokalizacji — takich ofert prawie nie ma. Czy na pewno balkon musi być obowiązkowy, czy mogę pokazać mieszkanie bez balkonu, jeśli reszta pasuje?`;

  return {
    kind: 'relax_criterion',
    body,
    facts: ['brak_puli_z_balkonem', String(params.rejectCount)],
    checkbackType: 'relax_requireBalcony',
    lockKey: 'requireBalcony',
    options: [
      { id: 'keep_balcony', label: 'Zostawiam balkon — szukaj dalej' },
      { id: 'allow_without_balcony', label: 'Może być bez balkonu' },
    ],
  };
}

export function buildHandoffDialogueTurn(params: {
  reason: string;
  agentFirstName?: string | null;
}): DialogueTurn {
  const lead = agentLead(params.agentFirstName);
  return {
    kind: 'handoff',
    body: `${lead}${params.reason} Wrócę z konkretem po rozmowie z agentem — na ten moment nie dokładam kolejnej oferty z automatu.`,
    facts: ['handoff'],
  };
}
