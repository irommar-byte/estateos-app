import { NextResponse } from 'next/server';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';
import { getPendingPresentationStep } from '@/lib/appointments/presentationFlowPending';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userId = await getAuthedUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ success: true, step: null });
    }

    const pending = await getPendingPresentationStep(userId);
    if (!pending) {
      return NextResponse.json({ success: true, step: null });
    }

    return NextResponse.json({ success: true, ...pending });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
