import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runTeamDaySummaries } from '@/lib/crm/teamDaySummary';
import { remindStaleOfficeReviews } from '@/lib/crm/officeOfferReview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') || '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Co godzinę: podsumowanie dnia każdego agenta w Dzienniku zespołu (od 20:00, raz na dzień)
 * oraz przypomnienie kierownikom o prośbach o publikację czekających ponad 12 godzin.
 */
async function run(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const force = new URL(req.url).searchParams.get('force') === '1';
  const officeReminders = await remindStaleOfficeReviews().catch((error) => {
    console.warn('[team-day-summary] przypomnienia o prośbach', error);
    return 0;
  });
  const result = await runTeamDaySummaries({ force });
  return NextResponse.json({ ok: true, officeReminders, ...result });
}

export const GET = run;
export const POST = run;
