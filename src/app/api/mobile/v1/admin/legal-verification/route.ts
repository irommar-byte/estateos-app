import {
  getAdminLegalVerificationQueue,
} from '@/lib/mobileLegalVerificationHandlers';

/**
 * GET — lista zgłoszeń (tylko ADMIN, Bearer JWT).
 * POST — (A) zgłoszenie od właściciela oferty: body { offerId, landRegistryNumber, apartmentNumber?, note? }
 *         (B) zmiana statusu przez admina: body { action: 'setStatus', id, status: 'APPROVED'|'REJECTED' }
 */
export async function GET(req: Request) {
  return getAdminLegalVerificationQueue(req);
}
