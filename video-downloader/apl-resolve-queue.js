/**
 * In-memory FIFO limiter for Apple Music audio resolves
 * (YouTube fallback + FlareSolverr/APLMate). Movies already have
 * DurableMovieJobQueue; music resolves are ephemeral and must not
 * stampede a single FlareSolverr instance.
 */
const MAX_CONCURRENT = Math.max(1, Number(process.env.APLMATE_RESOLVE_CONCURRENCY || 1));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.APLMATE_RESOLVE_ATTEMPTS || 3));

const waiters = [];
let running = 0;
const inflightByKey = new Map();

export function aplResolveQueueDepth() {
  return waiters.length + running;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientResolveError(err) {
  return /timeout|ECONNREFUSED|FlareSolverr|CAPTCHA|Turnstile|HTTP 403|HTTP 502|HTTP 503|HTTP 429|zajęty|niedostępny|chrome not reachable|session not created/i.test(
    String(err?.message || err || "")
  );
}

async function acquireSlot() {
  if (running < MAX_CONCURRENT) {
    running += 1;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  running += 1;
}

function releaseSlot() {
  running = Math.max(0, running - 1);
  const next = waiters.shift();
  if (next) next();
}

export async function enqueueAppleMusicResolve(key, work) {
  const dedupe = String(key || "").trim();
  if (dedupe && inflightByKey.has(dedupe)) return inflightByKey.get(dedupe);

  const task = (async () => {
    await acquireSlot();
    try {
      let lastErr;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        try {
          return await work({ attempt, queueDepth: waiters.length + running });
        } catch (err) {
          lastErr = err;
          if (attempt >= MAX_ATTEMPTS - 1 || !isTransientResolveError(err)) throw err;
          await sleep(Math.min(30_000, 1000 * 2 ** attempt));
        }
      }
      throw lastErr;
    } finally {
      releaseSlot();
    }
  })();

  if (dedupe) {
    inflightByKey.set(dedupe, task);
    task.finally(() => inflightByKey.delete(dedupe)).catch(() => {});
  }
  return task;
}
