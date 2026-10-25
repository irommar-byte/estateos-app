import { prisma } from '@/lib/prisma';
import {
  enqueueKeiImportJob,
  hasActiveKeiImportJob,
} from '@/lib/keiAmerImportJobs';
import { pickNewestKeiListingsForImport } from '@/lib/keiAmerPreview';
import {
  DEFAULT_KEI_AUTO_SETTINGS,
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  KEI_AUTO_PORTALS,
  KEI_WORKER_STALE_SECONDS,
  isWithinActiveHours,
  keiAutoErrorBackoffMinutes,
  keiAutoNextRunAt,
  warsawDayKey,
  type KeiAutoImportConfig,
  type KeiAutoImportSettings,
  type KeiAutoPortal,
  type KeiAutoTargetUser,
} from '@/lib/keiAutoImportShared';

export {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  keiAutoIntervalLabel,
  keiAutoNextRunAt,
  type KeiAutoImportConfig,
  type KeiAutoImportSettings,
} from '@/lib/keiAutoImportShared';

const FALLBACK_TARGET_USER_ID = Number(process.env.KEI_AMER_EXPORT_USER_ID) || 55;

const DEFAULTS: KeiAutoImportConfig = {
  enabled: false,
  intervalMinutes: 60,
  count: 3,
  targetUserId: FALLBACK_TARGET_USER_ID,
  agentCommissionPercent: 2,
  propertyKind: 'apartment',
  transactionKind: 'sale',
  adminUserId: 0,
  lastRunAt: null,
  lastStartedAt: null,
  lastJobId: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveErrors: 0,
  updatedAt: null,
  sessionStartedAt: null,
  sessionImportedCount: 0,
  sessionSkippedCount: 0,
  sessionCycles: 0,
  dayImportedCount: 0,
  workerHeartbeatAt: null,
  workerAlive: false,
  settings: { ...DEFAULT_KEI_AUTO_SETTINGS },
  targetUser: null,
  nextRunAt: null,
  waitingReason: null,
};

function clampInterval(n: number) {
  const v = Math.round(n);
  return (KEI_AUTO_INTERVALS_MIN as readonly number[]).includes(v) ? v : 60;
}

function finiteOrNull(raw: unknown, min: number, max: number): number | null {
  if (raw === '' || raw == null) return null;
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function intInRange(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Twarda walidacja ustawień — nic z formularza nie trafi do SQL jako NaN. */
export function sanitizeKeiAutoSettings(raw: unknown, base: KeiAutoImportSettings = DEFAULT_KEI_AUTO_SETTINGS): KeiAutoImportSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(src, key);
  const districts = has('districts')
    ? (Array.isArray(src.districts) ? src.districts : [])
        .map((d) => String(d || '').trim())
        .filter(Boolean)
        .slice(0, 30)
    : base.districts;
  const allowedPortals = new Set(KEI_AUTO_PORTALS.map((p) => p.id));
  const portals = has('portals')
    ? (Array.isArray(src.portals) ? src.portals : []).map(String).filter((p): p is KeiAutoPortal => allowedPortals.has(p as KeiAutoPortal))
    : base.portals;
  let minPrice = has('minPrice') ? finiteOrNull(src.minPrice, 0, 1e9) : base.minPrice;
  let maxPrice = has('maxPrice') ? finiteOrNull(src.maxPrice, 0, 1e9) : base.maxPrice;
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  let minArea = has('minArea') ? finiteOrNull(src.minArea, 0, 100_000) : base.minArea;
  let maxArea = has('maxArea') ? finiteOrNull(src.maxArea, 0, 100_000) : base.maxArea;
  if (minArea != null && maxArea != null && minArea > maxArea) [minArea, maxArea] = [maxArea, minArea];
  let minRooms = has('minRooms') ? finiteOrNull(src.minRooms, 1, 20) : base.minRooms;
  let maxRooms = has('maxRooms') ? finiteOrNull(src.maxRooms, 1, 20) : base.maxRooms;
  if (minRooms != null && maxRooms != null && minRooms > maxRooms) [minRooms, maxRooms] = [maxRooms, minRooms];
  return {
    districts,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    minRooms: minRooms != null ? Math.round(minRooms) : null,
    maxRooms: maxRooms != null ? Math.round(maxRooms) : null,
    maxAgeHours: has('maxAgeHours') ? finiteOrNull(src.maxAgeHours, 1, 24 * 90) : base.maxAgeHours,
    directOwnerOnly: has('directOwnerOnly') ? src.directOwnerOnly === true : base.directOwnerOnly,
    requirePhone: has('requirePhone') ? src.requirePhone === true : base.requirePhone,
    minImages: has('minImages') ? intInRange(src.minImages, base.minImages, 0, 20) : base.minImages,
    publishMode: has('publishMode') ? (src.publishMode === 'review' ? 'review' : 'publish') : base.publishMode,
    activeFromHour: has('activeFromHour') ? intInRange(src.activeFromHour, base.activeFromHour, 0, 23) : base.activeFromHour,
    activeToHour: has('activeToHour') ? intInRange(src.activeToHour, base.activeToHour, 0, 24) % 24 : base.activeToHour,
    dailyLimit: has('dailyLimit') ? intInRange(src.dailyLimit, base.dailyLimit, 0, 500) : base.dailyLimit,
    portals: portals.length ? portals : base.portals.length ? base.portals : DEFAULT_KEI_AUTO_SETTINGS.portals,
  };
}

function parseSettingsJson(raw: unknown): KeiAutoImportSettings {
  if (raw == null) return { ...DEFAULT_KEI_AUTO_SETTINGS };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return sanitizeKeiAutoSettings(parsed, DEFAULT_KEI_AUTO_SETTINGS);
  } catch {
    return { ...DEFAULT_KEI_AUTO_SETTINGS };
  }
}

const iso = (value: unknown) => (value ? new Date(String(value)).toISOString() : null);

function computeWaitingReason(config: KeiAutoImportConfig): string | null {
  if (!config.enabled) return null;
  if (!config.workerAlive) return 'Worker importu nie odpowiada — sprawdź proces kei-import-worker.';
  if (!isWithinActiveHours(config.settings)) {
    return `Poza godzinami pracy (${config.settings.activeFromHour}:00–${config.settings.activeToHour}:00).`;
  }
  if (config.settings.dailyLimit > 0 && config.dayImportedCount >= config.settings.dailyLimit) {
    return `Osiągnięto dzienny limit ${config.settings.dailyLimit} ofert.`;
  }
  if (config.consecutiveErrors > 0) {
    return `Przerwa po błędzie (${config.consecutiveErrors}× z rzędu) — ponowna próba za ${keiAutoErrorBackoffMinutes(config.consecutiveErrors)} min od błędu.`;
  }
  return null;
}

function mapRow(row: Record<string, unknown> | undefined, targetUser: KeiAutoTargetUser): KeiAutoImportConfig {
  if (!row) return { ...DEFAULTS, targetUser, waitingReason: null };
  const heartbeat = iso(row.workerHeartbeatAt);
  const dayKey = String(row.dayKey || '');
  const config: KeiAutoImportConfig = {
    enabled: Boolean(row.enabled),
    intervalMinutes: clampInterval(Number(row.intervalMinutes) || 60),
    count: Math.min(KEI_AUTO_MAX_COUNT, Math.max(1, Number(row.count) || 3)),
    targetUserId: Math.max(1, Number(row.targetUserId) || FALLBACK_TARGET_USER_ID),
    agentCommissionPercent: Math.min(10, Math.max(0, Number(row.agentCommissionPercent) || 0)),
    propertyKind: row.propertyKind === 'house' ? 'house' : 'apartment',
    transactionKind: row.transactionKind === 'rent' ? 'rent' : 'sale',
    adminUserId: Number(row.adminUserId) || 0,
    lastRunAt: iso(row.lastRunAt),
    lastStartedAt: iso(row.lastStartedAt),
    lastJobId: row.lastJobId ? String(row.lastJobId) : null,
    lastError: row.lastError ? String(row.lastError) : null,
    lastErrorAt: iso(row.lastErrorAt),
    consecutiveErrors: Math.max(0, Number(row.consecutiveErrors) || 0),
    updatedAt: iso(row.updatedAt),
    sessionStartedAt: iso(row.sessionStartedAt),
    sessionImportedCount: Math.max(0, Number(row.sessionImportedCount) || 0),
    sessionSkippedCount: Math.max(0, Number(row.sessionSkippedCount) || 0),
    sessionCycles: Math.max(0, Number(row.sessionCycles) || 0),
    dayImportedCount: dayKey === warsawDayKey() ? Math.max(0, Number(row.dayImportedCount) || 0) : 0,
    workerHeartbeatAt: heartbeat,
    workerAlive: Boolean(heartbeat && Date.now() - new Date(heartbeat).getTime() < KEI_WORKER_STALE_SECONDS * 1000),
    settings: parseSettingsJson(row.settingsJson),
    targetUser,
    nextRunAt: null,
    waitingReason: null,
  };
  config.nextRunAt = keiAutoNextRunAt(config);
  config.waitingReason = computeWaitingReason(config);
  return config;
}

async function loadTargetUser(userId: number): Promise<KeiAutoTargetUser> {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } })
    .catch(() => null);
  return user ? { id: user.id, name: user.name, email: user.email, role: String(user.role) } : null;
}

export async function getKeiAutoImportConfig(): Promise<KeiAutoImportConfig> {
  const rows = (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM KeiAutoImportSchedule WHERE id = 1 LIMIT 1`,
  )) as Array<Record<string, unknown>>;
  const targetUserId = Number(rows[0]?.targetUserId) || FALLBACK_TARGET_USER_ID;
  return mapRow(rows[0], await loadTargetUser(targetUserId));
}

/** Konta, na które może trafiać import (agenci, admini, Pro) — do wyboru z listy zamiast wpisywania ID. */
export async function listKeiTargetUserOptions(query?: string) {
  const q = String(query || '').trim();
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { OR: [{ role: 'AGENT' }, { role: 'ADMIN' }, { isPro: true }] },
        q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { companyName: { contains: q } },
                ...(Number.isFinite(Number(q)) ? [{ id: Number(q) }] : []),
              ],
            }
          : {},
      ],
    },
    select: { id: true, name: true, email: true, role: true, companyName: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    take: 40,
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    role: String(u.role),
    companyName: u.companyName,
  }));
}

export class KeiAutoImportValidationError extends Error {}

export async function saveKeiAutoImportConfig(
  patch: Partial<Omit<KeiAutoImportConfig, 'settings'>> & { adminUserId: number; settings?: Partial<KeiAutoImportSettings> },
): Promise<KeiAutoImportConfig> {
  const current = await getKeiAutoImportConfig();
  const nextEnabled = patch.enabled ?? current.enabled;
  const becomingEnabled = nextEnabled && !current.enabled;

  const targetUserId = patch.targetUserId ?? current.targetUserId;
  if (patch.targetUserId != null) {
    const target = await loadTargetUser(targetUserId);
    if (!target) throw new KeiAutoImportValidationError(`Użytkownik #${targetUserId} nie istnieje — wybierz konto z listy.`);
  }

  const next = {
    enabled: nextEnabled,
    intervalMinutes: clampInterval(patch.intervalMinutes ?? current.intervalMinutes),
    count: intInRange(patch.count ?? current.count, current.count, 1, KEI_AUTO_MAX_COUNT),
    targetUserId,
    agentCommissionPercent: Math.min(10, Math.max(0, Number.isFinite(Number(patch.agentCommissionPercent))
      ? Number(patch.agentCommissionPercent)
      : current.agentCommissionPercent)),
    propertyKind: patch.propertyKind ?? current.propertyKind,
    transactionKind: patch.transactionKind ?? current.transactionKind,
    adminUserId: patch.adminUserId || current.adminUserId,
    settings: patch.settings ? sanitizeKeiAutoSettings(patch.settings, current.settings) : current.settings,
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAutoImportSchedule
      (id, enabled, intervalMinutes, count, targetUserId, agentCommissionPercent, propertyKind, transactionKind, adminUserId, settingsJson)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      intervalMinutes = VALUES(intervalMinutes),
      count = VALUES(count),
      targetUserId = VALUES(targetUserId),
      agentCommissionPercent = VALUES(agentCommissionPercent),
      propertyKind = VALUES(propertyKind),
      transactionKind = VALUES(transactionKind),
      adminUserId = VALUES(adminUserId),
      settingsJson = VALUES(settingsJson)`,
    next.enabled ? 1 : 0,
    next.intervalMinutes,
    next.count,
    next.targetUserId,
    next.agentCommissionPercent,
    next.propertyKind,
    next.transactionKind,
    next.adminUserId,
    JSON.stringify(next.settings),
  );

  if (becomingEnabled) {
    // Nowa sesja auto-importu: czyste liczniki, cykl rusza od razu. Ostatni błąd zostaje w historii zadań.
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule
       SET lastRunAt = NULL,
           lastStartedAt = NULL,
           lastJobId = NULL,
           lastError = NULL,
           lastErrorAt = NULL,
           consecutiveErrors = 0,
           sessionStartedAt = NOW(3),
           sessionImportedCount = 0,
           sessionSkippedCount = 0,
           sessionCycles = 0
       WHERE id = 1`,
    );
  }

  return getKeiAutoImportConfig();
}

export function parseKeiAutoImportPatch(
  body: Record<string, unknown>,
  adminUserId: number,
): Partial<Omit<KeiAutoImportConfig, 'settings'>> & { adminUserId: number; settings?: Partial<KeiAutoImportSettings> } {
  const num = (value: unknown) => {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    adminUserId,
    enabled: body.enabled == null ? undefined : body.enabled === true || body.enabled === 1 || body.enabled === '1',
    intervalMinutes: num(body.intervalMinutes),
    count: num(body.count),
    targetUserId: num(body.targetUserId),
    agentCommissionPercent: num(body.agentCommissionPercent),
    propertyKind: body.propertyKind === 'house' ? 'house' : body.propertyKind === 'apartment' ? 'apartment' : undefined,
    transactionKind: body.transactionKind === 'rent' ? 'rent' : body.transactionKind === 'sale' ? 'sale' : undefined,
    settings: body.settings && typeof body.settings === 'object' ? (body.settings as Partial<KeiAutoImportSettings>) : undefined,
  };
}

export async function saveKeiAutoImportAndKick(
  patch: ReturnType<typeof parseKeiAutoImportPatch>,
): Promise<{
  config: KeiAutoImportConfig;
  tick: { ran: boolean; reason: string; jobId?: string; picked?: number } | null;
}> {
  const previous = await getKeiAutoImportConfig();
  const config = await saveKeiAutoImportConfig(patch);
  const justTurnedOn = config.enabled && !previous.enabled;
  if (!config.enabled || !justTurnedOn) return { config, tick: null };
  return { config, tick: { ran: false, reason: 'worker_scheduled' } };
}

/** Worker woła co minutę — panel widzi, czy proces importu naprawdę żyje. */
export async function touchKeiWorkerHeartbeat(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAutoImportSchedule (id, workerHeartbeatAt) VALUES (1, NOW(3))
     ON DUPLICATE KEY UPDATE workerHeartbeatAt = NOW(3)`,
  );
}

async function recordTickError(message: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAutoImportSchedule
     SET lastError = ?,
         lastErrorAt = NOW(3),
         consecutiveErrors = consecutiveErrors + 1
     WHERE id = 1`,
    message.slice(0, 500),
  );
}

export async function recordKeiAutoImportCycle(result: {
  imported: number;
  skipped: number;
  error?: string | null;
}): Promise<void> {
  if (result.error) {
    await prisma.$executeRawUnsafe(
      `UPDATE KeiAutoImportSchedule
       SET lastRunAt = NOW(3),
           lastError = ?,
           lastErrorAt = NOW(3),
           consecutiveErrors = consecutiveErrors + 1,
           sessionCycles = sessionCycles + 1
       WHERE id = 1 AND enabled = 1`,
      result.error.slice(0, 500),
    );
    return;
  }
  const today = warsawDayKey();
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAutoImportSchedule
     SET lastRunAt = NOW(3),
         lastError = NULL,
         lastErrorAt = NULL,
         consecutiveErrors = 0,
         sessionImportedCount = sessionImportedCount + ?,
         sessionSkippedCount = sessionSkippedCount + ?,
         sessionCycles = sessionCycles + 1,
         dayImportedCount = CASE WHEN dayKey = ? THEN dayImportedCount + ? ELSE ? END,
         dayKey = ?
     WHERE id = 1 AND enabled = 1`,
    Math.max(0, result.imported),
    Math.max(0, result.skipped),
    today,
    Math.max(0, result.imported),
    Math.max(0, result.imported),
    today,
  );
}

export async function tickKeiAutoImport(opts?: {
  force?: boolean;
}): Promise<{ ran: boolean; reason: string; jobId?: string; picked?: number }> {
  const cfg = await getKeiAutoImportConfig();
  if (!cfg.enabled) return { ran: false, reason: 'disabled' };
  if (!cfg.adminUserId) return { ran: false, reason: 'no_admin' };
  if (await hasActiveKeiImportJob()) return { ran: false, reason: 'job_running' };

  const force = Boolean(opts?.force);
  if (!force) {
    if (!isWithinActiveHours(cfg.settings)) return { ran: false, reason: 'outside_hours' };
    if (cfg.settings.dailyLimit > 0 && cfg.dayImportedCount >= cfg.settings.dailyLimit) {
      return { ran: false, reason: 'daily_limit' };
    }
    if (cfg.nextRunAt && Date.now() < new Date(cfg.nextRunAt).getTime()) {
      return { ran: false, reason: cfg.consecutiveErrors > 0 ? 'error_backoff' : 'not_due' };
    }
  }

  const remainingToday =
    cfg.settings.dailyLimit > 0 ? Math.max(1, cfg.settings.dailyLimit - cfg.dayImportedCount) : cfg.count;
  const count = Math.min(cfg.count, remainingToday);

  try {
    await prisma.$executeRawUnsafe(`UPDATE KeiAutoImportSchedule SET lastStartedAt = NOW(3) WHERE id = 1`);
    const selections = await pickNewestKeiListingsForImport({
      propertyKind: cfg.propertyKind,
      transactionKind: cfg.transactionKind,
      count,
      settings: cfg.settings,
    });

    if (selections.length === 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE KeiAutoImportSchedule
         SET lastRunAt = NOW(3), lastError = NULL, lastErrorAt = NULL, consecutiveErrors = 0,
             sessionCycles = sessionCycles + 1
         WHERE id = 1`,
      );
      return { ran: false, reason: 'no_new_listings', picked: 0 };
    }

    const job = await enqueueKeiImportJob({
      adminUserId: cfg.adminUserId,
      propertyKind: cfg.propertyKind,
      transactionKind: cfg.transactionKind,
      targetUserId: cfg.targetUserId,
      agentCommissionPercent: cfg.agentCommissionPercent,
      selections,
      count,
      source: 'auto',
      publishMode: cfg.settings.publishMode,
      minImages: cfg.settings.minImages,
    });
    await prisma.$executeRawUnsafe(`UPDATE KeiAutoImportSchedule SET lastJobId = ? WHERE id = 1`, job.id);
    return { ran: true, reason: 'queued', jobId: job.id, picked: selections.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/już trwa|właśnie startuje/i.test(message)) return { ran: false, reason: 'job_running' };
    // Błąd liczy się do przerwy (2 → 5 → 15 → 30 → 60 min) — nie uderzamy w KEI co minutę.
    await recordTickError(message);
    return { ran: false, reason: message };
  }
}
