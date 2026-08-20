import { API_URL } from '../config/network';

export type SimulatorUser = {
  id: number;
  name: string;
  role: string;
};

export type SimulatorUsersPayload = {
  maxId: number;
  users: SimulatorUser[];
};

export async function fetchSimulatorUsers(token: string): Promise<SimulatorUsersPayload> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/simulator/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Nie udało się wczytać użytkowników.');
  return {
    maxId: Number(data.maxId || 0),
    users: Array.isArray(data.users) ? data.users : [],
  };
}

export type AdminCoreMonitor = {
  collectedAt: string;
  host: string;
  publicIp: string | null;
  osUptimeSec: number;
  processUptimeSec: number;
  cpuPercent: number;
  load1: number;
  memoryPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  diskPercent: number;
  dbLatencyMs: number | null;
  users: number;
  activeOffers: number;
  pendingOffers: number;
  activeUsers24h: number;
  pageViews: number;
  uniqueIps: number;
  visits24h: number;
  uniqueIps24h: number;
};

export async function fetchAdminCoreMonitor(token: string): Promise<AdminCoreMonitor> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/monitor`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Nie udało się wczytać monitora.');
  return data.monitor as AdminCoreMonitor;
}
