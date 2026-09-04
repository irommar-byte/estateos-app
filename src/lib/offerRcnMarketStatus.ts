export type RcnMarketStatusKind = 'bargain' | 'market' | 'luxury';

export type RcnMarketStatusColors = {
  color: string;
  bg: string;
};

/** Same ±5% bands as the legacy city-average badge. */
export function marketStatusFromVsMedianPct(vsMedianPct: number): RcnMarketStatusKind {
  if (!Number.isFinite(vsMedianPct)) return 'market';
  if (vsMedianPct <= -5) return 'bargain';
  if (vsMedianPct >= 5) return 'luxury';
  return 'market';
}

/** Fallback when guest / no RCN sample — hardcoded city medians (legacy). */
export function cityFallbackVsMedianPct(params: {
  pricePerSqm: number;
  city?: string | null;
}): number | null {
  const ppsm = params.pricePerSqm;
  if (!Number.isFinite(ppsm) || ppsm <= 0) return null;
  const city = String(params.city || '').trim();
  const avg = city === 'Warszawa' ? 16500 : city === 'Łódź' ? 8500 : 12000;
  if (avg <= 0) return null;
  return Math.round(((ppsm - avg) / avg) * 100);
}

export function marketStatusColors(
  kind: RcnMarketStatusKind,
  isDark: boolean,
): RcnMarketStatusColors {
  if (kind === 'bargain') {
    return {
      color: '#10b981',
      bg: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)',
    };
  }
  if (kind === 'luxury') {
    return {
      color: '#ef4444',
      bg: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.13)',
    };
  }
  return {
    color: '#f59e0b',
    bg: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.13)',
  };
}

export function marketStatusIcon(kind: RcnMarketStatusKind): string {
  if (kind === 'bargain') return 'trending-down-outline';
  if (kind === 'luxury') return 'trending-up-outline';
  return 'swap-vertical-outline';
}
