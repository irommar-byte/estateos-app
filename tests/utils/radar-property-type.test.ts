import { radarPropertyTypeLabel, radarPropertyTypeMatchesFilter } from '../src/utils/radarPropertyType';

describe('radarPropertyType', () => {
  it('matches COMMERCIAL filter to PREMISES offers', () => {
    expect(radarPropertyTypeMatchesFilter('PREMISES', 'COMMERCIAL')).toBe(true);
    expect(radarPropertyTypeMatchesFilter('COMMERCIAL', 'COMMERCIAL')).toBe(true);
    expect(radarPropertyTypeMatchesFilter('FLAT', 'COMMERCIAL')).toBe(false);
  });

  it('labels COMMERCIAL as lokal użytkowy', () => {
    expect(radarPropertyTypeLabel('COMMERCIAL')).toBe('Lokal użytkowy');
    expect(radarPropertyTypeLabel('PREMISES')).toBe('Lokal użytkowy');
  });
});
