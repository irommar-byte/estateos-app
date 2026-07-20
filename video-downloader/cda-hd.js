/** CDA-HD.cc — wyszukiwarka i parser seriali (sezony / odcinki). */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CDA_HD_UA, fetchCdaHdHtmlResilient } from "./cda-hd-fetch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CDA_HD_BASE = (process.env.CDA_HD_BASE || "https://cda-hd.cc").replace(/\/$/, "");
export const CDA_HD_TVSHOWS_BASE =
  (process.env.CDA_HD_TVSHOWS_BASE || `${CDA_HD_BASE}/tvshows`).replace(/\/$/, "");
export const CDA_HD_UA = process.env.CDA_HD_UA || DEFAULT_CDA_HD_UA;

const CDA_HD_DISK_CACHE_PATH =
  process.env.CDA_HD_DISK_CACHE_PATH || path.join(__dirname, "data", "cda-hd-catalog-cache.json");
const CDA_HD_DISK_CACHE_TTL_MS = Number(process.env.CDA_HD_DISK_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;

export function isCdaHdEpisodeUrl(url) {
  try {
    const u = new URL(url);
    return /cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname) && /\/episode\//i.test(u.pathname);
  } catch {
    return false;
  }
}

export function isCdaHdFilmUrl(url) {
  try {
    const u = new URL(url);
    if (!/cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname)) return false;
    if (isCdaHdTvShowUrl(url)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isCdaHdBrowseUrl(url) {
  try {
    const u = new URL(url);
    if (!/cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname)) return false;
    return /\/(director|star|gatunki|release-year|tvshows-creator|tvshows-cast|tvshows-networks|tvshows-studio|tvshows-release-year)\//i.test(
      u.pathname
    );
  } catch {
    return false;
  }
}

function parseMetadataBlock(html, label) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<div class="metadatac"><b>${escaped}</b><span>([\\s\\S]*?)</span></div>`, "i");
  return html.match(re)?.[1] || "";
}

function parseMetadataText(block) {
  return decodeHtml(String(block || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseTvShowPhotos(html, pageUrl, limit = 14) {
  const photos = [];
  const start = html.indexOf('<div class="backdropss">');
  const end = html.indexOf('<h2 class="css3">', Math.max(start, 0));
  const block =
    start >= 0 ? html.slice(start, end > start ? end : start + 16000) : html.slice(0, 16000);
  const re = /data-src="(https:\/\/image\.tmdb\.org[^"]+)"/gi;
  let m;
  while ((m = re.exec(block)) && photos.length < limit) {
    const url = absUrl(m[1], pageUrl);
    if (!photos.includes(url)) photos.push(url);
  }
  return photos;
}

function parseCdaHdSeriesMeta(html, pageUrl, counts = {}) {
  let description = decodeHtml(html.match(/itemprop="description" content="([^"]*)"/i)?.[1] || "");
  if (!description) {
    const infoBlock = html.match(/<div class="contenidotv">\s*<p>([\s\S]*?)<\/p>/i)?.[1] || "";
    description = decodeHtml(infoBlock.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }

  const ratingValue = Number(html.match(/itemprop="ratingValue" content="([^"]+)"/i)?.[1]) || null;
  const ratingCount = Number(html.match(/itemprop="ratingCount" content="([^"]+)"/i)?.[1]) || null;
  const barPercentRaw = html.match(/class="bar"><span style="width:\s*(\d+)%"/i)?.[1];
  const barPercent = barPercentRaw
    ? Number(barPercentRaw)
    : ratingValue != null
      ? Math.round(ratingValue * 10)
      : null;

  const status = decodeHtml(html.match(/<span class="status">([^<]+)</i)?.[1] || "").trim() || null;
  const originalTitle = parseMetadataText(parseMetadataBlock(html, "Oryginalny tytuł"));
  const creators = parseTaggedLinks(parseMetadataBlock(html, "Twórca"), pageUrl);
  const cast = parseTaggedLinks(parseMetadataBlock(html, "W rolach głównych"), pageUrl);
  const networks = parseTaggedLinks(parseMetadataBlock(html, "Serial"), pageUrl);
  const studios = parseTaggedLinks(parseMetadataBlock(html, "Produkcja"), pageUrl);
  const yearLinks = parseTaggedLinks(parseMetadataBlock(html, "Rok wydania"), pageUrl);
  const year = yearLinks[0]?.name ? Number(yearLinks[0].name) : null;
  const firstAirDate = parseMetadataText(parseMetadataBlock(html, "Data pierwszej odsłony")) || null;
  const lastAirDate = parseMetadataText(parseMetadataBlock(html, "Data ostatniej odsłony")) || null;
  const episodeRuntime = parseMetadataText(parseMetadataBlock(html, "Czas trwania odcinka")) || null;
  const showType = parseMetadataText(parseMetadataBlock(html, "Typ")) || null;

  const title = decodeHtml(html.match(/<h1[^>]*>([^<]+)/i)?.[1] || "") || null;
  const thumbnail = absUrl(
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.trim() ||
      html.match(/data-src="(https:\/\/image\.tmdb\.org[^"]+)"/i)?.[1] ||
      ""
  );

  return {
    title,
    originalTitle: originalTitle || null,
    description: description || null,
    status,
    year: Number.isFinite(year) ? year : null,
    thumbnail,
    creators,
    cast,
    networks,
    studios,
    firstAirDate,
    lastAirDate,
    episodeRuntime,
    showType,
    photos: parseTvShowPhotos(html, pageUrl),
    seasonCount: counts.seasonCount || null,
    episodeCount: counts.episodeCount || null,
    rating:
      ratingValue != null
        ? {
            value: ratingValue,
            max: 10,
            votes: Number.isFinite(ratingCount) ? ratingCount : null,
            barPercent: Number.isFinite(barPercent) ? barPercent : null,
          }
        : null,
  };
}

function parseTaggedLinks(block, pageUrl) {
  if (!block) return [];
  const links = [];
  const re = /<a href="((?:https?:\/\/)?(?:www\.)?cda-hd\.(?:cc|pl|to|online|info)\/[^"]+)" rel="(?:tag|category tag)">([^<]*)<\/a>/gi;
  let m;
  while ((m = re.exec(block))) {
    const name = decodeHtml(m[2]);
    if (!name) continue;
    links.push({ name, url: absUrl(m[1], pageUrl) });
  }
  return links;
}

function parseDurationFromMeta(html) {
  const minMatch = html.match(/<b class="icon-time"><\/b>\s*(\d+)\s*min/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  const loose = html.match(/(\d{1,3})\s*min(?:ut)?/i);
  if (loose) return Number(loose[1]) * 60;
  return 0;
}

export function parseCdaHdMoviePage(html, pageUrl) {
  const title =
    decodeHtml(html.match(/<h1[^>]*>([^<]+)/i)?.[1] || "") ||
    decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.split("–")[0] || "") ||
    "Film";

  const subtitle = decodeHtml(
    html.match(/<span class="titulo_o">([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, " ") || ""
  ).replace(/\s+/g, " ");

  let description = decodeHtml(
    html.match(/itemprop="description" content="([^"]*)"/i)?.[1] || ""
  );
  if (!description) {
    const cap1 = html.match(/<div id="cap1"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    description = decodeHtml(cap1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }

  const ratingValueRaw = html.match(/itemprop="ratingValue" content="([^"]+)"/i)?.[1];
  const ratingCountRaw = html.match(/itemprop="ratingCount" content="([^"]+)"/i)?.[1];
  const ratingValue = ratingValueRaw ? Number(ratingValueRaw) : null;
  const ratingCount = ratingCountRaw ? Number(ratingCountRaw) : null;
  const barPercentRaw = html.match(/class="bar"><span style="width:\s*(\d+)%"/i)?.[1];
  const barPercent = barPercentRaw
    ? Number(barPercentRaw)
    : ratingValue != null
      ? Math.round(ratingValue * 10)
      : null;

  const yearMatch =
    html.match(/release-year\/(\d{4})/i)?.[1] ||
    subtitle.match(/\b(19|20)\d{2}\b/)?.[0] ||
    title.match(/\((19|20)\d{2}\)/)?.[0]?.replace(/[()]/g, "");
  const year = yearMatch ? Number(String(yearMatch).replace(/\D/g, "")) : null;

  const duration = parseDurationFromMeta(html);

  const genresBlock = html.match(/<p class="meta">[\s\S]*?<i class="limpiar">([\s\S]*?)<\/i>/i)?.[1];
  const genres = parseTaggedLinks(genresBlock, pageUrl);

  const directorBlock = html.match(
    /<p class="meta_dd">\s*<b class="icon-megaphone"><\/b>([\s\S]*?)<\/p>/i
  )?.[1];
  const directorLinks = parseTaggedLinks(directorBlock, pageUrl);
  const director = directorLinks[0] || null;

  const castBlock =
    html.match(/<p class="meta_dd limpiar">\s*<b class="icon-star"><\/b>([\s\S]*?)<\/p>/i)?.[1] ||
    html.match(/<div id="cap3">[\s\S]*?<h3>[\s\S]*?Gwiazdy[\s\S]*?<\/h3>([\s\S]*?)<\/div>/i)?.[1];
  let cast = parseTaggedLinks(castBlock, pageUrl);
  if (!cast.length) {
    const cap3 = html.match(/<div id="cap3">([\s\S]*?)<\/div>/i)?.[1] || "";
    cast = parseTaggedLinks(cap3, pageUrl).filter((link) => !/reżyser/i.test(link.name));
  }

  const country = decodeHtml(
    html.match(/<p class="meta_dd">\s*<b class="icon-network"><\/b>\s*([^<\n]+)/i)?.[1] || ""
  ).trim() || null;

  const thumbnail =
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.trim() ||
    html.match(/data-src="(https:\/\/image\.tmdb\.org[^"]+)"/i)?.[1] ||
    html.match(/class="cover[^"]*"[^>]*data-src="([^"]+)"/i)?.[1] ||
    "";

  return {
    title,
    subtitle: subtitle || null,
    description: description || null,
    year: Number.isFinite(year) ? year : null,
    duration: duration || null,
    country,
    thumbnail: absUrl(thumbnail),
    genres,
    director,
    cast,
    rating:
      ratingValue != null
        ? {
            value: ratingValue,
            max: 10,
            votes: Number.isFinite(ratingCount) ? ratingCount : null,
            barPercent: Number.isFinite(barPercent) ? barPercent : null,
          }
        : null,
  };
}

function cdaHdPagedUrl(baseUrl, page) {
  if (page <= 1) return baseUrl;
  return `${String(baseUrl).replace(/\/?$/, "/")}page/${page}/`;
}

export async function fetchCdaHdBrowse(pageUrl, limit = 24, page = 1) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 48);
  const minNeeded = safePage * safeLimit + 1;
  const all = [];
  const seen = new Set();
  let heading = "Powiązane filmy";
  let finalUrl = pageUrl;

  for (let p = 1; p <= 12 && all.length < minNeeded; p += 1) {
    const fetchUrl = cdaHdPagedUrl(pageUrl, p);
    let html;
    try {
      ({ html, finalUrl } = await fetchCdaHdHtml(fetchUrl));
    } catch {
      break;
    }
    if (p === 1) {
      heading =
        decodeHtml(html.match(/<h1[^>]*>([^<]+)/i)?.[1] || "") ||
        decodeHtml(html.match(/<title>([^<|]+)/i)?.[1] || "") ||
        heading;
    }
    const batch = parseCdaHdSearch(html, safeLimit + 12);
    let added = 0;
    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      all.push(item);
      added += 1;
    }
    if (!added) break;
  }

  const start = (safePage - 1) * safeLimit;
  const items = all.slice(start, start + safeLimit);
  const hasMore = all.length > start + safeLimit;

  return {
    title: heading.replace(/\s*–\s*CDA-HD.*/i, "").trim(),
    pageUrl: finalUrl,
    page: safePage,
    pageSize: safeLimit,
    items,
    hasMore,
  };
}

export function isCdaHdTvShowUrl(url) {
  try {
    const u = new URL(url);
    return /cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname) && /\/tvshows?\//i.test(u.pathname);
  } catch {
    return false;
  }
}

function decodeHtml(text) {
  return text
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function absUrl(url, base = CDA_HD_BASE) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http")) return url;
  return new URL(url, base).href;
}

export async function fetchCdaHdHtml(pageUrl) {
  return fetchCdaHdHtmlResilient(pageUrl);
}

function readDiskCatalogCache() {
  try {
    if (!fs.existsSync(CDA_HD_DISK_CACHE_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(CDA_HD_DISK_CACHE_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDiskCatalogCache(patch) {
  try {
    fs.mkdirSync(path.dirname(CDA_HD_DISK_CACHE_PATH), { recursive: true });
    const prev = readDiskCatalogCache() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    const tmp = `${CDA_HD_DISK_CACHE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next) + "\n", "utf8");
    fs.renameSync(tmp, CDA_HD_DISK_CACHE_PATH);
  } catch (err) {
    console.warn("cda-hd disk cache write:", err?.message || err);
  }
}

/** Zwraca zapisany katalog, jeśli nie jest starszy niż maxAgeMs (domyślnie 24h). */
export function loadCdaHdDiskCatalog(maxAgeMs = CDA_HD_DISK_CACHE_TTL_MS) {
  const cache = readDiskCatalogCache();
  if (!cache?.latest?.length) return null;
  const age = Date.now() - (Number(cache.updatedAt) || 0);
  if (age > maxAgeMs) return { ...cache, stale: true, ageMs: age };
  return { ...cache, stale: false, ageMs: age };
}

export function saveCdaHdDiskCatalog(items) {
  if (!Array.isArray(items) || !items.length) return;
  const latest = items.slice(0, 80);
  const series = latest.filter((i) => i.isSerial || isCdaHdTvShowUrl(i.url));
  const films = latest.filter((i) => !(i.isSerial || isCdaHdTvShowUrl(i.url)));
  writeDiskCatalogCache({ latest, series: series.slice(0, 40), films: films.slice(0, 40) });
}

export function parseCdaHdSearch(html, limit = 12) {
  const results = [];
  const seen = new Set();
  const itemRe = /<div id="mt-\d+" class="item">([\s\S]*?)<div class="typepost">([^<]*)<\/div>/gi;
  let m;

  while ((m = itemRe.exec(html)) && results.length < limit) {
    const block = m[1];
    const typepost = decodeHtml(m[2]);
    const urlMatch = block.match(/href="((?:https?:\/\/)?(?:www\.)?cda-hd\.(?:cc|pl|to|online|info)\/[^"]+)"/i) || block.match(/href="(\/(?:film|tvshows?|episode)\/[^"]+)"/i);
    if (!urlMatch) continue;
    const url = absUrl(urlMatch[1]);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const title =
      decodeHtml(block.match(/<span class="tt">([^<]*)<\/span>/i)?.[1] || "") || "Bez tytułu";
    const thumb =
      block.match(/data-src="(https:\/\/image\.tmdb\.org[^"]+)"/i)?.[1] ||
      block.match(/data-src="(https:\/\/icdn\.cda\.pl[^"]+)"/i)?.[1] ||
      block.match(/data-src="(https:\/\/s\.tvp\.pl[^"]+)"/i)?.[1] ||
      block.match(/data-src="(https:\/\/i\.ytimg\.com[^"]+)"/i)?.[1] ||
      block.match(/src="(https:\/\/image\.tmdb\.org[^"]+)"/i)?.[1] ||
      block.match(/src="(https:\/\/icdn\.cda\.pl[^"]+)"/i)?.[1] ||
      "";
    const ratingRaw = block.match(/<span class="imdbs">([^<]*)<\/span>/i)?.[1]?.trim() || null;
    const rating = ratingRaw != null && ratingRaw !== "" ? Number(ratingRaw) : null;
    const isSerial = /serial/i.test(typepost) || isCdaHdTvShowUrl(url) || /\/tvshows?\//i.test(url);

    results.push({
      id: url.replace(/\/$/, "").split("/").pop(),
      title,
      url,
      thumbnail: absUrl(thumb),
      uploader: "CDA-HD",
      duration: 0,
      rating: Number.isFinite(rating) ? rating : null,
      quality: Number.isFinite(rating) ? `${rating}/10` : null,
      qualities: Number.isFinite(rating) ? [`TMDb ${rating}`] : [],
      source: "cda-hd",
      detail: isSerial ? "Serial · CDA-HD" : "Film · CDA-HD",
      isSerial,
    });
  }

  return results;
}

const CDA_HD_CATALOG_PAGE_SIZE = 20;
const CDA_HD_MAX_SITE_PAGES = 30;

async function fetchCdaHdListingFromBase(baseUrl, minCount = 20, maxCdaPages = CDA_HD_MAX_SITE_PAGES) {
  const all = [];
  const seen = new Set();
  const target = Math.max(Number(minCount) || 20, 1);
  const cap = Math.max(1, Math.min(Number(maxCdaPages) || CDA_HD_MAX_SITE_PAGES, CDA_HD_MAX_SITE_PAGES));
  const root = String(baseUrl || CDA_HD_BASE).replace(/\/$/, "");

  for (let p = 1; p <= cap; p += 1) {
    const pageUrl = p === 1 ? `${root}/` : `${root}/page/${p}/`;
    let html;
    try {
      ({ html } = await fetchCdaHdHtml(pageUrl));
    } catch (err) {
      if (p === 1) throw err;
      break;
    }
    const batch = parseCdaHdSearch(html, 80);
    if (p === 1 && !batch.length) {
      throw new Error(`CDA-HD zwróciło stronę bez listy (${root}).`);
    }
    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      all.push(item);
    }
    if (!batch.length) break;
    if (all.length >= target && batch.length < 12) break;
  }
  return all;
}

function interleavePools(films, series) {
  const out = [];
  const max = Math.max(films.length, series.length);
  for (let i = 0; i < max; i += 1) {
    if (films[i]) out.push(films[i]);
    if (series[i]) out.push(series[i]);
  }
  return out;
}

/** Pobiera filmy (home) + seriale (/tvshows/) i scala — inaczej katalog TV jest samymi filmami. */
async function fetchCdaHdListingPool(minCount = 20, maxCdaPages = CDA_HD_MAX_SITE_PAGES) {
  const perSource = Math.max(12, Math.ceil(Number(minCount) || 20));
  const pages = Math.max(1, Math.min(Number(maxCdaPages) || 3, CDA_HD_MAX_SITE_PAGES));

  const settled = await Promise.allSettled([
    fetchCdaHdListingFromBase(CDA_HD_BASE, perSource, pages),
    fetchCdaHdListingFromBase(CDA_HD_TVSHOWS_BASE, perSource, pages),
  ]);

  const films = settled[0].status === "fulfilled" ? settled[0].value : [];
  const series = settled[1].status === "fulfilled" ? settled[1].value : [];

  if (!films.length && !series.length) {
    const err =
      (settled[0].status === "rejected" && settled[0].reason) ||
      (settled[1].status === "rejected" && settled[1].reason) ||
      new Error("Nie udało się pobrać katalogu CDA-HD (filmy + seriale).");
    throw err;
  }

  if (settled[0].status === "rejected") {
    console.warn("cda-hd films listing:", settled[0].reason?.message || settled[0].reason);
  }
  if (settled[1].status === "rejected") {
    console.warn("cda-hd series listing:", settled[1].reason?.message || settled[1].reason);
  }

  return interleavePools(films, series);
}

export function orderCdaHdCatalog(pool, mode) {
  const list = Array.isArray(pool) ? [...pool] : [];
  const byTitle = (a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pl");

  if (mode === "top-rated") {
    return list
      .filter((item) => item.rating != null || item.votes != null)
      .sort((a, b) => {
        const diff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
        if (diff !== 0) return diff;
        const vDiff = (Number(b.votes) || Number(b.views) || 0) - (Number(a.votes) || Number(a.views) || 0);
        if (vDiff !== 0) return vDiff;
        return byTitle(a, b);
      });
  }

  if (mode === "most-played") {
    return list
      .slice()
      .sort((a, b) => {
        const av = Number(a.views) || Number(a.votes) || 0;
        const bv = Number(b.views) || Number(b.votes) || 0;
        if (bv !== av) return bv - av;
        // bez views — rating jako przybliżenie popularności
        const ar = Number(a.rating) || 0;
        const br = Number(b.rating) || 0;
        if (br !== ar) return br - ar;
        return byTitle(a, b);
      });
  }

  if (mode === "longest") {
    return list
      .slice()
      .sort((a, b) => {
        const ad = Number(a.duration) || 0;
        const bd = Number(b.duration) || 0;
        if (bd !== ad) return bd - ad;
        return byTitle(a, b);
      });
  }

  // all / latest: zachowaj kolejność listingu
  return list;
}

export async function fetchCdaHdCatalog({
  mode = "latest",
  page = 1,
  pageSize = CDA_HD_CATALOG_PAGE_SIZE,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || CDA_HD_CATALOG_PAGE_SIZE, 1), 24);
  const minNeeded = safePage * safeSize + 1;
  const sitePages = Math.min(
    CDA_HD_MAX_SITE_PAGES,
    Math.max(3, Math.ceil(minNeeded / 24) + (mode === "top-rated" ? 3 : 1))
  );
  const pool = await fetchCdaHdListingPool(minNeeded, sitePages);
  const ordered = orderCdaHdCatalog(pool, mode);
  const start = (safePage - 1) * safeSize;

  return {
    mode,
    page: safePage,
    pageSize: safeSize,
    totalItems: ordered.length,
    items: ordered.slice(start, start + safeSize),
    hasMore: ordered.length > start + safeSize,
  };
}

export async function fetchCdaHdLatest(limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 60);
  const { items } = await fetchCdaHdCatalog({
    mode: "latest",
    page: 1,
    pageSize: safeLimit,
  });
  if (items.length) saveCdaHdDiskCatalog(items);
  return items;
}

export async function searchCdaHd(query, limit = 48, page = 1) {
  const maxPages = Math.max(1, Math.min(Number(page) || 1, 8));
  const target = Math.min(Math.max(Number(limit) || 48, 1), 120);
  const all = [];
  const seen = new Set();

  for (let p = 1; p <= maxPages && all.length < target; p += 1) {
    const searchUrl =
      p === 1
        ? `${CDA_HD_BASE}/?s=${encodeURIComponent(query)}`
        : `${CDA_HD_BASE}/page/${p}/?s=${encodeURIComponent(query)}`;
    let html;
    try {
      ({ html } = await fetchCdaHdHtml(searchUrl));
    } catch {
      break;
    }
    const batch = parseCdaHdSearch(html, target - all.length);
    let added = 0;
    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      all.push(item);
      added += 1;
    }
    if (!added || batch.length < 8) break;
  }

  return all.slice(0, target);
}

export function parseCdaHdTvShow(html, pageUrl) {
  const title =
    decodeHtml(html.match(/<h1[^>]*>([^<]+)/i)?.[1] || "") ||
    decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.split("–")[0] || "") ||
    "Serial";

  const thumbnail =
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.trim() ||
    html.match(/data-src="(https:\/\/image\.tmdb\.org[^"]+)"/i)?.[1] ||
    "";

  const seasonCountMeta = html.match(/<i>(\d+)<\/i>\s*Sezony/i)?.[1];
  const episodeCountMeta = html.match(/<i>(\d+)<\/i>\s*Odcinki/i)?.[1];

  const seasons = [];
  const seasonBlockRe = /<div class="se-c">([\s\S]*?)<\/div>\s*(?=<div class="se-c">|<div id="player|<\/div>\s*<\/div>\s*<div id="player)/gi;
  let sm;

  while ((sm = seasonBlockRe.exec(html))) {
    const block = sm[1];
    const seasonNum = Number(block.match(/<span class="se-t[^"]*">(\d+)<\/span>/i)?.[1] || seasons.length + 1);
    const seasonTitle =
      decodeHtml(block.match(/<span class="title">([^<]*)<\/span>/i)?.[1] || "") ||
      `${title} – Sezon ${seasonNum}`;

    const episodes = [];
    const epRe =
      /<li>[\s\S]*?<div class="numerando">([^<]*)<\/div>[\s\S]*?<a href="([^"]+)">\s*([^<]*)\s*<\/a>/gi;
    let em;
    while ((em = epRe.exec(block))) {
      const numbering = em[1].trim();
      const epUrl = absUrl(em[2], pageUrl);
      const epTitle = decodeHtml(em[3]) || `Odcinek`;
      const epNumMatch = numbering.match(/(\d+)\s*x\s*(\d+)/i) || epTitle.match(/(\d+)/);
      episodes.push({
        id: epUrl.split("/").filter(Boolean).pop(),
        title: epTitle.startsWith("Odcinek") ? epTitle : `Odcinek ${epTitle}`,
        url: epUrl,
        thumbnail: absUrl(thumbnail),
        duration: 0,
        seasonNumber: seasonNum,
        episodeNumber: epNumMatch ? Number(epNumMatch[2] || epNumMatch[1]) : episodes.length + 1,
        numbering,
      });
    }

    if (episodes.length) {
      seasons.push({
        seasonNumber: seasonNum,
        title: seasonTitle,
        episodeCount: episodes.length,
        episodes,
      });
    }
  }

  // Fallback: flat episode list without season wrappers
  if (!seasons.length) {
    const episodes = [];
    const epRe =
      /<div class="numerando">([^<]*)<\/div>[\s\S]*?<a href="((?:https?:\/\/)?(?:www\.)?cda-hd\.(?:cc|pl|to|online|info)\/episode\/[^"]+|\/episode\/[^"]+)">\s*([^<]*)\s*<\/a>/gi;
    let em;
    while ((em = epRe.exec(html))) {
      const numbering = em[1].trim();
      const epUrl = em[2];
      const epTitle = decodeHtml(em[3]);
      const parts = numbering.match(/(\d+)\s*x\s*(\d+)/i);
      episodes.push({
        id: epUrl.split("/").filter(Boolean).pop(),
        title: epTitle || `Odcinek ${episodes.length + 1}`,
        url: epUrl,
        thumbnail: absUrl(thumbnail),
        duration: 0,
        seasonNumber: parts ? Number(parts[1]) : 1,
        episodeNumber: parts ? Number(parts[2]) : episodes.length + 1,
        numbering,
      });
    }
    if (episodes.length) {
      const bySeason = new Map();
      for (const ep of episodes) {
        const sn = ep.seasonNumber || 1;
        if (!bySeason.has(sn)) bySeason.set(sn, []);
        bySeason.get(sn).push(ep);
      }
      for (const [sn, eps] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
        seasons.push({
          seasonNumber: sn,
          title: `${title} – Sezon ${sn}`,
          episodeCount: eps.length,
          episodes: eps,
        });
      }
    }
  }

  const allEpisodes = seasons.flatMap((s) => s.episodes);
  const seasonCount = seasons.length || Number(seasonCountMeta) || 0;
  const episodeCount = allEpisodes.length || Number(episodeCountMeta) || 0;
  const meta = parseCdaHdSeriesMeta(html, pageUrl, { seasonCount, episodeCount });

  return {
    title,
    thumbnail: absUrl(thumbnail),
    webpageUrl: pageUrl,
    seasonCount,
    episodeCount,
    seasons,
    episodes: allEpisodes,
    meta,
  };
}

function seriesCacheKey(pageUrl) {
  try {
    const u = new URL(pageUrl);
    return (u.pathname || pageUrl).replace(/\/+$/, "").toLowerCase();
  } catch {
    return String(pageUrl || "").toLowerCase();
  }
}

export function loadCachedCdaHdTvShow(pageUrl, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cache = readDiskCatalogCache();
  const key = seriesCacheKey(pageUrl);
  const entry = cache?.tvShows?.[key];
  if (!entry?.show?.episodes?.length) return null;
  const age = Date.now() - (Number(entry.at) || 0);
  if (age > maxAgeMs) return { ...entry.show, _cached: true, _stale: true, _ageMs: age };
  return { ...entry.show, _cached: true, _stale: false, _ageMs: age };
}

export function saveCachedCdaHdTvShow(pageUrl, show) {
  if (!show?.episodes?.length) return;
  const cache = readDiskCatalogCache() || {};
  const tvShows = { ...(cache.tvShows || {}) };
  tvShows[seriesCacheKey(pageUrl)] = {
    at: Date.now(),
    show: {
      title: show.title,
      thumbnail: show.thumbnail,
      webpageUrl: show.webpageUrl || pageUrl,
      seasonCount: show.seasonCount,
      episodeCount: show.episodeCount,
      seasons: show.seasons,
      episodes: show.episodes,
      meta: show.meta || null,
    },
  };
  // Limit rozmiaru dysku
  const keys = Object.keys(tvShows);
  if (keys.length > 80) {
    keys
      .sort((a, b) => (tvShows[a].at || 0) - (tvShows[b].at || 0))
      .slice(0, keys.length - 80)
      .forEach((k) => delete tvShows[k]);
  }
  writeDiskCatalogCache({ tvShows });
}

export async function fetchCdaHdTvShow(pageUrl, { allowCache = true, preferCache = false } = {}) {
  // Natychmiastowy hit z dysku — Apple TV nie czeka na Cloudflare/FlareSolverr (~30–90 s).
  if (preferCache) {
    const cachedFirst = loadCachedCdaHdTvShow(pageUrl, 30 * 24 * 60 * 60 * 1000);
    if (cachedFirst?.episodes?.length) {
      setTimeout(() => {
        fetchCdaHdTvShow(pageUrl, { allowCache: false, preferCache: false }).catch(() => {});
      }, 50);
      return cachedFirst;
    }
  }

  try {
    const { html, finalUrl } = await fetchCdaHdHtml(pageUrl);
    const show = parseCdaHdTvShow(html, finalUrl || pageUrl);
    if (!show.episodes.length) {
      throw new Error(
        "Nie znaleziono odcinków na stronie serialu. Otwórz konkretny odcinek albo wyszukaj ponownie."
      );
    }
    show.webpageUrl = show.webpageUrl || finalUrl || pageUrl;
    saveCachedCdaHdTvShow(finalUrl || pageUrl, show);
    return show;
  } catch (err) {
    if (allowCache) {
      const cached = loadCachedCdaHdTvShow(pageUrl, 30 * 24 * 60 * 60 * 1000);
      if (cached?.episodes?.length) {
        console.warn("cda-hd tvshow cache fallback:", err?.message || err);
        return cached;
      }
    }
    throw err;
  }
}

/** Kolejka podgrzewania list odcinków popularnych seriali (bez blokowania requestów). */
let seriesWarmChain = Promise.resolve();
let seriesWarmPending = new Set();

export function warmCdaHdTvShows(urls = [], { limit = 8 } = {}) {
  const list = [...new Set((urls || []).map((u) => String(u || "").trim()).filter(Boolean))].slice(0, limit);
  for (const url of list) {
    if (seriesWarmPending.has(url)) continue;
    if (loadCachedCdaHdTvShow(url, 24 * 60 * 60 * 1000)?.episodes?.length) continue;
    seriesWarmPending.add(url);
    seriesWarmChain = seriesWarmChain
      .then(async () => {
        try {
          await fetchCdaHdTvShow(url, { allowCache: true, preferCache: false });
          console.warn("cda-hd warm ok:", url);
        } catch (err) {
          console.warn("cda-hd warm fail:", url, err?.message || err);
        } finally {
          seriesWarmPending.delete(url);
        }
      })
      .catch(() => {});
  }
}

export function buildCdaHdSeriesInfo(show) {
  const meta = show.meta || null;
  const webpageUrl = show.webpageUrl || meta?.webpageUrl || "";
  return {
    isPlaylist: true,
    isSeasoned: true,
    title: show.title || "Serial",
    uploader: meta?.creators?.[0]?.name || meta?.networks?.[0]?.name || "CDA-HD",
    thumbnail: meta?.thumbnail || show.thumbnail,
    webpageUrl,
    seasonCount: show.seasonCount,
    episodeCount: show.episodeCount,
    seasons: show.seasons,
    episodes: show.episodes,
    source: "cda-hd",
    quality: meta?.rating?.value != null ? `${meta.rating.value}/10` : null,
    cdaHd: meta,
  };
}
