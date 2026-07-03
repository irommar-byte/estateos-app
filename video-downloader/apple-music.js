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

export async function searchAppleMusic(query, limit = 24, country = ITUNES_COUNTRY) {
  const target = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const api = new URL("https://itunes.apple.com/search");
  api.searchParams.set("term", query);
  api.searchParams.set("entity", "song");
  api.searchParams.set("limit", String(target));
  api.searchParams.set("country", country);

  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`iTunes search HTTP ${res.status}`);
  const data = await res.json();
  const seen = new Set();

  return (data.results || [])
    .filter((track) => {
      if (!track.trackId || seen.has(track.trackId)) return false;
      seen.add(track.trackId);
      return true;
    })
    .map((track) => ({
    id: String(track.trackId),
    title: track.trackName || "Bez tytułu",
    url: buildAppleMusicUrl(track),
    thumbnail: upscaleArtwork(track.artworkUrl100 || track.artworkUrl60, 600),
    uploader: track.artistName || "Apple Music",
    duration: Math.round((track.trackTimeMillis || 0) / 1000),
    quality: "MP3",
    qualities: ["320 kbps"],
    album: track.collectionName || "",
    trackId: String(track.trackId),
    source: "apple-music",
    detail: track.collectionName ? `${track.collectionName} · Apple Music` : "Apple Music",
  }));
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
