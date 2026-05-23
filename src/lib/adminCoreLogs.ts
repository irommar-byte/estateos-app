import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { isControlEnabled, readPm2RuntimePublic } from '@/lib/adminCoreControl';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

const PM2_APP_NAME = (process.env.ADMIN_CORE_PM2_NAME || 'nieruchomosci').trim();
const PM2_LOG_DIR = path.join(os.homedir(), '.pm2', 'logs');

function tailLogFile(filePath: string, lines: number): string {
  try {
    return execSync(`tail -n ${lines} ${JSON.stringify(filePath)} 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 512 * 1024,
    });
  } catch {
    return '';
  }
}

export function readPm2LogTail(maxLines = 100): string {
  try {
    const out = execSync(
      `pm2 logs ${JSON.stringify(PM2_APP_NAME)} --nostream --lines ${maxLines} --raw 2>&1`,
      { encoding: 'utf8', timeout: 6000, maxBuffer: 1024 * 1024 },
    );
    if (out.trim()) return out;
  } catch {
    /* fallback */
  }

  const perFile = Math.max(20, Math.floor(maxLines / 2));
  const outPath = path.join(PM2_LOG_DIR, `${PM2_APP_NAME}-out.log`);
  const errPath = path.join(PM2_LOG_DIR, `${PM2_APP_NAME}-error.log`);
  const stdout = tailLogFile(outPath, perFile);
  const stderr = tailLogFile(errPath, perFile);
  const chunks = [
    stderr ? `--- stderr ---\n${stderr}` : '',
    stdout ? `--- stdout ---\n${stdout}` : '',
  ].filter(Boolean);
  return chunks.join('\n\n') || 'Brak logów PM2.';
}

export async function handleAdminCoreLogsGET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  if (!isControlEnabled()) {
    return NextResponse.json(
      { success: false, message: 'Logi CORE wyłączone.' },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  const url = new URL(req.url);
  const lines = Math.min(200, Math.max(20, Number(url.searchParams.get('lines') || 80)));

  return NextResponse.json(
    {
      success: true,
      logs: readPm2LogTail(lines),
      pm2: readPm2RuntimePublic(),
      lines,
      collectedAt: new Date().toISOString(),
    },
    { headers: NO_CACHE_HEADERS },
  );
}
