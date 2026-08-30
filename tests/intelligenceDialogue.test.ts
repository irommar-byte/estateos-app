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

test('buildOfferDialogueTurn references last objection and lesson bits', () => {
  const turn = buildOfferDialogueTurn({
    agentFirstName: 'Anna',
    prevOffer: {
      id: 1,
      district: 'Ursus',
      price: 900000,
      hasBalcony: false,
      rooms: 3,
    },
    prevFeedback: {
      sentiment: 'dislike',
      liked: '',
      disliked: '',
      phrases: ['Brak balkonu', 'Nie ta dzielnica'],
      note: '',
    },
    nextOffer: {
      id: 2,
      city: 'Warszawa',
      district: 'Bemowo',
      price: 846000,
      hasBalcony: true,
      rooms: 3,
    },
    reasons: [],
    calibrating: false,
  });
  assert.match(turn.body, /Anna —/);
  assert.match(turn.body, /Brak balkonu/i);
  assert.match(turn.body, /balkon/i);
  assert.match(turn.body, /Bemowo/i);
});

test('buildConfidenceDialogueTurn asks before changing criteria', () => {
  const turn = buildConfidenceDialogueTurn({ phrase: 'Za drogo', agentFirstName: 'Jan' });
  assert.equal(turn.kind, 'confidence');
  assert.match(turn.body, /za drogo/i);
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
