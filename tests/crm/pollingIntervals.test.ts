import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('CRM and portal polling no longer hammers full payloads', () => {
  const portalPage = read('src/app/klient/[token]/page.tsx');
  assert.match(portalPage, /\/sync/);
  assert.match(portalPage, /15_000/);
  assert.doesNotMatch(portalPage, /2_500|2500/);

  const crmPage = read('src/app/moje-konto/crm/page.tsx');
  assert.match(crmPage, /45_000/);
  assert.doesNotMatch(crmPage, /setInterval\(loadDeals, 10000\)/);

  const dealRoom = read('src/components/crm/DealRoom.tsx');
  assert.match(dealRoom, /EventSource\.OPEN/);
  assert.doesNotMatch(dealRoom, /setInterval\(fetchDeal, 1500\)/);

  const unread = read('src/hooks/useNavUnreadBadge.ts');
  assert.match(unread, /30_000/);
  assert.doesNotMatch(unread, /8_000/);
});
