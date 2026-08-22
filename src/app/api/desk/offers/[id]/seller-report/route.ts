import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { buildSellerReport, sendSellerReportEmail } from '@/lib/desk/sellerReport';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const offerId = Number((await ctx.params).id);
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const clientId = Number(new URL(req.url).searchParams.get('clientId') || 0) || undefined;
  const report = await buildSellerReport({ offerId, agencyUserId, clientId });
  if (!report) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, report });
}

export async function POST(req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const offerId = Number((await ctx.params).id);
  const body = await req.json().catch(() => ({}));
  const clientId = Number(body.clientId);
  if (!Number.isFinite(offerId) || !Number.isFinite(clientId)) {
    return NextResponse.json({ error: 'Brak clientId.' }, { status: 400 });
  }

  const report = await buildSellerReport({ offerId, agencyUserId, clientId });
  if (!report) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }

  const client = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    select: { id: true, linkedOfferId: true },
  });
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono klienta lub brak uprawnień.' }, { status: 404 });
  }

  const sent = await sendSellerReportEmail({ clientId, agencyUserId, offerId, report });
  return NextResponse.json({ success: true, sent, report });
}
