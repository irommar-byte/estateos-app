export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { ensureMobileUgcTables } from '@/lib/mobileUgcTables';

const CATEGORIES = new Set(['SPAM', 'SCAM', 'HARASSMENT', 'ILLEGAL_CONTENT', 'MISLEADING_OFFER', 'OTHER']);

export async function POST(req: Request) {
  const userId = mobileBearerUserId(req);
  if (!userId) return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });

  const body = await readJson(req);
  const targetType = String(body?.targetType ?? body?.type ?? 'USER').trim().toUpperCase().slice(0, 32);
  const targetId = body?.targetId != null ? String(body.targetId).slice(0, 191) : null;
  const reportedUserIdRaw = Number(body?.reportedUserId ?? body?.userId ?? body?.targetUserId);
  const reportedUserId = Number.isFinite(reportedUserIdRaw) && reportedUserIdRaw > 0 ? reportedUserIdRaw : null;
  const rawCategory = String(body?.category ?? body?.reasonCode ?? 'OTHER').trim().toUpperCase();
  const category = CATEGORIES.has(rawCategory) ? rawCategory : 'OTHER';
  const reason = body?.reasonText ?? body?.reason ?? body?.message ?? null;

  if (!targetId && !reportedUserId) {
    return NextResponse.json({ success: false, message: 'Brak obiektu zgłoszenia' }, { status: 400 });
  }

  await ensureMobileUgcTables();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO MobileContentReport (reporterUserId, targetType, targetId, reportedUserId, category, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    userId,
    targetType || 'USER',
    targetId,
    reportedUserId,
    category,
    reason ? String(reason).slice(0, 5000) : null
  );

  return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
