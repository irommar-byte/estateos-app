import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { buildEstateOsGuideContext } from '@/lib/estateOsGuideContext';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
  return NextResponse.json({ success: true, guide: await buildEstateOsGuideContext(userId) }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
