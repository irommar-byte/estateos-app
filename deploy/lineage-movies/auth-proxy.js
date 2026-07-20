import express from "express";
import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { verifyMoviesToken } from "./video-downloader/movies-auth.js";

const PORT = Number(process.env.MOVIES_AUTH_PROXY_PORT || 4322);
const DOWNLOADER = (process.env.MOVIES_DOWNLOADER_URL || "http://127.0.0.1:4321").replace(/\/$/, "");
const ADMIN_CHECK =
  process.env.LINEAGE_AUTH_CHECK_URL ||
  "http://192.168.50.200/admin_pro/get_logs.php";
const USER_PANEL_CHECK =
  process.env.LINEAGE_USER_PANEL_URL || "http://192.168.50.200/panel.php";

const app = express();
app.use(express.raw({ type: () => true, limit: "64mb" }));

function hashCookie(cookie) {
  return crypto.createHash("sha256").update(cookie || "").digest("hex");
}

function normalizeLogin(name) {
  const login = String(name || "").trim().toLowerCase();
  if (!login || !/^[a-z0-9_]{2,32}$/.test(login)) return null;
  const stop = new Set([
    "admin",
    "built",
    "by",
    "coins",
    "filmy",
    "legacy",
    "login",
    "logout",
    "movies",
    "muzyka",
    "nc",
    "nostalgie",
    "panel",
    "players",
    "premium",
    "preserved",
    "ranking",
    "register",
    "swiat",
    "wspieram",
    "wyloguj",
    "zglos",
  ]);
  if (stop.has(login)) return null;
  if (/logowanie|undefined|hasło|password|dołącz/i.test(login)) return null;
  return login;
}

function extractUserLogin(html) {
  const patterns = [
    /data-account="([^"]+)"/i,
    /data-login="([^"]+)"/i,
    /data-user="([^"]+)"/i,
    /data-user-login="([^"]+)"/i,
    /name="login"\s+value="([^"]+)"/i,
    /(?:Witaj|Hello|Konto|Account|Gracz)[,:]?\s*<[^>]+>\s*([^<]{2,48})\s*</i,
    /(?:Witaj|Hello|Konto|Account|Gracz)[:\s]+([A-Za-z0-9_]{2,32})/i,
    /class="[^"]*account[^"]*"[^>]*>\s*([^<]+)/i,
    /player-account[^>]*>\s*([^<]+)/i,
    /nc-user[^>]*>\s*([^<]+)/i,
    /"login"\s*:\s*"([^"]+)"/i,
    /'login'\s*=>\s*'([^']+)'/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m?.[1]) continue;
    const login = normalizeLogin(m[1]);
    if (login) return login;
  }
  return null;
}

function loginAppearsInPanel(html, login) {
  if (!login) return false;
  const safe = login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${safe}\\b`, "i").test(html);
}

function isLoginRedirect(html) {
  return /window\.location(?:\.href)?\s*=\s*['"]\/?login\.php/i.test(html);
}

async function checkAdminSession(cookie, req) {
  try {
    const res = await fetch(ADMIN_CHECK, {
      headers: {
        cookie,
        "x-forwarded-for": req.headers["x-forwarded-for"] || req.ip || "",
      },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    if (/"error"\s*:\s*"unauthorized"/i.test(text)) return null;
    return { userId: `admin:${hashCookie(cookie)}`, role: "admin" };
  } catch {
    return null;
  }
}

async function fetchUserPanelHtml(cookie, req) {
  const res = await fetch(USER_PANEL_CHECK, {
    headers: {
      cookie,
      "x-forwarded-for": req.headers["x-forwarded-for"] || req.ip || "",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  return res.text();
}

async function checkUserPanelSession(cookie, req) {
  try {
    const html = await fetchUserPanelHtml(cookie, req);
    if (isLoginRedirect(html)) return null;

    const clientLogin = normalizeLogin(
      req.headers["x-movies-user-login"] || req.headers["X-Movies-User-Login"] || ""
    );
    const htmlLogin = extractUserLogin(html);
    let login = htmlLogin;
    if (!login && clientLogin && loginAppearsInPanel(html, clientLogin)) {
      login = clientLogin;
    }
    // iframe przekazuje ncLogin= — ufaj mu przy aktywnej sesji panelu
    if (!login && clientLogin && html.length > 4000 && !isLoginRedirect(html)) {
      login = clientLogin;
    }
    if (login) return { userId: `player:${login}`, login, role: "user" };

    if (html.length > 4000 && !/Nostalgie™Gate|Kontrola Bezpieczeństwa/i.test(html)) {
      return { userId: `session:${hashCookie(cookie)}`, role: "user" };
    }
    return null;
  } catch {
    return null;
  }
}

function authFromBearer(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const data = verifyMoviesToken(m[1].trim());
    return {
      authorized: true,
      userId: data.sub,
      login: data.login || String(data.sub).replace(/^player:/, ""),
      role: data.role || "user",
    };
  } catch {
    return null;
  }
}

async function resolveAuth(req) {
  const bearer = authFromBearer(req);
  if (bearer) return bearer;

  const cookie = req.headers.cookie || "";
  if (!cookie) return null;
  const user = await checkUserPanelSession(cookie, req);
  if (user) return { authorized: true, ...user };
  const admin = await checkAdminSession(cookie, req);
  if (admin) return { authorized: true, ...admin };
  return null;
}

function isTokenizedPlay(req) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const raw = req.originalUrl || req.url || "";
  const tokenizedPath =
    raw.includes("/api/play/") || raw.includes("/api/music/stream/");
  if (!tokenizedPath) return false;
  try {
    const u = new URL(raw, "http://movies.local");
    return !!u.searchParams.get("token");
  } catch {
    return false;
  }
}

function isPublicPath(req) {
  const raw = req.path || req.originalUrl || req.url || "";
  if (req.method === "POST" && raw.includes("/api/auth/login")) return true;
  if (req.method === "GET" && (raw.includes("/api/cda-hd/latest") || raw.includes("/api/films/home") || raw.includes("/api/thumb"))) {
    return true;
  }
  return false;
}

function upstreamRequest(targetUrl, req, res, extraHeaders = {}) {
  const parsed = new URL(targetUrl);
  const lib = parsed.protocol === "https:" ? https : http;

  const headers = { ...req.headers, ...extraHeaders, connection: "close" };
  if (!headers["x-forwarded-host"] && req.headers.host) {
    headers["x-forwarded-host"] = req.headers.host;
  }
  if (!headers["x-forwarded-proto"]) {
    headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "https";
  }
  delete headers["content-length"];

  const upstream = lib.request(
    {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers,
      timeout: 0,
    },
    (upRes) => {
      res.status(upRes.statusCode || 502);
      for (const [k, v] of Object.entries(upRes.headers)) {
        if (k.toLowerCase() === "transfer-encoding") continue;
        if (v !== undefined) res.setHeader(k, v);
      }
      upRes.pipe(res);
    }
  );

  // Długie streamy MP4/HLS — bez domyślnych timeoutów socketa.
  upstream.setTimeout(0);
  try {
    req.setTimeout?.(0);
    res.setTimeout?.(0);
  } catch {
    /* ignore */
  }

  upstream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: "Movies service unavailable", detail: err.message });
    }
  });

  if (req.method !== "GET" && req.method !== "HEAD" && req.body?.length) {
    upstream.write(req.body);
  }
  upstream.end();
}

app.all("/admin_pro/api/movies/proxy/*", async (req, res) => {
  const tokenPlay = isTokenizedPlay(req);
  const publicPath = isPublicPath(req);
  const auth = tokenPlay || publicPath
    ? { authorized: true, userId: null, role: publicPath ? "login" : "play" }
    : await resolveAuth(req);

  if (!auth?.authorized) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const prefix = "/admin_pro/api/movies/proxy";
  const subPath = req.path.startsWith(prefix)
    ? req.path.slice(prefix.length).replace(/^\//, "")
    : req.path.replace(/^\//, "");
  const targetUrl = `${DOWNLOADER}/${subPath}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

  const extra = {
    ...(auth.userId ? { "X-Movies-User-Id": auth.userId } : {}),
    ...(auth.login ? { "X-Movies-User-Login": auth.login } : {}),
    ...(!tokenPlay && auth.authorized ? { "X-Movies-Authorized": "1" } : {}),
    "X-Movies-Public-Prefix": "/admin_pro/api/movies/proxy",
    "X-Movies-Session": hashCookie(req.headers.cookie || auth.userId || ""),
  };
  if (req.headers.authorization) {
    extra.Authorization = req.headers.authorization;
  }
  upstreamRequest(targetUrl, req, res, extra);
});

app.get("/admin_pro/api/movies/health", async (req, res) => {
  if (!(await resolveAuth(req))?.authorized) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({ ok: true, service: "lineage-movies-auth-proxy" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`lineage movies auth-proxy on 127.0.0.1:${PORT} → ${DOWNLOADER}`);
});
