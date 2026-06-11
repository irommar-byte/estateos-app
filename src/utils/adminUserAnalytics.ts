const WARSAW_TZ = 'Europe/Warsaw';

export type UserPresence = {
  state: 'ONLINE' | 'RECENT' | 'OFFLINE' | 'UNKNOWN';
  label: string;
  color: string;
};

export function isUserVerified(u: Record<string, unknown> | null | undefined): boolean {
  if (!u) return false;
  return Boolean(u.isVerified || u.phoneVerifiedAt || u.emailVerifiedAt);
}

export function isRadarEnabled(u: Record<string, unknown> | null | undefined): boolean {
  const rp = (u?.radarPreference || u?.RadarPreference) as Record<string, unknown> | undefined;
  return Boolean(rp?.pushNotifications === true || rp?.push_notifications === true);
}

export function getUserPresence(u: Record<string, unknown> | null | undefined): UserPresence {
  const explicitOnline =
    u?.isOnline === true ||
    u?.online === true ||
    String(u?.presence || '').toLowerCase() === 'online' ||
    String(u?.status || '').toLowerCase() === 'online';
  if (explicitOnline) return { state: 'ONLINE', label: 'Online', color: '#34C759' };

  const lastRaw = u?.lastLoginAt || u?.lastSeenAt || u?.lastActiveAt || u?.lastActivityAt || u?.updatedAt;
  const ts = lastRaw ? new Date(String(lastRaw)).getTime() : NaN;
  if (Number.isFinite(ts)) {
    const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (diffMin <= 5) return { state: 'ONLINE', label: 'Online', color: '#34C759' };
    if (diffMin <= 60) return { state: 'RECENT', label: `${diffMin} min temu`, color: '#FF9F0A' };
    const diffH = Math.floor(diffMin / 60);
    if (diffH <= 24) return { state: 'OFFLINE', label: `${diffH} h temu`, color: '#8E8E93' };
    const diffD = Math.floor(diffH / 24);
    return { state: 'OFFLINE', label: `${diffD} d temu`, color: '#8E8E93' };
  }

  return { state: 'UNKNOWN', label: 'Brak aktywności', color: '#8E8E93' };
}

export function formatUserDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: WARSAW_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatUserDateTime(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: WARSAW_TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function roleMeta(role: unknown): { label: string; color: string; bg: string } {
  const r = String(role || 'USER').toUpperCase();
  if (r === 'ADMIN') return { label: 'Admin', color: '#FF2D55', bg: 'rgba(255,45,85,0.14)' };
  if (r === 'AGENT') return { label: 'Agent', color: '#FF9F0A', bg: 'rgba(255,159,10,0.14)' };
  return { label: 'User', color: '#8E8E93', bg: 'rgba(142,142,147,0.14)' };
}

export function planMeta(plan: unknown): { label: string; color: string } {
  const p = String(plan || 'NONE').toUpperCase();
  if (p === 'AGENCY') return { label: 'Agencja', color: '#5856D6' };
  if (p === 'PRO') return { label: 'PRO', color: '#007AFF' };
  if (p === 'INVESTOR') return { label: 'Inwestor', color: '#AF52DE' };
  if (p === 'NONE') return { label: 'Free', color: '#8E8E93' };
  return { label: p, color: '#8E8E93' };
}

export function radarThreshold(u: Record<string, unknown> | null | undefined): number | null {
  const rp = (u?.radarPreference || u?.RadarPreference) as Record<string, unknown> | undefined;
  const n = Number(rp?.minMatchThreshold ?? rp?.min_match_threshold);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
