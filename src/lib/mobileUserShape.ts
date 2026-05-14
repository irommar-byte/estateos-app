export type MobileUserCore = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  role: string;
  isVerified: boolean;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  planType: string;
  isPro: boolean;
  proExpiresAt: Date | null;
  companyName?: string | null;
  pendingEmail?: string | null;
};

export function computeIsProActive(user: { role: string; isPro: boolean; proExpiresAt: Date | null }) {
  const proExpiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;
  return Boolean(
    user.role === 'ADMIN' ||
      (user.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now()))
  );
}

/**
 * Canonical kształt obiektu `user` zwracanego z wszystkich mobilnych endpointów
 * profilowych (GET/PATCH /user/me, /auth, /auth/login, /login, email-change confirm,
 * email-verify confirm). Wylicza `emailVerified` jako `isVerified === true || !!emailVerifiedAt`,
 * żeby uniknąć rozjazdu „isVerified=true ale emailVerified=false”.
 */
export function shapeMobileUser(user: MobileUserCore) {
  const fullName = String(user.name || '').trim();
  const parts = fullName ? fullName.split(/\s+/) : [];
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  const emailVerifiedAt = user.emailVerifiedAt ?? null;
  const emailVerified = Boolean(user.isVerified || emailVerifiedAt);
  const phoneVerifiedAt = user.phoneVerifiedAt ?? null;
  const phoneVerified = Boolean(user.phone && phoneVerifiedAt);
  const lockedRole = user.role === 'AGENT' || user.role === 'ADMIN';

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName,
    lastName,
    phone: user.phone,
    image: user.image,
    avatar: user.image,
    role: user.role,
    planType: user.planType,
    isPro: computeIsProActive({
      role: user.role,
      isPro: user.isPro,
      proExpiresAt: user.proExpiresAt,
    }),
    proExpiresAt: user.proExpiresAt,
    emailVerified,
    isEmailVerified: emailVerified,
    emailVerifiedAt,
    isVerified: user.isVerified,
    phoneVerified,
    isVerifiedPhone: phoneVerified,
    phoneVerifiedAt,
    profileNameLocked: lockedRole,
    identityNameLocked: lockedRole,
    companyName: user.companyName ?? null,
    pendingEmail: user.pendingEmail ?? null,
  };
}

export const MOBILE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  image: true,
  role: true,
  isVerified: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  planType: true,
  isPro: true,
  proExpiresAt: true,
  companyName: true,
  pendingEmail: true,
} as const;
