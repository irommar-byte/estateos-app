import { API_URL } from '../config/network';

/** Marks the logged-in mobile user as ONLINE (updates server lastLoginAt). */
export async function pingPresence(token: string | null | undefined): Promise<boolean> {
  const auth = String(token || '').trim();
  if (!auth) return false;
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/presence/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    });
    if (res.ok) return true;
    // Fallback: shared WWW endpoint (also accepts mobile Bearer after deploy).
    const fallback = await fetch(`${API_URL}/api/presence/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    });
    return fallback.ok;
  } catch {
    return false;
  }
}
