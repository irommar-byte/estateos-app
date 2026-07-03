import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MOVIES_DATA_DIR || path.join(__dirname, "data", "portal-sessions");
const VAULT_KEY =
  process.env.MOVIES_VAULT_KEY || "lineage-movies-dev-key-change-on-vps";

export const PORTALS = {
  tvp: {
    id: "tvp",
    label: "TVP VOD",
    hosts: ["tvp.pl", "vod.tvp.pl"],
    loginUrl: "https://user.tvp.pl/",
  },
  cda: {
    id: "cda",
    label: "CDA.pl",
    hosts: ["cda.pl"],
    loginUrl: "https://www.cda.pl/login",
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function sessionKeyFromReq(req) {
  const userId = req.get("X-Movies-User-Id") || req.get("x-movies-user-id");
  if (userId) {
    return crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 24);
  }
  const raw =
    req.get("X-Movies-Session") ||
    req.get("x-movies-session") ||
    req.get("cookie") ||
    "anonymous";
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export function detectPortal(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const p of Object.values(PORTALS)) {
      if (p.hosts.some((h) => host === h || host.endsWith("." + h))) return p.id;
    }
  } catch {
    /* ignore */
  }
  if (/tvp\.pl/i.test(url)) return "tvp";
  if (/cda\.pl/i.test(url)) return "cda";
  return null;
}

function sessionDir(req) {
  const dir = path.join(DATA_DIR, sessionKeyFromReq(req));
  ensureDir(dir);
  return dir;
}

function cookieFile(req, portal) {
  return path.join(sessionDir(req), `${portal}.cookies.txt`);
}

function credsFile(req, portal) {
  return path.join(sessionDir(req), `${portal}.creds.enc`);
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(VAULT_KEY, "lineage-movies", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(blob) {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = crypto.scryptSync(VAULT_KEY, "lineage-movies", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function savePortalCookies(req, portal, netscapeText) {
  let text = String(netscapeText || "").trim();
  if (!text || !PORTALS[portal]) {
    throw new Error("Nieprawidłowe ciasteczka portalu.");
  }

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.cookies || [parsed];
      text = cookiesJsonToNetscape(list, portal);
    } catch {
      throw new Error("Nie udało się odczytać JSON — wklej cookies.txt (Netscape).");
    }
  }

  if (!text.includes("\t")) {
    throw new Error(
      "Nieprawidłowy format. Użyj cookies.txt z Chrome (rozszerzenie «Get cookies.txt LOCALLY») po zalogowaniu na vod.tvp.pl."
    );
  }

  const file = cookieFile(req, portal);
  fs.writeFileSync(file, text.endsWith("\n") ? text : text + "\n", { mode: 0o600 });
  return { portal, saved: true, path: file };
}

function cookiesJsonToNetscape(list, portal) {
  const hosts =
    portal === "tvp"
      ? ["tvp.pl", "vod.tvp.pl", "user.tvp.pl", ".tvp.pl"]
      : ["cda.pl", ".cda.pl"];
  const lines = ["# Netscape HTTP Cookie File", "# Imported by NOSTALGIE Movies"];
  let count = 0;
  for (const c of list) {
    if (!c?.name || c.value === undefined) continue;
    const domain = c.domain || "";
    if (!hosts.some((h) => domain.includes(h.replace(/^\./, "")))) continue;
    const dom = domain.startsWith(".") ? domain : `.${domain}`;
    const exp = c.expirationDate
      ? Math.floor(c.expirationDate)
      : c.expires
        ? Math.floor(c.expires)
        : Math.floor(Date.now() / 1000) + 86400 * 30;
    lines.push(
      [dom, "TRUE", c.path || "/", "FALSE", String(exp), c.name, String(c.value)].join("\t")
    );
    count++;
  }
  if (!count) {
    throw new Error("Brak ciasteczek TVP/CDA w wklejonym pliku — zaloguj się na vod.tvp.pl i eksportuj ponownie.");
  }
  return lines.join("\n") + "\n";
}

export function savePortalCredentials(req, portal, email, password) {
  if (!PORTALS[portal]) throw new Error("Nieznany portal.");
  const em = String(email || "").trim();
  const pw = String(password || "");
  if (!em || !pw) throw new Error("Podaj e-mail i hasło.");
  const payload = JSON.stringify({ email: em, password: pw, savedAt: Date.now() });
  fs.writeFileSync(credsFile(req, portal), encrypt(payload), { mode: 0o600 });
  return { portal, email: em, saved: true };
}

export function getPortalCredentials(req, portal) {
  const file = credsFile(req, portal);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(decrypt(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

export function hasPortalCookies(req, portal) {
  const file = cookieFile(req, portal);
  return fs.existsSync(file) && fs.statSync(file).size > 20;
}

export function portalCookieArgs(req, url) {
  const portal = detectPortal(url);
  if (!portal || !hasPortalCookies(req, portal)) return [];
  return ["--cookies", cookieFile(req, portal)];
}

export function listPortalStatus(req) {
  const out = {};
  for (const id of Object.keys(PORTALS)) {
    const creds = getPortalCredentials(req, id);
    out[id] = {
      label: PORTALS[id].label,
      cookies: hasPortalCookies(req, id),
      credentials: creds ? { email: creds.email, savedAt: creds.savedAt } : null,
    };
  }
  return out;
}

/** TVP OAuth login (bez captcha — może wymagać ręcznego importu cookies). */
export async function tryTvpLogin(req, email, password) {
  const jar = new Map();
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  function storeCookies(res) {
    const raw = res.headers.getSetCookie?.() || [];
    for (const line of raw) {
      const part = line.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }

  async function fetchTvp(url, opts = {}) {
    const headers = {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      ...(opts.headers || {}),
    };
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(url, { ...opts, headers, redirect: "manual" });
    storeCookies(res);
    return res;
  }

  let res = await fetchTvp("https://user.tvp.pl/login.php?ref=");
  let html = await res.text();
  const refMatch = html.match(/name="ref"[^>]*value="([^"]+)"/i);
  if (!refMatch) {
    throw new Error("TVP zmieniło stronę logowania — użyj importu cookies.txt.");
  }
  const ref = refMatch[1];
  const body = new URLSearchParams({
    ref,
    email,
    password,
    action: "login",
  });
  res = await fetchTvp(`https://user.tvp.pl/login.php?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  html = await res.text();

  if (/recaptcha|g-recaptcha/i.test(html) && !/sign-out|wyloguj/i.test(html)) {
    savePortalCredentials(req, "tvp", email, password);
    throw new Error(
      "TVP wymaga captcha — hasło zapisane. Zaloguj się w Chrome na vod.tvp.pl, wyeksportuj cookies.txt i wklej w «Import cookies»."
    );
  }

  if (!/sign-out|wyloguj/i.test(html)) {
    savePortalCredentials(req, "tvp", email, password);
    if (/formularz zawiera błędy|niepoprawn/i.test(html)) {
      throw new Error("Błędny e-mail lub hasło TVP. Hasło zapisane — po poprawieniu spróbuj ponownie lub użyj cookies.txt.");
    }
    throw new Error(
      "Automatyczne logowanie TVP niedostępne. Zaloguj się w Chrome na vod.tvp.pl i wklej cookies.txt poniżej."
    );
  }

  res = await fetchTvp(
    "https://user.tvp.pl/oauth/auth_code.php?client_id=tvp-sso&redirect_uri=https%3A%2F%2Fvod.tvp.pl%2Fsubscriber%2Flogin%2Ftvp&scope=basic&response_type=code",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "approve=1" }
  );
  let location = res.headers.get("location") || "";
  if (!location && res.status >= 300 && res.status < 400) {
    location = res.headers.get("Location") || "";
  }
  const codeMatch = (location + "&").match(/code=([^&]+)/);
  if (!codeMatch) {
    throw new Error("Brak kodu SSO TVP — wklej cookies z przeglądarki.");
  }

  await fetchTvp(
    `https://vod.tvp.pl/api/subscribers/sso/tvp/login?lang=pl&platform=BROWSER&code=${codeMatch[1]}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: '{"auth":{"type":"SSO","value":"","app":"tvp"},"rememberMe":true}',
    }
  );

  const lines = [
    "# Netscape HTTP Cookie File",
    "# Generated by NOSTALGIE Movies",
  ];
  for (const [name, value] of jar.entries()) {
    for (const domain of [".tvp.pl", "vod.tvp.pl", "user.tvp.pl"]) {
      lines.push([domain, "TRUE", "/", "FALSE", "0", name, value].join("\t"));
    }
  }
  savePortalCookies(req, "tvp", lines.join("\n") + "\n");
  savePortalCredentials(req, "tvp", email, password);
  return { portal: "tvp", cookies: true, email };
}
