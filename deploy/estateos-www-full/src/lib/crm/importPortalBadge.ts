export type ImportPortalBadge = 'OTO' | 'OLX' | 'N-O';

const MARKER_RE = /<!--\s*estateos-(otodom|olx|nieruchomosci-online):\d+\s*-->/i;

export function importPortalBadge(source?: string | null, url?: string | null, description?: string | null): ImportPortalBadge | null {
  const s = String(source || '').toUpperCase();
  if (s.includes('OTODOM')) return 'OTO';
  if (s.includes('OLX')) return 'OLX';
  if (s.includes('NIERUCHOMOSCI') || s === 'N-O' || s.includes('NIER_ONLINE')) return 'N-O';

  const u = String(url || '').toLowerCase();
  if (u.includes('otodom.pl')) return 'OTO';
  if (u.includes('olx.pl')) return 'OLX';
  if (u.includes('nieruchomosci-online.pl')) return 'N-O';

  const marker = String(description || '').match(MARKER_RE)?.[1];
  if (marker === 'otodom') return 'OTO';
  if (marker === 'olx') return 'OLX';
  if (marker === 'nieruchomosci-online') return 'N-O';
  return null;
}

export function importPortalLabel(badge: ImportPortalBadge | null): string {
  if (badge === 'OTO') return 'Otodom';
  if (badge === 'OLX') return 'OLX';
  if (badge === 'N-O') return 'Nieruchomości-Online';
  return '';
}
