import { NextResponse } from 'next/server';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { resolveRcnAsOfDate } from '@/lib/market/asOf';
import { WARSAW_CITY } from '@/lib/market/constants';
import {
  nextScheduledRun,
  readIngestState,
  saveIngestSchedule,
  writeIngestProgress,
  type IngestSchedule,
} from '@/lib/market/ingestControl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RUN_STALE_MS = 3 * 60 * 60 * 1000;

async function buildState() {
  await ensureMarketTables();
  const [state, total, quality, byKindRows, runs, asOf] = await Promise.all([
    readIngestState(),
    prisma.marketTransaction.count(),
    prisma.marketTransaction.count({ where: { qualityOk: true } }),
    prisma.marketTransaction.groupBy({ by: ['kind'], _count: { _all: true } }),
    prisma.marketIngestRun.findMany({ orderBy: { startedAt: 'desc' }, take: 12 }),
    resolveRcnAsOfDate(WARSAW_CITY).catch(() => null),
  ]);
  const runningRow = runs.find((r) => r.status === 'RUNNING' && Date.now() - r.startedAt.getTime() < RUN_STALE_MS) || null;
  const lastFinished = runs.find((r) => r.status !== 'RUNNING') || null;
  const progress =
    state.progress && (runningRow ? state.progress.runId === runningRow.id || state.progress.runId == null : Date.now() - new Date(state.progress.updatedAt).getTime() < 10 * 60_000)
      ? state.progress
      : null;
  // Historia przyrostu: z zapisanych podsumowań, a dla starszych importów — z liczby zapisanych aktów.
  const history = state.history.length
    ? state.history
    : runs
        .filter((r) => r.status !== 'RUNNING')
        .reverse()
        .map((r) => ({
          runId: r.id,
          finishedAt: (r.finishedAt || r.startedAt).toISOString(),
          added: r.upserted,
          total: 0,
          durationSec: r.finishedAt ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000) : 0,
          status: r.status,
        }));
  return {
    success: true,
    totals: {
      records: total,
      qualityOk: quality,
      byKind: Object.fromEntries(byKindRows.map((r) => [r.kind, r._count._all])),
      dataAsOf: asOf ? asOf.toISOString() : null,
    },
    running: runningRow
      ? { runId: runningRow.id, startedAt: runningRow.startedAt.toISOString(), source: runningRow.source }
      : null,
    progress,
    lastRun: lastFinished
      ? {
          runId: lastFinished.id,
          status: lastFinished.status,
          source: lastFinished.source,
          startedAt: lastFinished.startedAt.toISOString(),
          finishedAt: lastFinished.finishedAt ? lastFinished.finishedAt.toISOString() : null,
          upserted: lastFinished.upserted,
          fetched: lastFinished.fetched,
          error: lastFinished.error ? lastFinished.error.slice(0, 300) : null,
          added: history.find((h) => h.runId === lastFinished.id)?.added ?? null,
        }
      : null,
    schedule: state.schedule,
    nextRunAt: nextScheduledRun(state.schedule, new Date(), state.lastScheduledAt)?.toISOString() ?? null,
    history: history.slice(-12),
  };
}

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json(await buildState());
  } catch (error) {
    console.error('[admin market-data]', error);
    return NextResponse.json({ success: false, message: 'Nie udało się wczytać stanu bazy.' }, { status: 500 });
  }
}

/** { action: 'run' } — uruchom aktualizację teraz; { action: 'schedule', schedule } — zapisz harmonogram. */
export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { action?: string; schedule?: Partial<IngestSchedule> };

  if (body.action === 'schedule') {
    await saveIngestSchedule(body.schedule || {});
    return NextResponse.json(await buildState());
  }

  if (body.action === 'run') {
    // Budowanie strony i import naraz nie mieszczą się w pamięci serwera.
    let building = false;
    try {
      building = execSync("pgrep -f '[n]ext build' || true").toString().trim().length > 0;
    } catch {
      building = false;
    }
    if (building) {
      return NextResponse.json({ success: false, message: 'Trwa wdrożenie strony — spróbuj za kilka minut.' }, { status: 409 });
    }
    await ensureMarketTables();
    const running = await prisma.marketIngestRun.findFirst({ where: { status: 'RUNNING' }, orderBy: { startedAt: 'desc' } });
    if (running && Date.now() - running.startedAt.getTime() < RUN_STALE_MS) {
      return NextResponse.json({ success: false, message: 'Aktualizacja już trwa.' }, { status: 409 });
    }
    if (running) {
      // Zawieszony wpis po restarcie serwera — zamykamy, żeby nie blokował nowego importu.
      await prisma.marketIngestRun.update({ where: { id: running.id }, data: { status: 'FAILED', finishedAt: new Date(), error: 'Przerwany (restart serwera).' } });
    }
    await writeIngestProgress(
      { runId: null, percent: 0, phase: 'Łączę z Rejestrem Cen Nieruchomości…', detail: 'GUGiK · Geoportal', kind: null, upserted: 0, startedAt: new Date().toISOString(), done: false },
      true,
    );
    // Osobny proces — import trwa kilkadziesiąt minut i nie może blokować serwera strony.
    const logPath = path.join(os.homedir(), 'rcn-ingest.log');
    const out = fs.openSync(logPath, 'a');
    const child = spawn('npx', ['tsx', 'scripts/ingest-rcn-market.ts', '--manual'], {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
    return NextResponse.json({ ...(await buildState()), started: true });
  }

  return NextResponse.json({ success: false, message: 'Nieznana akcja.' }, { status: 400 });
}
