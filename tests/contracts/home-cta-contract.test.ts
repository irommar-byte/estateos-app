import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_CTA_CONTRACT_MAP,
  HOME_CTA_IDS,
  HOME_CTA_MODES,
  resolveHomeCtaContract,
} from '../../src/contracts/homeCtaContract';

test('home CTA contract has all required ids', () => {
  assert.deepEqual(Object.keys(HOME_CTA_CONTRACT_MAP).sort(), [...HOME_CTA_IDS].sort());
});

test('home CTA contract routes and analytics names are frozen', () => {
  const buy = resolveHomeCtaContract('BUY');
  assert.deepEqual(buy.route, { screen: 'MainTabs', params: { screen: 'Radar' } });
  assert.equal(buy.mode, 'BUYER');
  assert.equal(buy.tracking.clickEvent, 'home_cta_click');
  assert.equal(buy.tracking.routeResolvedEvent, 'home_cta_route_resolved');
  assert.equal(buy.tracking.flowOpenedEvent, 'home_cta_flow_opened');

  const sell = resolveHomeCtaContract('SELL');
  assert.deepEqual(sell.route, { screen: 'MainTabs', params: { screen: 'Dodaj' } });
  assert.equal(sell.mode, 'SELLER');

  const investor = resolveHomeCtaContract('INVESTOR');
  assert.deepEqual(investor.route, { screen: 'EstateDiscovery' });
  assert.equal(investor.mode, 'INVESTOR');

  const owner = resolveHomeCtaContract('OWNER');
  assert.deepEqual(owner.route, { screen: 'MainTabs', params: { screen: 'Profil' } });
  assert.equal(owner.mode, 'OWNER');
});

test('home CTA modes are canonical and explicit', () => {
  assert.deepEqual([...HOME_CTA_MODES], ['BUYER', 'SELLER', 'INVESTOR', 'OWNER']);
});
