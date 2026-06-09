import { NextResponse } from 'next/server';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const userId = await getAuthedUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji.' }, { status: 401 });
    }

    const events = await fetchUpcomingScheduleEvents(userId);
    return NextResponse.json({ success: true, events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[pro-widget/schedule]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
