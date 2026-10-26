export type ClientProgress = { stage: string; label: string; detail?: string; percent: number };

/**
 * Wysyła żądanie z prośbą o strumień postępu i czyta kolejne linie NDJSON.
 * Gdy serwer odpowie zwykłym JSON-em (starsza wersja), działa jak zwykły fetch.
 */
export async function fetchWithProgress(
  url: string,
  init: RequestInit,
  onProgress: (progress: ClientProgress) => void,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers || {});
  headers.set('x-eos-progress', 'ndjson');
  const res = await fetch(url, { ...init, headers });
  const type = res.headers.get('content-type') || '';
  if (!type.includes('ndjson') || !res.body) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, body };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { status: number; body: Record<string, unknown> } | null = null;
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      if (event.type === 'progress') {
        onProgress({
          stage: String(event.stage || ''),
          label: String(event.label || ''),
          detail: event.detail ? String(event.detail) : undefined,
          percent: Math.max(0, Math.min(100, Number(event.percent) || 0)),
        });
      } else if (event.type === 'result') {
        result = { status: Number(event.status) || 500, body: (event.body || {}) as Record<string, unknown> };
      }
    } catch {
      /* niepełna linia */
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(handleLine);
  }
  if (buffer) handleLine(buffer);
  return result ?? { status: 502, body: { error: 'Połączenie przerwane — sprawdź w „Moje oferty”, czy oferta powstała.' } };
}
