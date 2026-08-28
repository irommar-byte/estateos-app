import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import {
  favoritesUserKeyFromReq,
  hashUserId,
  reconcileSessionStorage,
} from "./movies-favorites.js";
import { mergeMusicLibraryStoreKey } from "./music-library.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR =
  process.env.LISTENING_STATS_DIR ||
  path.join(__dirname, "data", "listening-stats");

const TIMESTAMP_HORIZON_DAYS = 90;
const MAX_TIMESTAMPS = 400;
const EVENING_HOURS = new Set([18, 19, 20, 21, 22, 23]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function statsFile(userKey) {
  return path.join(DATA_DIR, `${userKey}.json`);
}

function emptyStore() {
  return { updatedAt: 0, records: [] };
}

function readStore(userKey) {
  ensureDir(DATA_DIR);
  const file = statsFile(userKey);
  if (!fs.existsSync(file)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      updatedAt: Number(raw.updatedAt) || 0,
      records: Array.isArray(raw.records) ? raw.records : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(userKey, store) {
  ensureDir(DATA_DIR);
  const payload = {
    updatedAt: Date.now(),
    records: Array.isArray(store.records) ? store.records : [],
  };
  fs.writeFileSync(statsFile(userKey), JSON.stringify(payload, null, 0) + "\n", {
    mode: 0o600,
  });
  return payload;
}

function userKeyFromReq(req) {
  reconcileSessionStorage(req, mergeMusicLibraryStoreKey);
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  return userKey;
}

function trimTimestamps(timestamps) {
  const now = Date.now() / 1000;
  const horizon = now - TIMESTAMP_HORIZON_DAYS * 24 * 3600;
  const unique = [...new Set((timestamps || []).map((t) => Number(t)).filter((t) => t >= horizon))];
  unique.sort((a, b) => a - b);
  return unique.slice(-MAX_TIMESTAMPS);
}

function countEvening(timestamps) {
  let count = 0;
  for (const ts of timestamps || []) {
    const hour = new Date(Number(ts) * 1000).getHours();
    if (EVENING_HOURS.has(hour)) count += 1;
  }
  return count;
}

function normalizeRecord(raw) {
  const url = String(raw?.url || "").trim();
  if (!url) return null;
  const playTimestamps = trimTimestamps(raw.playTimestamps || []);
  const lastPlayedAt = Number(raw.lastPlayedAt) || 0;
  const firstPlayedAt = Number(raw.firstPlayedAt) || lastPlayedAt || 0;
  const playCount = Math.max(Number(raw.playCount) || 0, playTimestamps.length);
  return {
    url,
    title: String(raw.title || "Utwór"),
    artist: raw.artist ? String(raw.artist) : null,
    album: raw.album ? String(raw.album) : null,
    thumbnail: raw.thumbnail ? String(raw.thumbnail) : null,
    duration: raw.duration == null ? null : Number(raw.duration),
    folderId: raw.folderId ? String(raw.folderId) : null,
    playCount,
    lastPlayedAt,
    firstPlayedAt,
    totalListenSeconds: Math.max(0, Number(raw.totalListenSeconds) || 0),
    eveningPlayCount: countEvening(playTimestamps),
    playTimestamps,
  };
}

export function mergeListenRecord(a, b) {
  const left = normalizeRecord(a);
  const right = normalizeRecord(b);
  if (!left) return right;
  if (!right) return left;
  const newer = (left.lastPlayedAt || 0) >= (right.lastPlayedAt || 0) ? left : right;
  const playTimestamps = trimTimestamps([
    ...(left.playTimestamps || []),
    ...(right.playTimestamps || []),
  ]);
  const lastPlayedAt = Math.max(left.lastPlayedAt || 0, right.lastPlayedAt || 0);
  const firstPlayedAt = Math.min(
    left.firstPlayedAt || left.lastPlayedAt || Number.MAX_SAFE_INTEGER,
    right.firstPlayedAt || right.lastPlayedAt || Number.MAX_SAFE_INTEGER
  );
  return {
    url: left.url,
    title: newer.title || left.title || right.title,
    artist: newer.artist ?? left.artist ?? right.artist,
    album: newer.album ?? left.album ?? right.album,
    thumbnail: newer.thumbnail ?? left.thumbnail ?? right.thumbnail,
    duration: newer.duration ?? left.duration ?? right.duration,
    folderId: newer.folderId ?? left.folderId ?? right.folderId,
    playCount: Math.max(left.playCount || 0, right.playCount || 0, playTimestamps.length),
    lastPlayedAt,
    firstPlayedAt: Number.isFinite(firstPlayedAt) ? firstPlayedAt : lastPlayedAt,
    totalListenSeconds: Math.max(left.totalListenSeconds || 0, right.totalListenSeconds || 0),
    eveningPlayCount: countEvening(playTimestamps),
    playTimestamps,
  };
}

export function mergeListenRecords(existing, incoming) {
  const map = new Map();
  for (const raw of existing || []) {
    const record = normalizeRecord(raw);
    if (record) map.set(record.url, record);
  }
  for (const raw of incoming || []) {
    const record = normalizeRecord(raw);
    if (!record) continue;
    map.set(record.url, mergeListenRecord(map.get(record.url), record));
  }
  return Array.from(map.values());
}

export function getListeningStats(req) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  return {
    updatedAt: store.updatedAt,
    records: store.records.map((record) => normalizeRecord(record)).filter(Boolean),
  };
}

export function syncListeningStats(req, incomingRecords) {
  const userKey = userKeyFromReq(req);
  const store = readStore(userKey);
  const merged = mergeListenRecords(store.records, incomingRecords);
  const next = writeStore(userKey, { records: merged });
  return {
    updatedAt: next.updatedAt,
    records: next.records,
  };
}

export function mergeListeningStatsStoreKey(fromStoreKey, toUserId) {
  const toKey = hashUserId(toUserId);
  if (fromStoreKey === toKey) return readStore(toKey);
  const legacy = readStore(fromStoreKey);
  if (!legacy.records.length) return readStore(toKey);
  const current = readStore(toKey);
  const merged = mergeListenRecords(current.records, legacy.records);
  const next = writeStore(toKey, { records: merged });
  try {
    fs.unlinkSync(statsFile(fromStoreKey));
  } catch {
    /* keep legacy file if delete fails */
  }
  return next;
}
