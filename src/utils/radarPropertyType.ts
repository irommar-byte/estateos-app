/** Backend używa `PREMISES`, UI kalibracji / wyszukiwania — `COMMERCIAL`. */
export function radarPropertyTypeMatchesFilter(rawType: string, filterType: string): boolean {
  const filter = String(filterType || 'ALL').toUpperCase();
  if (filter === 'ALL') return true;
  const raw = String(rawType || '').toUpperCase();
  if (filter === 'COMMERCIAL' || filter === 'PREMISES') {
    return raw === 'PREMISES' || raw === 'COMMERCIAL';
  }
  return raw === filter;
}

export function radarPropertyTypeLabel(code: string): string {
  switch (String(code || '').toUpperCase()) {
    case 'FLAT':
      return 'Mieszkanie';
    case 'HOUSE':
      return 'Dom';
    case 'PLOT':
      return 'Działka';
    case 'COMMERCIAL':
    case 'PREMISES':
      return 'Lokal użytkowy';
    default:
      return 'Dowolny typ';
  }
}
