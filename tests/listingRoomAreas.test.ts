import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractListingRoomAreas,
  formatListingAreaSqm,
} from '../src/lib/listingRoomAreas';
import { buildListingDescriptionDraftFromEdit } from '../src/lib/buildListingDescriptionDraft';

test('formats Polish square meters with a comma', () => {
  assert.equal(formatListingAreaSqm(18.5), '18,5');
  assert.equal(formatListingAreaSqm('8'), '8');
  assert.equal(formatListingAreaSqm('5,5'), '5,5');
});

test('reads room areas from propertyRoomScans', () => {
  const rooms = extractListingRoomAreas({
    propertyRoomScans: [
      { name: 'Salon z aneksem kuchennym', areaM2: '18.5' },
      { name: 'Sypialnia', areaM2: '8' },
      { name: 'Pusty', areaM2: '' },
    ],
  });
  assert.deepEqual(rooms, [
    { name: 'Salon z aneksem kuchennym', areaSqm: 18.5 },
    { name: 'Sypialnia', areaSqm: 8 },
  ]);
});

test('reads room areas from floorPlanScanMeta JSON', () => {
  const rooms = extractListingRoomAreas({
    floorPlanScanMeta: JSON.stringify({
      roomScans: [{ name: 'Łazienka', areaM2: '5' }],
    }),
  });
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].name, 'Łazienka');
  assert.equal(rooms[0].areaSqm, 5);
});

test('edit draft forwards scan rooms for AI', () => {
  const draft = buildListingDescriptionDraftFromEdit({
    locale: 'pl',
    selectedAmenities: [],
    data: {
      title: 'Test',
      floorPlanScanMeta: JSON.stringify({
        roomScans: [{ name: 'Przedpokój', areaM2: '5.5' }],
      }),
    },
  });
  assert.ok(draft.floorPlanScanMeta);
});
