/**
 * Durable per-account music download batch. The phone enqueues once; the worker
 * starts the next item without an active iPhone process.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sendLiveActivityPush } from "./live-activity-apns.js";

const RETRY_LIMIT = 4;
const BACKOFF_MS = [2000, 5000, 12000, 25000];

function canonicalIdentity(url) {
  return String(url || "").trim().toLowerCase().replace(/\/+$/, "");
}

export function createPlaylistBatchQueue({ filePath, ensureMusicAsset, cancelJob, onLog }) {
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

  function snapshot(userKey, batchId) {
    const batch = batchId
      ? batches.get(batchId)
      : [...batches.values()].find((item) => item.userKey === userKey && item.status === "active");
    if (!batch) return null;
    const completed = batch.items.filter((item) => item.status === "done").length;
    const failed = batch.items.filter((item) => item.status === "failed").length;
    const current = batch.items.find((item) => item.status === "active") || batch.items.find((item) => item.status === "pending");
    const total = Math.max(batch.items.length, 1);
    const itemProgress = current ? Number(current.progress) || 0 : 100;
    const overallProgress = (completed + itemProgress / 100) / total;
    const pending = batch.items.filter((item) => item.status === "pending" || item.status === "active").length;
    return {
      id: batch.id,
      completed,
      total,
      currentTitle: current?.title || batch.label,
      itemProgress,
      overallProgress,
      etaSeconds: pending * 25,
      phase: batch.status === "cancelled" ? "cancelled" : "server",
      revision: batch.revision,
      status: batch.status,
      failed,
    };
  }

  function contentState(batch) {
    const snap = snapshot(batch.userKey, batch.id) || {};
    return {
      itemProgress: Math.min(1, (snap.itemProgress || 0) / 100),
      overallProgress: Math.min(1, snap.overallProgress || 0),
      completed: snap.completed || 0,
      total: snap.total || 1,
      phase: snap.status === "cancelled" ? "Anulowanie" : "Na serwerze",
      title: snap.currentTitle || batch.label,
      secondsRemaining: snap.etaSeconds || 0,
      isFinished: batch.status === "done" || batch.status === "cancelled",
      currentItems: batch.items
        .filter((item) => item.status === "active")
        .slice(0, 2)
        .map((item) => ({ title: item.title, progress: Math.min(1, (item.progress || 0) / 100) })),
      batchId: batch.id,
      revision: batch.revision,
      updatedAt: new Date(batch.updatedAt).toISOString(),
      estimatedEndDate: new Date(Date.now() + (snap.etaSeconds || 0) * 1000).toISOString(),
    };
  }

  function notify(batch, priority) {
    const reg = tokens.get(batch.userKey);
    if (!reg?.token || (reg.batchId && reg.batchId !== batch.id)) return;
    const finished = batch.status === "done" || batch.status === "cancelled";
    sendLiveActivityPush({
      token: reg.token,
      event: finished ? "end" : "update",
      contentState: contentState(batch),
      priority: finished || priority === 10 ? 10 : 5,
      frequentPushesEnabled: !!reg.frequentPushesEnabled,
      dismissalDate: finished ? Math.floor(Date.now() / 1000) + 20 : undefined,
    }).catch((error) => log("apns", error?.message || error));
  }

  function enqueue({ userKey, folderId, label, tracks }) {
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

    let batch = [...batches.values()].find((item) => item.userKey === userKey && item.status === "active");
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
    const batch = batchId ? batches.get(batchId) : [...batches.values()].find((item) => item.userKey === userKey && item.status === "active");
    if (batch) notify(batch, 10);
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

  async function processUser(userKey) {
    const batch = [...batches.values()].find((item) => item.userKey === userKey && item.status === "active");
    if (!batch) return;
    const item = batch.items.find((row) => row.status === "pending" || row.status === "active");
    if (!item) {
      batch.status = "done";
      bump(batch);
      return;
    }
    if (item.status === "pending") {
      item.status = "active";
      item.progress = Math.max(item.progress, 3);
      bump(batch, { progressOnly: false });
    }
    try {
      const result = await ensureMusicAsset({
        userKey,
        url: item.url,
        folderId: batch.folderId || null,
        trackUrl: item.url,
        intent: "download",
        waitUntilPlayable: false,
      });
      item.jobId = result?.jobId || item.jobId;
      const started = Date.now();
      while (Date.now() - started < 12 * 60 * 1000) {
        if (batch.status === "cancelled") return;
        const jobReady = result?.persistent || result?.onServer || result?.ready;
        if (jobReady && result?.persistent !== false && (result?.onServer || result?.persistent)) {
          item.status = "done";
          item.progress = 100;
          bump(batch);
          break;
        }
        if (result?.jobId && typeof result.poll === "function") {
          const live = await result.poll();
          if (live?.status === "error") throw new Error(live.error || "Błąd zapisu");
          if (live?.progress != null) {
            const next = Math.max(item.progress, Number(live.progress) || 0);
            if (next + 0.0001 >= item.progress) item.progress = next;
            if (item.progress - (item.lastNotifiedProgress || 0) >= 1 || Date.now() - (item.lastNotifyAt || 0) > 4000) {
              item.lastNotifiedProgress = item.progress;
              item.lastNotifyAt = Date.now();
              bump(batch, { progressOnly: true });
            }
          }
          if (live?.ready || live?.onServer || live?.status === "done") {
            item.status = "done";
            item.progress = 100;
            bump(batch);
            break;
          }
        } else if (result?.onServer || result?.persistent) {
          item.status = "done";
          item.progress = 100;
          bump(batch);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (item.status !== "done") throw new Error("Przekroczono czas zapisu na serwerze.");
    } catch (error) {
      item.attempts += 1;
      item.error = error?.message || "Błąd zapisu";
      if (item.attempts >= RETRY_LIMIT) {
        item.status = "failed";
        bump(batch);
      } else {
        item.status = "pending";
        bump(batch, { progressOnly: true });
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[item.attempts - 1] || 25000));
      }
    }
    if (batch.status === "active") kick(userKey);
  }

  function resume() {
    load();
    const users = new Set([...batches.values()].filter((batch) => batch.status === "active").map((batch) => batch.userKey));
    for (const userKey of users) kick(userKey);
  }

  return {
    enqueue,
    cancel,
    snapshot,
    registerToken,
    unregisterToken,
    resume,
    _debug: { batches, tokens },
  };
}
