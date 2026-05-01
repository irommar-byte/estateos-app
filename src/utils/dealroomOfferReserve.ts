import { API_URL } from '../config/network';

/** Zmiana statusu oferty na PENDING (oczekujące) po rezerwacji — PUT jak w edycji oferty. */
export async function setOfferStatusPending(params: {
  offerId: number;
  userId: number;
  token: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { offerId, userId, token } = params;
  const safeToken = token?.trim();
  if (!safeToken || !offerId || !userId) return { ok: false, error: 'Brak danych' };

  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${userId}`, {
      headers: { Authorization: `Bearer ${safeToken}` },
    });
    const data = await res.json().catch(() => ({}));
    const offers = Array.isArray(data?.offers) ? data.offers : [];
    const offer = offers.find((o: any) => Number(o?.id) === Number(offerId));
    if (!offer) return { ok: false, error: 'Nie znaleziono oferty' };

    const updatePayload = {
      ...offer,
      id: offerId,
      userId,
      status: 'PENDING',
    };

    const putRes = await fetch(`${API_URL}/api/mobile/v1/offers`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${safeToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    const putData = await putRes.json().catch(() => ({}));
    if (!putRes.ok || putData?.success === false) {
      return { ok: false, error: putData?.message || putData?.error || 'Serwer odrzucił zmianę statusu' };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Błąd sieci' };
  }
}

export async function postDealroomTextMessage(params: {
  dealId: number;
  token: string | null;
  content: string;
}): Promise<boolean> {
  const { dealId, token, content } = params;
  const safeToken = token?.trim();
  if (!safeToken || !dealId || !content.trim()) return false;
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${safeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: content.trim() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
