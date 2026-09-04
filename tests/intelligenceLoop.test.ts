import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKBACK_COOLDOWN_MS,
  CHECKBACK_PENDING_TTL_MS,
  intelligenceNeedsHunt,
  isHandoffOpen,
  isPendingCheckbackExpired,
  pickBypassesMinLearns,
  shouldSkipCheckbackTypeFromHistory,
} from '../src/lib/crm/intelligenceCheckback';
import { mapChatTextToCheckbackOption } from '../src/lib/crm/intelligenceCheckbackChat';
import { parseIntelligenceLocks } from '../src/lib/crm/clientIntelligence';

test('pickBypassesMinLearns for feedback and force', () => {
  assert.equal(pickBypassesMinLearns({}), false);
  assert.equal(pickBypassesMinLearns({ replyToFeedback: true }), true);
  assert.equal(pickBypassesMinLearns({ force: true }), true);
});

test('intelligenceNeedsHunt includes minLearns skip', () => {
  assert.equal(intelligenceNeedsHunt('Za mało nauki (1/3 reakcji).', 12), true);
  assert.equal(intelligenceNeedsHunt('Najlepsza oferta ma 80%, a próg to 92%.', 12), true);
  assert.equal(intelligenceNeedsHunt('Brak oferty z wystarczającą pewnością.', null), true);
  assert.equal(intelligenceNeedsHunt('Interwał jeszcze nie minął.', 12), false);
});

test('accepted checkback type is not asked again', () => {
  const now = Date.now();
  const rows = [
    {
      createdAt: new Date(now - 60_000),
      metadata: { type: 'market_reality', status: 'accepted', optionId: 'stay_budget' },
    },
  ];
  assert.equal(shouldSkipCheckbackTypeFromHistory(rows, 'market_reality', now), true);
  assert.equal(shouldSkipCheckbackTypeFromHistory(rows, 'confirm_za_drogo', now), false);
});

test('rejected checkback is on cooldown only for that type', () => {
  const now = Date.now();
  const rows = [
    {
      createdAt: new Date(now - 60_000),
      metadata: { type: 'confirm_za_drogo', status: 'rejected' },
    },
  ];
  assert.equal(shouldSkipCheckbackTypeFromHistory(rows, 'confirm_za_drogo', now), true);
  assert.equal(shouldSkipCheckbackTypeFromHistory(rows, 'market_reality', now), false);
  const old = [
    {
      createdAt: new Date(now - CHECKBACK_COOLDOWN_MS - 1000),
      metadata: { type: 'confirm_za_drogo', status: 'rejected' },
    },
  ];
  assert.equal(shouldSkipCheckbackTypeFromHistory(old, 'confirm_za_drogo', now), false);
});

test('open handoff metadata blocks auto-send', () => {
  assert.equal(isHandoffOpen({}), true);
  assert.equal(isHandoffOpen({ agentStatus: 'done' }), false);
  assert.equal(isHandoffOpen({ agentHandledAt: new Date().toISOString() }), false);
});

test('pending checkback expires after TTL', () => {
  const now = Date.now();
  assert.equal(isPendingCheckbackExpired(new Date(now - 1000), now), false);
  assert.equal(isPendingCheckbackExpired(new Date(now - CHECKBACK_PENDING_TTL_MS - 1), now), true);
});

test('chat without balcony maps to allow_without_balcony first', () => {
  const balconyOpts = [
    { id: 'keep_balcony', label: 'Zostaw wymóg balkonu' },
    { id: 'allow_without_balcony', label: 'Może być bez balkonu' },
  ];
  assert.equal(mapChatTextToCheckbackOption('Może być bez balkonu', balconyOpts), 'allow_without_balcony');
  assert.equal(mapChatTextToCheckbackOption('zostaw balkon', balconyOpts), 'keep_balcony');
});

test('parseIntelligenceLocks does not re-lock maxPrice from survey when JSON exists', () => {
  const locks = parseIntelligenceLocks(
    { requireBalcony: true, maxPrice: false },
    { maxPrice: 700000, requireBalcony: true },
  );
  assert.equal(locks.maxPrice, false);
  assert.equal(locks.requireBalcony, true);
});
