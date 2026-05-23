import { handleEmailChangeConfirm } from '@/lib/emailChangeRoute';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleEmailChangeConfirm(req);
}
