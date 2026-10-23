import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientVoice } from '@/lib/crm/clientVoice';
import { ensureGreeting, offerEmailCopy, offerPushCopy, reminderCopy } from '@/lib/crm/clientCopy';

const MACHINE = /Intelligence|uczy się|uczą się|algorytm|system|Twoj|Twój|Ciebie|zaznacz|Zerknij|  /;

test('teksty ofert i przypomnień brzmią jak od osoby — w każdej formie i wersji', () => {
  const voices = [
    buildClientVoice({ clientId: 1, firstName: 'Anna', agentName: 'Marian' }),
    buildClientVoice({ clientId: 2, firstName: 'Tomasz', salutation: 'PAN', agentName: 'Ewa' }),
    buildClientVoice({ clientId: 3, firstName: '', agentName: 'Marian' }),
  ];
  for (const v of voices) {
    for (let salt = 0; salt < 12; salt += 1) {
      for (const count of [1, 2, 5]) {
        const o = offerEmailCopy(v, { count, firstTitle: 'Mieszkanie na Woli', salt });
        for (const text of [o.subject, o.intro, o.headline]) assert.doesNotMatch(text, MACHINE, text);
        const r = reminderCopy(v, { waiting: count, firstTitle: 'Mieszkanie na Woli', agentName: 'Marian Nowak', salt });
        for (const text of [r.subject, r.intro, r.headline, r.pushBody]) assert.doesNotMatch(text, MACHINE, text);
        const p = offerPushCopy(v, { count, firstTitle: 'Mieszkanie na Woli', agentName: 'Marian Nowak' });
        assert.doesNotMatch(p.body, MACHINE, p.body);
      }
    }
  }
});

test('forma agentki i klientki', () => {
  const v = buildClientVoice({ clientId: 4, firstName: 'Kasia', agentName: 'Ewa Nowak' });
  const all = Array.from({ length: 12 }, (_, salt) => offerEmailCopy(v, { count: 2, salt }).intro).join(' ');
  assert.doesNotMatch(all, /Wybrałem|przeglądałem|Jestem ciekaw /);
  assert.equal(ensureGreeting('Przesyłam ofertę.', v).split('\n\n')[0].replace(/^Dobry wieczór/, 'Dzień dobry'), 'Dzień dobry, Pani Kasiu,');
  assert.equal(ensureGreeting('Dzień dobry Pani Kasiu, przesyłam.', v), 'Dzień dobry Pani Kasiu, przesyłam.');
});

test('wersje się różnią — kolejne maile nie są identyczne', () => {
  const v = buildClientVoice({ clientId: 11, firstName: 'Anna', agentName: 'Marian' });
  const intros = new Set(Array.from({ length: 10 }, (_, salt) => reminderCopy(v, { waiting: 1, salt }).intro));
  assert.ok(intros.size >= 2);
});
