import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ABS_MONTH_PCT,
  MAX_ABS_YEAR_PCT,
  calendarMonthChange,
  isHouseLikeDeed,
  isResidentialFlatDeed,
  isResidentialFlatListing,
  lastCompleteYearMonth,
  pctChange,
  pulseAsOfDay,
  sanitizeChangePct,
  trailingMonthsChange,
} from '../../src/lib/market/pricePulseMath';

test('houses and plots are not flats for the pulse', () => {
  assert.equal(isHouseLikeDeed({ functionCode: 'dom jednorodzinny' }), true);
  assert.equal(isResidentialFlatDeed({ functionCode: 'dom jednorodzinny' }), false);
  assert.equal(isResidentialFlatDeed({ functionCode: 'mieszkalna', transactionKind: 'sprzedaż domu' }), false);
  assert.equal(isResidentialFlatDeed({ functionCode: '' }), false);
  assert.equal(isResidentialFlatDeed({ functionCode: 'mieszkalna' }), true);
  assert.equal(isResidentialFlatListing('HOUSE'), false);
  assert.equal(isResidentialFlatListing('PLOT'), false);
  assert.equal(isResidentialFlatListing('FLAT'), true);
});

test('month change is the last complete calendar month, not first-to-last of a year', () => {
  const byDay = new Map<string, number[]>();
  for (let d = 1; d <= 28; d += 1) {
    const day = String(d).padStart(2, '0');
    byDay.set(`2026-01-${day}`, Array.from({ length: 20 }, () => 10_000));
    byDay.set(`2026-02-${day}`, Array.from({ length: 20 }, () => 10_300));
    byDay.set(`2026-03-${day}`, Array.from({ length: 20 }, () => 18_000));
  }
  const fromMonthEnd = calendarMonthChange(byDay, '2026-02-28', 80, MAX_ABS_MONTH_PCT);
  assert.equal(fromMonthEnd.changePct, 3);
  assert.equal(fromMonthEnd.currentPpsm, 10300);
  assert.equal(fromMonthEnd.previousPpsm, 10000);

  const fromMidMarch = calendarMonthChange(byDay, '2026-03-10', 80, MAX_ABS_MONTH_PCT);
  assert.equal(fromMidMarch.changePct, 3);
  assert.equal(lastCompleteYearMonth('2026-03-10'), '2026-02');
  assert.equal(pulseAsOfDay('2026-03-10'), '2026-02-28');

  const longRange = pctChange(18_000, 10_000);
  assert.ok((longRange || 0) > 70);
  assert.equal(sanitizeChangePct(longRange, MAX_ABS_MONTH_PCT), null);
});

test('thin or wild samples do not become a month headline', () => {
  const byDay = new Map<string, number[]>();
  byDay.set('2026-02-01', [18_000, 19_000, 21_000, 40_000]);
  byDay.set('2026-01-01', [8_000, 8_200, 8_400, 8_600]);
  const month = calendarMonthChange(byDay, '2026-02-28', 80, MAX_ABS_MONTH_PCT);
  assert.equal(month.changePct, null);
  assert.equal(sanitizeChangePct(69.8, MAX_ABS_MONTH_PCT), null);
});

test('year change is twelve complete months vs the prior twelve, not a 70% span', () => {
  const byDay = new Map<string, number[]>();
  for (let month = 1; month <= 12; month += 1) {
    const ym = `2025-${String(month).padStart(2, '0')}`;
    const prev = `2024-${String(month).padStart(2, '0')}`;
    for (let d = 1; d <= 28; d += 1) {
      const day = String(d).padStart(2, '0');
      byDay.set(`${prev}-${day}`, Array.from({ length: 20 }, () => 10_000));
      byDay.set(`${ym}-${day}`, Array.from({ length: 20 }, () => 10_800));
    }
  }
  const year = trailingMonthsChange(byDay, '2025-12-31', 12, 400, MAX_ABS_YEAR_PCT);
  assert.equal(year.changePct, 8);
  assert.equal(sanitizeChangePct(69.8, MAX_ABS_YEAR_PCT), null);
});
