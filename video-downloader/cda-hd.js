/** CDA-HD.cc — wyszukiwarka i parser seriali (sezony / odcinki). */

export const CDA_HD_BASE = "https://cda-hd.cc";
export const CDA_HD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function isCdaHdTvShowUrl(url) {
  try {
    const u = new URL(url);
    return /cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname) && /\/tvshows?\//i.test(u.pathname);
  } catch {
    return false;
  }
}

export function isCdaHdEpisodeUrl(url) {
  try {
    const u = new URL(url);
    return /cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname) && /\/episode\//i.test(u.pathname);
  } catch {
    return false;
  }
}

function decodeHtml(text) {
  return text
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
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
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": CDA_HD_UA, Accept: "text/html,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Nie udało się otworzyć strony CDA-HD (${res.status}).`);
  return { html: await res.text(), finalUrl: res.url || pageUrl };
}

export function parseCdaHdSearch(html, limit = 12) {
  const results = [];
  const seen = new Set();
  const itemRe = /<div id="mt-\d+" class="item">([\s\S]*?)<div class="typepost">([^<]*)<\/div>/gi;
  let m;

  while ((m = itemRe.exec(html)) && results.length < limit) {
    const block = m[1];
    const typepost = decodeHtml(m[2]);
    const urlMatch = block.match(/href="(https:\/\/cda-hd\.cc\/[^"]+)"/i);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    if (seen.has(url)) continue;
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
    const rating = block.match(/<span class="imdbs">([^<]*)<\/span>/i)?.[1]?.trim() || null;
    const isSerial = /serial/i.test(typepost);

    results.push({
      id: url.replace(/\/$/, "").split("/").pop(),
      title,
      url,
      thumbnail: absUrl(thumb),
      uploader: "CDA-HD",
      duration: 0,
      quality: rating ? `${rating}/10` : null,
      qualities: rating ? [`TMDb ${rating}`] : [],
      source: "cda-hd",
      detail: isSerial ? "Serial · CDA-HD" : "Film · CDA-HD",
      isSerial,
    });
  }

  return results;
}

export async function fetchCdaHdLatest(limit = 16) {
  const { html } = await fetchCdaHdHtml(CDA_HD_BASE);
  const items = parseCdaHdSearch(html, Math.min(Math.max(Number(limit) || 16, 1), 24));
  return items.sort((a, b) => Number(a.isSerial) - Number(b.isSerial));
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
      /<div class="numerando">([^<]*)<\/div>[\s\S]*?<a href="(https:\/\/cda-hd\.cc\/episode\/[^"]+)">\s*([^<]*)\s*<\/a>/gi;
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

  return {
    title,
    thumbnail: absUrl(thumbnail),
    webpageUrl: pageUrl,
    seasonCount: seasons.length || Number(seasonCountMeta) || 0,
    episodeCount: allEpisodes.length || Number(episodeCountMeta) || 0,
    seasons,
    episodes: allEpisodes,
  };
}

export async function fetchCdaHdTvShow(pageUrl) {
  const { html, finalUrl } = await fetchCdaHdHtml(pageUrl);
  const show = parseCdaHdTvShow(html, finalUrl);
  if (!show.episodes.length) {
    throw new Error(
      "Nie znaleziono odcinków na stronie serialu. Otwórz konkretny odcinek albo wyszukaj ponownie."
    );
  }
  return show;
}

export function buildCdaHdSeriesInfo(show) {
  return {
    isPlaylist: true,
    isSeasoned: true,
    title: show.title,
    uploader: "CDA-HD",
    thumbnail: show.thumbnail,
    webpageUrl: show.webpageUrl,
    seasonCount: show.seasonCount,
    episodeCount: show.episodeCount,
    seasons: show.seasons,
    episodes: show.episodes,
  };
}
