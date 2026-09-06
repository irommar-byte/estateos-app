#!/usr/bin/env node
/**
 * Heartbeat cronów PM2: budzi Next na 127.0.0.1.
 * Retry przy starcie VM / reloadzie, gdy :3000 jeszcze nie słucha.
 */

const RETRYABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function errorCode(err) {
  if (!err || typeof err !== "object") return "";
  return String(err.cause?.code || err.code || "");
}

function isRetryableCronError(err) {
  const code = errorCode(err);
  if (RETRYABLE_CODES.has(code)) return true;
  const msg = String(err?.message || err || "");
  return /fetch failed|other side closed|ECONNREFUSED|socket hang up|connect ECONNREFUSED/i.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postCronOnce(url, secret) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function runCronHeartbeat(job, pathname) {
  const port = process.env.PORT || "3000";
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || "";
  const url = `http://127.0.0.1:${port}${pathname}`;
  const attempts = Math.max(1, Number(process.env.CRON_HEARTBEAT_RETRIES || 6));
  const delayMs = Math.max(250, Number(process.env.CRON_HEARTBEAT_RETRY_MS || 8000));

  let lastErr = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { res, data } = await postCronOnce(url, secret);
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          job,
          status: res.status,
          attempt,
          ...data,
        }),
      );
      if (res.ok) return;
      lastErr = new Error(`${job} HTTP ${res.status}`);
      if (res.status < 500 || attempt === attempts) {
        process.exitCode = 1;
        return;
      }
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableCronError(err) && attempt < attempts;
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          job,
          attempt,
          retryable,
          error: err instanceof Error ? err.message : String(err),
          code: errorCode(err) || undefined,
        }),
      );
      if (!retryable) {
        process.exitCode = 1;
        return;
      }
    }
    await sleep(delayMs);
  }

  if (lastErr) {
    console.error(lastErr);
    process.exitCode = 1;
  }
}

module.exports = {
  errorCode,
  isRetryableCronError,
  runCronHeartbeat,
};
