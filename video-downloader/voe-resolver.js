/** Resolve VOE / ogladaj.me / DoodStream embed pages to a direct MP4 or HLS URL. */

import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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

export async function resolveVoePage(startUrl, depth = 0) {
  if (depth > 5) return null;

  if (!isVoeEmbedHost(startUrl) && isDoodHost(startUrl)) {
    const dood = resolveDoodPage(startUrl);
    if (dood) return dood;
  }

  const fetched = await fetchVoeHtml(startUrl);
  if (!fetched) {
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
    return resolveVoePage(extracted.redirect, depth + 1);
  }
  if (extracted.stream) {
    return extracted.stream;
  }
  for (const iframeUrl of extracted.iframes || []) {
    const nested = await resolveVoePage(iframeUrl, depth + 1);
    if (nested) return nested;
  }

  return null;
}

const MIRROR_HOSTS = /(?:^|\.)cda-hd\.(?:cc|pl|to|online|info)$/i;
const EMBED_HOSTS =
  /(?:ogladaj\.me|playmogo\.com|do\d+go\.com|voe\.sx|vtbe\.to|voe-unblock\.com|[^.]+\.(?:sbs|cfd|digital|watch))$/i;
const SKIP_IFRAME_HOSTS =
  /(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|dailymotion\.com)/i;

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

export async function resolveMirrorPage(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error("Nie udało się otworzyć strony mirror.");
  const html = await res.text();

  const title =
    html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
    html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.trim() ||
    html.match(/<title>([^<]+)/i)?.[1]?.trim() ||
    "Film";

  const thumbnail =
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.trim() || "";

  const iframeRe = /<iframe[^>]+src=["']([^"']+)["']/gi;
  const embeds = [];
  let m;
  while ((m = iframeRe.exec(html))) {
    const embedUrl = normalizeUrl(m[1], pageUrl);
    try {
      if (SKIP_IFRAME_HOSTS.test(new URL(embedUrl).hostname)) continue;
    } catch {
      continue;
    }
    if (!embeds.some((e) => e.url === embedUrl)) {
      embeds.push({
        url: embedUrl,
        label: new URL(embedUrl).hostname.replace(/^www\./, ""),
      });
    }
  }

  let stream = null;
  for (const embed of embeds) {
    try {
      stream = await resolveVoePage(embed.url);
      if (stream) {
        stream.embedUrl = embed.url;
        stream.label = embed.label;
        break;
      }
    } catch {
      /* try next embed */
    }
  }

  return { title, thumbnail, embeds, stream, webpageUrl: pageUrl, duration: parsePageDuration(html) };
}
