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
import { isCdaHdPlayerHost, isMirrorHost, isDoodLikeUrl, resolveMirrorPage } from "./voe-resolver.js";
import {
  isCdaHdTvShowUrl,
  isCdaHdFilmUrl,
  isCdaHdBrowseUrl,
  fetchCdaHdTvShow,
  loadCachedCdaHdTvShow,
  saveCachedCdaHdTvShow,
  buildCdaHdSeriesInfo,
  warmCdaHdTvShows,
  parseCdaHdMoviePage,
  fetchCdaHdBrowse,
  searchCdaHd,
  fetchCdaHdLatest,
  fetchCdaHdCatalog,
  orderCdaHdCatalog,
  loadCdaHdDiskCatalog,
} from "./cda-hd.js";
import { getCdaHdSessionInfo, startCdaHdSessionKeeper } from "./cda-hd-fetch.js";
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
  favoritesUserKeyFromReq,
  reconcileSessionStorage,
} from "./movies-favorites.js";
import {
  listMovieDownloads,
  linkMovieDownload,
  linkMovieDownloadByKey,
  deleteMovieDownload,
  findDownloadByJobId,
  findDownloadByUrl,
  resolvePersistedMovieFile,
  moviesDownloadDir,
  buildMovieFilename,
  mergeMoviesLibraryStoreKey,
  MOVIES_FOLDER_NAME,
  moviesFileDestPath,
  seriesFolderFromTitle,
} from "./movies-library.js";
import {
  listMusicLibrary,
  createMusicFolder,
  renameMusicFolder,
  deleteMusicFolder,
  listFolderTracks,
  addTrackToFolder,
  removeTrackFromFolder,
  reorderFolderTracks,
  updateTrackDownload,
  updateTrackDownloadByKey,
  getMusicFolderByKey,
  playlistDownloadDir,
  findTrackByDownloadJob,
  importTracksToFolder,
  linkFolderToApplePlaylist,
  syncAppleMusicPlaylistFolder,
  findMusicFolderForImport,
} from "./music-library.js";
import {
  signMoviesToken,
  validateLineageLogin,
  authUserFromRequest,
  applyAuthToRequest,
} from "./movies-auth.js";
import {
  loginOrLinkAppleAccount,
  unlinkAppleAccount,
  appleAuthSuccessResponse,
} from "./apple-auth.js";
import {
  searchAppleMusic,
  searchAppleMusicCatalog,
  fetchAppleMusicArtist,
  fetchAppleMusicAlbum,
  fetchAppleMusicPlaylist,
  buildAppleMusicInfo,
  downloadAppleMusicToFile,
  buildAppleMusicFilename,
  resolveAppleMusicDownloadUrl,
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
  if (/CDA-HD używa wbudowanego odtwarzacza/i.test(msg))
    return msg;
  if (/CDA-HD: film niedostępny|kod 407/i.test(msg))
    return "Ten film nie jest już dostępny do odtworzenia na CDA-HD — źródło wideo zostało usunięte lub wygasło. Strona z opisem może nadal istnieć.";
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

function buildTvpVideoOptions(durationSec) {
  const dur = durationSec > 0 ? durationSec : 45 * 60;
  const suffix = " ~";
  const tiers = [
    { id: "1080", label: "1080p", height: 1080, bw: 11281000 },
    { id: "720", label: "720p", height: 720, bw: 6287000 },
    { id: "540", label: "540p", height: 540, bw: 3128000 },
    { id: "360", label: "360p", height: 360, bw: 1362000 },
  ];
  return tiers.map((t) => {
    const sizeBytes = Math.round((t.bw * dur) / 8);
    return {
      id: t.id,
      label: t.label,
      height: t.height,
      detail: "TVP VOD · szacunek",
      sizeBytes,
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
    embedLabel: mirror.stream?.label || "cda-hd",
    title: mirror.title,
    thumbnail: absUrl(mirror.thumbnail),
    webpageUrl: mirror.webpageUrl,
    duration: durationSec,
    videoOptions: buildMirrorVideoOptions(durationSec, exactBytes),
    audioOptions: buildMirrorAudioOptions(durationSec),
  };
}

async function buildCdaHdFilmInfoAsync(mirror) {
  const base = await buildMirrorMediaInfoAsync(mirror);
  try {
    const meta = parseCdaHdMoviePage(mirror.html || "", mirror.webpageUrl);
    return {
      ...base,
      source: "cda-hd",
      title: meta.title || base.title,
      thumbnail: meta.thumbnail || base.thumbnail,
      duration: meta.duration || base.duration,
      uploader: meta.director?.name || "CDA-HD",
      quality: meta.rating?.value != null ? `${meta.rating.value}/10` : base.quality,
      cdaHd: meta,
    };
  } catch {
    return { ...base, source: "cda-hd" };
  }
}

async function resolveMediaInfo(url, browser, req = null) {
  if (/music\.apple\.com/i.test(url)) {
    return buildAppleMusicInfo(url);
  }

  let result;
  if (isMirrorHost(url)) {
    if (isCdaHdTvShowUrl(url)) {
      // Cache-first: od razu lista odcinków; FlareSolverr i tak trwa ~30–90 s.
      try {
        const show = await withTimeout(
          fetchCdaHdTvShow(url, { allowCache: true, preferCache: true }),
          200000,
          "cda-hd-tvshow"
        );
        result = buildCdaHdSeriesInfo({ ...show, webpageUrl: show.webpageUrl || url });
      } catch (err) {
        const cached = loadCachedCdaHdTvShow(url, 30 * 24 * 60 * 60 * 1000);
        if (cached?.episodes?.length) {
          console.warn("info cda-hd series cache:", err?.message || err);
          result = buildCdaHdSeriesInfo({ ...cached, webpageUrl: cached.webpageUrl || url });
        } else {
          throw err;
        }
      }
    } else {
      const mirror = await resolveMirrorPage(url);
      if (isCdaHdFilmUrl(mirror.webpageUrl || url)) {
        result = await buildCdaHdFilmInfoAsync(mirror);
      } else {
        result = await buildMirrorMediaInfoAsync(mirror);
      }
    }
    return ensureMediaInfoOptions(result);
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

    result = {
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
    return ensureMediaInfoOptions(result);
  } catch (err) {
    if (/Unsupported URL/i.test(String(err?.message || err))) {
      result = await buildMirrorMediaInfoAsync(await resolveMirrorPage(url));
      return ensureMediaInfoOptions(result);
    }
    throw err;
  }
}

function ensureMediaInfoOptions(info) {
  if (!info || info.isPlaylist) return info;
  const duration = info.duration || 0;
  const isTvp =
    /tvp/i.test(String(info.uploader || info.source || "")) ||
    /vod\.tvp\.pl/i.test(String(info.webpageUrl || ""));
  if (!Array.isArray(info.videoOptions) || !info.videoOptions.length) {
    info.videoOptions = isTvp
      ? buildTvpVideoOptions(duration)
      : buildMirrorVideoOptions(duration, 0);
  } else if (isTvp) {
    info.videoOptions = buildTvpVideoOptions(duration);
  }
  if (!info.audioOptions) {
    info.audioOptions = buildMirrorAudioOptions(duration);
  }
  return info;
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

  if (job.kind === "movie") {
    persistMovieFile(job);
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
  if (!job?.file || job.persistent) return;
  try {
    fs.rmSync(path.dirname(job.file), { recursive: true, force: true });
  } catch {}
  jobs.delete(jobId);
}

function assertValidMovieFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Brak pliku po pobraniu.");
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 512 * 1024) {
    let head = "";
    try {
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(200);
      fs.readSync(fd, buf, 0, 200, 0);
      fs.closeSync(fd);
      head = buf.toString("utf8");
    } catch {
      /* ignore */
    }
    if (/^#EXTM3U/i.test(head)) {
      throw new Error(
        "Pobrano tylko listę odtwarzania (HLS), a nie cały film — spróbuj ponownie."
      );
    }
    throw new Error(`Plik jest za mały (${stat.size} B) — pobieranie nie powiodło się.`);
  }
}

function finalizeMovieDownload(job) {
  if (!job?.userKey || !job?.movieUrl || !job?.file) return;
  try {
    linkMovieDownloadByKey(
      job.userKey,
      {
        url: job.movieUrl,
        title: job.movieTitle || job.name || "Film",
        thumbnail: job.movieThumbnail || "",
        source: job.movieSource || "",
        downloadJobId: job.id,
        filename: job.relativeMovieName || path.basename(job.file),
      },
      MUSIC_PLAYLIST_DOWNLOADS_DIR
    );
  } catch (err) {
    console.warn("movies library download link:", err?.message || err);
  }
}

function persistMovieFile(job) {
  if (job.kind !== "movie" || !job.persistent || !job.file) return;
  const title = job.movieTitle || job.name;
  const destInfo = moviesFileDestPath(MUSIC_PLAYLIST_DOWNLOADS_DIR, {
    title,
    jobId: job.id,
  }, { ensureDir: false });
  const dest = destInfo.filePath;
  if (job.file !== dest) {
    try {
      fs.renameSync(job.file, dest);
    } catch {
      fs.copyFileSync(job.file, dest);
      try {
        fs.unlinkSync(job.file);
      } catch {}
      try {
        const tempDir = path.dirname(job.file);
        if (tempDir.includes(path.join("downloads", "jobs"))) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }
    job.file = dest;
  }
  job.name = path.basename(dest);
  job.relativeMovieName = destInfo.relativeName;
  assertValidMovieFile(job.file);
  finalizeMovieDownload(job);
}

function startTransferJob({ jobId, url, args, purpose = "download", movieDownload = null }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const job = {
    id: jobId,
    purpose,
    status: "starting",
    progress: 0,
    clients: new Set(),
  };
  if (movieDownload) {
    Object.assign(job, {
      kind: "movie",
      persistent: true,
      userKey: movieDownload.userKey,
      movieUrl: movieDownload.url,
      movieTitle: movieDownload.title || "",
      movieThumbnail: movieDownload.thumbnail || "",
      movieSource: movieDownload.source || "",
    });
  }
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

  proc.on("close", (code, signal) => {
    if (job.status === "error" || job.status === "cancelled") return;
    if (signal || (code != null && code !== 0)) {
      job.status = "error";
      job.error =
        job.error ||
        friendlyError(
          new Error(
            signal
              ? `Pobieranie przerwane (${signal}).`
              : `Proces pobierania zakończył się błędem (kod ${code}).`
          )
        );
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

async function getMirrorStream(url, { force = false } = {}) {
  if (!force) {
    const cached = getCachedMirrorStream(url);
    if (cached) return cached;
  }

  const target = await resolveMirrorPlayUrl(url);
  let mirror = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      mirror = await resolveMirrorPage(target.url);
      if (mirror.stream?.url) break;
      if (mirror.playbackError) {
        lastErr = mirror.playbackError;
        break;
      }
      lastErr = new Error(
        mirror?.embeds?.length === 1 && isCdaHdPlayerHost(mirror.embeds[0]?.url)
          ? "Ten film na CDA-HD nie jest już dostępny do odtworzenia — źródło wideo zostało usunięte lub wygasło."
          : "Ten link z serwisu mirror nie ma osadzonego odtwarzacza obsługiwanego automatycznie."
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
  return /\.m3u8?(\?|$)/i.test(streamUrl) ? "hls" : "mp4";
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
  mirrorPageUrl,
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
    mirrorPageUrl: mirrorPageUrl || null,
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
  // ~55 MB wideo ≈ kilka–kilkanaście minut 720p — start od razu, pełny plik w tle.
  const videoPartialEnd = 55 * 1024 * 1024 - 1;
  const audioPartialEnd = 8 * 1024 * 1024 - 1;

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

function startTvpMovieDownloadJob({
  jobId,
  videoUrl,
  audioUrl,
  referer,
  movieDownload,
}) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const tempOut = path.join(jobDir, "download-tvp.mp4");
  const destInfo = moviesFileDestPath(MUSIC_PLAYLIST_DOWNLOADS_DIR, {
    title: movieDownload.title,
    jobId,
  }, { ensureDir: false });

  const job = {
    id: jobId,
    purpose: "download",
    kind: "movie",
    persistent: true,
    userKey: movieDownload.userKey,
    movieUrl: movieDownload.url,
    movieTitle: movieDownload.title || "",
    movieThumbnail: movieDownload.thumbnail || "",
    movieSource: movieDownload.source || "",
    status: "starting",
    progress: 0,
    clients: new Set(),
    file: tempOut,
    name: path.basename(destInfo.relativeName),
    relativeMovieName: destInfo.relativeName,
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
    tempOut,
  ]);
  job.proc = ff;
  job.status = "downloading";

  const poll = setInterval(() => {
    if (job.cancelled) {
      clearInterval(poll);
      return;
    }
    if (!fs.existsSync(tempOut)) return;
    const stat = fs.statSync(tempOut);
    const pct = Math.min(99, Math.round(stat.size / (50 * 1024 * 1024) * 10));
    job.progress = Math.max(job.progress || 0, pct);
    sendEvent(job, {
      status: "downloading",
      progress: job.progress,
      purpose: job.purpose,
    });
  }, 1000);

  ff.on("close", (code, signal) => {
    clearInterval(poll);
    if (job.cancelled) return;
    if (signal || code !== 0 || !fs.existsSync(tempOut)) {
      job.status = "error";
      job.error = signal
        ? `Nie udało się pobrać materiału TVP (${signal}).`
        : "Nie udało się pobrać materiału TVP.";
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
      return;
    }
    try {
      assertValidMovieFile(tempOut);
      job.file = ensureSafariPlayable(tempOut, jobDir);
      if (job.file !== destInfo.filePath) {
        fs.mkdirSync(path.dirname(destInfo.filePath), { recursive: true });
        fs.renameSync(job.file, destInfo.filePath);
        job.file = destInfo.filePath;
      }
      job.name = path.basename(destInfo.filePath);
      job.relativeMovieName = destInfo.relativeName;
      job.status = "done";
      job.progress = 100;
      job.ready = true;
      finalizeMovieDownload(job);
      sendEvent(job, {
        status: "done",
        progress: 100,
        jobId: job.id,
        purpose: job.purpose,
        ready: true,
      });
    } catch (err) {
      try {
        fs.unlinkSync(tempOut);
      } catch {}
      try {
        if (fs.existsSync(destInfo.filePath)) fs.unlinkSync(destInfo.filePath);
      } catch {}
      job.status = "error";
      job.error = friendlyError(err);
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
    }
  });

  ff.on("error", (err) => {
    clearInterval(poll);
    job.status = "error";
    job.error = friendlyError(err);
    sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
  });

  return job;
}

function startHlsMovieDownloadJob({
  jobId,
  streamUrl,
  referer,
  movieDownload,
  title,
}) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const job = {
    id: jobId,
    purpose: "download",
    kind: movieDownload ? "movie" : undefined,
    persistent: !!movieDownload,
    userKey: movieDownload?.userKey || null,
    movieUrl: movieDownload?.url || null,
    movieTitle: movieDownload?.title || title || "",
    movieThumbnail: movieDownload?.thumbnail || "",
    movieSource: movieDownload?.source || "",
    status: "starting",
    progress: 0,
    clients: new Set(),
  };
  jobs.set(jobId, job);

  const args = [
    streamUrl,
    "-o",
    path.join(jobDir, "download.%(ext)s"),
    "--referer",
    referer || "",
    "--ffmpeg-location",
    path.dirname(ffmpegStatic),
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--no-warnings",
  ];

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

  proc.on("close", (code, signal) => {
    if (job.cancelled || job.status === "error" || job.status === "cancelled") return;
    if (signal || (code != null && code !== 0)) {
      job.status = "error";
      job.error =
        job.error ||
        friendlyError(
          new Error(
            signal
              ? `Pobieranie HLS przerwane (${signal}).`
              : `Pobieranie HLS zakończyło się błędem (kod ${code}).`
          )
        );
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
      return;
    }
    sendEvent(job, { status: "processing", progress: 99, purpose: job.purpose });
    try {
      finalizeJob(job, jobDir);
      job.ready = true;
    } catch (err) {
      job.status = "error";
      job.error = friendlyError(err);
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

const CURL_INSECURE_HOSTS = /(?:^|\.)cfglobalcdn\.com$/i;

function curlFetchText(url, { referer, insecure = false } = {}) {
  const args = ["-sL", "-A", UA, "--max-time", String(Math.ceil(STREAM_PROXY_TIMEOUT_MS / 1000))];
  if (insecure) args.push("-k");
  if (referer) args.push("-H", `Referer: ${referer}`);
  args.push(url);
  const result = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  const body = (result.stdout || "").trim();
  return body || null;
}

async function fetchRemoteText(url, referer) {
  let insecure = false;
  try {
    insecure = CURL_INSECURE_HOSTS.test(new URL(url).hostname);
  } catch {
    /* ignore */
  }
  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": UA, Referer: referer || "" },
      signal: AbortSignal.timeout(STREAM_PROXY_TIMEOUT_MS),
    });
    if (upstream.ok) return await upstream.text();
  } catch {
    /* curl fallback below */
  }
  return curlFetchText(url, { referer, insecure: insecure || true });
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

  let text = await fetchRemoteText(job.streamUrl, job.streamReferer || "");
  if (!text) {
    return res.status(502).send("Błąd playlisty HLS.");
  }
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
    if (
      job.mirrorPageUrl &&
      [403, 404, 410, 502, 503].includes(upstream?.status) &&
      (await refreshMirrorStreamOnJob(job))
    ) {
      const nextUrl = typeof req.query.u === "string" ? null : job.streamUrl;
      if (nextUrl) return proxyStreamPlay(req, res, job);
    }
    if (/\.m3u8(\?|$)/i.test(targetUrl)) {
      const text = await fetchRemoteText(targetUrl, job.streamReferer || "");
      if (text) {
        const body = text
          .split("\n")
          .map((line) => rewriteHlsLine(line, { ...job, streamUrl: targetUrl }, req))
          .join("\n");
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.set("Cache-Control", "no-cache");
        return res.send(body);
      }
    }
    let insecure = false;
    try {
      insecure = CURL_INSECURE_HOSTS.test(new URL(targetUrl).hostname);
    } catch {
      /* ignore */
    }
    if (!/\.m3u8(\?|$)/i.test(targetUrl)) {
      const maxTime = String(Math.ceil(STREAM_PROXY_TIMEOUT_MS / 1000));
      const args = ["-sL", "-A", UA, "--max-time", maxTime];
      if (insecure) args.push("-k");
      if (job.streamReferer) args.push("-H", `Referer: ${job.streamReferer}`);
      if (req.headers.range) args.push("--range", String(req.headers.range).replace(/^bytes=/, ""));
      args.push(targetUrl);
      res.set("Accept-Ranges", "bytes");
      res.status(200);
      const proc = spawn("curl", args);
      proc.stdout.pipe(res);
      proc.on("error", () => {
        if (!res.headersSent) res.status(502).send("Błąd streamu wideo.");
      });
      return;
    }
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
      const cap = forAirPlay ? 90 : 99;
      if (total > 0) {
        job.progress = Math.min(cap, Math.round((downloaded / total) * cap));
      } else {
        // No Content-Length (common on CDNs) — show byte-based progress so UI isn't stuck at 0%.
        job.progress = Math.min(cap, Math.max(1, Math.round(downloaded / (3 * 1024 * 1024))));
      }
      sendEvent(job, {
        status: "downloading",
        progress: job.progress,
        purpose: job.purpose,
        airplayPrepare: forAirPlay,
        downloadedBytes: downloaded,
        totalBytes: total || null,
      });
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
    job.ready = true;
    if (forAirPlay) ensurePlayToken(job);
    if (job.kind === "movie" && !forAirPlay) {
      assertValidMovieFile(destPath);
      persistMovieFile(job);
    }
    sendEvent(job, {
      status: job.status,
      progress: 100,
      name: job.name,
      jobId: job.id,
      purpose: job.purpose,
      airplayPrepare: forAirPlay,
      playToken: job.playToken,
      ready: true,
    });
  } catch (err) {
    if (job.cancelled || err?.name === "AbortError") return;
    try {
      if (destPath && fs.existsSync(destPath)) fs.unlinkSync(destPath);
    } catch {}
    job.status = "error";
    job.error = friendlyError(err);
    sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
  }
}

function startAppleMusicDownloadJob({ jobId, url, userKey, folderId, trackUrl }) {
  const job = {
    id: jobId,
    purpose: "download",
    kind: "music",
    persistent: true,
    userKey: userKey || null,
    folderId: folderId || null,
    trackUrl: trackUrl || null,
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
      const filePath = resolveMusicPlaylistFilePath({
        userKey,
        folderId,
        jobId,
        filename: safeName,
      });

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

      if (userKey && folderId && trackUrl) {
        try {
          updateTrackDownloadByKey(userKey, folderId, trackUrl, jobId);
        } catch (err) {
          console.warn("music library download link:", err?.message || err);
        }
      }
    } catch (err) {
      if (job.cancelled) return;
      job.status = "error";
      job.error = friendlyAppleMusicError(err);
      sendEvent(job, { status: "error", error: job.error, purpose: job.purpose });
    }
  })();

  return job;
}

function startAppleMusicPlayJob({ jobId, url }) {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const job = {
    id: jobId,
    purpose: "music-play",
    kind: "music",
    persistent: false,
    status: "starting",
    progress: 0,
    clients: new Set(),
  };
  jobs.set(jobId, job);

  (async () => {
    try {
      job.status = "preparing";
      sendEvent(job, { status: "preparing", progress: 5, purpose: job.purpose });

      const track = await buildAppleMusicInfo(url);
      job.name = track.title;
      const safeName = buildAppleMusicFilename(track);
      const filePath = path.join(jobDir, safeName);

      job.status = "downloading";
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

function musicJobReady(job) {
  if (!job || job.kind !== "music") return false;
  if (job.file && fs.existsSync(job.file)) return true;
  return job.mode === "stream-proxy" && job.status === "done" && !!job.streamUrl;
}

function movieJobReady(job) {
  if (!job || job.kind !== "movie") return false;
  return !!(job.file && fs.existsSync(job.file));
}

function getOrRestoreMovieJob(jobId, req) {
  const existing = jobs.get(jobId);
  if (existing?.kind === "movie" && movieJobReady(existing)) return existing;

  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) return existing?.kind === "movie" ? existing : null;

  const filePath = resolvePersistedMovieFile(
    userKey,
    jobId,
    MUSIC_PLAYLIST_DOWNLOADS_DIR
  );
  if (!filePath) return existing?.kind === "movie" ? existing : null;

  const restored = {
    id: jobId,
    kind: "movie",
    purpose: "download",
    persistent: true,
    status: "done",
    progress: 100,
    file: filePath,
    name: path.basename(filePath),
    clients: existing?.clients || new Set(),
  };
  ensurePlayToken(restored);
  jobs.set(jobId, restored);
  return restored;
}

function serveVideoFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const mime = "video/mp4";
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
      "Cache-Control": "private, max-age=3600",
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.set({
    "Content-Length": String(stat.size),
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
}

function normalizeMusicTitleKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolvePersistedMusicFile(userKey, jobId) {
  const track = findTrackByDownloadJob(userKey, jobId);
  if (!track) return null;

  const folder = getMusicFolderByKey(userKey, track.folderId);
  const candidates = [];
  const pushCandidate = (filePath) => {
    if (filePath && !candidates.includes(filePath)) candidates.push(filePath);
  };

  const expectedName = buildAppleMusicFilename({
    title: track.title,
    uploader: track.artist || "",
    artistName: track.artist || "",
  });

  if (folder?.name) {
    const dir = playlistDownloadDir(MUSIC_PLAYLIST_DOWNLOADS_DIR, folder.name);
    pushCandidate(path.join(dir, expectedName));
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (/\.mp3$/i.test(name)) pushCandidate(path.join(dir, name));
      }
    }
  }

  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  pushCandidate(path.join(jobDir, expectedName));
  if (fs.existsSync(jobDir)) {
    for (const name of fs.readdirSync(jobDir)) {
      if (/\.mp3$/i.test(name)) pushCandidate(path.join(jobDir, name));
    }
  }

  const titleKey = normalizeMusicTitleKey(track.title);
  const artistKey = normalizeMusicTitleKey(track.artist);
  let bestPath = null;
  let bestScore = 0;

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const baseKey = normalizeMusicTitleKey(path.basename(filePath, path.extname(filePath)));
    let score = 0;
    if (titleKey && baseKey.includes(titleKey)) score += 4;
    if (artistKey && baseKey.includes(artistKey)) score += 2;
    if (baseKey.includes(titleKey.split(" ").slice(0, 3).join(" "))) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestPath = filePath;
    }
  }

  if (bestPath) return bestPath;
  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function getOrRestoreMusicJob(jobId, req) {
  const existing = jobs.get(jobId);
  if (existing?.kind === "music" && musicJobReady(existing)) return existing;

  const userKey = favoritesUserKeyFromReq(req);
  if (!userKey) return existing?.kind === "music" ? existing : null;

  const filePath = resolvePersistedMusicFile(userKey, jobId);
  if (!filePath) return existing?.kind === "music" ? existing : null;

  const restored = {
    id: jobId,
    kind: "music",
    purpose: "download",
    persistent: true,
    status: "done",
    progress: 100,
    file: filePath,
    name: path.basename(filePath),
    clients: existing?.clients || new Set(),
  };
  ensurePlayToken(restored);
  jobs.set(jobId, restored);
  return restored;
}

function friendlyAppleMusicError(err) {
  const msg = String(err?.message || err || "");
  if (/Nie znaleziono utworu/i.test(msg)) return msg;
  if (/APLMate HTTP/i.test(msg)) return "Serwer pobierania muzyki jest chwilowo niedostępny — spróbuj za chwilę.";
  if (/linku MP3|formularza utworu/i.test(msg)) return msg;
  if (/HTTP 403|HTTP 502|HTTP 503/i.test(msg)) return "Nie udało się pobrać pliku MP3 — spróbuj ponownie.";
  return msg || "Nie udało się pobrać utworu z Apple Music.";
}

function startMirrorDownloadJob({
  jobId,
  streamUrl,
  streamReferer,
  name,
  userKey = null,
  movieUrl = null,
  movieTitle = "",
  movieThumbnail = "",
  movieSource = "",
}) {
  const isMovie = !!(userKey && movieUrl);
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const destInfo = isMovie
    ? moviesFileDestPath(MUSIC_PLAYLIST_DOWNLOADS_DIR, {
        title: movieTitle || name,
        jobId,
      })
    : null;
  const safeName = destInfo?.relativeName || buildMovieFilename({
    title: movieTitle || name,
    jobId,
  });
  const filePath = isMovie
    ? destInfo.filePath
    : path.join(jobDir, path.basename(safeName));

  const job = {
    id: jobId,
    purpose: "download",
    kind: isMovie ? "movie" : undefined,
    persistent: isMovie,
    userKey: userKey || null,
    movieUrl: movieUrl || null,
    movieTitle: movieTitle || name || "",
    movieThumbnail: movieThumbnail || "",
    movieSource: movieSource || "",
    status: "starting",
    progress: 0,
    clients: new Set(),
    file: filePath,
    name: path.basename(destInfo?.filePath || safeName),
    relativeMovieName: destInfo?.relativeName || null,
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


async function refreshMirrorStreamOnJob(job) {
  if (!job?.mirrorPageUrl) return false;
  try {
    const mirror = await getMirrorStream(job.mirrorPageUrl, { force: true });
    if (!mirror?.stream?.url) return false;
    job.streamUrl = mirror.stream.url;
    job.streamReferer = mirror.stream.referer || job.streamReferer;
    job.streamType = mirror.stream.type === "hls" ? "hls" : detectStreamType(mirror.stream.url);
    job.streamSizeBytes = 0;
    job.streamContentType = job.streamType === "hls" ? "application/vnd.apple.mpegurl" : "video/mp4";
    setCachedMirrorStream(job.mirrorPageUrl, mirror);
    console.warn("stream proxy: odświeżono URL mirror dla", job.id, job.streamType);
    return true;
  } catch (err) {
    console.warn("stream proxy refresh:", err?.message || err);
    return false;
  }
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
  // Dood/playmogo CDN często dusi długi fetch() — curl jest stabilniejszy.
  if (isDoodLikeUrl(job.streamUrl)) {
    return proxyMp4WithCurl(req, res, job);
  }

  const headers = { "User-Agent": UA, Referer: job.streamReferer || "" };
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    const upstream = await fetch(job.streamUrl, {
      headers,
      redirect: "follow",
      // Długi progressive MP4 — bez krótkiego idle timeout na całe body.
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
    if ([403, 404, 410, 416, 502, 503].includes(upstream.status) && (await refreshMirrorStreamOnJob(job))) {
      return proxyMp4WithCurl(req, res, job);
    }
  } catch (err) {
    console.warn("stream fetch fallback curl:", err?.message || err);
    if (await refreshMirrorStreamOnJob(job)) {
      return proxyMp4WithCurl(req, res, job);
    }
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
const MUSIC_PLAYLIST_DOWNLOADS_DIR =
  process.env.MUSIC_PLAYLIST_DOWNLOADS_DIR || path.dirname(DOWNLOAD_DIR);
const MOVIES_DOWNLOADS_DIR = moviesDownloadDir(MUSIC_PLAYLIST_DOWNLOADS_DIR);

fs.mkdirSync(BIN_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(MUSIC_PLAYLIST_DOWNLOADS_DIR, { recursive: true });
fs.mkdirSync(MOVIES_DOWNLOADS_DIR, { recursive: true });

function resolveMusicPlaylistFilePath({ userKey, folderId, jobId, filename }) {
  if (userKey && folderId) {
    const folder = getMusicFolderByKey(userKey, folderId);
    if (folder?.name) {
      const dir = playlistDownloadDir(MUSIC_PLAYLIST_DOWNLOADS_DIR, folder.name);
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, filename);
    }
  }
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  return path.join(jobDir, filename);
}

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
let cdaHdCatalogCache = { at: 0, entries: {} };
const CDA_HD_LATEST_TTL_MS = 15 * 60 * 1000;

function withTimeout(promise, ms, label = "operacja") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} przekroczyła ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const SEARCH_SOURCE_TIMEOUT_MS = {
  youtube: 12000,
  cda: 14000,
  "cda-hd": 18000,
  tvp: 12000,
  "apple-music": 14000,
};
const SEARCH_DEFAULT_TIMEOUT_MS = 14000;

async function searchCdaHdWithCacheFallback(query, limit) {
  const fallback = () => {
    const disk = loadCdaHdDiskCatalog(7 * 24 * 60 * 60 * 1000);
    const pool = cdaHdLatestCache.items.length
      ? cdaHdLatestCache.items
      : disk?.latest || [];
    return rankSearchByQuery(pool, query).slice(0, limit);
  };
  try {
    // Keep live scrape short — Cloudflare often stalls; cache must win quickly.
    return await withTimeout(searchCdaHd(query, limit, 4), 8000, "cda-hd-live");
  } catch (err) {
    const filtered = fallback();
    if (filtered.length) {
      console.warn("cda-hd search fallback cache:", err?.message || err);
      return filtered;
    }
    // Last resort: return unfiltered cache head so Filmy tab is never empty.
    const disk = loadCdaHdDiskCatalog(7 * 24 * 60 * 60 * 1000);
    const pool = cdaHdLatestCache.items.length
      ? cdaHdLatestCache.items
      : disk?.latest || [];
    if (pool.length) return pool.slice(0, limit);
    throw err;
  }
}

const SEARCH_HANDLERS = {
  youtube: (q, limit, browser) => searchYouTube(q, Math.min(limit, SOURCE_FETCH_LIMITS.youtube), browser),
  cda: (q, limit) => searchCda(q, limit),
  "cda-hd": (q, limit) => searchCdaHdWithCacheFallback(q, limit),
  tvp: (q, limit) => searchTvp(q, limit),
  "apple-music": (q, limit) => searchAppleMusic(q, Math.min(limit, SOURCE_FETCH_LIMITS["apple-music"])),
};


let cdaHdWarmRunning = false;
let cdaHdWarmTimer = null;

async function warmCdaHdCaches() {
  if (cdaHdWarmRunning) return;
  cdaHdWarmRunning = true;
  try {
    const items = mapSearchThumbnails(await fetchCdaHdLatest(60));
    if (!items.length) return;
    const now = Date.now();
    cdaHdLatestCache = { at: now, items };
    const pageSize = 20;
    const page1 = {
      mode: "latest",
      page: 1,
      pageSize,
      totalItems: items.length,
      hasMore: items.length > pageSize,
      items: items.slice(0, pageSize),
      cached: false,
    };
    cdaHdCatalogCache.at = now;
    cdaHdCatalogCache.entries = cdaHdCatalogCache.entries || {};
    cdaHdCatalogCache.entries[`latest|1|${pageSize}`] = page1;
    const series = items.filter((i) => i.isSerial || isCdaHdTvShowUrl(i.url));
    console.warn(`cda-hd warm: ${items.length} pozycji (seriali: ${series.length})`);
    // Podgrzej listy odcinków — FlareSolverr ~30–90 s, ale potem /api/info jest natychmiastowe.
    // Mało równoległych Flare — jeden solve naraz, kolejka 3 tytułów.
    setTimeout(() => {
      warmCdaHdTvShows(
        series.map((i) => i.url),
        { limit: 1 }
      );
    }, 60_000);
  } catch (err) {
    console.warn("cda-hd warm:", err?.message || err);
  } finally {
    cdaHdWarmRunning = false;
  }
}

function scheduleCdaHdWarm() {
  if (cdaHdWarmRunning) return;
  setTimeout(() => {
    warmCdaHdCaches().catch(() => {});
  }, 50);
}

function startCdaHdBackgroundJobs() {
  startCdaHdSessionKeeper(process.env.CDA_HD_BASE || "https://cda-hd.cc/");
  scheduleCdaHdWarm();
  if (cdaHdWarmTimer) clearInterval(cdaHdWarmTimer);
  cdaHdWarmTimer = setInterval(() => {
    warmCdaHdCaches().catch(() => {});
  }, 12 * 60 * 1000);
  if (typeof cdaHdWarmTimer.unref === "function") cdaHdWarmTimer.unref();
}

// GET /api/cda-hd/health — diagnostyka sesji Cloudflare / FlareSolverr
app.get("/api/cda-hd/health", async (_req, res) => {
  const disk = loadCdaHdDiskCatalog();
  res.json({
    ok: true,
    session: getCdaHdSessionInfo(),
    memoryCache: {
      latestCount: cdaHdLatestCache.items.length,
      ageMs: cdaHdLatestCache.at ? Date.now() - cdaHdLatestCache.at : null,
    },
    diskCache: disk
      ? { count: disk.latest?.length || 0, ageMs: disk.ageMs, stale: disk.stale }
      : null,
  });
});

// GET /api/cda-hd/latest?limit=20 — public feed for Top Shelf (cached)
app.get("/api/cda-hd/latest", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 60);
  const now = Date.now();
  const fresh =
    now - cdaHdLatestCache.at < CDA_HD_LATEST_TTL_MS && cdaHdLatestCache.items.length >= Math.min(limit, 8);

  if (fresh) {
    return res.json({ items: cdaHdLatestCache.items.slice(0, limit), cached: true });
  }

  // Cache-first: nie blokuj Apple TV na FlareSolverr — oddaj stale i odśwież w tle.
  if (cdaHdLatestCache.items.length) {
    res.json({
      items: cdaHdLatestCache.items.slice(0, limit),
      cached: true,
      stale: true,
    });
    scheduleCdaHdWarm();
    return;
  }

  const disk = loadCdaHdDiskCatalog();
  if (disk?.latest?.length) {
    const items = mapSearchThumbnails(disk.latest);
    cdaHdLatestCache = { at: disk.updatedAt || now, items };
    res.json({
      items: items.slice(0, limit),
      cached: true,
      stale: true,
      disk: true,
    });
    scheduleCdaHdWarm();
    return;
  }

  try {
    const items = mapSearchThumbnails(await fetchCdaHdLatest(60));
    if (!items.length) throw new Error("Pusta lista CDA-HD.");
    cdaHdLatestCache = { at: now, items };
    res.json({ items: items.slice(0, limit), cached: false });
  } catch (err) {
    console.error("cda-hd latest:", err?.message || err);
    res.status(502).json({
      error: err?.message || "Nie udało się pobrać najnowszych z CDA-HD.",
      session: getCdaHdSessionInfo(),
    });
  }
});


// Shared film catalog: sort + type filter for Apple TV
const FILMS_CATALOG_MODES = new Set(["all", "latest", "top-rated", "most-played", "longest"]);
const FILMS_CATALOG_TYPES = new Set(["all", "film", "serial"]);

function normalizeFilmsCatalogMode(raw) {
  const m = String(raw || "latest").toLowerCase();
  if (m === "top" || m === "toprated") return "top-rated";
  if (m === "popular" || m === "mostplayed" || m === "views") return "most-played";
  if (m === "duration" || m === "long") return "longest";
  return FILMS_CATALOG_MODES.has(m) ? m : "latest";
}

function normalizeFilmsCatalogType(raw) {
  const t = String(raw || "all").toLowerCase();
  if (t === "movie" || t === "movies" || t === "film" || t === "filmy") return "film";
  if (t === "series" || t === "serial" || t === "seriale" || t === "tv") return "serial";
  return "all";
}

function isSerialCatalogItem(item) {
  if (!item) return false;
  if (item.isSerial === true) return true;
  const url = String(item.url || "");
  const detail = String(item.detail || "");
  return /\/tvshows?\//i.test(url) || /serial/i.test(detail);
}

function filterCatalogByType(list, type) {
  const items = Array.isArray(list) ? list : [];
  if (type === "film") return items.filter((i) => !isSerialCatalogItem(i));
  if (type === "serial") return items.filter((i) => isSerialCatalogItem(i));
  return items;
}

function paginateCatalogList(list, page, pageSize, meta = {}) {
  const all = Array.isArray(list) ? list : [];
  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalItems: all.length,
    hasMore: all.length > start + pageSize,
    items: mapSearchThumbnails(all.slice(start, start + pageSize)),
    ...meta,
  };
}

function sortFilmsCatalogPool(pool, mode) {
  // Reuse CDA-HD sorter for all sources (rating/views/duration).
  const orderedMode = mode === "all" ? "latest" : mode;
  return orderCdaHdCatalog(pool, orderedMode);
}

async function resolveFilmsCatalogPool(source) {
  const src = String(source || "cda-hd").toLowerCase();
  const disk = loadCdaHdDiskCatalog(14 * 24 * 60 * 60 * 1000);

  if (src === "cda-hd") {
    if (cdaHdLatestCache.items?.length) return { pool: cdaHdLatestCache.items, cached: true };
    if (disk?.latest?.length) return { pool: disk.latest, cached: true, disk: true };
    try {
      const items = await withTimeout(fetchCdaHdLatest(48), 12000, "catalog-cda-hd");
      if (items.length) cdaHdLatestCache = { at: Date.now(), items };
      return { pool: items, cached: false };
    } catch (err) {
      console.warn("catalog pool cda-hd:", err?.message || err);
      return { pool: [], error: String(err?.message || err) };
    }
  }

  // Inne serwisy: półki films/home (cache) albo szybkie wyszukiwanie seed.
  if (filmsHomeCache?.payload?.shelves?.length) {
    const shelves = filmsHomeCache.payload.shelves.filter((sh) => {
      const key = String(sh.source || "").toLowerCase();
      if (src === "all") return key !== "apple-music";
      if (src === "cda") return key === "cda";
      if (src === "tvp") return key.includes("tvp");
      if (src === "youtube") return key.includes("youtube");
      return key === src || key.includes(src);
    });
    const seen = new Set();
    const pool = [];
    for (const sh of shelves) {
      for (const item of sh.items || []) {
        const id = item.url || item.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        pool.push(item);
      }
    }
    if (pool.length) return { pool, cached: true, fromHome: true };
  }

  const seeds = {
    cda: "film",
    tvp: "serial",
    youtube: "pełny film",
    all: "film",
  };
  const query = seeds[src] || "film";
  const handlerKey = src === "all" ? null : src;
  try {
    if (handlerKey && SEARCH_HANDLERS[handlerKey]) {
      const part = await withTimeout(
        SEARCH_HANDLERS[handlerKey](query, 36, null),
        10000,
        `catalog-${handlerKey}`
      );
      return { pool: enrichSearchResults(part, null, handlerKey), cached: false };
    }
    // all: merge quick sources
    const chunks = await Promise.all(
      ["cda-hd", "cda", "tvp", "youtube"].map(async (key) => {
        try {
          if (key === "cda-hd") {
            const { pool } = await resolveFilmsCatalogPool("cda-hd");
            return pool.slice(0, 16);
          }
          const fn = SEARCH_HANDLERS[key];
          if (!fn) return [];
          return await withTimeout(fn(query, 12, null), 8000, `catalog-${key}`);
        } catch {
          return [];
        }
      })
    );
    const seen = new Set();
    const pool = [];
    for (const chunk of chunks.flat()) {
      const id = chunk.url || chunk.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      pool.push(chunk);
    }
    return { pool, cached: false };
  } catch (err) {
    console.warn("catalog pool", src, err?.message || err);
    return { pool: [], error: String(err?.message || err) };
  }
}

// GET /api/cda-hd/catalog?mode=&type=&page=&pageSize=
app.get("/api/cda-hd/catalog", async (req, res) => {
  const mode = normalizeFilmsCatalogMode(req.query.mode);
  const type = normalizeFilmsCatalogType(req.query.type);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 24);
  const now = Date.now();
  const cacheKey = `cda-hd|${mode}|${type}|${page}|${pageSize}`;
  const cacheHit = cdaHdCatalogCache.entries?.[cacheKey];

  if (now - cdaHdCatalogCache.at < CDA_HD_LATEST_TTL_MS && cacheHit?.items?.length) {
    return res.json({ ...cacheHit, cached: true });
  }
  if (cacheHit?.items?.length) {
    res.json({ ...cacheHit, cached: true, stale: true });
    scheduleCdaHdWarm();
    return;
  }

  try {
    const { pool, cached, disk } = await resolveFilmsCatalogPool("cda-hd");
    const filtered = filterCatalogByType(pool, type);
    const ordered = sortFilmsCatalogPool(filtered, mode);
    const payload = {
      mode,
      type,
      source: "cda-hd",
      ...paginateCatalogList(ordered, page, pageSize, {
        cached: !!cached,
        stale: !!cached,
        disk: !!disk,
      }),
    };
    cdaHdCatalogCache.at = now;
    cdaHdCatalogCache.entries = cdaHdCatalogCache.entries || {};
    cdaHdCatalogCache.entries[cacheKey] = payload;
    res.json(payload);
    if (!cached) scheduleCdaHdWarm();
  } catch (err) {
    console.error("cda-hd catalog:", err?.message || err);
    res.status(502).json({
      error: err?.message || "Nie udało się pobrać katalogu CDA-HD.",
      session: getCdaHdSessionInfo(),
    });
  }
});

// GET /api/films/catalog?source=cda-hd|cda|tvp|youtube|all&mode=&type=&page=&pageSize=
app.get("/api/films/catalog", async (req, res) => {
  const source = String(req.query.source || "cda-hd").toLowerCase();
  const mode = normalizeFilmsCatalogMode(req.query.mode);
  const type = normalizeFilmsCatalogType(req.query.type);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 24);

  try {
    const { pool, cached, disk, fromHome, error } = await resolveFilmsCatalogPool(source);
    if (!pool.length && error) {
      return res.status(502).json({ error });
    }
    const filtered = filterCatalogByType(pool, type);
    const ordered = sortFilmsCatalogPool(filtered, mode);
    res.json({
      ok: true,
      source,
      mode,
      type,
      ...paginateCatalogList(ordered, page, pageSize, {
        cached: !!cached,
        stale: !!cached,
        disk: !!disk,
        fromHome: !!fromHome,
      }),
    });
  } catch (err) {
    console.error("films/catalog:", err?.message || err);
    res.status(502).json({ error: friendlyError(err) });
  }
});

app.get("/api/cda-hd/browse", async (req, res) => {
  const pageUrl = String(req.query.url || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 48);
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!pageUrl || !isCdaHdBrowseUrl(pageUrl)) {
    return res.status(400).json({ error: "Podaj prawidłowy link CDA-HD (reżyser, aktor, gatunek, rok)." });
  }
  try {
    const data = await fetchCdaHdBrowse(pageUrl, limit, page);
    res.json({ ok: true, ...data, items: mapSearchThumbnails(data.items) });
  } catch (err) {
    res.status(502).json({ error: err.message || "Nie udało się wczytać listy." });
  }
});

// POST /api/search  { query, source, limit?, page?, pageSize?, sort?, access? }

// In-memory cache for Apple TV Filmy home shelves
let filmsHomeCache = { at: 0, payload: null };
const FILMS_HOME_TTL_MS = 5 * 60 * 1000;

// GET /api/films/home — półki per serwis dla zakładki Filmy (Apple TV)
app.get("/api/films/home", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 16, 8), 24);
  const now = Date.now();
  if (
    filmsHomeCache.payload?.shelves?.length &&
    now - filmsHomeCache.at < FILMS_HOME_TTL_MS
  ) {
    return res.json({ ...filmsHomeCache.payload, cached: true });
  }

  const shelf = (id, source, title, subtitle, items, meta = {}) => ({
    id,
    source,
    title,
    subtitle,
    items: mapSearchThumbnails(items || []).slice(0, limit),
    ...meta,
  });

  const safeSearch = async (source, query, ms = 8000) => {
    const handler = SEARCH_HANDLERS[source];
    if (!handler) return [];
    try {
      return await withTimeout(
        (async () => {
          const part = await handler(query, Math.min(limit, 16), null);
          return enrichSearchResults(part, null, source);
        })(),
        ms,
        `films-home/${source}`
      );
    } catch (err) {
      console.warn(`films/home ${source}:`, err?.message || err);
      return [];
    }
  };

  const cdaHdFromCacheOrDisk = () => {
    if (cdaHdLatestCache.items?.length) {
      return { items: cdaHdLatestCache.items, cached: true };
    }
    const disk = loadCdaHdDiskCatalog();
    if (disk?.latest?.length) {
      const items = mapSearchThumbnails(disk.latest);
      cdaHdLatestCache = { at: disk.updatedAt || Date.now(), items };
      return { items, cached: true, disk: true };
    }
    return { items: [] };
  };

  const safeCdaHdLatest = async () => {
    const hit = cdaHdFromCacheOrDisk();
    if (hit.items.length) return hit;
    try {
      const items = await withTimeout(
        (async () => mapSearchThumbnails(await fetchCdaHdLatest(Math.max(limit, 20))))(),
        10000,
        "films-home/cda-hd-latest"
      );
      if (items.length) cdaHdLatestCache = { at: Date.now(), items };
      return { items, cached: false };
    } catch (err) {
      console.warn("films/home cda-hd latest:", err?.message || err);
      return { items: [], error: String(err?.message || err) };
    }
  };

  const safeCdaHdTop = async () => {
    try {
      const disk = loadCdaHdDiskCatalog();
      const diskTop = disk?.topRated || disk?.["top-rated"] || [];
      if (diskTop.length) {
        return { items: mapSearchThumbnails(diskTop), cached: true, disk: true };
      }
      const data = await withTimeout(
        fetchCdaHdCatalog({ mode: "top-rated", page: 1, pageSize: limit }),
        10000,
        "films-home/cda-hd-top"
      );
      return { items: mapSearchThumbnails(data.items || []), cached: false };
    } catch (err) {
      console.warn("films/home cda-hd top:", err?.message || err);
      return { items: [], error: String(err?.message || err) };
    }
  };

  try {
    // Najpierw szybki CDA-HD z cache — potem pozostałe źródła z krótkim timeoutem.
    const cdaHdLatest = await safeCdaHdLatest();
    const [cdaHdTop, cdaItems, tvpItems, ytItems] = await Promise.all([
      safeCdaHdTop(),
      safeSearch("cda", "film", 8000),
      safeSearch("tvp", "serial", 8000),
      safeSearch("youtube", "pełny film", 8000),
    ]);

    let shelves = [
      shelf("cda-hd-latest", "cda-hd", "CDA-HD", "Najnowsze filmy i seriale", cdaHdLatest.items, {
        catalogMode: "latest",
        cached: !!cdaHdLatest.cached,
      }),
      shelf("cda-hd-top", "cda-hd", "CDA-HD", "Najlepiej oceniane", cdaHdTop.items, {
        catalogMode: "top-rated",
        cached: !!cdaHdTop.cached,
      }),
      shelf("cda-featured", "cda", "CDA", "Wyróżnione", cdaItems),
      shelf("tvp-featured", "tvp", "TVP VOD", "Polecane", tvpItems),
      shelf("youtube-featured", "youtube", "YouTube", "Filmy", ytItems),
    ].filter((row) => Array.isArray(row.items) && row.items.length > 0);

    // Awaryjnie: przynajmniej jedna półka CDA-HD z /latest cache.
    if (!shelves.length) {
      const fallback = cdaHdFromCacheOrDisk();
      if (fallback.items.length) {
        shelves = [
          shelf("cda-hd-latest", "cda-hd", "CDA-HD", "Najnowsze filmy i seriale", fallback.items, {
            catalogMode: "latest",
            cached: true,
            fallback: true,
          }),
        ];
      }
    }

    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      shelves,
    };
    if (shelves.length) {
      filmsHomeCache = { at: now, payload };
    }
    res.json(payload);
  } catch (err) {
    console.error("films/home:", err?.message || err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

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
      // Filmy/seriale only — Apple Music lives in the Muzyka tab.
      // Prefer fast VOD sources first; per-source timeout so one slow CDN cannot hang the TV app.
      const videoHandlers = Object.entries(SEARCH_HANDLERS)
        .filter(([src]) => src !== "apple-music")
        .sort(([a], [b]) => {
          const order = ["cda-hd", "cda", "tvp", "youtube"];
          return (order.indexOf(a) + 99) - (order.indexOf(b) + 99);
        });
      const chunks = await Promise.all(
        videoHandlers.map(async ([src, fn]) => {
          const ms = SEARCH_SOURCE_TIMEOUT_MS[src] || SEARCH_DEFAULT_TIMEOUT_MS;
          try {
            const srcLimit = Math.min(fetchLimit, SOURCE_FETCH_LIMITS[src] || fetchLimit);
            return await withTimeout(
              (async () => {
                const part = await fn(query, srcLimit, browser);
                return enrichSearchResults(part, browser, src);
              })(),
              ms,
              `search/${src}`
            );
          } catch (err) {
            console.warn(`search all/${src}:`, err?.message || err);
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
      const ms = SEARCH_SOURCE_TIMEOUT_MS[source] || SEARCH_DEFAULT_TIMEOUT_MS;
      try {
        results = await withTimeout(
          (async () => {
            const part = await handler(query, fetchLimit, browser);
            return enrichSearchResults(part, browser, source);
          })(),
          ms,
          `search/${source}`
        );
      } catch (err) {
        console.warn(`search ${source}:`, err?.message || err);
        results = [];
      }
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

app.post("/api/auth/apple", async (req, res) => {
  try {
    const { identityToken, login, password, linkOnly } = req.body || {};
    const result = await loginOrLinkAppleAccount({
      identityToken,
      login,
      password,
      linkOnly: Boolean(linkOnly),
    });
    appleAuthSuccessResponse(res, result);
  } catch (err) {
    const status = err.code === "APPLE_NOT_LINKED" ? 409 : 401;
    res.status(status).json({ error: err.message || "Logowanie Apple nie powiodło się." });
  }
});

app.delete("/api/auth/apple/link", (req, res) => {
  try {
    const { appleUserId } = req.body || {};
    if (!appleUserId) return res.status(400).json({ error: "Brak identyfikatora Apple." });
    unlinkAppleAccount(appleUserId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Nie udało się odłączyć konta Apple." });
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

// GET /api/movies/downloads — pobrane filmy użytkownika (folder MOVIES)
app.get("/api/movies/downloads", (req, res) => {
  try {
    reconcileSessionStorage(req, mergeMoviesLibraryStoreKey);
    res.json({
      folder: MOVIES_FOLDER_NAME,
      downloads: listMovieDownloads(req, MUSIC_PLAYLIST_DOWNLOADS_DIR),
    });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się wczytać pobranych filmów." });
  }
});

// PATCH /api/movies/downloads/link { url, title, thumbnail, source, downloadJobId, filename }
app.patch("/api/movies/downloads/link", (req, res) => {
  try {
    const download = linkMovieDownload(req, req.body || {});
    res.json({ ok: true, download });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się zapisać pobrania." });
  }
});

// DELETE /api/movies/downloads?url= — usuń pobrany film z biblioteki i dysku
app.delete("/api/movies/downloads", (req, res) => {
  try {
    const url = String(req.query.url || req.body?.url || "").trim();
    const result = deleteMovieDownload(req, url, MUSIC_PLAYLIST_DOWNLOADS_DIR);
    res.json(result);
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się usunąć pobrania." });
  }
});

// GET /api/movies/play-token/:jobId — token do streamu pobranego filmu
app.get("/api/movies/play-token/:jobId", (req, res) => {
  const job = getOrRestoreMovieJob(req.params.jobId, req);
  if (!movieJobReady(job)) {
    return res.status(404).json({ error: "Film niedostępny." });
  }
  const token = ensurePlayToken(job);
  res.json({
    jobId: job.id,
    token,
    expiresIn: Math.max(0, Math.floor((job.playTokenExpires - Date.now()) / 1000)),
  });
});

// GET /api/movies/stream/:jobId — stream pobranego MP4 (Range)
app.get("/api/movies/stream/:jobId", (req, res) => {
  const job = getOrRestoreMovieJob(req.params.jobId, req);
  if (!movieJobReady(job)) {
    return res.status(404).send("Film niedostępny.");
  }
  if (!canAccessPlay(req, job)) {
    return res.status(403).send("Brak dostępu.");
  }
  return serveVideoFile(req, res, job.file);
});

app.head("/api/movies/stream/:jobId", (req, res) => {
  const job = getOrRestoreMovieJob(req.params.jobId, req);
  if (!movieJobReady(job)) {
    return res.status(404).end();
  }
  if (!canAccessPlay(req, job)) {
    return res.status(403).end();
  }
  const stat = fs.statSync(job.file);
  res.set({
    "Content-Length": String(stat.size),
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  });
  return res.status(200).end();
});

// GET /api/music/library — foldery + utwory użytkownika
app.get("/api/music/library", (req, res) => {
  try {
    res.json(listMusicLibrary(req, MUSIC_PLAYLIST_DOWNLOADS_DIR));
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się wczytać biblioteki." });
  }
});

// GET /api/music/catalog/search?q= — wykonawcy, albumy, utwory (Apple Music / iTunes)
app.get("/api/music/catalog/search", async (req, res) => {
  const query = String(req.query.q || req.query.query || "").trim();
  if (!query) return res.status(400).json({ error: "Podaj frazę wyszukiwania." });
  try {
    const catalog = await searchAppleMusicCatalog(query);
    res.json(catalog);
  } catch (err) {
    console.error("music catalog search:", err?.message || err);
    res.status(500).json({ error: friendlyAppleMusicError(err) });
  }
});

// GET /api/music/catalog/artist/:id — albumy + top utwory wykonawcy
app.get("/api/music/catalog/artist/:id", async (req, res) => {
  try {
    const data = await fetchAppleMusicArtist(req.params.id);
    res.json(data);
  } catch (err) {
    console.error("music artist:", err?.message || err);
    res.status(404).json({ error: err.message || "Nie znaleziono wykonawcy." });
  }
});

// GET /api/music/catalog/album/:id — utwory albumu
app.get("/api/music/catalog/album/:id", async (req, res) => {
  try {
    const data = await fetchAppleMusicAlbum(req.params.id);
    res.json(data);
  } catch (err) {
    console.error("music album:", err?.message || err);
    res.status(404).json({ error: err.message || "Nie znaleziono albumu." });
  }
});

// GET /api/music/catalog/playlist?url= — podgląd playlisty Apple Music
app.get("/api/music/catalog/playlist", async (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!url) return res.status(400).json({ error: "Podaj link playlisty Apple Music." });
  try {
    const data = await fetchAppleMusicPlaylist(url);
    res.json(data);
  } catch (err) {
    console.error("music playlist preview:", err?.message || err);
    res.status(400).json({ error: friendlyAppleMusicError(err) });
  }
});

// POST /api/music/playlists/import { url, folderId?, folderName? }
app.post("/api/music/playlists/import", async (req, res) => {
  const { url, folderId, folderName } = req.body || {};
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return res.status(400).json({ error: "Podaj link playlisty Apple Music." });

  try {
    const data = await fetchAppleMusicPlaylist(rawUrl);
    let folder;

    if (folderId) {
      const userKey = favoritesUserKeyFromReq(req);
      if (!userKey) return res.status(401).json({ error: "Brak konta użytkownika." });
      folder = getMusicFolderByKey(userKey, String(folderId).trim());
      if (!folder) return res.status(404).json({ error: "Folder nie istnieje." });
    } else {
      const desiredName = String(folderName || data.playlist.title || "Playlista").trim();
      const userKey = favoritesUserKeyFromReq(req);
      if (userKey) {
        folder = findMusicFolderForImport(userKey, {
          playlistId: data.playlist?.id,
          url: rawUrl,
          name: desiredName,
        });
      }
      if (!folder) {
        folder = createMusicFolder(req, { name: desiredName });
      }
    }

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

    const result = importTracksToFolder(req, folder.id, trackPayloads);
    const userKey = favoritesUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: "Brak konta użytkownika." });
    const linkedFolder = linkFolderToApplePlaylist(userKey, folder.id, {
      url: rawUrl,
      playlistId: data.playlist?.id,
      title: data.playlist?.title,
      thumbnail: data.playlist?.thumbnail,
    });
    res.json({
      ok: true,
      playlist: data.playlist,
      folder: { ...result.folder, ...linkedFolder },
      added: result.added,
      skipped: result.skipped,
      trackCount: result.folder.trackCount,
      importedBatch: result.tracks.length,
    });
  } catch (err) {
    console.error("music playlist import:", err?.message || err);
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: friendlyAppleMusicError(err) });
  }
});

// POST /api/music/play { url } — pełny utwór MP3 (stream przez proxy, nie podgląd iTunes)
app.post("/api/music/play", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url) || !/music\.apple\.com/i.test(url)) {
    return res.status(400).json({ error: "Podaj link utworu Apple Music." });
  }
  const jobId = crypto.randomUUID();
  startAppleMusicPlayJob({ jobId, url });
  res.json({ jobId });
});

// GET /api/music/play-token/:jobId — token do streamu MP3 na Apple TV
app.get("/api/music/play-token/:jobId", (req, res) => {
  const job = getOrRestoreMusicJob(req.params.jobId, req);
  if (!musicJobReady(job)) {
    return res.status(404).json({ error: "Utwór niedostępny." });
  }
  const token = ensurePlayToken(job);
  res.json({
    jobId: job.id,
    token,
    expiresIn: Math.max(0, Math.floor((job.playTokenExpires - Date.now()) / 1000)),
  });
});

function serveAudioFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const mime = "audio/mpeg";
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
      "Cache-Control": "private, max-age=3600",
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.set({
    "Content-Length": String(stat.size),
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
}

// GET /api/music/stream/:jobId — pełny MP3: lokalny plik lub proxy APLMate (Range)
app.get("/api/music/stream/:jobId", async (req, res) => {
  const job = getOrRestoreMusicJob(req.params.jobId, req);
  if (!job || job.kind !== "music") {
    return res.status(404).send("Utwór niedostępny.");
  }
  if (!canAccessPlay(req, job)) {
    return res.status(403).send("Brak dostępu.");
  }
  if (job.file && fs.existsSync(job.file)) {
    return serveAudioFile(req, res, job.file);
  }
  if (job.mode === "stream-proxy" && job.streamUrl && job.status === "done") {
    try {
      return await proxyRemoteUrl(req, res, job, job.streamUrl);
    } catch (err) {
      console.error("music stream proxy:", err?.message || err);
      return res.status(502).send("Błąd streamu audio.");
    }
  }
  return res.status(404).send("Utwór niedostępny.");
});

app.head("/api/music/stream/:jobId", async (req, res) => {
  const job = getOrRestoreMusicJob(req.params.jobId, req);
  if (!job || job.kind !== "music") {
    return res.status(404).end();
  }
  if (!canAccessPlay(req, job)) {
    return res.status(403).end();
  }
  if (job.file && fs.existsSync(job.file)) {
    const stat = fs.statSync(job.file);
    res.set({
      "Content-Length": String(stat.size),
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
    });
    return res.end();
  }
  if (job.mode === "stream-proxy" && job.streamUrl && job.status === "done") {
    try {
      const upstream = await fetch(job.streamUrl, {
        method: "HEAD",
        headers: { "User-Agent": UA, Referer: job.streamReferer || "" },
        signal: AbortSignal.timeout(15000),
      });
      res.status(upstream.status);
      res.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
      const len = upstream.headers.get("content-length");
      if (len) res.set("Content-Length", len);
      res.set("Content-Type", "audio/mpeg");
      return res.end();
    } catch {
      return res.status(502).end();
    }
  }
  return res.status(404).end();
});

// PATCH /api/music/folders/:id/tracks/reorder { urls: string[] }
app.patch("/api/music/folders/:id/tracks/reorder", (req, res) => {
  try {
    const result = reorderFolderTracks(req, req.params.id, req.body?.urls);
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się zmienić kolejności." });
  }
});

// PATCH /api/music/folders/:id/tracks/download { url, downloadJobId }
app.patch("/api/music/folders/:id/tracks/download", (req, res) => {
  try {
    const track = updateTrackDownload(
      req,
      req.params.id,
      req.body?.url,
      req.body?.downloadJobId
    );
    res.json({ ok: true, track });
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się zapisać pobrania." });
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
    const folder = renameMusicFolder(
      req,
      req.params.id,
      req.body || {},
      MUSIC_PLAYLIST_DOWNLOADS_DIR
    );
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
    res.json(listFolderTracks(req, req.params.id, MUSIC_PLAYLIST_DOWNLOADS_DIR));
  } catch (err) {
    const code = /Brak konta/i.test(err.message || "") ? 401 : 400;
    res.status(code).json({ error: err.message || "Nie udało się wczytać utworów." });
  }
});

// POST /api/music/folders/:id/sync-playlist — odśwież powiązaną playlistę Apple Music
app.post("/api/music/folders/:id/sync-playlist", async (req, res) => {
  try {
    const folderId = String(req.params.id || "").trim();
    const bodyUrl = String(req.body?.url || "").trim();
    const userKey = favoritesUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: "Brak konta użytkownika." });

    if (bodyUrl) {
      const preview = await fetchAppleMusicPlaylist(bodyUrl);
      linkFolderToApplePlaylist(userKey, folderId, {
        url: bodyUrl,
        playlistId: preview.playlist?.id,
        title: preview.playlist?.title,
        thumbnail: preview.playlist?.thumbnail,
      });
    }

    const result = await syncAppleMusicPlaylistFolder(
      req,
      folderId,
      fetchAppleMusicPlaylist,
      MUSIC_PLAYLIST_DOWNLOADS_DIR
    );
    res.json(result);
  } catch (err) {
    console.error("music playlist sync:", err?.message || err);
    const code = /nie istnieje/i.test(err.message || "") ? 404 : 400;
    res.status(code).json({ error: friendlyAppleMusicError(err) });
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
    const seriesLike = isCdaHdTvShowUrl(url) || /\/tvshows?\//i.test(url);
    const data = await withTimeout(
      resolveMediaInfo(url, browser, req),
      seriesLike ? 210000 : 45000,
      "info"
    );
    res.json(data);
  } catch (err) {
    console.error("info error:", err?.message || err);
    const msg = String(err?.message || "");
    const timedOut = /przekroczyła|timeout|Timeout/i.test(msg);
    res.status(timedOut ? 504 : 500).json({
      error: timedOut
        ? "Serwer źródła nie odpowiedział na czas (Cloudflare). Spróbuj ponownie za chwilę."
        : friendlyError(err),
    });
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
  const { url, kind, container, height, audioBitrate, useCookies, browser, title, thumbnail, source } =
    req.body || {};
  const cookieBrowser = useCookies ? browser : null;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "Podaj poprawny link." });
  }

  const jobId = crypto.randomUUID();
  const userKey = favoritesUserKeyFromReq(req);
  const movieDownload =
    userKey && !/music\.apple\.com/i.test(url)
      ? {
          userKey,
          url,
          title: String(title || "").slice(0, 500),
          thumbnail: String(thumbnail || "").slice(0, 2000),
          source: String(source || "").slice(0, 200),
        }
      : null;

  if (movieDownload?.userKey) {
    const existing = findDownloadByUrl(movieDownload.userKey, url);
    if (existing?.downloadJobId) {
      const existingFile = resolvePersistedMovieFile(
        movieDownload.userKey,
        existing.downloadJobId,
        MUSIC_PLAYLIST_DOWNLOADS_DIR
      );
      if (existingFile) {
        try {
          assertValidMovieFile(existingFile);
          const restored = {
            id: existing.downloadJobId,
            kind: "movie",
            purpose: "download",
            persistent: true,
            status: "done",
            progress: 100,
            ready: true,
            file: existingFile,
            name: path.basename(existingFile),
            userKey: movieDownload.userKey,
            movieUrl: movieDownload.url,
            movieTitle: movieDownload.title || existing.title || "",
            movieThumbnail: movieDownload.thumbnail || existing.thumbnail || "",
            movieSource: movieDownload.source || existing.source || "",
            clients: new Set(),
          };
          ensurePlayToken(restored);
          jobs.set(existing.downloadJobId, restored);
          return res.json({
            jobId: existing.downloadJobId,
            reused: true,
            ready: true,
            status: "done",
            progress: 100,
          });
        } catch {
          try {
            fs.unlinkSync(existingFile);
          } catch {}
        }
      }
    }
    for (const active of jobs.values()) {
      if (
        active.movieUrl === url &&
        active.userKey === movieDownload.userKey &&
        !active.cancelled &&
        active.status !== "error" &&
        active.status !== "done"
      ) {
        return res.json({ jobId: active.id, reused: true });
      }
    }
  }

  if (/music\.apple\.com/i.test(url)) {
    const userKey = favoritesUserKeyFromReq(req);
    startAppleMusicDownloadJob({
      jobId,
      url,
      userKey,
      folderId: req.body?.folderId || null,
      trackUrl: req.body?.trackUrl || url,
    });
    return res.json({ jobId });
  }

  if (isMirrorHost(url)) {
    try {
      const mirror = await getMirrorStream(url);
      const streamType = mirror.stream.type || detectStreamType(mirror.stream.url);
      const isHls =
        streamType === "hls" || /\.m3u8?(\?|$)/i.test(mirror.stream.url);
      if (isHls) {
        startHlsMovieDownloadJob({
          jobId,
          streamUrl: mirror.stream.url,
          referer: mirror.stream.referer,
          title: movieDownload?.title || mirror.title,
          movieDownload,
        });
      } else {
        startMirrorDownloadJob({
          jobId,
          streamUrl: mirror.stream.url,
          streamReferer: mirror.stream.referer,
          name: mirror.title,
          userKey: movieDownload?.userKey,
          movieUrl: movieDownload?.url,
          movieTitle: movieDownload?.title,
          movieThumbnail: movieDownload?.thumbnail,
          movieSource: movieDownload?.source,
        });
      }
      return res.json({ jobId });
    } catch (err) {
      return res.status(500).json({ error: friendlyError(err) });
    }
  }

  if (/vod\.tvp\.pl/i.test(url) && movieDownload && kind !== "audio") {
    const h =
      height === "best" || height === 0 || !height
        ? 1080
        : Number(height) || 720;
    try {
      const dual = await resolveTvpDualStream(url, h, cookieBrowser, req);
      if (!dual?.videoUrl || !dual?.audioUrl) {
        throw new Error("Nie udało się ustalić strumienia TVP w wybranej jakości.");
      }
      startTvpMovieDownloadJob({
        jobId,
        videoUrl: dual.videoUrl,
        audioUrl: dual.audioUrl,
        referer: url,
        movieDownload,
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
  startTransferJob({ jobId, url, args, purpose: "download", movieDownload });
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
  const previewHeight = height && height !== "best" ? Number(height) || 720 : 720;

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
        mirrorPageUrl: previewUrl,
        req,
      });
      return res.json({
        jobId,
        purpose: "preview",
        instant: true,
        mode: mirror.stream.type === "hls" ? "hls" : "stream",
      });
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
  let job = jobs.get(req.params.jobId);
  if (!job || (job.kind === "movie" && !movieJobReady(job))) {
    const restored = getOrRestoreMovieJob(req.params.jobId, req);
    if (restored) job = restored;
  }
  if (!job || (job.kind === "music" && !musicJobReady(job))) {
    const restoredMusic = getOrRestoreMusicJob(req.params.jobId, req);
    if (restoredMusic) job = restoredMusic;
  }
  if (!job) return res.status(404).json({ error: "Zadanie nie istnieje." });
  const ready =
    musicJobReady(job) ||
    movieJobReady(job) ||
    !!(job.file && fs.existsSync(job.file)) ||
    (job.mode === "stream-proxy" && job.status === "done" && !!job.streamUrl) ||
    job.status === "done";
  // CDA: partial preview jest „ready”, ale NIE fullReady — inaczej TV nigdy nie przełączy na pełny film.
  const cdaPending = !!job.cdaFullPending;
  const fullReady = cdaPending ? !!job.fullReady : (!!job.fullReady || ready);
  res.json({
    jobId: job.id,
    status: job.status || (ready ? "done" : "starting"),
    progress: cdaPending ? (job.progress ?? 35) : (ready ? 100 : (job.progress ?? 0)),
    name: job.name || "",
    error: job.error || null,
    purpose: job.purpose || "download",
    ready,
    fullReady,
    cdaFullPending: cdaPending,
    downloadPath: ready ? `/api/file/${job.id}` : null,
    reused: !!job.persistent && ready,
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
      if (job.persistent && job.kind === "movie") {
        try {
          fs.unlinkSync(job.file);
        } catch {}
      } else {
        fs.rmSync(path.dirname(job.file), { recursive: true, force: true });
      }
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
    if (!job.persistent) cleanupJob(req.params.jobId);
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
        if (job?.clients?.size || job?.persistent) continue;
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
      startCdaHdBackgroundJobs();
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
