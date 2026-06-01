import { API_URL } from '../config/network';
import { fetchAdminContentReports } from './adminReportsService';
import { fetchAdminLegalVerificationQueue } from './legalVerificationService';
import { useProfileTabBadgeStore } from '../store/useProfileTabBadgeStore';

/** Odświeża sumę oczekujących zadań admina (badge na zakładce Profil). */
export async function refreshAdminAttentionBadgeCounts(token: string | null | undefined): Promise<number> {
  if (!token?.trim()) {
    useProfileTabBadgeStore.getState().setProfilePendingCount(0);
    return 0;
  }

  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    'Cache-Control': 'no-cache',
  };

  let offersPending = 0;
  let legalPending = 0;
  let reportsPending = 0;

  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers?status=PENDING`, {
      cache: 'no-store',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const list = Array.isArray(data?.offers)
        ? data.offers
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
            ? data.items
            : [];
      offersPending = list.length;
    }
  } catch {
    // noop
  }

  try {
    const legal = await fetchAdminLegalVerificationQueue('PENDING', token);
    legalPending = legal.length;
  } catch {
    // noop
  }

  try {
    const { counts } = await fetchAdminContentReports(token, { status: 'PENDING', targetType: 'ALL' });
    reportsPending = counts.pending;
  } catch {
    // noop
  }

  const total = offersPending + legalPending + reportsPending;
  useProfileTabBadgeStore.getState().setProfilePendingCount(total);
  return total;
}
