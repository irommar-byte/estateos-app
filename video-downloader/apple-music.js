import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const APLMATE_BASE = (process.env.APLMATE_BASE || "https://aplmate.com").replace(/\/$/, "");
const ITUNES_COUNTRY = process.env.APPLE_MUSIC_COUNTRY || "PL";

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

function upscaleArtwork(url, size = 600) {
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
  if (!res.ok) throw new Error(`Apple Music HTTP ${res.status}`);

  const html = await res.text();
  const titleMatch = html.match(/<meta name="apple:title" content="([^"]*)"/i);
  const countMatch = html.match(/property="music:song_count" content="(\d+)"/i);
  const thumbMatch = html.match(/property="og:image" content="([^"]+)"/i);
  const songUrls = [...html.matchAll(/<meta property="music:song" content="([^"]+)"/gi)].map((m) => m[1]);
  const durations = [...html.matchAll(/property="music:song:duration" content="([^"]+)"/gi)].map((m) => m[1]);
  const trackNums = [...html.matchAll(/property="music:song:track" content="(\d+)"/gi)].map((m) => Number(m[1]));

  if (!songUrls.length) {
    throw new Error("Nie udało się odczytać utworów z playlisty — sprawdź, czy link jest publiczny.");
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
  };
  const cookie = jar.header();
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

export async function resolveAppleMusicDownloadUrl(appleUrl) {
  const jar = new CookieJar();
  await aplmateFetch("/", { jar });

  const verifyRaw = await aplmateFetch("/action/userverify", {
    method: "POST",
    jar,
    body: new URLSearchParams({ url: appleUrl }),
  });

  let verify;
  try {
    verify = JSON.parse(verifyRaw);
  } catch {
    throw new Error("Nie udało się zweryfikować linku Apple Music.");
  }
  if (!verify.success || !verify.token) {
    throw new Error("Weryfikacja Apple Music nie powiodła się.");
  }

  const step1Raw = await aplmateFetch("/action", {
    method: "POST",
    jar,
    body: (() => {
      const fd = new FormData();
      fd.set("url", appleUrl);
      fd.set("cf-turnstile-response", verify.token);
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

export async function downloadAppleMusicToFile({
  appleUrl,
  destPath,
  trackMeta,
  onProgress,
}) {
  const track = trackMeta || (await buildAppleMusicInfo(appleUrl));
  const downloadUrl = await resolveAppleMusicDownloadUrl(track.webpageUrl || appleUrl);

  onProgress?.(5);
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(600000),
  });
  if (!res.ok) throw new Error(`Pobieranie MP3 HTTP ${res.status}`);

  const total = Number(res.headers.get("content-length")) || 0;
  const file = fs.createWriteStream(destPath);
  let downloaded = 0;

  for await (const chunk of res.body) {
    file.write(chunk);
    downloaded += chunk.length;
    if (total > 0) {
      onProgress?.(5 + (downloaded / total) * 85);
    }
  }

  await new Promise((resolve, reject) => {
    file.end(() => resolve());
    file.on("error", reject);
  });

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
