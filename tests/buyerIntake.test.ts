import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialBuyerMission,
  decodeBuyerMissionCookie,
  encodeBuyerMissionCookie,
  mergeBuyerMission,
} from '../src/lib/buyerIntake.server';
import {
  BUYER_PROPERTY_OPTIONS,
  formatBuyerRooms,
  isBuyerStep2Complete,
  listBuyerMustHaves,
  normalizeBuyerAreaRange,
  normalizeBuyerRooms,
  normalizeBuyerTransactionType,
  formatBuyerArea,
  formatBuyerBudget,
  getBuyerAreaHeading,
  getBuyerAreaMinOptions,
  getBuyerBudgetOptions,
  isBuyerBudgetValueForTransaction,
  sanitizeBuyerAreaForPropertyType,
  resolveBuyerUiStep,
  searchBuyerCitySuggestions,
  searchBuyerDistrictSuggestions,
  validateBuyerStep2Location,
  validateBuyerStep4Contact,
  normalizeBuyerContactEmail,
  buyerMissionToBuyerPrefCreate,
  buyerIntakeFreeServiceLine,
  buyerIntakeProgressPercent,
  buyerIntakeStepCaption,
  isBuyerStep4Complete,
} from '../src/lib/buyerIntakeShared';

test('buyer mission cookie roundtrip step 1', () => {
  const encoded = encodeBuyerMissionCookie({
    agentUserId: 42,
    propertyType: 'apartment',
    step: 2,
    city: null,
    districts: [],
    budgetMax: null,
    minArea: null,
    rooms: [],
  });
  const decoded = decodeBuyerMissionCookie(encoded);
  assert.equal(decoded?.agentUserId, 42);
  assert.equal(decoded?.propertyType, 'apartment');
  assert.equal(decoded?.step, 2);
  assert.equal(decoded?.v, 2);
});

test('buyer mission cookie roundtrip step 2 fields', () => {
  const encoded = encodeBuyerMissionCookie({
    agentUserId: 42,
    propertyType: 'house',
    step: 3,
    city: 'Warszawa',
    districts: ['Żoliborz', 'Mokotów'],
    budgetMax: 1_200_000,
    minArea: 70,
    maxArea: 90,
    rooms: [2, 3],
  });
  const decoded = decodeBuyerMissionCookie(encoded);
  assert.equal(decoded?.city, 'Warszawa');
  assert.deepEqual(decoded?.districts, ['Żoliborz', 'Mokotów']);
  assert.equal(decoded?.budgetMax, 1_200_000);
  assert.equal(decoded?.minArea, 70);
  assert.equal(decoded?.maxArea, 90);
  assert.deepEqual(decoded?.rooms, [2, 3]);
  assert.equal(decoded?.step, 3);
});

test('buyer mission cookie migrates legacy single room number', () => {
  const encoded = encodeBuyerMissionCookie({
    agentUserId: 42,
    propertyType: 'apartment',
    step: 3,
    city: 'Kraków',
    districts: [],
    budgetMax: 800_000,
    minArea: null,
    rooms: [4],
  });
  const decoded = decodeBuyerMissionCookie(encoded);
  assert.deepEqual(decoded?.rooms, [4]);
});

test('mergeBuyerMission preserves agent and step fields', () => {
  const merged = mergeBuyerMission(createInitialBuyerMission(7), 7, {
    propertyType: 'plot',
    step: 2,
  });
  assert.equal(merged.propertyType, 'plot');
  assert.equal(merged.step, 2);
  assert.equal(merged.city, null);
  assert.equal(merged.v, 2);
});

test('buyer mission cookie rejects tampered token', () => {
  const encoded = encodeBuyerMissionCookie(createInitialBuyerMission(7));
  const tampered = `${encoded}x`;
  assert.equal(decodeBuyerMissionCookie(tampered), null);
});

test('buyer property options cover four types', () => {
  assert.equal(BUYER_PROPERTY_OPTIONS.length, 4);
});

test('resolveBuyerUiStep and step2 completion', () => {
  assert.equal(resolveBuyerUiStep(null), 1);
  assert.equal(
    resolveBuyerUiStep({
      typ: 'buyer_mission',
      v: 2,
      agentUserId: 1,
      propertyType: 'apartment',
      step: 2,
      city: null,
      districts: [],
      budgetMax: null,
      minArea: null,
      rooms: [],
    }),
    2,
  );
  assert.equal(
    isBuyerStep2Complete({
      typ: 'buyer_mission',
      v: 2,
      agentUserId: 1,
      propertyType: 'apartment',
      step: 3,
      city: 'Kraków',
      districts: [],
      budgetMax: 800_000,
      minArea: null,
      maxArea: null,
      rooms: [],
      requireBalcony: false,
      requireGarden: false,
      requireElevator: false,
      requireParking: false,
      requireFurnished: false,
      requireTwoLevel: false,
      marketType: null,
      transactionType: null,
      purchaseTimeline: null,
    }),
    true,
  );
  assert.equal(
    resolveBuyerUiStep({
      typ: 'buyer_mission',
      v: 2,
      agentUserId: 1,
      propertyType: 'apartment',
      step: 3,
      city: 'Kraków',
      districts: [],
      budgetMax: 800_000,
      minArea: null,
      maxArea: null,
      rooms: [],
      requireBalcony: false,
      requireGarden: false,
      requireElevator: false,
      requireParking: false,
      requireFurnished: false,
      requireTwoLevel: false,
      marketType: null,
      transactionType: null,
      purchaseTimeline: null,
    }),
    3,
  );
});

test('formatBuyerRooms supports multi select and ranges', () => {
  assert.equal(formatBuyerRooms([2, 3]), '2–3 pok.');
  assert.equal(formatBuyerRooms([2, 4]), '2 lub 4 pok.');
  assert.equal(formatBuyerRooms([3]), '3 pok.');
  assert.equal(normalizeBuyerRooms(3).join(','), '3');
});

test('validateBuyerStep2Location rejects nonsense city', () => {
  const bad = validateBuyerStep2Location({ city: 'asdfgh xyz123' });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.match(bad.error, /rozpoznajemy/i);
  }
});

test('validateBuyerStep2Location accepts known city and district', () => {
  const ok = validateBuyerStep2Location({
    city: 'Warszawa',
    districts: ['Żoliborz'],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.city, 'Warszawa');
    assert.deepEqual(ok.districts, ['Żoliborz']);
  }
});

test('validateBuyerStep2Location rejects nonsense district in strict city', () => {
  const bad = validateBuyerStep2Location({
    city: 'Warszawa',
    districts: ['blabla nonsense'],
  });
  assert.equal(bad.ok, false);
});

test('searchBuyerCitySuggestions starts after 3 chars', () => {
  assert.deepEqual(searchBuyerCitySuggestions('wa'), []);
  assert.ok(searchBuyerCitySuggestions('war').includes('Warszawa'));
  assert.ok(searchBuyerCitySuggestions('krak').includes('Kraków'));
  assert.ok(searchBuyerCitySuggestions('tar').includes('Tarnów'));
  assert.ok(searchBuyerCitySuggestions('tarn').includes('Tarnów'));
  assert.ok(searchBuyerCitySuggestions('tarno').includes('Tarnów'));
});

test('searchBuyerDistrictSuggestions matches partial district names', () => {
  assert.deepEqual(searchBuyerDistrictSuggestions('Warszawa', 'żo'), []);
  assert.ok(searchBuyerDistrictSuggestions('Warszawa', 'żol').includes('Żoliborz'));
  assert.ok(searchBuyerDistrictSuggestions('Warszawa', 'mok').includes('Mokotów'));
});

test('validateBuyerStep2Location accepts plausible custom town', () => {
  const ok = validateBuyerStep2Location({ city: 'Piaseczno' });
  assert.equal(ok.ok, true);
});

test('formatBuyerArea supports min-max range', () => {
  assert.equal(formatBuyerArea(40, 50), '40–50 m²');
  assert.equal(formatBuyerArea(50, null), 'od 50 m²');
  assert.equal(formatBuyerArea(null, 70), 'do 70 m²');
});

test('listBuyerMustHaves returns all selected labels', () => {
  assert.deepEqual(
    listBuyerMustHaves({
      requireBalcony: true,
      requireGarden: false,
      requireElevator: true,
      requireParking: false,
      requireFurnished: true,
      requireTwoLevel: false,
    }),
    ['Balkon / taras', 'Winda', 'Umeblowane'],
  );
});

test('normalizeBuyerTransactionType accepts SELL and RENT', () => {
  assert.equal(normalizeBuyerTransactionType('SELL'), 'SELL');
  assert.equal(normalizeBuyerTransactionType('rent'), 'RENT');
  assert.equal(normalizeBuyerTransactionType('invalid'), null);
});

test('formatBuyerBudget supports rent monthly scale', () => {
  assert.equal(formatBuyerBudget(3_500, 'RENT'), 'do 3,5 tys. zł/mies.');
  assert.equal(formatBuyerBudget(800_000, 'SELL'), 'do 800 tys. zł');
});

test('getBuyerBudgetOptions switches by transaction type and property type', () => {
  assert.equal(getBuyerBudgetOptions('RENT').length, 5);
  assert.equal(getBuyerBudgetOptions('SELL')[0].value, 500_000);
  assert.equal(getBuyerBudgetOptions('SELL', 'house')[0].value, 800_000);
  assert.equal(getBuyerBudgetOptions('SELL', 'plot')[0].value, 150_000);
  assert.equal(isBuyerBudgetValueForTransaction(500_000, 'RENT'), false);
  assert.equal(isBuyerBudgetValueForTransaction(3_500, 'RENT'), true);
  assert.equal(isBuyerBudgetValueForTransaction(800_000, 'SELL', 'house'), true);
});

test('getBuyerAreaOptions match property type scale', () => {
  assert.deepEqual(getBuyerAreaMinOptions('apartment').slice(0, 2), [20, 30]);
  assert.deepEqual(getBuyerAreaMinOptions('house').slice(0, 2), [70, 90]);
  assert.deepEqual(getBuyerAreaMinOptions('plot').slice(0, 2), [300, 500]);
  assert.equal(getBuyerAreaHeading('plot'), 'Powierzchnia działki');
  const sanitized = sanitizeBuyerAreaForPropertyType('house', 20, 50);
  assert.equal(sanitized.minArea, null);
  assert.equal(sanitized.maxArea, null);
});

test('normalizeBuyerAreaRange rejects max below min', () => {
  const bad = normalizeBuyerAreaRange({ minArea: 50, maxArea: 40 });
  assert.match(String(bad.error || ''), /mniejszy/i);
});

test('resolveBuyerUiStep advances to step 4 after preferences', () => {
  const prefsComplete = {
    typ: 'buyer_mission' as const,
    v: 2 as const,
    agentUserId: 1,
    propertyType: 'apartment' as const,
    step: 4,
    city: 'Kraków',
    districts: [],
    budgetMax: 800_000,
    minArea: null,
    maxArea: null,
    rooms: [],
    requireBalcony: false,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    requireTwoLevel: false,
    marketType: null,
    transactionType: 'SELL' as const,
    purchaseTimeline: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    clientId: null,
    consentContact: false,
  };
  assert.equal(resolveBuyerUiStep(prefsComplete), 4);
  assert.equal(isBuyerStep4Complete(prefsComplete), false);
});

test('validateBuyerStep4Contact requires name phone and consent', () => {
  const bad = validateBuyerStep4Contact({
    firstName: 'A',
    lastName: 'Kowalski',
    phone: '+48500600700',
    consentContact: true,
  });
  assert.equal(bad.ok, false);

  const badPhone = validateBuyerStep4Contact({
    firstName: 'Jan',
    lastName: 'Kowalski',
    phone: '123',
    consentContact: true,
  });
  assert.equal(badPhone.ok, false);

  const ok = validateBuyerStep4Contact({
    firstName: 'Jan',
    lastName: 'Kowalski',
    phone: '+48500600700',
    email: 'Jan@Example.com',
    consentContact: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.firstName, 'Jan');
    assert.equal(ok.phone, '+48500600700');
    assert.equal(ok.email, 'jan@example.com');
  }
});

test('normalizeBuyerContactEmail lowercases and validates', () => {
  assert.equal(normalizeBuyerContactEmail('  Jan@Mail.COM '), 'jan@mail.com');
  assert.equal(normalizeBuyerContactEmail('not-an-email'), null);
});

test('buyerMissionToBuyerPrefCreate maps intake to CRM fields', () => {
  const pref = buyerMissionToBuyerPrefCreate({
    typ: 'buyer_mission',
    v: 2,
    agentUserId: 55,
    propertyType: 'house',
    step: 5,
    city: 'Warszawa',
    districts: ['Mokotów'],
    budgetMax: 1_500_000,
    minArea: 120,
    maxArea: 200,
    rooms: [4, 5],
    requireBalcony: true,
    requireGarden: true,
    requireElevator: false,
    requireParking: true,
    requireFurnished: false,
    requireTwoLevel: false,
    marketType: null,
    transactionType: 'SELL',
    purchaseTimeline: '3m',
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: null,
    phone: '500600700',
    clientId: 99,
    consentContact: true,
  });
  assert.equal(pref.propertyType, 'HOUSE');
  assert.equal(pref.maxPrice, 1_500_000);
  assert.equal(pref.minArea, 120);
  assert.equal(pref.requireGarden, true);
  assert.deepEqual(pref.districts, ['Mokotów']);
});

test('buyer intake progress helpers', () => {
  assert.equal(buyerIntakeProgressPercent(2, false), `${((2 / 6) * 100).toFixed(3)}%`);
  assert.equal(buyerIntakeProgressPercent(4, true), '100%');
  assert.match(buyerIntakeStepCaption(4, false), /ostatni przed panelem/);
  assert.equal(buyerIntakeStepCaption(2, true), 'Gotowe — otwórz panel');
  assert.match(buyerIntakeFreeServiceLine('RENT'), /wynajmującego/);
  assert.match(buyerIntakeFreeServiceLine('SELL'), /kupujących/);
});

test('formatRadarSummary shows max area only', async () => {
  const { formatRadarSummary } = await import('../src/lib/radarCalibrationWeb');
  const summary = formatRadarSummary({
    calibrationMode: 'CITY',
    transactionType: 'SELL',
    propertyType: 'FLAT',
    city: 'Warszawa',
    selectedDistricts: ['Żoliborz'],
    maxPrice: 1_200_000,
    minArea: 0,
    maxArea: 50,
    minYear: 1900,
    requireBalcony: true,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    requireTwoLevel: false,
    pushNotifications: false,
    matchThreshold: 70,
    lat: null,
    lng: null,
    radiusKm: null,
  });
  assert.equal(summary.areaLabel, 'do 50 m²');
});
