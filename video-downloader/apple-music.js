import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import { solveTurnstileToken, turnstileSolverConfigured } from "./turnstile-solver.js";
import { enqueueAppleMusicResolve } from "./apl-resolve-queue.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const APLMATE_BASE = (process.env.APLMATE_BASE || "https://aplmate.com").replace(/\/$/, "");
const ITUNES_COUNTRY = process.env.APPLE_MUSIC_COUNTRY || "PL";
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const YT_DLP_PATH = process.env.YT_DLP_PATH || path.join(MODULE_DIR, "bin", "yt-dlp");

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  ingest(response) {
    const raw =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const line of raw) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

function upscaleArtwork(url, size = 1200) {
  if (!url) return "";
  const u = String(url);
  if (/mzstatic\.com/i.test(u)) {
    return u.replace(/\/(\d+)x(\d+)(bb)?(\.(?:jpg|png|webp))/i, `/${size}x${size}bb$4`);
  }
  return u.replace(/\d+x\d+/i, `${size}x${size}`);
}

export function parseAppleMusicTrackId(url) {
  try {
    const u = new URL(url);
    if (!/music\.apple\.com$/i.test(u.hostname.replace(/^www\./, ""))) return null;
    const iParam = u.searchParams.get("i");
    if (iParam && /^\d+$/.test(iParam)) return iParam;
    const parts = u.pathname.split("/").filter(Boolean);
    const songIdx = parts.indexOf("song");
    if (songIdx >= 0 && parts[songIdx + 2] && /^\d+$/.test(parts[songIdx + 2])) {
      return parts[songIdx + 2];
    }
    if (parts.includes("album") && iParam) return iParam;
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last) && parts.includes("album")) return null;
    return /^\d+$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

export function buildAppleMusicUrl(track) {
  if (track.trackViewUrl) {
    return track.trackViewUrl.replace(/\?uo=4$/i, "").split("&uo=")[0];
  }
  const country = (track.country || ITUNES_COUNTRY).toLowerCase();
  const slug = String(track.trackName || "track")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://music.apple.com/${country}/song/${slug}/${track.trackId}`;
}

export async function lookupAppleTrack(trackId, country = ITUNES_COUNTRY) {
  const api = new URL("https://itunes.apple.com/lookup");
  api.searchParams.set("id", String(trackId));
  api.searchParams.set("country", country);
  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`iTunes lookup HTTP ${res.status}`);
  const data = await res.json();
  const track = data.results?.[0];
  if (!track || track.wrapperType !== "track") {
    throw new Error("Nie znaleziono utworu w katalogu Apple Music.");
  }
  return track;
}

function mapAppleTrack(track, country = ITUNES_COUNTRY) {
  return {
    id: String(track.trackId),
    title: track.trackName || "Bez tytułu",
    url: buildAppleMusicUrl(track),
    thumbnail: upscaleArtwork(track.artworkUrl100 || track.artworkUrl60, 600),
    uploader: track.artistName || "Apple Music",
    artist: track.artistName || "",
    duration: Math.round((track.trackTimeMillis || 0) / 1000),
    quality: "MP3",
    qualities: ["320 kbps"],
    album: track.collectionName || "",
    albumId: track.collectionId ? String(track.collectionId) : "",
    artistId: track.artistId ? String(track.artistId) : "",
    trackNumber: track.trackNumber || null,
    previewUrl: track.previewUrl || "",
    trackId: String(track.trackId),
    source: "apple-music",
    detail: track.collectionName ? `${track.collectionName} · Apple Music` : "Apple Music",
  };
}

function mapAppleArtist(raw) {
  return {
    id: String(raw.artistId),
    name: raw.artistName || "Wykonawca",
    genre: raw.primaryGenreName || "",
    thumbnail: upscaleArtwork(raw.artworkUrl100 || raw.artworkUrl60, 600),
    url: raw.artistLinkUrl || `https://music.apple.com/${ITUNES_COUNTRY.toLowerCase()}/artist/${raw.artistId}`,
    source: "apple-music",
  };
}

function mapAppleAlbum(raw) {
  return {
    id: String(raw.collectionId),
    title: raw.collectionName || "Album",
    artist: raw.artistName || "",
    artistId: raw.artistId ? String(raw.artistId) : "",
    thumbnail: upscaleArtwork(raw.artworkUrl100 || raw.artworkUrl60, 600),
    trackCount: raw.trackCount || 0,
    releaseDate: raw.releaseDate || "",
    url: raw.collectionViewUrl || buildAlbumUrl(raw),
    source: "apple-music",
  };
}

function buildAlbumUrl(album) {
  const country = (album.country || ITUNES_COUNTRY).toLowerCase();
  const slug = String(album.collectionName || "album")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://music.apple.com/${country}/album/${slug}/${album.collectionId}`;
}

async function itunesSearch(params, country = ITUNES_COUNTRY) {
  const api = new URL("https://itunes.apple.com/search");
  api.searchParams.set("country", country);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) api.searchParams.set(key, String(value));
  }
  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`iTunes search HTTP ${res.status}`);
  return res.json();
}

async function itunesLookup(id, entity, limit = 50, country = ITUNES_COUNTRY) {
  const api = new URL("https://itunes.apple.com/lookup");
  api.searchParams.set("id", String(id));
  api.searchParams.set("country", country);
  if (entity) api.searchParams.set("entity", entity);
  if (limit) api.searchParams.set("limit", String(limit));
  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`iTunes lookup HTTP ${res.status}`);
  return res.json();
}

export async function searchAppleMusicCatalog(query, limits = {}, country = ITUNES_COUNTRY) {
  const q = String(query || "").trim();
  if (!q) return { query: q, artists: [], albums: [], songs: [] };

  const artistLimit = Math.min(Math.max(Number(limits.artists) || 8, 1), 20);
  const albumLimit = Math.min(Math.max(Number(limits.albums) || 12, 1), 24);
  const songLimit = Math.min(Math.max(Number(limits.songs) || 16, 1), 30);

  const [artistsData, albumsData, songsData] = await Promise.all([
    itunesSearch({ term: q, entity: "musicArtist", limit: artistLimit }, country),
    itunesSearch({ term: q, entity: "album", limit: albumLimit }, country),
    itunesSearch({ term: q, entity: "song", limit: songLimit }, country),
  ]);

  const seenArtists = new Set();
  const artists = (artistsData.results || [])
    .filter((item) => item.artistId && !seenArtists.has(item.artistId))
    .map((item) => {
      seenArtists.add(item.artistId);
      return mapAppleArtist(item);
    });

  const seenAlbums = new Set();
  const albums = (albumsData.results || [])
    .filter((item) => item.collectionId && !seenAlbums.has(item.collectionId))
    .map((item) => {
      seenAlbums.add(item.collectionId);
      return mapAppleAlbum(item);
    });

  const seenSongs = new Set();
  const songs = (songsData.results || [])
    .filter((track) => track.trackId && !seenSongs.has(track.trackId))
    .map((track) => {
      seenSongs.add(track.trackId);
      return mapAppleTrack(track, country);
    });

  return { query: q, artists, albums, songs };
}

export async function fetchAppleMusicArtist(artistId, country = ITUNES_COUNTRY) {
  const data = await itunesLookup(artistId, "album", 100, country);
  const rows = data.results || [];
  const artistRaw = rows.find((r) => r.wrapperType === "artist") || rows[0];
  if (!artistRaw?.artistId) throw new Error("Nie znaleziono wykonawcy.");

  const artist = mapAppleArtist(artistRaw);
  const seenAlbums = new Set();
  const albums = rows
    .filter((r) => r.wrapperType === "collection" && r.collectionId)
    .filter((r) => {
      if (seenAlbums.has(r.collectionId)) return false;
      seenAlbums.add(r.collectionId);
      return true;
    })
    .map(mapAppleAlbum)
    .sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")));

  const topData = await itunesLookup(artistId, "song", 25, country);
  const seenSongs = new Set();
  const topSongs = (topData.results || [])
    .filter((r) => r.wrapperType === "track" && r.trackId)
    .filter((r) => {
      if (seenSongs.has(r.trackId)) return false;
      seenSongs.add(r.trackId);
      return true;
    })
    .map((track) => mapAppleTrack(track, country));

  return { artist, albums, topSongs };
}

export async function fetchAppleMusicAlbum(albumId, country = ITUNES_COUNTRY) {
  const data = await itunesLookup(albumId, "song", 200, country);
  const rows = data.results || [];
  const albumRaw = rows.find((r) => r.wrapperType === "collection") || rows[0];
  if (!albumRaw?.collectionId) throw new Error("Nie znaleziono albumu.");

  const album = mapAppleAlbum(albumRaw);
  const tracks = rows
    .filter((r) => r.wrapperType === "track" && r.trackId)
    .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
    .map((track) => mapAppleTrack(track, country));

  return { album, tracks };
}

export function parseAppleMusicPlaylistUrl(input) {
  try {
    let raw = String(input || "").trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "").replace(/^embed\./i, "");
    if (host !== "music.apple.com") return null;

    const parts = u.pathname.split("/").filter(Boolean);
    const plIdx = parts.indexOf("playlist");
    if (plIdx < 0 || !parts[plIdx + 2]) return null;

    const country = String(parts[0] || ITUNES_COUNTRY).toUpperCase();
    const playlistId = parts[plIdx + 2];
    if (!/^pl\./i.test(playlistId)) return null;

    const canonicalPath = `/${country.toLowerCase()}/playlist/${parts[plIdx + 1]}/${playlistId}`;
    const fetchUrl = new URL(`https://music.apple.com${canonicalPath}`);
    fetchUrl.searchParams.set("l", country.toLowerCase());

    return {
      country,
      playlistId,
      slug: parts[plIdx + 1] || "playlist",
      canonicalUrl: fetchUrl.origin + canonicalPath,
      fetchUrl: fetchUrl.toString(),
    };
  } catch {
    return null;
  }
}

function parseIso8601Duration(iso) {
  const value = String(iso || "").trim();
  if (!/^PT/i.test(value)) return 0;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return 0;
  const hours = Number(match[1]) || 0;
  const minutes = Number(match[2]) || 0;
  const seconds = Number(match[3]) || 0;
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

async function lookupAppleTracksBatch(trackIds, country = ITUNES_COUNTRY) {
  const byId = new Map();
  const unique = [...new Set(trackIds.map(String).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const api = new URL("https://itunes.apple.com/lookup");
    api.searchParams.set("id", chunk.join(","));
    api.searchParams.set("country", country);
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`iTunes lookup HTTP ${res.status}`);
    const data = await res.json();
    for (const row of data.results || []) {
      if (row.wrapperType === "track" && row.trackId) {
        byId.set(String(row.trackId), row);
      }
    }
  }
  return byId;
}

function titleFromSongSlug(slug) {
  return decodeURIComponent(String(slug || "utwor"))
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([\p{L}\p{N}])/gu, (m) => m.toUpperCase());
}

export async function fetchAppleMusicPlaylist(inputUrl) {
  const parsed = parseAppleMusicPlaylistUrl(inputUrl);
  if (!parsed) {
    throw new Error("Podaj poprawny link playlisty Apple Music (music.apple.com/.../playlist/...).");
  }

  const res = await fetch(parsed.fetchUrl, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": `${parsed.country.toLowerCase()},en;q=0.8`,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(45000),
  });
  const isPersonalLibrary = /^pl\.u-/i.test(parsed.playlistId);
  if (!res.ok) {
    if (res.status === 404 || isPersonalLibrary) {
      throw new Error(
        isPersonalLibrary
          ? "To wygląda na prywatną playlistę Apple Music (Ulubione / biblioteka). Udostępnij ją publicznie albo wklej link do publicznej playlisty."
          : "Nie znaleziono playlisty Apple Music. Sprawdź link albo udostępnij playlistę publicznie."
      );
    }
    throw new Error(`Apple Music HTTP ${res.status}`);
  }

  const html = await res.text();
  const titleMatch = html.match(/<meta name="apple:title" content="([^"]*)"/i);
  const countMatch = html.match(/property="music:song_count" content="(\d+)"/i);
  const thumbMatch = html.match(/property="og:image" content="([^"]+)"/i);
  const songUrls = [...html.matchAll(/<meta property="music:song" content="([^"]+)"/gi)].map((m) => m[1]);
  const durations = [...html.matchAll(/property="music:song:duration" content="([^"]+)"/gi)].map((m) => m[1]);
  const trackNums = [...html.matchAll(/property="music:song:track" content="(\d+)"/gi)].map((m) => Number(m[1]));

  if (!songUrls.length) {
    throw new Error(
      isPersonalLibrary
        ? "Nie da się zaimportować prywatnej playlisty (np. Favourite Songs). W Apple Music: udostępnij playlistę → skopiuj publiczny link."
        : "Nie udało się odczytać utworów z playlisty — sprawdź, czy link jest publiczny."
    );
  }

  const entries = songUrls
    .map((songUrl, idx) => {
      const trackId =
        parseAppleMusicTrackId(songUrl) ||
        String(songUrl.split("/").pop()?.split("?")[0] || "").trim();
      return {
        songUrl: songUrl.split("&")[0],
        trackId,
        trackNumber: trackNums[idx] || idx + 1,
        duration: parseIso8601Duration(durations[idx]),
      };
    })
    .filter((entry) => entry.trackId);

  const lookup = await lookupAppleTracksBatch(
    entries.map((entry) => entry.trackId),
    parsed.country
  );

  const tracks = entries.map((entry) => {
    const raw = lookup.get(entry.trackId);
    if (raw) {
      const mapped = mapAppleTrack(raw, parsed.country);
      return { ...mapped, trackNumber: entry.trackNumber || mapped.trackNumber };
    }
    const slug = entry.songUrl.split("/song/")[1]?.split("/")[0] || "utwor";
    return {
      id: entry.trackId,
      title: titleFromSongSlug(slug),
      url: entry.songUrl,
      thumbnail: "",
      uploader: "",
      artist: "",
      album: "",
      duration: entry.duration,
      quality: "MP3",
      qualities: ["320 kbps"],
      albumId: "",
      artistId: "",
      trackNumber: entry.trackNumber,
      previewUrl: "",
      trackId: entry.trackId,
      source: "apple-music",
      detail: "Apple Music",
    };
  });

  return {
    playlist: {
      id: parsed.playlistId,
      title: titleMatch?.[1]?.trim() || "Playlista Apple Music",
      trackCount: Number(countMatch?.[1]) || tracks.length,
      thumbnail: thumbMatch?.[1] || "",
      url: parsed.canonicalUrl,
      source: "apple-music",
    },
    tracks,
  };
}

export async function searchAppleMusic(query, limit = 24, country = ITUNES_COUNTRY) {
  const target = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const data = await itunesSearch({ term: query, entity: "song", limit: target }, country);
  const seen = new Set();

  return (data.results || [])
    .filter((track) => {
      if (!track.trackId || seen.has(track.trackId)) return false;
      seen.add(track.trackId);
      return true;
    })
    .map((track) => mapAppleTrack(track, country));
}

function estimateMp3Bytes(durationSec, kbps = 320) {
  if (!durationSec) return 0;
  return Math.round((kbps * 1000 * durationSec) / 8);
}

export async function buildAppleMusicInfo(url) {
  const trackId = parseAppleMusicTrackId(url);
  if (!trackId) throw new Error("Nie rozpoznano utworu w linku Apple Music.");
  const track = await lookupAppleTrack(trackId);
  const durationSec = Math.round((track.trackTimeMillis || 0) / 1000);
  const sizeBytes = estimateMp3Bytes(durationSec, 320);

  return {
    isPlaylist: false,
    isMusicTrack: true,
    trackId: String(track.trackId),
    title: track.trackName || "Bez tytułu",
    uploader: track.artistName || "",
    album: track.collectionName || "",
    duration: durationSec,
    thumbnail: upscaleArtwork(track.artworkUrl100 || track.artworkUrl60, 600),
    webpageUrl: buildAppleMusicUrl(track),
    previewUrl: track.previewUrl || "",
    videoOptions: [],
    audioOptions: {
      mp3: [
        {
          id: "320",
          bitrate: 320,
          label: "320 kbps",
          detail: "MP3 · okładka w pliku",
          sizeBytes,
          sizeLabel: sizeBytes ? formatBytes(sizeBytes) : "—",
        },
      ],
      m4a: [],
    },
  };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function aplmateFetch(pathname, { method = "GET", body, jar, contentType }) {
  const headers = {
    "User-Agent": UA,
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${APLMATE_BASE}/`,
    Origin: APLMATE_BASE,
  };
  const cookie = jar?.header?.();
  if (cookie) headers.Cookie = cookie;

  let payload;
  if (body instanceof URLSearchParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    payload = body.toString();
  } else if (body instanceof FormData) {
    payload = body;
  } else if (body) {
    headers["Content-Type"] = contentType || "application/x-www-form-urlencoded; charset=UTF-8";
    payload = body;
  }

  const res = await fetch(`${APLMATE_BASE}${pathname}`, {
    method,
    headers,
    body: payload,
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });
  jar.ingest(res);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`APLMate HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  return text;
}

function extractTrackForm(html) {
  const dataMatch = html.match(/name="data" value='([^']+)'/);
  const baseMatch = html.match(/name="base" value="([^"]+)"/);
  const tokenMatch = html.match(/name="token" value="([^"]+)"/);
  if (!dataMatch || !baseMatch || !tokenMatch) {
    throw new Error("Nie udało się przygotować pobrania (brak formularza utworu).");
  }
  return {
    data: dataMatch[1],
    base: baseMatch[1],
    token: tokenMatch[1],
  };
}

function extractDownloadUrl(html) {
  const match = html.match(/href="(https:\/\/cdndl\.aplmate\.com\/mp3\?token=[^"]+)"/i);
  if (!match) {
    throw new Error("Serwer nie zwrócił linku do pobrania MP3.");
  }
  return match[1].replace(/\\\/\//g, "/");
}

const downloadUrlCache = new Map(); // appleUrl -> { url, expiresAt }
const downloadUrlInflight = new Map(); // appleUrl -> Promise<string>
const DOWNLOAD_URL_CACHE_TTL_MS = 20 * 60 * 1000;

export function invalidateAppleMusicDownloadCache(appleUrl) {
  const key = String(appleUrl || "").trim();
  if (key) downloadUrlCache.delete(key);
}

function cacheTtlForDownloadUrl(url) {
  try {
    const token = new URL(url).searchParams.get("token");
    if (!token) return DOWNLOAD_URL_CACHE_TTL_MS;
    const parts = token.split(".");
    if (parts.length === 3) {
      const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
      if (Number.isFinite(json?.exp)) {
        return Math.max(30_000, Math.min(DOWNLOAD_URL_CACHE_TTL_MS, json.exp * 1000 - Date.now() - 60_000));
      }
    }
  } catch {}
  return DOWNLOAD_URL_CACHE_TTL_MS;
}

export async function resolveAppleMusicDownloadUrl(appleUrl, { forceRefresh = false } = {}) {
  const key = String(appleUrl || "").trim();
  if (forceRefresh) downloadUrlCache.delete(key);
  const cached = downloadUrlCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() && cached.url) {
    return cached.url;
  }
  if (downloadUrlInflight.has(key)) return downloadUrlInflight.get(key);

  const task = (async () => {
    const resolved = await resolveAppleMusicDownloadUrlUncached(key);
    if (resolved) {
      downloadUrlCache.set(key, {
        url: resolved,
        expiresAt: Date.now() + cacheTtlForDownloadUrl(resolved),
      });
    }
    return resolved;
  })();
  downloadUrlInflight.set(key, task);
  try {
    return await task;
  } finally {
    downloadUrlInflight.delete(key);
  }
}


const FLARESOLVERR_URL = (process.env.FLARESOLVERR_URL || "http://127.0.0.1:8191").replace(/\/$/, "");
const APLMATE_FLARE_WAIT_S = Number(process.env.APLMATE_FLARE_WAIT_S || 3);
const APLMATE_SESSION_TTL_MS = Number(process.env.APLMATE_SESSION_TTL_MS || 12 * 60 * 1000);
const FLARESOLVERR_RESTART_REQUEST =
  process.env.FLARESOLVERR_RESTART_REQUEST || "/tmp/flaresolverr-restart-request";

let aplmateSessionCache = null;
let aplmateSessionPromise = null;
let aplmateResolveTail = Promise.resolve();

function requestFlareSolverrRestart(reason) {
  try {
    fs.writeFileSync(
      FLARESOLVERR_RESTART_REQUEST,
      JSON.stringify({ at: Date.now(), reason: String(reason || "unknown").slice(0, 500) }) + "\n"
    );
  } catch {
    // Watchdog is optional; resolver still returns a useful error.
  }
}

function isFlareSolverrFailure(err) {
  return /FlareSolverr|chrome not reachable|session not created|solving the challenge|ECONNREFUSED|aborted due to timeout/i.test(
    String(err?.message || err || "")
  );
}

async function flareSolverrCall(payload) {
  const maxTimeout = Math.max(5000, Math.min(Number(payload?.maxTimeout) || 60000, 70000));
  const delays = [0, 500, 2000];
  let lastErr;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
    try {
      const res = await fetch(`${FLARESOLVERR_URL}/v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, maxTimeout }),
        signal: AbortSignal.timeout(maxTimeout + 5000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.message || `FlareSolverr błąd (HTTP ${res.status}).`);
      }
      return data;
    } catch (err) {
      lastErr = err;
      const transient = /timeout|ECONNREFUSED|aborted|FlareSolverr błąd \(HTTP 5/i.test(
        String(err?.message || err || "")
      );
      if (!transient || attempt === delays.length - 1) throw err;
    }
  }
  throw lastErr || new Error("FlareSolverr niedostępny.");
}

flareSolverrCall({ cmd: "sessions.list", maxTimeout: 8000 }).catch((err) => {
  console.warn(
    "FlareSolverr niedostępny pod",
    FLARESOLVERR_URL,
    "—",
    err?.message || err
  );
});

function parseAplmateJsonResponse(raw) {
  const text = String(raw || "").trim();
  const pre = text.match(/<pre>(\{[\s\S]*?\})<\/pre>/i);
  const candidate = pre ? pre[1] : text;
  return JSON.parse(candidate);
}

function cookiesArrayToMap(cookies) {
  return new Map((cookies || []).filter((c) => c?.name).map((c) => [c.name, c.value || ""]));
}

function cookieMapHeader(cookies) {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function ingestResponseCookies(cookies, response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const line of setCookies) {
    const pair = String(line || "").split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function aplmateFetchWithSession(pathname, { session, method = "GET", body }) {
  const headers = {
    "User-Agent": session.userAgent || UA,
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${APLMATE_BASE}/`,
    Origin: APLMATE_BASE,
  };
  const cookieHeader = cookieMapHeader(session.cookies);
  if (cookieHeader) headers.Cookie = cookieHeader;
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetch(`${APLMATE_BASE}${pathname}`, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(60000),
  });
  ingestResponseCookies(session.cookies, res);
  const text = await res.text();
  if (!res.ok) throw new Error(`APLMate HTTP ${res.status}: ${text.slice(0, 160)}`);
  return text;
}

async function createAplmateSession() {
  let sessionId = "";
  try {
    const created = await flareSolverrCall({ cmd: "sessions.create" });
    sessionId = created.session;
    const landing = await flareSolverrCall({
      cmd: "request.get",
      url: `${APLMATE_BASE}/`,
      session: sessionId,
      maxTimeout: 65000,
      waitInSeconds: APLMATE_FLARE_WAIT_S,
    });
    const cookies = landing.solution?.cookies || [];
    if (!cookies.length) {
      throw new Error("FlareSolverr nie uzyskał żadnych cookies od APLMate.");
    }
    return {
      cookies: cookiesArrayToMap(cookies),
      userAgent: landing.solution?.userAgent || UA,
      expiresAt: Date.now() + APLMATE_SESSION_TTL_MS,
    };
  } catch (err) {
    if (isFlareSolverrFailure(err)) requestFlareSolverrRestart(err?.message || err);
    throw err;
  } finally {
    if (sessionId) {
      flareSolverrCall({ cmd: "sessions.destroy", session: sessionId }).catch(() => {});
    }
  }
}

async function getAplmateSession(forceRefresh = false) {
  if (!forceRefresh && aplmateSessionCache?.expiresAt > Date.now()) {
    return aplmateSessionCache;
  }
  if (!forceRefresh && aplmateSessionPromise) return aplmateSessionPromise;

  aplmateSessionPromise = createAplmateSession()
    .then((session) => {
      aplmateSessionCache = session;
      return session;
    })
    .finally(() => {
      aplmateSessionPromise = null;
    });
  return aplmateSessionPromise;
}

function invalidateAplmateSession(session) {
  if (!session || aplmateSessionCache === session) aplmateSessionCache = null;
}

async function resolveWithAplmateSession(appleUrl, session) {
  const verifyRaw = await aplmateFetchWithSession("/action/userverify", {
    session,
    method: "POST",
    body: new URLSearchParams({ url: appleUrl }).toString(),
  });
  let verify = {};
  try {
    verify = JSON.parse(verifyRaw);
  } catch {
    throw new Error("APLMate zwrócił nieprawidłową sesję weryfikacji.");
  }
  const turnstileToken = verify.success && verify.token ? verify.token : "";
  if (!turnstileToken) throw new Error("APLMate nie zwrócił tokenu sesji.");

  const step1Raw = await aplmateFetchWithSession("/action", {
    session,
    method: "POST",
    body: new URLSearchParams({
      url: appleUrl,
      "cf-turnstile-response": turnstileToken,
    }).toString(),
  });
  const step1 = parseAplmateJsonResponse(step1Raw);
  if (step1.error) throw new Error(step1.message || "APLMate odrzucił żądanie.");
  if (!step1.success || !step1.html) throw new Error("APLMate nie zwrócił formularza utworu.");

  const form = extractTrackForm(step1.html);
  const step2Raw = await aplmateFetchWithSession("/action/track", {
    session,
    method: "POST",
    body: new URLSearchParams(form).toString(),
  });
  const step2 = parseAplmateJsonResponse(step2Raw);
  if (step2.error) throw new Error(step2.message || "APLMate nie wygenerował linku MP3.");
  return extractDownloadUrl(step2.data || "");
}

function shouldRefreshAplmateSession(err) {
  return /refresh the page|token|session|weryfik|odrzucił|403|captcha|turnstile/i.test(
    String(err?.message || err || "")
  );
}

function enqueueAplmateResolve(work) {
  const run = aplmateResolveTail.then(work, work);
  aplmateResolveTail = run.catch(() => {});
  return run;
}

async function resolveAppleMusicDownloadUrlViaFlareSolverr(appleUrl) {
  return enqueueAplmateResolve(async () => {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await getAplmateSession(attempt > 0);
      try {
        return await resolveWithAplmateSession(appleUrl, session);
      } catch (err) {
        lastError = err;
        if (attempt === 0 && shouldRefreshAplmateSession(err)) {
          invalidateAplmateSession(session);
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error("APLMate nie przygotował linku MP3.");
  });
}

async function aplmateUserVerifyToken(jar, appleUrl) {
  const verifyRaw = await aplmateFetch("/action/userverify", {
    method: "POST",
    jar,
    body: new URLSearchParams({ url: appleUrl }),
  });
  let verify;
  try {
    verify = JSON.parse(verifyRaw);
  } catch {
    return "";
  }
  return verify.success && verify.token ? verify.token : "";
}

async function resolveAplmateTurnstileToken(jar, appleUrl) {
  if (turnstileSolverConfigured()) {
    try {
      return await solveTurnstileToken({ pageurl: `${APLMATE_BASE}/` });
    } catch (err) {
      console.warn("APLMate Turnstile solver:", err?.message || err);
    }
  }
  return aplmateUserVerifyToken(jar, appleUrl);
}

async function resolveAppleMusicDownloadUrlDirect(appleUrl) {
  const jar = new CookieJar();
  await aplmateFetch("/", { jar });

  const turnstileToken = await resolveAplmateTurnstileToken(jar, appleUrl);
  if (!turnstileToken) {
    throw new Error("Nie udało się uzyskać tokenu Turnstile dla APLMate.");
  }

  const step1Raw = await aplmateFetch("/action", {
    method: "POST",
    jar,
    body: (() => {
      const fd = new FormData();
      fd.set("url", appleUrl);
      fd.set("cf-turnstile-response", turnstileToken);
      return fd;
    })(),
  });

  let step1;
  try {
    step1 = JSON.parse(step1Raw);
  } catch {
    throw new Error("Nieprawidłowa odpowiedź serwera przy analizie utworu.");
  }
  if (step1.error) {
    throw new Error(step1.message || "Nie udało się odczytać utworu z Apple Music.");
  }
  if (!step1.success || !step1.html) {
    throw new Error("Nie udało się przygotować utworu do pobrania.");
  }

  const form = extractTrackForm(step1.html);
  const step2Raw = await aplmateFetch("/action/track", {
    method: "POST",
    jar,
    body: new URLSearchParams(form),
  });

  let step2;
  try {
    step2 = JSON.parse(step2Raw);
  } catch {
    throw new Error("Nie udało się wygenerować linku MP3.");
  }
  if (step2.error) {
    throw new Error(step2.message || "Pobieranie utworu nie powiodło się.");
  }
  return extractDownloadUrl(step2.data || "");
}

function runYtDlp(args, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP_PATH, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${process.env.PATH || ""}:/usr/bin:/bin` },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Awaryjne źródło audio przekroczyło limit czasu."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 1024 * 1024) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 256 * 1024) stderr += chunk;
    });
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim().slice(-500) || `yt-dlp zakończył się kodem ${code}.`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function resolveAppleMusicDownloadUrlViaYouTube(appleUrl) {
  if (!fs.existsSync(YT_DLP_PATH)) throw new Error("Brak lokalnego resolvera audio yt-dlp.");
  const track = await buildAppleMusicInfo(appleUrl);
  const query = [track.uploader, track.title, track.album, "official audio"]
    .filter(Boolean)
    .join(" ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  const stdout = await runYtDlp([
    "--no-playlist",
    "--no-warnings",
    "--socket-timeout",
    "12",
    "--retries",
    "2",
    "-f",
    "bestaudio[ext=m4a]/bestaudio",
    "-g",
    `ytsearch1:${query}`,
  ]);
  const url = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^https?:\/\//i.test(line));
  if (!url) throw new Error("Nie znaleziono zgodnego awaryjnego źródła audio.");
  return url;
}

export function resolvedAudioContentType(url) {
  try {
    const parsed = new URL(String(url || ""));
    const mime = parsed.searchParams.get("mime");
    if (mime?.startsWith("audio/")) return mime;
    if (/googlevideo\.com$/i.test(parsed.hostname)) return "audio/mp4";
  } catch {
    // Fall through to APLMate MP3 default.
  }
  return "audio/mpeg";
}

async function resolveAppleMusicDownloadUrlUncached(appleUrl) {
  let youtubeError;
  try {
    return await resolveAppleMusicDownloadUrlViaYouTube(appleUrl);
  } catch (err) {
    youtubeError = err;
    console.warn("Apple Music fallback via YouTube:", err?.message || err);
  }

  return enqueueAppleMusicResolve(appleUrl, async () => {
    try {
      return await resolveAppleMusicDownloadUrlViaFlareSolverr(appleUrl);
    } catch (flareErr) {
      console.warn("APLMate via FlareSolverr:", flareErr?.message || flareErr);
      if (!turnstileSolverConfigured()) {
        throw new Error("Nie udało się przygotować źródła audio. Serwis spróbuje ponownie automatycznie.", {
          cause: youtubeError || flareErr,
        });
      }
    }
    return resolveAppleMusicDownloadUrlDirect(appleUrl);
  });
}

function sanitizeFilename(name) {
  return (name || "track")
    .replace(/[^\p{L}\p{N}\-_. ]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "track";
}

async function downloadCoverArt(coverUrl, destPath) {
  const res = await fetch(coverUrl, {
    headers: { "User-Agent": UA, Accept: "image/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Okładka HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Pusta okładka albumu.");
  fs.writeFileSync(destPath, buf);
}

function transcodeToMp3InPlace(filePath) {
  const sourcePath = `${filePath}.source-audio`;
  fs.renameSync(filePath, sourcePath);
  const result = spawnSync(
    ffmpegStatic,
    [
      "-nostdin",
      "-y",
      "-i",
      sourcePath,
      "-map",
      "0:a:0",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "256k",
      "-f",
      "mp3",
      filePath,
    ],
    { encoding: "utf8", timeout: 180000 }
  );
  if (result.status !== 0 || !fs.existsSync(filePath) || fs.statSync(filePath).size < 32 * 1024) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      fs.renameSync(sourcePath, filePath);
    } catch {}
    throw new Error(result.stderr?.slice(-500) || "Nie udało się przekonwertować awaryjnego źródła do MP3.");
  }
  try {
    fs.unlinkSync(sourcePath);
  } catch {}
}

export function embedMp3Tags({ mp3Path, coverPath, title, artist, album }) {
  const outPath = `${mp3Path}.tagged.mp3`;
  const args = [
    "-nostdin",
    "-y",
    "-i",
    mp3Path,
    "-i",
    coverPath,
    "-map",
    "0:a",
    "-map",
    "1",
    "-c:a",
    "copy",
    "-id3v2_version",
    "3",
    "-metadata",
    `title=${title || ""}`,
    "-metadata",
    `artist=${artist || ""}`,
    "-metadata",
    `album=${album || ""}`,
    "-metadata:s:v",
    "title=Album cover",
    "-metadata:s:v",
    "comment=Cover (front)",
    "-disposition:v:0",
    "attached_pic",
    outPath,
  ];
  const r = spawnSync(ffmpegStatic, args, { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(outPath)) {
    throw new Error(r.stderr?.slice(-400) || "Nie udało się dodać okładki do MP3.");
  }
  fs.renameSync(outPath, mp3Path);
}

function isGoogleVideoAudioUrl(url) {
  try {
    return /(^|\.)googlevideo\.com$/i.test(new URL(String(url || "")).hostname);
  } catch {
    return false;
  }
}

async function downloadGoogleVideoInChunks(url, destPath, onProgress) {
  const parsed = new URL(url);
  let total = Number(parsed.searchParams.get("clen")) || 0;
  const chunkSize = 512 * 1024;
  let downloaded = 0;
  const file = await fs.promises.open(destPath, "w");
  try {
    while (!total || downloaded < total) {
      const end = total
        ? Math.min(total - 1, downloaded + chunkSize - 1)
        : downloaded + chunkSize - 1;
      const res = await fetch(url, {
        headers: { Range: `bytes=${downloaded}-${end}` },
        signal: AbortSignal.timeout(60000),
      });
      if (res.status !== 206 && !res.ok) {
        throw new Error(`Awaryjne źródło audio HTTP ${res.status}`);
      }
      const contentRange = res.headers.get("content-range") || "";
      const rangeTotal = Number(contentRange.match(/\/(\d+)$/)?.[1]) || 0;
      if (!total && rangeTotal) total = rangeTotal;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) throw new Error("Awaryjne źródło zwróciło pusty fragment audio.");
      await file.write(buffer, 0, buffer.length, downloaded);
      downloaded += buffer.length;
      if (total > 0) onProgress?.(5 + (downloaded / total) * 83);
      if (!total && buffer.length < chunkSize) break;
    }
  } finally {
    await file.close();
  }
  return { downloaded, total };
}

export async function downloadAppleMusicToFile({
  appleUrl,
  destPath,
  trackMeta,
  onProgress,
  downloadUrl: presetDownloadUrl = null,
}) {
  const track = trackMeta || (await buildAppleMusicInfo(appleUrl));
  const sourceUrl = track.webpageUrl || appleUrl;
  let downloadUrl =
    presetDownloadUrl || (await resolveAppleMusicDownloadUrl(sourceUrl));

  const pullToFile = async (url) => {
    if (isGoogleVideoAudioUrl(url)) {
      await downloadGoogleVideoInChunks(url, destPath, onProgress);
      return;
    }
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(600000),
    });
    if (!res.ok) {
      const err = new Error(`Pobieranie MP3 HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const total = Number(res.headers.get("content-length")) || 0;
    const file = fs.createWriteStream(destPath);
    let downloaded = 0;
    for await (const chunk of res.body) {
      file.write(chunk);
      downloaded += chunk.length;
      if (total > 0) onProgress?.(5 + (downloaded / total) * 85);
    }
    await new Promise((resolve, reject) => {
      file.end(resolve);
      file.on("error", reject);
    });
  };

  onProgress?.(5);
  try {
    await pullToFile(downloadUrl);
  } catch (err) {
    const status = Number(err?.status);
    if (status === 403 || status === 410 || /HTTP 403|HTTP 410/.test(String(err?.message || ""))) {
      invalidateAppleMusicDownloadCache(sourceUrl);
      downloadUrl = await resolveAppleMusicDownloadUrl(sourceUrl, { forceRefresh: true });
      await pullToFile(downloadUrl);
    } else {
      throw err;
    }
  }

  if (resolvedAudioContentType(downloadUrl) !== "audio/mpeg") {
    onProgress?.(88);
    transcodeToMp3InPlace(destPath);
  }

  onProgress?.(92);

  const coverPath = path.join(path.dirname(destPath), "cover.jpg");
  try {
    if (track.thumbnail) {
      await downloadCoverArt(track.thumbnail, coverPath);
      embedMp3Tags({
        mp3Path: destPath,
        coverPath,
        title: track.title,
        artist: track.uploader,
        album: track.album,
      });
    }
  } finally {
    try {
      fs.unlinkSync(coverPath);
    } catch {}
  }

  onProgress?.(100);
  return {
    file: destPath,
    name: path.basename(destPath),
    track,
  };
}

export function buildAppleMusicFilename(track) {
  const artist = track.uploader || track.artistName || "";
  const title = track.title || track.trackName || "utwor";
  const base = artist ? `${artist} - ${title}` : title;
  return `${sanitizeFilename(base)}.mp3`;
}
