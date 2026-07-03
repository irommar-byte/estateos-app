import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "node:url";
import { favoritesUserKeyFromReq } from "./movies-favorites.js";

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

function userKeyFromReq(req) {
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  return userKey;
}

function normalizeFolder(raw) {
  const name = String(raw?.name || "").trim();
  if (!name) return null;
  return {
    id: String(raw?.id || crypto.randomUUID()),
    name: name.slice(0, 120),
    createdAt: Number(raw?.createdAt) || Date.now(),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  };
}

function normalizeTrack(raw, folderId) {
  const url = String(raw?.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
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

function folderWithCounts(store) {
  return store.folders.map((folder) => ({
    ...folder,
    trackCount: store.tracks.filter((t) => t.folderId === folder.id).length,
  }));
}

export function listMusicLibrary(req) {
  const userKey = userKeyFromReq(req);
  let store = readStore(userKey);
  store = ensureDefaultFolder(store);
  if (!readStore(userKey).folders.length) {
    writeStore(userKey, store);
  }
  return {
    folders: folderWithCounts(store),
    tracks: store.tracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)),
  };
}

export function createMusicFolder(req, raw) {
  const userKey = userKeyFromReq(req);
  const folder = normalizeFolder(raw);
  if (!folder) throw new Error("Podaj nazwę folderu.");
  const store = readStore(userKey);
  if (store.folders.some((f) => f.name.toLowerCase() === folder.name.toLowerCase())) {
    throw new Error("Folder o tej nazwie już istnieje.");
  }
  store.folders.unshift(folder);
  writeStore(userKey, store);
  return { ...folder, trackCount: 0 };
}

export function renameMusicFolder(req, folderId, raw) {
  const userKey = userKeyFromReq(req);
  const name = String(raw?.name || "").trim();
  if (!name) throw new Error("Podaj nazwę folderu.");
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  folder.name = name.slice(0, 120);
  folder.updatedAt = Date.now();
  writeStore(userKey, store);
  return { ...folder, trackCount: store.tracks.filter((t) => t.folderId === folder.id).length };
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

export function listFolderTracks(req, folderId) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const folder = store.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder nie istnieje.");
  const tracks = store.tracks
    .filter((t) => t.folderId === folderId)
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  return { folder: { ...folder, trackCount: tracks.length }, tracks };
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
