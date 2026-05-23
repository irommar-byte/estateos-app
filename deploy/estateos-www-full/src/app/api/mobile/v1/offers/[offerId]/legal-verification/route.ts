import {
  getOwnerLegalVerification,
  submitOwnerLegalVerification,
} from '@/lib/mobileLegalVerificationHandlers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

export async function GET(req: Request, context: RouteContext) {
  const params = await context.params;
  return getOwnerLegalVerification(req, Number(params.offerId));
}

export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  return submitOwnerLegalVerification(req, Number(params.offerId));
}
