import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import {
  inferCouponPurpose,
  resolveCouponPurpose,
  resolveVisualTheme,
  withCouponUsedPresentation,
} from './profilePromoCouponUi';
import {
  applyBirthdayYearPalette,
  buildBirthdayCouponTitle,
  getBirthdayCouponYear,
} from './birthdayCouponTheme';
import { isWelcomeCouponRecord } from '../services/welcomeCouponService';
import { mapWelcomeCouponCard } from './mapWelcomeCouponCard';

function withPurposeAndTheme(
  card: ProfilePromoCardRecord,
  t: BuildParams['t'],
): ProfilePromoCardRecord {
  const purpose = inferCouponPurpose(card);
  const purposeUi = resolveCouponPurpose(t, purpose);
  const visualTheme = resolveVisualTheme(card);
  return {
    ...card,
    purpose: purposeUi.purpose,
    purposeLabel: purposeUi.purposeLabel,
    purposeIcon: purposeUi.purposeIcon,
    visualTheme,
    borderColor: visualTheme === 'birthday' ? card.borderColor : card.borderColor,
  };
}

type BuildParams = {
  t: (key: string, vars?: Record<string, unknown>) => string;
  adminPromos: ProfilePromoCardRecord[];
  dismissedIds?: Set<string>;
};

function mapBirthdayCouponCard(
  raw: ProfilePromoCardRecord,
  t: BuildParams['t'],
): ProfilePromoCardRecord {
  const used = raw.couponUsed === true;
  const checking = raw.couponUsed == null && raw.grantsFreeListing === true;
  const year = getBirthdayCouponYear(raw);
  const base: ProfilePromoCardRecord = {
    ...raw,
    kind: 'birthday_coupon',
    title: buildBirthdayCouponTitle(t, year),
    subtitle: t('profile.shop.birthdayCouponSubtitle'),
    meta: checking
      ? t('profile.shop.freeChecking')
      : used
        ? t('profile.shop.freeUsed')
        : t('profile.shop.birthdayCouponReady'),
    pillLabel: t('profile.shop.birthdayPill'),
    pillColor: checking ? '#0A84FF' : '#34C759',
    pillBg: checking ? 'rgba(10,132,255,0.14)' : 'rgba(52,199,89,0.14)',
    pillBorder: checking ? 'rgba(10,132,255,0.32)' : 'rgba(52,199,89,0.38)',
    iconName: 'gift',
    iconBg: checking ? '#0A84FF' : '#FF9F0A',
    borderColor: checking
      ? 'rgba(10,132,255,0.32)'
      : 'rgba(255,159,10,0.42)',
    peelHint: !used && !checking,
    dismissible: true,
    visualTheme: 'birthday',
    purpose: 'publication',
    birthdayYear: year,
  };
  return checking ? base : applyBirthdayYearPalette(base, year);
}

function mapAdminPromoCard(raw: ProfilePromoCardRecord): ProfilePromoCardRecord {
  return {
    ...raw,
    dismissible: true,
  };
}

function mapPromoRow(raw: ProfilePromoCardRecord, t: BuildParams['t']): ProfilePromoCardRecord {
  if (isWelcomeCouponRecord(raw)) {
    return mapWelcomeCouponCard(raw, t);
  }
  if (raw.templateId === 'birthday_free_listing' || raw.kind === 'birthday_coupon') {
    return mapBirthdayCouponCard(raw, t);
  }
  return mapAdminPromoCard(raw);
}

/** Tylko kupony bonusowe (powitalny, urodzinowy, admin), bez Pakietu Plus. */
export function buildBonusCouponStack(params: BuildParams): ProfilePromoCardRecord[] {
  const { t, adminPromos, dismissedIds } = params;

  const sortedAdmin = [
    ...adminPromos
      .filter((raw) => raw.kind !== 'plus_package')
      .map((raw) => mapPromoRow(raw, t)),
  ].sort((a, b) => {
    const rank = (c: ProfilePromoCardRecord) =>
      c.kind === 'welcome_coupon' ? 0 : c.kind === 'birthday_coupon' ? 1 : 2;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });

  const stack = sortedAdmin.filter((card) => !dismissedIds?.has(card.id));

  const count = stack.length;
  return stack
    .map((card) => withPurposeAndTheme(card, t))
    .map((card) => withCouponUsedPresentation(card, t))
    .map((card) => ({
      ...card,
      peelable: count > 1 && card.couponUsed !== true,
    }));
}
