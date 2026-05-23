import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';

export type AdminCoreControlState = 'starting' | 'stopping' | 'online' | 'offline';
export type Pm2Runtime = 'online' | 'stopped' | 'launching' | 'stopping' | 'unknown';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

const PM2_APP_NAME = (process.env.ADMIN_CORE_PM2_NAME || 'nieruchomosci').trim();
const OFFLINE_FLAG_PATH =
  process.env.ADMIN_CORE_OFFLINE_FLAG_PATH || path.join(process.cwd(), '.admin-core-offline');

export function isControlEnabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    String(process.env.ADMIN_CORE_CONTROL_ENABLED || '').trim().toLowerCase(),
  );
}

export function isAdminCoreOfflineFlagSet(): boolean {
  try {
    return fs.existsSync(OFFLINE_FLAG_PATH);
  } catch {
    return false;
  }
}

function setAdminCoreOfflineFlag(value: boolean) {
  if (value) {
    fs.writeFileSync(
      OFFLINE_FLAG_PATH,
      JSON.stringify({ at: new Date().toISOString(), pm2App: PM2_APP_NAME }),
    );
    return;
  }
  if (fs.existsSync(OFFLINE_FLAG_PATH)) {
    fs.unlinkSync(OFFLINE_FLAG_PATH);
  }
}

export function readPm2RuntimePublic(): Pm2Runtime {
  try {
    const out = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8', timeout: 4000 });
    const list = JSON.parse(out) as Array<{ name?: string; pm2_env?: { status?: string } }>;
    const app = list.find((p) => p.name === PM2_APP_NAME);
    const status = String(app?.pm2_env?.status || '').toLowerCase();
    if (status === 'online') return 'online';
    if (status === 'stopped') return 'stopped';
    if (status === 'stopping') return 'stopping';
    if (status === 'launching' || status === 'restarting') return 'launching';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function spawnPm2Detached(args: string[]) {
  const child = spawn('pm2', args, { detached: true, stdio: 'ignore', env: process.env });
  child.unref();
}

/** Zawsze podnosi / restartuje proces PM2 (bez pm2 stop — API musi odpowiadać). */
function ensurePm2Running(pm2: Pm2Runtime) {
  if (pm2 === 'stopped' || pm2 === 'unknown') {
    spawnPm2Detached(['start', PM2_APP_NAME]);
    return 'start';
  }
  if (pm2 === 'launching' || pm2 === 'stopping') {
    spawnPm2Detached(['restart', PM2_APP_NAME]);
    return 'restart';
  }
  spawnPm2Detached(['reload', PM2_APP_NAME]);
  return 'reload';
}

export async function handleAdminCoreControlPOST(req: Request, action: 'start' | 'stop') {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  if (!isControlEnabled()) {
    return NextResponse.json(
      {
        success: false,
        state: 'offline' as AdminCoreControlState,
        message: 'Sterowanie CORE wyłączone (ustaw ADMIN_CORE_CONTROL_ENABLED=1 na serwerze).',
      },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  const pm2 = readPm2RuntimePublic();

  if (action === 'stop') {
    setAdminCoreOfflineFlag(true);
    return NextResponse.json(
      {
        success: true,
        state: 'offline' as AdminCoreControlState,
        pm2,
        message: `Tryb OFFLINE — metryki wyłączone. PM2 (${PM2_APP_NAME}) działa w tle.`,
      },
      { headers: NO_CACHE_HEADERS },
    );
  }

  setAdminCoreOfflineFlag(false);
  const cmd = ensurePm2Running(pm2);

  return NextResponse.json(
    {
      success: true,
      state: 'starting' as AdminCoreControlState,
      pm2,
      command: cmd,
      message: `PM2 · ${cmd} ${PM2_APP_NAME} — czekaj na ONLINE.`,
    },
    { headers: NO_CACHE_HEADERS },
  );
}
