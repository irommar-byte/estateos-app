const IMPROVMX_API_BASE = "https://api.improvmx.com/v3";

export type ImprovMxAlias = {
  id?: number;
  alias: string;
  forward?: string;
};

function getApiKey(): string | null {
  const key = String(process.env.IMPROVMX_API_KEY || "").trim();
  return key || null;
}

export function isImprovMxConfigured(): boolean {
  return Boolean(getApiKey());
}

async function improvMxRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, error: "IMPROVMX_NOT_CONFIGURED" };
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${IMPROVMX_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as T & { success?: boolean; error?: string; errors?: unknown };
  if (!res.ok || data?.success === false) {
    const message =
      (typeof data?.error === "string" && data.error) ||
      (res.status === 404 ? "NOT_FOUND" : `IMPROVMX_HTTP_${res.status}`);
    return { ok: false, status: res.status, data, error: message };
  }
  return { ok: true, status: res.status, data, error: null };
}

export async function improvMxGetAlias(
  domain: string,
  alias: string,
): Promise<{ exists: boolean; error?: string }> {
  const result = await improvMxRequest<{ alias?: ImprovMxAlias }>("GET", `/domains/${domain}/aliases/${encodeURIComponent(alias)}`);
  if (result.status === 0 && result.error === "IMPROVMX_NOT_CONFIGURED") {
    return { exists: false, error: "IMPROVMX_NOT_CONFIGURED" };
  }
  if (result.status === 404) return { exists: false };
  if (!result.ok) return { exists: false, error: result.error || "IMPROVMX_ERROR" };
  return { exists: Boolean(result.data?.alias || result.ok) };
}

export async function improvMxCreateAlias(
  domain: string,
  alias: string,
  forward: string,
): Promise<{ id: number | null; error?: string }> {
  const result = await improvMxRequest<{ alias?: ImprovMxAlias }>("POST", `/domains/${domain}/aliases`, {
    alias,
    forward,
  });
  if (!result.ok) {
    return { id: null, error: result.error || "IMPROVMX_CREATE_FAILED" };
  }
  return { id: Number(result.data?.alias?.id || 0) || null };
}

export async function improvMxDeleteAlias(domain: string, alias: string): Promise<void> {
  await improvMxRequest("DELETE", `/domains/${domain}/aliases/${encodeURIComponent(alias)}`);
}
