import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { prisma } from '@/lib/prisma';
import { parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      return NextResponse.json({ ok: false, message: 'Podaj e-mail.' }, { status: 422 });
    }
    const subject = parseValuationSubject(body);
    if ('error' in subject) {
      return NextResponse.json({ ok: false, message: subject.error }, { status: 422 });
    }
    const draft = await prisma.marketValuationDraft.create({
      data: {
        email,
        userId: userId || null,
        subjectJson: JSON.stringify(subject),
        listingPrice: parseLooseNumber(body.listingPrice ?? body.price),
      },
    });
    return NextResponse.json({ ok: true, draftId: draft.id });
  } catch (error) {
    console.error('[market.draft]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się zapisać szkicu wyceny.' }, { status: 500 });
  }
}
