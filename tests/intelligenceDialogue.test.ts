import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfferDialogueTurn,
  buildConfidenceDialogueTurn,
  buildMarketRealityDialogueTurn,
  buildRelaxBalconyDialogueTurn,
} from '../src/lib/crm/intelligenceDialogue';
import { serializeClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';
import { shouldTriggerMarketRealityCheckback, buildBuyerMarketRealitySnapshot } from '../src/lib/crm/buyerMarketReality';
import { learnFromFeedback, phraseCount } from '../src/lib/crm/clientIntelligence';
import { buildClientVoice } from '../src/lib/crm/clientVoice';

test('buildOfferDialogueTurn references last objection and lesson bits', () => {
  const turn = buildOfferDialogueTurn({
    agentFirstName: 'Anna',
    prevOffer: {
      id: 1,
      district: 'Ursus',
      price: 900000,
      hasBalcony: false,
      rooms: 1,
      yearBuilt: 1994,
    },
    prevFeedback: {
      sentiment: 'dislike',
      liked: '',
      disliked: 'Za stare',
      phrases: ['Brak balkonu', 'Nie ta dzielnica'],
      note: 'Od 2000 roku poproszę.',
    },
    nextOffer: {
      id: 2,
      city: 'Warszawa',
      district: 'Bemowo',
      price: 846000,
      hasBalcony: true,
      rooms: 2,
      yearBuilt: 2015,
    },
    reasons: [],
    calibrating: false,
    voice: buildClientVoice({ clientId: 5, firstName: 'Tomasz', salutation: 'PAN', agentName: 'Anna', now: new Date('2026-10-23T08:00:00Z') }),
  });
  assert.match(turn.body, /^Dzień dobry, Panie Tomaszu,/);
  assert.match(turn.body, /Za stare|2000|star/i);
  assert.match(turn.body, /balkon/i);
  assert.doesNotMatch(turn.body, /Co teraz zrób|Intelligence|uczy się|uczą się|napisałeś|odrzuciłeś/);
  assert.doesNotMatch(turn.body, /\b(Zapamiętałem|Wziąłem|szukałem|Przejrzałem|Wybrałem|wdzięczny|ciekaw )\b/);
  assert.ok(turn.body.split('\n\n').length >= 3, 'expected multi-paragraph agent letter');
});

test('buildConfidenceDialogueTurn asks before changing criteria', () => {
  const turn = buildConfidenceDialogueTurn({ phrase: 'Za drogo', agentFirstName: 'Jan' });
  assert.equal(turn.kind, 'confidence');
  assert.match(turn.body, /za drog/i);
  assert.doesNotMatch(turn.body, /sygnalizowałeś|odrzuciłeś/);
  assert.equal(turn.options?.length, 2);
});

test('buildMarketRealityDialogueTurn includes RCN facts', () => {
  const turn = buildMarketRealityDialogueTurn({
    agentFirstName: 'Ewa',
    snapshot: {
      city: 'Warszawa',
      districts: ['Wola'],
      area: 54,
      maxPrice: 600000,
      impliedPpsm: 11111,
      medianPpsm: 15000,
      p25Ppsm: 13500,
      p75Ppsm: 17000,
      txnCount: 120,
      periodDays: 365,
      basis: 'district',
      districtLabel: 'Wola',
      suggestedMaxPrice: 729000,
      rcnLagNote: 'Opóźnienie RCN.',
      source: 'GUGiK RCN',
      asOfIso: new Date().toISOString(),
    },
  });
  assert.equal(turn.kind, 'market_reality');
  assert.match(turn.body, /transakcji notarialnych/i);
  assert.match(turn.body, /729/);
});

test('buildRelaxBalconyDialogueTurn offers explicit lock relaxation choice', () => {
  const turn = buildRelaxBalconyDialogueTurn({ rejectCount: 6 });
  assert.match(turn.body, /balkon/i);
  assert.doesNotMatch(turn.body, /Twoim/);
  assert.ok(turn.options?.some((o) => o.id === 'allow_without_balcony'));
  assert.equal(turn.lockKey, 'requireBalcony');
});

test('phraseCount tracks repeated signals', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Za drogo'] }),
      offer: { id: 1, price: 950000 },
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Za drogo'] }),
      offer: { id: 2, price: 920000 },
    },
  ]);
  assert.equal(phraseCount(taste, 'Za drogo'), 2);
});

test('shouldTriggerMarketRealityCheckback returns false without enough Za drogo', async () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Za drogo'] }),
      offer: { id: 1, price: 950000 },
    },
  ]);
  const result = await shouldTriggerMarketRealityCheckback({
    city: 'Warszawa',
    districts: ['Wola'],
    maxPrice: 600000,
    minArea: 50,
    taste,
  });
  assert.equal(result.trigger, false);
});

test('buildBuyerMarketRealitySnapshot returns null outside Warsaw', async () => {
  const snap = await buildBuyerMarketRealitySnapshot({
    city: 'Kraków',
    districts: [],
    maxPrice: 500000,
    minArea: 45,
  });
  assert.equal(snap, null);
});

test('calibrating letter greets with vocative and never mentions the machine', () => {
  const turn = buildOfferDialogueTurn({
    calibrating: true,
    nextOffer: { id: 9, city: 'Warszawa', district: 'Wola' },
    voice: buildClientVoice({ clientId: 9, firstName: 'Anna', agentName: 'Marian' }),
  });
  assert.match(turn.body, /Pani Anno,/);
  assert.doesNotMatch(turn.body, /Intelligence|ankiety|Twoj/);
});
