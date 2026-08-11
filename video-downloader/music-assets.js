/**
 * Durable per-user music asset registry.
 * After first successful APLMate acquisition, tracks live under:
 *   downloads/music/<userKey>/<artist>/<album>/<file>.mp3
 * Play and Download share ensureMusicAsset — no ephemeral play jobs.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import {
  buildAppleMusicInfo,
  downloadAppleMusicToFile,
  buildAppleMusicFilename,
  parseAppleMusicTrackId,
  resolveAppleMusicDownloadUrl,
} from "./apple-music.js";
import { updateTrackDownloadByKey, getMusicFolderByKey, playlistDownloadDir } from "./music-library.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASSETS_DATA_DIR =
  process.env.MUSIC_ASSETS_DIR || path.join(__dirname, "data", "music-assets");

/** userKey:canonicalKey -> jobId (in-flight acquisition) */
const activeAcquire = new Map();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizePathSegment(name) {
  return String(name || "unknown")
    .replace(/[^\p{L}\p{N}\-_. ]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "unknown";
}

export function canonicalMusicKey(url) {
  const raw = String(url || "").trim();
  if (/^eosmusic:\/\/opened\//i.test(raw)) {
    return `opened:${raw.slice("eosmusic://opened/".length)}`;
  }
  const trackId = parseAppleMusicTrackId(url);
  if (trackId) return `apple:${trackId}`;
  const normalized = raw.toLowerCase().replace(/[?#].*$/, "");
  return `url:${crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}

export function stableAssetId(userKey, url) {
  const key = `${userKey}|${canonicalMusicKey(url)}`;
  return `asset-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

function assetsFile(userKey) {
  return path.join(ASSETS_DATA_DIR, `${userKey}.json`);
}

function emptyAssetsStore() {
  return { version: 1, assets: [] };
}

export function readAssetsStore(userKey) {
  ensureDir(ASSETS_DATA_DIR);
  const file = assetsFile(userKey);
  if (!fs.existsSync(file)) return emptyAssetsStore();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      version: Number(raw?.version) || 1,
      assets: Array.isArray(raw?.assets) ? raw.assets : [],
    };
  } catch {
    return emptyAssetsStore();
  }
}

export function writeAssetsStoreAtomic(userKey, store) {
  ensureDir(ASSETS_DATA_DIR);
  const file = assetsFile(userKey);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(
    {
      version: store.version || 1,
      assets: Array.isArray(store.assets) ? store.assets : [],
      updatedAt: Date.now(),
    },
    null,
    0
  );
  fs.writeFileSync(tmp, payload + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
  return store;
}

export function musicFilesRoot(downloadsRoot) {
  return path.join(downloadsRoot, "music");
}

export function assetAbsolutePath(downloadsRoot, relativePath) {
  if (!relativePath) return null;
  const root = path.resolve(musicFilesRoot(downloadsRoot));
  const abs = path.resolve(root, relativePath);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

function fileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(1024 * 1024);
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function probeMp3(filePath) {
  const ffprobe =
    process.env.FFPROBE_PATH ||
    (ffmpegStatic ? path.join(path.dirname(ffmpegStatic), "ffprobe") : "ffprobe");
  const candidates = [ffprobe, "ffprobe"];
  for (const bin of candidates) {
    try {
      const r = spawnSync(
        bin,
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration,size,bit_rate:stream=codec_name,sample_rate,channels",
          "-of",
          "json",
          filePath,
        ],
        { encoding: "utf8", timeout: 20000 }
      );
      if (r.status !== 0 || !r.stdout) continue;
      const json = JSON.parse(r.stdout);
      const stream = (json.streams || []).find((s) => s.codec_name) || {};
      const format = json.format || {};
      const bytes = Number(format.size) || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
      if (bytes < 32 * 1024) throw new Error("Plik MP3 jest za mały.");
      return {
        duration: Math.round(Number(format.duration) || 0),
        bytes,
        bitrate: Math.round(Number(format.bit_rate) / 1000) || 0,
        codec: String(stream.codec_name || "mp3"),
        sampleRate: Number(stream.sample_rate) || 0,
        channels: Number(stream.channels) || 0,
      };
    } catch {
      /* try next */
    }
  }
  const bytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  if (bytes < 32 * 1024) throw new Error("Plik MP3 jest za mały.");
  return { duration: 0, bytes, bitrate: 0, codec: "mp3", sampleRate: 0, channels: 0 };
}

export function findAssetByUrl(userKey, url) {
  const key = canonicalMusicKey(url);
  const assetId = stableAssetId(userKey, url);
  const store = readAssetsStore(userKey);
  return (
    store.assets.find((a) => a.assetId === assetId || a.canonicalKey === key) || null
  );
}

export function findAssetById(userKey, assetId) {
  if (!userKey || !assetId) return null;
  const store = readAssetsStore(userKey);
  return store.assets.find((a) => a.assetId === assetId) || null;
}

export function assetFileReady(downloadsRoot, asset) {
  if (!asset?.relativePath) return false;
  const abs = assetAbsolutePath(downloadsRoot, asset.relativePath);
  return !!(abs && fs.existsSync(abs) && fs.statSync(abs).size > 32 * 1024);
}

function buildRelativePath(userKey, track, filename) {
  const artist = sanitizePathSegment(track.uploader || track.artistName || track.artist || "Unknown");
  const album = sanitizePathSegment(track.album || "Singles");
  return path.join(userKey, artist, album, filename);
}

function upsertAsset(userKey, asset) {
  const store = readAssetsStore(userKey);
  const idx = store.assets.findIndex((a) => a.assetId === asset.assetId);
  if (idx >= 0) store.assets[idx] = { ...store.assets[idx], ...asset };
  else store.assets.push(asset);
  writeAssetsStoreAtomic(userKey, store);
  return asset;
}

export function listMusicAssets(userKey, downloadsRoot) {
  const store = readAssetsStore(userKey);
  let totalBytes = 0;
  const items = store.assets.map((asset) => {
    const ready = assetFileReady(downloadsRoot, asset);
    const abs = assetAbsolutePath(downloadsRoot, asset.relativePath);
    const bytes = ready && abs ? fs.statSync(abs).size : Number(asset.bytes) || 0;
    if (ready) totalBytes += bytes;
    return {
      assetId: asset.assetId,
      url: asset.url,
      title: asset.title,
      artist: asset.artist,
      album: asset.album,
      thumbnail: asset.thumbnail || "",
      duration: asset.duration || 0,
      bytes,
      bitrate: asset.bitrate || 0,
      checksum: asset.checksum || "",
      ready,
      acquiredAt: asset.acquiredAt || 0,
      relativePath: asset.relativePath || "",
    };
  });
  return {
    count: items.filter((i) => i.ready).length,
    totalBytes,
    items: items.sort((a, b) => (b.acquiredAt || 0) - (a.acquiredAt || 0)),
  };
}

export function deleteMusicAsset(userKey, assetId, downloadsRoot) {
  const store = readAssetsStore(userKey);
  const asset = store.assets.find((a) => a.assetId === assetId);
  if (!asset) throw new Error("Asset nie istnieje.");
  const abs = assetAbsolutePath(downloadsRoot, asset.relativePath);
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {}
    // best-effort remove empty album/artist dirs
    try {
      const albumDir = path.dirname(abs);
      if (fs.existsSync(albumDir) && fs.readdirSync(albumDir).length === 0) fs.rmdirSync(albumDir);
      const artistDir = path.dirname(albumDir);
      if (fs.existsSync(artistDir) && fs.readdirSync(artistDir).length === 0) fs.rmdirSync(artistDir);
    } catch {}
  }
  store.assets = store.assets.filter((a) => a.assetId !== assetId);
  writeAssetsStoreAtomic(userKey, store);
  return { ok: true, assetId };
}

export function restoreJobFromAsset(asset, downloadsRoot, { ensurePlayToken, jobs }) {
  const abs = assetAbsolutePath(downloadsRoot, asset.relativePath);
  if (!abs || !fs.existsSync(abs)) return null;
  const job = {
    id: asset.assetId,
    kind: "music",
    purpose: "download",
    persistent: true,
    userKey: asset.userKey,
    status: "done",
    progress: 100,
    ready: true,
    file: abs,
    name: path.basename(abs),
    assetId: asset.assetId,
    trackUrl: asset.url,
    clients: new Set(),
  };
  ensurePlayToken?.(job);
  jobs?.set?.(job.id, job);
  return job;
}

/**
 * Migrate legacy playlist-folder MP3s + downloadJobId into asset registry (non-destructive).
 */
export function migrateLegacyMusicAssets(userKey, downloadsRoot, tracks = []) {
  const store = readAssetsStore(userKey);
  let added = 0;
  for (const track of tracks) {
    if (!track?.url || !/music\.apple\.com/i.test(track.url)) continue;
    const assetId = stableAssetId(userKey, track.url);
    if (store.assets.some((a) => a.assetId === assetId && a.relativePath)) continue;

    let sourceFile = null;
    // Prefer existing asset-style path if already present
    const guessName = buildAppleMusicFilename({
      title: track.title,
      uploader: track.artist || "",
      artistName: track.artist || "",
    });
    const folder = track.folderId ? getMusicFolderByKey(userKey, track.folderId) : null;
    if (folder?.name) {
      const dir = playlistDownloadDir(downloadsRoot, folder.name);
      const candidate = path.join(dir, guessName);
      if (fs.existsSync(candidate)) sourceFile = candidate;
      else if (fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          if (/\.mp3$/i.test(name) && name.toLowerCase().includes(String(track.title || "").slice(0, 12).toLowerCase())) {
            sourceFile = path.join(dir, name);
            break;
          }
        }
      }
    }
    if (!sourceFile) continue;

    const rel = buildRelativePath(
      userKey,
      { uploader: track.artist, album: track.album || "Imported", title: track.title },
      path.basename(sourceFile)
    );
    const dest = assetAbsolutePath(downloadsRoot, rel);
    ensureDir(path.dirname(dest));
    if (!fs.existsSync(dest)) {
      try {
        fs.copyFileSync(sourceFile, dest);
      } catch {
        continue;
      }
    }
    let probe = { duration: Number(track.duration) || 0, bytes: fs.statSync(dest).size, bitrate: 0, codec: "mp3" };
    try {
      probe = probeMp3(dest);
    } catch {
      /* keep size */
    }
    store.assets.push({
      assetId,
      userKey,
      canonicalKey: canonicalMusicKey(track.url),
      url: track.url,
      title: track.title || path.basename(sourceFile),
      artist: track.artist || "",
      album: track.album || "",
      thumbnail: track.thumbnail || "",
      relativePath: rel,
      bytes: probe.bytes,
      duration: probe.duration,
      bitrate: probe.bitrate,
      codec: probe.codec,
      checksum: "",
      status: "ready",
      acquiredAt: track.downloadedAt || Date.now(),
      legacyJobId: track.downloadJobId || "",
    });
    added += 1;
    try {
      updateTrackDownloadByKey(userKey, track.folderId, track.url, assetId);
    } catch {
      /* track may not be in that folder shape */
    }
  }
  if (added) writeAssetsStoreAtomic(userKey, store);
  return { added };
}

/**
 * Ensure durable server asset exists; returns { jobId, reused, ready? }.
 */
export async function ensureMusicAsset({
  userKey,
  url,
  folderId = null,
  trackUrl = null,
  jobs,
  sendEvent,
  ensurePlayToken,
  downloadsRoot,
  friendlyError,
  waitUntilPlayable = false,
}) {
  if (!userKey) {
    const err = new Error("Zaloguj się, aby odtwarzać i zapisywać muzykę w bibliotece EOS.");
    err.status = 401;
    throw err;
  }
  if (!url || !/music\.apple\.com/i.test(url)) {
    const err = new Error("Podaj link utworu Apple Music.");
    err.status = 400;
    throw err;
  }

  const assetId = stableAssetId(userKey, url);
  const inflightKey = `${userKey}:${canonicalMusicKey(url)}`;

  const tokenFor = (job) => {
    if (!job || !ensurePlayToken) return null;
    try {
      return ensurePlayToken(job) || null;
    } catch {
      return null;
    }
  };

  const playable = (job) => {
    if (!job) return false;
    if (job.file && fs.existsSync(job.file) && fs.statSync(job.file).size > 32 * 1024) return true;
    return job.mode === "stream-proxy" && !!job.streamUrl && (job.ready === true || job.status === "done");
  };

  const pack = (jobId, { reused, ready, job }) => ({
    jobId,
    assetId,
    reused: !!reused,
    ready: !!ready,
    token: ready ? tokenFor(job) : null,
  });

  const waitPlayable = async (jobId, timeoutMs = 120000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const job = jobs.get(jobId);
      if (job?.status === "error") {
        const err = new Error(job.error || "Odtwarzanie nie powiodło się.");
        err.status = 502;
        throw err;
      }
      if (playable(job)) return job;
      await new Promise((r) => setTimeout(r, 200));
    }
    const err = new Error("Przekroczono czas oczekiwania na przygotowanie utworu.");
    err.status = 504;
    throw err;
  };

  // Already ready on disk
  const existing = findAssetByUrl(userKey, url);
  if (existing && assetFileReady(downloadsRoot, existing)) {
    const job = restoreJobFromAsset(
      { ...existing, userKey },
      downloadsRoot,
      { ensurePlayToken, jobs }
    );
    if (folderId && (trackUrl || url)) {
      try {
        updateTrackDownloadByKey(userKey, folderId, trackUrl || url, assetId);
      } catch {
        /* ignore */
      }
    }
    return pack(job.id, { reused: true, ready: true, job });
  }

  // In-flight acquisition
  if (activeAcquire.has(inflightKey)) {
    const jobId = activeAcquire.get(inflightKey);
    if (waitUntilPlayable) {
      const job = await waitPlayable(jobId);
      return pack(jobId, { reused: true, ready: true, job });
    }
    const job = jobs.get(jobId);
    return pack(jobId, { reused: true, ready: playable(job), job });
  }

  const existingJob = jobs.get(assetId);
  if (
    existingJob?.kind === "music" &&
    !existingJob.cancelled &&
    existingJob.status !== "error" &&
    (playable(existingJob) || existingJob.status !== "done" || existingJob.persisting)
  ) {
    activeAcquire.set(inflightKey, assetId);
    if (waitUntilPlayable && !playable(existingJob)) {
      const job = await waitPlayable(assetId);
      return pack(assetId, { reused: true, ready: true, job });
    }
    return pack(assetId, { reused: true, ready: playable(existingJob), job: existingJob });
  }

  const job = {
    id: assetId,
    kind: "music",
    purpose: "download",
    persistent: true,
    userKey,
    folderId: folderId || null,
    trackUrl: trackUrl || url,
    assetId,
    status: "starting",
    progress: 0,
    clients: new Set(),
    partPath: null,
    persisting: false,
  };
  jobs.set(assetId, job);
  activeAcquire.set(inflightKey, assetId);

  const acquirePromise = (async () => {
    let partPath = null;
    try {
      job.status = "preparing";
      sendEvent?.(job, { status: "preparing", progress: 3, purpose: job.purpose, assetId });

      const track = await buildAppleMusicInfo(url);
      if (track.thumbnail) {
        track.thumbnail = String(track.thumbnail).replace(
          /\/(\d+)x(\d+)(bb)?(\.(?:jpg|png|webp))/i,
          "/1200x1200bb$4"
        );
      }
      job.name = track.title;
      const filename = buildAppleMusicFilename(track);
      const relativePath = buildRelativePath(userKey, track, filename);
      const destPath = assetAbsolutePath(downloadsRoot, relativePath);
      ensureDir(path.dirname(destPath));
      partPath = `${destPath}.part`;
      job.partPath = partPath;
      try {
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
      } catch {}

      // Resolve remote MP3 once — open stream-proxy ASAP so playback doesn't wait for full download.
      sendEvent?.(job, { status: "preparing", progress: 8, purpose: job.purpose, assetId });
      const downloadUrl = await resolveAppleMusicDownloadUrl(track.webpageUrl || url);

      job.mode = "stream-proxy";
      job.streamUrl = downloadUrl;
      job.streamContentType = "audio/mpeg";
      job.status = "done";
      job.ready = true;
      job.progress = 18;
      job.persisting = true;
      ensurePlayToken?.(job);
      sendEvent?.(job, {
        status: "done",
        ready: true,
        progress: 18,
        purpose: job.purpose,
        assetId,
        streaming: true,
      });

      // Persist to durable library in background (same URL, no second APLMate handshake).
      sendEvent?.(job, {
        status: "downloading",
        progress: 22,
        purpose: job.purpose,
        assetId,
        streaming: true,
      });

      // Fresh APLMate resolve for disk copy — keep streamUrl reserved for the player.
      await downloadAppleMusicToFile({
        appleUrl: url,
        destPath: partPath,
        trackMeta: track,
        downloadUrl: downloadUrl,
        onProgress: (pct) => {
          if (job.cancelled) return;
          // Keep stream-proxy playable while bytes land on disk.
          job.progress = Math.min(97, Math.max(22, Math.round(pct)));
          sendEvent?.(job, {
            status: "downloading",
            progress: job.progress,
            purpose: job.purpose,
            assetId,
            streaming: true,
            ready: true,
          });
        },
      });

      if (job.cancelled) {
        try {
          if (partPath && fs.existsSync(partPath)) fs.unlinkSync(partPath);
        } catch {}
        return;
      }

      const probe = probeMp3(partPath);
      fs.renameSync(partPath, destPath);
      job.partPath = null;
      partPath = null;

      const coverSidecar = path.join(path.dirname(destPath), "cover.jpg");
      if (track.thumbnail && !fs.existsSync(coverSidecar)) {
        try {
          const res = await fetch(track.thumbnail, {
            headers: { "User-Agent": "EOSMusic/1.0" },
            signal: AbortSignal.timeout(20000),
          });
          if (res.ok) {
            fs.writeFileSync(coverSidecar, Buffer.from(await res.arrayBuffer()));
          }
        } catch {
          /* optional */
        }
      }

      let checksum = "";
      try {
        checksum = fileSha256(destPath);
      } catch {
        /* optional */
      }

      upsertAsset(userKey, {
        assetId,
        userKey,
        canonicalKey: canonicalMusicKey(url),
        url,
        title: track.title || "",
        artist: track.uploader || "",
        album: track.album || "",
        thumbnail: track.thumbnail || "",
        relativePath,
        bytes: probe.bytes,
        duration: probe.duration || Number(track.duration) || 0,
        bitrate: probe.bitrate || 0,
        checksum,
        acquiredAt: Date.now(),
        ready: true,
      });

      job.file = destPath;
      job.mode = null;
      job.streamUrl = null;
      job.persisting = false;
      job.status = "done";
      job.ready = true;
      job.progress = 100;
      ensurePlayToken?.(job);
      sendEvent?.(job, {
        status: "done",
        ready: true,
        progress: 100,
        purpose: job.purpose,
        assetId,
      });

      if (folderId && (trackUrl || url)) {
        try {
          updateTrackDownloadByKey(userKey, folderId, trackUrl || url, assetId);
        } catch (err) {
          console.warn("music library asset link:", err?.message || err);
        }
      }
    } catch (err) {
      if (job.cancelled) return;
      try {
        if (partPath && fs.existsSync(partPath)) fs.unlinkSync(partPath);
      } catch {}
      // If stream-proxy was already open, keep it playable unless resolve failed entirely.
      if (!job.streamUrl && !job.file) {
        job.status = "error";
        job.ready = false;
        job.error = friendlyError ? friendlyError(err) : err?.message || String(err);
        sendEvent?.(job, { status: "error", error: job.error, purpose: job.purpose, assetId });
      } else {
        console.warn("music asset persist:", err?.message || err);
        job.persisting = false;
      }
    } finally {
      activeAcquire.delete(inflightKey);
    }
  })();

  job.acquirePromise = acquirePromise;

  if (waitUntilPlayable) {
    const readyJob = await waitPlayable(assetId);
    return pack(assetId, { reused: false, ready: true, job: readyJob });
  }

  return pack(assetId, { reused: false, ready: false, job });
}


export function resolveAssetJob(userKey, jobId, downloadsRoot, { ensurePlayToken, jobs }) {
  if (!userKey || !jobId) return null;
  const asset = findAssetById(userKey, jobId);
  if (!asset || !assetFileReady(downloadsRoot, asset)) return null;
  return restoreJobFromAsset({ ...asset, userKey }, downloadsRoot, { ensurePlayToken, jobs });
}

export function cleanupMusicJobCancel(job) {
  // Only remove incomplete .part — never album/playlist directories.
  if (job?.partPath && fs.existsSync(job.partPath)) {
    try {
      fs.unlinkSync(job.partPath);
    } catch {}
  }
  if (job?.file && String(job.file).endsWith(".part") && fs.existsSync(job.file)) {
    try {
      fs.unlinkSync(job.file);
    } catch {}
  }
}

/**
 * Import a user-provided audio file (opened from Files / share sheet) as a durable EOS asset.
 */
export async function importLocalMusicAsset({
  userKey,
  url,
  title,
  artist = "",
  album = "",
  fileBuffer,
  fileName,
  folderId = null,
  trackUrl = null,
  jobs,
  ensurePlayToken,
  downloadsRoot,
}) {
  if (!userKey) {
    const err = new Error("Zaloguj się, aby zapisać muzykę w bibliotece EOS.");
    err.status = 401;
    throw err;
  }
  if (!url || !/^eosmusic:\/\/opened\//i.test(String(url))) {
    const err = new Error("Nieprawidłowy identyfikator importowanego pliku.");
    err.status = 400;
    throw err;
  }
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length < 32 * 1024) {
    const err = new Error("Plik audio jest za mały lub uszkodzony.");
    err.status = 400;
    throw err;
  }

  const assetId = stableAssetId(userKey, url);
  const existing = findAssetByUrl(userKey, url);
  if (existing && assetFileReady(downloadsRoot, existing)) {
    const job = restoreJobFromAsset({ ...existing, userKey }, downloadsRoot, { ensurePlayToken, jobs });
    if (folderId && (trackUrl || url)) {
      try {
        updateTrackDownloadByKey(userKey, folderId, trackUrl || url, assetId);
      } catch {}
    }
    return {
      jobId: assetId,
      assetId,
      reused: true,
      ready: true,
      token: ensurePlayToken ? ensurePlayToken(job) : null,
    };
  }

  const safeName = String(fileName || "import.mp3").replace(/[^\p{L}\p{N}\-_. ]/gu, "_").slice(0, 120) || "import.mp3";
  const relativePath = buildRelativePath(
    userKey,
    { uploader: artist || "Import", album: album || "Otwarte pliki", title: title || safeName },
    safeName.endsWith(".mp3") ? safeName : `${safeName.replace(/\.[^.]+$/, "")}.mp3`
  );
  const destPath = assetAbsolutePath(downloadsRoot, relativePath);
  ensureDir(path.dirname(destPath));

  fs.writeFileSync(destPath, fileBuffer);

  let probe = { duration: 0, bytes: fileBuffer.length, bitrate: 0, codec: "mp3" };
  try {
    probe = probeMp3(destPath);
  } catch {
    /* keep size */
  }

  upsertAsset(userKey, {
    assetId,
    userKey,
    canonicalKey: canonicalMusicKey(url),
    url,
    title: title || safeName,
    artist: artist || "",
    album: album || "",
    thumbnail: "",
    relativePath,
    bytes: probe.bytes,
    duration: probe.duration,
    bitrate: probe.bitrate,
    codec: probe.codec,
    checksum: fileSha256(destPath),
    acquiredAt: Date.now(),
    ready: true,
  });

  const job = restoreJobFromAsset(
    {
      assetId,
      userKey,
      url,
      relativePath,
    },
    downloadsRoot,
    { ensurePlayToken, jobs }
  );

  if (folderId && (trackUrl || url)) {
    try {
      updateTrackDownloadByKey(userKey, folderId, trackUrl || url, assetId);
    } catch (err) {
      console.warn("music local import link:", err?.message || err);
    }
  }

  return {
    jobId: assetId,
    assetId,
    reused: false,
    ready: true,
    token: ensurePlayToken && job ? ensurePlayToken(job) : null,
  };
}

