/**
 * Spotify playlist/album → Apple Music track mapping for EOS Music import.
 * Uses the public Spotify embed page (no API keys). Tracks are resolved via iTunes search
 * so playback still goes through the existing Apple Music / APLMate pipeline.
 */
import { searchAppleMusic } from "./apple-music.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function parseSpotifyPlaylistUrl(input) {
  try {
    let raw = String(input || "").trim();
    if (!raw) return null;

    const spotifyUri = raw.match(/^spotify:(playlist|album):([a-zA-Z0-9]+)$/i);
    if (spotifyUri) {
      const kind = spotifyUri[1].toLowerCase();
      const id = spotifyUri[2];
      return {
        kind,
        id,
        canonicalUrl: `https://open.spotify.com/${kind}/${id}`,
        embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
      };
    }

    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "");
    // spotify.link short URLs are resolved via redirect in fetchSpotifyPlaylist.
    if (host === "spotify.link") return null;
    if (!/^(open\.)?spotify\.com$/i.test(host)) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    // /playlist/ID or /intl-pl/playlist/ID or /embed/playlist/ID
    let kind = null;
    let id = null;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].toLowerCase();
      if ((p === "playlist" || p === "album") && parts[i + 1]) {
        kind = p;
        id = parts[i + 1].split("?")[0];
        break;
      }
    }
    if (!kind || !id || !/^[a-zA-Z0-9]+$/.test(id)) return null;

    return {
      kind,
      id,
      canonicalUrl: `https://open.spotify.com/${kind}/${id}`,
      embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
    };
  } catch {
    return null;
  }
}

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreAppleMatch(song, title, artist) {
  const targetTitle = normalizeToken(title);
  const targetArtist = normalizeToken(artist);
  const songTitle = normalizeToken(song.title);
  const songArtist = normalizeToken(song.artist || song.uploader || "");
  let score = 0;
  if (!targetTitle || !songTitle) return 0;
  if (songTitle === targetTitle) score += 100;
  else if (songTitle.includes(targetTitle) || targetTitle.includes(songTitle)) score += 55;
  if (targetArtist) {
    if (songArtist === targetArtist) score += 60;
    else if (songArtist.includes(targetArtist) || targetArtist.includes(songArtist)) score += 30;
  }
  if (song.albumId) score += 4;
  if (song.thumbnail) score += 2;
  return score;
}

async function matchSpotifyTrackToApple({ title, artist, durationMs }) {
  const query = [artist, title].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const results = await searchAppleMusic(query, 8);
  if (!results.length) return null;

  let best = null;
  let bestScore = 0;
  for (const song of results) {
    let score = scoreAppleMatch(song, title, artist);
    if (durationMs > 0 && song.duration > 0) {
      const diff = Math.abs(song.duration * 1000 - durationMs);
      if (diff < 2500) score += 12;
      else if (diff < 8000) score += 4;
    }
    if (score > bestScore) {
      bestScore = score;
      best = song;
    }
  }
  // Require a minimum confidence so we don't import random songs.
  if (!best || bestScore < 80) return null;
  return {
    ...best,
    source: "spotify→apple-music",
    detail: best.detail || "Spotify → Apple Music",
  };
}

async function mapPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return out;
}

async function scrapeSpotifyEmbed(parsed) {
  let embedUrl = parsed.embedUrl;
  // Resolve spotify.link / international redirects first via canonical open URL.
  const pageRes = await fetch(parsed.canonicalUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (pageRes.url) {
    const redirected = parseSpotifyPlaylistUrl(pageRes.url);
    if (redirected) embedUrl = redirected.embedUrl;
  }

  const res = await fetch(embedUrl, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pl,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Nie znaleziono playlisty Spotify (404). Sprawdź, czy link jest publiczny."
        : `Spotify HTTP ${res.status}`
    );
  }

  const html = await res.text();
  const nextMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/i
  );
  if (!nextMatch) {
    throw new Error(
      "Nie udało się odczytać playlisty Spotify — sprawdź, czy jest publiczna (nie prywatna)."
    );
  }

  let data;
  try {
    data = JSON.parse(nextMatch[1]);
  } catch {
    throw new Error("Nie udało się odczytać danych playlisty Spotify.");
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity || !Array.isArray(entity.trackList) || entity.trackList.length === 0) {
    throw new Error(
      "Playlista Spotify nie ma publicznych utworów albo jest prywatna / pusta."
    );
  }

  const cover =
    entity.coverArt?.sources?.find((s) => s?.url)?.url ||
    entity.coverArt?.sources?.[0]?.url ||
    "";

  const entries = entity.trackList
    .map((row, idx) => ({
      title: String(row?.title || "").trim(),
      artist: String(row?.subtitle || row?.artist || "").trim(),
      durationMs: Number(row?.duration) || 0,
      uri: String(row?.uri || ""),
      trackNumber: idx + 1,
    }))
    .filter((row) => row.title);

  return {
    playlist: {
      id: String(entity.id || parsed.id),
      title: String(entity.name || entity.title || "Playlista Spotify").trim(),
      trackCount: entries.length,
      thumbnail: cover,
      url: parsed.canonicalUrl,
      source: "spotify",
    },
    entries,
  };
}

export async function fetchSpotifyPlaylist(inputUrl) {
  let parsed = parseSpotifyPlaylistUrl(inputUrl);
  if (!parsed) {
    // spotify.link short URLs — follow redirect then re-parse
    try {
      let raw = String(inputUrl || "").trim();
      if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
      const u = new URL(raw);
      if (/spotify\.link$/i.test(u.hostname.replace(/^www\./, ""))) {
        const head = await fetch(raw, {
          method: "GET",
          headers: { "User-Agent": UA },
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
        });
        parsed = parseSpotifyPlaylistUrl(head.url || raw);
      }
    } catch {
      /* fall through */
    }
  }
  if (!parsed) {
    throw new Error(
      "Podaj poprawny link playlisty Spotify (open.spotify.com/playlist/…)."
    );
  }

  const scraped = await scrapeSpotifyEmbed(parsed);
  const mapped = await mapPool(scraped.entries, 4, async (entry) => {
    try {
      const apple = await matchSpotifyTrackToApple(entry);
      if (!apple) return null;
      return { ...apple, trackNumber: entry.trackNumber };
    } catch {
      return null;
    }
  });

  const tracks = mapped.filter(Boolean);
  if (!tracks.length) {
    throw new Error(
      "Nie udało się dopasować utworów Spotify do Apple Music. Spróbuj innej playlisty."
    );
  }

  return {
    playlist: {
      ...scraped.playlist,
      trackCount: tracks.length,
      matchedFromSpotify: scraped.entries.length,
    },
    tracks,
    skipped: scraped.entries.length - tracks.length,
  };
}

export function isSpotifyPlaylistUrl(input) {
  return !!parseSpotifyPlaylistUrl(input);
}
