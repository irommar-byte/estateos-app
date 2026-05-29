export function resolveMediaUrl(value: unknown, origin = ''): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return origin ? `${origin.replace(/\/$/, '')}${s}` : s;
  return origin ? `${origin.replace(/\/$/, '')}/${s.replace(/^\//, '')}` : s;
}

export function getBestUserAvatarUrl(userLike: unknown, origin = ''): string | null {
  if (!userLike || typeof userLike !== 'object') return null;
  const u = userLike as Record<string, unknown>;
  const candidates = [u.image, u.avatar, u.avatarUrl, u.profileImage, u.profileImageUrl, u.photo];
  for (const c of candidates) {
    const uri = resolveMediaUrl(c, origin);
    if (uri) return uri;
  }
  return null;
}

export function isAgencyUser(userLike: unknown): boolean {
  if (!userLike || typeof userLike !== 'object') return false;
  const u = userLike as Record<string, unknown>;
  if (String(u.role ?? '').toUpperCase() === 'AGENT') return true;
  const type = String(u.type ?? u.planType ?? u.buyerType ?? '').toUpperCase();
  return type === 'AGENCY' || type === 'AGENT';
}

export function resolveAgencyDisplayName(userLike: unknown): string | null {
  if (!userLike || typeof userLike !== 'object') return null;
  const u = userLike as Record<string, unknown>;
  const name = String(u.companyName ?? u.agencyName ?? '').trim();
  return name || null;
}
