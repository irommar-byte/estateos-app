import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';

/** Nginx/proxy often buffer until ~2 KB — pad SSE chunks so events flush immediately. */
const MIN_SSE_CHUNK_BYTES = 2048;

export function encodeKeiSseEvent(event: KeiExportProgressEvent): Uint8Array {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  if (payload.length >= MIN_SSE_CHUNK_BYTES) {
    return new TextEncoder().encode(payload);
  }
  const padLen = MIN_SSE_CHUNK_BYTES - payload.length;
  const padded = `: ${' '.repeat(Math.max(0, padLen - 3))}\n${payload}`;
  return new TextEncoder().encode(padded);
}

export const KEI_SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};
