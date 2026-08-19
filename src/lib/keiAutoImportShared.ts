export const KEI_AUTO_INTERVALS_MIN = [15, 30, 60, 180, 360, 720, 1440] as const;
export const KEI_AUTO_MAX_COUNT = 25;

export type KeiAutoPropertyKind = 'apartment' | 'house';
export type KeiAutoTransactionKind = 'sale' | 'rent';

export type KeiAutoImportConfig = {
  enabled: boolean;
  intervalMinutes: number;
  count: number;
  targetUserId: number;
  agentCommissionPercent: number;
  propertyKind: KeiAutoPropertyKind;
  transactionKind: KeiAutoTransactionKind;
  adminUserId: number;
  lastRunAt: string | null;
  lastJobId: string | null;
  lastError: string | null;
  updatedAt: string | null;
  sessionStartedAt: string | null;
  sessionImportedCount: number;
  sessionSkippedCount: number;
  sessionCycles: number;
  /** ISO — null gdy wyłączony albo cykl ma ruszyć od razu. */
  nextRunAt: string | null;
};

export function keiAutoIntervalLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours === 1) return '1 godz.';
  if (hours === 24) return '24 godz.';
  return `${hours} godz.`;
}

export function keiAutoNextRunAt(config: Pick<KeiAutoImportConfig, 'enabled' | 'lastRunAt' | 'intervalMinutes'>): string | null {
  if (!config.enabled) return null;
  if (!config.lastRunAt) return new Date().toISOString();
  return new Date(new Date(config.lastRunAt).getTime() + config.intervalMinutes * 60_000).toISOString();
}
