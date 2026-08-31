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
import { buildRichAgentFollowUpLetter, lessonBitsToRichFacts } from '@/lib/crm/agentOfferFollowUp';

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
  yearBuilt?: number | null;
  hasBalcony?: boolean | null;
  hasParking?: boolean | null;
  hasElevator?: boolean | null;
  hasGarden?: boolean | null;
  floor?: number | string | null;
};

/** Pełny akapit „dlaczego ta oferta” dla klienta — styl listu od agenta. */
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
  const next = params.nextOffer;
  const loc = [params.city ?? next?.city, params.district ?? next?.district].filter(Boolean).join(', ');

  if (params.calibrating) {
    const lead = params.agentFirstName ? `${params.agentFirstName} — ` : '';
    const body = [
      `${lead}Dzień dobry.`,
      loc
        ? `Wysyłam pierwszą propozycję z ${loc}, wybraną na podstawie Twojej ankiety i aktualnej puli rynkowej.`
        : 'Wysyłam pierwszą propozycję dopasowaną do Twojej ankiety — chcę sprawdzić, czy kierunek poszukiwań jest właściwy.',
      'Proszę o szczerą ocenę: co pasuje, a co należy skorygować. Każda uwaga pomoże mi precyzyjniej dobierać kolejne oferty.',
    ].join('\n\n');
    return { kind: 'offer', body, facts: ['kalibracja ankiety'] };
  }

  const facts: string[] = [];
  let lessonBits: string[] = [];

  if (params.prevOffer && params.prevFeedback && next) {
    const vs = compareLessonToNext(params.prevOffer, params.prevFeedback, next);
    lessonBits = vs ? lessonBitsToRichFacts(vs, next) : [];
    facts.push(...lessonBits);
  }

  if (!facts.length && params.reasons?.length) {
    const mapped = params.reasons
      .map((reason) => {
        if (/balkon/i.test(reason)) return 'Ma balkon lub loggię — tego wcześniej brakowało.';
        if (/pokoje|pok\./i.test(reason) && /zgodnie|minimum/i.test(reason)) return reason;
        if (/Budynek z \d{4}/i.test(reason)) return reason;
        if (/dzielnica .+ już się podobała/i.test(reason)) {
          return reason.replace('już się podobała.', 'którą już zaznaczałeś jako trafioną.');
        }
        if (/paśmie ogłoszeń/i.test(reason)) return 'Cena jest zbliżona do ofert, które już Ci się podobały.';
        if (/za drogo|Radar dał|Po nauce|Dotychczasowa|Spośród|parametr był|scoring|zderza|wraca słowo|już odpadała|dostała negatywną/i.test(reason)) {
          return null;
        }
        return reason;
      })
      .filter(Boolean) as string[];
    facts.push(...mapped.slice(0, 3));
  }

  const hasPriorFeedback =
    params.prevFeedback &&
    (params.prevFeedback.sentiment ||
      params.prevFeedback.disliked ||
      params.prevFeedback.note ||
      params.prevFeedback.phrases.length);

  const body = hasPriorFeedback
    ? buildRichAgentFollowUpLetter({
        agentFirstName: params.agentFirstName,
        prevOffer: params.prevOffer,
        prevFeedback: params.prevFeedback,
        nextOffer: next,
        lessonBits,
        reasons: params.reasons || [],
        city: params.city,
        district: params.district,
      })
    : buildFirstOfferLetter({
        agentFirstName: params.agentFirstName,
        loc,
        facts,
        next,
      });

  return { kind: 'offer', body, facts };
}

function buildFirstOfferLetter(params: {
  agentFirstName?: string | null;
  loc: string;
  facts: string[];
  next?: OfferLike | null;
}): string {
  const name = String(params.agentFirstName || '').trim();
  const lead = name ? `Dzień dobry — tu ${name}, Twój agent nieruchomości.` : 'Dzień dobry.';
  const middle =
    params.facts.length > 0
      ? params.facts.join(' ')
      : params.loc
        ? `Wybrałem nieruchomość z ${params.loc}, ponieważ najlepiej odpowiada Twojej ankiecie i dotychczasowym preferencjom.`
        : 'Wybrałem nieruchomość, która najlepiej odpowiada Twojej ankiecie i dotychczasowym preferencjom.';
  const close =
    'Proszę o spokojne zapoznanie się z opisem i ocenę — na tej podstawie przygotuję kolejne propozycje.';
  return [lead, middle, close].join('\n\n');
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
      'Kilka razy sygnalizowałeś „za drogo”. Czy dobrze rozumiem, że szukamy taniej niż ostatnie propozycje, które odrzuciłeś? Chcę to potwierdzić, zanim zawężę dalsze propozycje.';
  } else if (phrase === 'Brak balkonu') {
    question =
      'Kilka razy zaznaczałeś brak balkonu. Czy dobrze rozumiem, że balkon lub loggia ma być obowiązkowo? Od tego zależy, jak restrykcyjnie będę filtrował kolejne oferty.';
  } else if (phrase === 'Nie ta dzielnica') {
    question =
      'Kilka razy odrzucałeś dzielnicę. Czy dobrze rozumiem, że lokalizacja z ostatnich propozycji nie wchodzi w grę i mam ją wykluczyć z poszukiwań?';
  } else if (phrase === 'Za stare') {
    question =
      'Kilka razy sygnalizowałeś, że mieszkanie jest za stare. Czy dobrze rozumiem, że interesują Cię wyłącznie budynki od wskazanego roku — i mam to traktować jako twardy warunek?';
  } else if (phrase === 'Za mało pokoi') {
    question =
      'Kilka razy zaznaczałeś, że zależy Ci na większej liczbie pokoi. Czy dobrze rozumiem minimalną liczbę pokoi, której nie chcesz schodzić poniżej?';
  } else if (phrase === 'Brak parkingu') {
    question =
      'Kilka razy zaznaczałeś brak parkingu. Czy miejsce postojowe ma być obowiązkowe w każdej kolejnej propozycji?';
  } else if (phrase === 'Brak windy') {
    question =
      'Kilka razy zaznaczałeś brak windy. Czy winda ma być obowiązkowa w każdej kolejnej propozycji?';
  } else if (phrase === 'Brak ogrodu') {
    question =
      'Kilka razy zaznaczałeś brak ogrodu. Czy ogród ma być obowiązkowy w każdej kolejnej propozycji?';
  } else if (phrase === 'Za mały metraż') {
    question =
      'Kilka razy sygnalizowałeś za mały metraż. Czy podnieść minimalny metraż i traktować to jako twardy warunek?';
  } else if (phrase === 'Za duży metraż') {
    question =
      'Kilka razy sygnalizowałeś za duży metraż. Czy obniżyć maksymalny metraż i traktować to jako twardy warunek?';
  } else {
    question = `Chcę upewnić się co do Twojej ostatniej uwagi: „${phrase}”. Czy dobrze ją interpretuję?`;
  }

  return {
    kind: 'confidence',
    body: `${lead}${question}`,
    facts: [phrase],
    checkbackType: `confirm_${phrase.replace(/\s+/g, '_').toLowerCase()}`,
    lockKey:
      phrase === 'Za stare'
        ? 'minYear'
        : phrase === 'Za mało pokoi'
          ? 'minRooms'
          : phrase === 'Brak balkonu'
            ? 'requireBalcony'
            : phrase === 'Brak parkingu'
              ? 'requireParking'
              : phrase === 'Brak windy'
                ? 'requireElevator'
                : phrase === 'Brak ogrodu'
                  ? 'requireGarden'
                  : phrase === 'Za mały metraż'
                    ? 'minArea'
                    : phrase === 'Za duży metraż'
                      ? 'maxArea'
                      : phrase === 'Nie ta dzielnica'
                        ? 'districts'
                        : phrase === 'Za drogo'
                          ? 'maxPrice'
                          : undefined,
    options: [
      { id: 'yes', label: 'Tak, zgadza się' },
      { id: 'no', label: 'Nie — poprawię' },
    ],
  };
}

function agentLead(firstName?: string | null): string {
  const name = String(firstName || '').trim();
  return name ? `${name} — ` : '';
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
    body: `${lead}${params.reason} Wrócę z konkretem po rozmowie — na ten moment wstrzymuję automatyczne dokładanie kolejnej oferty.`,
    facts: ['handoff'],
  };
}
