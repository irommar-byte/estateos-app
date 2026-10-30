'use client';

/** Miniatura 384 px z dowolnego obrazka w przeglądarce (blob: lub nasz /uploads) — do podpowiedzi AI. */
async function thumbDataUrl(src: string): Promise<string | null> {
  try {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('img'));
      img.src = src;
    });
    const scale = Math.min(1, 384 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

/** „To wygląda na kuchnię” — podpowiedzi dla zdjęć (klucz = src). Zdjęcia z serwera idą adresem, lokalne miniaturą. */
export async function fetchPhotoRoomSuggestions(srcs: string[], rooms: string[]): Promise<Record<string, string>> {
  if (!srcs.length) return {};
  const images = await Promise.all(
    srcs.map(async (src, i) => {
      const isServer = /^\/uploads\//.test(src) || /^https:\/\/(www\.)?estateos\.pl\/uploads\//.test(src);
      if (isServer) return { id: String(i), url: src };
      const dataUrl = await thumbDataUrl(src);
      return dataUrl ? { id: String(i), dataUrl } : null;
    }),
  );
  const payload = images.filter(Boolean);
  if (!payload.length) return {};
  const res = await fetch('/api/ai/photo-rooms', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: payload, rooms }),
  });
  if (!res.ok) return {};
  const json = (await res.json().catch(() => ({}))) as { items?: Array<{ id: string; room: string | null; confidence: number }> };
  const out: Record<string, string> = {};
  for (const item of json.items || []) {
    const src = srcs[Number(item.id)];
    if (src && item.room && item.confidence >= 0.45) out[src] = item.room;
  }
  return out;
}
