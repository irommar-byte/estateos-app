function siteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

export function resolveMediaUrl(value: unknown, origin = siteOrigin()): string | null {
  const s = String(value ?? '').trim();
  if (!s || s === '[object Object]') return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return origin ? `${origin.replace(/\/$/, '')}${s}` : s;
  return origin ? `${origin.replace(/\/$/, '')}/${s.replace(/^\//, '')}` : s;
}

function resolveUserAvatarUrl(value: unknown, origin = siteOrigin()): string | null {
  if (value == null) return null;
  if (typeof value === 'object') {
    const asObj = value as Record<string, unknown>;
    const nested = asObj.url ?? asObj.src ?? asObj.uri ?? asObj.path ?? asObj.image ?? asObj.avatar;
    if (nested != null) return resolveUserAvatarUrl(nested, origin);
  }
  return resolveMediaUrl(value, origin);
}

function deepFindAvatarUrl(input: unknown, depth = 0, origin = siteOrigin()): string | null {
  if (!input || depth > 4) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s) || s.startsWith('/uploads/') || s.startsWith('/api/')) {
      return resolveMediaUrl(s, origin);
    }
    return null;
  }
  if (typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const blockedKeys = new Set(['reviews', 'offers', 'stats', 'badges', 'password', 'token', 'reviewsData']);
  const priorityKeys = ['image', 'avatar', 'avatarUrl', 'profileImage', 'profileImageUrl', 'photo', 'url'];
  for (const key of priorityKeys) {
    if (key in obj) {
      const found = deepFindAvatarUrl(obj[key], depth + 1, origin);
      if (found) return found;
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (blockedKeys.has(String(k))) continue;
    const found = deepFindAvatarUrl(v, depth + 1, origin);
    if (found) return found;
  }
  return null;
}

export function getBestUserAvatarUrl(userLike: unknown, origin = siteOrigin()): string | null {
  if (!userLike || typeof userLike !== 'object') return null;
  const u = userLike as Record<string, unknown>;
  const candidates = [
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
    const uri = resolveUserAvatarUrl(c, origin);
    if (uri) return uri;
  }
  return (
    deepFindAvatarUrl(u.profile, 0, origin) ||
    deepFindAvatarUrl(u.user, 0, origin) ||
    deepFindAvatarUrl({ ...u, offers: undefined, reviews: undefined, reviewsData: undefined }, 0, origin)
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
