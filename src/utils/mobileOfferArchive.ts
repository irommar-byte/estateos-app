/** Archiwizacja własnej oferty — ten sam kontrakt co „Wycofaj” w ProfileScreen (`admin/offers`). */
export async function archiveOwnOfferViaMobileAdmin(
  apiUrl: string,
  token: string,
  offerId: number
): Promise<boolean> {
  const res = await fetch(`${apiUrl}/api/mobile/v1/admin/offers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ offerId, newStatus: 'ARCHIVED' }),
  });
  return res.ok;
}
