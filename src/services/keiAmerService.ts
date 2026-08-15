import { Platform } from 'react-native';
import { API_URL } from '../config/network';
import type {
  KeiExportProgressEvent,
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
function normalizeSseBuffer(raw: string): string {
  return raw.replace(/\r\n/g, '\n');
}

export function parseSseEvents(buffer: string, onEvent: (event: KeiExportProgressEvent) => void): string {
  const normalized = normalizeSseBuffer(buffer);
  const parts = normalized.split('\n\n');
  const rest = parts.pop() || '';
  for (const block of parts) {
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.replace(/^data:\s?/, '');
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as KeiExportProgressEvent);
      } catch {
        /* ignore malformed */
      }
    }
  }
  return rest;
}

/** XMLHttpRequest — jedyny niezawodny sposób streamingu SSE w React Native (fetch buforuje całość). */
let activeExportXhr: XMLHttpRequest | null = null;
let activeExportAbort: AbortController | null = null;
let exportStreamCancelled = false;

export function cancelKeiAmerExportStream(): void {
  exportStreamCancelled = true;
  try {
    activeExportXhr?.abort();
  } catch {
    /* noop */
  }
  activeExportXhr = null;
  try {
    activeExportAbort?.abort();
  } catch {
    /* noop */
  }
  activeExportAbort = null;
}

function keiAmerExportStreamXHR(
  token: string,
  body: KeiExportRequest,
  onEvent: (event: KeiExportProgressEvent) => void,
): Promise<void> {
  const url = `${API_URL}/api/mobile/v1/admin/kei-amer/export-stream`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    activeExportXhr = xhr;
    let buffer = '';
    let lastLen = 0;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (activeExportXhr === xhr) activeExportXhr = null;
      fn();
    };

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    const flushNewText = () => {
      const text = xhr.responseText || '';
      if (text.length <= lastLen) return;
      buffer += text.slice(lastLen);
      lastLen = text.length;
      buffer = parseSseEvents(buffer, onEvent);
    };

    xhr.onprogress = flushNewText;
    xhr.onreadystatechange = () => {
      if (xhr.readyState >= XMLHttpRequest.LOADING) flushNewText();
    };
    xhr.onload = () => {
      flushNewText();
      if (buffer.trim()) parseSseEvents(`${buffer}\n\n`, onEvent);
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(() => resolve());
      } else if (!exportStreamCancelled) {
        finish(() => reject(new Error(`Eksport nie powiódł się (HTTP ${xhr.status})`)));
      } else {
        finish(() => reject(new Error('Import zatrzymany.')));
      }
    };
    xhr.onerror = () => {
      if (exportStreamCancelled) {
        finish(() => reject(new Error('Import zatrzymany.')));
        return;
      }
      finish(() => reject(new Error('Błąd sieci podczas importu KEI')));
    };
    xhr.onabort = () => {
      finish(() => reject(new Error('Import zatrzymany.')));
    };
    xhr.ontimeout = () => {
      if (exportStreamCancelled) {
        finish(() => reject(new Error('Import zatrzymany.')));
        return;
      }
      finish(() => reject(new Error('Przekroczono czas oczekiwania importu KEI')));
    };
    xhr.timeout = 300000;
    xhr.send(JSON.stringify(body));
  });
}

async function keiAmerExportStreamFetch(
  token: string,
  body: KeiExportRequest,
  onEvent: (event: KeiExportProgressEvent) => void,
): Promise<void> {
  const abort = new AbortController();
  activeExportAbort = abort;
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/export-stream`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: abort.signal,
  }).finally(() => {
    if (activeExportAbort === abort) activeExportAbort = null;
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(String((data as { error?: string })?.error || `Eksport nie powiódł się (${res.status})`));
  }

  const reader = res.body?.getReader?.();
  if (!reader) {
    await keiAmerExportLatest(token, body, onEvent);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseEvents(buffer, onEvent);
  }
  if (buffer.trim()) parseSseEvents(`${buffer}\n\n`, onEvent);
}

async function keiAmerExportLatest(
  token: string,
  body: KeiExportRequest,
  onEvent: (event: KeiExportProgressEvent) => void,
): Promise<void> {
  onEvent({ type: 'batch_start', total: body.selections?.length || body.count || 1 });
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/kei-amer/export-latest`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{
    ok: boolean;
    exported: Array<{ offerId: number; portalUrl: string; publicUrl: string; editUrl: string; keiListingId?: string }>;
    skipped: Array<{ portalUrl: string; reason: string; keiListingId?: string; existingOfferId?: number }>;
    message: string;
  }>(res);

  let idx = 0;
  for (const row of data.exported || []) {
    onEvent({
      type: 'item_start',
      index: idx,
      total: (data.exported?.length || 0) + (data.skipped?.length || 0),
      keiListingId: row.keiListingId || '',
      portalUrl: row.portalUrl,
    });
    onEvent({
      type: 'item_done',
      index: idx,
      keiListingId: row.keiListingId || '',
      offerId: row.offerId,
      portalUrl: row.portalUrl,
      publicUrl: row.publicUrl,
      editUrl: row.editUrl,
    });
    idx += 1;
  }
  for (const row of data.skipped || []) {
    onEvent({
      type: 'item_start',
      index: idx,
      total: (data.exported?.length || 0) + (data.skipped?.length || 0),
      keiListingId: row.keiListingId || '',
      portalUrl: row.portalUrl,
    });
    onEvent({
      type: 'item_skip',
      index: idx,
      keiListingId: row.keiListingId || '',
      portalUrl: row.portalUrl,
      reason: row.reason,
      existingOfferId: row.existingOfferId,
    });
    idx += 1;
  }
  onEvent({
    type: 'result',
    ok: true,
    exported: data.exported || [],
    skipped: data.skipped || [],
    message: data.message,
  });
}

export async function keiAmerExportStream(
  token: string,
  body: KeiExportRequest,
  onEvent: (event: KeiExportProgressEvent) => void,
): Promise<void> {
  exportStreamCancelled = false;
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      await keiAmerExportStreamXHR(token, body, onEvent);
      return;
    } catch {
      await keiAmerExportLatest(token, body, onEvent);
      return;
    }
  }
  await keiAmerExportStreamFetch(token, body, onEvent);
}

export function reconcileExportItemsFromResult(
  items: Array<{ index: number; portalUrl: string; status: string }>,
  result: Extract<KeiExportProgressEvent, { type: 'result' }>,
): Array<{ index: number; patch: Record<string, unknown> }> {
  const patches: Array<{ index: number; patch: Record<string, unknown> }> = [];
  const skippedByUrl = new Map((result.skipped || []).map((r) => [r.portalUrl, r]));

  for (const item of items) {
    if (item.status !== 'pending' && item.status !== 'active') continue;
    const exported = (result.exported || []).find((r) => r.portalUrl === item.portalUrl);
    if (exported) {
      patches.push({
        index: item.index,
        patch: {
          status: 'done',
          stepLabel: 'Gotowe',
          currentStep: null,
          completedSteps: ['check_duplicate', 'fetch_portal', 'create_offer', 'images', 'activate'],
          offerId: exported.offerId,
          publicUrl: exported.publicUrl,
          editUrl: exported.editUrl,
        },
      });
      continue;
    }
    const skipped = skippedByUrl.get(item.portalUrl);
    if (skipped) {
      patches.push({
        index: item.index,
        patch: {
          status: 'skipped',
          stepLabel: 'Pominięto',
          currentStep: null,
          reason: skipped.existingOfferId
            ? `${skipped.reason} (oferta #${skipped.existingOfferId})`
            : skipped.reason,
        },
      });
      continue;
    }
    patches.push({
      index: item.index,
      patch: {
        status: 'skipped',
        stepLabel: 'Pominięto',
        currentStep: null,
        reason: 'Import zakończony bez tej pozycji',
      },
    });
  }
  return patches;
}
