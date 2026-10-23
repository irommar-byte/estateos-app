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
import { buildClientVoice, withChatLead, type ClientVoice } from '@/lib/crm/clientVoice';

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
  voice?: ClientVoice;
}): DialogueTurn {
  const next = params.nextOffer;
  const loc = [params.district ?? next?.district, params.city ?? next?.city].filter(Boolean).join(', ');
  const voice = params.voice || buildClientVoice({ agentName: params.agentFirstName });
  const { a, c } = voice;
  const salt = next?.id ?? null;

  if (params.calibrating) {
    const body = [
      voice.greeting,
      voice.pick('calibrate-1', [
        `Na początek ${a('wybrałem', 'wybrałam')} jedną ofertę${loc ? ` (${loc})` : ''}, która najlepiej odpowiada temu, o czym rozmawialiśmy.`,
        `Zaczynam od jednej propozycji${loc ? ` — ${loc}` : ''}. Zanim wyślę więcej, chcę mieć pewność, że dobrze ${a('zrozumiałem', 'zrozumiałam')}, czego ${c('Pani szuka', 'Pan szuka', 'szukamy')}.`,
        `Przesyłam pierwszą ofertę${loc ? ` z okolicy: ${loc}` : ''}. Traktuję ją trochę jak próbę kierunku — po ${c('Pani ocenie', 'Pana ocenie', 'ocenie')} będę wiedzieć, jak szukać dalej.`,
      ], salt),
      voice.pick('calibrate-2', [
        `Wystarczy jedno kliknięcie: „Chcę obejrzeć”, „Do przemyślenia” albo „Nie pasuje”. A jeśli coś przeszkadza — proszę dopisać jedno zdanie, co dokładnie.`,
        `${c('Proszę mi szczerze powiedzieć,', 'Proszę mi szczerze powiedzieć,', 'Proszę o szczerą ocenę:')} co się podoba, a co nie. Nawet krótka uwaga oszczędzi nam niepotrzebnych oglądań.`,
      ], salt),
    ].join('\n\n');
    return { kind: 'offer', body, facts: ['kalibracja ankiety'] };
  }

  const facts: string[] = [];
  let lessonBits: string[] = [];

  if (params.prevOffer && params.prevFeedback && next) {
    const vs = compareLessonToNext(params.prevOffer, params.prevFeedback, next);
    // Fakty (pełne zdania) — do zapisu i podglądu; surowe „bity” — do listu agenta.
    facts.push(...(vs ? lessonBitsToRichFacts(vs, next) : []));
    lessonBits = vs ? vs.split(' · ').map((bit) => bit.trim()).filter(Boolean) : [];
  }

  if (!facts.length && params.reasons?.length) {
    const mapped = params.reasons
      .map((reason) => {
        // Allow-list: only these reasons may reach the client; everything else is the agent's analysis.
        if (/tego wcześniej brakowało/i.test(reason)) return 'Ma balkon lub loggię — tego wcześniej brakowało.';
        if (/^Ma co najmniej \d+ pokoje/i.test(reason)) return reason.replace(' — zgodnie z Twoimi uwagami.', '.');
        if (/spełnia oczekiwanie co do roku budowy/i.test(reason)) return reason;
        if (/^Dzielnica .+ już się podobała\.$/i.test(reason)) {
          return reason.replace('już się podobała.', 'była wcześniej oceniona jako trafiona.');
        }
        if (/paśmie ogłoszeń/i.test(reason)) return 'Cena jest zbliżona do ofert, które wcześniej oceniono pozytywnie.';
        if (/^Ma parking/i.test(reason)) return 'Ma parking lub miejsce postojowe.';
        if (/^Jest winda/i.test(reason)) return 'Jest winda w budynku.';
        return null;
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
        voice,
      })
    : buildFirstOfferLetter({ voice, loc, facts, salt });

  return { kind: 'offer', body, facts };
}

function buildFirstOfferLetter(params: {
  voice: ClientVoice;
  loc: string;
  facts: string[];
  salt: string | number | null;
}): string {
  const { voice, loc, facts, salt } = params;
  const { a, c } = voice;
  const why = facts.length
    ? `${voice.pick('first-why', ['Dlaczego właśnie ta?', 'Co mnie w niej przekonało:', 'Kilka powodów, dla których ją wysyłam:'], salt)} ${facts.join(' ')}`
    : voice.pick('first-generic', [
        `${a('Wybrałem', 'Wybrałam')} ją${loc ? ` (${loc})` : ''}, bo spośród aktualnych ofert najlepiej łączy ${c('Pani kryteria', 'Pana kryteria', 'ustalone kryteria')} z tym, co ${c('do tej pory się Pani podobało', 'do tej pory się Panu podobało', 'do tej pory się podobało')}.`,
        `Spośród tego, co jest teraz na rynku${loc ? ` (${loc})` : ''}, ta oferta wydała mi się najbliższa ${c('Pani oczekiwaniom', 'Pana oczekiwaniom', 'oczekiwaniom')}.`,
      ], salt);
  const close = voice.pick('first-close', [
    `${c('Proszę dać znać, co Pani o niej myśli', 'Proszę dać znać, co Pan o niej myśli', 'Proszę o krótką opinię')} — na tej podstawie przygotuję kolejne propozycje.`,
    `Jeśli się spodoba, umówmy oglądanie. Jeśli nie — proszę napisać, czego brakuje.`,
    `${a('Jestem ciekaw', 'Jestem ciekawa')} ${c('Pani zdania', 'Pana zdania', 'opinii')}.`,
  ], salt);
  return [voice.greeting, why, close].join('\n\n');
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
  voice?: ClientVoice;
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
    voice: params.voice,
  }).body;
}

export function buildConfidenceDialogueTurn(params: {
  phrase: string;
  agentFirstName?: string | null;
  voice?: ClientVoice;
}): DialogueTurn {
  const voice = params.voice || buildClientVoice({ agentName: params.agentFirstName });
  const { a, c } = voice;
  const phrase = params.phrase;
  const QUESTIONS: Record<string, string> = {
    'Za drogo': `kilka ostatnich propozycji było ${c('dla Pani ', 'dla Pana ', '')}za drogich. Czy dobrze rozumiem, że mam szukać wyraźnie taniej niż one?`,
    'Brak balkonu': `brak balkonu przeszkadzał już przy kilku ofertach. Czy balkon albo loggia to warunek konieczny? Jeśli tak, nie będę już pokazywać mieszkań bez niego.`,
    'Nie ta dzielnica': `okolica kilka razy nie pasowała. Czy mam zupełnie pominąć tę część miasta w dalszych poszukiwaniach?`,
    'Za stare': `przy kilku ofertach budynek okazał się za stary. Czy mam pokazywać tylko nowsze budynki — bez wyjątków?`,
    'Za mało pokoi': `kilka razy pokoi było za mało. Czy liczba pokoi, o której ${c('Pani pisała', 'Pan pisał', 'była mowa')}, to absolutne minimum?`,
    'Brak parkingu': `brak miejsca parkingowego przeszkadzał już kilka razy. Czy parking ma być obowiązkowy w każdej kolejnej propozycji?`,
    'Brak windy': `brak windy przeszkadzał już kilka razy. Czy winda ma być obowiązkowa w każdej kolejnej propozycji?`,
    'Brak ogrodu': `brak ogrodu przeszkadzał już kilka razy. Czy ogród ma być warunkiem koniecznym?`,
    'Za mały metraż': `kilka mieszkań okazało się za małych. Czy mam podnieść minimalny metraż i trzymać się go bez wyjątków?`,
    'Za duży metraż': `kilka mieszkań okazało się za dużych. Czy mam obniżyć maksymalny metraż i trzymać się go bez wyjątków?`,
  };
  const known = Boolean(QUESTIONS[phrase]);
  const core = QUESTIONS[phrase] || `chcę się upewnić, że dobrze rozumiem uwagę „${phrase}”. Czy to warunek, którego mam się trzymać przy każdej kolejnej propozycji?`;
  const prefaces = [
    'Zanim wyślę kolejną propozycję — jedno pytanie: ',
    `Jedno szybkie pytanie, żebym nie ${a('szukał', 'szukała')} na ślepo: `,
    ...(known ? [`${a('Zauważyłem', 'Zauważyłam')}, że `] : []),
  ];
  const question = withChatLead(voice, `${voice.pick('confidence-preface', prefaces, phrase)}${core}`);

  return {
    kind: 'confidence',
    body: question,
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
      { id: 'no', label: 'Nie, to nie tak' },
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
  voice?: ClientVoice;
}): DialogueTurn {
  const s = params.snapshot;
  const voice = params.voice || buildClientVoice({ agentName: params.agentFirstName });
  const { a, c } = voice;
  const implied = formatPpsm(s.impliedPpsm);
  const p25 = s.p25Ppsm != null ? formatPpsm(s.p25Ppsm) : '—';
  const median = s.medianPpsm != null ? formatPpsm(s.medianPpsm) : '—';
  const budget = formatPln(s.maxPrice);
  const suggested =
    s.suggestedMaxPrice != null ? formatPln(s.suggestedMaxPrice) : null;

  const body = [
    withChatLead(
      voice,
      `przy kilku propozycjach padło „za drogo”, więc ${a('sprawdziłem', 'sprawdziłam')}, za ile naprawdę sprzedają się mieszkania w tej okolicy — na podstawie transakcji notarialnych z rejestru cen (GUGiK RCN).`,
    ),
    `W ${s.districtLabel} w ostatnich ${s.periodDays} dniach (${s.txnCount} aktów) mediana wyniosła ${median}, a co czwarte mieszkanie sprzedano poniżej ${p25}.`,
    `Przy ${s.area} m² i budżecie ${budget} wychodzi ok. ${implied} — mniej niż płacono za najtańsze mieszkania w tej okolicy. Dlatego tak trudno o trafione oferty.`,
    s.rcnLagNote,
    suggested
      ? `Realnie bliżej rynku jest ok. ${suggested}. Szukamy dalej w obecnym budżecie, czy mam pokazać też oferty bliżej rynku?`
      : `Czy ${c('zostaje Pani', 'zostaje Pan', 'zostajemy')} przy tym budżecie?`,
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
  voice?: ClientVoice;
}): DialogueTurn {
  const voice = params.voice || buildClientVoice({ agentName: params.agentFirstName });
  const { c } = voice;
  const body = withChatLead(
    voice,
    `od dłuższego czasu szukam z balkonem ${c('w Pani budżecie i okolicy', 'w Pana budżecie i okolicy', 'w tym budżecie i okolicy')} — takich ofert praktycznie teraz nie ma. Czy mogę pokazać też mieszkanie bez balkonu, jeśli cała reszta będzie pasować?`,
  );

  return {
    kind: 'relax_criterion',
    body,
    facts: ['brak_puli_z_balkonem', String(params.rejectCount)],
    checkbackType: 'relax_requireBalcony',
    lockKey: 'requireBalcony',
    options: [
      { id: 'keep_balcony', label: 'Balkon zostaje — proszę szukać dalej' },
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
    body: `${lead}${params.reason} Wstrzymuję automatyczne dokładanie kolejnej oferty, aż skontaktujesz się z klientem.`,
    facts: ['handoff'],
  };
}
