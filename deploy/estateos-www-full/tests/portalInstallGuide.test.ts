import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEnablePortalPush,
  portalInstallGuide,
  resolvePortalInstallSurface,
} from '../src/lib/portalInstallGuide';

const FB_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 [FBAN/FBIOS;FBAV/192.0.0.0]';

test('Facebook iOS must open Safari before the home-screen icon', () => {
  assert.equal(resolvePortalInstallSurface(FB_IOS), 'ios-iab');
  const guide = portalInstallGuide('ios-iab');
  assert.equal(guide.needsSafariFirst, true);
  assert.equal(canEnablePortalPush({ surface: 'ios-iab', standalone: false }), false);
  assert.equal(canEnablePortalPush({ surface: 'ios-iab', standalone: true }), true);
});

test('iOS Safari locks notifications until the icon is opened', () => {
  const guide = portalInstallGuide('ios-safari');
  assert.match(guide.steps[0], /Udostępnij/);
  assert.match(guide.steps[1], /ekranu początkowego/i);
  assert.equal(canEnablePortalPush({ surface: 'ios-safari', standalone: false }), false);
  assert.equal(canEnablePortalPush({ surface: 'ios-safari', standalone: true }), true);
});

test('desktop can enable notifications without installing', () => {
  assert.equal(canEnablePortalPush({ surface: 'desktop', standalone: false }), true);
});
