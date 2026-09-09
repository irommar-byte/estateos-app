import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { readPm2RuntimePublic } from '@/lib/adminCoreControl';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export const CORE_LOG_APP_NAMES = [
  'nieruchomosci',
  'lineage-movies-downloader',
  'lineage-movies-proxy',
  'partner-growth-nurture',
  'reviews-finalization-fallback',
  'kei-import-worker',
  'estateos-core-guard',
  'client-intelligence',
  'seller-marketing-renewals',
  'rcn-market-ingest',
] as const;

export type CoreLogAppName = (typeof CORE_LOG_APP_NAMES)[number];
export type CoreLogStream = 'out' | 'error' | 'both';

const PM2_LOG_DIR = path.join(os.homedir(), '.pm2', 'logs');
const NAME_SET = new Set<string>(CORE_LOG_APP_NAMES);

export function parseCoreLogQuery(searchParams: URLSearchParams) {
  const rawName = String(searchParams.get('name') || 'nieruchomosci').trim();
  const name: CoreLogAppName = NAME_SET.has(rawName) ? (rawName as CoreLogAppName) : 'nieruchomosci';
  const rawStream = String(searchParams.get('stream') || 'both').trim();
  const stream: CoreLogStream = rawStream === 'out' || rawStream === 'error' ? rawStream : 'both';
  const parsed = Number(searchParams.get('lines') || 200);
  const lines = Math.min(500, Math.max(20, Number.isFinite(parsed) ? Math.floor(parsed) : 200));
  return { name, stream, lines };
}

function tailLogFile(filePath: string, lines: number): string {
  try {
    return execSync(`tail -n ${lines} ${JSON.stringify(filePath)} 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function logFilesFor(name: string, kind: 'out' | 'error'): string[] {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(PM2_LOG_DIR);
  } catch {
    return [];
  }
  const exact = `${name}-${kind}.log`;
  const prefix = `${name}-${kind}-`;
  return entries
    .filter((file) => file === exact || (file.startsWith(prefix) && file.endsWith('.log')))
    .map((file) => path.join(PM2_LOG_DIR, file));
}

export function readPm2AppLogTail(name: CoreLogAppName, stream: CoreLogStream, maxLines: number): string {
  const kinds: Array<'out' | 'error'> = stream === 'both' ? ['error', 'out'] : [stream];
  const perFile = stream === 'both' ? Math.max(20, Math.floor(maxLines / 2)) : maxLines;
  const chunks: string[] = [];
  for (const kind of kinds) {
    const files = logFilesFor(name, kind);
    const body = files
      .map((file) => tailLogFile(file, perFile).trim())
      .filter(Boolean)
      .join('\n');
    if (!body) continue;
    chunks.push(stream === 'both' ? `--- ${kind} ---\n${body}` : body);
  }
  return chunks.join('\n\n') || 'Brak logów PM2 dla tego procesu.';
}

/** @deprecated use readPm2AppLogTail — kept for older callers */
export function readPm2LogTail(maxLines = 100): string {
  return readPm2AppLogTail('nieruchomosci', 'both', maxLines);
}

export async function handleAdminCoreLogsGET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const query = parseCoreLogQuery(url.searchParams);
  const logs = readPm2AppLogTail(query.name, query.stream, query.lines);

  return NextResponse.json(
    {
      success: true,
      logs,
      name: query.name,
      stream: query.stream,
      lines: query.lines,
      apps: CORE_LOG_APP_NAMES,
      pm2: readPm2RuntimePublic(),
      collectedAt: new Date().toISOString(),
    },
    { headers: NO_CACHE_HEADERS },
  );
}
