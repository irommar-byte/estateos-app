import { API_URL } from '../config/network';
import type { AutomationOverview, ImportRegistryRow } from '../contracts/automationContract';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache',
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { success?: boolean }).success === false) {
    const msg = String(
      (data as { error?: string; message?: string })?.error ||
        (data as { message?: string })?.message ||
        `HTTP ${res.status}`,
    );
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchAutomationOverview(token: string): Promise<AutomationOverview> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/automation/overview`, {
    headers: authHeaders(token),
  });
  return parseJson<AutomationOverview>(res);
}

export async function fetchImportRegistry(
  token: string,
  params: { limit?: number; offset?: number; source?: string },
): Promise<{ rows: ImportRegistryRow[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit ?? 40),
    offset: String(params.offset ?? 0),
  });
  if (params.source) q.set('source', params.source);
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/automation/imports?${q}`, {
    headers: authHeaders(token),
  });
  const data = await parseJson<{ rows: ImportRegistryRow[]; total: number }>(res);
  return { rows: data.rows || [], total: Number(data.total || 0) };
}
