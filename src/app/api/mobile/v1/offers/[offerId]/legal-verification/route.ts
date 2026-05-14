import { postLegalVerificationRequest } from '@/lib/mobileLegalVerificationHandlers';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  return postLegalVerificationRequest(req, offerId);
}
