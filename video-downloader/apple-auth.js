import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { signMoviesToken, validateLineageLogin } from "./movies-auth.js";

const DATA_DIR =
  process.env.MOVIES_DATA_DIR ||
  path.join(process.cwd(), "data", "movies-users");

const LINKS_FILE = path.join(DATA_DIR, "apple-account-links.json");
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_AUDIENCE = process.env.APPLE_BUNDLE_ID || "pl.nostalgie.eosmusic";

let jwksCache = { keys: [], fetchedAt: 0 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function b64urlDecode(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function readLinks() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(LINKS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(LINKS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeLinks(links) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), "utf8");
}

async function fetchAppleJWKS() {
  const now = Date.now();
  if (jwksCache.keys.length && now - jwksCache.fetchedAt < 60 * 60 * 1000) {
    return jwksCache;
  }
  const res = await fetch(APPLE_JWKS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Nie udało się pobrać kluczy Apple.");
  const json = await res.json();
  jwksCache = { keys: json.keys || [], fetchedAt: now };
  return jwksCache;
}

function jwkToPem(jwk) {
  const keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
  return keyObject.export({ type: "spki", format: "pem" });
}

export async function verifyAppleIdentityToken(identityToken) {
  if (!identityToken || typeof identityToken !== "string") {
    throw new Error("Brak tokenu Apple.");
  }
  const parts = identityToken.split(".");
  if (parts.length !== 3) throw new Error("Nieprawidłowy token Apple.");

  const header = JSON.parse(b64urlDecode(parts[0]).toString("utf8"));
  const payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8"));
  const signature = parts[2];

  const jwks = await fetchAppleJWKS();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Nieznany klucz Apple.");

  const pem = jwkToPem(jwk);
  const data = `${parts[0]}.${parts[1]}`;
  const ok = crypto.verify(
    "RSA-SHA256",
    Buffer.from(data),
    pem,
    b64urlDecode(signature)
  );
  if (!ok) throw new Error("Nieprawidłowy podpis tokenu Apple.");

  if (payload.iss !== APPLE_ISSUER) throw new Error("Nieprawidłowy wydawca tokenu Apple.");
  const aud = payload.aud;
  if (aud !== APPLE_AUDIENCE && aud !== process.env.APPLE_SERVICE_ID) {
    throw new Error("Nieprawidłowy odbiorca tokenu Apple.");
  }
  if (!payload.sub) throw new Error("Brak identyfikatora Apple.");
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token Apple wygasł.");
  }

  return {
    appleUserId: payload.sub,
    email: payload.email || null,
  };
}

export function findAppleLinkForUserId(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const links = readLinks();
  for (const [appleUserId, row] of Object.entries(links)) {
    if (row?.userId === uid) {
      return {
        appleUserId,
        email: row.email || null,
        login: row.login || null,
        linkedAt: row.linkedAt || null,
      };
    }
  }
  return null;
}

export async function loginOrLinkAppleAccount({
  identityToken,
  login,
  password,
  linkOnly = false,
  sessionUser = null,
}) {
  const apple = await verifyAppleIdentityToken(identityToken);
  const links = readLinks();
  const existing = links[apple.appleUserId];

  if (linkOnly) {
    let account = null;
    if (sessionUser?.userId && sessionUser?.login) {
      account = {
        userId: sessionUser.userId,
        login: sessionUser.login,
        role: sessionUser.role || "user",
      };
    } else if (login && password) {
      account = await validateLineageLogin(login, password);
    } else {
      throw new Error("Zaloguj się na konto Nostalgie™, aby powiązać Apple ID.");
    }
    // One Apple ID → one account; also replace any previous Apple link for this user.
    for (const [id, row] of Object.entries(links)) {
      if (row?.userId === account.userId && id !== apple.appleUserId) {
        delete links[id];
      }
    }
    links[apple.appleUserId] = {
      userId: account.userId,
      login: account.login,
      email: apple.email || existing?.email || null,
      linkedAt: Date.now(),
    };
    writeLinks(links);
    return {
      account,
      linked: true,
      appleEmail: links[apple.appleUserId].email,
      appleUserId: apple.appleUserId,
    };
  }

  if (existing?.userId) {
    return {
      account: {
        userId: existing.userId,
        login: existing.login,
        role: "user",
      },
      linked: true,
      appleEmail: existing.email || apple.email || null,
      appleUserId: apple.appleUserId,
    };
  }

  if (login && password) {
    const account = await validateLineageLogin(login, password);
    links[apple.appleUserId] = {
      userId: account.userId,
      login: account.login,
      email: apple.email,
      linkedAt: Date.now(),
    };
    writeLinks(links);
    return {
      account,
      linked: true,
      appleEmail: apple.email,
      appleUserId: apple.appleUserId,
    };
  }

  const err = new Error("Konto Apple nie jest powiązane. Zaloguj się loginem Nostalgie™ przy pierwszym użyciu Apple ID.");
  err.code = "APPLE_NOT_LINKED";
  throw err;
}

export function unlinkAppleAccount(appleUserId) {
  const links = readLinks();
  delete links[appleUserId];
  writeLinks(links);
}

export function appleAuthSuccessResponse(res, { account, linked, appleEmail = null, appleUserId = null }) {
  const token = signMoviesToken(account);
  res.json({
    ok: true,
    token,
    user: {
      login: account.login,
      role: account.role || "user",
      appleLinked: Boolean(linked),
      appleEmail: appleEmail || null,
      appleUserId: appleUserId || null,
    },
    appleLinked: Boolean(linked),
    expiresIn: Number(process.env.MOVIES_JWT_TTL_SEC || 60 * 60 * 24 * 30),
  });
}
