import { handleEmailChangeUnified } from '@/lib/emailChangeRoute';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleEmailChangeUnified(req);
}
