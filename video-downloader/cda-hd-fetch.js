/**
 * Odporny fetch CDA-HD za Cloudflare:
 * 1) zwykły fetch z zapisaną sesją (cf_clearance)
 * 2) przy challenge — FlareSolverr (Docker), potem zapis cookies
 * 3) mutex, żeby nie odpalać wielu solve naraz
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CDA_HD_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FLARESOLVERR_URL = (process.env.FLARESOLVERR_URL || "http://127.0.0.1:8191").replace(/\/$/, "");
const SESSION_PATH =
  process.env.CDA_HD_SESSION_PATH || path.join(__dirname, "data", "cda-hd-session.json");
const SESSION_MAX_AGE_MS = Number(process.env.CDA_HD_SESSION_MAX_AGE_MS) || 6 * 60 * 60 * 1000;
const FLARE_TIMEOUT_MS = Number(process.env.CDA_HD_FLARE_TIMEOUT_MS) || 120_000;

/** @type {{ cookies: Array<{name:string,value:string,domain?:string}>, userAgent: string, updatedAt: number }} */
let session = { cookies: [], userAgent: DEFAULT_CDA_HD_UA, updatedAt: 0 };
let sessionLoaded = false;
/** @type {Promise<void> | null} */
let solveLock = null;

function ensureSessionDir() {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
}

function loadSession() {
  if (sessionLoaded) return;
  sessionLoaded = true;
  try {
    if (!fs.existsSync(SESSION_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") return;
    session = {
      cookies: Array.isArray(parsed.cookies) ? parsed.cookies : [],
      userAgent: String(parsed.userAgent || DEFAULT_CDA_HD_UA),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch (err) {
    console.warn("cda-hd session load:", err?.message || err);
  }
}

function saveSession() {
  ensureSessionDir();
  const tmp = `${SESSION_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        cookies: session.cookies,
        userAgent: session.userAgent,
        updatedAt: session.updatedAt,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.renameSync(tmp, SESSION_PATH);
}

function isAllowedCdaHdResultUrl(url) {
  try {
    const u = new URL(url);
    if (/^chrome:/i.test(u.protocol)) return false;
    return /(?:^|\.)cda-hd\.(?:cc|pl|to|online|info)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function hasCdaHdPageSignals(html) {
  const body = String(html || "");
  return (
    /property="og:title"/i.test(body) ||
    /class="(?:se-c|item)"|numerando|typepost|enlaces|player\.cda-hd|ogladaj\.me|playmogo|\/episode\//i.test(
      body
    ) ||
    (/cda-hd/i.test(body) && body.length > 8000)
  );
}

function isValidCdaHdHtml(html, finalUrl = "") {
  const body = String(html || "");
  const url = String(finalUrl || "");
  if (!body || body.length < 800) return false;
  if (/^chrome:/i.test(url) || /new-tab-page/i.test(url)) return false;
  if (url && !isAllowedCdaHdResultUrl(url)) return false;
  if (/<title>\s*New Tab/i.test(body)) return false;
  // Interstitial bez treści serwisu.
  if (isCloudflareChallenge(body, 200) && !hasCdaHdPageSignals(body)) return false;
  // FlareSolverr czasem ustawia <title>(1) New Message!</title> — treść strony i tak jest OK.
  return hasCdaHdPageSignals(body) || /cda-hd/i.test(body);
}

export function isCloudflareChallenge(html, status = 200) {
  const text = String(html || "");
  if (status === 403 || status === 503) {
    if (!text || /Just a moment|cf-browser-verification|challenge-platform|cf-mitigated|Attention Required/i.test(text)) {
      return true;
    }
  }
  if (!text) return false;
  // Klasyczny interstitial Cloudflare — nie mylić z realnymi stronami, które ładują skrypty cdn-cgi.
  if (/Just a moment\.\.\./i.test(text)) return true;
  if (/cf-browser-verification/i.test(text)) return true;
  if (/Attention Required!\s*\|\s*Cloudflare/i.test(text)) return true;
  if (/Enable JavaScript and cookies/i.test(text) && /challenge-platform|cf-browser/i.test(text) && !hasCdaHdPageSignals(text)) {
    return true;
  }
  if (/cdn-cgi\/challenge-platform/i.test(text) && !hasCdaHdPageSignals(text)) {
    return true;
  }
  return false;
}

function cookieHeader(cookies) {
  if (!Array.isArray(cookies) || !cookies.length) return "";
  const map = new Map();
  for (const c of cookies) {
    if (!c?.name) continue;
    map.set(c.name, c.value ?? "");
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function mergeCookies(existing, incoming) {
  const map = new Map();
  for (const c of existing || []) {
    if (c?.name) map.set(c.name, c);
  }
  for (const c of incoming || []) {
    if (c?.name) map.set(c.name, { name: c.name, value: c.value ?? "", domain: c.domain });
  }
  return [...map.values()];
}

function browserHeaders(url, { userAgent, cookie } = {}) {
  const headers = {
    "User-Agent": userAgent || DEFAULT_CDA_HD_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
  if (cookie) headers.Cookie = cookie;
  try {
    const u = new URL(url);
    headers.Referer = `${u.origin}/`;
  } catch {
    /* ignore */
  }
  return headers;
}

async function plainFetchHtml(pageUrl) {
  loadSession();
  const cookie = cookieHeader(session.cookies);
  const res = await fetch(pageUrl, {
    headers: browserHeaders(pageUrl, { userAgent: session.userAgent, cookie }),
    redirect: "follow",
  });
  const html = await res.text();
  return { html, finalUrl: res.url || pageUrl, status: res.status };
}

async function flareSolverrGet(pageUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FLARE_TIMEOUT_MS + 10_000);
  try {
    const res = await fetch(`${FLARESOLVERR_URL}/v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: pageUrl,
        maxTimeout: FLARE_TIMEOUT_MS,
      }),
      signal: controller.signal,
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`FlareSolverr zwrócił nie-JSON (HTTP ${res.status}).`);
    }
    if (!res.ok || data.status !== "ok" || !data.solution) {
      throw new Error(data.message || `FlareSolverr błąd (HTTP ${res.status}).`);
    }
    const sol = data.solution;
    const html = String(sol.response || "");
    const status = Number(sol.status) || 0;
    const finalUrl = sol.url || pageUrl;
    const challenge = isCloudflareChallenge(html, status);
    const valid = isValidCdaHdHtml(html, finalUrl);
    // FlareSolverr bywa zostawia skrypty challenge-platform w DOM już „odblokowanej” strony.
    if (challenge && !valid) {
      throw new Error("Cloudflare nadal blokuje po FlareSolverr — spróbuj ponownie.");
    }
    if (!valid) {
      throw new Error(
        `FlareSolverr zwrócił nieprawidłową stronę (${finalUrl || "brak URL"}). Restart flaresolverr lub spróbuj ponownie.`
      );
    }
    if (challenge && valid) {
      console.warn("cda-hd: FlareSolverr HTML z markerami CF, ale treść strony OK — akceptuję");
    }
    return {
      html,
      finalUrl,
      status: status || 200,
      cookies: Array.isArray(sol.cookies) ? sol.cookies : [],
      userAgent: sol.userAgent || DEFAULT_CDA_HD_UA,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("FlareSolverr przekroczył limit czasu przy rozwiązywaniu Cloudflare.");
    }
    if (err?.cause?.code === "ECONNREFUSED" || /fetch failed|ECONNREFUSED/i.test(String(err?.message))) {
      throw new Error(
        `FlareSolverr niedostępny (${FLARESOLVERR_URL}). Uruchom kontener flaresolverr na VPS.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function withSolveLock(fn) {
  while (solveLock) {
    try {
      await solveLock;
    } catch {
      /* ignore previous failure; retry ourselves */
    }
  }
  let release;
  solveLock = new Promise((resolve) => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    solveLock = null;
    release();
  }
}

async function applySolvedSession(solved) {
  session = {
    cookies: mergeCookies(session.cookies, solved.cookies || []),
    userAgent: solved.userAgent || session.userAgent || DEFAULT_CDA_HD_UA,
    updatedAt: Date.now(),
  };
  saveSession();
}

async function flareSolveOnce(pageUrl) {
  console.warn("cda-hd: Cloudflare challenge — solve via FlareSolverr", pageUrl);
  try {
    return await flareSolverrGet(pageUrl);
  } catch (err) {
    console.warn("cda-hd flaresolverr retry:", err?.message || err);
    await new Promise((r) => setTimeout(r, 2000));
    return await flareSolverrGet(pageUrl);
  }
}

async function refreshSessionViaFlare(pageUrl) {
  return withSolveLock(async () => {
    loadSession();
    if (session.cookies.length && Date.now() - session.updatedAt < 45_000) {
      const probe = await plainFetchHtml(pageUrl);
      if (
        !isCloudflareChallenge(probe.html, probe.status) &&
        probe.status >= 200 &&
        probe.status < 400 &&
        isValidCdaHdHtml(probe.html, probe.finalUrl)
      ) {
        return probe;
      }
    }

    const homeUrl = "https://cda-hd.cc/";
    const targetIsHome = pageUrl.replace(/\/$/, "") === homeUrl.replace(/\/$/, "");

    // Jedno solve na request: jeśli nie ma cookies — home; inaczej od razu target.
    // Unikamy podwójnego Flare (home+target), które zabija limity ~110s.
    try {
      if (!session.cookies.length && !targetIsHome) {
        const homeSolved = await flareSolveOnce(homeUrl);
        await applySolvedSession(homeSolved);
        const viaCookies = await plainFetchHtml(pageUrl);
        if (
          !isCloudflareChallenge(viaCookies.html, viaCookies.status) &&
          viaCookies.status >= 200 &&
          viaCookies.status < 400 &&
          isValidCdaHdHtml(viaCookies.html, viaCookies.finalUrl)
        ) {
          console.warn("cda-hd: target OK po clearance home");
          return viaCookies;
        }
        // Cookies bywają niewystarczające — jeden solve targetu (bez ponownego home).
      }
    } catch (err) {
      console.warn("cda-hd home-first:", err?.message || err);
    }

    const solved = await flareSolveOnce(pageUrl);
    await applySolvedSession(solved);
    return { html: solved.html, finalUrl: solved.finalUrl, status: solved.status };
  });
}

/**
 * Pobiera HTML strony CDA-HD z automatycznym ominięciem Cloudflare.
 * @param {string} pageUrl
 * @returns {Promise<{ html: string, finalUrl: string }>}
 */
export async function fetchCdaHdHtmlResilient(pageUrl) {
  if (!pageUrl) throw new Error("Brak URL CDA-HD.");
  loadSession();

  const sessionFresh = session.cookies.length > 0 && Date.now() - session.updatedAt < SESSION_MAX_AGE_MS;

  if (sessionFresh || session.cookies.length) {
    try {
      const first = await plainFetchHtml(pageUrl);
      if (
        !isCloudflareChallenge(first.html, first.status) &&
        first.status >= 200 &&
        first.status < 400 &&
        isValidCdaHdHtml(first.html, first.finalUrl)
      ) {
        if (!sessionFresh) {
          session.updatedAt = Date.now();
          saveSession();
        }
        return { html: first.html, finalUrl: first.finalUrl };
      }
      // Nie kasuj cookies na dysku przed Flare — inaczej równoległy request
      // startuje bez clearance. Nadpiszemy sesję dopiero po udanym solve.
      if (session.cookies.length) {
        console.warn("cda-hd: sesja Cloudflare nieważna — odświeżam przez FlareSolverr");
      }
    } catch (err) {
      console.warn("cda-hd plain fetch:", err?.message || err);
    }
  }

  const solved = await refreshSessionViaFlare(pageUrl);
  if (isCloudflareChallenge(solved.html, solved.status) || solved.status >= 400) {
    throw new Error(`Nie udało się otworzyć strony CDA-HD (${solved.status || "challenge"}).`);
  }
  return { html: solved.html, finalUrl: solved.finalUrl };
}

export function getCdaHdSessionInfo() {
  loadSession();
  return {
    cookieCount: session.cookies.length,
    hasClearance: session.cookies.some((c) => c.name === "cf_clearance"),
    userAgent: session.userAgent,
    updatedAt: session.updatedAt,
    flaresolverrUrl: FLARESOLVERR_URL,
  };
}

let keeperTimer = null;

/** Odświeża cf_clearance w tle, żeby katalog TV nie padał po wygaśnięciu cookies. */
export function startCdaHdSessionKeeper(baseUrl = "https://cda-hd.cc/") {
  if (keeperTimer) return;
  const tick = async () => {
    try {
      loadSession();
      const age = Date.now() - (session.updatedAt || 0);
      // Odśwież zanim sesja padnie (domyślnie co ~2.5h albo gdy brak clearance).
      if (!session.cookies.some((c) => c.name === "cf_clearance") || age > SESSION_MAX_AGE_MS * 0.45) {
        await fetchCdaHdHtmlResilient(baseUrl);
        console.warn("cda-hd keeper: sesja odświeżona");
      }
    } catch (err) {
      console.warn("cda-hd keeper:", err?.message || err);
    }
  };
  keeperTimer = setInterval(tick, 20 * 60 * 1000);
  if (typeof keeperTimer.unref === "function") keeperTimer.unref();
  setTimeout(tick, 15_000);
}
