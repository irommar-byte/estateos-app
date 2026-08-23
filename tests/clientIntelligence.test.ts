import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTELLIGENCE_LOCKS,
  DEFAULT_INTELLIGENCE_SETTINGS,
  buildIntelligenceLessons,
  clientFacingWhyLine,
  descriptionImpliesBalcony,
  intelligenceAdjustScore,
  learnFromFeedback,
  parseIntelligencePatch,
  preferenceUpdatesFromTaste,
  shouldPersistBalcony,
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

test('treats loggia in the description as a balcony and ignores bez balkonu', () => {
  assert.equal(descriptionImpliesBalcony('Duża loggia od salonu i dodatkowy balkon.'), true);
  assert.equal(descriptionImpliesBalcony('Mieszkanie bez balkonu, z ogródkiem.'), false);
  assert.equal(shouldPersistBalcony({ id: 1, hasBalcony: false, description: 'Loggia 8 m.' }), true);
  assert.equal(shouldPersistBalcony({ id: 1, hasBalcony: true, description: 'Loggia 8 m.' }), false);
});

test('does not treat generic words from notes as description hits', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({
        sentiment: 'dislike',
        note: 'Daleka lokalizacja do metra. Nie chcę mieszkania z ogródkiem.',
      }),
      offer: { id: 1, description: 'Mieszkanie przy metrze, bez ogródka.' },
    },
  ]);
  const adjusted = intelligenceAdjustScore({
    radarScore: 90,
    taste,
    maxPrice: 1000000,
    offer: { id: 40, title: 'Mieszkanie', description: 'Mieszkanie przy parku, 3 pokoje.' },
  });
  assert.equal(adjusted.reasons.some((item) => /metra|mieszkania/.test(item)), false);
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
  assert.equal(parseIntelligencePatch({ intervalHours: 7 })?.intelligenceIntervalHours, 6);
  assert.equal(parseIntelligencePatch({ minScore: 90 })?.intelligenceMinScore, 92);
  assert.equal(DEFAULT_INTELLIGENCE_SETTINGS.minScore, 92);
});

test('maybe does not reject the listing, likes pull similar rooms and price band', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'maybe', phrases: ['Za drogo'] }),
      offer: { ...baseOffer, id: 1, rooms: 3, price: 890000 },
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' }),
      offer: { ...baseOffer, id: 2, rooms: 3, price: 870000, district: 'Ursynów' },
    },
  ]);
  assert.equal(taste.rejectedOfferIds.includes(1), false);
  assert.equal(taste.maybes, 1);
  const similar = intelligenceAdjustScore({
    radarScore: 80,
    taste,
    maxPrice: 1000000,
    offer: { ...baseOffer, id: 30, rooms: 3, price: 880000, district: 'Ursynów' },
  });
  assert.ok(similar.score > 80);
});

test('write-back tightens unlocked budget and balcony, but respects district lock', () => {
  const taste = learnFromFeedback([
    {
      offerId: 1,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Brak balkonu', 'Za drogo', 'Nie ta dzielnica'] }),
      offer: { ...baseOffer, id: 1, district: 'Mokotów', hasBalcony: false, price: 1200000 },
    },
    {
      offerId: 2,
      clientFeedback: serializeClientOfferFeedback({ sentiment: 'dislike', phrases: ['Brak balkonu', 'Za drogo'] }),
      offer: { ...baseOffer, id: 2, district: 'Wola', hasBalcony: false, price: 1100000 },
    },
  ]);
  const locked = preferenceUpdatesFromTaste({
    pref: { districts: ['Ursynów', 'Mokotów'], maxPrice: 1000000, requireBalcony: false },
    taste,
    locks: { ...DEFAULT_INTELLIGENCE_LOCKS, districts: true },
  });
  assert.equal(locked.data.districts, undefined);
  assert.equal(locked.data.requireBalcony, true);
  assert.ok((locked.data.maxPrice || 0) < 1000000);
  assert.ok(locked.notes.some((item) => /zablokowana/.test(item)));

  const unlocked = preferenceUpdatesFromTaste({
    pref: { districts: ['Ursynów', 'Mokotów'], maxPrice: 1000000, requireBalcony: false },
    taste,
    locks: DEFAULT_INTELLIGENCE_LOCKS,
  });
  assert.deepEqual(unlocked.data.districts, ['Ursynów']);
});

test('client-facing why is a single concrete sentence', () => {
  const line = clientFacingWhyLine({
    reasons: ['Ma balkon / loggię — tego wcześniej brakowało.', 'Radar dał 97% względem ankiety klienta.'],
    city: 'Warszawa',
    district: 'Młynów',
  });
  assert.match(line, /balkon/i);
  assert.equal(line.includes('Radar dał'), false);
});

test('lesson ledger compares sent reaction against the next listing', () => {
  const lessons = buildIntelligenceLessons(
    [
      {
        offerId: 1,
        notifiedAt: '2026-08-22T10:00:00.000Z',
        clientFeedback: serializeClientOfferFeedback({
          sentiment: 'dislike',
          phrases: ['Brak balkonu', 'Za drogo'],
        }),
        offer: { ...baseOffer, id: 1, title: 'Mokotów 2 pok.', hasBalcony: false, price: 1200000, rooms: 2 },
      },
    ],
    { ...baseOffer, id: 10, hasBalcony: true, price: 850000, rooms: 3 },
  );
  assert.equal(lessons.length, 1);
  assert.match(lessons[0].said, /Nie pasuje/i);
  assert.match(lessons[0].vsNext, /balkon/i);
  assert.match(lessons[0].vsNext, /Taniej/i);
});
