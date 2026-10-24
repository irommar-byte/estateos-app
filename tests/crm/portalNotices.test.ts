import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortalNotices } from '../../src/lib/crm/portalNotices';

const base = {
  type: 'BUYER' as const,
  isPartner: false,
  agentFirst: 'Marian',
  documents: [],
  matches: [],
  agentReplies: [],
  checkback: null,
  presentation: null,
  meeting: null,
  buyerOffers: [],
  decisions: [],
  agreement: null,
  chat: { unread: 0, latestAgentId: null, latestAt: null, preview: null },
};

test('dokument do poprawy i nowa pozycja od agenta trafiają do dzwonka z kotwicą', () => {
  const now = new Date().toISOString();
  const notices = buildPortalNotices({
    ...base,
    documents: [
      { key: 'kw', label: 'Numer KW', hint: null, status: 'rejected', note: 'Nieczytelne', reviewedAt: now, createdAt: now },
      { key: 'custom_x', label: 'Zaświadczenie', hint: 'Z gminy', custom: true, status: 'missing', note: null, createdAt: now },
      { key: 'plan', label: 'Rzut', hint: null, status: 'missing', note: null, createdAt: now },
    ],
  });
  assert.deepEqual(
    notices.map((n) => [n.group, n.anchor, n.tone]),
    [
      ['documents', 'portal-doc-kw', 'action'],
      ['documents', 'portal-doc-custom_x', 'action'],
    ],
  );
});

test('stabilne id: ta sama sytuacja = to samo id, nowa wiadomość = nowe id', () => {
  const a = buildPortalNotices({ ...base, chat: { unread: 1, latestAgentId: '10', latestAt: null, preview: 'Hej' } });
  const b = buildPortalNotices({ ...base, chat: { unread: 1, latestAgentId: '10', latestAt: null, preview: 'Hej' } });
  const c = buildPortalNotices({ ...base, chat: { unread: 2, latestAgentId: '11', latestAt: null, preview: 'Hej 2' } });
  assert.equal(a[0].id, b[0].id);
  assert.notEqual(a[0].id, c[0].id);
});

test('druga osoba w panelu nie dostaje próśb o dokumenty', () => {
  const notices = buildPortalNotices({
    ...base,
    isPartner: true,
    documents: [{ key: 'kw', label: 'KW', hint: null, status: 'rejected', note: null }],
  });
  assert.equal(notices.length, 0);
});

test('sprzedający: otwarta oferta kupującego bez odpowiedzi = do zrobienia', () => {
  const notices = buildPortalNotices({
    ...base,
    type: 'SELLER',
    buyerOffers: [
      { id: 1, buyerLabel: 'Kupujący A', amount: 800000, status: 'OPEN', clientResponse: null },
      { id: 2, buyerLabel: 'Kupujący B', amount: 790000, status: 'OPEN', clientResponse: 'accept' },
    ],
  });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].anchor, 'portal-buyer-offers');
});
