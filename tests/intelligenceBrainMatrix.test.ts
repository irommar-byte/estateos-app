/**
 * Macierz scenariuszy mózgu Intelligence — reakcje, nauka, scoring, checkbacki.
 * Testuje czyste funkcje (bez bazy). Integracja pick/send wymaga osobnych testów e2e.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DISLIKE_PHRASES, serializeClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';
import {
  extractFeedbackSignals,
  isStructuralDislikePhrase,
} from '../src/lib/crm/feedbackSignals';
import {
  DEFAULT_INTELLIGENCE_LOCKS,
  buildCheckbackPreferenceUpdate,
  compareLessonToNext,
  effectiveMaxPrice,
  intelligenceAdjustScore,
  learnFromFeedback,
  phraseCount,
  preferenceUpdatesFromTaste,
} from '../src/lib/crm/clientIntelligence';
import { calculateRadarMatchScore } from '../src/lib/radarMatchScore';
import {
  buildCheckbackChoicePrompt,
  mapChatTextToCheckbackOption,
} from '../src/lib/crm/intelligenceCheckbackChat';
import { feedbackRequestsHandoff, INTELLIGENCE_CONFIRM_PHRASES } from '../src/lib/crm/intelligenceCheckback';
import { buildConfidenceDialogueTurn } from '../src/lib/crm/intelligenceDialogue';

const yesNo = [
  { id: 'yes', label: 'Tak, zgadza się' },
  { id: 'no', label: 'Nie — poprawię' },
];

const marketOptions = [
  { id: 'stay_budget', label: 'Szukaj dalej w tym budżecie' },
  { id: 'raise_budget', label: 'Pokaż bliżej rynku (do 950 000 zł)' },
];

const balconyOptions = [
  { id: 'keep_balcony', label: 'Zostawiam balkon — szukaj dalej' },
  { id: 'allow_without_balcony', label: 'Może być bez balkonu' },
];

function dislikeTwice(phrase: string, note = '') {
  return learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: [phrase], note }),
      offer: { id: 1, price: 900_000, rooms: 2, yearBuilt: 1990 },
      clientFeedbackAt: '2026-08-01T10:00:00Z',
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: [phrase], note }),
      offer: { id: 2, price: 920_000, rooms: 2, yearBuilt: 1985 },
      clientFeedbackAt: '2026-08-02T10:00:00Z',
    },
  ]);
}

function dislikeOnce(phrase: string, note = '') {
  return learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: [phrase], note }),
      offer: { id: 1, price: 900_000 },
      clientFeedbackAt: '2026-08-01T10:00:00Z',
    },
  ]);
}

// ─── Macierza chipów DISLIKE ───────────────────────────────────────────────

test('every structural DISLIKE chip maps to a signal kind', () => {
  const structural = [
    'Za stare',
    'Za mało pokoi',
    'Brak balkonu',
    'Brak parkingu',
    'Brak windy',
    'Brak ogrodu',
    'Za mały metraż',
    'Za duży metraż',
    'Za drogo',
    'Nie ta dzielnica',
  ];
  for (const phrase of structural) {
    assert.ok(isStructuralDislikePhrase(phrase), `${phrase} should be structural`);
    const signals = extractFeedbackSignals({
      sentiment: 'dislike',
      liked: '',
      disliked: '',
      note: '',
      phrases: [phrase],
    });
    assert.ok(signals.length >= 1, `${phrase} should emit at least one signal`);
  }
});

test('preferenceUpdatesFromTaste never mutates pref — only notes (1× soft, 2× pending confirm)', () => {
  const onceBalcony = preferenceUpdatesFromTaste({
    pref: { requireBalcony: false },
    taste: dislikeOnce('Brak balkonu'),
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.deepEqual(onceBalcony.data, {});
  assert.ok(onceBalcony.notes.some((n) => /scoringu/i.test(n)));

  const twiceBalcony = preferenceUpdatesFromTaste({
    pref: { requireBalcony: false },
    taste: dislikeTwice('Brak balkonu'),
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.deepEqual(twiceBalcony.data, {});
  assert.ok(twiceBalcony.notes.some((n) => /zapytam klienta/i.test(n)));

  const onceYear = preferenceUpdatesFromTaste({
    pref: { minYear: 1900 },
    taste: dislikeOnce('Za stare', 'od 2000'),
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.deepEqual(onceYear.data, {});
  assert.ok(onceYear.notes.some((n) => /Za stare/i.test(n)));
});

test('buildCheckbackPreferenceUpdate applies pref only after confirmed Tak', () => {
  const taste = dislikeTwice('Brak balkonu');
  const confirmed = buildCheckbackPreferenceUpdate({
    checkbackType: 'confirm_brak_balkonu',
    taste,
    pref: { requireBalcony: false },
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.equal(confirmed.data.requireBalcony, true);

  const windy = buildCheckbackPreferenceUpdate({
    checkbackType: 'confirm_brak_windy',
    taste: dislikeTwice('Brak windy'),
    pref: { requireElevator: false },
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.equal(windy.data.requireElevator, true);

  const budget = buildCheckbackPreferenceUpdate({
    checkbackType: 'confirm_za_drogo',
    taste: learnFromFeedback([
      {
        offerId: 1,
        clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Za drogo'] }),
        offer: { id: 1, price: 945_000 },
      },
      {
        offerId: 2,
        clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Za drogo'] }),
        offer: { id: 2, price: 980_000 },
      },
    ]),
    pref: { maxPrice: 1_000_000 },
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.ok(budget.data.maxPrice != null);
  assert.ok(Number(budget.data.maxPrice) < 945_000);
});

test('all INTELLIGENCE_CONFIRM_PHRASES have dialogue + lockKey where expected', () => {
  for (const phrase of INTELLIGENCE_CONFIRM_PHRASES) {
    const turn = buildConfidenceDialogueTurn({ phrase });
    assert.ok(turn.checkbackType.startsWith('confirm_'), phrase);
    assert.ok(turn.options.length >= 2, phrase);
  }
});

// ─── Działanie vs deklaracja (sentiment) ───────────────────────────────────

test('dislike rejects offer id; maybe does not', () => {
  const maybe = learnFromFeedback([
    {
      offerId: 5,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'maybe', phrases: ['Za drogo'] }),
      offer: { id: 5, price: 900_000 },
    },
  ]);
  assert.equal(maybe.rejectedOfferIds.includes(5), false);

  const dislike = learnFromFeedback([
    {
      offerId: 5,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Za drogo'] }),
      offer: { id: 5, price: 900_000 },
    },
  ]);
  assert.equal(dislike.rejectedOfferIds.includes(5), true);
});

test('maybe rooms give softer scoring boost than liked rooms', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'maybe' }),
      offer: { id: 1, rooms: 3 },
    },
  ]);
  const maybeBoost = intelligenceAdjustScore({
    radarScore: 80,
    taste,
    offer: { id: 10, rooms: 3, title: 'Test 3 pok.' },
  });

  const likedTaste = learnFromFeedback([
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 2, rooms: 3 },
    },
  ]);
  const likedBoost = intelligenceAdjustScore({
    radarScore: 80,
    taste: likedTaste,
    offer: { id: 11, rooms: 3, title: 'Test 3 pok.' },
  });

  assert.ok(likedBoost.score > maybeBoost.score);
  assert.ok(maybeBoost.reasons.some((r) => /może być/i.test(r)));
});

test('recentPhrases amplify negative scoring vs older same phrase', () => {
  const baseOffer = { id: 10, title: 'Mieszkanie przy ruchliwej ulicy z hałasem', description: 'Przy ruchliwej arterii' };
  const older = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Hałas / ruchliwa ulica'] }),
      offer: { id: 1 },
      clientFeedbackAt: '2026-08-01T10:00:00Z',
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 2 },
      clientFeedbackAt: '2026-08-02T10:00:00Z',
    },
    {
      offerId: 3,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 3 },
      clientFeedbackAt: '2026-08-03T10:00:00Z',
    },
    {
      offerId: 4,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 4 },
      clientFeedbackAt: '2026-08-04T10:00:00Z',
    },
  ]);
  const recent = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 1 },
      clientFeedbackAt: '2026-08-01T10:00:00Z',
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 2 },
      clientFeedbackAt: '2026-08-02T10:00:00Z',
    },
    {
      offerId: 3,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { id: 3 },
      clientFeedbackAt: '2026-08-03T10:00:00Z',
    },
    {
      offerId: 4,
      clientFeedback: serializeClientOfferFeedback({
        sentiment: 'dislike',
        phrases: ['Hałas / ruchliwa ulica'],
      }),
      offer: { id: 4 },
      clientFeedbackAt: '2026-08-04T10:00:00Z',
    },
  ]);

  const olderScore = intelligenceAdjustScore({ radarScore: 85, taste: older, offer: baseOffer }).score;
  const recentScore = intelligenceAdjustScore({ radarScore: 85, taste: recent, offer: baseOffer }).score;
  assert.ok(recentScore < olderScore, 'recent phrase should penalize more');
});

// ─── Budżet i radar ────────────────────────────────────────────────────────

test('effectiveMaxPrice uses min of pref, hint, and rejected prices after 2× za drogo', () => {
  const taste = dislikeTwice('Za drogo');
  taste.expensivePrices.push(945_000, 980_000);
  taste.maxPriceHint = 900_000;
  const cap = effectiveMaxPrice({ prefMaxPrice: 800_000, taste, strictBudget: true });
  assert.ok(cap != null);
  assert.ok(cap! <= 900_000);
  assert.ok(cap! < 945_000);
});

test('single Za drogo does not hard-cap via effectiveMaxPrice strict path alone', () => {
  const taste = dislikeOnce('Za drogo');
  taste.expensivePrices.push(945_000);
  const cap = effectiveMaxPrice({ prefMaxPrice: 800_000, taste, strictBudget: false });
  assert.equal(cap, 800_000);
});

test('radar structural gate rejects over budget, old, small rooms, large area, small minArea', () => {
  const pref = {
    city: 'Warszawa',
    selectedDistricts: [],
    maxPrice: 800_000,
    minYear: 2000,
    minRooms: 2,
    maxArea: 60,
    minArea: 45,
    transactionType: 'SELL',
    propertyType: 'FLAT',
  };
  const base = { city: 'Warszawa', transactionType: 'SELL', propertyType: 'FLAT', area: 50, rooms: 3, yearBuilt: 2015, price: 750_000 };

  assert.ok(calculateRadarMatchScore(pref, base) > 0);
  assert.equal(calculateRadarMatchScore(pref, { ...base, price: 900_000 }), 0);
  assert.equal(calculateRadarMatchScore(pref, { ...base, yearBuilt: 1990 }), 0);
  assert.equal(calculateRadarMatchScore(pref, { ...base, rooms: 1 }), 0);
  assert.equal(calculateRadarMatchScore(pref, { ...base, area: 80 }), 0);
  assert.equal(calculateRadarMatchScore(pref, { ...base, area: 40 }), 0);
});

test('previously disliked offer id always scores zero', () => {
  const taste = learnFromFeedback([
    {
      offerId: 42,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike' }),
      offer: { id: 42 },
    },
  ]);
  const result = intelligenceAdjustScore({
    radarScore: 99,
    taste,
    offer: { id: 42, title: 'Perfect flat' },
  });
  assert.equal(result.score, 0);
});

// ─── Checkback chat ─────────────────────────────────────────────────────────

test('chat maps common Polish affirmations and negations', () => {
  const affirmations = ['Dokładnie', 'Dokladnie', 'tak', 'zgadza się', 'ok', 'pewnie', 'jasne'];
  for (const text of affirmations) {
    assert.equal(mapChatTextToCheckbackOption(text, yesNo), 'yes', `"${text}" → yes`);
  }
  const negations = ['nie', 'Nie — poprawię', 'poprawię', 'inaczej'];
  for (const text of negations) {
    assert.equal(mapChatTextToCheckbackOption(text, yesNo), 'no', `"${text}" → no`);
  }
});

test('chat maps market and balcony option keywords', () => {
  assert.equal(mapChatTextToCheckbackOption('zostawiam w tym budżecie', marketOptions), 'stay_budget');
  assert.equal(mapChatTextToCheckbackOption('pokaż bliżej rynku', marketOptions), 'raise_budget');
  assert.equal(mapChatTextToCheckbackOption('zostawiam balkon', balconyOptions), 'keep_balcony');
  assert.equal(mapChatTextToCheckbackOption('może być bez balkonu', balconyOptions), 'allow_without_balcony');
});

test('intelligenceAdjustScore hard-rejects below minArea hint', () => {
  const taste = dislikeOnce('Za mały metraż', 'min 45 m');
  taste.minAreaHint = 45;
  const result = intelligenceAdjustScore({
    radarScore: 88,
    taste,
    pref: { minArea: 45 },
    offer: { id: 1, area: 38, title: 'Małe mieszkanie ciasne' },
  });
  assert.equal(result.score, 0);
});

test('KNOWN GAP fixed: tak ale nie maps to ambiguous', () => {
  assert.equal(mapChatTextToCheckbackOption('tak ale nie', yesNo), 'ambiguous');
  assert.equal(mapChatTextToCheckbackOption('nie wiem', yesNo), 'ambiguous');
});

test('handoff detects Polish viewing intent (spotkanie, umówmy, zobaczyć)', () => {
  const handoff = feedbackRequestsHandoff({
    phrases: ['Za drogo'],
    note: 'Chcę zobaczyć to mieszkanie — umówmy spotkanie',
    liked: '',
    disliked: '',
  });
  assert.ok(handoff);
  assert.match(handoff!, /agentowi/i);
});

test('handoff detects the viewing button and a concrete question for the agent', () => {
  assert.match(
    feedbackRequestsHandoff({
      sentiment: 'like',
      phrases: [],
      note: '',
      liked: '',
      disliked: '',
    }) || '',
    /Chcę oglądać/i,
  );
  assert.match(
    feedbackRequestsHandoff({
      sentiment: 'maybe',
      phrases: [],
      note: 'Sprawdź proszę, czy można dokupić miejsce postojowe.',
      liked: '',
      disliked: '',
    }) || '',
    /czeka na konkretną odpowiedź/i,
  );
});

test('long unrelated text returns null for checkback mapping', () => {
  assert.equal(
    mapChatTextToCheckbackOption('Chciałbym umówić spotkanie w środę o 17:00 i omówić finansowanie', yesNo),
    null,
  );
});

test('buildCheckbackChoicePrompt lists all options', () => {
  const prompt = buildCheckbackChoicePrompt(yesNo);
  assert.match(prompt, /Tak, zgadza się/);
  assert.match(prompt, /Nie — poprawię/);
  assert.match(prompt, /wybierz proszę/i);
});

// ─── Handoff i lekcje ───────────────────────────────────────────────────────

test('compareLessonToNext explains improvements (balkon, taniej, rok, pokoje)', () => {
  const prev = { id: 1, price: 950_000, yearBuilt: 1994, rooms: 1, hasBalcony: false };
  const next = { id: 2, price: 820_000, yearBuilt: 2016, rooms: 3, hasBalcony: true };
  const feedback = {
    sentiment: 'dislike' as const,
    liked: '',
    disliked: 'Za drogo, za stare, za mało pokoi',
    note: 'Od 2000 roku, conajmniej 2 pokojowe',
    phrases: ['Za drogo', 'Za stare', 'Za mało pokoi', 'Brak balkonu'],
  };
  const vs = compareLessonToNext(prev, feedback, next);
  assert.match(vs, /balkon/i);
  assert.match(vs, /Taniej/i);
  assert.match(vs, /2016|2000|rok/i);
  assert.match(vs, /pok/i);
});

// ─── Kontrakt: writeback przed checkbackiem (obecne zachowanie) ─────────────

test('CONTRACT: 2× za drogo — notes only until checkback Tak', () => {
  const taste = dislikeTwice('Za drogo');
  taste.expensivePrices.push(945_000, 980_000);
  const notesOnly = preferenceUpdatesFromTaste({
    pref: { maxPrice: 1_000_000 },
    taste,
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.deepEqual(notesOnly.data, {});
  assert.ok(notesOnly.notes.some((n) => /zapytam klienta/i.test(n)));

  const afterYes = buildCheckbackPreferenceUpdate({
    checkbackType: 'confirm_za_drogo',
    taste,
    pref: { maxPrice: 1_000_000 },
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.ok(afterYes.data.maxPrice != null);
});

// ─── Pokrycie wszystkich chipów DISLIKE w learnFromFeedback ─────────────────

test('all DISLIKE_PHRASES increment learnCount when used', () => {
  for (const phrase of DISLIKE_PHRASES) {
    const taste = dislikeOnce(phrase);
    assert.equal(taste.learnCount, 1, `${phrase} should count as learning`);
    assert.ok(taste.phrases.includes(phrase), `${phrase} should be in phrases`);
  }
});
