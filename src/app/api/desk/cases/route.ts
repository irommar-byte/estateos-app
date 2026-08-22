import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { backfillDeskCasesForAgency } from '@/lib/desk/prospects';
import { PROSPECTING_BOARD_STAGES } from '@/lib/desk/types';

export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  await backfillDeskCasesForAgency(agencyUserId);

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const stage = url.searchParams.get('stage');
  const board = url.searchParams.get('board') === 'prospecting';

  const where: {
    agencyUserId: number;
    kind?: string;
    pipelineStage?: string | { in: string[] };
  } = { agencyUserId };

  if (kind === 'SELL' || kind === 'BUY') where.kind = kind;
  if (board) {
    where.kind = 'SELL';
    where.pipelineStage = { in: [...PROSPECTING_BOARD_STAGES] };
  } else if (stage) {
    where.pipelineStage = stage;
  }

  const cases = await prisma.deskCase.findMany({
    where,
    orderBy: [{ health: 'asc' }, { nextActionAt: 'asc' }, { updatedAt: 'desc' }],
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          type: true,
        },
      },
      tasks: {
        where: { status: 'OPEN' },
        orderBy: [{ dueAt: 'asc' }],
        take: 3,
      },
    },
    take: 200,
  });

  return NextResponse.json({ success: true, cases });
}
