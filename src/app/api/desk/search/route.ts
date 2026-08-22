import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';

export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const q = new URL(req.url).searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({
      success: true,
      people: [],
      cases: [],
      offers: [],
      tasks: [],
    });
  }

  const digits = q.replace(/\D/g, '');
  const priceCandidate = Number(q.replace(/\s/g, '').replace(',', '.'));

  const [people, cases, offers, tasks, deals, presentations] = await Promise.all([
    prisma.agencyClient.findMany({
      where: {
        agencyUserId,
        status: 'ACTIVE',
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          ...(digits.length >= 6 ? [{ phone: { contains: digits } }, { phone: { contains: q } }] : []),
        ],
      },
      take: 12,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        type: true,
        deskCases: {
          take: 2,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, kind: true, pipelineStage: true },
        },
      },
    }),
    prisma.deskCase.findMany({
      where: {
        agencyUserId,
        OR: [
          { title: { contains: q } },
          { sourceUrl: { contains: q } },
          { nextAction: { contains: q } },
          { client: { firstName: { contains: q } } },
          { client: { lastName: { contains: q } } },
        ],
      },
      take: 12,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.offer.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { street: { contains: q } },
          { city: { contains: q } },
          { district: { contains: q } },
          ...(Number.isFinite(priceCandidate) && priceCandidate > 1000
            ? [{ pricePln: { gte: priceCandidate * 0.98, lte: priceCandidate * 1.02 } }]
            : []),
        ],
        AND: [{ userId: agencyUserId }],
      },
      take: 12,
      select: {
        id: true,
        title: true,
        street: true,
        city: true,
        district: true,
        pricePln: true,
        status: true,
      },
    }),
    prisma.deskTask.findMany({
      where: {
        agencyUserId,
        status: 'OPEN',
        title: { contains: q },
      },
      take: 10,
      select: { id: true, title: true, dueAt: true, caseId: true, priority: true },
    }),
    prisma.deal.findMany({
      where: {
        sellerId: agencyUserId,
        offer: {
          OR: [{ title: { contains: q } }, { city: { contains: q } }],
        },
      },
      take: 8,
      select: {
        id: true,
        status: true,
        offer: { select: { id: true, title: true } },
      },
    }),
    prisma.agencyClientActivity.findMany({
      where: {
        agencyUserId,
        kind: { in: ['PRESENTATION_PROPOSED', 'PRESENTATION_CONFIRMED', 'DESK_DEBRIEF'] },
        OR: [{ title: { contains: q } }, { body: { contains: q } }],
      },
      take: 8,
      select: { id: true, title: true, clientId: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    people,
    cases,
    offers,
    tasks,
    deals,
    presentations: presentations.map((p) => ({
      id: p.id,
      title: p.title,
      clientId: p.clientId,
      at: p.createdAt.toISOString(),
    })),
  });
}
