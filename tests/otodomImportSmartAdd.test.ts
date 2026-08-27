import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveImportSmartAdd } from '../src/lib/otodomImportCreate';
import type { OtodomImportDraft } from '../src/lib/otodomImport';

const baseDraft = {
  source: 'OTODOM',
  externalId: 123,
  title: 'Mieszkanie Mokotów',
  descriptionText: 'Przestronne mieszkanie z balkonem, garażem i windą. W pełni umeblowane.',
  descriptionHtml: '',
  features: [],
  transactionType: 'SALE',
  propertyType: 'FLAT',
  price: 900000,
  area: 62,
  city: 'Warszawa',
} as OtodomImportDraft;

test('import smart add auto-applies amenities from description', () => {
  const result = resolveImportSmartAdd({
    draft: baseDraft,
    enabled: true,
    autoApply: true,
  });
  assert.equal(result.amenities.hasBalcony, true);
  assert.equal(result.amenities.hasParking, true);
  assert.equal(result.amenities.hasElevator, true);
  assert.equal(result.amenities.isFurnished, true);
  assert.equal(result.patches.hasBalcony?.status, 'applied');
  assert.equal(result.patches.hasParking?.source, 'import');
});

test('import smart add applies duplex from description', () => {
  const result = resolveImportSmartAdd({
    draft: {
      ...baseDraft,
      descriptionText: 'Unikalne mieszkanie dwupoziomowe z antresolą w centrum.',
    },
    enabled: true,
    autoApply: true,
  });
  assert.equal(result.amenities.isDuplex, true);
  assert.equal(result.patches.isDuplex?.status, 'applied');
});

test('import smart add stays off when disabled', () => {
  const result = resolveImportSmartAdd({
    draft: baseDraft,
    enabled: false,
    autoApply: true,
  });
  assert.equal(result.amenities.hasBalcony, false);
  assert.equal(Object.keys(result.patches).length, 0);
});
