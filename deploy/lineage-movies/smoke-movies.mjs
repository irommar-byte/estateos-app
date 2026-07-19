#!/usr/bin/env node
/**
 * Smoke suite for Nostalgie Movies downloader (download / offline play / search split).
 * Usage (on VPS): MOVIES_JWT_SECRET=... node smoke-movies.mjs
 * Or via deploy.sh after PM2 restart.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:4321";
const JWT_SECRET = process.env.MOVIES_JWT_SECRET || "lineage-movies-jwt-prod-set-on-vps";
const LOGIN = process.env.SMOKE_LOGIN || "rommar";
const USER_ID = process.env.SMOKE_USER_ID || `player:${LOGIN}`;
const ROOT = process.env.MOVIES_ROOT || path.resolve(process.cwd(), "video-downloader");

const results = [];
const ok = (name, detail = "") => {
  results.push({ name, ok: true, detail });
  console.log(`OK  ${name}${detail ? " — " + detail : ""}`);
};
const fail = (name, detail = "") => {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}${detail ? " — " + detail : ""}`);
};
const assert = (cond, name, detail) => (cond ? ok(name, detail) : fail(name, detail));
const searchItems = (json) => json?.results || json?.items || [];

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signToken() {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub: USER_ID,
      login: LOGIN,
      role: "user",
      iat: now,
      exp: now + 3600,
      aud: "nostalgie-movies",
    })
  );
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${payload}.${sig}`;
}

async function api(method, urlPath, { body, token, timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { res, text, json };
  } catch (err) {
    const msg = err?.name === "AbortError" ? `timeout ${timeoutMs}ms` : String(err?.message || err);
    return {
      res: { ok: false, status: 0 },
      text: msg,
      json: { error: msg },
      aborted: true,
    };
  } finally {
    clearTimeout(t);
  }
}


async function ensureSmokeOfflineMovie() {
  const downloadsRoot = process.env.MUSIC_PLAYLIST_DOWNLOADS_DIR || "/home/rommar/lineage-movies/downloads";
  const dir = path.join(downloadsRoot, "MOVIES");
  fs.mkdirSync(dir, { recursive: true });
  const jobId = "00000000-smoke-test-offline-play-0001";
  const filename = "Smoke Offline Play-00000000.mp4";
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 512 * 1024) {
    const { spawnSync } = await import("node:child_process");
    const ff = spawnSync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", "2", filePath],
      { encoding: "utf8" }
    );
    if (ff.status !== 0 || !fs.existsSync(filePath) || fs.statSync(filePath).size < 512 * 1024) {
      const buf = Buffer.alloc(600 * 1024, 0);
      // ftyp isom
      buf.writeUInt32BE(20, 0);
      buf.write("ftyp", 4);
      buf.write("isom", 8);
      fs.writeFileSync(filePath, buf);
    }
  }
  const userKey = crypto.createHash("sha256").update(USER_ID).digest("hex").slice(0, 24);
  const libPath = path.join(ROOT, "data/movies-library", `${userKey}.json`);
  let store = { downloads: [] };
  try {
    store = JSON.parse(fs.readFileSync(libPath, "utf8"));
  } catch {
    /* empty */
  }
  if (!Array.isArray(store.downloads)) store.downloads = [];
  const url = "https://smoke.local/offline-play-test";
  const entry = {
    url,
    title: "Smoke Offline Play",
    thumbnail: "",
    source: "smoke",
    downloadJobId: jobId,
    filename,
    downloadedAt: Date.now(),
  };
  const idx = store.downloads.findIndex((d) => d.url === url);
  if (idx >= 0) store.downloads[idx] = entry;
  else store.downloads.unshift(entry);
  // Repair any wiped job ids that still have filename hints — leave other entries intact.
  fs.mkdirSync(path.dirname(libPath), { recursive: true });
  fs.writeFileSync(libPath, JSON.stringify(store) + "\n", { mode: 0o600 });
  return entry;
}

const token = signToken();
await ensureSmokeOfflineMovie();


{
  const { res, json } = await api("GET", "/api/health", { timeoutMs: 5000 });
  assert(res.ok && json?.ok, "health", JSON.stringify(json));
}

let filmUrl = null;
{
  const { res, json } = await api("GET", "/api/cda-hd/latest?limit=12", { timeoutMs: 90000 });
  const items = searchItems(json);
  assert(res.ok && items.length > 0, "cda-hd/latest", `items=${items.length}`);
  filmUrl = items.find((i) => !i.isSerial)?.url || items[0]?.url;
  const seriesUrl = items.find((i) => i.isSerial)?.url;
  assert(!!filmUrl, "cda-hd film url");
  assert(!!seriesUrl, "cda-hd series url", seriesUrl ? seriesUrl.slice(0, 70) : "none");
}

{
  const { res, json } = await api("POST", "/api/search", {
    body: { query: "love", source: "all", page: 1, pageSize: 24 },
    timeoutMs: 35000,
  });
  const items = searchItems(json);
  const sources = [...new Set(items.map((i) => i.source || "?"))];
  const hasApple = items.some((i) => String(i.source || "").toLowerCase().includes("apple"));
  assert(res.ok && items.length > 0, "search all", `n=${items.length} sources=${sources.join(",")} err=${json?.error || ""}`);
  assert(!hasApple, "search all excludes apple-music");
}

{
  const { res, json } = await api("POST", "/api/search", {
    body: { query: "sherlock", source: "cda-hd", page: 1, pageSize: 12 },
    timeoutMs: 30000,
  });
  assert(res.ok && searchItems(json).length > 0, "search cda-hd", `n=${searchItems(json).length}`);
}

{
  const { res, json } = await api("POST", "/api/search", {
    body: { query: "paradise", source: "apple-music", page: 1, pageSize: 6 },
    timeoutMs: 30000,
  });
  if (res.ok && searchItems(json).length > 0) ok("search apple-music", `n=${searchItems(json).length}`);
  else fail("search apple-music", JSON.stringify(json)?.slice(0, 120) || "empty");
}

{
  const { res, json } = await api("GET", "/api/favorites", { token, timeoutMs: 15000 });
  const items = searchItems(json);
  assert(res.ok, "favorites", `n=${items.length}`);
  const music = items.filter((i) => i.type === "music" || String(i.source || "").includes("apple"));
  const video = items.filter((i) => !(i.type === "music" || String(i.source || "").includes("apple")));
  ok("favorites split", `music=${music.length} video=${video.length}`);
}

let sampleDownload = null;
{
  const { res, json } = await api("GET", "/api/movies/downloads", { token, timeoutMs: 15000 });
  const downloads = (json?.downloads || []).filter((d) => d.downloadJobId);
  assert(res.ok, "movies/downloads http", res.ok ? `n=${downloads.length}` : JSON.stringify(json));
  assert(downloads.length > 0, "movies/downloads nonempty", `n=${downloads.length}`);
  sampleDownload = downloads[0] || null;
}

if (sampleDownload?.downloadJobId) {
  const jobId = sampleDownload.downloadJobId;
  const { res, json } = await api("GET", `/api/movies/play-token/${jobId}`, { token, timeoutMs: 15000 });
  assert(res.ok && json?.token, "movies/play-token");
  if (json?.token) {
    const stream = await fetch(`${BASE}/api/movies/stream/${jobId}?token=${encodeURIComponent(json.token)}`, {
      headers: { Range: "bytes=0-2047" },
      signal: AbortSignal.timeout(20000),
    });
    const buf = Buffer.from(await stream.arrayBuffer());
    assert(stream.status === 206 || stream.status === 200, "movies/stream", `HTTP ${stream.status} ${buf.length}B`);
  }

  const dl = await api("POST", "/api/download", {
    token,
    body: {
      url: sampleDownload.url,
      title: sampleDownload.title || "smoke",
      thumbnail: sampleDownload.thumbnail || "",
      source: sampleDownload.source || "smoke",
      kind: "video",
      container: "mp4",
      height: 720,
    },
    timeoutMs: 30000,
  });
  assert(dl.res.ok && dl.json?.jobId, "download reuse start", `reused=${!!dl.json?.reused} ready=${!!dl.json?.ready}`);
  assert(dl.json?.reused === true && dl.json?.ready === true, "download reuse ready flags");
  const st = await api("GET", `/api/job/${dl.json.jobId}`, { token, timeoutMs: 10000 });
  assert(st.res.ok && (st.json?.ready === true || st.json?.status === "done"), "download job restored", JSON.stringify(st.json));
} else {
  fail("movies offline play suite", "skipped — brak pobrań");
}

{
  // Prefer a YouTube URL for live info/preview — CDA-HD info depends on Cloudflare.
  let probeUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // me at the zoo (short)
  const yt = await api("POST", "/api/search", {
    body: { query: "me at the zoo", source: "youtube", page: 1, pageSize: 3 },
    timeoutMs: 20000,
  });
  if (searchItems(yt.json)[0]?.url) probeUrl = searchItems(yt.json)[0].url;

  const info = await api("POST", "/api/info", { body: { url: probeUrl }, timeoutMs: 90000 });
  if (info.res.ok && info.json?.title) {
    ok("info film", String(info.json.title).slice(0, 60));
  } else {
    fail("info film", JSON.stringify(info.json)?.slice(0, 120) || "failed");
  }

  const prev = await api("POST", "/api/preview", { body: { url: probeUrl, height: 720 }, timeoutMs: 90000 });
  if (!(prev.res.ok && prev.json?.jobId)) {
    fail("preview start", JSON.stringify(prev.json)?.slice(0, 120) || "failed");
  } else {
    ok("preview start", `job=${prev.json.jobId}`);
    let ready = false;
    let last = null;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const st = await api("GET", `/api/job/${prev.json.jobId}`, { timeoutMs: 10000 });
      last = st.json;
      if (st.json?.status === "error") break;
      if (st.json?.ready || st.json?.status === "done") {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    assert(ready, "preview ready", last ? `status=${last.status} progress=${last.progress}` : "timeout");
    if (ready) {
      const tok = await api("GET", `/api/play-token/${prev.json.jobId}`, { timeoutMs: 10000 });
      assert(tok.res.ok && tok.json?.token, "preview play-token");
      if (tok.json?.token) {
        const play = await fetch(`${BASE}/api/play/${prev.json.jobId}?token=${encodeURIComponent(tok.json.token)}`, {
          headers: { Range: "bytes=0-1023" },
          signal: AbortSignal.timeout(25000),
          redirect: "manual",
        });
        assert(
          play.status === 206 || play.status === 200 || (play.status >= 300 && play.status < 400),
          "preview play",
          `HTTP ${play.status}`
        );
      }
    }
  }
}

{
  const { res, json } = await api("GET", "/api/music/library", { token, timeoutMs: 15000 });
  assert(res.ok, "music/library", `folders=${(json?.folders || []).length} tracks=${(json?.tracks || []).length}`);
  const offline = (json?.tracks || []).filter((t) => t.downloadJobId);
  ok("music offline tracks", `n=${offline.length}`);
  if (offline[0]?.downloadJobId) {
    const pt = await api("GET", `/api/music/play-token/${offline[0].downloadJobId}`, { token, timeoutMs: 15000 });
    if (pt.res.ok && pt.json?.token) {
      const stream = await fetch(
        `${BASE}/api/music/stream/${offline[0].downloadJobId}?token=${encodeURIComponent(pt.json.token)}`,
        { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(20000) }
      );
      const buf = Buffer.from(await stream.arrayBuffer());
      assert(stream.status === 206 || stream.status === 200, "music/stream offline", `HTTP ${stream.status} ${buf.length}B`);
    } else {
      fail("music/play-token offline", JSON.stringify(pt.json));
    }
  }
}

const failed = results.filter((r) => !r.ok);
console.log("\n=== SUMMARY ===");
console.log(`passed=${results.length - failed.length} failed=${failed.length} total=${results.length}`);
if (failed.length) {
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  process.exit(1);
}
process.exit(0);
