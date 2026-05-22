import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOfferConditionLabel,
  formatOfferHeatingLabel,
  formatOfferPropertyTypeLabel,
  normalizeOfferCondition,
  normalizeOfferConditionForEdit,
} from '../../src/utils/offerFieldLabels';

const t = (key: string) => {
  const dict: Record<string, string> = {
    'offer.shared.noData': '—',
    'offer.shared.emDash': '—',
    'offer.shared.notProvided': 'Nie podano',
    'offer.shared.conditionSegments.DEVELOPER': 'Deweloperski',
    'offer.shared.conditions.TO_RENOVATION': 'Do remontu',
    'offer.shared.conditions.NEW': 'Nowe',
    'offer.shared.propertyTypes.premises': 'Lokal',
    'offer.shared.heating.gas': 'Gazowe',
    'offer.shared.heating.other': 'Inne',
  };
  return dict[key] ?? key;
};

describe('offerFieldLabels', () => {
  it('maps DEVELOPER_STATE to developer label', () => {
    assert.equal(normalizeOfferCondition('DEVELOPER_STATE'), 'DEVELOPER');
    assert.equal(formatOfferConditionLabel('DEVELOPER_STATE', t), 'Deweloperski');
  });

  it('maps RENOVATION to TO_RENOVATION', () => {
    assert.equal(normalizeOfferCondition('RENOVATION'), 'TO_RENOVATION');
    assert.equal(formatOfferConditionLabel('RENOVATION', t), 'Do remontu');
  });

  it('does not leak unknown enum', () => {
    assert.equal(formatOfferConditionLabel('MYSTERY_ENUM', t), '—');
  });

  it('normalizeOfferConditionForEdit handles legacy', () => {
    assert.equal(normalizeOfferConditionForEdit('DEVELOPER_STATE'), 'DEVELOPER');
    assert.equal(normalizeOfferConditionForEdit('VERY_GOOD'), 'READY');
  });

  it('formatOfferPropertyTypeLabel maps COMMERCIAL', () => {
    assert.equal(formatOfferPropertyTypeLabel('COMMERCIAL', t), 'Lokal');
  });

  it('formatOfferHeatingLabel maps GAS', () => {
    assert.equal(formatOfferHeatingLabel('GAS', t), 'Gazowe');
  });
});
