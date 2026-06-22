import { API_URL } from '../config/network';

export function resolveMediaUrl(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${API_URL}${s}`;
  return `${API_URL}/${s.replace(/^\//, '')}`;
}

function resolveUserAvatarUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object') {
    const asObj = value as Record<string, unknown>;
    const nested =
      asObj?.url ?? asObj?.src ?? asObj?.uri ?? asObj?.path ?? asObj?.image ?? asObj?.avatar;
    if (nested != null) return resolveUserAvatarUrl(nested);
  }
  const raw = String(value).trim();
  if (!raw || raw === '[object Object]') return null;
  return resolveMediaUrl(raw);
}

function deepFindAvatarUrl(input: unknown, depth = 0): string | null {
  if (!input || depth > 4) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s) || s.startsWith('/uploads/') || s.startsWith('/api/')) {
      return resolveMediaUrl(s);
    }
    return null;
  }
  if (typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const blockedKeys = new Set(['reviews', 'offers', 'stats', 'badges', 'password', 'token']);
  const priorityKeys = ['image', 'avatar', 'avatarUrl', 'profileImage', 'profileImageUrl', 'photo', 'url'];
  for (const key of priorityKeys) {
    if (key in obj) {
      const found = deepFindAvatarUrl(obj[key], depth + 1);
      if (found) return found;
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (blockedKeys.has(String(k))) continue;
    const found = deepFindAvatarUrl(v, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Najlepszy URL zdjęcia profilowego z obiektu użytkownika z API. */
export function getBestUserAvatarUrl(userLike: unknown): string | null {
  if (!userLike || typeof userLike !== 'object') return null;
  const u = userLike as Record<string, unknown>;
  const candidates = [
    u.profilePhotoUrl,
    u.displayAvatarUrl,
    u.image,
    u.avatar,
    u.avatarUrl,
    u.avatar_url,
    u.photo,
    u.photoUrl,
    u.profileImage,
    u.profileImageUrl,
    u.profile_image,
    u.profile_picture,
    u.picture,
    (u.profile as Record<string, unknown> | undefined)?.image,
    (u.user as Record<string, unknown> | undefined)?.image,
  ];
  for (const c of candidates) {
    const uri = resolveUserAvatarUrl(c);
    if (uri) return uri;
  }
  return (
    deepFindAvatarUrl(u.profile) ||
    deepFindAvatarUrl(u.user) ||
    deepFindAvatarUrl({ ...u, offers: undefined, reviews: undefined })
  );
}

export function isAgencyUser(userLike: unknown): boolean {
  if (!userLike || typeof userLike !== 'object') return false;
  const u = userLike as Record<string, unknown>;
  const type = String(u.type ?? u.planType ?? u.buyerType ?? u.role ?? '').toUpperCase();
  return type === 'AGENCY' || type === 'AGENT';
}

export function resolveAgencyDisplayName(userLike: unknown): string | null {
  if (!userLike || typeof userLike !== 'object') return null;
  const u = userLike as Record<string, unknown>;
  const name = String(u.companyName ?? u.agencyName ?? u.company ?? '').trim();
  return name || null;
}
