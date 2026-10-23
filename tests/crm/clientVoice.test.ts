import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientVoice, femaleVocative, guessGenderFromFirstName, maleVocative } from '@/lib/crm/clientVoice';

test('wołacz imion żeńskich', () => {
  assert.equal(femaleVocative('Anna'), 'Anno');
  assert.equal(femaleVocative('katarzyna'), 'Katarzyno');
  assert.equal(femaleVocative('Kasia'), 'Kasiu');
  assert.equal(femaleVocative('Ola'), 'Olu');
  assert.equal(femaleVocative('Julia'), 'Julio');
  assert.equal(femaleVocative('Noemi'), 'Noemi');
});

test('wołacz imion męskich', () => {
  const cases: Record<string, string> = {
    Tomasz: 'Tomaszu', Marek: 'Marku', Piotr: 'Piotrze', Paweł: 'Pawle', Michał: 'Michale', Adam: 'Adamie',
    Jan: 'Janie', Krzysztof: 'Krzysztofie', Andrzej: 'Andrzeju', Wojciech: 'Wojciechu', Grzegorz: 'Grzegorzu',
    Robert: 'Robercie', Dawid: 'Dawidzie', Wiktor: 'Wiktorze', Kacper: 'Kacprze', Jerzy: 'Jerzy', Kuba: 'Kubo',
    Henryk: 'Henryku', Kamil: 'Kamilu', Stanisław: 'Stanisławie', Bartek: 'Bartku', August: 'Auguście',
  };
  for (const [name, voc] of Object.entries(cases)) assert.equal(maleVocative(name), voc, name);
});

test('płeć z imienia i z karty klienta', () => {
  assert.equal(guessGenderFromFirstName('Anna'), 'f');
  assert.equal(guessGenderFromFirstName('Kuba'), 'm');
  assert.equal(guessGenderFromFirstName('Tomasz'), 'm');
  assert.equal(guessGenderFromFirstName(''), null);
  const v = buildClientVoice({ firstName: 'Nikola', salutation: 'PAN', agentName: 'Marta Nowak', now: new Date('2026-10-23T08:00:00Z') });
  assert.equal(v.vocative, 'Panie Nikolo');
  assert.equal(v.greeting, 'Dzień dobry, Panie Nikolo,');
  assert.equal(v.a('wybrałem', 'wybrałam'), 'wybrałam');
  assert.equal(v.c('napisała Pani', 'napisał Pan', 'napisano'), 'napisał Pan');
});

test('bez imienia — neutralnie, wieczorem dobry wieczór', () => {
  const v = buildClientVoice({ firstName: '', agentName: 'Marian', now: new Date('2026-10-23T18:30:00Z') });
  assert.equal(v.vocative, '');
  assert.equal(v.greeting, 'Dobry wieczór,');
  assert.equal(v.c('a', 'b', 'n'), 'n');
});

test('wersje różnią się między klientami i są stałe dla tego samego klucza', () => {
  const variants = ['a', 'b', 'c', 'd', 'e'];
  const picks = new Set<string>();
  for (let id = 1; id <= 40; id += 1) picks.add(buildClientVoice({ clientId: id, firstName: 'Anna' }).pick('intro', variants, 1));
  assert.ok(picks.size >= 4);
  const v = buildClientVoice({ clientId: 7, firstName: 'Anna' });
  assert.equal(v.pick('intro', variants, 3), v.pick('intro', variants, 3));
});
