import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "node:url";
import { buildAppleMusicFilename } from "./apple-music.js";
import {
  favoritesUserKeyFromReq,
  hashUserId,
  reconcileSessionStorage,
} from "./movies-favorites.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR =
  process.env.MUSIC_LIBRARY_DIR ||
  path.join(__dirname, "data", "music-library");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function libraryFile(userKey) {
  return path.join(DATA_DIR, `${userKey}.json`);
}

function emptyStore() {
  return { folders: [], tracks: [] };
}

function readStore(userKey) {
  ensureDir(DATA_DIR);
  const file = libraryFile(userKey);
  if (!fs.existsSync(file)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      folders: Array.isArray(raw.folders) ? raw.folders : [],
      tracks: Array.isArray(raw.tracks) ? raw.tracks : [],
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

export function mergeMusicLibraryStoreKey(fromStoreKey, toUserId) {
  const toKey = hashUserId(toUserId);
  if (fromStoreKey === toKey) return readStore(toKey);

  const legacy = readStore(fromStoreKey);
  const hasLegacyData =
    legacy.tracks.length > 0 ||
    legacy.folders.some((f) => f.name !== "Moja muzyka" || f.applePlaylistUrl);
  if (!hasLegacyData) return readStore(toKey);

  const merged = readStore(toKey);
  const folderById = new Map(merged.folders.map((f) => [f.id, f]));
  const folderByName = new Map(merged.folders.map((f) => [f.name.toLowerCase(), f]));

  for (const folder of legacy.folders) {
    if (folderById.has(folder.id)) continue;
    const byName = folderByName.get(folder.name.toLowerCase());
    if (byName) {
      if (!byName.applePlaylistUrl && folder.applePlaylistUrl) {
        byName.applePlaylistUrl = folder.applePlaylistUrl;
        byName.applePlaylistId = folder.applePlaylistId;
        byName.thumbnail = folder.thumbnail || byName.thumbnail;
      }
      continue;
    }
    merged.folders.push(folder);
    folderById.set(folder.id, folder);
    folderByName.set(folder.name.toLowerCase(), folder);
  }

  const trackKey = (t) => `${t.folderId}\0${t.url}`;
  const seen = new Set(merged.tracks.map(trackKey));
  for (const track of legacy.tracks) {
    const key = trackKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.tracks.push(track);
  }

  const next = writeStore(toKey, merged);
  try {
    fs.unlinkSync(libraryFile(fromStoreKey));
  } catch {
    /* keep legacy file if delete fails */
  }
  return next;
}

function userKeyFromReq(req) {
  reconcileSessionStorage(req, mergeMusicLibraryStoreKey);
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  return userKey;
}

export function sanitizePlaylistDirName(name) {
  return (
    String(name || "Moja muzyka")
      .replace(/[^\p{L}\p{N}\-_. ]/gu, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Moja muzyka"
  );
}

export function getMusicFolderByKey(userKey, folderId) {
  const store = readStore(userKey);
  return store.folders.find((f) => f.id === folderId) || null;
}

export function playlistDownloadDir(downloadsRoot, folderName) {
  return path.join(downloadsRoot, sanitizePlaylistDirName(folderName));
}

function upscaleArtwork(url, size = 600) {
  if (!url) return "";
  const u = String(url);
  if (/mzstatic\.com/i.test(u)) {
    return u.replace(/\/(\d+)x(\d+)(bb)?(\.(?:jpg|png|webp))/i, `/${size}x${size}bb$4`);
  }
  return u.replace(/\d+x\d+/i, `${size}x${size}`);
}

function normalizeFolder(raw) {
  const name = String(raw?.name || "").trim();
  if (!name) return null;
  return {
    id: String(raw?.id || crypto.randomUUID()),
    name: name.slice(0, 120),
    thumbnail: String(raw?.thumbnail || "").slice(0, 2000),
    applePlaylistUrl: String(raw?.applePlaylistUrl || "").slice(0, 2000),
    applePlaylistId: String(raw?.applePlaylistId || "").slice(0, 80),
    applePlaylistSyncedAt: Number(raw?.applePlaylistSyncedAt) || 0,
    createdAt: Number(raw?.createdAt) || Date.now(),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  };
}

function normalizeTrack(raw, folderId) {
  const url = String(raw?.url || "").trim();
  if (!url) return null;
  const isHttp = /^https?:\/\//i.test(url);
  const isExternal = /^eosmusic:\/\/external\//i.test(url);
  if (!isHttp && !isExternal) return null;
  const fid = String(folderId || raw?.folderId || "").trim();
  if (!fid) return null;
  return {
    id: url,
    folderId: fid,
    url,
    title: String(raw?.title || "Bez tytułu").slice(0, 500),
    artist: String(raw?.artist || raw?.uploader || "").slice(0, 300),
    album: String(raw?.album || "").slice(0, 300),
    thumbnail: String(raw?.thumbnail || "").slice(0, 2000),
    duration: Number(raw?.duration) || 0,
    quality: String(raw?.quality || "320 kbps").slice(0, 40),
    source: String(raw?.source || "apple-music").slice(0, 80),
    previewUrl: String(raw?.previewUrl || "").slice(0, 2000),
    artistId: String(raw?.artistId || "").slice(0, 40),
    albumId: String(raw?.albumId || "").slice(0, 40),
    trackNumber: Number(raw?.trackNumber) || 0,
    playlistIndex: Number(raw?.playlistIndex ?? raw?.trackNumber) || 0,
    downloadJobId: String(raw?.downloadJobId || raw?.serverAssetId || "").slice(0, 80),
    serverAssetId: String(raw?.serverAssetId || (String(raw?.downloadJobId || "").startsWith("asset-") ? raw.downloadJobId : "") || "").slice(0, 80),
    downloadedAt: Number(raw?.downloadedAt) || 0,
    syncAddedAt: Number(raw?.syncAddedAt) || 0,
    sortOrder: Number(raw?.sortOrder) || 0,
    addedAt: Number(raw?.addedAt) || Date.now(),
  };
}

function ensureDefaultFolder(store) {
  if (store.folders.length) return store;
  const folder = {
    id: crypto.randomUUID(),
    name: "Moja muzyka",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.folders.push(folder);
  return store;
}

function normalizeMusicTitleKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function listMp3Files(downloadsRoot, folderName) {
  if (!downloadsRoot) return [];
  const dir = playlistDownloadDir(downloadsRoot, folderName);
  try {
    return fs.readdirSync(dir).filter((name) => /\.mp3$/i.test(name));
  } catch {
    return [];
  }
}

function stablePersistJobId(folderId, url) {
  return `persist-${crypto
    .createHash("sha1")
    .update(`${folderId}\0${url}`)
    .digest("hex")
    .slice(0, 20)}`;
}

function trackMatchesFile(track, filename) {
  const expected = buildAppleMusicFilename({
    title: track.title,
    uploader: track.artist || "",
    artistName: track.artist || "",
  });
  if (expected.toLowerCase() === String(filename).toLowerCase()) return true;

  const titleKey = normalizeMusicTitleKey(track.title);
  const fileKey = normalizeMusicTitleKey(path.basename(filename, path.extname(filename)));
  if (!titleKey || !fileKey) return false;
  if (fileKey.includes(titleKey)) return true;
  const shortTitle = titleKey.split(" ").slice(0, 3).join(" ");
  return shortTitle.length > 2 && fileKey.includes(shortTitle);
}

function trackHasFileOnDisk(track, folder, downloadsRoot, files = null) {
  if (!downloadsRoot) return Boolean(track.downloadJobId);
  const mp3Files = files || listMp3Files(downloadsRoot, folder.name);
  const dir = playlistDownloadDir(downloadsRoot, folder.name);
  const expected = buildAppleMusicFilename({
    title: track.title,
    uploader: track.artist || "",
    artistName: track.artist || "",
  });
  if (fs.existsSync(path.join(dir, expected))) return true;
  return mp3Files.some((file) => trackMatchesFile(track, file));
}

export function reconcileFolderDownloads(store, folder, downloadsRoot) {
  if (!downloadsRoot) return { changed: false };
  const files = listMp3Files(downloadsRoot, folder.name);
  const tracks = store.tracks.filter((t) => t.folderId === folder.id);
  const usedFiles = new Set();
  let changed = false;

  for (const track of tracks) {
    if (!track.downloadJobId) continue;
    const match = files.find((file) => trackMatchesFile(track, file));
    if (match) {
      usedFiles.add(match);
      continue;
    }
    track.downloadJobId = "";
    track.downloadedAt = 0;
    changed = true;
  }

  for (const track of tracks) {
    if (track.downloadJobId) continue;
    const match = files.find((file) => !usedFiles.has(file) && trackMatchesFile(track, file));
    if (!match) continue;
    track.downloadJobId = stablePersistJobId(folder.id, track.url);
    track.downloadedAt = track.downloadedAt || Date.now();
    usedFiles.add(match);
    changed = true;
  }

  return { changed };
}

function folderStats(store, folder, downloadsRoot = null) {
  const tracks = store.tracks.filter((t) => t.folderId === folder.id);
  if (!downloadsRoot) {
    const downloadedTrackCount = tracks.filter(
      (track) =>
        Boolean(track.downloadJobId) ||
        Boolean(track.serverAssetId) ||
        Boolean(track.downloadedAt)
    ).length;
    return {
      trackCount: tracks.length,
      downloadedTrackCount,
      fileCount: downloadedTrackCount,
    };
  }
  const files = listMp3Files(downloadsRoot, folder.name);
  const downloadedTrackCount = tracks.filter((track) =>
    trackHasFileOnDisk(track, folder, downloadsRoot, files)
  ).length;

  return {
    trackCount: tracks.length,
    downloadedTrackCount,
    fileCount: files.length,
  };
}

function enrichStoreFromDisk(store, downloadsRoot) {
  if (!downloadsRoot) return false;
  let changed = false;
  for (const folder of store.folders) {
    const result = reconcileFolderDownloads(store, folder, downloadsRoot);
    if (result.changed) changed = true;
  }
  return changed;
}

function folderWithCounts(store, downloadsRoot = null) {
  return store.folders.map((folder) => ({
    ...folder,
    ...folderStats(store, folder, downloadsRoot),
  }));
}

export function linkFolderToApplePlaylist(userKey, folderId, { url, playlistId, title, thumbnail }) {
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  folder.applePlaylistUrl = String(url || "").trim().slice(0, 2000);
  folder.applePlaylistId = String(playlistId || "").trim().slice(0, 80);
  if (title && !folder.name) folder.name = String(title).slice(0, 120);
  const thumb = upscaleArtwork(thumbnail, 600);
  if (thumb) folder.thumbnail = thumb.slice(0, 2000);
  folder.applePlaylistSyncedAt = Date.now();
  folder.updatedAt = Date.now();
  writeStore(userKey, store);
  return { ...folder, ...folderStats(store, folder, null) };
}

export function findMusicFolderForImport(userKey, { playlistId, url, name }) {
  const store = readStore(userKey);
  const pid = String(playlistId || "").trim();
  const sourceUrl = String(url || "").trim();
  const desiredName = String(name || "").trim().toLowerCase();

  if (pid) {
    const byId = store.folders.find((f) => f.applePlaylistId === pid);
    if (byId) return byId;
  }
  if (sourceUrl) {
    const byUrl = store.folders.find((f) => f.applePlaylistUrl === sourceUrl);
    if (byUrl) return byUrl;
  }
  if (desiredName) {
    const byName = store.folders.find((f) => f.name.trim().toLowerCase() === desiredName);
    if (byName) return byName;
  }
  return null;
}

export function syncAppleMusicPlaylistFolder(req, folderId, fetchPlaylist, downloadsRoot = null) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  const sourceUrl = String(folder.applePlaylistUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("Ten folder nie jest powiązany z playlistą Apple Music.");
  }

  return fetchPlaylist(sourceUrl).then((data) => {
    const trackPayloads = data.tracks.map((track, idx) => ({
      url: track.url,
      title: track.title,
      artist: track.artist || track.uploader,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      quality: track.quality || "320 kbps",
      source: track.source || "apple-music",
      previewUrl: track.previewUrl,
      artistId: track.artistId,
      albumId: track.albumId,
      trackNumber: track.trackNumber || idx + 1,
      playlistIndex: idx + 1,
    }));

    folder.applePlaylistSyncedAt = Date.now();
    folder.updatedAt = Date.now();
    writeStore(userKey, store);

    const result = importTracksToFolder(req, folderId, trackPayloads, { markNewOnSync: true });
    linkFolderToApplePlaylist(userKey, folderId, {
      url: sourceUrl,
      playlistId: data.playlist?.id,
      title: data.playlist?.title,
      thumbnail: data.playlist?.thumbnail,
    });
    let finalStore = readStore(userKey);
    if (enrichStoreFromDisk(finalStore, downloadsRoot)) {
      writeStore(userKey, finalStore);
      finalStore = readStore(userKey);
    }
    const linked = finalStore.folders.find((f) => f.id === folderId);
    const stats = folderStats(finalStore, linked, downloadsRoot);
    return {
      ok: true,
      playlist: data.playlist,
      folder: { ...linked, ...stats },
      added: result.added,
      skipped: result.skipped,
      remoteTrackCount: data.tracks.length,
      localTrackCount: stats.trackCount,
      downloadedTrackCount: stats.downloadedTrackCount,
      fileCount: stats.fileCount,
    };
  });
}

export function listMusicLibrary(req, downloadsRoot = null) {
  const userKey = userKeyFromReq(req);
  let store = readStore(userKey);
  store = ensureDefaultFolder(store);
  if (!readStore(userKey).folders.length) {
    writeStore(userKey, store);
  }
  // Hot path: do not reconcile/scan disk on every library GET (large libraries
  // were blocking EOS Music splash + login). Counts use metadata instead.
  return {
    folders: folderWithCounts(store, null),
    tracks: store.tracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)),
  };
}

export function createMusicFolder(req, raw) {
  const userKey = userKeyFromReq(req);
  const folder = normalizeFolder(raw);
  if (!folder) throw new Error("Podaj nazwę folderu.");
  const store = readStore(userKey);
  folder.name = ensureUniqueFolderName(store, folder.name);
  if (store.folders.some((f) => f.name.toLowerCase() === folder.name.toLowerCase())) {
    throw new Error("Folder o tej nazwie już istnieje.");
  }
  store.folders.unshift(folder);
  writeStore(userKey, store);
  return { ...folder, trackCount: 0, downloadedTrackCount: 0, fileCount: 0 };
}

export function ensureUniqueFolderName(store, desiredName) {
  const base = String(desiredName || "Playlista").trim().slice(0, 120) || "Playlista";
  if (!store.folders.some((f) => f.name.toLowerCase() === base.toLowerCase())) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base.slice(0, 110)} (${i})`;
    if (!store.folders.some((f) => f.name.toLowerCase() === candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${base.slice(0, 100)} ${Date.now()}`;
}

export function importTracksToFolder(req, folderId, rawTracks, { markNewOnSync = false } = {}) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");

  let added = 0;
  let skipped = 0;
  const saved = [];
  const syncStamp = markNewOnSync ? Date.now() : 0;

  for (const raw of rawTracks || []) {
    const track = normalizeTrack(raw, folderId);
    if (!track) continue;
    const idx = store.tracks.findIndex((t) => t.url === track.url && t.folderId === folderId);
    if (idx >= 0) {
      skipped += 1;
      saved.push(store.tracks[idx]);
      continue;
    }
    if (syncStamp) track.syncAddedAt = syncStamp;
    store.tracks.push(track);
    saved.push(track);
    added += 1;
  }

  folder.updatedAt = Date.now();
  writeStore(userKey, store);
  const stats = folderStats(store, folder, null);
  return {
    folder: { ...folder, ...stats },
    added,
    skipped,
    tracks: saved,
  };
}

export function renameMusicFolder(req, folderId, raw, downloadsRoot = null) {
  const userKey = userKeyFromReq(req);
  const name = String(raw?.name || "").trim();
  if (!name) throw new Error("Podaj nazwę folderu.");
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  const previousName = folder.name;
  folder.name = name.slice(0, 120);
  folder.updatedAt = Date.now();
  writeStore(userKey, store);

  if (downloadsRoot) {
    try {
      const oldDir = playlistDownloadDir(downloadsRoot, previousName);
      const newDir = playlistDownloadDir(downloadsRoot, folder.name);
      if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
        fs.renameSync(oldDir, newDir);
      }
    } catch (err) {
      console.warn("music playlist dir rename:", err?.message || err);
    }
  }

  return { ...folder, ...folderStats(store, folder, null) };
}

export function deleteMusicFolder(req, folderId) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const idx = store.folders.findIndex((f) => f.id === folderId);
  if (idx < 0) throw new Error("Folder nie istnieje.");
  if (store.folders.length <= 1) {
    throw new Error("Nie można usunąć ostatniego folderu.");
  }
  store.folders.splice(idx, 1);
  store.tracks = store.tracks.filter((t) => t.folderId !== folderId);
  writeStore(userKey, store);
  return { removed: true, folderId };
}

export function listFolderTracks(req, folderId, downloadsRoot = null) {
  const userKey = userKeyFromReq(req);
  let store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  if (enrichStoreFromDisk(store, downloadsRoot)) {
    writeStore(userKey, store);
  }
  const tracks = store.tracks
    .filter((t) => t.folderId === folderId)
    .sort((a, b) => {
      const aManual = Number(a.sortOrder) || 0;
      const bManual = Number(b.sortOrder) || 0;
      if (aManual > 0 && bManual > 0 && aManual !== bManual) return aManual - bManual;
      if (aManual > 0 && bManual <= 0) return -1;
      if (bManual > 0 && aManual <= 0) return 1;
      const aSync = Number(a.syncAddedAt) || 0;
      const bSync = Number(b.syncAddedAt) || 0;
      if (aSync && bSync && aSync !== bSync) return bSync - aSync;
      if (aSync && !bSync) return -1;
      if (!aSync && bSync) return 1;
      const ai = Number(a.playlistIndex || a.trackNumber) || 0;
      const bi = Number(b.playlistIndex || b.trackNumber) || 0;
      if (ai > 0 && bi > 0 && ai !== bi) return ai - bi;
      if (ai > 0 && bi <= 0) return -1;
      if (bi > 0 && ai <= 0) return 1;
      return (a.addedAt || 0) - (b.addedAt || 0);
    });
  const stats = folderStats(store, folder, downloadsRoot);
  return { folder: { ...folder, ...stats }, tracks };
}

export function addTrackToFolder(req, folderId, raw) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  const track = normalizeTrack(raw, folderId);
  if (!track) throw new Error("Nieprawidłowy utwór.");
  const idx = store.tracks.findIndex((t) => t.url === track.url && t.folderId === folderId);
  if (idx >= 0) {
    store.tracks[idx] = { ...store.tracks[idx], ...track, addedAt: store.tracks[idx].addedAt || track.addedAt };
  } else {
    store.tracks.push(track);
  }
  folder.updatedAt = Date.now();
  writeStore(userKey, store);
  return track;
}

export function removeTrackFromFolder(req, folderId, url) {
  const userKey = userKeyFromReq(req);
  const target = String(url || "").trim();
  if (!target) throw new Error("Brak adresu utworu.");
  const store = readStore(userKey);
  const before = store.tracks.length;
  store.tracks = store.tracks.filter((t) => !(t.folderId === folderId && t.url === target));
  if (store.tracks.length === before) throw new Error("Utworu nie ma w tym folderze.");
  const folder = store.folders.find((f) => f.id === folderId);
  if (folder) folder.updatedAt = Date.now();
  writeStore(userKey, store);
  return { removed: true, url: target, folderId };
}

export function updateTrackDownload(req, folderId, url, downloadJobId) {
  const userKey = userKeyFromReq(req);
  return updateTrackDownloadByKey(userKey, folderId, url, downloadJobId);
}

export function updateTrackDownloadByKey(userKey, folderId, url, downloadJobId) {
  const target = String(url || "").trim();
  const jobId = String(downloadJobId || "").trim();
  if (!target || !jobId) throw new Error("Brak danych pobrania.");
  const store = readStore(userKey);
  const track = store.tracks.find((t) => t.folderId === folderId && t.url === target);
  if (!track) throw new Error("Utworu nie ma w tym folderze.");
  track.downloadJobId = jobId;
  if (String(jobId).startsWith("asset-")) track.serverAssetId = jobId;
  track.downloadedAt = Date.now();
  const folder = store.folders.find((f) => f.id === folderId);
  if (folder) folder.updatedAt = Date.now();
  writeStore(userKey, store);
  return track;
}

export function reorderFolderTracks(req, folderId, urls) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  const list = Array.isArray(urls) ? urls.map((u) => String(u || "").trim()).filter(Boolean) : [];
  if (!list.length) throw new Error("Brak kolejności utworów.");
  const folderTracks = store.tracks.filter((t) => t.folderId === folderId);
  const known = new Set(folderTracks.map((t) => t.url));
  for (const url of list) {
    if (!known.has(url)) throw new Error("Nieprawidłowa kolejność utworów.");
  }
  const fullOrder = [...list];
  for (const track of folderTracks) {
    if (!list.includes(track.url)) fullOrder.push(track.url);
  }
  fullOrder.forEach((url, idx) => {
    const track = store.tracks.find((t) => t.folderId === folderId && t.url === url);
    if (!track) return;
    track.sortOrder = idx + 1;
    track.playlistIndex = idx + 1;
    track.syncAddedAt = 0;
  });
  folder.updatedAt = Date.now();
  writeStore(userKey, store);
  return listFolderTracks(req, folderId);
}

export function findTrackByDownloadJob(userKey, jobId) {
  const store = readStore(userKey);
  return store.tracks.find((t) => t.downloadJobId === jobId) || null;
}
