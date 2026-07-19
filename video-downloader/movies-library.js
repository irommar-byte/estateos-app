import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import {
  favoritesUserKeyFromReq,
  hashUserId,
  reconcileSessionStorage,
} from "./movies-favorites.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR =
  process.env.MOVIES_LIBRARY_DIR ||
  path.join(__dirname, "data", "movies-library");

export const MOVIES_FOLDER_NAME = "MOVIES";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function libraryFile(userKey) {
  return path.join(DATA_DIR, `${userKey}.json`);
}

function emptyStore() {
  return { downloads: [] };
}

function readStore(userKey) {
  ensureDir(DATA_DIR);
  const file = libraryFile(userKey);
  if (!fs.existsSync(file)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      downloads: Array.isArray(raw.downloads) ? raw.downloads : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(userKey, store) {
  ensureDir(DATA_DIR);
  const file = libraryFile(userKey);
  fs.writeFileSync(file, JSON.stringify(store, null, 0) + "\n", { mode: 0o600 });
  return store;
}

export function mergeMoviesLibraryStoreKey(fromStoreKey, toUserId) {
  const toKey = hashUserId(toUserId);
  if (fromStoreKey === toKey) return readStore(toKey);

  const legacy = readStore(fromStoreKey);
  if (!legacy.downloads.length) return readStore(toKey);

  const merged = readStore(toKey);
  const byUrl = new Map(merged.downloads.map((d) => [d.url, d]));
  for (const item of legacy.downloads) {
    if (!item?.url || byUrl.has(item.url)) continue;
    byUrl.set(item.url, item);
  }
  const next = writeStore(toKey, { downloads: [...byUrl.values()] });
  try {
    fs.unlinkSync(libraryFile(fromStoreKey));
  } catch {
    /* keep legacy file if delete fails */
  }
  return next;
}

function userKeyFromReq(req) {
  reconcileSessionStorage(req, mergeMoviesLibraryStoreKey);
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  return userKey;
}

export function moviesDownloadDir(downloadsRoot) {
  return path.join(downloadsRoot, MOVIES_FOLDER_NAME);
}

function normalizeDownload(raw) {
  const url = String(raw?.url || "").trim();
  if (!url) return null;
  return {
    url,
    title: String(raw?.title || "Bez tytułu").slice(0, 500),
    thumbnail: String(raw?.thumbnail || "").slice(0, 2000),
    source: String(raw?.source || "").slice(0, 200),
    downloadJobId: String(raw?.downloadJobId || "").slice(0, 80),
    filename: String(raw?.filename || "").slice(0, 260),
    downloadedAt: Number(raw?.downloadedAt) || Date.now(),
  };
}

function listMp4Files(moviesDir) {
  if (!fs.existsSync(moviesDir)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.mp4$/i.test(name)) {
        out.push(full);
      }
    }
  };
  walk(moviesDir);
  return out;
}

export function buildMovieFilename({ title, jobId }) {
  const stem = String(title || "film")
    .replace(/[^\p{L}\p{N}\-_. ]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "film";
  const suffix = String(jobId || "").slice(0, 8) || "local";
  return `${stem}-${suffix}.mp4`;
}

export function seriesFolderFromTitle(title) {
  const raw = String(title || "");
  const sep = " · ";
  const idx = raw.indexOf(sep);
  if (idx <= 0) return null;
  const name = raw
    .slice(0, idx)
    .replace(/[^\p{L}\p{N}\-_. ]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return name || null;
}

export function moviesFileDestPath(downloadsRoot, { title, jobId }, { ensureDir = true } = {}) {
  const filename = buildMovieFilename({ title, jobId });
  const moviesDir = moviesDownloadDir(downloadsRoot);
  const seriesDir = seriesFolderFromTitle(title);
  if (seriesDir) {
    const dir = path.join(moviesDir, seriesDir);
    if (ensureDir) fs.mkdirSync(dir, { recursive: true });
    return {
      filePath: path.join(dir, filename),
      relativeName: path.join(seriesDir, filename),
      seriesDir,
    };
  }
  if (ensureDir) fs.mkdirSync(moviesDir, { recursive: true });
  return {
    filePath: path.join(moviesDir, filename),
    relativeName: filename,
    seriesDir: null,
  };
}

function reconcileDownloadsFromDisk(store, moviesDir) {
  if (!moviesDir || !fs.existsSync(moviesDir)) return false;
  let changed = false;
  const files = listMp4Files(moviesDir).map((filePath) => ({
    filePath,
    name: path.basename(filePath),
    relativeName: path.relative(moviesDir, filePath),
  }));

  for (const entry of store.downloads) {
    if (!entry.downloadJobId) continue;
    const expected = entry.filename
      ? path.join(moviesDir, entry.filename)
      : null;
    if (expected && fs.existsSync(expected)) continue;

    const suffix = entry.downloadJobId.slice(0, 8);
    const match = files.find(
      (f) =>
        f.name.includes(suffix) ||
        f.relativeName.includes(suffix)
    );
    if (match) {
      entry.filename = match.relativeName;
      changed = true;
    }
    // Never wipe downloadJobId when file is temporarily missing — that breaks offline library.
  }

  for (const file of files) {
    const jobSuffix = file.name.match(/-([a-f0-9]{8})\.mp4$/i)?.[1];
    if (!jobSuffix) continue;
    const hasEntry = store.downloads.some(
      (d) => d.downloadJobId?.startsWith(jobSuffix) || d.filename === file.name
    );
    if (hasEntry) continue;
  }

  return changed;
}

export function listMovieDownloads(req, downloadsRoot = null) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const moviesDir = downloadsRoot ? moviesDownloadDir(downloadsRoot) : null;
  if (moviesDir && reconcileDownloadsFromDisk(store, moviesDir)) {
    writeStore(userKey, store);
  }
  return store.downloads
    .filter((d) => d.downloadJobId)
    .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
}

export function findDownloadByUrl(userKey, url) {
  const store = readStore(userKey);
  return store.downloads.find((d) => d.url === url) || null;
}

export function findDownloadByJobId(userKey, jobId) {
  const store = readStore(userKey);
  return store.downloads.find((d) => d.downloadJobId === jobId) || null;
}

export function linkMovieDownload(req, raw) {
  const userKey = userKeyFromReq(req);
  return linkMovieDownloadByKey(userKey, raw);
}

export function linkMovieDownloadByKey(userKey, raw, downloadsRoot = null) {
  const url = String(raw?.url || "").trim();
  const downloadJobId = String(raw?.downloadJobId || "").trim();
  const filename = String(raw?.filename || "").trim();
  if (!url || !downloadJobId) throw new Error("Brak danych pobrania filmu.");

  const store = readStore(userKey);
  const existing = store.downloads.find((d) => d.url === url);
  const previousJobId = existing?.downloadJobId;
  const previousFilename = existing?.filename;
  const next = normalizeDownload({
    url,
    title: raw?.title || existing?.title || "Film",
    thumbnail: raw?.thumbnail || existing?.thumbnail || "",
    source: raw?.source || existing?.source || "",
    downloadJobId,
    filename: filename || existing?.filename || "",
    downloadedAt: Date.now(),
  });

  if (existing) {
    Object.assign(existing, next);
  } else {
    store.downloads.push(next);
  }
  writeStore(userKey, store);

  if (
    downloadsRoot &&
    previousJobId &&
    previousJobId !== downloadJobId
  ) {
    const oldFile =
      (previousFilename && path.join(moviesDownloadDir(downloadsRoot), previousFilename)) ||
      resolvePersistedMovieFile(userKey, previousJobId, downloadsRoot);
    if (oldFile && fs.existsSync(oldFile)) {
      try {
        fs.unlinkSync(oldFile);
      } catch {
        /* ignore */
      }
    }
  }

  return next;
}

export function deleteMovieDownload(req, url, downloadsRoot = null) {
  const userKey = userKeyFromReq(req);
  const targetUrl = String(url || "").trim();
  if (!targetUrl) throw new Error("Brak adresu filmu.");

  const store = readStore(userKey);
  const index = store.downloads.findIndex((d) => d.url === targetUrl);
  if (index < 0) throw new Error("Nie znaleziono pobranego materiału.");

  const entry = store.downloads[index];
  if (downloadsRoot && entry.downloadJobId) {
    const filePath = resolvePersistedMovieFile(userKey, entry.downloadJobId, downloadsRoot);
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore missing file */
      }
    }
  }

  store.downloads.splice(index, 1);
  writeStore(userKey, store);
  return { ok: true, url: targetUrl };
}

export function resolvePersistedMovieFile(userKey, jobId, downloadsRoot) {
  const entry = findDownloadByJobId(userKey, jobId);
  if (!entry) return null;

  const moviesDir = moviesDownloadDir(downloadsRoot);
  const candidates = [];
  if (entry.filename) {
    candidates.push(path.join(moviesDir, entry.filename));
  }
  if (fs.existsSync(moviesDir)) {
    const suffix = String(jobId).slice(0, 8);
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          walk(full);
        } else if (/\.mp4$/i.test(name) && name.includes(suffix)) {
          candidates.push(full);
        }
      }
    };
    walk(moviesDir);
  }

  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}
