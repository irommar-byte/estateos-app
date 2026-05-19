import { Alert } from 'react-native';
import {
  isExplicitMobileOfferSaveFailure,
  persistMobileOfferUpdate,
  readMobileOfferResponseBody,
} from './mobileOfferUpdate';

/** Komunikat tylko gdy PATCH archiwizacji po finalizacji deala się nie udał. */
export function notifyOfferArchiveAfterSaleFailed(): void {
  Alert.alert(
    'Oferta nadal aktywna',
    'Sprzedaż została zamknięta w Dealroomie, ale serwer nie wycofał oferty z listy Aktywnych. Przejdź do Profilu → Moje ogłoszenia, wybierz ogłoszenie → Zarządzaj → Wycofaj.',
    [{ text: 'OK' }],
  );
}

/** Archiwizacja własnej oferty po zamknięciu sprzedaży — właścicielski kontrakt mobile. */
export async function archiveOwnOfferViaMobileAdmin(
  _apiUrl: string,
  token: string,
  offerId: number
): Promise<boolean> {
  const now = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [
    { status: 'ARCHIVED', newStatus: 'ARCHIVED', archivedAt: now },
    { status: 'SOLD', newStatus: 'SOLD', soldAt: now },
    { status: 'CLOSED', newStatus: 'CLOSED', closedAt: now },
  ];
  for (const patch of attempts) {
    const res = await persistMobileOfferUpdate({
      offerId,
      token,
      payload: { id: offerId, ...patch },
    });
    const body = await readMobileOfferResponseBody(res);
    if (!isExplicitMobileOfferSaveFailure(body, res.ok)) return true;
  }
  return false;
}

/** Archiwizacja po zamknięciu sprzedaży — zwraca sukces; przy błędzie pokazuje alert (tylko wtedy). */
export async function archiveOfferAfterSaleClosed(
  apiUrl: string,
  token: string,
  offerId: number,
): Promise<boolean> {
  const id = Number(offerId);
  if (!Number.isFinite(id) || id <= 0) return false;
  try {
    const archived = await archiveOwnOfferViaMobileAdmin(apiUrl, token, id);
    if (!archived) notifyOfferArchiveAfterSaleFailed();
    return archived;
  } catch {
    notifyOfferArchiveAfterSaleFailed();
    return false;
  }
}
