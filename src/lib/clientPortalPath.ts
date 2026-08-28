import { isBuyerIntakePath } from '@/lib/buyerIntakeShared';

/** Publiczny panel klienta — bez globalnego navbara agenta. */
export function isClientPortalPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/klient/'));
}

/** Flow kupującego: intake + panel (wspólny „buyer shell”). */
export function isBuyerFocusedShellPath(pathname: string | null | undefined): boolean {
  return isBuyerIntakePath(pathname) || isClientPortalPath(pathname);
}

export function buyerOnboardingStorageKey(token: string): string {
  return `estateos_buyer_onboard_${token.slice(-12)}`;
}

export function isBuyerOnboardingDismissed(token: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(buyerOnboardingStorageKey(token)) === '1';
  } catch {
    return false;
  }
}
