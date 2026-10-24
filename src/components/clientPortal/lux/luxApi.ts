import { API_URL } from '../../../config/network';

/** Akcja panelu klienta (POST /api/crm/client-portal/[token]). */
export async function luxAction<T = Record<string, unknown>>(
  token: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${API_URL}/api/crm/client-portal/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error || 'Coś poszło nie tak. Spróbuj ponownie.'));
  return json as T;
}

/** Wysłanie pliku do pozycji z listy dokumentów (zdjęcie z aparatu, z galerii albo PDF). */
export async function uploadPortalDocument(
  token: string,
  itemKey: string,
  file: { uri: string; name: string; type: string },
): Promise<void> {
  const form = new FormData();
  form.append('itemKey', itemKey);
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const res = await fetch(`${API_URL}/api/crm/client-portal/${encodeURIComponent(token)}/documents`, {
    method: 'POST',
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error || 'Nie udało się wysłać pliku.'));
}
