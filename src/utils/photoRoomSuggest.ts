import * as ImageManipulator from 'expo-image-manipulator';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';

/**
 * „To wygląda na kuchnię” — podpowiedzi AI dla zdjęć oferty (klucz = URI zdjęcia).
 * Lokalne zdjęcia idą jako miniatury 384 px (szybko i tanio), zdjęcia z serwera — adresem.
 */
export async function fetchPhotoRoomSuggestions(uris: string[], rooms: string[]): Promise<Record<string, string>> {
  const token = useAuthStore.getState().token;
  if (!token || !uris.length) return {};
  const images = await Promise.all(
    uris.slice(0, 40).map(async (uri, index) => {
      const serverPath = uri.startsWith(API_URL) ? uri.slice(API_URL.length) : uri;
      if (serverPath.startsWith('/uploads/')) return { id: String(index), url: serverPath };
      try {
        const thumb = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 384 } }], {
          compress: 0.68,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        return thumb.base64 ? { id: String(index), dataUrl: `data:image/jpeg;base64,${thumb.base64}` } : null;
      } catch {
        return null;
      }
    }),
  );
  const payload = images.filter(Boolean);
  if (!payload.length) return {};
  try {
    const res = await fetch(`${API_URL}/api/ai/photo-rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: payload, rooms }),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { items?: Array<{ id: string; room: string | null; confidence: number }> };
    const out: Record<string, string> = {};
    for (const item of json.items || []) {
      const uri = uris[Number(item.id)];
      if (uri && item.room && item.confidence >= 0.45) out[uri] = item.room;
    }
    return out;
  } catch {
    return {};
  }
}
