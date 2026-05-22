import type {
  ProfilePromoCardRecord,
  ProfilePromoCouponPurpose,
} from '../contracts/profilePromoContract';

export type CouponPurposeUi = {
  purpose: ProfilePromoCouponPurpose;
  /** Krótki podpis na dolnej belce (bez poszerzania karty). */
  purposeLabel: string;
  purposeIcon: string;
};

export type CouponPurposeStripVisual = {
  stripBg: string;
  iconBg: string;
  iconName: string;
  iconColor: string;
  textColor: string;
};

export function resolveCouponPurpose(
  t: (key: string) => string,
  purpose: ProfilePromoCouponPurpose,
): CouponPurposeUi {
  switch (purpose) {
    case 'publication':
      return {
        purpose,
        purposeLabel: t('profile.shop.couponPurposePublicationShort'),
        purposeIcon: 'newspaper',
      };
    case 'off_market_preview':
      return {
        purpose,
        purposeLabel: t('profile.shop.couponPurposeOffMarketShort'),
        purposeIcon: 'eye',
      };
    default:
      return {
        purpose: 'generic',
        purposeLabel: t('profile.shop.couponPurposeGenericShort'),
        purposeIcon: 'pricetag',
      };
  }
}

/** Kolory dolnej belki — rozpoznawalne bez czytania tekstu. */
export function getCouponPurposeStripVisual(
  purpose: ProfilePromoCouponPurpose,
  isDark: boolean,
): CouponPurposeStripVisual {
  switch (purpose) {
    case 'publication':
      return {
        stripBg: isDark ? '#1A6B42' : '#34C759',
        iconBg: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.28)',
        iconName: 'newspaper',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
    case 'off_market_preview':
      return {
        stripBg: isDark ? '#3F2E8C' : '#6E56CF',
        iconBg: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.26)',
        iconName: 'eye',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
    default:
      return {
        stripBg: isDark ? '#3A3A3C' : '#8E8E93',
        iconBg: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.24)',
        iconName: 'pricetag',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
  }
}

export function inferCouponPurpose(card: {
  kind?: string;
  grantsFreeListing?: boolean;
  templateId?: string;
  purpose?: ProfilePromoCouponPurpose;
}): ProfilePromoCouponPurpose {
  if (card.purpose) return card.purpose;
  if (
    card.grantsFreeListing ||
    card.templateId === 'birthday_free_listing' ||
    card.templateId === 'welcome_free_listing' ||
    card.kind === 'welcome_coupon' ||
    card.kind === 'birthday_coupon'
  ) {
    return 'publication';
  }
  return 'generic';
}

export type CouponVisualTheme = ProfilePromoCardRecord['visualTheme'];

export function resolveVisualTheme(card: {
  kind?: string;
  templateId?: string;
  visualTheme?: CouponVisualTheme;
}): CouponVisualTheme {
  if (card.visualTheme) return card.visualTheme;
  if (card.templateId === 'birthday_free_listing' || card.kind === 'birthday_coupon') {
    return 'birthday';
  }
  return 'default';
}

/** Kolory tła i dekoracji — urodzinowy nastrój vs standard. */
/** Zużyty kupon: wygląd karty bez zmian; na dolnym pasku szare „Wykorzystane” zamiast zielonej „Publikacja”. */
export function withCouponUsedPresentation(
  card: ProfilePromoCardRecord,
  t: (key: string) => string,
): ProfilePromoCardRecord {
  if (card.couponUsed !== true) return card;
  return {
    ...card,
    meta: t('profile.shop.couponUsedMeta'),
    couponUsed: true,
    peelHint: false,
    purposeLabel: t('profile.shop.used'),
    purposeIcon: 'checkmark-done-circle',
    dismissible: card.dismissible !== false,
  };
}

export function getCouponUsedPurposeStripVisual(isDark: boolean): CouponPurposeStripVisual {
  return {
    stripBg: '#8E8E93',
    iconBg: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.28)',
    iconName: 'checkmark-done-circle',
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
  };
}

export function getCouponSurfaceStyle(
  theme: CouponVisualTheme,
  isDark: boolean,
): {
  backgroundColor: string;
  borderColor: string;
  overlayColors: string[];
  sparkleColors: string[];
} {
  if (theme === 'birthday') {
    return {
      backgroundColor: isDark ? '#2E2234' : '#FFF8F2',
      borderColor: isDark ? 'rgba(255,182,120,0.45)' : 'rgba(255,149,90,0.55)',
      overlayColors: isDark
        ? ['rgba(255,159,120,0.12)', 'rgba(255,105,180,0.1)', 'rgba(255,214,120,0.08)']
        : ['rgba(255,183,120,0.35)', 'rgba(255,143,180,0.22)', 'rgba(255,220,140,0.28)'],
      sparkleColors: ['#FF6B9D', '#FFB347', '#FFD93D', '#C77DFF', '#6ECBFF'],
    };
  }
  return {
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderColor: 'transparent',
    overlayColors: [],
    sparkleColors: [],
  };
}
