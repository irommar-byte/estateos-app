<<<<<<< HEAD
import { postLegalVerificationRequest } from '@/lib/mobileLegalVerificationHandlers';
=======
import {
  getOwnerLegalVerification,
  submitOwnerLegalVerification,
} from '@/lib/mobileLegalVerificationHandlers';
>>>>>>> 3eb76728 (fix(mobile-backend): restore offers stability and legal endpoint compatibility)

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

<<<<<<< HEAD
export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  return postLegalVerificationRequest(req, offerId);
=======
export async function GET(req: Request, context: RouteContext) {
  const params = await context.params;
  return getOwnerLegalVerification(req, Number(params.offerId));
}

export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  return submitOwnerLegalVerification(req, Number(params.offerId));
>>>>>>> 3eb76728 (fix(mobile-backend): restore offers stability and legal endpoint compatibility)
}
