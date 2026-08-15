import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKeiSearchFacets,
  extractWarsawDistrictFromKeiAddress,
} from '../src/lib/keiAmerFacets';
import type { KeiListingRow } from '../src/lib/keiAmerClient';

test('extracts Warsaw district from KEI address without matching street prefixes', () => {
  assert.equal(extractWarsawDistrictFromKeiAddress('Warszawa, Żoliborz, ul. Mickiewicza 12'), 'Żoliborz');
  assert.equal(extractWarsawDistrictFromKeiAddress('Warszawa, Mokotów, Służewiec'), 'Mokotów');
  assert.equal(extractWarsawDistrictFromKeiAddress('Warszawa, Praga-Południe, Saska Kępa'), 'Praga-Południe');
  assert.equal(extractWarsawDistrictFromKeiAddress('Warszawa, ul. Wolska 10'), '');
});

test('builds district and price facets from KEI rows', () => {
  const rows: KeiListingRow[] = [
    {
      id: '1',
      data: '2026-08-10',
      www: 'https://www.otodom.pl/pl/oferta/a',
      adres: 'Warszawa, Mokotów, ul. Puławska 1',
      cena: '650 000 zł',
      pow: '48 m2',
      rodzaj: '1',
      typ: '1',
      zrodlo: 'otodom',
    },
    {
      id: '2',
      data: '2026-08-01',
      www: 'https://www.otodom.pl/pl/oferta/b',
      adres: 'Warszawa, Wola, ul. Kasprzaka 2',
      cena: '1 400 000 zł',
      pow: '78 m2',
      rodzaj: '1',
      typ: '1',
      zrodlo: 'otodom',
    },
  ];
  const facets = buildKeiSearchFacets(rows, { propertyKind: 'apartment', transactionKind: 'sale' });
  assert.equal(facets.sampled, 2);
  assert.equal(facets.districts.find((d) => d.id === 'Mokotów')?.count, 1);
  assert.equal(facets.districts.find((d) => d.id === 'Wola')?.count, 1);
  assert.equal(facets.priceRanges.find((p) => p.id === '500-800k')?.count, 1);
  assert.equal(facets.areaRanges.find((p) => p.id === '40-55')?.count, 1);
});
