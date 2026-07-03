import crypto from "node:crypto";

const JWT_SECRET =
  process.env.MOVIES_JWT_SECRET ||
  process.env.MOVIES_VAULT_KEY ||
  "lineage-movies-dev-jwt-change-on-vps";

const JWT_TTL_SEC = Number(process.env.MOVIES_JWT_TTL_SEC || 60 * 60 * 24 * 30);

const LINEAGE_LOGIN_URL =
  process.env.LINEAGE_LOGIN_URL || "http://192.168.50.200/login.php";
const LINEAGE_USER_PANEL_URL =
  process.env.LINEAGE_USER_PANEL_URL || "http://192.168.50.200/panel.php";

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signMoviesToken({ userId, login, role = "user" }) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      login,
      role,
      iat: now,
      exp: now + JWT_TTL_SEC,
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

export function verifyMoviesToken(token) {
  if (!token || typeof token !== "string") throw new Error("Brak tokenu.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Nieprawidłowy token.");
  const [header, payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (sig !== expected) throw new Error("Nieprawidłowy podpis tokenu.");
  const data = JSON.parse(b64urlDecode(payload).toString("utf8"));
  if (data.aud && data.aud !== "nostalgie-movies") throw new Error("Nieprawidłowy token.");
  if (!data.sub || !data.exp) throw new Error("Nieprawidłowy token.");
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error("Token wygasł — zaloguj się ponownie.");
  return data;
}

function parseSetCookies(res) {
  const jar = new Map();
  const raw = res.headers.getSetCookie?.() || [];
  for (const line of raw) {
    const part = line.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function isLoginRedirect(html) {
  return /window\.location(?:\.href)?\s*=\s*['"]\/?login\.php/i.test(html);
}

/** Validate Nostalgie Legacy game account (login.php → panel.php). */
export async function validateLineageLogin(login, password) {
  const name = String(login || "").trim();
  const pass = String(password || "");
  if (!name || !pass) throw new Error("Podaj login i hasło.");

  const loginRes = await fetch(LINEAGE_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ login: name, password: pass }),
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });

  const loginHtml = await loginRes.text();
  if (/n-msg-error|niepoprawn|błęd/i.test(loginHtml)) {
    throw new Error("Niepoprawny login lub hasło.");
  }

  const jar = parseSetCookies(loginRes);
  const cookie = cookieHeader(jar);
  if (!cookie) throw new Error("Nie udało się nawiązać sesji — spróbuj ponownie.");

  const panelRes = await fetch(LINEAGE_USER_PANEL_URL, {
    headers: { cookie },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  const panelHtml = await panelRes.text();
  if (isLoginRedirect(panelHtml)) {
    throw new Error("Niepoprawny login lub hasło.");
  }

  const normalized = name.toLowerCase();
  return {
    userId: `player:${normalized}`,
    login: normalized,
    role: "user",
  };
}

export function authUserFromRequest(req) {
  const auth = req.get("Authorization") || req.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const data = verifyMoviesToken(m[1].trim());
    return {
      userId: data.sub,
      login: data.login || data.sub.replace(/^player:/, ""),
      role: data.role || "user",
    };
  } catch {
    return null;
  }
}

export function applyAuthToRequest(req, user) {
  if (!user?.userId) return;
  req.headers["x-movies-user-id"] = user.userId;
}
