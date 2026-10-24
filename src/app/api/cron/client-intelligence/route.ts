import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { tickClientIntelligence } from '@/lib/crm/clientIntelligenceRun';
import { scanFavoriteAlerts } from '@/lib/crm/portalFavorites';
import { isWithinSendWindow } from '@/lib/crm/intelligenceSchedule';
import { scanViewingReminders } from '@/lib/crm/viewingReminders';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function cronSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
}

function isAuthorized(req: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function runTick() {
  const tick = await tickClientIntelligence();
  // Alerty o ulubionych (spadek ceny, rezerwacja, nowe zdjęcia) — tylko w godzinach wysyłki.
  const favoriteAlerts = isWithinSendWindow() ? await scanFavoriteAlerts().catch(() => null) : null;
  // Przypomnienia przed potwierdzonym oglądaniem / spotkaniem (co godzinę).
  const viewingReminders = await scanViewingReminders().catch(() => null);
  return NextResponse.json({ ok: true, ...tick, favoriteAlerts, viewingReminders });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runTick();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runTick();
}
