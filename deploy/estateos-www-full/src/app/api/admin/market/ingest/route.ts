import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { prisma } from '@/lib/prisma';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  await ensureMarketTables();
  const last = await prisma.marketIngestRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 8,
  });
  const coverage = await prisma.marketTransaction.count({
    where: { qualityOk: true, city: 'Warszawa' },
  });
  return NextResponse.json({ ok: true, coverage, runs: last });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
  await ensureMarketTables();
  const running = await prisma.marketIngestRun.findFirst({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
  });
  if (running && Date.now() - running.startedAt.getTime() < 90 * 60 * 1000) {
    return NextResponse.json({ ok: true, started: false, message: 'Import już trwa.' });
  }

  const script = path.join(process.cwd(), 'scripts/ingest-rcn-market.ts');
  const child = spawn('npx', ['tsx', script], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  return NextResponse.json({ ok: true, started: true, pid: child.pid });
}
