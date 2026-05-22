import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';

type BuildParams = {
  t: (key: string, vars?: Record<string, unknown>) => string;
  firstFreeUsed: boolean | null;
  plusSlots: number;
  hasPlusAvailable: boolean;
  plusCounterLabel: string;
  plusExpiryLabel: string | null;
  plusBuyHint: string;
  adminPromos: ProfilePromoCardRecord[];
};

export function buildProfilePromoStack(params: BuildParams): ProfilePromoCardRecord[] {
  const {
    t,
    firstFreeUsed,
    plusSlots,
    hasPlusAvailable,
    plusCounterLabel,
    plusExpiryLabel,
    plusBuyHint,
    adminPromos,
  } = params;

  const freeUsed = firstFreeUsed === true;
  const freeChecking = firstFreeUsed == null;

  const freeCard: ProfilePromoCardRecord = {
    id: 'free_listing',
    kind: 'free_listing',
    title: t('profile.shop.freeListing'),
    subtitle: t('profile.shop.freeFirstSubtitle'),
    meta: freeChecking
      ? t('profile.shop.freeChecking')
      : freeUsed
        ? t('profile.shop.freeUsed')
        : t('profile.shop.freeReady'),
    pillLabel: freeChecking
      ? t('profile.shop.checking')
      : freeUsed
        ? t('profile.shop.used')
        : t('profile.shop.unused'),
    pillColor: freeChecking ? '#0A84FF' : freeUsed ? '#FF9F0A' : '#34C759',
    pillBg: freeChecking
      ? 'rgba(10,132,255,0.14)'
      : freeUsed
        ? 'rgba(255,159,10,0.14)'
        : 'rgba(52,199,89,0.14)',
    pillBorder: freeChecking
      ? 'rgba(10,132,255,0.32)'
      : freeUsed
        ? 'rgba(255,159,10,0.38)'
        : 'rgba(52,199,89,0.38)',
    iconName: freeUsed ? 'checkmark-done-circle' : 'gift',
    iconBg: freeChecking ? '#0A84FF' : freeUsed ? '#FF9F0A' : '#34C759',
    borderColor: freeChecking
      ? 'rgba(10,132,255,0.32)'
      : freeUsed
        ? 'rgba(255,159,10,0.38)'
        : 'rgba(52,199,89,0.38)',
    peelHint: !freeUsed && !freeChecking,
    peelable: freeUsed,
  };

  const plusCard: ProfilePromoCardRecord = {
    id: 'plus_package',
    kind: 'plus_package',
    title: t('profile.shop.plusPackage'),
    subtitle: plusCounterLabel,
    meta: hasPlusAvailable
      ? t('profile.shop.plusValidUntil', { date: plusExpiryLabel || '—' })
      : plusBuyHint,
    pillLabel: hasPlusAvailable ? String(plusSlots) : '0',
    pillColor: hasPlusAvailable ? '#10B981' : '#0A84FF',
    pillBg: hasPlusAvailable ? 'rgba(16,185,129,0.14)' : 'rgba(10,132,255,0.14)',
    pillBorder: hasPlusAvailable ? 'rgba(16,185,129,0.42)' : 'rgba(10,132,255,0.32)',
    iconName: hasPlusAvailable ? 'checkmark-circle' : 'bag-add',
    iconBg: hasPlusAvailable ? '#10B981' : '#0A84FF',
    borderColor: hasPlusAvailable ? 'rgba(16,185,129,0.42)' : 'rgba(255,255,255,0.06)',
    peelable: false,
  };

  return [freeCard, ...adminPromos, plusCard];
}
