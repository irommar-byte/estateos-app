export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { ensureMobileUgcTables, ensureAdminReportColumns } from '@/lib/mobileUgcTables';

const STATUSES = new Set(['PENDING', 'IN_REVIEW', 'ACTIONED', 'DISMISSED', 'ARCHIVED']);
const TARGET_TYPES = new Set(['OFFER', 'USER', 'ALL']);

function rowToDto(row: Record<string, unknown>) {
  const id = String(row.id ?? '');
  const targetType = String(row.targetType ?? 'USER').toUpperCase();
  const offerId = row.offerId != null ? Number(row.offerId) : null;
  const reportedUserId =
    row.reportedUserId != null
      ? Number(row.reportedUserId)
      : targetType === 'USER' && row.targetId
        ? Number(row.targetId)
        : null;

  return {
    id,
    status: String(row.status ?? 'PENDING'),
    category: String(row.category ?? 'OTHER'),
    reason: row.reason != null ? String(row.reason) : null,
    adminNote: row.adminNote != null ? String(row.adminNote) : null,
    targetType,
    targetId: row.targetId != null ? String(row.targetId) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ''),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ''),
    reporter: {
      id: Number(row.reporterUserId),
      name: row.reporterName != null ? String(row.reporterName) : null,
      email: row.reporterEmail != null ? String(row.reporterEmail) : null,
      phone: row.reporterPhone != null ? String(row.reporterPhone) : null,
    },
    reportedUser:
      reportedUserId && Number.isFinite(reportedUserId)
        ? {
            id: reportedUserId,
            name: row.reportedUserName != null ? String(row.reportedUserName) : null,
            email: row.reportedUserEmail != null ? String(row.reportedUserEmail) : null,
          }
        : null,
    offer:
      offerId && Number.isFinite(offerId)
        ? {
            id: offerId,
            title: row.offerTitle != null ? String(row.offerTitle) : null,
            status: row.offerStatus != null ? String(row.offerStatus) : null,
            street: row.offerStreet != null ? String(row.offerStreet) : null,
            owner: {
              id: row.offerOwnerId != null ? Number(row.offerOwnerId) : null,
              name: row.offerOwnerName != null ? String(row.offerOwnerName) : null,
              email: row.offerOwnerEmail != null ? String(row.offerOwnerEmail) : null,
            },
          }
        : null,
  };
}

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    await ensureMobileUgcTables();
    await ensureAdminReportColumns();

    const { searchParams } = new URL(req.url);
    const rawStatus = String(searchParams.get('status') ?? 'PENDING').toUpperCase();
    const status = rawStatus === 'ALL' ? 'ALL' : STATUSES.has(rawStatus) ? rawStatus : 'PENDING';
    const rawTarget = String(searchParams.get('targetType') ?? 'ALL').toUpperCase();
    const targetType = TARGET_TYPES.has(rawTarget) ? rawTarget : 'ALL';

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (status === 'ARCHIVED') {
      conditions.push(`r.status IN ('ACTIONED', 'DISMISSED')`);
    } else if (status !== 'ALL') {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (targetType !== 'ALL') {
      conditions.push('r.targetType = ?');
      params.push(targetType);
    }

    const whereSql = conditions.join(' AND ');

    const rows = (await prisma.$queryRawUnsafe(
      `
        SELECT
          r.id, r.reporterUserId, r.targetType, r.targetId, r.reportedUserId,
          r.category, r.reason, r.status, r.adminNote, r.reviewerId,
          r.createdAt, r.updatedAt,
          rep.name AS reporterName, rep.email AS reporterEmail, rep.phone AS reporterPhone,
          targ.name AS reportedUserName, targ.email AS reportedUserEmail,
          o.id AS offerId, o.title AS offerTitle, o.status AS offerStatus,
          o.street AS offerStreet, o.userId AS offerOwnerId,
          own.name AS offerOwnerName, own.email AS offerOwnerEmail
        FROM MobileContentReport r
        LEFT JOIN User rep ON rep.id = r.reporterUserId
        LEFT JOIN User targ ON targ.id = COALESCE(r.reportedUserId, CASE WHEN r.targetType = 'USER' THEN CAST(r.targetId AS UNSIGNED) END)
        LEFT JOIN Offer o ON r.targetType = 'OFFER' AND o.id = CAST(r.targetId AS UNSIGNED)
        LEFT JOIN User own ON own.id = o.userId
        WHERE ${whereSql}
        ORDER BY r.createdAt DESC
        LIMIT 250
      `,
      ...params
    )) as Record<string, unknown>[];

    const countRows = (await prisma.$queryRawUnsafe(`
      SELECT status, COUNT(*) AS cnt
      FROM MobileContentReport
      GROUP BY status
    `)) as Array<{ status: string; cnt: bigint | number }>;

    const counts = { pending: 0, inReview: 0, actioned: 0, dismissed: 0, total: 0 };
    for (const c of countRows) {
      const n = Number(c.cnt);
      counts.total += n;
      const s = String(c.status).toUpperCase();
      if (s === 'PENDING') counts.pending = n;
      else if (s === 'IN_REVIEW') counts.inReview = n;
      else if (s === 'ACTIONED') counts.actioned = n;
      else if (s === 'DISMISSED') counts.dismissed = n;
    }

    return NextResponse.json({
      success: true,
      reports: rows.map(rowToDto),
      counts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
