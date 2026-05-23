import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import type { TranslateFn } from '../i18n/types';

export function mapWelcomeCouponCard(raw: ProfilePromoCardRecord, t: TranslateFn): ProfilePromoCardRecord {
  const used = raw.couponUsed === true;
  const checking = raw.couponUsed == null && raw.grantsFreeListing === true;
  const accent = '#0A84FF';
  return {
    ...raw,
    kind: 'welcome_coupon',
    title: t('profile.shop.welcomeCouponTitle'),
    subtitle: t('profile.shop.welcomeCouponSubtitle'),
    meta: checking
      ? t('profile.shop.freeChecking')
      : used
        ? t('profile.shop.welcomeCouponUsed')
        : t('profile.shop.welcomeCouponReady'),
    pillLabel: t('profile.shop.welcomePill'),
    pillColor: checking ? '#0A84FF' : accent,
    pillBg: checking ? 'rgba(10,132,255,0.14)' : 'rgba(10,132,255,0.14)',
    pillBorder: checking ? 'rgba(10,132,255,0.32)' : 'rgba(10,132,255,0.38)',
    iconName: 'sparkles',
    iconBg: checking ? '#0A84FF' : accent,
    borderColor: checking ? 'rgba(10,132,255,0.32)' : 'rgba(10,132,255,0.36)',
    peelHint: !used && !checking,
    dismissible: true,
    visualTheme: 'default',
    purpose: 'publication',
  };
}
