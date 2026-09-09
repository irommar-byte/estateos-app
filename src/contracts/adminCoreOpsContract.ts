export type CoreLogStream = 'out' | 'error' | 'both';

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

export type CorePm2Kind = 'daemon' | 'cron';

export type CorePm2Process = {
  id: number;
  name: string;
  status: string;
  cpu: number;
  memoryBytes: number;
  uptimeMs: number;
  restarts: number;
  pid: number | null;
  commitSha?: string;
  cronRestart?: string | null;
  execMode?: string;
  kind?: CorePm2Kind;
};

export type CoreMariaDbStatus = {
  name: string;
  status: string;
  up: boolean;
};

export type CoreFindingSeverity = 'critical' | 'warning' | 'info';

export type CoreFinding = {
  id: string;
  severity: CoreFindingSeverity;
  title: string;
  detail: string;
  evidence?: Array<{ label: string; value: string }>;
  action?: string;
  fixable: boolean;
};

export type CoreDiagnoseReport = {
  ok?: boolean;
  healthy: boolean;
  level: 'ok' | 'warning' | 'critical';
  score: number;
  summary: string;
  findings: CoreFinding[];
  collectedAt: string;
};

export type CoreOptimizeAction = {
  id: string;
  label: string;
  detail: string;
  freedBytes?: number;
};

export type CoreOptimizeResult = {
  ok: boolean;
  actions: CoreOptimizeAction[];
  before?: CoreDiagnoseReport;
  after?: CoreDiagnoseReport | null;
};

export type CoreProductionSnapshot = {
  collectedAt: string;
  git: { sha: string; subject: string; committedAt: string };
  env: { commitSha: string };
  process: { commitSha: string };
  health: {
    ok: boolean;
    status: string;
    commit: string;
    uptimeSec: number;
    durationMs: number;
  };
  workers: Array<{
    id: number;
    name: string;
    status: string;
    pid: number | null;
    cpu: number;
    memoryBytes: number;
    uptimeMs: number;
    restarts: number;
    commitSha: string;
  }>;
  inSync: boolean;
};

export type CoreLogsResult = {
  logs: string;
  name: string;
  stream: CoreLogStream;
  lines: number;
  apps?: string[];
  pm2?: string;
  collectedAt?: string;
};

export type CoreGuardIncident = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'pending' | 'open' | 'resolved';
  title: string;
  detail: string;
  recommendedAction?: string | null;
  autoFixable?: boolean;
  occurrences: number;
  lastSeenAt: string;
};

export type CoreGuardDashboard = {
  score: number;
  level: 'ok' | 'warning' | 'critical';
  collectedAt: string;
  latest?: {
    cpuPercent?: number;
    memoryUsedBytes?: number;
    memoryTotalBytes?: number;
    requestsPerMin?: number;
    latencyP95Ms?: number | null;
    status5xx?: number;
  } | null;
  incidents: CoreGuardIncident[];
  history: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
};
