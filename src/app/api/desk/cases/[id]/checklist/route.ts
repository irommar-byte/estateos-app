import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { listChecklistTasks } from '@/lib/desk/checklistEngine';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(_req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const caseId = Number((await ctx.params).id);
  if (!Number.isFinite(caseId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID.' }, { status: 400 });
  }

  const deskCase = await prisma.deskCase.findFirst({
    where: { id: caseId, agencyUserId },
    select: { id: true },
  });
  if (!deskCase) {
    return NextResponse.json({ error: 'Nie znaleziono sprawy.' }, { status: 404 });
  }

  const items = await listChecklistTasks(caseId);
  return NextResponse.json({ success: true, items });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const caseId = Number((await ctx.params).id);
  const body = await req.json().catch(() => ({}));
  const taskId = Number(body.taskId);
  if (!Number.isFinite(caseId) || !Number.isFinite(taskId)) {
    return NextResponse.json({ error: 'Brak taskId.' }, { status: 400 });
  }

  const task = await prisma.deskTask.findFirst({
    where: { id: taskId, caseId, agencyUserId, trigger: 'CHECKLIST' },
  });
  if (!task) {
    return NextResponse.json({ error: 'Nie znaleziono pozycji checklisty.' }, { status: 404 });
  }

  const done = body.done !== false;
  const updated = await prisma.deskTask.update({
    where: { id: taskId },
    data: {
      status: done ? 'DONE' : 'OPEN',
      completedAt: done ? new Date() : null,
    },
  });

  if (done && task.clientId) {
    await prisma.agencyClientActivity.create({
      data: {
        clientId: task.clientId,
        agencyUserId,
        kind: 'DESK_CHECKLIST',
        title: `Checklist: ${task.title}`,
        body: 'Ukończone',
        metadata: { taskId, caseId },
      },
    }).catch(() => null);
  }

  return NextResponse.json({ success: true, task: updated });
}
