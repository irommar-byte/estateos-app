export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { readJson } from '@/lib/mobileApiAuth';
import { ensureMobileUgcTables, ensureAdminReportColumns } from '@/lib/mobileUgcTables';

const STATUSES = new Set(['PENDING', 'IN_REVIEW', 'ACTIONED', 'DISMISSED']);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const { id: rawId } = await ctx.params;
  const reportId = String(rawId ?? '').trim();
  if (!/^\d+$/.test(reportId)) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID zgłoszenia' }, { status: 400 });
  }

  try {
    await ensureMobileUgcTables();
    await ensureAdminReportColumns();

    const body = await readJson(req);
    const nextStatus = body?.status != null ? String(body.status).trim().toUpperCase() : null;
    const adminNote =
      body?.adminNote != null
        ? String(body.adminNote).slice(0, 5000)
        : body?.resolutionNote != null
          ? String(body.resolutionNote).slice(0, 5000)
          : null;

    if (nextStatus && !STATUSES.has(nextStatus)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy status' }, { status: 400 });
    }

    const existing = (await prisma.$queryRawUnsafe(
      `SELECT id, status FROM MobileContentReport WHERE id = ? LIMIT 1`,
      reportId
    )) as Array<{ id: bigint | number; status: string }>;

    if (!existing.length) {
      return NextResponse.json({ success: false, message: 'Zgłoszenie nie istnieje' }, { status: 404 });
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (nextStatus) {
      sets.push('status = ?');
      params.push(nextStatus);
    }
    if (adminNote !== null) {
      sets.push('adminNote = ?');
      params.push(adminNote);
    }
    sets.push('reviewerId = ?');
    params.push(gate.adminId);

    if (!sets.length) {
      return NextResponse.json({ success: false, message: 'Brak zmian' }, { status: 400 });
    }

    params.push(reportId);
    await prisma.$executeRawUnsafe(
      `UPDATE MobileContentReport SET ${sets.join(', ')} WHERE id = ?`,
      ...params
    );

    return NextResponse.json({ success: true, id: reportId, status: nextStatus ?? existing[0].status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
