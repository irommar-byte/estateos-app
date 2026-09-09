/** Metryki infrastruktury EstateOS™ CORE (admin, odświeżanie na żywo). */
export type AdminCoreMetrics = {
  collectedAt: string;
  host: string;
  uptimeSec: number;
  cpu: {
    percent: number;
    cores: number;
    load1?: number;
    load5?: number;
    load15?: number;
  };
  memory: {
    usedBytes: number;
    totalBytes: number;
    percent: number;
  };
  disk: {
    usedBytes: number;
    totalBytes: number;
    percent: number;
  };
  process?: {
    pid?: number;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes?: number;
    arrayBuffersBytes?: number;
    eventLoopP95Ms?: number;
    eventLoopP99Ms?: number;
  };
  network?: {
    requestsPerMin: number;
    activeConnections: number;
    latencyP50Ms?: number | null;
    latencyP95Ms?: number | null;
    latencyP99Ms?: number | null;
    upstreamLatencyP95Ms?: number | null;
    status499?: number;
    status5xx?: number;
  };
  database?: {
    poolActive: number;
    poolMax: number;
    latencyMs: number;
    abortedClients?: number | null;
  };
  app?: {
    offersPending?: number;
    activeUsers?: number;
    pushQueueDepth?: number;
    radarPushActive?: number;
  };
  /** true = dane z API; false = tryb podglądu (brak endpointu). */
  live: boolean;
};

export type AdminCoreMetricsResponse = {
  success?: boolean;
  metrics?: unknown;
  core?: unknown;
  data?: unknown;
};
