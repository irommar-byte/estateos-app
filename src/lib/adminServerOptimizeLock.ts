let running = false;

export function isServerOptimizeRunning() {
  return running;
}

export async function runServerOptimizeExclusive<T>(
  fn: () => Promise<T>,
): Promise<{ conflict: true } | { conflict: false; result: T }> {
  if (running) return { conflict: true };
  running = true;
  try {
    return { conflict: false, result: await fn() };
  } finally {
    running = false;
  }
}
