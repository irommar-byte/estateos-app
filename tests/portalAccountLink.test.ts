import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePortalAccountLink,
  extractPortalTokenFromUrl,
  maskEmail,
} from '../src/lib/crm/portalAccountLink';

test('extracts portal token from https, custom scheme and query', () => {
  const token = 'a'.repeat(64);
  assert.equal(extractPortalTokenFromUrl(`https://estateos.pl/klient/${token}`), token);
  assert.equal(extractPortalTokenFromUrl(`https://estateos.pl/klient/${token}?chat=1`), token);
  assert.equal(extractPortalTokenFromUrl(`estateos://klient/${token}`), token);
  assert.equal(extractPortalTokenFromUrl(`https://estateos.pl/oferta/12?portal=${token}`), token);
  assert.equal(extractPortalTokenFromUrl('https://estateos.pl/oferta/12'), null);
  assert.equal(extractPortalTokenFromUrl('https://estateos.pl/crm/client/44'), null);
});

test('masks CRM email and hides placeholder accounts', () => {
  assert.equal(maskEmail('maria.nowak@gmail.com'), 'm***@gmail.com');
  assert.equal(maskEmail('crm+48500111222@portal.estateos.internal'), null);
  assert.equal(maskEmail(null), null);
});

test('link decision requires the same real email as CRM', () => {
  assert.equal(
    decidePortalAccountLink({
      clientEmail: 'klient@estateos.pl',
      clientLinkedUserId: null,
      userId: 9,
      userEmail: 'klient@estateos.pl',
    }).action,
    'set',
  );
  assert.equal(
    decidePortalAccountLink({
      clientEmail: 'klient@estateos.pl',
      clientLinkedUserId: 9,
      userId: 9,
      userEmail: 'klient@estateos.pl',
    }).action,
    'ok',
  );
  assert.equal(
    decidePortalAccountLink({
      clientEmail: 'klient@estateos.pl',
      clientLinkedUserId: 3,
      userId: 9,
      userEmail: 'klient@estateos.pl',
    }).action,
    'reassign',
  );
  assert.equal(
    decidePortalAccountLink({
      clientEmail: 'klient@estateos.pl',
      clientLinkedUserId: null,
      userId: 9,
      userEmail: 'inny@estateos.pl',
    }).action,
    'mismatch',
  );
  assert.equal(
    decidePortalAccountLink({
      clientEmail: 'crm+48@portal.estateos.internal',
      clientLinkedUserId: null,
      userId: 9,
      userEmail: 'klient@estateos.pl',
    }).action,
    'missing_email',
  );
});
