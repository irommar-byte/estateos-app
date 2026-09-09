import { monitorEventLoopDelay } from 'node:perf_hooks';

const globalRuntimePerformance = globalThis as typeof globalThis & {
  __estateOsEventLoopDelay?: ReturnType<typeof monitorEventLoopDelay>;
};

function histogram() {
  if (!globalRuntimePerformance.__estateOsEventLoopDelay) {
    const delay = monitorEventLoopDelay({ resolution: 20 });
    delay.enable();
    globalRuntimePerformance.__estateOsEventLoopDelay = delay;
  }
  return globalRuntimePerformance.__estateOsEventLoopDelay;
}

export function readRuntimePerformance() {
  const memory = process.memoryUsage();
  const delay = histogram();
  const toMs = (nanoseconds: number) =>
    Number.isFinite(nanoseconds) ? Math.round((nanoseconds / 1_000_000) * 10) / 10 : 0;

  return {
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
    eventLoop: {
      meanMs: toMs(delay.mean),
      p50Ms: toMs(delay.percentile(50)),
      p95Ms: toMs(delay.percentile(95)),
      p99Ms: toMs(delay.percentile(99)),
      maxMs: toMs(delay.max),
    },
  };
}

// Start sampling when the module is first loaded.
histogram();
