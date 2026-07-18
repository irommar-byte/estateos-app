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
const FLARE_TIMEOUT_MS = Number(process.env.CDA_HD_FLARE_TIMEOUT_MS) || 90_000;

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

export function isCloudflareChallenge(html, status = 200) {
  if (status === 403 || status === 503) {
    const body = String(html || "");
    if (!body || /Just a moment|cf-browser-verification|challenge-platform|cf-mitigated|Attention Required/i.test(body)) {
      return true;
    }
  }
  const text = String(html || "");
  if (!text) return false;
  return (
    /Just a moment\.\.\./i.test(text) ||
    /cf-browser-verification/i.test(text) ||
    /cdn-cgi\/challenge-platform/i.test(text) ||
    (/challenge-platform/i.test(text) && /Enable JavaScript and cookies/i.test(text))
  );
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
    if (isCloudflareChallenge(html, status)) {
      throw new Error("Cloudflare nadal blokuje po FlareSolverr — spróbuj ponownie.");
    }
    return {
      html,
      finalUrl: sol.url || pageUrl,
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

async function refreshSessionViaFlare(pageUrl) {
  return withSolveLock(async () => {
    loadSession();
    if (session.cookies.length && Date.now() - session.updatedAt < 30_000) {
      const probe = await plainFetchHtml(pageUrl);
      if (!isCloudflareChallenge(probe.html, probe.status) && probe.status >= 200 && probe.status < 400) {
        return probe;
      }
    }

    console.warn("cda-hd: Cloudflare challenge — solve via FlareSolverr");
    const solved = await flareSolverrGet(pageUrl);
    session = {
      cookies: mergeCookies(session.cookies, solved.cookies),
      userAgent: solved.userAgent || session.userAgent || DEFAULT_CDA_HD_UA,
      updatedAt: Date.now(),
    };
    saveSession();
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
      if (!isCloudflareChallenge(first.html, first.status) && first.status >= 200 && first.status < 400) {
        if (!sessionFresh) {
          session.updatedAt = Date.now();
          saveSession();
        }
        return { html: first.html, finalUrl: first.finalUrl };
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
