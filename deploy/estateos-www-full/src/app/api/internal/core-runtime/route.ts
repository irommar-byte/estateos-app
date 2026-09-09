import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readRuntimePerformance } from '@/lib/runtimePerformance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function authorized(req: Request) {
  const expected = process.env.CORE_GUARD_TOKEN || process.env.CRON_SECRET || '';
  const provided = req.headers.get('x-core-guard-token') || '';
  if (!expected || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const runtime = readRuntimePerformance();
  return NextResponse.json(
    {
      ok: true,
      runtime: {
        pid: runtime.pid,
        rssBytes: runtime.memory.rssBytes,
        heapUsedBytes: runtime.memory.heapUsedBytes,
        externalBytes: runtime.memory.externalBytes,
        eventLoopP95Ms: runtime.eventLoop.p95Ms,
        eventLoopP99Ms: runtime.eventLoop.p99Ms,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
