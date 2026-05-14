import {
  getLegalVerificationRequests,
  postLegalVerificationRequest,
} from '@/lib/mobileLegalVerificationHandlers';

export async function GET(req: Request) {
  return getLegalVerificationRequests(req);
}

export async function POST(req: Request) {
  return postLegalVerificationRequest(req);
}
