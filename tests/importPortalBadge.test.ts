import test from 'node:test';
import assert from 'node:assert/strict';
import { importPortalBadge } from '../src/lib/crm/importPortalBadge';

test('maps portal source and URL to OTO / OLX / N-O badges', () => {
  assert.equal(importPortalBadge('OTODOM', null), 'OTO');
  assert.equal(importPortalBadge('OLX', null), 'OLX');
  assert.equal(importPortalBadge('NIERUCHOMOSCI_ONLINE', null), 'N-O');
  assert.equal(importPortalBadge(null, 'https://www.otodom.pl/pl/oferta/x-ID123'), 'OTO');
  assert.equal(importPortalBadge(null, 'https://www.olx.pl/d/oferta/x'), 'OLX');
  assert.equal(
    importPortalBadge(null, 'https://warszawa.nieruchomosci-online.pl/mieszkanie/26914052.html'),
    'N-O',
  );
  assert.equal(
    importPortalBadge(null, null, 'Opis <!-- estateos-otodom:88 -->'),
    'OTO',
  );
  assert.equal(importPortalBadge(null, 'https://estateos.pl/oferta/1'), null);
});
