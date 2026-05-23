import crypto from 'crypto';
import { logEvent } from '@/lib/observability';

type CounterMap = Record<string, number>;

declare global {
  // eslint-disable-next-line no-var
  var favoritesPushCounters: CounterMap | undefined;
}

function counters(): CounterMap {
  if (!global.favoritesPushCounters) {
    global.favoritesPushCounters = {
      favorites_price_change_events_total: 0,
      favorites_price_push_candidates_total: 0,
      favorites_price_push_sent_total: 0,
      favorites_price_push_failed_total: 0,
      favorites_price_push_latency_ms_total: 0,
      favorites_price_push_latency_ms_count: 0,
    };
  }
  return global.favoritesPushCounters;
}

export function incMetric(name: string, value = 1): void {
  const c = counters();
  c[name] = (c[name] || 0) + value;
}

export function observeLatencyMs(value: number): void {
  const c = counters();
  c.favorites_price_push_latency_ms_total += value;
  c.favorites_price_push_latency_ms_count += 1;
}

export function getMetricsSnapshot() {
  const c = counters();
  const sent = c.favorites_price_push_sent_total || 0;
  const failed = c.favorites_price_push_failed_total || 0;
  const attempts = sent + failed;
  return {
    ...c,
    favorites_price_push_success_rate: attempts > 0 ? sent / attempts : 0,
    favorites_price_push_latency_ms:
      c.favorites_price_push_latency_ms_count > 0
        ? c.favorites_price_push_latency_ms_total / c.favorites_price_push_latency_ms_count
        : 0,
  };
}

export function tokenRef(token: string): string {
  const clean = String(token || '').trim();
  if (!clean) return 'empty';
  const hash = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 10);
  const last4 = clean.slice(-4);
  return `${hash}...${last4}`;
}

export function logMetricsSnapshot(context = 'favorites_price_push') {
  logEvent('info', 'favorites_price_push_metrics', context, getMetricsSnapshot());
}
