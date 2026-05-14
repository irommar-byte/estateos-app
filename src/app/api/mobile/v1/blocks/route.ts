export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { ensureMobileUgcTables } from '@/lib/mobileUgcTables';

export async function GET(req: Request) {
  const userId = mobileBearerUserId(req);
  if (!userId) return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });

  await ensureMobileUgcTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, blockedUserId, reason, createdAt FROM MobileUserBlock WHERE blockerUserId = ? ORDER BY createdAt DESC`,
    userId
  );
  return NextResponse.json({ success: true, blocks: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const userId = mobileBearerUserId(req);
  if (!userId) return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });

  const body = await readJson(req);
  const blockedUserId = Number(body?.blockedUserId ?? body?.userId ?? body?.targetUserId);
  if (!Number.isFinite(blockedUserId) || blockedUserId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy użytkownik do zablokowania' }, { status: 400 });
  }
  if (blockedUserId === userId) {
    return NextResponse.json({ success: false, message: 'Nie można zablokować własnego konta' }, { status: 400 });
  }

  await ensureMobileUgcTables();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO MobileUserBlock (blockerUserId, blockedUserId, reason)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE reason = VALUES(reason)
    `,
    userId,
    blockedUserId,
    body?.reason ? String(body.reason).slice(0, 191) : null
  );

  return NextResponse.json({ success: true, blockedUserId }, { headers: { 'Cache-Control': 'no-store' } });
}
