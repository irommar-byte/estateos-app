import { API_URL } from '../config/network';
import { fetchAdminContentReports } from './adminReportsService';
import { fetchAdminLegalVerificationQueue } from './legalVerificationService';
import { fetchAdminPhotoSessionQueue, fetchMyPhotoSessionRequests } from './photoSessionService';
import { useProfileTabBadgeStore } from '../store/useProfileTabBadgeStore';

/** Odświeża sumę czerwonych badge'y na zakładce Profil (sekcje wewnętrzne → tab bar). */
export async function refreshProfileTabBadgeCounts(
  token: string | null | undefined,
  options?: { isAdmin?: boolean },
): Promise<number> {
  if (!token?.trim()) {
    useProfileTabBadgeStore.getState().setProfilePendingCount(0);
    return 0;
  }

  const safeToken = token.trim();
  const headers = {
    Authorization: `Bearer ${safeToken}`,
    'Cache-Control': 'no-cache',
  };

  let userPhotoSessionsPending = 0;
  try {
    const items = await fetchMyPhotoSessionRequests(safeToken);
    userPhotoSessionsPending = items.filter(
      (x) => x.status === 'PENDING' && x.waitingOn === 'USER',
    ).length;
  } catch {
    // noop
  }

  let adminTotal = 0;
  if (options?.isAdmin) {
    let offersPending = 0;
    let legalPending = 0;
    let reportsPending = 0;
    let adminPhotoSessionsPending = 0;

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
      const legal = await fetchAdminLegalVerificationQueue('PENDING', safeToken);
      legalPending = legal.length;
    } catch {
      // noop
    }

    try {
      const { counts } = await fetchAdminContentReports(safeToken, {
        status: 'PENDING',
        targetType: 'ALL',
      });
      reportsPending = counts.pending;
    } catch {
      // noop
    }

    try {
      const items = await fetchAdminPhotoSessionQueue('PENDING', safeToken);
      adminPhotoSessionsPending = items.filter((x) => x.waitingOn === 'ADMIN').length;
    } catch {
      // noop
    }

    adminTotal = offersPending + legalPending + reportsPending + adminPhotoSessionsPending;
  }

  const total = userPhotoSessionsPending + adminTotal;
  useProfileTabBadgeStore.getState().setProfilePendingCount(total);
  return total;
}

/** @deprecated use refreshProfileTabBadgeCounts */
export async function refreshAdminAttentionBadgeCounts(token: string | null | undefined): Promise<number> {
  return refreshProfileTabBadgeCounts(token, { isAdmin: true });
}
