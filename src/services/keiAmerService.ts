import { API_URL } from '../config/network';
import type {
  KeiAutoImportConfig,
  KeiAutoImportSettings,
  KeiTargetUserOption,
  KeiExportRequest,
  KeiImportJobSnapshot,
  KeiPeekResponse,
  KeiPreviewResponse,
  KeiPropertyKind,
  KeiSearchFacetsResponse,
  KeiSessionResponse,
  KeiTransactionKind,
} from '../contracts/keiAmerContract';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache',
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(
      (data as { error?: string; message?: string })?.error ||
        (data as { message?: string })?.message ||
        `HTTP ${res.status}`,
    );
    throw new Error(msg);
  }
  return data as T;
}

export async function keiAmerRefreshSession(token: string, force = true): Promise<KeiSessionResponse> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/session`, {
    method: force ? 'POST' : 'GET',
    headers: authHeaders(token),
  });
  return parseJson<KeiSessionResponse>(res);
}

export async function keiAmerFetchFacets(
  token: string,
  params: { propertyKind: KeiPropertyKind; transactionKind?: KeiTransactionKind },
): Promise<KeiSearchFacetsResponse> {
  const q = new URLSearchParams({
    propertyKind: params.propertyKind,
    transactionKind: params.transactionKind ?? 'sale',
  });
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/facets?${q}`, {
    headers: authHeaders(token),
  });
  return parseJson<KeiSearchFacetsResponse>(res);
}

export async function keiAmerFetchPreview(
  token: string,
  params: {
    propertyKind: KeiPropertyKind;
    transactionKind?: KeiTransactionKind;
    page?: number;
    pageSize?: number;
    selectionPool?: boolean;
    mode?: 'feed' | 'search';
    district?: string;
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    dateFrom?: string;
    dateTo?: string;
    verify?: boolean;
  },
): Promise<KeiPreviewResponse> {
  const q = new URLSearchParams({
    propertyKind: params.propertyKind,
    transactionKind: params.transactionKind ?? 'sale',
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.selectionPool) q.set('selectionPool', '1');
  if (params.mode === 'search') q.set('mode', 'search');
  if (params.district) q.set('district', params.district);
  if (params.minPrice != null) q.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) q.set('maxPrice', String(params.maxPrice));
  if (params.minArea != null) q.set('minArea', String(params.minArea));
  if (params.maxArea != null) q.set('maxArea', String(params.maxArea));
  if (params.dateFrom) q.set('dateFrom', params.dateFrom);
  if (params.dateTo) q.set('dateTo', params.dateTo);
  if (params.verify === true) q.set('verify', '1');
  if (params.verify === false) q.set('verify', '0');
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/preview?${q}`, {
    headers: authHeaders(token),
  });
  return parseJson<KeiPreviewResponse>(res);
}

export async function keiAmerStartExportJob(
  token: string,
  body: KeiExportRequest,
): Promise<{ ok: boolean; jobId: string; job: KeiImportJobSnapshot; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/export-jobs`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function keiAmerFetchExportJob(
  token: string,
  jobId: string,
): Promise<{ ok: boolean; job: KeiImportJobSnapshot }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/export-jobs/${jobId}`, {
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function keiAmerFetchActiveExportJobs(
  token: string,
): Promise<{ ok: boolean; jobs: KeiImportJobSnapshot[]; active: KeiImportJobSnapshot[] }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/export-jobs/active`, {
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function keiAmerCancelExportJob(
  token: string,
  jobId: string,
): Promise<{ ok: boolean; job: KeiImportJobSnapshot }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/export-jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function keiAmerPeekListing(token: string, portalUrl: string): Promise<KeiPeekResponse> {
  const q = new URLSearchParams({ portalUrl });
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/peek?${q}`, {
    headers: authHeaders(token),
  });
  return parseJson<KeiPeekResponse>(res);
}

export function keiAmerPeekImageUrl(portalUrl: string, imageIndex?: number): string {
  const q = new URLSearchParams({ portalUrl });
  if (imageIndex != null && imageIndex >= 0) q.set('imageIndex', String(imageIndex));
  return `${API_URL}/api/mobile/v1/admin/kei-amer/peek-image?${q}`;
}

/** Normalizuje końcówki linii SSE (iOS/nginx często wysyła \r\n). */

export async function keiAmerFetchAutoImport(token: string): Promise<{ ok: boolean; config: KeiAutoImportConfig }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/auto-import`, {
    headers: authHeaders(token),
  });
  return parseJson<{ ok: boolean; config: KeiAutoImportConfig }>(res);
}

export async function keiAmerSaveAutoImport(
  token: string,
  patch: Partial<
    Pick<
      KeiAutoImportConfig,
      | 'enabled'
      | 'intervalMinutes'
      | 'count'
      | 'targetUserId'
      | 'agentCommissionPercent'
      | 'propertyKind'
      | 'transactionKind'
    >
  > & { settings?: Partial<KeiAutoImportSettings> },
): Promise<{ ok: boolean; config: KeiAutoImportConfig }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/auto-import`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJson<{ ok: boolean; config: KeiAutoImportConfig }>(res);
}

export async function keiAmerFetchTargetUsers(token: string, query: string): Promise<KeiTargetUserOption[]> {
  const res = await fetch(
    `${API_URL}/api/mobile/v1/admin/kei-amer/target-users?q=${encodeURIComponent(query)}`,
    { headers: authHeaders(token) },
  );
  const data = await parseJson<{ ok: boolean; users: KeiTargetUserOption[] }>(res);
  return Array.isArray(data.users) ? data.users : [];
}
