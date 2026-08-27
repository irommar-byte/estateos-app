import { NextResponse } from 'next/server';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';
import { runSpotlightSearch } from '@/lib/spotlightSearch';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (!q) {
      return NextResponse.json({ success: true, results: [] });
    }

    const viewerUserId = await getAuthedUserIdFromRequest(req);
    const results = await runSpotlightSearch(q, viewerUserId);

    return NextResponse.json(
      { success: true, results },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('[SPOTLIGHT SEARCH]', error);
    return NextResponse.json({ success: false, results: [] }, { status: 500 });
  }
}
