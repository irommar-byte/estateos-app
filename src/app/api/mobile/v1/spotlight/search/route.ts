import { NextResponse } from 'next/server';
import { extractMobileTokenFromRequest, parseMobileUserId } from '@/lib/mobileAuth';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { runSpotlightSearch } from '@/lib/spotlightSearch';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (!q) {
      return NextResponse.json({ success: true, results: [], sections: [], tookMs: 0 });
    }

    const token = extractMobileTokenFromRequest(req);
    let viewerUserId: number | null = null;
    if (token) {
      const payload = verifyMobileToken(token);
      viewerUserId = parseMobileUserId(payload);
    }

    const payload = await runSpotlightSearch(q, viewerUserId);
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('[MOBILE SPOTLIGHT SEARCH]', error);
    return NextResponse.json({ success: false, results: [], sections: [], tookMs: 0 }, { status: 500 });
  }
}
