import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';
import {
  buildPortalTimeline,
  buildSearchDirection,
  computePortalOfferStats,
  defaultOpenStacks,
  groupPortalOfferStacks,
  initialOpenMatchIds,
  matchStackId,
  phraseBarsFromMatches,
  polishPlural,
  resolveAssistantPulse,
} from '../src/lib/crm/clientPortalOfferBoard';

function match(partial: {
  id: number;
  sentiment?: 'like' | 'maybe' | 'dislike' | null;
  phrases?: string[];
  notifiedAt?: string;
  feedbackAt?: string;
  title?: string;
  intelligenceSent?: boolean;
}) {
  return {
    id: partial.id,
    notifiedAt: partial.notifiedAt ?? `2026-08-0${partial.id}T10:00:00.000Z`,
    clientFeedback: partial.sentiment
      ? serializeClientOfferFeedback({ sentiment: partial.sentiment, phrases: partial.phrases || [] })
      : null,
    clientFeedbackAt: partial.sentiment ? partial.feedbackAt ?? `2026-08-0${partial.id}T12:00:00.000Z` : null,
    intelligenceSent: Boolean(partial.intelligenceSent),
    offer: { id: partial.id * 10, title: partial.title || `Oferta ${partial.id}`, city: 'Warszawa', district: 'Mokotów' },
  };
}

test('groups portal offers into new / like / maybe / dislike stacks, newest first', () => {
  const grouped = groupPortalOfferStacks([
    match({ id: 1, sentiment: 'dislike' }),
    match({ id: 2 }),
    match({ id: 3, sentiment: 'like' }),
    match({ id: 4, sentiment: 'maybe' }),
    match({ id: 5 }),
  ]);
  assert.deepEqual(grouped.new.map((row) => row.id), [5, 2]);
  assert.deepEqual(grouped.like.map((row) => row.id), [3]);
  assert.deepEqual(grouped.maybe.map((row) => row.id), [4]);
  assert.deepEqual(grouped.dislike.map((row) => row.id), [1]);
  assert.equal(matchStackId(match({ id: 9 })), 'new');
});

test('offer stats count sent, pending, reactions and response rate', () => {
  const stats = computePortalOfferStats([
    match({ id: 1, sentiment: 'like' }),
    match({ id: 2, sentiment: 'dislike' }),
    match({ id: 3 }),
    match({ id: 4, sentiment: 'maybe' }),
  ]);
  assert.equal(stats.sent, 4);
  assert.equal(stats.pending, 1);
  assert.equal(stats.like, 1);
  assert.equal(stats.maybe, 1);
  assert.equal(stats.dislike, 1);
  assert.equal(stats.reacted, 3);
  assert.equal(stats.responsePct, 75);
});

test('default stacks keep new and liked open, archive collapsed', () => {
  assert.deepEqual(
    defaultOpenStacks(computePortalOfferStats([match({ id: 1 }), match({ id: 2, sentiment: 'like' }), match({ id: 3, sentiment: 'dislike' })])),
    ['new', 'like'],
  );
  assert.deepEqual(
    defaultOpenStacks(computePortalOfferStats([match({ id: 1, sentiment: 'dislike' })])),
    ['dislike'],
  );
});

test('search direction chips follow current criteria and phrase bars follow feedback', () => {
  const direction = buildSearchDirection(
    {
      location: 'Warszawa · Mokotów',
      areaLabel: 'od 55 m²',
      minArea: 'od 55 m²',
      maxBudget: 'Do 850 000 PLN',
      propertyType: 'Mieszkanie',
      transactionType: 'Kupno',
      threshold: '70%',
      districts: ['Mokotów'],
      amenities: ['Balkon', 'Winda'],
      minYear: 2015,
      minRooms: 3,
    },
    [
      match({ id: 1, sentiment: 'dislike', phrases: ['Za drogo', 'Brak balkonu'] }),
      match({ id: 2, sentiment: 'dislike', phrases: ['Za drogo'] }),
      match({ id: 3, sentiment: 'like', phrases: ['Świetna lokalizacja'] }),
    ],
  );
  assert.match(direction.summary, /850 000/);
  assert.match(direction.summary, /od 2015/);
  assert.match(direction.summary, /Balkon/);
  assert.equal(direction.chips.find((chip) => chip.key === 'rooms')?.value, 'min. 3');
  const bars = phraseBarsFromMatches([
    match({ id: 1, sentiment: 'dislike', phrases: ['Za drogo', 'Brak balkonu'] }),
    match({ id: 2, sentiment: 'dislike', phrases: ['Za drogo'] }),
  ]);
  assert.equal(bars[0].phrase, 'Za drogo');
  assert.equal(bars[0].count, 2);
  assert.equal(bars[0].tone, 'dislike');
});

test('timeline lists sent offers, reactions and checkbacks without duplicating activity rows', () => {
  const matches = [
    match({
      id: 1,
      sentiment: 'like',
      title: 'Mokotów 3 pok.',
      intelligenceSent: true,
      notifiedAt: '2026-08-10T10:00:00.000Z',
      feedbackAt: '2026-08-10T18:00:00.000Z',
    }),
  ];
  const items = buildPortalTimeline(matches, [
    {
      id: 99,
      kind: 'INTELLIGENCE_OFFER',
      title: 'duplikat',
      body: null,
      createdAt: '2026-08-10T10:00:00.000Z',
      offerId: 10,
    },
    {
      id: 100,
      kind: 'INTELLIGENCE_CHECKBACK',
      title: 'Pytanie',
      body: 'Czy min. 3 pokoje to twardy warunek?',
      createdAt: '2026-08-11T09:00:00.000Z',
      metadata: { status: 'accepted', optionId: 'yes', respondedAt: '2026-08-11T09:05:00.000Z' },
    },
  ]);
  assert.equal(items[0].kind, 'checkback');
  assert.match(items[0].title, /Tak/);
  assert.equal(items[1].kind, 'reaction');
  assert.match(items[1].title, /oglądać/);
  assert.equal(items[2].kind, 'offer_sent');
  assert.equal(items.filter((item) => item.kind === 'offer_sent').length, 1);
});

test('initial open ids keep stored cards and only auto-open first new on first visit', () => {
  const matches = [match({ id: 1 }), match({ id: 2 }), match({ id: 3, sentiment: 'like' })];
  assert.deepEqual(initialOpenMatchIds({ matches, storedIds: [] }).sort(), [2]);
  assert.deepEqual(initialOpenMatchIds({ matches, storedIds: [3, 99] }), [3]);
  assert.deepEqual(initialOpenMatchIds({ matches, storedIds: [3], focusMatchId: 1 }).sort(), [1, 3]);
});

test('assistant pulse waits for reaction instead of promising the next card', () => {
  assert.equal(polishPlural(1, 'dopasowanie', 'dopasowania', 'dopasowań'), 'dopasowanie');
  assert.equal(polishPlural(2, 'dopasowanie', 'dopasowania', 'dopasowań'), 'dopasowania');
  assert.equal(polishPlural(5, 'dopasowanie', 'dopasowania', 'dopasowań'), 'dopasowań');

  const waiting = resolveAssistantPulse({
    intelligenceEnabled: true,
    pendingNewCount: 5,
    unscoredCount: 2,
    pendingCheckback: false,
  });
  assert.equal(waiting?.mode, 'waiting_reaction');
  assert.match(waiting?.title || '', /oceń/i);
  assert.match(waiting?.body || '', /5 nowych ofert/);
  assert.doesNotMatch(waiting?.body || '', /za chwilę/);

  const checkback = resolveAssistantPulse({
    intelligenceEnabled: true,
    pendingNewCount: 5,
    unscoredCount: 2,
    pendingCheckback: true,
  });
  assert.equal(checkback?.mode, 'waiting_checkback');

  const preparing = resolveAssistantPulse({
    intelligenceEnabled: true,
    pendingNewCount: 0,
    unscoredCount: 3,
    pendingCheckback: false,
  });
  assert.equal(preparing?.mode, 'preparing');
  assert.equal(preparing?.busy, true);

  const watching = resolveAssistantPulse({
    intelligenceEnabled: true,
    pendingNewCount: 0,
    unscoredCount: 0,
    pendingCheckback: false,
  });
  assert.equal(watching?.mode, 'watching');
  assert.equal(watching?.busy, false);

  assert.equal(
    resolveAssistantPulse({
      intelligenceEnabled: false,
      pendingNewCount: 0,
      unscoredCount: 0,
      pendingCheckback: false,
    }),
    null,
  );
});
