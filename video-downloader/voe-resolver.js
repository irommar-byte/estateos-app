/** Resolve VOE / ogladaj.me / DoodStream embed pages to a direct MP4 or HLS URL. */

import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fetchCdaHdHtmlResilient, isCloudflareChallenge } from "./cda-hd-fetch.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DOOD_HOSTS =
  /(?:^|\.)playmogo\.com$|(?:^|\.)do\d+go\.com$|(?:^|\.)dood(?:stream|video|\.(?:com|watch|re|so|li|wf|casa|live|biz|ws))?$|(?:^|\.)ds2play\.com$|(?:^|\.)d0000d\.com$/i;

const VOE_EMBED_HOSTS =
  /(?:^|\.)ogladaj\.me$|(?:^|\.)voe\.sx$|(?:^|\.)vtbe\.to$|(?:^|\.)voe-unblock\.com$|(?:^|\.)[^.]+\.(?:sbs|cfd|digital|watch)$/i;

function rot13(text) {
  return text.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function replacePatterns(txt) {
  for (const pat of ["@$", "^^", "~@", "%?", "*~", "!!", "#&"]) {
    txt = txt.split(pat).join("");
  }
  return txt;
}

function shiftChars(text, shift) {
  return text
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - shift))
    .join("");
}

function safeB64Decode(s) {
  const pad = s.length % 4;
  const padded = pad ? s + "=".repeat(4 - pad) : s;
  return Buffer.from(padded, "base64").toString("utf8");
}

export function deobfuscateEmbeddedJson(rawJson) {
  try {
    const arr = JSON.parse(rawJson);
    if (!Array.isArray(arr) || !arr[0] || typeof arr[0] !== "string") return null;
    const step1 = rot13(arr[0]);
    const step2 = replacePatterns(step1);
    const step3 = safeB64Decode(step2);
    const step4 = shiftChars(step3, 3);
    const step5 = step4.split("").reverse().join("");
    const step6 = safeB64Decode(step5);
    try {
      return JSON.parse(step6);
    } catch {
      return step6;
    }
  } catch {
    return null;
  }
}

function pickStreamFromResult(result) {
  if (!result) return null;
  if (typeof result === "object") {
    if (result.source) return { url: result.source, type: "hls" };
    if (Array.isArray(result.fallback)) {
      const mp4 = result.fallback.find((f) => f?.type === "mp4" && f?.file);
      if (mp4) return { url: mp4.file, type: "mp4" };
    }
    if (result.direct_access_url) return { url: result.direct_access_url, type: "mp4" };
    if (result.mp4) return { url: result.mp4, type: "mp4" };
    if (result.hls) return { url: result.hls, type: "hls" };
  }
  if (typeof result === "string") {
    const mp4 = result.match(/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/i);
    if (mp4) return { url: mp4[1], type: "mp4" };
    const hls = result.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
    if (hls) return { url: hls[1], type: "hls" };
  }
  return null;
}

function normalizeUrl(url, base) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return new URL(url, base).href;
  return new URL("/" + url, base).href;
}

const REDIRECT_PATTERNS = [
  "window.location.href = '",
  "window.location = '",
  "location.href = '",
  "window.location.replace('",
  'window.location.href="',
];

function findRedirect(html) {
  for (const pattern of REDIRECT_PATTERNS) {
    const i0 = html.indexOf(pattern);
    if (i0 === -1) continue;
    const quote = pattern.endsWith("'") ? "'" : '"';
    const i1 = html.indexOf(quote, i0 + pattern.length);
    if (i1 > i0) return html.slice(i0 + pattern.length, i1);
  }
  return null;
}

function isDoodHost(url) {
  try {
    return DOOD_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isVoeEmbedHost(url) {
  try {
    return VOE_EMBED_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const CDA_HD_PLAYER_HOSTS =
  /(?:^|\.)player\.cda-h(?:d)?\.(?:co|cc)|(?:^|\.)player\.cvary\.org|(?:^|\.)divxplayer\.ml|(?:^|\.)metaverseid\.tk|(?:^|\.)akpdm\.top$/i;

export function isCdaHdPlayerHost(url) {
  try {
    return CDA_HD_PLAYER_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function cdaHdPlayerPageUrl(embedUrl) {
  try {
    const u = new URL(embedUrl);
    const vid = u.searchParams.get("vid");
    if (vid) return `${u.origin}/e/${vid}`;
    const m = u.pathname.match(/\/(?:e|f)\/([^/?#]+)/i);
    if (m?.[1] && m[1] !== "yyy") return `${u.origin}/e/${m[1]}`;
  } catch {
    /* ignore */
  }
  return embedUrl;
}

function stripHtmlComments(html) {
  return (html || "").replace(/<!--[\s\S]*?-->/g, "");
}

/** Port of player.cda-hd.co `un()` — decodes obf_link from get_md5.php. */
function cdaHdUnescapeLink(raw) {
  if (!raw) return "";
  let text = raw;
  if (!text.includes(".")) {
    text = text.slice(1);
    let decoded = "";
    for (let i = 0; i < text.length; i += 3) {
      decoded += `%u0${text.slice(i, i + 3)}`;
    }
    text = decodeURIComponent(decoded);
  }
  return text;
}

function pickCdaHdVar(html, name) {
  const patterns = [
    new RegExp(`${name}\\s*=\\s*"([^"]+)"`, "i"),
    new RegExp(`${name}\\s*=\\s*'([^']+)'`, "i"),
    new RegExp(`'${name}':\\s*'([^']+)'`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

function curlPostJson(url, body, { cookieJar, referer, origin } = {}) {
  const args = ["-sL", "-A", UA, "--max-time", "45", "-H", "Content-Type: application/json"];
  if (cookieJar) {
    args.push("-c", cookieJar, "-b", cookieJar);
  }
  if (referer) {
    args.push("-H", `Referer: ${referer}`);
  }
  if (origin) {
    args.push("-H", `Origin: ${origin}`);
  }
  args.push("-H", "X-Requested-With: XMLHttpRequest");
  args.push("-X", "POST", "-d", JSON.stringify(body), url);
  const result = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  const raw = (result.stdout || "").trim();
  if (!raw || raw === "0.00" || raw === "0.1") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickStreamFromCdaHdMd5(data, playUrl) {
  if (!data?.obf_link) return null;
  const decoded = cdaHdUnescapeLink(data.obf_link);
  if (!decoded || /127\.0\.0\.1|no_video|bipbop/i.test(decoded)) return null;
  let ext = /\.m3u8/i.test(decoded) ? "" : ".mp4.m3u8";
  if (decoded.includes(".mp4.m3u8")) ext = "";
  const streamUrl = normalizeUrl(`https:${decoded}${ext}`, playUrl);
  if (!/^https?:\/\//i.test(streamUrl)) return null;
  return {
    url: streamUrl,
    type: "hls",
    referer: playUrl,
  };
}

function probeCdaHdStreamUrl(streamUrl, referer) {
  if (!streamUrl) return false;
  const args = ["-sS", "-L", "-k", "-A", UA, "--max-time", "20"];
  if (referer) args.push("-H", `Referer: ${referer}`);
  args.push("-r", "0-2047", streamUrl);
  const result = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 4096 });
  if (result.error || result.status !== 0) return false;
  const body = (result.stdout || "").trim();
  if (/^#EXTM3U/m.test(body)) return true;
  return /\.m3u8|#EXT-X-/i.test(body);
}

/** Live stream via /player/get_md5.php (same flow as the browser player). */
function resolveCdaHdPlayerViaMd5(playUrl, html, options = {}) {
  const pageReferer = options.referer || "https://cda-hd.cc/";
  const origin = "https://player.cda-hd.co";
  const tmpDir = mkdtempSync(join(tmpdir(), "cda-hd-"));
  const cookiePath = join(tmpDir, "cookies.txt");
  try {
    curlText(playUrl, {
      cookieJar: cookiePath,
      referer: pageReferer,
    });

    const videokeyorig = pickCdaHdVar(html, "videokeyorig");
    const videoid = pickCdaHdVar(html, "videoid");
    const imageVideokey = pickCdaHdVar(html, "videokey") || videokeyorig;
    const adbn = pickCdaHdVar(html, "adbn") || pickCdaHdVar(html, "userid");
    const secure = pickCdaHdVar(html, "secure") || "0";
    if (!videokeyorig || !videoid) return null;

    let clickHash = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const imageData = curlPostJson(
        `${new URL(playUrl).origin}/player/get_player_image.php`,
        { videoid, videokey: imageVideokey, width: 1280, height: 720 },
        { cookieJar: cookiePath, referer: playUrl, origin }
      );
      if (imageData?.hash_image) {
        clickHash = imageData.hash_image;
        break;
      }
      if (imageData?.try_again === "1" || imageData?.try_again === 1) {
        if (attempt < 5) spawnSync("sleep", ["2"]);
        continue;
      }
      if (attempt < 5) spawnSync("sleep", ["1"]);
    }
    if (!clickHash) {
      clickHash = options.clickHash || pickCdaHdVar(html, "hash") || "f4e9d";
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const md5Data = curlPostJson(
        `${new URL(playUrl).origin}/player/get_md5.php`,
        {
          htoken: "",
          sh: pickCdaHdVar(html, "shh") || "",
          ver: "4",
          secure,
          adb: adbn,
          v: encodeURIComponent(videokeyorig),
          token: "",
          gt: pickCdaHdVar(html, "gtr") || "",
          embed_from: pickCdaHdVar(html, "embedfrm") || "0",
          wasmcheck: attempt,
          adscore: "1",
          click_hash: encodeURIComponent(clickHash),
          clickx: "640",
          clicky: "360",
        },
        { cookieJar: cookiePath, referer: playUrl, origin }
      );
      const stream = pickStreamFromCdaHdMd5(md5Data, playUrl);
      if (stream) return stream;
      if (md5Data?.["407"] === "1" || md5Data?.["407"] === 1) {
        const err = new Error(
          "CDA-HD: film niedostępny do odtworzenia (źródło usunięte lub wygasło, kod 407)"
        );
        err.code = "CDAHD_UNAVAILABLE";
        throw err;
      }
      if (md5Data?.try_again !== "1" && md5Data?.try_again !== 1) break;
      spawnSync("sleep", ["2"]);
    }
    return null;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function pickStaticCdaHdStream(html, playUrl) {
  const active = stripHtmlComments(html);
  const m3u8 =
    active.match(/src:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i)?.[1] ||
    active.match(/(https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/i)?.[1];
  const mp4 =
    active.match(/src:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i)?.[1] ||
    active.match(/(https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*)/i)?.[1];
  const streamUrl = m3u8 || mp4;
  if (!streamUrl) return null;
  return {
    url: normalizeUrl(streamUrl, playUrl),
    type: /\.m3u8/i.test(streamUrl) ? "hls" : "mp4",
    referer: playUrl,
  };
}

/** CDA-HD uses player.cda-hd.co (Video.js + HLS), not VOE/Dood. */
export function resolveCdaHdPlayerPage(pageUrl, options = {}) {
  const referer = options.referer || "https://cda-hd.cc/";
  const playUrl = cdaHdPlayerPageUrl(pageUrl);
  const html = curlText(playUrl, { referer });
  if (!html) return null;

  const candidates = [
    resolveCdaHdPlayerViaMd5(playUrl, html, options),
    pickStaticCdaHdStream(html, playUrl),
  ].filter(Boolean);

  for (const stream of candidates) {
    if (probeCdaHdStreamUrl(stream.url, stream.referer)) return stream;
  }
  return null;
}

function looksLikeDoodHtml(html) {
  return /pass_md5\//i.test(html || "");
}

function curlText(url, { cookieJar, referer, extraHeaders = [] } = {}) {
  const args = ["-sL", "-A", UA, "--max-time", "45"];
  if (cookieJar) {
    args.push("-c", cookieJar, "-b", cookieJar);
  }
  if (referer) {
    args.push("-H", `Referer: ${referer}`);
  }
  for (const header of extraHeaders) {
    args.push("-H", header);
  }
  args.push(url);
  const result = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) return null;
  const body = (result.stdout || "").trim();
  if (!body || /Just a moment\.\.\./i.test(body)) return null;
  return body;
}

function randomPlaySuffix(length = 10) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

/** DoodStream / playmogo — fetch() is blocked by Cloudflare; curl + cookie jar works. */
export function resolveDoodPage(pageUrl) {
  const tmpDir = mkdtempSync(join(tmpdir(), "dood-"));
  const cookiePath = join(tmpDir, "cookies.txt");
  try {
    const html = curlText(pageUrl, { cookieJar: cookiePath });
    if (!html) return null;

    const passPath = html.match(/\/pass_md5\/[^"'\s<>]+/i)?.[0];
    if (!passPath) return null;

    const token =
      html.match(/makePlay\(\)[^}]*token=([a-z0-9]+)/i)?.[1] ||
      html.match(/[?&]token=([a-z0-9]+)/i)?.[1] ||
      passPath.split("/").pop();
    if (!token) return null;

    const origin = new URL(pageUrl).origin;
    const base = curlText(`${origin}${passPath}`, {
      cookieJar: cookiePath,
      referer: pageUrl,
      extraHeaders: ["X-Requested-With: XMLHttpRequest"],
    });
    if (!base || !/^https?:\/\//i.test(base)) return null;

    const streamUrl = `${base}${randomPlaySuffix()}?token=${token}&expiry=${Date.now()}`;
    return { url: streamUrl, type: "mp4", referer: pageUrl };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function extractVoeStreamFromHtml(html, finalUrl) {
  const redirect = findRedirect(html);
  if (redirect) {
    return { redirect: normalizeUrl(redirect, finalUrl) };
  }

  const jsonScripts = html.match(
    /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonScripts) {
    for (const block of jsonScripts) {
      const inner = block.replace(/[\s\S]*?>/, "").replace(/<\/script>/i, "").trim();
      const stream = pickStreamFromResult(deobfuscateEmbeddedJson(inner));
      if (stream?.url) {
        stream.url = normalizeUrl(stream.url, finalUrl);
        stream.referer = finalUrl;
        return { stream };
      }
    }
  }

  const iframeRe = /<iframe[^>]+src=["']([^"']+)["']/gi;
  const iframes = [];
  let m;
  while ((m = iframeRe.exec(html))) {
    const iframeUrl = normalizeUrl(m[1], finalUrl);
    if (iframeUrl !== finalUrl) iframes.push(iframeUrl);
  }
  return { iframes };
}

async function fetchVoeHtml(startUrl) {
  try {
    const res = await fetch(startUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      if (html && !/Just a moment\.\.\./i.test(html)) {
        return { html, finalUrl: res.url || startUrl };
      }
    }
  } catch {
    /* try curl */
  }
  const html = curlText(startUrl);
  if (!html) return null;
  return { html, finalUrl: startUrl };
}

/** Canonical VOE mirrors — ogladaj.me often redirects to dead CF hosts (520). */
const VOE_FALLBACK_ORIGINS = [
  "https://voe.sx",
  "https://vtbe.to",
  "https://voe-unblock.com",
];

function extractVoeEmbedId(url) {
  try {
    const m = new URL(url).pathname.match(/\/e\/([a-zA-Z0-9]+)/i);
    return m?.[1] || "";
  } catch {
    return "";
  }
}

function looksLikeDeadVoeHtml(html, finalUrl) {
  if (!html) return true;
  if (/\b520:\s*Web server is returning an unknown error/i.test(html)) return true;
  if (/Just a moment\.\.\./i.test(html)) return true;
  if (/cf-error-details|cloudflare\.com\/5xx-error/i.test(html)) return true;
  try {
    const host = new URL(finalUrl || "").hostname;
    if (/stevenfamilyedge|nicolehappyoutside/i.test(host) && html.length < 9000 && !/m3u8|application\/json/i.test(html)) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function resolveVoeWithFallbackHosts(embedUrl, depth) {
  const id = extractVoeEmbedId(embedUrl);
  if (!id || depth > 3) return null;
  let origin = "";
  try {
    origin = new URL(embedUrl).origin;
  } catch {
    return null;
  }
  for (const base of VOE_FALLBACK_ORIGINS) {
    if (base === origin) continue;
    const alt = `${base}/e/${id}`;
    const hit = await resolveVoePage(alt, depth + 1, { skipHostFallback: true });
    if (hit?.url) return hit;
  }
  return null;
}

export async function resolveVoePage(startUrl, depth = 0, options = {}) {
  if (depth > 5) return null;

  if (isCdaHdPlayerHost(startUrl)) {
    return resolveCdaHdPlayerPage(startUrl);
  }

  if (!isVoeEmbedHost(startUrl) && isDoodHost(startUrl)) {
    const dood = resolveDoodPage(startUrl);
    if (dood) return dood;
  }

  const fetched = await fetchVoeHtml(startUrl);
  if (!fetched || looksLikeDeadVoeHtml(fetched.html, fetched.finalUrl)) {
    if (!options.skipHostFallback && extractVoeEmbedId(startUrl)) {
      const viaFallback = await resolveVoeWithFallbackHosts(startUrl, depth);
      if (viaFallback) return viaFallback;
    }
    if (!isVoeEmbedHost(startUrl)) return resolveDoodPage(startUrl);
    return null;
  }
  const { html, finalUrl } = fetched;

  if (!isVoeEmbedHost(startUrl) && looksLikeDoodHtml(html)) {
    const dood = resolveDoodPage(startUrl);
    if (dood) return dood;
  }

  const extracted = extractVoeStreamFromHtml(html, finalUrl);

  if (extracted.redirect) {
    const viaRedirect = await resolveVoePage(extracted.redirect, depth + 1, options);
    if (viaRedirect) return viaRedirect;
    if (!options.skipHostFallback && extractVoeEmbedId(startUrl)) {
      return resolveVoeWithFallbackHosts(startUrl, depth);
    }
    return null;
  }
  if (extracted.stream) {
    return extracted.stream;
  }
  for (const iframeUrl of extracted.iframes || []) {
    const nested = await resolveVoePage(iframeUrl, depth + 1, options);
    if (nested) return nested;
  }

  if (!options.skipHostFallback && extractVoeEmbedId(startUrl)) {
    return resolveVoeWithFallbackHosts(startUrl, depth);
  }
  return null;
}

const MIRROR_HOSTS = /(?:^|\.)cda-hd\.(?:cc|pl|to|online|info)$/i;
const EMBED_HOSTS =
  /(?:ogladaj\.me|playmogo\.com|do\d+go\.com|voe\.sx|vtbe\.to|voe-unblock\.com|[^.]+\.(?:sbs|cfd|digital|watch))$/i;
const SKIP_IFRAME_HOSTS =
  /(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|dailymotion\.com|googletagmanager\.com|googleads|doubleclick\.net)/i;

export function isDoodLikeUrl(url) {
  try {
    return isDoodHost(url) || /cloudatacdn\.com|doodcdn|playmogo/i.test(new URL(url).hostname + url);
  } catch {
    return false;
  }
}

/** Niższy = lepszy. VOE/HLS i player.cda-hd przed throttlowanym Dood/playmogo. */
function embedPlaybackPriority(embedUrl) {
  try {
    if (isCdaHdPlayerHost(embedUrl)) return 0;
    if (isVoeEmbedHost(embedUrl)) return 1;
    if (isDoodHost(embedUrl)) return 5;
    return 3;
  } catch {
    return 9;
  }
}

function streamPlaybackPriority(stream) {
  if (!stream?.url) return 99;
  if (stream.type === "hls") return 0;
  if (isCdaHdPlayerHost(stream.url) || isCdaHdPlayerHost(stream.embedUrl || "")) return 1;
  if (isDoodLikeUrl(stream.url) || isDoodHost(stream.embedUrl || stream.url)) return 5;
  return 3;
}

export function isMirrorHost(url) {
  try {
    return MIRROR_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
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

/** Nowe strony CDA-HD: wbudowany player.cda-hd.co zamiast linków w <ul class="enlaces">. */
function extractCdaHdInlineEmbeds(html, pageUrl) {
  const out = [];
  const seen = new Set();
  const hashScriptRe =
    /<script[^>]+src=["'](https?:\/\/player\.cda-h(?:d)?\.[^"']+\/player\/hash\.php\?hash=([a-zA-Z0-9]+))["']/gi;
  let m;
  while ((m = hashScriptRe.exec(html))) {
    const vid = m[2];
    // Canonical player domain — player.cda-h.co hash gate often returns empty body for /e/{hash}.
    const playerUrl = `https://player.cda-hd.co/e/${vid}`;
    if (seen.has(playerUrl)) continue;
    seen.add(playerUrl);
    out.push({
      url: playerUrl,
      label: "player.cda-hd.co",
      hashScriptUrl: normalizeUrl(m[1], pageUrl),
    });
  }
  return out;
}

function fetchCdaHdHashFromScript(hashScriptUrl, referer) {
  const raw = curlText(hashScriptUrl, {
    referer,
    extraHeaders: ["Origin: https://cda-hd.cc"],
  });
  if (!raw) return null;
  const escaped = raw.match(/unescape\(\s*"([^"]+)"/i)?.[1];
  if (!escaped) return null;
  try {
    const decoded = decodeURIComponent(escaped);
    return decoded.match(/hash_from['"]\s*:\s*['"]([^'"]+)/i)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchMirrorHtml(pageUrl) {
  if (isMirrorHost(pageUrl)) {
    const { html, finalUrl } = await fetchCdaHdHtmlResilient(pageUrl);
    if (!html || isCloudflareChallenge(html, 200)) {
      throw new Error("Nie udało się otworzyć strony mirror.");
    }
    return { html, finalUrl: finalUrl || pageUrl };
  }

  const res = await fetch(pageUrl, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    redirect: "follow",
  });
  const html = await res.text();
  if (!res.ok || isCloudflareChallenge(html, res.status)) {
    throw new Error("Nie udało się otworzyć strony mirror.");
  }
  return { html, finalUrl: res.url || pageUrl };
}

export async function resolveMirrorPage(pageUrl) {
  const { html, finalUrl } = await fetchMirrorHtml(pageUrl);

  const title =
    html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
    html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.trim() ||
    html.match(/<title>([^<]+)/i)?.[1]?.trim() ||
    "Film";

  const thumbnail =
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.trim() || "";

  const embeds = [];
  const addEmbed = (embedUrl) => {
    if (!embedUrl) return;
    try {
      if (SKIP_IFRAME_HOSTS.test(new URL(embedUrl).hostname)) return;
    } catch {
      return;
    }
    if (!embeds.some((e) => e.url === embedUrl)) {
      embeds.push({
        url: embedUrl,
        label: new URL(embedUrl).hostname.replace(/^www\./, ""),
      });
    }
  };

  const enlacesRe = /<ul class="enlaces">([\s\S]*?)<\/ul>/gi;
  let enlacesBlock;
  while ((enlacesBlock = enlacesRe.exec(html))) {
    const hrefRe = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>/gi;
    let hrefMatch;
    while ((hrefMatch = hrefRe.exec(enlacesBlock[1]))) {
      addEmbed(normalizeUrl(hrefMatch[1], pageUrl));
    }
  }

  const iframeRe = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = iframeRe.exec(html))) {
    addEmbed(normalizeUrl(m[1], pageUrl));
  }

  for (const inline of extractCdaHdInlineEmbeds(html, pageUrl)) {
    if (!embeds.some((e) => e.url === inline.url)) {
      embeds.push(inline);
    }
  }

  let stream = null;
  let playbackError = null;
  const rankedEmbeds = [...embeds].sort(
    (a, b) => embedPlaybackPriority(a.url) - embedPlaybackPriority(b.url)
  );
  // Zbieramy kandydatów: preferuj HLS (VOE / player.cda-hd) zamiast wolnego Dood.
  const candidates = [];
  for (const embed of rankedEmbeds) {
    try {
      let resolved = null;
      if (isCdaHdPlayerHost(embed.url)) {
        const clickHash = embed.hashScriptUrl
          ? fetchCdaHdHashFromScript(embed.hashScriptUrl, finalUrl || pageUrl)
          : null;
        resolved = resolveCdaHdPlayerPage(embed.url, {
          referer: finalUrl || pageUrl,
          clickHash: clickHash || undefined,
        });
      } else {
        resolved = await resolveVoePage(embed.url);
      }
      if (!resolved?.url) continue;
      resolved.embedUrl = embed.url;
      resolved.label = embed.label;
      candidates.push(resolved);
      // HLS / natywny player — bierz od razu, nie szukaj dalej w dood.
      if (streamPlaybackPriority(resolved) <= 1) {
        stream = resolved;
        break;
      }
    } catch (err) {
      if (err?.code === "CDAHD_UNAVAILABLE") playbackError = err;
    }
  }
  if (!stream && candidates.length) {
    candidates.sort((a, b) => streamPlaybackPriority(a) - streamPlaybackPriority(b));
    stream = candidates[0];
  }

  return {
    title,
    thumbnail,
    embeds,
    stream,
    playbackError,
    webpageUrl: finalUrl || pageUrl,
    duration: parsePageDuration(html),
    html,
  };
}
