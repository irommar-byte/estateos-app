import { approveLegalVerification } from '@/lib/mobileLegalVerificationHandlers';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  return approveLegalVerification(req, Number(params.offerId));
}
