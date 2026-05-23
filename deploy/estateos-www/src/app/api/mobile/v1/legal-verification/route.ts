import {
  getAdminLegalVerificationQueue,
} from '@/lib/mobileLegalVerificationHandlers';

export async function GET(req: Request) {
  return getAdminLegalVerificationQueue(req);
}
