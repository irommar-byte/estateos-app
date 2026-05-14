import {
  getAdminLegalVerificationQueue,
} from '@/lib/mobileLegalVerificationHandlers';

/**
 * GET — lista zgłoszeń (tylko ADMIN, Bearer JWT).
 */
export async function GET(req: Request) {
  return getAdminLegalVerificationQueue(req);
}
