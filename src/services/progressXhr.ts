export type XhrProgress = { stage: string; label: string; detail?: string; percent: number };

/**
 * POST z prośbą o strumień postępu (NDJSON). `fetch` w React Native nie czyta strumieni,
 * więc korzystamy z XMLHttpRequest, który przyrostowo udostępnia `responseText`.
 * Starszy serwer odpowie zwykłym JSON-em — wtedy zwracamy go bez zmian.
 */
export function postWithProgress(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  onProgress: (progress: XhrProgress) => void,
  timeoutMs = 180_000,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let consumed = 0;
    let result: { status: number; body: Record<string, unknown> } | null = null;

    const consume = () => {
      const text = xhr.responseText || '';
      const isStream = (xhr.getResponseHeader('content-type') || '').includes('ndjson');
      if (!isStream) return;
      const chunk = text.slice(consumed);
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline < 0) return;
      consumed += lastNewline + 1;
      for (const line of chunk.slice(0, lastNewline).split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
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
      }
    };

    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-eos-progress', 'ndjson');
    xhr.onprogress = consume;
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3) consume();
    };
    xhr.onload = () => {
      consume();
      if (result) return resolve(result);
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(xhr.responseText || '{}');
      } catch {
        parsed = {};
      }
      resolve({ status: xhr.status, body: parsed });
    };
    xhr.onerror = () => resolve(result ?? { status: 0, body: { message: 'Brak połączenia z serwerem.' } });
    xhr.ontimeout = () => resolve(result ?? { status: 408, body: { message: 'Serwer odpowiada zbyt długo.' } });
    xhr.send(JSON.stringify(body));
  });
}
