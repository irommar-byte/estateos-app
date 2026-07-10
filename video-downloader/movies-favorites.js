import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR =
  process.env.MOVIES_FAVORITES_DIR ||
  path.join(__dirname, "data", "movies-favorites");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function hashUserId(id) {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 24);
}

/** Legacy bucket from web iframe before login was resolved (session cookie hash). */
export function sessionLegacyUserIdFromReq(req) {
  const session = String(
    req.get("X-Movies-Session") || req.get("x-movies-session") || ""
  ).trim();
  if (!session) return null;
  return `session:${session}`;
}

/** Merge anonymous session storage into player:login when both exist. */
export function reconcileSessionStorage(req, mergeByKey) {
  const userId = favoritesUserIdFromReq(req);
  if (!userId?.startsWith("player:")) return null;
  const legacyId = sessionLegacyUserIdFromReq(req);
  if (!legacyId) return null;
  const legacyKey = hashUserId(legacyId);
  const targetKey = hashUserId(userId);
  if (legacyKey === targetKey) return null;
  return mergeByKey(legacyKey, userId);
}

function playerId(login) {
  const name = String(login || "").trim().toLowerCase();
  if (!name || !/^[a-z0-9_]{2,32}$/.test(name)) return null;
  const stop = new Set([
    "admin",
    "built",
    "by",
    "coins",
    "filmy",
    "legacy",
    "login",
    "logout",
    "movies",
    "muzyka",
    "nc",
    "nostalgie",
    "panel",
    "players",
    "premium",
    "preserved",
    "ranking",
    "register",
    "swiat",
    "wspieram",
    "wyloguj",
    "zglos",
  ]);
  if (stop.has(name)) return null;
  return `player:${name}`;
}

/** Canonical storage id — always player:login when login is known. */
export function favoritesUserIdFromReq(req) {
  const login = String(
    req.get("X-Movies-User-Login") || req.get("x-movies-user-login") || ""
  )
    .trim()
    .toLowerCase();
  if (login) {
    const pid = playerId(login);
    if (pid) return pid;
  }

  const raw =
    req.get("X-Movies-User-Id") ||
    req.get("x-movies-user-id") ||
    "";
  const id = String(raw).trim();
  if (!id) return null;

  const playerMatch = id.match(/^player:(.+)$/i);
  if (playerMatch) {
    const pid = playerId(playerMatch[1]);
    if (pid) return pid;
  }
  return id;
}

export function favoritesUserKeyFromReq(req) {
  const userId = favoritesUserIdFromReq(req);
  if (!userId) return null;
  return hashUserId(userId);
}

export function mergeFavoritesStores(fromUserId, toUserId) {
  const fromKey = hashUserId(fromUserId);
  const toKey = hashUserId(toUserId);
  if (fromKey === toKey) return readStore(toKey);

  const legacy = readStore(fromKey);
  if (!legacy.length) return readStore(toKey);

  const merged = readStore(toKey);
  const byUrl = new Map(merged.map((x) => [x.url, x]));
  for (const item of legacy) {
    if (!item?.url || byUrl.has(item.url)) continue;
    byUrl.set(item.url, item);
  }
  const next = writeStore(toKey, [...byUrl.values()]);
  try {
    fs.unlinkSync(favoritesFile(fromKey));
  } catch {
    /* keep legacy file if delete fails */
  }
  return next;
}

/** One-off migration when only legacy storage key is known (session bucket). */
export function mergeFavoritesStoreKey(fromStoreKey, toUserId) {
  const toKey = hashUserId(toUserId);
  if (fromStoreKey === toKey) return readStore(toKey);
  const legacy = readStore(fromStoreKey);
  if (!legacy.length) return readStore(toKey);
  const merged = readStore(toKey);
  const byUrl = new Map(merged.map((x) => [x.url, x]));
  for (const item of legacy) {
    if (!item?.url || byUrl.has(item.url)) continue;
    byUrl.set(item.url, item);
  }
  const next = writeStore(toKey, [...byUrl.values()]);
  try {
    fs.unlinkSync(favoritesFile(fromStoreKey));
  } catch {
    /* keep legacy file if delete fails */
  }
  return next;
}

function favoritesFile(userKey) {
  return path.join(DATA_DIR, `${userKey}.json`);
}

function normalizeItem(raw) {
  const url = String(raw?.url || raw?.webpageUrl || "").trim();
  if (!url) return null;
  const type =
    raw?.type === "series" ? "series" : raw?.type === "music" ? "music" : "video";
  return {
    id: url,
    type,
    url,
    title: String(raw?.title || "Bez tytułu").slice(0, 500),
    thumbnail: String(raw?.thumbnail || "").slice(0, 2000),
    source: String(raw?.source || "").slice(0, 200),
    detail: String(raw?.detail || raw?.uploader || "").slice(0, 500),
    duration: Number(raw?.duration) || 0,
    quality: raw?.quality ?? null,
    addedAt: Number(raw?.addedAt) || Date.now(),
  };
}

function readStore(userKey) {
  ensureDir(DATA_DIR);
  const file = favoritesFile(userKey);
  if (!fs.existsSync(file)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeStore(userKey, items) {
  ensureDir(DATA_DIR);
  const file = favoritesFile(userKey);
  const sorted = [...items].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 0) + "\n", { mode: 0o600 });
  return sorted;
}

export function listFavorites(req) {
  reconcileSessionStorage(req, mergeFavoritesStoreKey);
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  return readStore(userKey);
}

export function addFavorite(req, raw) {
  reconcileSessionStorage(req, mergeFavoritesStoreKey);
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  const item = normalizeItem(raw);
  if (!item) throw new Error("Nieprawidłowy element ulubionych.");
  const items = readStore(userKey);
  const idx = items.findIndex((x) => x.url === item.url);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...item, addedAt: items[idx].addedAt || item.addedAt };
  } else {
    items.push(item);
  }
  writeStore(userKey, items);
  return item;
}

export function removeFavorite(req, url) {
  reconcileSessionStorage(req, mergeFavoritesStoreKey);
  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) throw new Error("Brak konta użytkownika.");
  const target = String(url || "").trim();
  if (!target) throw new Error("Brak adresu URL.");
  const next = readStore(userKey).filter((x) => x.url !== target);
  writeStore(userKey, next);
  return { removed: true, url: target };
}
