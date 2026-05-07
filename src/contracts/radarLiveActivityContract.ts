export type RadarLiveActivityTransactionType = 'SELL' | 'RENT';

export interface RadarLiveActivitySnapshot {
  enabled: boolean;
  transactionType: RadarLiveActivityTransactionType;
  city: string;
  minMatchThreshold: number;
  activeMatchesCount: number;
  updatedAtIso: string;
}

const clampThreshold = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(50, Math.min(100, Math.round(parsed)));
};

const normalizeTransactionType = (value: unknown): RadarLiveActivityTransactionType =>
  String(value).toUpperCase() === 'RENT' ? 'RENT' : 'SELL';

const normalizeCity = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length > 0 ? raw : 'Warszawa';
};

const normalizeMatches = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
};

export const buildRadarLiveActivitySnapshot = (input: Partial<RadarLiveActivitySnapshot>): RadarLiveActivitySnapshot => ({
  enabled: input.enabled === true,
  transactionType: normalizeTransactionType(input.transactionType),
  city: normalizeCity(input.city),
  minMatchThreshold: clampThreshold(input.minMatchThreshold),
  activeMatchesCount: normalizeMatches(input.activeMatchesCount),
  updatedAtIso: typeof input.updatedAtIso === 'string' && input.updatedAtIso.trim().length > 0
    ? input.updatedAtIso
    : new Date().toISOString(),
});

export interface RadarLiveActivityPushPayload {
  type: 'RADAR_LIVE_ACTIVITY_UPDATE';
  radar: RadarLiveActivitySnapshot;
}

export const validateRadarLiveActivityPushPayload = (payload: unknown): RadarLiveActivityPushPayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.type !== 'RADAR_LIVE_ACTIVITY_UPDATE') return null;
  if (!p.radar || typeof p.radar !== 'object') return null;

  return {
    type: 'RADAR_LIVE_ACTIVITY_UPDATE',
    radar: buildRadarLiveActivitySnapshot(p.radar as Partial<RadarLiveActivitySnapshot>),
  };
};
