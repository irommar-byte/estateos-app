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
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'OPEN';

  const tasks = await prisma.deskTask.findMany({
    where: {
      agencyUserId,
      ...(status === 'ALL' ? {} : { status }),
    },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { id: 'desc' }],
    take: 100,
    include: {
      case: { select: { id: true, title: true, pipelineStage: true, health: true } },
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });

  return NextResponse.json({ success: true, tasks });
}

export async function PATCH(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const body = await req.json().catch(() => ({}));
  const taskId = Number(body.id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: 'Brak ID zadania.' }, { status: 400 });
  }

  const task = await prisma.deskTask.findFirst({
    where: { id: taskId, agencyUserId },
  });
  if (!task) {
    return NextResponse.json({ error: 'Nie znaleziono zadania.' }, { status: 404 });
  }

  const status = String(body.status || 'DONE').toUpperCase();
  const updated = await prisma.deskTask.update({
    where: { id: taskId },
    data: {
      status: status === 'OPEN' ? 'OPEN' : status === 'CANCELLED' ? 'CANCELLED' : 'DONE',
      completedAt: status === 'OPEN' ? null : new Date(),
    },
  });

  return NextResponse.json({ success: true, task: updated });
}
