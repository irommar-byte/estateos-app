import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

const req = (headers: Record<string, string>) =>
  new NextRequest('https://estateos.pl/', { method: 'POST', headers: { host: 'estateos.pl', ...headers } });

test('fałszywe Next-Action od skanerów dostają 404 zanim dotrą do Next.js', () => {
  for (const probe of ['x', '0', '1', 'action', '']) {
    assert.equal(proxy(req({ 'next-action': probe })).status, 404, probe);
  }
});

test('prawdziwe ID Server Action i zwykłe żądania przechodzą dalej', () => {
  assert.notEqual(proxy(req({ 'next-action': 'a'.repeat(42) })).status, 404);
  assert.notEqual(proxy(req({})).status, 404);
});
