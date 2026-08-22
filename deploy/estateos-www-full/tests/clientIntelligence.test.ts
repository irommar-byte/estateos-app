import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTELLIGENCE_SETTINGS,
  intelligenceAdjustScore,
  learnFromFeedback,
  parseIntelligencePatch,
  summarizeTaste,
} from '../src/lib/crm/clientIntelligence';
import { serializeClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';

const baseOffer = {
  id: 10,
  title: 'Mieszkanie na Ursynowie',
  description: 'Przestronne, jasne mieszkanie z balkonem od południa, kuchnia 12 m, cicha okolica przy parku.',
  city: 'Warszawa',
  district: 'Ursynów',
  price: 890000,
  area: 54,
  rooms: 3,
  hasBalcony: true,
};

test('learns likes, dislikes and phrases from portal feedback', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({
        sentiment: 'dislike',
        phrases: ['Brak balkonu', 'Za drogo'],
        disliked: 'hałas od ulicy',
      }),
      offer: { ...baseOffer, id: 1, district: 'Mokotów', hasBalcony: false, price: 1200000 },
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({
        sentiment: 'like',
        phrases: ['Świetna lokalizacja'],
      }),
      offer: { ...baseOffer, id: 2, district: 'Ursynów' },
    },
  ]);
  assert.equal(taste.learnCount, 2);
  assert.equal(taste.dislikes, 1);
  assert.equal(taste.likes, 1);
  assert.ok(taste.rejectedOfferIds.includes(1));
  assert.ok(taste.rejectedDistricts.includes('Mokotów'));
  assert.ok(taste.likedDistricts.includes('Ursynów'));
  assert.match(summarizeTaste(taste), /2 reakcji/);
});

test('boosts listings with balcony after a balcony objection, including from description', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({
        sentiment: 'dislike',
        phrases: ['Brak balkonu'],
      }),
      offer: { id: 1, district: 'Wola', hasBalcony: false, description: 'Mieszkanie bez balkonu.' },
    },
  ]);
  const withBalcony = intelligenceAdjustScore({
    radarScore: 88,
    taste,
    maxPrice: 1000000,
    offer: baseOffer,
  });
  const fromDescription = intelligenceAdjustScore({
    radarScore: 88,
    taste,
    maxPrice: 1000000,
    offer: { ...baseOffer, id: 11, hasBalcony: null, description: 'Duży balkon i jasny salon.' },
  });
  const without = intelligenceAdjustScore({
    radarScore: 88,
    taste,
    maxPrice: 1000000,
    offer: { ...baseOffer, id: 12, hasBalcony: false, description: 'Kawalerka od strony ulicy, bez balkonu.' },
  });
  assert.ok(withBalcony.score > without.score);
  assert.ok(fromDescription.score > without.score);
  assert.ok(without.reasons.some((item) => /balkonu/.test(item)));
});

test('penalizes listings near budget after za drogo and kitchen objections in the description', () => {
  const taste = learnFromFeedback([
    {
      offerId: 3,
      clientFeedback: serializeClientOfferFeedback({
        sentiment: 'maybe',
        phrases: ['Za drogo', 'Za mała kuchnia'],
        disliked: 'aneks kuchenny',
      }),
      offer: { id: 3, price: 990000, description: 'Aneks kuchenny 5 m.' },
    },
  ]);
  const expensiveAneks = intelligenceAdjustScore({
    radarScore: 90,
    taste,
    maxPrice: 900000,
    offer: {
      id: 20,
      title: 'Mieszkanie',
      description: 'Aneks kuchenny, bez osobnej kuchni.',
      price: 880000,
      district: 'Mokotów',
    },
  });
  assert.ok(expensiveAneks.score < 90);
  assert.ok(expensiveAneks.reasons.length >= 1);
});

test('parseIntelligencePatch clamps assistant settings', () => {
  const patch = parseIntelligencePatch({
    enabled: true,
    intervalHours: 24,
    dailyLimit: 1,
    minLearns: 3,
    minScore: 92,
  });
  assert.deepEqual(patch, {
    intelligenceEnabled: true,
    intelligenceIntervalHours: 24,
    intelligenceDailyLimit: 1,
    intelligenceMinLearns: 3,
    intelligenceMinScore: 92,
  });
  assert.equal(parseIntelligencePatch({ intervalHours: 2 })?.intelligenceIntervalHours, undefined);
  assert.equal(DEFAULT_INTELLIGENCE_SETTINGS.minScore, 92);
});
