export type OfferSharePrintAccessUser = {
  planType?: string | null;
  buyerType?: string | null;
  role?: string | null;
};

export function isOfferSharePrintAccount(user: OfferSharePrintAccessUser | null | undefined): boolean {
  if (!user) return false;
  const plan = String(user.planType || '').toUpperCase();
  if (plan === 'AGENCY') return true;
  const buyer = String(user.buyerType || '').toUpperCase();
  if (buyer === 'AGENCY') return true;
  const role = String(user.role || '').toUpperCase();
  if (role === 'AGENT' || role === 'ADMIN') return true;
  return false;
}

function extractPrintAccessUser(payload: unknown): OfferSharePrintAccessUser | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('user' in payload) {
    const nested = (payload as { user?: unknown }).user;
    return nested && typeof nested === 'object' ? (nested as OfferSharePrintAccessUser) : null;
  }
  return payload as OfferSharePrintAccessUser;
}

export async function fetchOfferSharePrintAccess(): Promise<boolean> {
  try {
    const res = await fetch('/api/user/profile', { credentials: 'include' });
    if (!res.ok) return false;
    const payload: unknown = await res.json();
    return isOfferSharePrintAccount(extractPrintAccessUser(payload));
  } catch {
    return false;
  }
}
