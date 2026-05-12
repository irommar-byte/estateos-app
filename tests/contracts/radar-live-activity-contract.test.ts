import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRadarLiveActivitySnapshot,
  formatRadarLiveActivityLines,
  validateRadarLiveActivityPushPayload,
} from '../../src/contracts/radarLiveActivityContract';

test('buildRadarLiveActivitySnapshot normalizes and clamps values', () => {
  const snapshot = buildRadarLiveActivitySnapshot({
    enabled: true,
    transactionType: 'rent' as any,
    city: '  ',
    minMatchThreshold: 112,
    activeMatchesCount: -4,
    unreadDealroomMessagesCount: 7.3,
  });

  assert.deepEqual(snapshot.enabled, true);
  assert.deepEqual(snapshot.transactionType, 'RENT');
  assert.deepEqual(snapshot.city, 'Warszawa');
  assert.deepEqual(snapshot.minMatchThreshold, 100);
  assert.deepEqual(snapshot.activeMatchesCount, 0);
  assert.deepEqual(snapshot.unreadDealroomMessagesCount, 7);
  assert.ok(typeof snapshot.updatedAtIso === 'string' && snapshot.updatedAtIso.length > 8);
});

test('validateRadarLiveActivityPushPayload accepts canonical payload', () => {
  const payload = validateRadarLiveActivityPushPayload({
    type: 'RADAR_LIVE_ACTIVITY_UPDATE',
    radar: {
      enabled: true,
      transactionType: 'SELL',
      city: 'Krakow',
      minMatchThreshold: 75,
      activeMatchesCount: 16,
      unreadDealroomMessagesCount: 3,
      updatedAtIso: '2026-05-07T10:00:00.000Z',
    },
  });

  assert.ok(payload);
  assert.deepEqual(payload?.radar.city, 'Krakow');
  assert.deepEqual(payload?.radar.minMatchThreshold, 75);
  assert.deepEqual(payload?.radar.activeMatchesCount, 16);
  assert.deepEqual(payload?.radar.unreadDealroomMessagesCount, 3);
});

test('validateRadarLiveActivityPushPayload rejects unknown type', () => {
  const payload = validateRadarLiveActivityPushPayload({
    type: 'RADAR_UNKNOWN',
    radar: {},
  });
  assert.equal(payload, null);
});

test('formatRadarLiveActivityLines: brak nowych dopasowań → segment NOWE pomijany', () => {
  const snapshot = buildRadarLiveActivitySnapshot({
    enabled: true,
    transactionType: 'SELL',
    city: 'Warszawa',
    districts: ['Mokotów', 'Wilanów', 'Śródmieście', 'Wola'],
    propertyType: 'FLAT',
    maxPrice: 850_000,
    minArea: 50,
    minYear: 2000,
    areaRadiusKm: null,
    minMatchThreshold: 85,
    activeMatchesCount: 12,
    newMatchesCount: 0, // wszystko już widziane
    unreadDealroomMessagesCount: 0,
    requireBalcony: true,
    requireElevator: true,
  });

  const lines = formatRadarLiveActivityLines(snapshot);
  assert.equal(lines[0], 'Radar aktywny · skan rynku trwa');
  assert.equal(lines[1], 'Sprzedaż · Warszawa · próg 85%');
  assert.equal(lines[2], 'Mieszkanie · od 50 m² · do 850 tys. zł');
  assert.equal(lines[3], 'Dzielnice: Mokotów, Wilanów +2');
  assert.equal(lines[4], 'Rok budowy: od 2000 r.');
  assert.equal(lines[5], 'Wymagania: balkon, winda');
});

test('formatRadarLiveActivityLines: nowe dopasowania → prefix NOWE!', () => {
  const snapshot = buildRadarLiveActivitySnapshot({
    enabled: true,
    transactionType: 'SELL',
    city: 'Warszawa',
    propertyType: 'FLAT',
    maxPrice: 850_000,
    minArea: 50,
    minMatchThreshold: 90,
    activeMatchesCount: 12,
    newMatchesCount: 3,
    unreadDealroomMessagesCount: 0,
  });

  const lines = formatRadarLiveActivityLines(snapshot);
  assert.equal(lines[1], 'Sprzedaż · Warszawa · próg 90%');
  assert.equal(lines[2], 'Mieszkanie · od 50 m² · do 850 tys. zł · NOWE! 3');
});

test('formatRadarLiveActivityLines: minimum konfiguracji', () => {
  const snapshot = buildRadarLiveActivitySnapshot({
    enabled: true,
    transactionType: 'RENT',
    city: 'Radom',
    minMatchThreshold: 100,
    activeMatchesCount: 0,
    newMatchesCount: 0,
    unreadDealroomMessagesCount: 0,
  });

  const lines = formatRadarLiveActivityLines(snapshot);
  assert.equal(lines.length, 3);
  assert.equal(lines[1], 'Wynajem · Radom · próg 100%');
  assert.equal(lines[2], 'Dowolny typ');
});

test('formatRadarLiveActivityLines: obszar mapy + nowe dopasowania', () => {
  const snapshot = buildRadarLiveActivitySnapshot({
    enabled: true,
    transactionType: 'SELL',
    city: 'Kraków',
    districts: ['Kazimierz'],
    areaRadiusKm: 8.5,
    maxPrice: 2_500_000,
    minMatchThreshold: 90,
    activeMatchesCount: 1,
    newMatchesCount: 1,
    unreadDealroomMessagesCount: 4,
  });

  const lines = formatRadarLiveActivityLines(snapshot);
  assert.equal(lines[1], 'Sprzedaż · Kraków · próg 90%');
  assert.equal(lines[2], 'Dowolny typ · do 2,5 mln zł · NOWE! 1');
  assert.equal(lines[3], 'Obszar mapy: 8,5 km');
});
