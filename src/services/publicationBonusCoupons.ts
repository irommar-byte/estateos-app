import type { PublicationQuote } from '../contracts/offerPublicationContract';
import type { TranslateFn } from '../i18n/types';
import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import { fetchUserProfilePromoCards } from './profilePromoService';
import { fetchPublicationQuote } from './offerPublicationService';
import { buildBonusCouponStack } from '../utils/buildBonusCouponStack';
import { loadDismissedProfilePromoIds } from '../utils/profilePromoDismissStorage';
import { inferCouponPurpose } from '../utils/profilePromoCouponUi';

export type PublicationBonusCouponOption = {
  id: string;
  kind: ProfilePromoCardRecord['kind'];
  title: string;
  subtitle: string;
  meta: string;
  pillLabel: string;
  pillColor: string;
  iconName: string;
  iconBg: string;
  visualTheme?: ProfilePromoCardRecord['visualTheme'];
  purposeLabel?: string;
  purposeIcon?: string;
  purpose?: ProfilePromoCardRecord['purpose'];
};

function isPublicationRedeemable(card: ProfilePromoCardRecord): boolean {
  if (card.couponUsed === true) return false;
  if (card.purpose === 'off_market_preview') return false;
  if (
    card.kind === 'welcome_coupon' ||
    card.kind === 'birthday_coupon' ||
    card.kind === 'admin_promo'
  ) {
    return true;
  }
  return inferCouponPurpose(card) === 'publication';
}

function mapStackCardToOption(card: ProfilePromoCardRecord): PublicationBonusCouponOption | null {
  if (!isPublicationRedeemable(card)) return null;
  return {
    id: card.id,
    kind: card.kind,
    title: card.title,
    subtitle: card.subtitle,
    meta: card.meta,
    pillLabel: card.pillLabel,
    pillColor: card.pillColor,
    iconName: card.iconName,
    iconBg: card.iconBg,
    visualTheme: card.visualTheme,
    purposeLabel: card.purposeLabel,
    purposeIcon: card.purposeIcon,
    purpose: card.purpose,
  };
}

export async function gatherPublicationBonusCoupons(opts: {
  apiUrl: string;
  token: string;
  userId: string | number;
  email?: string | null;
  firstFreePublicationUsed?: boolean | null;
  t: TranslateFn;
}): Promise<{
  coupons: PublicationBonusCouponOption[];
  quote: PublicationQuote;
  quoteOk: boolean;
}> {
  const quoteRes = await fetchPublicationQuote(opts.apiUrl, opts.token);
  const quote = quoteRes.quote;
  const dismissed = await loadDismissedProfilePromoIds(opts.userId);
  const adminPromos = await fetchUserProfilePromoCards(opts.token, opts.userId, {
    email: opts.email,
    firstFreePublicationUsed: opts.firstFreePublicationUsed,
  });

  const stack = buildBonusCouponStack({
    t: opts.t,
    adminPromos,
    dismissedIds: dismissed,
  });

  const coupons: PublicationBonusCouponOption[] = [];
  const seenCouponIds = new Set<string>();

  for (const card of stack) {
    const mapped = mapStackCardToOption(card);
    if (mapped) {
      coupons.push(mapped);
      seenCouponIds.add(mapped.id);
    }
  }

  for (const raw of adminPromos) {
    if (seenCouponIds.has(raw.id) || dismissed.has(raw.id) || raw.couponUsed === true) continue;
    if (!isPublicationRedeemable(raw)) continue;
    const miniStack = buildBonusCouponStack({
      t: opts.t,
      adminPromos: [raw],
      dismissedIds: dismissed,
    });
    for (const card of miniStack) {
      const mapped = mapStackCardToOption(card);
      if (mapped && !seenCouponIds.has(mapped.id)) {
        coupons.push(mapped);
        seenCouponIds.add(mapped.id);
      }
    }
  }

  coupons.sort((a, b) => {
    const rank = (c: PublicationBonusCouponOption) =>
      c.kind === 'welcome_coupon' ? 0 : c.kind === 'birthday_coupon' ? 1 : c.kind === 'admin_promo' ? 2 : 3;
    return rank(a) - rank(b);
  });

  return { coupons, quote, quoteOk: quoteRes.ok };
}
