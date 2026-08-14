/**
 * Account-wide server download queue (music + movies).
 * Source of truth while the process is alive: in-memory `jobs` Map.
 * Only jobs with intent/listInQueue (music downloads) or movie downloads are listed —
 * plain playback acquires stay hidden so other devices don't show false "downloads".
 */

const RECENT_DONE_MS = 10 * 60 * 1000; // 10 min — show completed jobs after app relaunch

function isTerminalDone(job) {
  const status = String(job?.status || "");
  return status === "done" || job?.ready === true;
}

function isTerminalError(job) {
  const status = String(job?.status || "");
  return status === "error" || status === "cancelled";
}

/**
 * Mark job eligible for the shared account download queue.
 */
export function markJobListed(job, { kind, title, url } = {}) {
  if (!job) return;
  job.listInQueue = true;
  if (kind) job.kind = job.kind || kind;
  if (title && !job.name) job.name = title;
  if (url) {
    if (kind === "movie" || job.kind === "movie") {
      job.movieUrl = job.movieUrl || url;
    } else {
      job.trackUrl = job.trackUrl || url;
      job.url = job.url || url;
    }
  }
  if (!job.queuedAt) job.queuedAt = Date.now();
}

/**
 * Apply SSE / progress payload onto the job and queue metadata.
 */
export function noteJobProgress(job, payload = {}) {
  if (!job) return;
  if (payload.status != null) job.status = payload.status;
  if (payload.progress != null) job.progress = Number(payload.progress) || 0;
  if (payload.error != null) job.error = payload.error;
  if (payload.ready === true) job.ready = true;
  if (payload.status === "done" || payload.ready === true) {
    if (!job.finishedAt) job.finishedAt = Date.now();
    job.progress = 100;
    job.ready = true;
  }
  if (payload.status === "error" || payload.status === "cancelled") {
    job.finishedAt = Date.now();
  }
}

function shouldListJob(job, userKey) {
  if (!job || !userKey || job.userKey !== userKey) return false;
  if (job.purpose === "preview") return false;
  if (job.cancelled && !job.finishedAt) return false;

  const kind = job.kind === "music" ? "music" : job.kind === "movie" ? "movie" : null;
  if (kind === "music") {
    if (job.intent !== "download" && !job.listInQueue) return false;
  } else if (kind === "movie") {
    if (job.purpose && job.purpose !== "download") return false;
  } else if (!job.listInQueue) {
    return false;
  }

  if (isTerminalError(job)) {
    const finishedAt = Number(job.finishedAt || 0);
    return finishedAt && Date.now() - finishedAt < RECENT_DONE_MS;
  }

  if (isTerminalDone(job) && !job.cdaFullPending) {
    const finishedAt = Number(job.finishedAt || 0);
    return finishedAt && Date.now() - finishedAt < RECENT_DONE_MS;
  }

  return true;
}

function serializeJob(job) {
  const kind = job.kind === "music" ? "music" : "movie";
  const url =
    kind === "music"
      ? String(job.trackUrl || job.url || "")
      : String(job.movieUrl || job.url || "");
  const title =
    String(job.name || job.movieTitle || "").trim() ||
    (kind === "music" ? "Utwór" : "Film");
  const status = String(job.status || (job.ready ? "done" : "starting"));
  let progress = Number(job.progress);
  if (!Number.isFinite(progress)) progress = job.ready ? 100 : 0;
  if (status === "done" || job.ready) progress = Math.max(progress, 100);

  return {
    jobId: job.id,
    kind,
    status,
    progress: Math.max(0, Math.min(100, progress)),
    title,
    url,
    thumbnail: String(job.movieThumbnail || job.thumbnail || "") || null,
    error: job.error || null,
    ready: !!(job.ready || status === "done"),
    folderId: job.folderId || null,
    assetId: job.assetId || (kind === "music" ? job.id : null),
    queuedAt: job.queuedAt || null,
    finishedAt: job.finishedAt || null,
  };
}

/**
 * @param {Map<string, any>} jobs
 * @param {string} userKey
 */
export function listActiveDownloads(jobs, userKey) {
  if (!userKey || !jobs) return { items: [], music: [], movies: [] };
  const items = [];
  for (const job of jobs.values()) {
    if (!shouldListJob(job, userKey)) continue;
    items.push(serializeJob(job));
  }
  items.sort((a, b) => {
    const aDone = a.status === "done" || a.ready ? 1 : 0;
    const bDone = b.status === "done" || b.ready ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (b.queuedAt || 0) - (a.queuedAt || 0);
  });
  return {
    items,
    music: items.filter((x) => x.kind === "music"),
    movies: items.filter((x) => x.kind === "movie"),
  };
}
