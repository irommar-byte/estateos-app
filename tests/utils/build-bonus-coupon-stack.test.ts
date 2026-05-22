import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBonusCouponStack } from '../../src/utils/buildBonusCouponStack';

const t = (key: string, vars?: Record<string, unknown>) => {
  if (key === 'profile.shop.birthdayCouponTitleYear' && vars?.year != null) {
    return `Kupon urodzinowy ${vars.year}`;
  }
  if (key === 'profile.shop.welcomeCouponTitle') return 'Kupon powitalny';
  return key;
};

test('buildBonusCouponStack excludes plus package and filters dismissed', () => {
  const stack = buildBonusCouponStack({
    t,
    adminPromos: [
      {
        id: 'plus',
        kind: 'plus_package',
        title: 'x',
        subtitle: 's',
        meta: 'm',
        pillLabel: 'p',
        pillColor: '#000',
        pillBg: '#000',
        pillBorder: '#000',
        iconName: 'star',
        iconBg: '#000',
        borderColor: '#000',
      },
    ],
    dismissedIds: new Set(['welcome_1']),
  });
  assert.equal(stack.some((c) => c.kind === 'plus_package'), false);
});

test('buildBonusCouponStack maps welcome coupon from admin promos', () => {
  const stack = buildBonusCouponStack({
    t,
    adminPromos: [
      {
        id: 'welcome_42',
        kind: 'welcome_coupon',
        templateId: 'welcome_free_listing',
        title: 'x',
        subtitle: 's',
        meta: 'm',
        pillLabel: 'p',
        pillColor: '#0A84FF',
        pillBg: '#000',
        pillBorder: '#000',
        iconName: 'sparkles',
        iconBg: '#0A84FF',
        borderColor: '#000',
        grantsFreeListing: true,
        couponUsed: false,
      },
    ],
  });
  const welcome = stack.find((c) => c.id === 'welcome_42');
  assert.equal(welcome?.title, 'Kupon powitalny');
  assert.equal(welcome?.pillLabel, 'profile.shop.welcomePill');
  assert.equal(welcome?.purpose, 'publication');
});

test('buildBonusCouponStack maps birthday without synthetic free listing', () => {
  const stack = buildBonusCouponStack({
    t,
    adminPromos: [
      {
        id: 'b1',
        kind: 'birthday_coupon',
        templateId: 'birthday_free_listing',
        grantsFreeListing: true,
        couponUsed: false,
        createdAt: '2026-05-22T08:00:00.000Z',
        title: 'x',
        subtitle: 's',
        meta: 'm',
        pillLabel: 'p',
        pillColor: '#000',
        pillBg: '#000',
        pillBorder: '#000',
        iconName: 'gift',
        iconBg: '#000',
        borderColor: '#000',
      },
    ],
  });
  assert.equal(stack.some((c) => c.id === 'free_listing'), false);
  const birthday = stack.find((c) => c.id === 'b1');
  assert.equal(birthday?.title, 'Kupon urodzinowy 2026');
  assert.equal(birthday?.birthdayYear, 2026);
});

test('buildBonusCouponStack marks used birthday with gray strip only', () => {
  const stack = buildBonusCouponStack({
    t,
    adminPromos: [
      {
        id: 'b-used',
        kind: 'birthday_coupon',
        templateId: 'birthday_free_listing',
        grantsFreeListing: true,
        couponUsed: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        title: 'x',
        subtitle: 's',
        meta: 'm',
        pillLabel: 'p',
        pillColor: '#000',
        pillBg: '#000',
        pillBorder: '#000',
        iconName: 'gift',
        iconBg: '#000',
        borderColor: '#000',
      },
    ],
  });
  const used = stack.find((c) => c.id === 'b-used');
  assert.equal(used?.pillLabel, 'profile.shop.birthdayPill');
  assert.equal(used?.purposeLabel, 'profile.shop.used');
  assert.equal(used?.iconBg, '#AF52DE');
});

test('buildBonusCouponStack orders welcome before birthday', () => {
  const stack = buildBonusCouponStack({
    t,
    adminPromos: [
      {
        id: 'b1',
        kind: 'birthday_coupon',
        templateId: 'birthday_free_listing',
        createdAt: '2026-05-22T08:00:00.000Z',
        grantsFreeListing: true,
        title: 'x',
        subtitle: 's',
        meta: 'm',
        pillLabel: 'p',
        pillColor: '#000',
        pillBg: '#000',
        pillBorder: '#000',
        iconName: 'gift',
        iconBg: '#000',
        borderColor: '#000',
      },
      {
        id: 'welcome_7',
        kind: 'welcome_coupon',
        templateId: 'welcome_free_listing',
        createdAt: '2026-01-01T00:00:00.000Z',
        grantsFreeListing: true,
        title: 'x',
        subtitle: 's',
        meta: 'm',
        pillLabel: 'p',
        pillColor: '#0A84FF',
        pillBg: '#000',
        pillBorder: '#000',
        iconName: 'sparkles',
        iconBg: '#0A84FF',
        borderColor: '#000',
      },
    ],
  });
  assert.equal(stack[0]?.kind, 'welcome_coupon');
});
