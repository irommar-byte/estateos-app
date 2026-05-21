import { API_URL } from '../config/network';
import type {
  AdminContentReport,
  AdminReportCounts,
  AdminReportListStatus,
  AdminReportStatus,
} from '../contracts/adminReportsContract';

export const ADMIN_REPORTS_PATH = '/api/mobile/v1/admin/reports';

export class AdminReportsServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'unauthorized' | 'forbidden' | 'not_found' | 'network' | 'unknown' = 'unknown',
  ) {
    super(message);
    this.name = 'AdminReportsServiceError';
  }
}

type ListResponse = {
  success?: boolean;
  reports?: AdminContentReport[];
  counts?: AdminReportCounts;
  message?: string;
};

export async function fetchAdminContentReports(
  token: string,
  opts?: { status?: AdminReportListStatus; targetType?: 'OFFER' | 'USER' | 'ALL' },
): Promise<{ reports: AdminContentReport[]; counts: AdminReportCounts }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.targetType) params.set('targetType', opts.targetType);

  const qs = params.toString();
  const url = `${API_URL}${ADMIN_REPORTS_PATH}${qs ? `?${qs}` : ''}`;

  let res: Response;
  try {
    res = await fetch(url, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    throw new AdminReportsServiceError('Brak połączenia z serwerem.', 'network');
  }

  const json = (await res.json().catch(() => ({}))) as ListResponse;

  if (res.status === 401) {
    throw new AdminReportsServiceError('Sesja wygasła — zaloguj się ponownie.', 'unauthorized');
  }
  if (res.status === 403) {
    throw new AdminReportsServiceError('Brak uprawnień administratora.', 'forbidden');
  }
  if (!res.ok) {
    throw new AdminReportsServiceError(json.message || 'Nie udało się pobrać zgłoszeń.', 'unknown');
  }

  return {
    reports: Array.isArray(json.reports) ? json.reports : [],
    counts: json.counts ?? { pending: 0, inReview: 0, actioned: 0, dismissed: 0, total: 0 },
  };
}

export async function updateAdminContentReport(
  token: string,
  reportId: string,
  patch: { status?: AdminReportStatus; adminNote?: string | null },
): Promise<void> {
  const url = `${API_URL}${ADMIN_REPORTS_PATH}/${reportId}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });
  } catch {
    throw new AdminReportsServiceError('Brak połączenia z serwerem.', 'network');
  }

  const json = (await res.json().catch(() => ({}))) as { message?: string };

  if (res.status === 401) {
    throw new AdminReportsServiceError('Sesja wygasła — zaloguj się ponownie.', 'unauthorized');
  }
  if (res.status === 403) {
    throw new AdminReportsServiceError('Brak uprawnień administratora.', 'forbidden');
  }
  if (res.status === 404) {
    throw new AdminReportsServiceError('Zgłoszenie nie istnieje.', 'not_found');
  }
  if (!res.ok) {
    throw new AdminReportsServiceError(json.message || 'Nie udało się zapisać zmian.', 'unknown');
  }
}

export async function rejectOfferFromReport(
  token: string,
  offerId: number,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ offerId, newStatus: 'REJECTED' }),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new AdminReportsServiceError(json.message || 'Nie udało się odrzucić oferty.', 'unknown');
  }
}
