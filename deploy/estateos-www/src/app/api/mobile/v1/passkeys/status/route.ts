import { NextResponse } from 'next/server';
import { parseUserIdFromBearer } from '@/lib/passkeyMobileAuth';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Stan Passkey dla przełącznika w profilu (Bearer JWT). */
export async function GET(req: Request) {
  const userId = parseUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ success: false, hasPasskey: false, error: 'Brak autoryzacji' }, { status: 401 });
  }

  const hasPasskey = await userHasRegisteredPasskey(userId);
  return NextResponse.json(
    { success: true, hasPasskey, userId },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
