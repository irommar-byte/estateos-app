import { API_URL } from '../config/network';

export type OutboxItem = {
  id: number;
  clientId: number;
  clientName: string;
  category: string;
  categoryLabel: string;
  channels: string[];
  recipient: string | null;
  subject: string | null;
  previewText: string | null;
  previewHtml: string | null;
  createdAt: string;
};

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json' };
}

export async function fetchOutboxItem(
  token: string,
  id: number,
): Promise<{ ok: true; item: OutboxItem } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/crm/outbox?id=${id}`, { headers: headers(token) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.item) return { ok: false, message: String(json?.error || 'Nie udało się wczytać wiadomości.') };
    return { ok: true, item: json.item as OutboxItem };
  } catch {
    return { ok: false, message: 'Brak połączenia z serwerem.' };
  }
}

export async function decideOutbox(
  token: string,
  id: number,
  action: 'approve' | 'cancel',
  options: { autoFromNow?: boolean } = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/crm/outbox`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ id, action, autoFromNow: Boolean(options.autoFromNow) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się.') };
    return { ok: true };
  } catch {
    return { ok: false, message: 'Brak połączenia z serwerem.' };
  }
}
