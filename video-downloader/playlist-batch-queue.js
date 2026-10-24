/**
 * Durable per-account music download batch. The phone enqueues once; workers
 * start the next item without an active iPhone process.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sendLiveActivityPush } from "./live-activity-apns.js";

export const PLAYLIST_BATCH_CONCURRENCY = 1; // one yt-dlp at a time — parallel grabs starve WAN/NAS
const RETRY_LIMIT = 2; // was 4 — failed YouTube retries were storming the NAS
const BACKOFF_MS = [2000, 5000, 12000, 25000];
const FINALIZE_STALE_MS = 45_000;
const ITEM_TIMEOUT_MS = 12 * 60 * 1000;

function canonicalIdentity(url) {
  return String(url || "").trim().toLowerCase().replace(/\/+$/, "");
}

export function createPlaylistBatchQueue({ filePath, ensureMusicAsset, cancelJob, onLog, onNotify, concurrency, getConcurrency, finalizeStaleMs, itemTimeoutMs, pollIntervalMs } = {}) {
  const defaultConcurrent = Math.max(1, Number(concurrency) || PLAYLIST_BATCH_CONCURRENCY);
  function currentMaxConcurrent() {
    if (typeof getConcurrency === "function") {
      try {
        const n = Number(getConcurrency());
        // 0 = pause music workers (e.g. while a movie season download owns the pipe).
        if (Number.isFinite(n) && n >= 0) return Math.max(0, Math.floor(n));
      } catch {}
    }
    return defaultConcurrent;
  }
  const staleMs = Math.max(20, Number(finalizeStaleMs) || FINALIZE_STALE_MS);
  const itemLimitMs = Math.max(200, Number(itemTimeoutMs) || ITEM_TIMEOUT_MS);
  const pollMs = Math.max(10, Number(pollIntervalMs) || 1500);
  const batches = new Map();
  const tokens = new Map(); // userKey -> { token, activityId, frequentPushesEnabled, batchId }
  let persistTimer = null;
  const userLock = new Map();

  function log(...args) {
    onLog?.(...args);
  }

  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 80);
  }

  function persistNow() {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const payload = {
        batches: [...batches.values()],
        tokens: [...tokens.entries()].map(([userKey, value]) => ({ userKey, ...value })),
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    } catch (error) {
      log("persist failed", error?.message || error);
    }
  }

  function load() {
    try {
      if (!fs.existsSync(filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      for (const batch of parsed.batches || []) {
        if (batch?.id) batches.set(batch.id, normalize(batch));
      }
      for (const row of parsed.tokens || []) {
        if (row?.userKey) tokens.set(row.userKey, row);
      }
    } catch (error) {
      log("load failed", error?.message || error);
    }
  }

  function normalize(batch) {
    return {
      id: batch.id,
      userKey: batch.userKey,
      folderId: batch.folderId || "",
      label: batch.label || "Zapis na serwer EOS",
      revision: Number(batch.revision) || 1,
      status: batch.status || "active",
      createdAt: batch.createdAt || Date.now(),
      updatedAt: batch.updatedAt || Date.now(),
      items: (batch.items || []).map((item) => ({
        url: item.url,
        title: item.title || "Utwór",
        identity: item.identity || canonicalIdentity(item.url),
        status: item.status || "pending",
        progress: Number(item.progress) || 0,
        attempts: Number(item.attempts) || 0,
        jobId: item.jobId || null,
        error: item.error || null,
      })),
    };
  }

  function bump(batch, { progressOnly = false } = {}) {
    batch.revision = Number(batch.revision || 0) + 1;
    batch.updatedAt = Date.now();
    persistSoon();
    if (!progressOnly) notify(batch, 10);
    else notify(batch, 5);
  }

  function activeItems(batch) {
    return batch.items.filter((item) => item.status === "active").slice(0, currentMaxConcurrent());
  }

  function snapshot(userKey, batchId) {
    const batch = batchId
      ? batches.get(batchId)
      : [...batches.values()]
          .filter((item) => item.userKey === userKey && item.status === "active")
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
        || [...batches.values()].find((item) => item.userKey === userKey);
    if (!batch) return null;
    const completed = batch.items.filter((item) => item.status === "done").length;
    const failed = batch.items.filter((item) => item.status === "failed").length;
    const actives = activeItems(batch);
    const current = actives[0] || batch.items.find((item) => item.status === "pending");
    const total = Math.max(batch.items.length, 1);
    const slotFrac = actives.reduce((sum, item) => sum + Math.min(1, (Number(item.progress) || 0) / 100), 0);
    const itemProgress = current ? Number(current.progress) || 0 : 100;
    const overallProgress = Math.min(1, (completed + slotFrac) / total);
    const remainingWork = Math.max(0, total - completed - slotFrac);
    let etaSeconds = null;
    if (completed > 0) {
      const elapsed = Math.max(1, (Date.now() - batch.createdAt) / 1000);
      const work = completed + slotFrac;
      if (work > 0 && remainingWork > 0) etaSeconds = (elapsed / work) * remainingWork;
    }
    return {
      id: batch.id,
      completed,
      total,
      currentTitle: current?.title || batch.label,
      itemProgress,
      overallProgress,
      etaSeconds,
      phase: batch.status === "cancelled" ? "cancelled" : "server",
      revision: batch.revision,
      status: batch.status,
      failed,
      currentItems: actives.map((item) => ({
        url: item.url,
        title: item.title,
        status: item.status,
        progress: Math.min(1, (Number(item.progress) || 0) / 100),
      })),
      items: batch.items.map((item) => ({
        url: item.url,
        title: item.title,
        status: item.status,
        progress: Number(item.progress) || 0,
      })),
    };
  }

  function contentState(batch) {
    const snap = snapshot(batch.userKey, batch.id) || {};
    const finished = batch.status === "done" || batch.status === "cancelled";
    const remaining = Math.max(0, (snap.total || 1) - (snap.completed || 0));
    const cap = remaining <= 1 ? 8 * 60 : 45 * 60;
    const eta = snap.etaSeconds && snap.etaSeconds > 0 && snap.etaSeconds <= cap ? snap.etaSeconds : 0;
    return {
      itemProgress: finished ? 1 : Math.min(1, (snap.itemProgress || 0) / 100),
      overallProgress: finished ? 1 : Math.min(1, snap.overallProgress || 0),
      completed: finished ? (snap.total || 1) : (snap.completed || 0),
      total: snap.total || 1,
      phase: finished ? (batch.status === "cancelled" ? "Anulowanie" : "Zakończono") : "Na serwerze",
      title: snap.currentTitle || batch.label,
      secondsRemaining: finished ? 0 : eta,
      isFinished: finished,
      currentItems: finished ? [] : (snap.currentItems || []).map((item) => ({
        title: item.title,
        progress: Math.min(1, Number(item.progress) || 0),
      })),
      batchId: batch.id,
      revision: batch.revision,
      updatedAt: new Date(batch.updatedAt).toISOString(),
    };
  }

  function notify(batch, priority) {
    const reg = tokens.get(batch.userKey);
    if (!reg?.token || reg.batchId !== batch.id) return;
    onNotify?.(batch, priority);
    const finished = batch.status === "done" || batch.status === "cancelled";
    sendLiveActivityPush({
      token: reg.token,
      event: finished ? "end" : "update",
      contentState: contentState(batch),
      priority: finished || priority === 10 ? 10 : 5,
      frequentPushesEnabled: !!reg.frequentPushesEnabled,
      dismissalDate: finished ? Math.floor(Date.now() / 1000) + 3 : undefined,
    }).catch((error) => log("apns", error?.message || error));
  }

  function enqueue({ userKey, folderId, label, tracks, isolated }) {
    if (!userKey) {
      const err = new Error("Zaloguj się, aby zapisać kolejkę.");
      err.status = 401;
      throw err;
    }
    const incoming = (tracks || [])
      .map((track) => ({
        url: String(track.url || "").trim(),
        title: String(track.title || "Utwór").trim() || "Utwór",
      }))
      .filter((track) => track.url);
    if (!incoming.length) {
      const err = new Error("Brak utworów do kolejki.");
      err.status = 400;
      throw err;
    }

    let batch = isolated
      ? null
      : [...batches.values()].find((item) => item.userKey === userKey && item.status === "active");
    if (!batch) {
      batch = normalize({
        id: crypto.randomUUID(),
        userKey,
        folderId: folderId || "",
        label: label || "Zapis na serwer EOS",
        revision: 1,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: [],
      });
      batches.set(batch.id, batch);
    }

    const seen = new Set(batch.items.map((item) => item.identity));
    for (const track of incoming) {
      const identity = canonicalIdentity(track.url);
      if (seen.has(identity)) continue;
      seen.add(identity);
      batch.items.push({
        url: track.url,
        title: track.title,
        identity,
        status: "pending",
        progress: 0,
        attempts: 0,
        jobId: null,
        error: null,
      });
    }
    bump(batch);
    kick(userKey);
    return { ok: true, batchId: batch.id, queued: batch.items.length };
  }

  async function cancel({ userKey, batchId }) {
    const batch = batchId
      ? batches.get(batchId)
      : [...batches.values()].find((item) => item.userKey === userKey && item.status === "active");
    if (!batch || batch.userKey !== userKey) return { ok: true };
    batch.status = "cancelled";
    for (const item of batch.items) {
      if (item.status === "pending") item.status = "cancelled";
      if (item.status === "active" && item.jobId) {
        try {
          await cancelJob?.(item.jobId);
        } catch {}
        item.status = "cancelled";
      }
    }
    bump(batch);
    return { ok: true, batchId: batch.id };
  }

  function registerToken({ userKey, token, activityId, batchId, frequentPushesEnabled }) {
    if (!userKey || !token) return { ok: false };
    tokens.set(userKey, { token, activityId, batchId: batchId || "", frequentPushesEnabled: !!frequentPushesEnabled });
    persistSoon();
    if (batchId) {
      const batch = batches.get(batchId);
      if (batch) notify(batch, 10);
    }
    return { ok: true };
  }

  function unregisterToken({ userKey, activityId }) {
    const current = tokens.get(userKey);
    if (current && (!activityId || current.activityId === activityId)) tokens.delete(userKey);
    persistSoon();
    return { ok: true };
  }

  function withUserLock(userKey, work) {
    const previous = userLock.get(userKey) || Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    userLock.set(userKey, next);
    return next;
  }

  function kick(userKey) {
    withUserLock(userKey, () => processUser(userKey)).catch((error) => log("worker", error?.message || error));
  }

  async function processItem(batch, item) {
    try {
      const result = await ensureMusicAsset({
        userKey: batch.userKey,
        url: item.url,
        folderId: batch.folderId || null,
        trackUrl: item.url,
        intent: "download",
        waitUntilPlayable: false,
      });
      item.jobId = result?.jobId || item.jobId;
      const started = Date.now();
      let highSince = 0;
      while (Date.now() - started < itemLimitMs) {
        if (batch.status === "cancelled") return;
        const jobReady = result?.persistent || result?.onServer || result?.ready;
        if (jobReady && result?.persistent !== false && (result?.onServer || result?.persistent)) {
          item.status = "done";
          item.progress = 100;
          bump(batch);
          return;
        }
        if (result?.jobId && typeof result.poll === "function") {
          const live = await result.poll();
          if (live?.status === "error" || live?.status === "missing") {
            throw new Error(live.error || "Błąd zapisu");
          }
          if (live?.progress != null) {
            const next = Math.max(item.progress, Number(live.progress) || 0);
            item.progress = next;
            if (item.progress - (item.lastNotifiedProgress || 0) >= 1 || Date.now() - (item.lastNotifyAt || 0) > 4000) {
              item.lastNotifiedProgress = item.progress;
              item.lastNotifyAt = Date.now();
              bump(batch, { progressOnly: true });
            }
          }
          const fileReady = live?.ready || live?.onServer || live?.status === "done";
          if (fileReady && (live?.onServer || live?.ready || live?.status === "done")) {
            if (live?.onServer || live?.ready) {
              item.status = "done";
              item.progress = 100;
              bump(batch);
              return;
            }
          }
          const pct = Number(live?.progress) || item.progress || 0;
          if (pct >= 96 && !live?.onServer && !live?.ready) {
            if (!highSince) highSince = Date.now();
            else if (Date.now() - highSince > staleMs) {
              throw new Error("Zapis utknął przy finalizacji — ponawiam.");
            }
          } else {
            highSince = 0;
          }
        } else if (result?.onServer || result?.persistent) {
          item.status = "done";
          item.progress = 100;
          bump(batch);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
      throw new Error("Przekroczono czas zapisu na serwerze.");
    } catch (error) {
      if (batch.status === "cancelled") return;
      item.attempts += 1;
      item.error = error?.message || "Błąd zapisu";
      if (item.attempts >= RETRY_LIMIT) {
        item.status = "failed";
        bump(batch);
      } else {
        item.status = "pending";
        item.progress = 0;
        bump(batch, { progressOnly: true });
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[item.attempts - 1] || 25000));
      }
    }
  }

  async function processUser(userKey) {
    const actives = [...batches.values()].filter((item) => item.userKey === userKey && item.status === "active");
    if (!actives.length) return;
    await Promise.all(actives.map((batch) => processBatch(batch)));
  }

  async function processBatch(batch) {
    const owned = new Set();

    const claim = () => {
      if (batch.status !== "active") return null;
      const item = batch.items.find((row) =>
        (row.status === "pending" || row.status === "active") && !owned.has(row.identity)
      );
      if (!item) return null;
      owned.add(item.identity);
      if (item.status === "pending") {
        item.status = "active";
        item.progress = Math.max(0, Number(item.progress) || 0);
        bump(batch);
      }
      return item;
    };

    const worker = async () => {
      while (true) {
        const item = claim();
        if (!item) return;
        try {
          await processItem(batch, item);
        } finally {
          owned.delete(item.identity);
        }
      }
    };

    const want = Math.min(
      currentMaxConcurrent(),
      batch.items.filter((item) => item.status === "pending" || item.status === "active").length
    );
    if (want <= 0) {
      // Concurrency 0 = intentionally paused (movie download owns the pipe).
      // Do not mark the music batch done — resume when slots reopen.
      return;
    }
    await Promise.all(Array.from({ length: want }, () => worker()));
    if (batch.status === "active") {
      const left = batch.items.some((item) => item.status === "pending" || item.status === "active");
      if (!left) {
        batch.status = "done";
        bump(batch);
      } else {
        kick(batch.userKey);
      }
    }
  }

  function resume() {
    load();
    const users = new Set(
      [...batches.values()].filter((batch) => batch.status === "active").map((batch) => batch.userKey)
    );
    for (const userKey of users) kick(userKey);
  }

  return {
    enqueue,
    cancel,
    snapshot,
    registerToken,
    unregisterToken,
    resume,
    _debug: { batches, tokens, get maxConcurrent() { return currentMaxConcurrent(); } },
  };
}
