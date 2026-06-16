import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

export type MobileFetchInit = RequestInit & { timeoutMs?: number };

function mergeHeaders(init: MobileFetchInit): Record<string, string> {
  const base: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent': `EstateOS-Mobile/${Platform.OS}`,
  };
  const extra = init.headers;
  if (!extra) return base;
  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      base[key] = value;
    });
    return base;
  }
  if (Array.isArray(extra)) {
    for (const [key, value] of extra) base[key] = value;
    return base;
  }
  return { ...base, ...extra };
}

function makeJsonResponse(status: number, text: string, statusText = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    text: async () => text,
    json: async () => JSON.parse(text),
  } as Response;
}

function xhrRequest(input: string, init: MobileFetchInit): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (init.method || 'GET').toUpperCase();
  const headers = mergeHeaders(init);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => {
      xhr.abort();
      reject(new Error('Przekroczono limit czasu połączenia'));
    }, timeoutMs);

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      clearTimeout(timer);
      if (xhr.status === 0) {
        reject(new Error('Network request failed'));
        return;
      }
      resolve(makeJsonResponse(xhr.status, xhr.responseText || '', xhr.statusText));
    };

    xhr.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Network request failed'));
    };

    xhr.open(method, input, true);
    Object.entries(headers).forEach(([key, value]) => {
      try {
        xhr.setRequestHeader(key, value);
      } catch {
        // skip forbidden headers on some RN builds
      }
    });
    xhr.send(typeof init.body === 'string' ? init.body : null);
  });
}

/** Native download — stabilniejszy na Androidzie dla dużych JSON (katalog ofert ~600 KB). */
async function androidDownloadGet(input: string, init: MobileFetchInit): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cachePath = `${FileSystem.cacheDirectory ?? ''}estateos-${Date.now()}.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await FileSystem.downloadAsync(input, cachePath, {
      headers: mergeHeaders(init),
    });
    clearTimeout(timer);
    const text = await FileSystem.readAsStringAsync(cachePath);
    try {
      await FileSystem.deleteAsync(cachePath, { idempotent: true });
    } catch {
      // ignore cache cleanup errors
    }
    return makeJsonResponse(result.status, text);
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new Error('Przekroczono limit czasu połączenia');
    }
    throw err instanceof Error ? err : new Error('Network request failed');
  }
}

async function fetchOnce(input: string, init: MobileFetchInit): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, {
      ...rest,
      headers: mergeHeaders(init),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function androidGet(input: string, init: MobileFetchInit): Promise<Response> {
  const attempts: Array<() => Promise<Response>> = [
    () => androidDownloadGet(input, init),
    () => fetchOnce(input, init),
    () => xhrRequest(input, init),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Network request failed');
}

/** Release Android: retry + fallbacki (download / XHR) — RN fetch bywa niestabilny. */
export async function mobileFetch(input: string, init: MobileFetchInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();

  if (Platform.OS === 'android' && method === 'GET') {
    return androidGet(input, init);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchOnce(input, init);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Network request failed');
}

export async function mobileFetchJson<T = unknown>(
  input: string,
  init: MobileFetchInit = {},
): Promise<{ response: Response; data: T | null }> {
  const response = await mobileFetch(input, init);
  const text = await response.text().catch(() => '');
  if (!text) return { response, data: null };
  try {
    return { response, data: JSON.parse(text) as T };
  } catch {
    return { response, data: null };
  }
}
