import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeProfilePromoCards } from '../../src/services/profilePromoService';
import type { ProfilePromoCardRecord } from '../../src/contracts/profilePromoContract';

function card(id: string, overrides: Partial<ProfilePromoCardRecord> = {}): ProfilePromoCardRecord {
  return {
    id,
    kind: 'birthday_coupon',
    title: 'Test',
    subtitle: '',
    meta: '',
    pillLabel: 'Urodziny',
    pillColor: '#FF9F0A',
    pillBg: '#FF9F0A24',
    pillBorder: '#FF9F0A55',
    iconName: 'gift',
    iconBg: '#FF9F0A',
    borderColor: '#FF9F0A44',
    grantsFreeListing: true,
    couponUsed: false,
    ...overrides,
  };
}

test('mergeProfilePromoCards keeps local coupons when API returns empty', () => {
  const local = [card('local_1'), card('local_2')];
  const merged = mergeProfilePromoCards([], local);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((c) => c.id === 'local_1'));
  assert.ok(merged.some((c) => c.id === 'local_2'));
});

test('mergeProfilePromoCards prefers remote row for same id', () => {
  const local = [card('shared', { couponUsed: false, title: 'Lokalny' })];
  const remote = [card('shared', { couponUsed: true, title: 'Z API' })];
  const merged = mergeProfilePromoCards(remote, local);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Z API');
  assert.equal(merged[0].couponUsed, true);
});
