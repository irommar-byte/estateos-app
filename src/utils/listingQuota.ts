/**
 * Limit ogłoszeń: użytkownik bez pakietu Plus/PRO może mieć jedno aktywne lub oczekujące ogłoszenie.
 * Pakiet „Plus” na WWW: Stripe checkout (np. POST /api/stripe/checkout z planem).
 * Animacja sukcesu po wykupieniu na WWW: często redirect + ewent. ModeTransition / komunikat (layout www).
 */

import { Linking } from 'react-native';

export type MinimalUser = {
  id?: number;
  role?: string;
  planType?: string | null;
  isPro?: boolean;
  proExpiresAt?: string | null;
  /** Gdy backend ustawi Pakiet Plus (np. po IAP / Stripe), opcjonalna data wygaśnięcia */
  plusExpiresAt?: string | null;
  /** Sloty dodatkowych publikacji (Pakiet Plus jako kredyty) */
  extraListings?: number | null;
};

/** Zgodnie z OfferDetail — pełny dostęp bez limitu prostych ogłoszeń */
export function hasUnlimitedListingAccess(user: MinimalUser | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const proExpiryMs = user.proExpiresAt ? new Date(user.proExpiresAt).getTime() : null;
  const proStillActive = Boolean(!proExpiryMs || proExpiryMs > Date.now());
  return Boolean(
    (user.isPro && proStillActive) ||
    user.planType === 'PRO' ||
    user.planType === 'AGENCY' ||
    user.role === 'AGENCY'
  );
}

/** Aktywny Pakiet Plus z API (np. po zakupie IAP ze zweryfikowanym backendem) — pozwala na więcej niż jedno liczone ogłoszenie */
export function isPlusPlanActive(user: MinimalUser | null): boolean {
  if (!user || user.planType !== 'PLUS') return false;
  const exp = user.plusExpiresAt ? new Date(user.plusExpiresAt).getTime() : null;
  return !exp || exp > Date.now();
}

export function allowsMultipleCountableListings(user: MinimalUser | null): boolean {
  return hasUnlimitedListingAccess(user) || isPlusPlanActive(user);
}

export function getAdditionalListingSlots(user: MinimalUser | null): number {
  const n = Number(user?.extraListings ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Konto standardowe: 1 darmowy slot + dokupione sloty extraListings.
 * PRO/AGENCY/ADMIN mają nielimitowany dostęp.
 */
export function canPublishCountableListing(user: MinimalUser | null, existingCount: number): boolean {
  if (allowsMultipleCountableListings(user)) return true;
  const totalAllowed = 1 + getAdditionalListingSlots(user);
  return existingCount < totalAllowed;
}

const COUNTABLE_STATUSES = new Set(['ACTIVE', 'PENDING']);

export async function fetchCountableUserOffers(
  apiUrl: string,
  token: string,
  userId: number
): Promise<number> {
  try {
    const res = await fetch(`${apiUrl}/api/mobile/v1/offers?includeAll=true&userId=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!data.success || !Array.isArray(data.offers)) return 0;
    return data.offers.filter((o: { status?: string }) => COUNTABLE_STATUSES.has(String(o.status || ''))).length;
  } catch {
    return 0;
  }
}

/** Klucz planu jak na stronie (Stripe checkout) */
export const PLUS_CHECKOUT_PLAN = 'pakiet_plus';

/**
 * Uruchamia Stripe Checkout w przeglądarce.
 * Fallback: strona cennika (jak OfferDetail „Zostań PRO”).
 */
export async function openPlusStripeCheckout(apiUrl: string, token: string): Promise<void> {
  const body = {
    plan: PLUS_CHECKOUT_PLAN,
    returnUrl: `${apiUrl.replace(/\/$/, '')}/moje-konto`,
    cancelUrl: `${apiUrl.replace(/\/$/, '')}/cennik`,
  };

  try {
    const res = await fetch(`${apiUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.url && typeof data.url === 'string') {
      await Linking.openURL(data.url);
      return;
    }
  } catch {
    /* fallback */
  }

  await Linking.openURL(`${apiUrl}/cennik`);
}

export async function openStripeCheckoutForPlan(
  apiUrl: string,
  token: string,
  plan: string,
  extra?: {
    returnUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, unknown>;
    offerId?: number;
    offerPayload?: Record<string, unknown>;
  }
): Promise<boolean> {
  const body: Record<string, unknown> = {
    plan,
    returnUrl: extra?.returnUrl || `${apiUrl.replace(/\/$/, '')}/moje-konto`,
    cancelUrl: extra?.cancelUrl || `${apiUrl.replace(/\/$/, '')}/cennik`,
    metadata: extra?.metadata || {},
  };
  if (extra?.offerId) body.offerId = extra.offerId;
  if (extra?.offerPayload) body.offerPayload = extra.offerPayload;

  try {
    const res = await fetch(`${apiUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.url && typeof data.url === 'string') {
      await Linking.openURL(data.url);
      return true;
    }
  } catch {
    // fallback poniżej
  }

  await Linking.openURL(`${apiUrl}/cennik`);
  return false;
}
