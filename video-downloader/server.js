import express from "express";
import ffmpegStatic from "ffmpeg-static";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { spawnSync, spawn } from "node:child_process";
import os from "node:os";
import crypto from "node:crypto";
import { isMirrorHost, resolveMirrorPage } from "./voe-resolver.js";
import {
  isCdaHdTvShowUrl,
  fetchCdaHdTvShow,
  buildCdaHdSeriesInfo,
  searchCdaHd,
  fetchCdaHdLatest,
} from "./cda-hd.js";
import {
  detectPortal,
  portalCookieArgs,
  savePortalCookies,
  savePortalCredentials,
  listPortalStatus,
  tryTvpLogin,
  PORTALS,
} from "./portal-sessions.js";
import {
  listFavorites,
  addFavorite,
  removeFavorite,
  mergeFavoritesStoreKey,
} from "./movies-favorites.js";
import {
  listMusicLibrary,
  createMusicFolder,
  renameMusicFolder,
  deleteMusicFolder,
  listFolderTracks,
  addTrackToFolder,
  removeTrackFromFolder,
} from "./music-library.js";
import {
  signMoviesToken,
  validateLineageLogin,
  authUserFromRequest,
  applyAuthToRequest,
} from "./movies-auth.js";
import {
  searchAppleMusic,
  buildAppleMusicInfo,
  downloadAppleMusicToFile,
  buildAppleMusicFilename,
} from "./apple-music.js";

const require = createRequire(import.meta.url);
// yt-dlp-wrap ships as CommonJS; normalize the default export for ESM.
const YTDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = YTDlpWrapModule.default || YTDlpWrapModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;

function getLanIPv4() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

function getPlaybackBaseUrl() {
  const lan = getLanIPv4();
  return lan ? `http://${lan}:${PORT}` : `http://127.0.0.1:${PORT}`;
}
const COOKIE_BROWSERS = new Set(["chrome", "safari", "firefox", "brave", "edge", "chromium"]);
const IS_LINUX_SERVER = os.platform() === "linux";

function cookieArgs(browser) {
  if (IS_LINUX_SERVER) return [];
  if (!browser || !COOKIE_BROWSERS.has(browser)) return [];
  return ["--cookies-from-browser", browser];
}

function cookieArgsFor(req, browser, url) {
  if (req && url) {
    const portal = portalCookieArgs(req, url);
    if (portal.length) return portal;
  }
  return cookieArgs(browser);
}

function pickBestStreamUrl(urls) {
  if (!urls?.length) return null;
  if (urls.length === 1) return urls[0];
  const videoHls = urls.find((u) => /index-f\d+-v\d+\.m3u8/i.test(u));
  if (videoHls) return videoHls;
  const m3u8 = urls.find((u) => /\.m3u8/i.test(u) && !/index-f\d+-a\d+/i.test(u));
  return m3u8 || urls[0];
}

function tvpFormatForHeight(height) {
  const h = Number(height) || 720;
  if (h >= 1080) return "11281";
  if (h >= 720) return "6286";
  if (h >= 540) return "3128";
  if (h >= 450) return "1886";
  if (h >= 360) return "1361";
  if (h >= 270) return "928";
  return "699";
}

const TVP_FORMAT_META = {
  "699": { w: 398, h: 224, bw: 700000 },
  "928": { w: 480, h: 270, bw: 929000 },
  "1361": { w: 640, h: 360, bw: 1362000 },
  "1886": { w: 800, h: 450, bw: 1887000 },
  "3128": { w: 960, h: 540, bw: 3128000 },
  "6286": { w: 1280, h: 720, bw: 6287000 },
  "11281": { w: 1920, h: 1080, bw: 11281000 },
};

function tvpMetaForHeight(height) {
  return TVP_FORMAT_META[tvpFormatForHeight(height)] || { w: 1280, h: 720, bw: 6287000 };
}

function parseTvpHlsUrls(stdout) {
  const urls = stdout
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!urls.length) return null;
  const videoUrl =
    urls.find((u) => /index-f\d+-v\d+\.m3u8/i.test(u)) || urls[0];
  const audioUrl =
    urls.find((u) => /index-f\d+-a\d+\.m3u8/i.test(u)) || urls[1];
  if (!videoUrl) return null;
  if (audioUrl && audioUrl !== videoUrl) {
    return { streamUrl: videoUrl, audioStreamUrl: audioUrl, streamType: "hls-master" };
  }
  return { streamUrl: videoUrl, streamType: detectStreamType(videoUrl) };
}

/** Turn yt-dlp stderr into a short Polish message for the UI. */
function friendlyError(err) {
  const raw = String(err?.message || err || "");
  const stderr = raw.includes("Stderr:") ? raw.split("Stderr:").pop() : raw;
  const msg = stderr.trim();

  if (/DRM protection/i.test(msg))
    return "Ten serwis używa DRM (np. Netflix, HBO Max, Disney+) — pobranie jest technicznie niemożliwe.";
  if (/Requested format is not available/i.test(msg))
    return "TVP zmieniło formaty streamu — odśwież stronę (Cmd+Shift+R) i spróbuj ▶ Odtwórz ponownie.";
  if (/ITEM_NOT_PAID/i.test(msg))
    return "Ten materiał TVP VOD wymaga wykupienia (wypożyczenie, pakiet lub abonament). Zaloguj się na vod.tvp.pl i zaimportuj cookies.txt w «Konta portali».";
  if (/premium users/i.test(msg) || /only available for premium/i.test(msg))
    return "Film wymaga konta premium (np. CDA Premium). Włącz opcję „Sesja z przeglądarki” i zaloguj się w Chrome/Safari na cda.pl.";
  if (/private video/i.test(msg) || /Sign in to confirm your age/i.test(msg))
    return "Film jest prywatny lub wymaga logowania. Włącz „Sesja z przeglądarki” albo użyj publicznego linku.";
  if (/Video unavailable/i.test(msg) || /not available/i.test(msg))
    return "Film niedostępny — mógł zostać usunięty, jest zablokowany geograficznie albo wymaga logowania.";
  if (/Unsupported URL/i.test(msg))
    return "Nierozpoznany link. Sprawdź adres albo spróbuj innego serwisu (YouTube, CDA, Vimeo itd.).";
  if (/mirror nie ma osadzonego/i.test(msg))
    return msg;
  if (/Nie udało się otworzyć strony mirror/i.test(msg))
    return "Nie udało się otworzyć strony mirror (cda-hd itp.). Sprawdź link.";
  if (/No space left on device|ENOSPC|errno 28/i.test(msg))
    return "Brak miejsca na dysku serwera — pobieranie nie może się dokończyć. Anuluj zadania i zwolnij miejsce na VPS.";
  if (/unsupported platform:\s*linux/i.test(msg))
    return "Ciasteczka z przeglądarki nie działają na serwerze Linux. Zaloguj się w «Konta portali» albo wklej cookies.txt.";

  const line = msg.match(/^ERROR: (.+)$/m)?.[1];
  return line || "Nie udało się przetworzyć linku. Sprawdź adres i spróbuj ponownie.";
}

/** Metadata without forcing `-f best` (breaks CDA and similar sites). */
async function fetchVideoInfo(url, browser, req = null) {
  const stdout = await ytDlp.execPromise([
    url,
    "--dump-json",
    "--no-playlist",
    ...cookieArgsFor(req, browser, url),
  ]);
  try {
    return JSON.parse(stdout);
  } catch {
    return JSON.parse("[" + stdout.replace(/\n/g, ",").slice(0, -1) + "]");
  }
}

async function fetchPlaylistFlat(url, browser, req = null) {
  const stdout = await ytDlp.execPromise([
    url,
    "--flat-playlist",
    "--dump-single-json",
    ...cookieArgsFor(req, browser, url),
  ]);
  try {
    return JSON.parse(stdout);
  } catch {
    return JSON.parse("[" + stdout.replace(/\n/g, ",").slice(0, -1) + "]");
  }
}

function mapEpisodeEntry(e) {
  return {
    id: e.id,
    title: e.title || (e.episode_number ? `Odcinek ${e.episode_number}` : "Odcinek"),
    url: e.url || e.webpage_url || "",
    thumbnail: absUrl(pickYoutubeThumb(e.thumbnails) || e.thumbnail || ""),
    duration: e.duration || 0,
    episodeNumber: e.episode_number ?? null,
  };
}

function buildMirrorMediaInfo(mirror) {
  if (!mirror.stream?.url) {
    const hosts = mirror.embeds?.map((e) => e.label).join(", ") || "nieznany";
    throw new Error(
      `Ten link z serwisu mirror nie ma osadzonego odtwarzacza obsługiwanego automatycznie (znalezione: ${hosts}). Spróbuj link bezpośrednio z cda.pl lub YouTube.`
    );
  }
  return buildMirrorMediaInfoAsync(mirror);
}

function parsePageDuration(html) {
  if (!html) return 0;
  const minMatch = html.match(/(?:czas|runtime|duration)[^:<]*[:\s]*(\d+)\s*(?:min|min\.|minut)/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  const looseMin = html.match(/(\d{1,3})\s*min(?:ut)?(?:\s*[·|,<]|$)/i);
  if (looseMin) return Number(looseMin[1]) * 60;
  const hms = html.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const hm = html.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hm && Number(hm[1]) < 6) return Number(hm[1]) * 60 + Number(hm[2]);
  const jsonDur = html.match(/"duration"\s*:\s*"?(\d+)/i);
  if (jsonDur) return Number(jsonDur[1]);
  return 0;
}

const STREAM_PROXY_TIMEOUT_MS = 45 * 60 * 1000;
const MIRROR_STREAM_TTL_MS = 30 * 60 * 1000;
const mirrorStreamCache = new Map();
const hlsPlaylistCache = new Map();
const HLS_PLAYLIST_TTL_MS = 4000;

function getCachedMirrorStream(url) {
  const hit = mirrorStreamCache.get(url);
  if (hit && Date.now() - hit.at < MIRROR_STREAM_TTL_MS) return hit.data;
  return null;
}

function setCachedMirrorStream(url, data) {
  mirrorStreamCache.set(url, { at: Date.now(), data });
}

async function probeStreamMeta(streamUrl, referer) {
  const headers = { "User-Agent": UA, Referer: referer || "" };
  const timeout = AbortSignal.timeout(15000);
  try {
    const res = await fetch(streamUrl, {
      method: "GET",
      headers: { ...headers, Range: "bytes=0-0" },
      redirect: "follow",
      signal: timeout,
    });
    const contentType = res.headers.get("content-type") || "video/mp4";
    const contentRange = res.headers.get("content-range");
    const total = contentRange?.match(/\/(\d+)\s*$/);
    if (total) return { size: parseInt(total[1], 10), contentType };
    const len = res.headers.get("content-length");
    if (len) return { size: parseInt(len, 10), contentType };
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(streamUrl, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: timeout,
    });
    const len = res.headers.get("content-length");
    if (len) {
      return {
        size: parseInt(len, 10),
        contentType: res.headers.get("content-type") || "video/mp4",
      };
    }
  } catch {
    /* stream host may block HEAD/Range */
  }
  return { size: 0, contentType: "video/mp4" };
}

async function probeStreamSizeBytes(streamUrl, referer) {
  const meta = await probeStreamMeta(streamUrl, referer);
  return meta.size || 0;
}

function buildMirrorVideoOptions(durationSec, exactBytes) {
  if (exactBytes > 0) {
    return [
      {
        id: "720",
        label: "720p",
        height: 720,
        detail: "Mirror · MP4",
        sizeBytes: exactBytes,
        sizeLabel: formatBytes(exactBytes),
      },
    ];
  }

  const dur = durationSec > 0 ? durationSec : 45 * 60;
  const estimated = !durationSec;
  const suffix = estimated ? " ~" : "";
  const tiers = [
    { label: "1080p", height: 1080, kbps: 5000 },
    { label: "720p", height: 720, kbps: 2800 },
    { label: "480p", height: 480, kbps: 1200 },
  ];
  return tiers.map((t) => {
    const sizeBytes = estimateBytesFromBitrate(t.kbps, dur);
    return {
      id: String(t.height),
      label: t.label,
      height: t.height,
      detail: estimated ? "Szacunek · mirror" : "Szacunek · mirror · czas z strony",
      sizeBytes: Math.round(sizeBytes),
      sizeLabel: formatBytes(sizeBytes) + suffix,
    };
  });
}

function buildMirrorAudioOptions(durationSec) {
  const dur = durationSec > 0 ? durationSec : 45 * 60;
  const estimated = !durationSec;
  const suffix = estimated ? " ~" : "";
  const bitrates = [320, 256, 192, 128];
  const forContainer = (container) =>
    bitrates.map((br) => {
      const sizeBytes = Math.round(estimateBytesFromBitrate(br, dur));
      return {
        id: String(br),
        bitrate: br,
        label: `${br} kbps`,
        detail: `Szacunek · ${container.toUpperCase()}`,
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes) + suffix,
      };
    });
  return {
    mp3: [
      {
        id: "best",
        bitrate: "best",
        label: "Najlepsza",
        detail: "MP3",
        sizeBytes: Math.round(estimateBytesFromBitrate(256, dur)),
        sizeLabel: formatBytes(estimateBytesFromBitrate(256, dur)) + suffix,
      },
      ...forContainer("mp3"),
    ],
    m4a: [
      {
        id: "best",
        bitrate: "best",
        label: "Najlepsza",
        detail: "M4A",
        sizeBytes: Math.round(estimateBytesFromBitrate(256, dur)),
        sizeLabel: formatBytes(estimateBytesFromBitrate(256, dur)) + suffix,
      },
      ...forContainer("m4a"),
    ],
  };
}

async function buildMirrorMediaInfoAsync(mirror) {
  const durationSec = mirror.duration || 0;
  let exactBytes = 0;
  if (mirror.stream?.url && mirror.stream.type !== "hls") {
    exactBytes = await probeStreamSizeBytes(mirror.stream.url, mirror.webpageUrl);
  }

  return {
    isPlaylist: false,
    isMirror: true,
    mirrorSite: new URL(mirror.webpageUrl).hostname.replace(/^www\./, ""),
    embedLabel: mirror.stream.label || "mirror",
    title: mirror.title,
    thumbnail: absUrl(mirror.thumbnail),
    webpageUrl: mirror.webpageUrl,
    duration: durationSec,
    videoOptions: buildMirrorVideoOptions(durationSec, exactBytes),
    audioOptions: buildMirrorAudioOptions(durationSec),
  };
}

async function resolveMediaInfo(url, browser, req = null) {
  if (/music\.apple\.com/i.test(url)) {
    return buildAppleMusicInfo(url);
  }

  if (isMirrorHost(url)) {
    if (isCdaHdTvShowUrl(url)) {
      return buildCdaHdSeriesInfo(await fetchCdaHdTvShow(url));
    }
    return buildMirrorMediaInfoAsync(await resolveMirrorPage(url));
  }

  try {
    const flat = await fetchPlaylistFlat(url, browser, req);
    if (
      flat._type === "playlist" &&
      Array.isArray(flat.entries) &&
      flat.entries.length > 1
    ) {
      const episodes = flat.entries
        .filter((e) => e.url || e.webpage_url)
        .map(mapEpisodeEntry)
        .sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
      return {
        isPlaylist: true,
        title: flat.title || flat.playlist_title || "Serial / playlista",
        uploader: flat.uploader || flat.channel || flat.extractor_key || "",
        thumbnail: absUrl(
          flat.thumbnail ||
            flat.thumbnails?.[0]?.url ||
            episodes[0]?.thumbnail ||
            ""
        ),
        webpageUrl: flat.webpage_url || url,
        episodeCount: episodes.length,
        episodes,
      };
    }
  } catch {
    /* fall through to single video */
  }

  try {
    const info = await fetchVideoInfo(url, browser, req);
    const formats = Array.isArray(info.formats) ? info.formats : [];
    const duration = info.duration || 0;

    return {
      isPlaylist: false,
      title: info.title || "Bez tytułu",
      uploader: info.uploader || info.channel || info.extractor_key || "",
      duration,
      thumbnail: info.thumbnail || "",
      webpageUrl: info.webpage_url || url,
      isLive: !!info.is_live,
      videoOptions: buildVideoOptions(formats, duration),
      audioOptions: {
        mp3: buildAudioOptions(formats, duration, "mp3"),
        m4a: buildAudioOptions(formats, duration, "m4a"),
      },
    };
  } catch (err) {
    if (/Unsupported URL/i.test(String(err?.message || err))) {
      return buildMirrorMediaInfoAsync(await resolveMirrorPage(url));
    }
    throw err;
  }
}

function finalizeJob(job, jobDir) {
  let files;
  try {
    files = fs
      .readdirSync(jobDir)
      .filter((f) => !f.endsWith(".part") && !f.endsWith(".ytdl"));
  } catch (err) {
    throw new Error(err?.message || "Nie udało się odczytać katalogu pobierania.");
  }
  if (!files.length) {
    job.status = "error";
    job.error = "Nie znaleziono pobranego pliku.";
    sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
    return;
  }
  const target = files
    .map((f) => ({ f, size: fs.statSync(path.join(jobDir, f)).size }))
    .sort((a, b) => b.size - a.size)[0].f;

  job.file = path.join(jobDir, target);
  job.name = target;

  if (job.purpose === "preview") {
    job.status = "processing";
    sendEvent(job, { status: "processing", progress: 99, purpose: job.purpose });
    try {
      job.file = ensureSafariPlayable(job.file, jobDir);
      job.name = path.basename(job.file);
    } catch (err) {
      job.status = "error";
      job.error = friendlyError(err);
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
      return;
    }
  }

  job.status = "done";
  job.progress = 100;
  if (job.purpose === "preview") ensurePlayToken(job);
  sendEvent(job, {
    status: "done",
    progress: 100,
    name: job.name,
    jobId: job.id,
    purpose: job.purpose,
    playToken: job.playToken,
  });

  if (job.purpose === "preview") {
    setTimeout(() => cleanupJob(job.id), 60 * 60 * 1000);
  }
}

function probeVideoCodec(filePath) {
  const r = spawnSync(ffmpegStatic, ["-hide_banner", "-i", filePath], {
    encoding: "utf8",
  });
  const line = (r.stderr || "").match(/Video: (\S+)/);
  return line?.[1]?.toLowerCase() || "";
}

/** Remux / transcode preview files so Safari + AirPlay can play them. */
function ensureSafariPlayable(filePath, jobDir) {
  const codec = probeVideoCodec(filePath);
  const outPath = path.join(jobDir, "preview-safari.mp4");

  if (codec.includes("h264")) {
    const r = spawnSync(
      ffmpegStatic,
      ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", outPath],
      { encoding: "utf8" }
    );
    if (r.status === 0 && fs.existsSync(outPath)) {
      if (filePath !== outPath) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
      return outPath;
    }
  }

  const r = spawnSync(
    ffmpegStatic,
    [
      "-y",
      "-i",
      filePath,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outPath,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0 || !fs.existsSync(outPath)) {
    throw new Error(r.stderr || "Nie udało się przygotować podglądu dla Safari.");
  }
  if (filePath !== outPath) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
  return outPath;
}

function cleanupJob(jobId) {
  const job = jobs.get(jobId);
  if (!job?.file) return;
  try {
    fs.rmSync(path.dirname(job.file), { recursive: true, force: true });
  } catch {}
  jobs.delete(jobId);
}

function startTransferJob({ jobId, url, args, purpose = "download" }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const job = {
    id: jobId,
    purpose,
    status: "starting",
    progress: 0,
    clients: new Set(),
  };
  jobs.set(jobId, job);

  const proc = ytDlp.exec(args);
  job.proc = proc;

  proc.on("progress", (p) => {
    if (job.cancelled) return;
    job.status = "downloading";
    if (typeof p.percent === "number") job.progress = p.percent;
    sendEvent(job, {
      status: job.status,
      progress: job.progress,
      speed: p.currentSpeed,
      eta: p.eta,
      purpose: job.purpose,
    });
  });

  proc.on("error", (err) => {
    job.status = "error";
    job.error = friendlyError(err);
    sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
  });

  proc.on("close", (code) => {
    if (job.status === "error" || job.status === "cancelled") return;
    if (code !== 0 && code !== null) {
      job.status = "error";
      job.error =
        job.error ||
        friendlyError(new Error(`Proces pobierania zakończył się błędem (kod ${code}).`));
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
      return;
    }
    sendEvent(job, { status: "processing", progress: 99, purpose: job.purpose });
    try {
      finalizeJob(job, jobDir);
    } catch (err) {
      job.status = "error";
      job.error = friendlyError(err);
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
    }
  });

  return jobId;
}

async function getMirrorStream(url) {
  const cached = getCachedMirrorStream(url);
  if (cached) return cached;

  const target = await resolveMirrorPlayUrl(url);
  let mirror = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      mirror = await resolveMirrorPage(target.url);
      if (mirror.stream?.url) break;
      lastErr = new Error(
        "Ten link z serwisu mirror nie ma osadzonego odtwarzacza obsługiwanego automatycznie."
      );
    } catch (err) {
      lastErr = err;
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (!mirror?.stream?.url) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error(
          "Ten link z serwisu mirror nie ma osadzonego odtwarzacza obsługiwanego automatycznie."
        );
  }
  if (target.title) mirror.title = target.title;
  setCachedMirrorStream(url, mirror);
  return mirror;
}

/** CDA-HD serial page → first episode page with embed player. */
async function resolveMirrorPlayUrl(url) {
  if (isCdaHdTvShowUrl(url)) {
    const show = await fetchCdaHdTvShow(url);
    const episode = show.episodes?.[0];
    if (!episode?.url) {
      throw new Error("Nie znaleziono odcinków serialu na CDA-HD.");
    }
    return {
      url: episode.url,
      title: `${show.title} · ${episode.title}`,
    };
  }
  return { url };
}

function detectStreamType(streamUrl) {
  return /\.m3u8(\?|$)/i.test(streamUrl) ? "hls" : "mp4";
}

function playBaseFromReq(req) {
  if (!req) return "";
  const proto = (req.get("X-Forwarded-Proto") || req.protocol || "https").split(",")[0].trim();
  const host = (req.get("X-Forwarded-Host") || req.get("host") || "").split(",")[0].trim();
  const prefix = req.get("X-Movies-Public-Prefix") || "";
  if (!host || /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) return "";
  return `${proto}://${host}${prefix}`;
}

function createStreamProxyPreviewJob({
  jobId,
  streamUrl,
  streamReferer,
  title,
  streamType,
  audioStreamUrl,
  hlsFormatId,
  previewHeight,
  streamSizeBytes,
  streamContentType,
  req,
}) {
  const meta = hlsFormatId
    ? TVP_FORMAT_META[hlsFormatId]
    : previewHeight
      ? tvpMetaForHeight(previewHeight)
      : null;
  const job = {
    id: jobId,
    purpose: "preview",
    mode: "stream-proxy",
    streamUrl,
    streamReferer,
    streamType: streamType || detectStreamType(streamUrl),
    streamSizeBytes: streamSizeBytes || 0,
    streamContentType: streamContentType || "video/mp4",
    audioStreamUrl: audioStreamUrl || null,
    hlsBandwidth: meta?.bw,
    hlsResolution: meta ? `${meta.w}x${meta.h}` : null,
    name: title || "preview.mp4",
    status: "done",
    progress: 100,
    clients: new Set(),
    playBase: playBaseFromReq(req),
  };
  ensurePlayToken(job);
  jobs.set(jobId, job);
  return job;
}

async function createStreamProxyPreviewJobAsync(opts) {
  const streamType = opts.streamType || detectStreamType(opts.streamUrl);
  const job = createStreamProxyPreviewJob(opts);
  if (streamType === "mp4" && opts.streamUrl) {
    probeStreamMeta(opts.streamUrl, opts.streamReferer)
      .then((meta) => {
        const j = jobs.get(job.id);
        if (!j) return;
        if (meta.size > 0) j.streamSizeBytes = meta.size;
        if (meta.contentType) j.streamContentType = meta.contentType;
      })
      .catch(() => {});
  }
  return job;
}

/** Prefer a single progressive MP4 or HLS URL so preview can start without full download. */
async function resolveYtdlpDirectStream(url, height, browser, req = null) {
  const h = height && height !== "best" ? Number(height) : 720;
  const cookies = cookieArgsFor(req, browser, url);

  if (/tvp\.pl/i.test(url)) {
    const selectors = [
      `bestvideo[protocol*=m3u8][height<=${h}]+audio0-default/bestvideo[protocol*=m3u8]+audio0-default`,
      ...[tvpFormatForHeight(h), "6286", "3128", "1361", "699"].flatMap((formatId) => [
        `${formatId}+audio0-default`,
        formatId,
      ]),
    ];
    for (const selector of selectors) {
      try {
        const stdout = await ytDlp.execPromise([
          url,
          "-g",
          "-f",
          selector,
          "--no-playlist",
          ...cookies,
        ]);
        const parsed = parseTvpHlsUrls(stdout);
        if (!parsed) continue;
        const formatId = /^\d+$/.test(String(selector).split("+")[0])
          ? String(selector).split("+")[0]
          : tvpFormatForHeight(h);
        return {
          ...parsed,
          streamReferer: url,
          hlsFormatId: parsed.streamType === "hls-master" ? formatId : undefined,
        };
      } catch {
        /* try next selector */
      }
    }
  }

  const selectors = [
    `best[height<=${h}][ext=mp4][protocol^=http]`,
    `best[protocol=m3u8_native]`,
    `best[protocol*=m3u8]`,
    `best[height<=${h}][ext=mp4]`,
    `best[height<=${h}]`,
    `best[ext=mp4]/best`,
    `best`,
  ];

  for (const selector of selectors) {
    try {
      const stdout = await ytDlp.execPromise([
        url,
        "-g",
        "-f",
        selector,
        "--no-playlist",
        ...cookies,
      ]);
      const urls = stdout
        .trim()
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const picked = pickBestStreamUrl(urls);
      if (!picked) continue;
      return {
        streamUrl: picked,
        streamReferer: url,
        streamType: detectStreamType(picked),
      };
    } catch {
      /* try next selector */
    }
  }
  return null;
}

function cdaDashSelector(height) {
  const h = Number(height) || 720;
  if (h <= 360) return "dash-3-0+dash-4-0";
  if (h <= 480) return "dash-2-0+dash-4-0";
  if (h <= 720) return "dash-1-0+dash-4-0";
  return "dash-0-0+dash-4-0";
}

const cdaStreamCache = new Map();
const CDA_STREAM_TTL_MS = 45 * 60 * 1000;

async function resolveCdaDualStream(url, height, browser, req = null) {
  const cookies = cookieArgsFor(req, browser, url);
  const h = height && height !== "best" ? Number(height) : 720;
  const cacheKey = `${url}|${h}|${browser || ""}`;
  const cached = cdaStreamCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CDA_STREAM_TTL_MS) {
    return { videoUrl: cached.videoUrl, audioUrl: cached.audioUrl };
  }

  const selectors = [
    cdaDashSelector(h),
    `bestvideo[height<=${h}]+bestaudio/bestvideo+bestaudio`,
    `bestvideo[height<=720]+bestaudio`,
  ];

  const trySelector = async (selector) => {
    const stdout = await ytDlp.execPromise([
      url,
      "-g",
      "-f",
      selector,
      "--no-playlist",
      ...cookies,
    ]);
    const urls = stdout
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length >= 2) {
      return { videoUrl: urls[0], audioUrl: urls[1] };
    }
    const isCdaAudioUrl = (u) =>
      /audio_/i.test(u) || /\/a[_-]/i.test(u) || /\/a_hd/i.test(u);
    const videoUrl =
      urls.find((u) => /\.mp4/i.test(u) && !isCdaAudioUrl(u)) || urls[0];
    const audioUrl = urls.find((u) => /\.mp4/i.test(u) && isCdaAudioUrl(u));
    if (videoUrl && audioUrl) return { videoUrl, audioUrl };
    if (videoUrl) return { videoUrl, audioUrl: null };
    return null;
  };

  for (const selector of selectors) {
    try {
      const result = await trySelector(selector);
      if (result?.videoUrl && result?.audioUrl) {
        cdaStreamCache.set(cacheKey, {
          at: Date.now(),
          videoUrl: result.videoUrl,
          audioUrl: result.audioUrl,
        });
        return result;
      }
      if (result?.videoUrl) return result;
    } catch {
      /* try next selector */
    }
  }
  return null;
}

async function resolveTvpDualStream(url, height, browser, req = null) {
  const cookies = cookieArgsFor(req, browser, url);
  const h = height && height !== "best" ? Number(height) : 720;
  const selectors = [
    `bestvideo[protocol*=m3u8][height<=${h}]+audio0-default/bestvideo[protocol*=m3u8]+audio0-default`,
    `${tvpFormatForHeight(h)}+audio0-default`,
    "6286+audio0-default",
  ];
  for (const selector of selectors) {
    try {
      const stdout = await ytDlp.execPromise([
        url,
        "-g",
        "-f",
        selector,
        "--no-playlist",
        ...cookies,
      ]);
      const parsed = parseTvpHlsUrls(stdout);
      if (parsed?.audioStreamUrl) {
        return { videoUrl: parsed.streamUrl, audioUrl: parsed.audioStreamUrl };
      }
    } catch {
      /* try next selector */
    }
  }
  return null;
}

/** ffmpeg-static segfaults on remote HTTPS; download ranges locally first. */
async function downloadCdaRange(url, destPath, byteStart, byteEnd, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: referer || "",
      Range: `bytes=${byteStart}-${byteEnd}`,
    },
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`HTTP ${res.status} przy pobieraniu fragmentu CDA.`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function downloadCdaFull(url, destPath, referer, job, onProgress) {
  const ac = new AbortController();
  if (job) {
    job.abortControllers = job.abortControllers || [];
    job.abortControllers.push(ac);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: referer || "" },
    signal: ac.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} przy pobieraniu CDA.`);
  const total = Number(res.headers.get("content-length")) || 0;
  const file = fs.createWriteStream(destPath);
  let downloaded = 0;
  for await (const chunk of res.body) {
    if (job?.cancelled) {
      file.destroy();
      return;
    }
    file.write(chunk);
    downloaded += chunk.length;
    if (onProgress && total > 0) onProgress(downloaded / total);
  }
  await new Promise((resolve, reject) => {
    file.end(() => resolve());
    file.on("error", reject);
  });
}

function mergeCdaLocalFiles(videoPath, audioPath, outPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegStatic, [
      "-nostdin",
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outPath,
    ]);
    ff.on("close", (code) => {
      if (code === 0 && fs.existsSync(outPath)) resolve(outPath);
      else reject(new Error(`Scalanie CDA nie powiodło się (kod ${code}).`));
    });
    ff.on("error", reject);
  });
}

function startCdaStreamingPreview({ jobId, videoUrl, audioUrl, referer, previewHeight, pageUrl, browser, req }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const outPath = path.join(jobDir, "preview-cda.mp4");
  const videoFull = path.join(jobDir, "v.full");
  const audioFull = path.join(jobDir, "a.full");
  const videoPart = path.join(jobDir, "v.part");
  const audioPart = path.join(jobDir, "a.part");
  const videoPartialEnd = 22 * 1024 * 1024 - 1;
  const audioPartialEnd = 3 * 1024 * 1024 - 1;

  const job = {
    id: jobId,
    purpose: "preview",
    mode: "file",
    status: "starting",
    progress: 0,
    file: null,
    name: "preview-cda.mp4",
    clients: new Set(),
    cdaFullPending: false,
    fullReady: false,
  };
  jobs.set(jobId, job);

  const bumpProgress = () => {
    if (job.cancelled) return;
    const v = job._cdaVProgress ?? 0;
    const a = job._cdaAProgress ?? 0;
    const base = job.cdaFullPending ? 35 : 0;
    const span = job.cdaFullPending ? 57 : 92;
    job.progress = Math.min(92, base + Math.round(((v + a) / 2) * span));
    sendEvent(job, {
      status: job.status,
      progress: job.progress,
      purpose: job.purpose,
      cdaFullPending: job.cdaFullPending,
      fullReady: job.fullReady,
    });
  };

  const markPartialReady = async () => {
    if (job.cancelled || job.file) return;
    await mergeCdaLocalFiles(videoPart, audioPart, outPath);
    job.status = "done";
    job.progress = Math.max(job.progress, 35);
    job.file = outPath;
    job.cdaFullPending = true;
    ensurePlayToken(job);
    sendEvent(job, {
      status: "done",
      progress: job.progress,
      jobId: job.id,
      purpose: job.purpose,
      playToken: job.playToken,
      cdaFullPending: true,
      fullReady: false,
    });
  };

  (async () => {
    try {
      job.status = "downloading";
      sendEvent(job, { status: "downloading", progress: 1, purpose: job.purpose });

      const partialReady = Promise.all([
        downloadCdaRange(videoUrl, videoPart, 0, videoPartialEnd, referer),
        downloadCdaRange(audioUrl, audioPart, 0, audioPartialEnd, referer),
      ]).then(() => markPartialReady());

      const fullReady = Promise.all([
        downloadCdaFull(videoUrl, videoFull, referer, job, (pct) => {
          job._cdaVProgress = pct;
          bumpProgress();
        }),
        downloadCdaFull(audioUrl, audioFull, referer, job, (pct) => {
          job._cdaAProgress = pct;
          bumpProgress();
        }),
      ]);

      await partialReady;
      await fullReady;

      if (job.cancelled) return;

      job.status = "processing";
      job.progress = 96;
      sendEvent(job, {
        status: "processing",
        progress: 96,
        purpose: job.purpose,
        cdaFullPending: job.cdaFullPending,
      });

      const fullOut = path.join(jobDir, "preview-cda-full.mp4");
      await mergeCdaLocalFiles(videoFull, audioFull, fullOut);
      fs.renameSync(fullOut, outPath);

      job.status = "done";
      job.progress = 100;
      job.file = outPath;
      job.cdaFullPending = false;
      job.fullReady = true;
      ensurePlayToken(job);
      sendEvent(job, {
        status: "done",
        progress: 100,
        jobId: job.id,
        purpose: job.purpose,
        playToken: job.playToken,
        cdaFullPending: false,
        fullReady: true,
      });

      for (const p of [videoFull, audioFull, videoPart, audioPart]) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    } catch (err) {
      if (job.cancelled || err?.name === "AbortError") return;
      console.warn("cda streaming preview failed, yt-dlp fallback:", err?.message || err);
      try {
        const args = buildPreviewArgs({
          url: pageUrl,
          height: previewHeight,
          jobDir,
          browser,
          req,
        });
        startTransferJob({ jobId, url: pageUrl, args, purpose: "preview" });
      } catch {
        job.status = "error";
        job.error = friendlyError(err);
        sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
      }
    }
  })();

  return job;
}

function startTvpRemuxPreview({ jobId, videoUrl, audioUrl, referer }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const outPath = path.join(jobDir, "preview-tvp.mp4");
  const job = {
    id: jobId,
    purpose: "preview",
    mode: "file",
    status: "starting",
    progress: 0,
    file: outPath,
    name: "preview-tvp.mp4",
    clients: new Set(),
  };
  jobs.set(jobId, job);

  const header = `Referer: ${referer || ""}\r\nUser-Agent: ${UA}\r\n`;
  const ff = spawn(ffmpegStatic, [
    "-nostdin",
    "-y",
    "-headers",
    header,
    "-i",
    videoUrl,
    "-headers",
    header,
    "-i",
    audioUrl,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  job.proc = ff;
  job.status = "downloading";

  const poll = setInterval(() => {
    if (job.cancelled) {
      clearInterval(poll);
      return;
    }
    if (!fs.existsSync(outPath)) return;
    const stat = fs.statSync(outPath);
    const pct = Math.min(92, Math.round(stat.size / (8 * 1024 * 1024) * 100));
    job.progress = pct;
    sendEvent(job, {
      status: "downloading",
      progress: pct,
      purpose: job.purpose,
    });
    if (stat.size > 2 * 1024 * 1024 && job.status !== "done") {
      job.status = "done";
      job.progress = Math.max(pct, 50);
      ensurePlayToken(job);
      sendEvent(job, {
        status: "done",
        progress: job.progress,
        jobId: job.id,
        purpose: job.purpose,
        playToken: job.playToken,
      });
    }
  }, 800);

  ff.on("close", (code) => {
    clearInterval(poll);
    if (job.cancelled) return;
    if (code === 0 || fs.existsSync(outPath)) {
      job.status = "done";
      job.progress = 100;
      job.file = ensureSafariPlayable(outPath, jobDir);
      job.name = path.basename(job.file);
      ensurePlayToken(job);
      sendEvent(job, {
        status: "done",
        progress: 100,
        jobId: job.id,
        purpose: job.purpose,
        playToken: job.playToken,
      });
    } else {
      job.status = "error";
      job.error = "Nie udało się przygotować podglądu TVP.";
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
    }
  });

  return job;
}

function stopJobTransfer(job) {
  job.cancelled = true;
  job.status = "cancelled";
  if (job.abortController) {
    try {
      job.abortController.abort();
    } catch {}
  }
  if (job.abortControllers?.length) {
    for (const ac of job.abortControllers) {
      try {
        ac.abort();
      } catch {}
    }
  }
  if (job.fileStream) {
    try {
      job.fileStream.destroy();
    } catch {}
  }
  if (job.proc?.kill) {
    try {
      job.proc.kill("SIGTERM");
      setTimeout(() => {
        try {
          job.proc?.kill?.("SIGKILL");
        } catch {}
      }, 1500);
    } catch {}
  }
}

function buildSegmentProxyUrl(req, jobId, targetUrl) {
  const job = jobs.get(jobId);
  const token =
    (typeof req.query?.token === "string" && req.query.token) ||
    job?.playToken ||
    "";
  const base = job?.playBase || playBaseFromReq(req);
  if (!base) {
    const proto = req.get("X-Forwarded-Proto") || "https";
    const host = req.get("X-Forwarded-Host") || req.get("host") || "localhost";
    const prefix = req.get("X-Movies-Public-Prefix") || "";
    return `${proto}://${host}${prefix}/api/play/${jobId}?token=${encodeURIComponent(token)}&u=${encodeURIComponent(targetUrl)}`;
  }
  return `${base}/api/play/${jobId}?token=${encodeURIComponent(token)}&u=${encodeURIComponent(targetUrl)}`;
}

function rewriteHlsLine(line, job, req) {
  if (!line || line.startsWith("#")) {
    if (line?.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (_, uri) => {
        const abs = new URL(uri, job.streamUrl).href;
        return `URI="${buildSegmentProxyUrl(req, job.id, abs)}"`;
      });
    }
    return line;
  }
  const abs = new URL(line.trim(), job.streamUrl).href;
  return buildSegmentProxyUrl(req, job.id, abs);
}

async function proxyHlsPlaylist(req, res, job) {
  const cacheKey = `${job.id}:${job.streamUrl}`;
  const hit = hlsPlaylistCache.get(cacheKey);
  if (hit && Date.now() - hit.at < HLS_PLAYLIST_TTL_MS) {
    res.set({
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-cache",
      "Content-Disposition": "inline",
    });
    return res.send(hit.body);
  }

  const headers = { "User-Agent": UA, Referer: job.streamReferer || "" };
  const upstream = await fetch(job.streamUrl, { headers });
  if (!upstream.ok) {
    return res.status(upstream.status).send("Błąd playlisty HLS.");
  }
  const text = await upstream.text();
  const body = text
    .split("\n")
    .map((line) => rewriteHlsLine(line, job, req))
    .join("\n");
  hlsPlaylistCache.set(cacheKey, { at: Date.now(), body });
  res.set({
    "Content-Type": "application/vnd.apple.mpegurl",
    "Cache-Control": "no-cache",
    "Content-Disposition": "inline",
  });
  res.send(body);
}

async function proxyRemoteUrl(req, res, job, targetUrl) {
  const headers = { "User-Agent": UA, Referer: job.streamReferer || "" };
  if (req.headers.range) headers.Range = req.headers.range;

  let upstream = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      upstream = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(STREAM_PROXY_TIMEOUT_MS),
      });
      if (upstream.ok || upstream.status === 206) break;
      if (attempt === 0 && [403, 502, 503, 504].includes(upstream.status)) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      break;
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      throw err;
    }
  }
  if (!upstream?.ok && upstream?.status !== 206) {
    return res.status(upstream?.status || 502).send("Błąd streamu wideo.");
  }

  res.status(upstream.status);
  res.set("Accept-Ranges", "bytes");
  for (const [k, v] of upstream.headers.entries()) {
    const key = k.toLowerCase();
    if (["content-type", "content-length", "content-range"].includes(key)) {
      res.set(k, v);
    }
  }
  if (/\.m3u8(\?|$)/i.test(targetUrl)) {
    const text = await upstream.text();
    const body = text
      .split("\n")
      .map((line) => rewriteHlsLine(line, { ...job, streamUrl: targetUrl }, req))
      .join("\n");
    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.set("Cache-Control", "no-cache");
    return res.send(body);
  }
  if (upstream.body) {
    Readable.fromWeb(upstream.body).pipe(res);
  } else {
    res.end();
  }
}

async function downloadStreamToFile(job, streamUrl, referer, destPath, opts = {}) {
  const { forAirPlay = false } = opts;
  const ac = new AbortController();
  job.abortController = ac;
  try {
    if (job.cancelled) return;
    job.status = "downloading";
    sendEvent(job, {
      status: "downloading",
      progress: 0,
      purpose: job.purpose,
      airplayPrepare: forAirPlay,
    });

    const res = await fetch(streamUrl, {
      headers: { "User-Agent": UA, Referer: referer || "" },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} przy pobieraniu streamu.`);

    const total = Number(res.headers.get("content-length")) || 0;
    const file = fs.createWriteStream(destPath);
    job.fileStream = file;
    let downloaded = 0;

    for await (const chunk of res.body) {
      if (job.cancelled) {
        file.destroy();
        return;
      }
      file.write(chunk);
      downloaded += chunk.length;
      if (total > 0) {
        job.progress = Math.min(forAirPlay ? 90 : 99, (downloaded / total) * (forAirPlay ? 90 : 99));
        sendEvent(job, {
          status: "downloading",
          progress: job.progress,
          purpose: job.purpose,
          airplayPrepare: forAirPlay,
        });
      }
    }

    if (job.cancelled) {
      file.destroy();
      return;
    }

    await new Promise((resolve, reject) => {
      file.end(() => resolve());
      file.on("error", reject);
    });
    job.fileStream = null;

    if (job.cancelled) return;

    if (forAirPlay) {
      job.status = "processing";
      sendEvent(job, {
        status: "processing",
        progress: 95,
        purpose: job.purpose,
        airplayPrepare: true,
      });
      const jobDir = path.dirname(destPath);
      job.file = ensureSafariPlayable(destPath, jobDir);
      job.name = path.basename(job.file);
      job.mode = "file";
    } else {
      job.file = destPath;
    }

    job.status = forAirPlay ? "airplay-ready" : "done";
    job.progress = 100;
    if (forAirPlay) ensurePlayToken(job);
    sendEvent(job, {
      status: job.status,
      progress: 100,
      name: job.name,
      jobId: job.id,
      purpose: job.purpose,
      airplayPrepare: forAirPlay,
      playToken: job.playToken,
    });
  } catch (err) {
    if (job.cancelled || err?.name === "AbortError") return;
    job.status = "error";
    job.error = friendlyError(err);
    sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
  }
}

function startAppleMusicDownloadJob({ jobId, url }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const job = {
    id: jobId,
    purpose: "download",
    status: "starting",
    progress: 0,
    clients: new Set(),
  };
  jobs.set(jobId, job);

  (async () => {
    try {
      job.status = "downloading";
      sendEvent(job, { status: "downloading", progress: 1, purpose: job.purpose });

      const track = await buildAppleMusicInfo(url);
      const safeName = buildAppleMusicFilename(track);
      const filePath = path.join(jobDir, safeName);

      await downloadAppleMusicToFile({
        appleUrl: url,
        destPath: filePath,
        trackMeta: track,
        onProgress: (pct) => {
          if (job.cancelled) return;
          job.progress = Math.min(99, Math.round(pct));
          sendEvent(job, {
            status: "downloading",
            progress: job.progress,
            purpose: job.purpose,
          });
        },
      });

      if (job.cancelled) return;

      job.file = filePath;
      job.name = safeName;
      job.status = "done";
      job.progress = 100;
      sendEvent(job, {
        status: "done",
        progress: 100,
        name: job.name,
        jobId: job.id,
        purpose: job.purpose,
      });
    } catch (err) {
      if (job.cancelled) return;
      job.status = "error";
      job.error = friendlyAppleMusicError(err);
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
    }
  })();

  return job;
}

function friendlyAppleMusicError(err) {
  const msg = String(err?.message || err || "");
  if (/Nie znaleziono utworu/i.test(msg)) return msg;
  if (/APLMate HTTP/i.test(msg)) return "Serwer pobierania muzyki jest chwilowo niedostępny — spróbuj za chwilę.";
  if (/linku MP3|formularza utworu/i.test(msg)) return msg;
  if (/HTTP 403|HTTP 502|HTTP 503/i.test(msg)) return "Nie udało się pobrać pliku MP3 — spróbuj ponownie.";
  return msg || "Nie udało się pobrać utworu z Apple Music.";
}

function startMirrorDownloadJob({ jobId, streamUrl, streamReferer, name }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const safeName = sanitizeName((name || "video").replace(/\.[^.]+$/, "") + ".mp4");
  const filePath = path.join(jobDir, safeName);

  const job = {
    id: jobId,
    purpose: "download",
    status: "starting",
    progress: 0,
    clients: new Set(),
    file: filePath,
    name: safeName,
  };
  jobs.set(jobId, job);
  downloadStreamToFile(job, streamUrl, streamReferer, filePath);
  return job;
}

function buildMasterHlsPlaylist(req, job) {
  const videoPl = buildSegmentProxyUrl(req, job.id, job.streamUrl);
  const audioPl = buildSegmentProxyUrl(req, job.id, job.audioStreamUrl);
  const bw = job.hlsBandwidth || 2000000;
  const reso = job.hlsResolution || "640x360";
  return [
    "#EXTM3U",
    "#EXT-X-VERSION:6",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="main",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="${audioPl}"`,
    `#EXT-X-STREAM-INF:BANDWIDTH=${bw},CODECS="avc1.64001e,mp4a.40.2",RESOLUTION=${reso},AUDIO="audio"`,
    videoPl,
    "",
  ].join("\n");
}

function parseByteRangeHeader(rangeHeader, totalSize = 0) {
  if (!rangeHeader || !/^bytes=/i.test(rangeHeader)) return null;
  const parts = rangeHeader.replace(/^bytes=/i, "").split("-");
  const start = parseInt(parts[0], 10) || 0;
  let end = parts[1] ? parseInt(parts[1], 10) : null;
  if (end == null && totalSize > 0) end = totalSize - 1;
  if (end == null) end = start;
  return { start, end };
}

function respondStreamProxyHead(req, res, job) {
  const contentType = job.streamContentType || "video/mp4";
  const size = job.streamSizeBytes || 0;
  res.set({
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Content-Disposition": "inline",
  });
  const parsed = parseByteRangeHeader(req.headers.range, size);
  if (parsed && size > 0) {
    const end = Math.min(parsed.end, size - 1);
    if (parsed.start <= end) {
      res.set({
        "Content-Range": `bytes ${parsed.start}-${end}/${size}`,
        "Content-Length": String(end - parsed.start + 1),
      });
      return res.status(206).end();
    }
  }
  if (size > 0) res.set("Content-Length", String(size));
  return res.status(200).end();
}

function proxyMp4WithCurl(req, res, job) {
  const maxTime = String(Math.ceil(STREAM_PROXY_TIMEOUT_MS / 1000));
  const args = ["-sL", "-A", UA, "--max-time", maxTime];
  if (job.streamReferer) args.push("-H", `Referer: ${job.streamReferer}`);
  const parsed = parseByteRangeHeader(req.headers.range, job.streamSizeBytes || 0);
  if (parsed) args.push("--range", `${parsed.start}-${parsed.end}`);
  args.push(job.streamUrl);

  const contentType = job.streamContentType || "video/mp4";
  const size = job.streamSizeBytes || 0;
  res.set({ "Accept-Ranges": "bytes", "Content-Type": contentType, "Content-Disposition": "inline" });
  if (parsed && size > 0) {
    const end = Math.min(parsed.end, size - 1);
    res.status(206);
    res.set({
      "Content-Range": `bytes ${parsed.start}-${end}/${size}`,
      "Content-Length": String(end - parsed.start + 1),
    });
  } else if (size > 0) {
    res.status(200);
    res.set("Content-Length", String(size));
  } else {
    res.status(200);
  }

  const proc = spawn("curl", args);
  proc.stdout.pipe(res);
  proc.on("error", () => {
    if (!res.headersSent) res.status(502).send("Błąd streamu wideo.");
  });
  proc.on("close", (code) => {
    if (code !== 0 && !res.writableEnded) {
      if (!res.headersSent) res.status(502).send("Błąd streamu wideo.");
      else res.end();
    }
  });
}

async function proxyStreamPlay(req, res, job) {
  if (job.streamType === "hls-master" && job.audioStreamUrl && !req.query.u) {
    res.set({
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-cache",
      "Content-Disposition": "inline",
    });
    return res.send(buildMasterHlsPlaylist(req, job));
  }
  if (job.streamType === "hls" || job.streamType === "hls-master") {
    return proxyHlsPlaylist(req, res, job);
  }
  const headers = { "User-Agent": UA, Referer: job.streamReferer || "" };
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    const upstream = await fetch(job.streamUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(STREAM_PROXY_TIMEOUT_MS),
    });
    if (upstream.ok || upstream.status === 206) {
      res.status(upstream.status);
      res.set("Accept-Ranges", "bytes");
      for (const [k, v] of upstream.headers.entries()) {
        const key = k.toLowerCase();
        if (["content-type", "content-length", "content-range"].includes(key)) {
          res.set(k, v);
        }
      }
      if (!res.getHeader("content-type")) {
        res.set("Content-Type", job.streamContentType || "video/mp4");
      }
      if (upstream.body) {
        Readable.fromWeb(upstream.body).pipe(res);
        return;
      }
      return res.end();
    }
  } catch (err) {
    console.warn("stream fetch fallback curl:", err?.message || err);
  }

  return proxyMp4WithCurl(req, res, job);
}

const BIN_DIR = path.join(__dirname, "bin");
const BINARY_PATH = path.join(
  BIN_DIR,
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
);
const DOWNLOAD_DIR =
  process.env.DOWNLOAD_DIR || path.join(__dirname, "downloads", "jobs");

fs.mkdirSync(BIN_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// --- Ensure the yt-dlp binary is present (auto-download on first run) --------
async function ensureBinary() {
  if (fs.existsSync(BINARY_PATH)) return;
  console.log("Pobieram binarkę yt-dlp z GitHub…");
  await YTDlpWrap.downloadFromGithub(BINARY_PATH);
  if (process.platform !== "win32") fs.chmodSync(BINARY_PATH, 0o755);
  console.log("yt-dlp gotowe:", BINARY_PATH);
}

let ytDlp;

// --- In-memory job registry --------------------------------------------------
/** @type {Map<string, {status:string, progress:number, file?:string, name?:string, error?:string, clients:Set<import('express').Response>}>} */
const jobs = new Map();

const PLAY_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

function ensurePlayToken(job) {
  if (!job.playToken || !job.playTokenExpires || job.playTokenExpires < Date.now()) {
    job.playToken = crypto.randomBytes(32).toString("hex");
    job.playTokenExpires = Date.now() + PLAY_TOKEN_TTL_MS;
  }
  return job.playToken;
}

function canAccessPlay(req, job) {
  const token = req.query.token;
  if (
    typeof token === "string" &&
    token.length >= 16 &&
    job.playToken &&
    token === job.playToken &&
    job.playTokenExpires > Date.now()
  ) {
    return true;
  }
  if (req.get("X-Movies-Authorized") === "1") return true;
  return false;
}

function sendEvent(job, payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of job.clients) res.write(data);
}

// --- App ---------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  const user = authUserFromRequest(req);
  if (user) applyAuthToRequest(req, user);
  next();
});
app.use(express.static(path.join(__dirname, "public")));

function sanitizeName(name) {
  return (name || "video").replace(/[^\p{L}\p{N}\-_. ]/gu, "_").slice(0, 120).trim() || "video";
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `~${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatBitrateKbps(f) {
  return f.abr || f.tbr || f.vbr || 0;
}

function estimateBytesFromBitrate(kbps, durationSec) {
  if (!kbps || !durationSec) return 0;
  return (kbps * 1000 * durationSec) / 8;
}

function getFormatBytes(f, durationSec) {
  if (f.filesize) return f.filesize;
  if (f.filesize_approx) return f.filesize_approx;
  const br = formatBitrateKbps(f);
  return estimateBytesFromBitrate(br, durationSec || f.duration);
}

function pickBestAudio(formats) {
  return formats
    .filter((f) => f.acodec && f.acodec !== "none")
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
}

function pickBestVideoAtHeight(formats, height) {
  return formats
    .filter((f) => f.vcodec && f.vcodec !== "none" && f.height === height)
    .sort((a, b) => formatBitrateKbps(b) - formatBitrateKbps(a))[0];
}

function estimateMergedSize(videoFmt, audioBytes, durationSec) {
  if (!videoFmt) return audioBytes || 0;
  if (videoFmt.acodec && videoFmt.acodec !== "none") {
    return getFormatBytes(videoFmt, durationSec);
  }
  const videoBytes = getFormatBytes(videoFmt, durationSec);
  return videoBytes + (audioBytes || 0);
}

function buildVideoOptions(formats, durationSec) {
  const heights = [
    ...new Set(
      formats
        .filter((f) => f.vcodec && f.vcodec !== "none" && f.height)
        .map((f) => f.height)
    ),
  ].sort((a, b) => b - a);

  const bestAudio = pickBestAudio(formats);
  const audioBytes = getFormatBytes(bestAudio, durationSec);

  const bestVideo = formats
    .filter((f) => f.vcodec && f.vcodec !== "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0) || formatBitrateKbps(b) - formatBitrateKbps(a))[0];

  const options = [];
  const seen = new Set();

  const pushOption = (id, height, label, detail, sizeBytes) => {
    if (seen.has(id)) return;
    seen.add(id);
    options.push({
      id,
      height,
      label,
      detail,
      sizeBytes: Math.round(sizeBytes),
      sizeLabel: formatBytes(sizeBytes),
    });
  };

  const bestSize = estimateMergedSize(bestVideo, audioBytes, durationSec);
  pushOption(
    "best",
    "best",
    "Najlepsza",
    bestVideo?.height ? `${bestVideo.height}p` : "",
    bestSize
  );

  for (const h of heights) {
    const vf = pickBestVideoAtHeight(formats, h);
    const size = estimateMergedSize(vf, audioBytes, durationSec);
    const fps = vf?.fps ? `${Math.round(vf.fps)} fps` : "";
    const br = vf ? Math.round(formatBitrateKbps(vf)) : 0;
    const detail = [br ? `${br} kbps` : "", fps].filter(Boolean).join(" · ");
    pushOption(String(h), h, `${h}p`, detail, size);
  }

  return options;
}

const AUDIO_BITRATES = [320, 256, 192, 128, 96];

function buildAudioOptions(formats, durationSec, container) {
  const bestAudio = pickBestAudio(formats);
  const sourceAbr = Math.round(bestAudio?.abr || 0);
  const bestSize =
    getFormatBytes(bestAudio, durationSec) ||
    estimateBytesFromBitrate(sourceAbr || 256, durationSec);

  const options = [
    {
      id: "best",
      bitrate: "best",
      label: "Najlepsza",
      detail: sourceAbr ? `źródło ~${sourceAbr} kbps` : container.toUpperCase(),
      sizeBytes: Math.round(bestSize),
      sizeLabel: formatBytes(bestSize),
    },
  ];

  for (const br of AUDIO_BITRATES) {
    if (sourceAbr && br > sourceAbr + 16) continue;
    const size = estimateBytesFromBitrate(br, durationSec);
    options.push({
      id: String(br),
      bitrate: br,
      label: `${br} kbps`,
      detail: container.toUpperCase(),
      sizeBytes: Math.round(size),
      sizeLabel: formatBytes(size),
    });
  }

  return options;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function absUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http://")) return "https://" + url.slice(7);
  return url;
}

const THUMB_CACHE_DIR = path.join(__dirname, "tmp", "thumb-cache");
fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true });

const POSTER_HOST_RE =
  /^https:\/\/(?:image\.tmdb\.org|s\.tvp\.pl|icdn\.cda\.pl|i\.ytimg\.com|cdn\.cda\.pl|is[0-9]-ssl\.mzstatic\.com|[^/]*cda-hd\.[^/]+)\//i;

function normalizePosterUrl(url) {
  if (!url) return "";
  let u = absUrl(String(url).trim());
  if (!u) return "";

  if (/logo2-1\.png|\/wp-content\/uploads\/2018\/02\/logo/i.test(u)) return "";

  if (/image\.tmdb\.org\/t\/p\/w\d+\//i.test(u)) {
    u = u.replace(/\/t\/p\/w\d+\//, "/t/p/w500/");
  }

  u = u
    .replace(/\{width(?::\d+)?\}/gi, "640")
    .replace(/\{height(?::\d+)?\}/gi, "360");

  if (/s\.tvp\.pl\/images\/[a-f0-9/]+\/uid_[a-f0-9]+$/i.test(u)) return "";

  return u;
}

function mapSearchThumbnails(results) {
  return results.map((item) => ({
    ...item,
    thumbnail: normalizePosterUrl(item.thumbnail),
  }));
}

async function enrichFavoriteItems(items) {
  const out = [];
  for (const item of items) {
    let thumb = normalizePosterUrl(item.thumbnail);
    if (!thumb && item.url) {
      try {
        const info = await resolveMediaInfo(item.url, null, null);
        thumb = normalizePosterUrl(info.thumbnail);
      } catch {
        /* keep empty */
      }
    }
    out.push({ ...item, thumbnail: thumb || item.thumbnail || "" });
  }
  return out;
}

function parseDurationText(text) {
  if (!text) return 0;
  const parts = text.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function pickYoutubeThumb(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return "";
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || "";
}

function sortSearchResults(results, sort = "duration") {
  const list = [...results];
  if (sort === "title") {
    return list.sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "pl", { sensitivity: "base" })
    );
  }
  if (sort === "premium_first") {
    return list.sort((a, b) => Number(!!b.premium) - Number(!!a.premium));
  }
  if (sort === "free_first") {
    return list.sort((a, b) => Number(!!a.premium) - Number(!!b.premium));
  }
  if (sort === "relevance") return list;
  return list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
}

function filterByAccess(results, access = "all") {
  const mode = String(access || "all").toLowerCase();
  if (mode === "all") return results;
  return results.filter((item) => {
    if (item.source !== "cda") return true;
    const premium = !!item.premium;
    if (mode === "premium") return premium;
    if (mode === "free") return !premium;
    return true;
  });
}

function paginateSearchResults(results, page = 1, pageSize = 24) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || 24, 1), 48);
  const total = results.length;
  const start = (safePage - 1) * safeSize;
  const slice = results.slice(start, start + safeSize);
  return {
    results: slice,
    page: safePage,
    pageSize: safeSize,
    total,
    hasMore: start + slice.length < total,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
  };
}

async function enrichSearchMeta(item, browser) {
  if (item.duration && item.quality) return item;
  try {
    const stdout = await ytDlp.execPromise([
      item.url,
      "--dump-json",
      "--no-playlist",
      "--skip-download",
      ...cookieArgs(browser),
    ]);
    const info = JSON.parse(stdout);
    const heights = [
      ...new Set(
        (info.formats || [])
          .filter((f) => f.vcodec && f.vcodec !== "none" && f.height)
          .map((f) => f.height)
      ),
    ].sort((a, b) => b - a);
    const maxQ = heights[0] || info.height || 0;
    return {
      ...item,
      duration: info.duration || item.duration || 0,
      quality: maxQ ? `${maxQ}p` : item.quality || null,
      qualities: heights.slice(0, 4).map((h) => `${h}p`),
    };
  } catch {
    return item;
  }
}

async function enrichSearchResults(results, browser, source) {
  if (source === "cda" || source === "cda-hd" || source === "youtube") return results;
  const batchSize = 4;
  const enriched = [];
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const part = await Promise.all(batch.map((r) => enrichSearchMeta(r, browser)));
    enriched.push(...part);
  }
  return enriched;
}

function walkYtNodes(node, out) {
  if (!node || typeof node !== "object") return;
  if (node.videoRenderer?.videoId) out.push(node.videoRenderer);
  if (Array.isArray(node)) {
    for (const child of node) walkYtNodes(child, out);
    return;
  }
  for (const value of Object.values(node)) walkYtNodes(value, out);
}

function extractVideosFromYtInitialData(data, limit) {
  const renderers = [];
  walkYtNodes(data, renderers);
  const seen = new Set();
  const results = [];
  for (const video of renderers) {
    const id = video.videoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title =
      (video.title?.runs || []).map((r) => r.text).join("") ||
      video.title?.simpleText ||
      "Bez tytułu";
    const thumbs = video.thumbnail?.thumbnails || [];
    results.push({
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: pickYoutubeThumb(thumbs) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      uploader:
        video.ownerText?.runs?.[0]?.text ||
        video.longBylineText?.runs?.[0]?.text ||
        "YouTube",
      duration: parseDurationText(video.lengthText?.simpleText || ""),
      quality: null,
      qualities: [],
      source: "youtube",
      detail: "YouTube",
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function searchYouTubeHtml(query, limit = 32) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const html = await fetch(searchUrl, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
      Cookie: "CONSENT=YES+1",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  }).then((r) => {
    if (!r.ok) throw new Error(`YouTube HTTP ${r.status}`);
    return r.text();
  });

  const patterns = [
    /var ytInitialData = (\{.+?\});\s*<\/script>/s,
    /window\["ytInitialData"\]\s*=\s*(\{.+?\});/s,
    /ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (!match) continue;
    try {
      const data = JSON.parse(match[1]);
      const results = extractVideosFromYtInitialData(data, limit);
      if (results.length) return results;
    } catch {
      /* try next pattern */
    }
  }
  return [];
}

async function searchYouTubeYtDlp(query, limit = 32, browser) {
  const count = Math.min(Math.max(Number(limit) || 32, 1), 32);
  const stdout = await Promise.race([
    ytDlp.execPromise([
      `ytsearch${count}:${query}`,
      "--flat-playlist",
      "--dump-single-json",
      "--socket-timeout",
      "10",
      ...cookieArgs(browser),
    ]),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("YouTube search timeout")), 18000)
    ),
  ]);
  const data = JSON.parse(stdout);
  return (data.entries || []).map((e) => ({
    id: e.id,
    title: e.title || "Bez tytułu",
    url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
    thumbnail: pickYoutubeThumb(e.thumbnails) || `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
    uploader: e.uploader || e.channel || "YouTube",
    duration: e.duration || 0,
    quality: null,
    qualities: [],
    source: "youtube",
    detail: "YouTube",
  }));
}

async function searchYouTube(query, limit = 32, browser) {
  const count = Math.min(Math.max(Number(limit) || 32, 1), 48);
  try {
    const htmlResults = await searchYouTubeHtml(query, count);
    if (htmlResults.length) return htmlResults;
  } catch (err) {
    console.error("youtube html search:", err?.message || err);
  }
  try {
    return await searchYouTubeYtDlp(query, count, browser);
  } catch (err) {
    console.error("youtube yt-dlp search:", err?.message || err);
    return [];
  }
}

function decodeHtmlText(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&oacute;/gi, "ó")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function rankSearchByQuery(results, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return results;
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  const scoreTitle = (title) => {
    const t = String(title || "").toLowerCase();
    let score = 0;
    if (t.includes(q)) score += 120;
    for (const token of tokens) {
      if (t.includes(token)) score += 18;
    }
    if (/roman\s*holiday|rzymskie\s*wakacje/i.test(t)) score += 40;
    return score;
  };
  return [...results].sort((a, b) => {
    const diff = scoreTitle(b.title) - scoreTitle(a.title);
    if (diff !== 0) return diff;
    return Number(!!a.premium) - Number(!!b.premium);
  });
}

function parseCdaSearchHtml(html, limit = 48) {
  const results = [];
  const seen = new Set();
  const blockRe = /<div class="video-clip-wrapper">([\s\S]*?)(?=<div class="video-clip-wrapper">|$)/gi;
  let m;

  while ((m = blockRe.exec(html)) && results.length < limit) {
    const block = m[1];
    const hrefMatch = block.match(/class="video-clip-link[^"]*"[^>]*href="([^"]+)"/i);
    if (!hrefMatch) continue;

    let url = decodeHtmlText(hrefMatch[1]);
    if (url.startsWith("/")) url = `https://www.cda.pl${url}`;
    if (!/^https:\/\/www\.cda\.pl\/video\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const thumb = block.match(/class="video-clip-image" src="([^"]+)"/i)?.[1] || "";
    const time = block.match(/class="timeElem">([^<]*)</i)?.[1] || "";
    const title = decodeHtmlText(block.match(/class="link-title-visit"[^>]*>([^<]*)</i)?.[1] || "");
    if (!title) continue;

    const quality = block.match(/class="hd-ico-elem[^"]*">([^<]*)</i)?.[1]?.trim() || null;
    const premium = /flag-video-premium/.test(block);

    results.push({
      id: url.split("/video/")[1]?.split("/")[0] || url,
      title,
      url,
      thumbnail: normalizePosterUrl(thumb),
      uploader: "CDA",
      duration: parseDurationText(time),
      quality,
      qualities: quality ? [quality] : [],
      premium,
      source: "cda",
      detail: premium ? "Premium · CDA" : "CDA",
    });
  }

  return results;
}

async function searchCda(query, limit = 48) {
  const target = Math.min(Math.max(Number(limit) || 48, 1), 120);
  const all = [];
  const seen = new Set();
  const maxPages = Math.min(3, Math.max(1, Math.ceil(target / 16)));

  for (let p = 1; p <= maxPages && all.length < target; p += 1) {
    const searchUrl = new URL("https://www.cda.pl/szukaj");
    searchUrl.searchParams.set("key", query);
    if (p > 1) searchUrl.searchParams.set("page", String(p));

    let html;
    try {
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          Referer: "https://www.cda.pl/",
        },
        redirect: "follow",
      });
      if (!res.ok) break;
      html = await res.text();
    } catch (err) {
      console.error("cda search fetch:", err?.message || err);
      break;
    }

    const batch = parseCdaSearchHtml(html, target - all.length);
    let added = 0;
    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      all.push(item);
      added += 1;
    }
    if (!added || batch.length < 6) break;
  }

  return rankSearchByQuery(all.slice(0, target), query);
}

async function searchTvp(query, limit = 48) {
  const target = Math.min(Math.max(Number(limit) || 48, 1), 120);
  const seen = new Set();
  const results = [];

  const addItem = (item) => {
    const url = item.webUrl;
    if (!url || seen.has(url)) return;
    seen.add(url);
    const quality = item.uhd ? "4K" : null;
    results.push({
      id: String(item.id),
      title: item.title || "Bez tytułu",
      url,
      thumbnail: normalizePosterUrl(item.images?.["16x9"]?.[0]?.url || item.images?.["3x4"]?.[0]?.url),
      uploader: item.mainCategory?.name || "TVP VOD",
      duration: 0,
      quality,
      qualities: quality ? [quality] : [],
      source: "tvp",
      detail: item.type === "SERIAL" ? "Serial · TVP VOD" : "TVP VOD",
    });
  };

  for (const type of ["VOD", "VOD_SERIAL"]) {
    const apiUrl =
      `https://vod.tvp.pl/api/products/vods/search/${type}?` +
      new URLSearchParams({ keyword: query, platform: "BROWSER" });
    try {
      const data = await fetch(apiUrl, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      }).then((r) => r.json());
      for (const item of data.items || []) addItem(item);
    } catch (err) {
      console.error("tvp search error:", err?.message || err);
    }
  }

  // Playable materiały z tvp.pl (poza VOD)
  try {
    const html = await fetch(
      `https://www.tvp.pl/szukaj?query=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": UA } }
    ).then((r) => r.text());
    const itemsMatch = html.match(/"items"\s*:\s*(\[[\s\S]*?\])\s*,\s*"countings"/);
    if (itemsMatch) {
      const items = JSON.parse(itemsMatch[1]);
      for (const item of items) {
        if (item.type !== "video" || !item.playable || results.length >= target) continue;
        let url = item.url || "";
        if (url.startsWith("/")) url = "https://www.tvp.pl" + url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        results.push({
          id: String(item._id),
          title: item.title || "Bez tytułu",
          url,
          thumbnail: normalizePosterUrl(
            item.image?.url
              ?.replace(/\{width(?::\d+)?\}/gi, "640")
              ?.replace(/\{height(?::\d+)?\}/gi, "360")
          ),
          uploader: "TVP",
          duration: 0,
          quality: null,
          qualities: [],
          source: "tvp",
          detail: "Wideo · tvp.pl",
        });
      }
    }
  } catch (err) {
    console.error("tvp.pl search error:", err?.message || err);
  }

  return results.slice(0, target);
}

const SEARCH_FETCH_LIMIT = 48;
const SOURCE_FETCH_LIMITS = {
  youtube: 28,
  cda: 48,
  "cda-hd": 48,
  tvp: 48,
  "apple-music": 30,
};

let cdaHdLatestCache = { at: 0, items: [] };
const CDA_HD_LATEST_TTL_MS = 15 * 60 * 1000;

const SEARCH_HANDLERS = {
  youtube: (q, limit, browser) => searchYouTube(q, Math.min(limit, SOURCE_FETCH_LIMITS.youtube), browser),
  cda: (q, limit) => searchCda(q, limit),
  "cda-hd": (q, limit) => searchCdaHd(q, limit, 4),
  tvp: (q, limit) => searchTvp(q, limit),
  "apple-music": (q, limit) => searchAppleMusic(q, Math.min(limit, SOURCE_FETCH_LIMITS["apple-music"])),
};

// GET /api/cda-hd/latest?limit=10 — public feed for Top Shelf (cached)
app.get("/api/cda-hd/latest", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 24);
  const now = Date.now();
  if (now - cdaHdLatestCache.at < CDA_HD_LATEST_TTL_MS && cdaHdLatestCache.items.length >= limit) {
    return res.json({ items: cdaHdLatestCache.items.slice(0, limit), cached: true });
  }
  try {
    const items = mapSearchThumbnails(await fetchCdaHdLatest(24));
    cdaHdLatestCache = { at: now, items };
    res.json({ items: items.slice(0, limit), cached: false });
  } catch (err) {
    console.error("cda-hd latest:", err?.message || err);
    if (cdaHdLatestCache.items.length) {
      return res.json({ items: cdaHdLatestCache.items.slice(0, limit), cached: true, stale: true });
    }
    res.status(502).json({ error: "Nie udało się pobrać najnowszych z CDA-HD." });
  }
});

// POST /api/search  { query, source, limit?, page?, pageSize?, sort?, access? }
app.post("/api/search", async (req, res) => {
  const query = (req.body?.query || "").trim();
  const source = (req.body?.source || "youtube").toLowerCase();
  const page = Math.max(Number(req.body?.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.body?.pageSize) || 24, 1), 48);
  const sort = String(req.body?.sort || "relevance").toLowerCase();
  const access = String(req.body?.access || "all").toLowerCase();
  const fetchLimit = Math.min(
    Math.max(Number(req.body?.limit) || SEARCH_FETCH_LIMIT, pageSize),
    SEARCH_FETCH_LIMIT
  );
  const browser = req.body?.useCookies ? req.body.browser : null;

  if (!query) return res.status(400).json({ error: "Podaj frazę wyszukiwania." });

  try {
    let results;
    if (source === "all") {
      const chunks = await Promise.all(
        Object.entries(SEARCH_HANDLERS).map(async ([src, fn]) => {
          try {
            const srcLimit = Math.min(fetchLimit, SOURCE_FETCH_LIMITS[src] || fetchLimit);
            const part = await fn(query, srcLimit, browser);
            return enrichSearchResults(part, browser, src);
          } catch (err) {
            console.error(`search all/${src}:`, err?.message || err);
            return [];
          }
        })
      );
      const merged = (await Promise.all(chunks)).flat();
      const seen = new Set();
      results = merged.filter((item) => {
        const key = String(item.url || item.title || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      results = sortSearchResults(results, sort);
    } else {
      const handler = SEARCH_HANDLERS[source];
      if (!handler) return res.status(400).json({ error: "Nieznane źródło wyszukiwania." });
      results = await handler(query, fetchLimit, browser);
      results = await enrichSearchResults(results, browser, source);
      results = sortSearchResults(results, sort);
    }
    if (sort === "relevance") {
      results = rankSearchByQuery(results, query);
    }
    results = filterByAccess(results, access);
    results = mapSearchThumbnails(results);
    const paged = paginateSearchResults(results, page, pageSize);
    res.json({ query, source, sort, access, ...paged });
  } catch (err) {
    console.error("search error:", err?.message || err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

// GET /api/health — ping dla EstateOS Centrala (proxy admin)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "video-downloader" });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { login, password } = req.body || {};
    const account = await validateLineageLogin(login, password);
    const token = signMoviesToken(account);
    res.json({
      ok: true,
      token,
      user: { login: account.login, role: account.role },
      expiresIn: Number(process.env.MOVIES_JWT_TTL_SEC || 60 * 60 * 24 * 30),
    });
  } catch (err) {
    res.status(401).json({ error: err.message || "Logowanie nie powiodło się." });
  }
});

app.get("/api/auth/me", (req, res) => {
  const user = authUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Brak autoryzacji." });
  res.json({ ok: true, user: { login: user.login, role: user.role } });
});

app.get("/api/portal/status", (req, res) => {
  res.json({ portals: listPortalStatus(req) });
});

app.post("/api/portal/cookies", (req, res) => {
  try {
    const { portal, cookies } = req.body || {};
    const result = savePortalCookies(req, portal, cookies);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message || "Błąd zapisu ciasteczek." });
  }
});

app.post("/api/portal/login", async (req, res) => {
  try {
    const { portal, email, password } = req.body || {};
    if (portal === "tvp") {
      const result = await tryTvpLogin(req, email, password);
      return res.json({ ok: true, ...result });
    }
    if (!PORTALS[portal]) {
      return res.status(400).json({ error: "Logowanie dostępne dla TVP. CDA: wklej cookies.txt." });
    }
    savePortalCredentials(req, portal, email, password);
    res.json({
      ok: true,
      portal,
      message: "Hasło zapisane. Dla CDA wklej plik cookies.txt z przeglądarki.",
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Logowanie nie powiodło się." });
  }
});

app.get("/api/favorites", async (req, res) => {
  try {
    let items = listFavorites(req);
    items = await enrichFavoriteItems(items);
    res.json({ items });
  } catch (err) {
    res.status(401).json({ error: err.message || "Brak konta użytkownika." });
  }
});

app.get("/api/thumb", async (req, res) => {
  const raw = String(req.query.url || "").trim();
  const url = normalizePosterUrl(raw);
  if (!url || !POSTER_HOST_RE.test(url)) {
    return res.status(400).json({ error: "Nieprawidłowy adres miniatury." });
  }

  const cacheKey = crypto.createHash("sha256").update(url).digest("hex");
  const cachePath = path.join(THUMB_CACHE_DIR, cacheKey);

  try {
    if (fs.existsSync(cachePath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=604800");
      return createReadStream(cachePath).pipe(res);
    }

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "image/jpeg,image/png,image/apng,image/*;q=0.8",
        Referer: "https://cda-hd.cc/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status === 404 ? 404 : 502).json({ error: "Nie udało się pobrać miniatury." });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!buf.length) return res.status(502).json({ error: "Pusta miniatury." });

    try {
      fs.writeFileSync(cachePath, buf);
    } catch {
      /* cache optional */
    }

    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ctype.startsWith("image/") ? ctype : "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.send(buf);
  } catch (err) {
    console.error("thumb proxy:", err?.message || err);
    res.status(502).json({ error: "Miniatura niedostępna." });
  }
});

app.post("/api/favorites/reconcile", (req, res) => {
  try {
    const user = authUserFromRequest(req);
    if (!user?.userId?.startsWith("player:")) {
      return res.status(401).json({ error: "Brak konta użytkownika." });
    }
    const legacyKey = String(req.body?.legacyKey || "").trim();
    if (!/^[a-f0-9]{24}$/.test(legacyKey)) {
      return res.status(400).json({ error: "Nieprawidłowy klucz legacy." });
    }
    const items = mergeFavoritesStoreKey(legacyKey, user.userId);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(400).json({ error: err.message || "Nie udało się scalić ulubionych." });
  }
});

app.post("/api/favorites", (req, res) => {
  try {
    const item = addFavorite(req, req.body?.item || req.body);
    res.json({ ok: true, item });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się zapisać ulubionego." });
  }
});

app.delete("/api/favorites", (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const result = removeFavorite(req, url);
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się usunąć ulubionego." });
  }
});

// GET /api/music/library — foldery + utwory użytkownika
app.get("/api/music/library", (req, res) => {
  try {
    res.json(listMusicLibrary(req));
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się wczytać biblioteki." });
  }
});

// POST /api/music/folders { name }
app.post("/api/music/folders", (req, res) => {
  try {
    const folder = createMusicFolder(req, req.body || {});
    res.json({ ok: true, folder });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się utworzyć folderu." });
  }
});

// PATCH /api/music/folders/:id { name }
app.patch("/api/music/folders/:id", (req, res) => {
  try {
    const folder = renameMusicFolder(req, req.params.id, req.body || {});
    res.json({ ok: true, folder });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się zmienić nazwy folderu." });
  }
});

// DELETE /api/music/folders/:id
app.delete("/api/music/folders/:id", (req, res) => {
  try {
    const result = deleteMusicFolder(req, req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się usunąć folderu." });
  }
});

// GET /api/music/folders/:id/tracks
app.get("/api/music/folders/:id/tracks", (req, res) => {
  try {
    res.json(listFolderTracks(req, req.params.id));
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się wczytać utworów." });
  }
});

// POST /api/music/folders/:id/tracks { url, title, artist, album, thumbnail, duration }
app.post("/api/music/folders/:id/tracks", (req, res) => {
  try {
    const track = addTrackToFolder(req, req.params.id, req.body?.track || req.body || {});
    res.json({ ok: true, track });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się dodać utworu." });
  }
});

// DELETE /api/music/folders/:id/tracks?url=
app.delete("/api/music/folders/:id/tracks", (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const result = removeTrackFromFolder(req, req.params.id, url);
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się usunąć utworu." });
  }
});

// POST /api/info  { url }  -> metadata + available qualities/formats
app.post("/api/info", async (req, res) => {
  const url = (req.body?.url || "").trim();
  const browser = req.body?.useCookies ? req.body.browser : null;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "Podaj poprawny link (http/https)." });
  }
  try {
    if (/cda\.pl\/video\//i.test(url)) {
      resolveCdaDualStream(url, 480, browser, req).catch(() => {});
    }
    const data = await resolveMediaInfo(url, browser, req);
    res.json(data);
  } catch (err) {
    console.error("info error:", err?.message || err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

// Build a yt-dlp format selector based on user's choice
function buildArgs({ url, kind, container, height, audioBitrate, jobDir, browser }) {
  const outTemplate = path.join(jobDir, "%(title).100s.%(ext)s");
  const base = [
    url,
    "-o",
    outTemplate,
    "--no-playlist",
    "--no-part",
    "--newline",
    "--ffmpeg-location",
    ffmpegStatic,
    ...cookieArgs(browser),
  ];

  if (kind === "audio") {
    const quality =
      audioBitrate && audioBitrate !== "best" ? String(audioBitrate) : "0";
    return [
      ...base,
      "-f",
      "bestaudio/best",
      "-x",
      "--audio-format",
      container || "mp3",
      "--audio-quality",
      quality,
    ];
  }

  // video
  const heightFilter = height && height !== "best" ? `[height<=${height}]` : "";
  const cont = container || "mp4";
  let selector;
  if (cont === "mp4") {
    selector = `bv*${heightFilter}[ext=mp4]+ba[ext=m4a]/bv*${heightFilter}+ba/b${heightFilter}[ext=mp4]/b${heightFilter}`;
  } else if (cont === "webm") {
    selector = `bv*${heightFilter}[ext=webm]+ba[ext=webm]/bv*${heightFilter}+ba/b${heightFilter}`;
  } else {
    selector = `bv*${heightFilter}+ba/b${heightFilter}`;
  }

  return [
    ...base,
    "-f",
    selector,
    "--merge-output-format",
    cont,
  ];
}

/** Safari / AirPlay: prefer H.264 + AAC in MP4. */
function buildPreviewArgs({ url, height, jobDir, browser, req = null }) {
  const outTemplate = path.join(jobDir, "%(title).100s.%(ext)s");
  const h = height && height !== "best" ? Number(height) : 720;
  const base = [
    url,
    "-o",
    outTemplate,
    "--no-playlist",
    "--no-part",
    "--newline",
    "--concurrent-fragments",
    "4",
    "--ffmpeg-location",
    ffmpegStatic,
    ...cookieArgsFor(req, browser, url),
  ];

  if (/cda\.pl\/video\//i.test(url)) {
    return [
      ...base,
      "-f",
      `bestvideo[height<=${h}]+bestaudio/bestvideo+bestaudio`,
      "--merge-output-format",
      "mp4",
    ];
  }

  const selector = [
    `bestvideo[height<=${h}][vcodec^=avc1]+bestaudio[acodec^=mp4a]`,
    `bestvideo[height<=${h}][vcodec^=avc1]+bestaudio`,
    `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`,
  ].join("/");

  return [
    ...base,
    "-f",
    selector,
    "-S",
    `vcodec:h264:res:${h},acodec:aac`,
    "--merge-output-format",
    "mp4",
  ];
}

// POST /api/download  { url, kind, container, height } -> { jobId }
app.post("/api/download", async (req, res) => {
  const { url, kind, container, height, audioBitrate, useCookies, browser } = req.body || {};
  const cookieBrowser = useCookies ? browser : null;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "Podaj poprawny link." });
  }

  const jobId = crypto.randomUUID();

  if (/music\.apple\.com/i.test(url)) {
    startAppleMusicDownloadJob({ jobId, url });
    return res.json({ jobId });
  }

  if (isMirrorHost(url)) {
    try {
      const mirror = await getMirrorStream(url);
      startMirrorDownloadJob({
        jobId,
        streamUrl: mirror.stream.url,
        streamReferer: mirror.stream.referer,
        name: mirror.title,
      });
      return res.json({ jobId });
    } catch (err) {
      return res.status(500).json({ error: friendlyError(err) });
    }
  }

  const args = buildArgs({
    url,
    kind,
    container,
    height,
    audioBitrate,
    jobDir: path.join(DOWNLOAD_DIR, jobId),
    browser: cookieBrowser,
  });
  startTransferJob({ jobId, url, args, purpose: "download" });
  res.json({ jobId });
});

// POST /api/preview  — stream od razu (playMode=stream) lub bufor pod AirPlay (playMode=airplay)
app.post("/api/preview", async (req, res) => {
  const { url, height, useCookies, browser, playMode } = req.body || {};
  const cookieBrowser = useCookies ? browser : null;
  const forAirPlay = playMode === "airplay";
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "Podaj poprawny link." });
  }

  const jobId = crypto.randomUUID();
  const previewHeight = height && height !== "best" ? height : 480;

  let previewUrl = url;
  let previewTitle = null;
  try {
    if (isCdaHdTvShowUrl(url)) {
      const resolved = await resolveMirrorPlayUrl(url);
      previewUrl = resolved.url;
      previewTitle = resolved.title || null;
    }
  } catch (err) {
    return res.status(400).json({ error: friendlyError(err) });
  }

  if (forAirPlay) {
    try {
      if (isMirrorHost(previewUrl)) {
        const mirror = await getMirrorStream(previewUrl);
        const jobDir = path.join(DOWNLOAD_DIR, jobId);
        fs.mkdirSync(jobDir, { recursive: true });
        const safeName = sanitizeName(
          (mirror.title || "airplay").replace(/\.[^.]+$/, "") + ".mp4"
        );
        const filePath = path.join(jobDir, safeName);
        const job = {
          id: jobId,
          purpose: "preview",
          mode: "stream-proxy",
          streamUrl: mirror.stream.url,
          streamReferer: mirror.stream.referer,
          streamType: mirror.stream.type === "hls" ? "hls" : "mp4",
          name: safeName,
          status: "starting",
          progress: 0,
          clients: new Set(),
        };
        jobs.set(jobId, job);
        downloadStreamToFile(job, mirror.stream.url, mirror.stream.referer, filePath, {
          forAirPlay: true,
        });
        return res.json({ jobId, purpose: "preview", instant: false, mode: "airplay" });
      }

      const args = buildPreviewArgs({
        url: previewUrl,
        height: previewHeight,
        jobDir: path.join(DOWNLOAD_DIR, jobId),
        browser: cookieBrowser,
        req,
      });
      startTransferJob({ jobId, url: previewUrl, args, purpose: "preview" });
      return res.json({ jobId, purpose: "preview", instant: false, mode: "airplay" });
    } catch (err) {
      return res.status(500).json({ error: friendlyError(err) });
    }
  }

  if (isMirrorHost(previewUrl)) {
    try {
      const mirror = await getMirrorStream(previewUrl);
      await createStreamProxyPreviewJobAsync({
        jobId,
        streamUrl: mirror.stream.url,
        streamReferer: mirror.stream.referer,
        title: previewTitle || mirror.title,
        streamType: mirror.stream.type === "hls" ? "hls" : "mp4",
        req,
      });
      return res.json({ jobId, purpose: "preview", instant: true, mode: "stream" });
    } catch (err) {
      return res.status(500).json({ error: friendlyError(err) });
    }
  }

  if (/cda\.pl\/video\//i.test(previewUrl)) {
    try {
      const dual = await resolveCdaDualStream(previewUrl, previewHeight, cookieBrowser, req);
      if (dual?.videoUrl && dual?.audioUrl) {
        startCdaStreamingPreview({
          jobId,
          videoUrl: dual.videoUrl,
          audioUrl: dual.audioUrl,
          referer: previewUrl,
          previewHeight,
          pageUrl: previewUrl,
          browser: cookieBrowser,
          req,
        });
        return res.json({ jobId, purpose: "preview", instant: false, mode: "preparing" });
      }
      if (dual?.videoUrl) {
        await createStreamProxyPreviewJobAsync({
          jobId,
          streamUrl: dual.videoUrl,
          streamReferer: previewUrl,
          title: previewTitle || "preview",
          streamType: "mp4",
          req,
        });
        return res.json({ jobId, purpose: "preview", instant: true, mode: "stream" });
      }
    } catch (err) {
      console.warn("cda preview:", err?.message || err);
    }
  }

  try {
    const direct = await resolveYtdlpDirectStream(previewUrl, previewHeight, cookieBrowser, req);
    if (direct) {
      await createStreamProxyPreviewJobAsync({
        jobId,
        streamUrl: direct.streamUrl,
        streamReferer: direct.streamReferer,
        title: "preview",
        streamType: direct.streamType,
        audioStreamUrl: direct.audioStreamUrl,
        hlsFormatId: direct.hlsFormatId,
        previewHeight,
        req,
      });
      return res.json({
        jobId,
        purpose: "preview",
        instant: true,
        mode: direct.streamType === "hls-master" ? "hls-master" : direct.streamType === "hls" ? "hls" : "stream",
      });
    }
  } catch (err) {
    console.warn("direct stream preview:", err?.message || err);
  }

  try {
    const mirror = await resolveMirrorPage(previewUrl);
    if (mirror.stream?.url) {
      await createStreamProxyPreviewJobAsync({
        jobId,
        streamUrl: mirror.stream.url,
        streamReferer: mirror.stream.referer || url,
        title: mirror.title,
        streamType: mirror.stream.type === "hls" ? "hls" : "mp4",
        req,
      });
      return res.json({ jobId, purpose: "preview", instant: true, mode: "stream" });
    }
  } catch {
    /* not a mirror embed page */
  }

  return res.status(502).json({
    error:
      "Brak bezpośredniego streamu do szybkiego odtwarzania. Użyj «AirPlay na TV» (przygotuje plik) albo «Pobierz».",
  });
});

// GET /api/job/:jobId — status zadania (pobieranie / podgląd) dla klientów tvOS
app.get("/api/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Zadanie nie istnieje." });
  const ready =
    !!(job.file && fs.existsSync(job.file)) ||
    (job.mode === "stream-proxy" && job.status === "done" && !!job.streamUrl);
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress ?? 0,
    name: job.name || "",
    error: job.error || null,
    purpose: job.purpose || "download",
    ready,
    fullReady: !!job.fullReady,
    cdaFullPending: !!job.cdaFullPending,
    downloadPath: ready ? `/api/file/${job.id}` : null,
  });
});

// GET /api/progress/:jobId  (SSE)
app.get("/api/progress/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).end();

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  job.clients.add(res);

  // send current state immediately
  res.write(
    `data: ${JSON.stringify({
      status: job.status,
      progress: job.progress,
      name: job.name,
      error: job.error,
      jobId: req.params.jobId,
      purpose: job.purpose,
    })}\n\n`
  );

  req.on("close", () => job.clients.delete(res));
});

// POST /api/cancel/:jobId — przerwij pobieranie
app.post("/api/cancel/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Zadanie nie istnieje." });

  stopJobTransfer(job);

  try {
    if (job.file) {
      fs.rmSync(path.dirname(job.file), { recursive: true, force: true });
    } else {
      fs.rmSync(path.join(DOWNLOAD_DIR, job.id), { recursive: true, force: true });
    }
  } catch {}

  sendEvent(job, {
    status: "cancelled",
    error: "Pobieranie anulowane.",
    purpose: job.purpose,
  });

  jobs.delete(job.id);
  res.json({ ok: true, cancelled: true });
});

// GET /api/file/:jobId  -> stream the downloaded file, then clean up
app.get("/api/file/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.file || !fs.existsSync(job.file)) {
    return res.status(404).send("Plik niedostępny.");
  }
  res.download(job.file, sanitizeName(job.name), (err) => {
    cleanupJob(req.params.jobId);
    if (err && !res.headersSent) res.status(500).end();
  });
});

// GET /api/play-token/:jobId — token dla Apple TV (bez ciasteczek sesji)
app.get("/api/play-token/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.purpose !== "preview") {
    return res.status(404).json({ error: "Podgląd niedostępny." });
  }
  const token = ensurePlayToken(job);
  res.json({
    jobId: job.id,
    token,
    expiresIn: Math.max(0, Math.floor((job.playTokenExpires - Date.now()) / 1000)),
  });
});

function localPreviewMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".webm") return "video/webm";
  if (ext === ".mkv") return "video/x-matroska";
  return "video/mp4";
}

function serveLocalPreviewFile(req, res, job, filePath) {
  const stat = fs.statSync(filePath);
  const mime = localPreviewMime(filePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    let start = parseInt(parts[0], 10) || 0;
    let end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    if (Number.isNaN(start) || start < 0) start = 0;
    if (Number.isNaN(end) || end >= stat.size) end = stat.size - 1;
    if (start > end || start >= stat.size) {
      res.status(416);
      res.set("Content-Range", `bytes */${stat.size}`);
      return res.end();
    }
    res.status(206);
    res.set({
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Type": mime,
      "Content-Disposition": "inline",
      "Cache-Control": job.cdaFullPending ? "no-cache" : "private, max-age=3600",
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.set({
    "Content-Length": String(stat.size),
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    "Cache-Control": job.cdaFullPending ? "no-cache" : "private, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
}

function cleanupStaleJobDirs() {
  try {
    const maxAge = 3 * 60 * 60 * 1000;
    for (const id of fs.readdirSync(DOWNLOAD_DIR)) {
      const dir = path.join(DOWNLOAD_DIR, id);
      let stat;
      try {
        stat = fs.statSync(dir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (Date.now() - stat.mtimeMs < maxAge) continue;
      if (jobs.has(id)) {
        const job = jobs.get(id);
        if (job?.clients?.size) continue;
      }
      fs.rmSync(dir, { recursive: true, force: true });
      jobs.delete(id);
    }
  } catch (err) {
    console.warn("cleanup jobs:", err?.message || err);
  }
}
// GET /api/play/:jobId  -> odtwarzanie w przeglądarce (Range, AirPlay)
app.get("/api/play/:jobId", async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.purpose !== "preview") {
    return res.status(404).send("Podgląd niedostępny.");
  }

  if (!canAccessPlay(req, job)) {
    return res.status(403).send("Brak dostępu do podglądu.");
  }

  if (req.method === "HEAD") {
    if (job.mode === "stream-proxy" && job.streamUrl && !job.file) {
      if (
        job.streamType === "hls-master" ||
        job.streamType === "hls" ||
        typeof req.query.u === "string"
      ) {
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.set("Accept-Ranges", "bytes");
        res.set("Content-Disposition", "inline");
        return res.status(200).end();
      }
      return respondStreamProxyHead(req, res, job);
    }
    if (!job.file || !fs.existsSync(job.file)) {
      return res.status(404).end();
    }
    const stat = fs.statSync(job.file);
    const ext = path.extname(job.file).toLowerCase();
    const mime =
      ext === ".webm" ? "video/webm" : ext === ".mkv" ? "video/x-matroska" : "video/mp4";
    res.set({
      "Content-Length": String(stat.size),
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
    });
    return res.status(200).end();
  }

  if (job.mode === "stream-proxy" && job.streamUrl && !job.file) {
    try {
      if (typeof req.query.u === "string" && req.query.u.startsWith("http")) {
        return await proxyRemoteUrl(req, res, job, req.query.u);
      }
      return await proxyStreamPlay(req, res, job);
    } catch (err) {
      console.error("stream proxy error:", err?.message || err);
      return res.status(502).send("Nie udało się odtworzyć streamu.");
    }
  }

  if (!job.file || !fs.existsSync(job.file)) {
    return res.status(404).send("Podgląd niedostępny.");
  }

  return serveLocalPreviewFile(req, res, job, job.file);
});

// HEAD — Apple TV sprawdza metadane przed AirPlay
app.head("/api/play/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.purpose !== "preview" || !canAccessPlay(req, job)) {
    return res.status(job ? 403 : 404).end();
  }
  if (job.mode === "stream-proxy" && job.streamUrl && !job.file) {
    if (
      job.streamType === "hls-master" ||
      job.streamType === "hls" ||
      typeof req.query.u === "string"
    ) {
      res.set("Content-Type", "application/vnd.apple.mpegurl");
      res.set("Accept-Ranges", "bytes");
      res.set("Content-Disposition", "inline");
      return res.status(200).end();
    }
    return respondStreamProxyHead(req, res, job);
  }
  if (!job.file || !fs.existsSync(job.file)) {
    return res.status(404).end();
  }
  const stat = fs.statSync(job.file);
  res.set({
    "Content-Length": String(stat.size),
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  });
  res.status(200).end();
});

// Adres LAN — Apple TV nie odtworzy localhost, potrzebuje IP Maca w sieci Wi‑Fi
app.get("/api/playback-base", (_req, res) => {
  const lan = getLanIPv4();
  res.json({
    url: getPlaybackBaseUrl(),
    lanIp: lan,
    port: PORT,
    needsLanUrl: !!lan,
  });
});

// Buforuje stream na dysk Maca (H.264 + faststart) — wymagane dla AirPlay na TV
app.post("/api/prepare-airplay/:jobId", async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.purpose !== "preview") {
    return res.status(404).json({ error: "Podgląd niedostępny." });
  }

  if (job.file && fs.existsSync(job.file)) {
    ensurePlayToken(job);
    return res.json({ jobId: job.id, ready: true, token: job.playToken });
  }

  if (job.preparingAirplay) {
    return res.json({ jobId: job.id, preparing: true, progress: job.progress || 0 });
  }

  if (job.mode !== "stream-proxy" || !job.streamUrl) {
    return res.json({ jobId: job.id, ready: true });
  }

  job.preparingAirplay = true;
  const jobDir = path.join(DOWNLOAD_DIR, job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  const safeName = sanitizeName((job.name || "airplay").replace(/\.[^.]+$/, "") + ".mp4");
  const filePath = path.join(jobDir, safeName);

  res.json({ jobId: job.id, preparing: true });

  downloadStreamToFile(job, job.streamUrl, job.streamReferer, filePath, { forAirPlay: true })
    .finally(() => {
      job.preparingAirplay = false;
    });
});

// --- Boot --------------------------------------------------------------------
ensureBinary()
  .then(() => {
    ytDlp = new YTDlpWrap(BINARY_PATH);
    app.listen(PORT, "0.0.0.0", () => {
      cleanupStaleJobDirs();
      setInterval(cleanupStaleJobDirs, 30 * 60 * 1000);
      const lan = getLanIPv4();
      console.log(`\n▶  Pobieralnia filmów działa: http://localhost:${PORT}`);
      if (lan) {
        console.log(`   AirPlay / TV w tej sieci: http://${lan}:${PORT}\n`);
      } else {
        console.log("");
      }
    });
  })
  .catch((err) => {
    console.error("Nie udało się przygotować yt-dlp:", err);
    process.exit(1);
  });
