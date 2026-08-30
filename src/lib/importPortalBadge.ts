export type ImportPortalBadge = 'OTO' | 'OLX' | 'N-O';

export function importPortalBadge(source?: string | null, url?: string | null): ImportPortalBadge | null {
  const s = String(source || '').toUpperCase();
  if (s.includes('OTODOM')) return 'OTO';
  if (s.includes('OLX')) return 'OLX';
  if (s.includes('NIERUCHOMOSCI') || s === 'N-O' || s.includes('NIER_ONLINE')) return 'N-O';
  const u = String(url || '').toLowerCase();
  if (u.includes('otodom.pl')) return 'OTO';
  if (u.includes('olx.pl')) return 'OLX';
  if (u.includes('nieruchomosci-online.pl')) return 'N-O';
  return null;
}

export function importPortalBadgeColors(badge: ImportPortalBadge): { bg: string; fg: string } {
  if (badge === 'OTO') return { bg: '#FF4D4F', fg: '#FFFFFF' };
  if (badge === 'OLX') return { bg: '#002F34', fg: '#23E5DB' };
  return { bg: '#1B4F72', fg: '#FFFFFF' };
}
