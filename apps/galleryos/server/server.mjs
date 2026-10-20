import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const jsonType = "application/json; charset=utf-8";

export function createServer(options = {}) {
  const root = path.resolve(options.root || process.env.GALLERYOS_LIBRARY || path.join(process.cwd(), "library"));
  const user = options.user || process.env.GALLERYOS_USER || "gallery";
  const password = options.password || process.env.GALLERYOS_PASSWORD || "galleryos";
  fs.mkdirSync(root, { recursive: true });
  const tokens = new Map(Object.entries(readJSON(path.join(root, "state", "tokens.json"), {})));
  const uploads = new Map();

  function send(res, status, body, type = jsonType) {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    res.writeHead(status, { "Content-Type": type, "Content-Length": payload.length });
    res.end(payload);
  }

  function safePath(relative) {
    const parts = String(relative || "").split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === "..")) return null;
    return path.join(root, ...parts);
  }

  function auth(req) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    return tokens.has(token);
  }

  async function body(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("Za duży plik.");
        error.status = 413;
        throw error;
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  function indexJournal(relative) {
    const file = safePath(relative);
    if (!file || !fs.existsSync(file)) return;
    const seenFile = path.join(root, "state", "seen.json");
    const seen = new Set(readJSON(seenFile, []));
    const feed = path.join(root, "state", "feed.jsonl");
    fs.mkdirSync(path.dirname(feed), { recursive: true });
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\n+/)) {
      if (!line.trim()) continue;
      let parsed;
      try { parsed = JSON.parse(line); } catch { continue; }
      const key = `${parsed.device}:${parsed.seq}`;
      if (!parsed.device || parsed.seq == null || seen.has(key)) continue;
      seen.add(key);
      fs.appendFileSync(feed, `${line.trim()}\n`);
    }
    fs.mkdirSync(path.dirname(seenFile), { recursive: true });
    fs.writeFileSync(seenFile, JSON.stringify([...seen]));
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname);
      if (req.method === "POST" && pathname === "/v1/sessions") {
        const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
        if (payload.username !== user || payload.password !== password) {
          send(res, 401, { error: "Błędny login lub hasło." });
          return;
        }
        const token = crypto.randomBytes(24).toString("hex");
        tokens.set(token, Date.now());
        const tokenFile = path.join(root, "state", "tokens.json");
        fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
        fs.writeFileSync(tokenFile, JSON.stringify(Object.fromEntries(tokens)));
        send(res, 200, { token });
        return;
      }
      if (pathname.startsWith("/v1/people")) {
        await handlePeople(req, res, url, pathname, root, body, send, {
          appleKeys: options.appleKeys || null,
          appleAudience: options.appleAudience || process.env.GALLERYOS_APPLE_AUDIENCE || "pl.galleryos.app",
        });
        return;
      }
      if (!auth(req)) {
        send(res, 401, { error: "Błędny login lub hasło." });
        return;
      }
      if (req.method === "POST" && pathname === "/v1/assets") {
        const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
        const destination = safePath(payload.path || "");
        if (!destination || !payload.hash) {
          send(res, 400, { error: "Brak skrótu." });
          return;
        }
        if (fs.existsSync(destination)) {
          const size = fs.statSync(destination).size;
          const expected = Number(payload.bytes || 0);
          if (size > 0 && (expected <= 0 || size === expected)) {
            send(res, 200, { exists: true, id: payload.hash });
            return;
          }
          fs.unlinkSync(destination);
        }
        const id = crypto.randomUUID();
        const temporary = path.join(root, "tmp", id);
        fs.mkdirSync(path.dirname(temporary), { recursive: true });
        fs.closeSync(fs.openSync(temporary, "w"));
        uploads.set(id, { file: temporary, path: payload.path, hash: payload.hash, bytes: payload.bytes || 0 });
        send(res, 200, { exists: false, id });
        return;
      }
      const chunk = pathname.match(/^\/v1\/assets\/([^/]+)\/chunks$/);
      if (req.method === "PUT" && chunk) {
        const upload = uploads.get(chunk[1]);
        if (!upload) {
          send(res, 404, { error: "Brak rezerwacji." });
          return;
        }
        const offset = Number(url.searchParams.get("offset") || 0);
        const data = await body(req, 2 * 1024 * 1024);
        const fd = fs.openSync(upload.file, "r+");
        fs.writeSync(fd, data, 0, data.length, offset);
        fs.closeSync(fd);
        send(res, 204, "");
        return;
      }
      const commit = pathname.match(/^\/v1\/assets\/([^/]+)\/commit$/);
      if (req.method === "POST" && commit) {
        const upload = uploads.get(commit[1]);
        if (!upload) {
          send(res, 404, { error: "Brak rezerwacji." });
          return;
        }
        const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
        const destination = safePath(payload.path || upload.path);
        if (!destination) {
          send(res, 400, { error: "Nieprawidłowa ścieżka." });
          return;
        }
        const written = fs.statSync(upload.file).size;
        if (upload.bytes > 0 && written !== upload.bytes) {
          fs.unlinkSync(upload.file);
          uploads.delete(commit[1]);
          send(res, 409, { error: "Niepełny plik." });
          return;
        }
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.renameSync(upload.file, destination);
        uploads.delete(commit[1]);
        send(res, 200, { ok: true, hash: upload.hash });
        return;
      }
      if (req.method === "GET" && pathname === "/v1/changes") {
        const cursor = Number(url.searchParams.get("cursor") || 0);
        const feed = path.join(root, "state", "feed.jsonl");
        const lines = fs.existsSync(feed)
          ? fs.readFileSync(feed, "utf8").split(/\n+/).filter(Boolean).map((line) => JSON.parse(line))
          : [];
        send(res, 200, { cursor: lines.length, lines: lines.slice(cursor) });
        return;
      }
      if (req.method === "GET" && pathname === "/v1/list") {
        const folder = safePath(url.searchParams.get("path") || "");
        if (!folder || !fs.existsSync(folder)) {
          send(res, 200, { names: [] });
          return;
        }
        send(res, 200, { names: fs.readdirSync(folder) });
        return;
      }
      if (pathname.startsWith("/v1/files/")) {
        const relative = pathname.slice("/v1/files/".length);
        const file = safePath(relative);
        if (!file) {
          send(res, 400, { error: "Nieprawidłowa ścieżka." });
          return;
        }
        if (req.method === "PUT") {
          const data = await body(req, 32 * 1024 * 1024);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, data);
          if (relative.includes("/state/journal-")) indexJournal(relative);
          send(res, 204, "");
          return;
        }
        if (req.method === "HEAD") {
          if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            send(res, 404, { error: "Brak pliku." });
            return;
          }
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Length": fs.statSync(file).size,
          });
          res.end();
          return;
        }
        if (req.method === "DELETE") {
          if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) fs.unlinkSync(file);
          send(res, 204, "");
          return;
        }
        if (req.method === "GET") {
          if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            send(res, 404, { error: "Brak pliku." });
            return;
          }
          send(res, 200, fs.readFileSync(file), "application/octet-stream");
          return;
        }
      }
      const original = pathname.match(/^\/v1\/assets\/([a-f0-9]+)\/(original|thumbnail)$/);
      if (req.method === "GET" && original) {
        const kind = original[2] === "thumbnail" ? "thumbs" : "originals";
        const bucket = original[1].slice(0, 2);
        const folder = path.join(root, "GalleryOS", kind, bucket);
        const match = fs.existsSync(folder)
          ? fs.readdirSync(folder).find((name) => name.startsWith(original[1]))
          : null;
        if (!match) {
          send(res, 404, { error: "Brak pliku." });
          return;
        }
        send(res, 200, fs.readFileSync(path.join(folder, match)), "application/octet-stream");
        return;
      }
      send(res, 404, { error: "Nie ma takiej ścieżki." });
    } catch (error) {
      send(res, error.status || 500, { error: error.message || "Błąd serwera." });
    }
  });
}

function socialFile(root) {
  return path.join(root, "state", "social.json");
}

function loadSocial(root) {
  return readJSON(socialFile(root), { accounts: {}, sessions: {}, invites: {}, friends: {}, albums: [] });
}

function saveSocial(root, social) {
  const file = socialFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(social));
}

function peopleToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function shareFile(root, hash, kind, ext) {
  const bucket = String(hash).slice(0, 2);
  const name = kind === "thumbnail" ? `${hash}.jpg` : `${hash}.${ext || "bin"}`;
  return path.join(root, "shares", bucket, name);
}

function canSeeHash(social, name, hash) {
  return social.albums.some((album) => {
    const member = album.owner === name || (album.members || []).includes(name);
    return member && (album.items || []).some((item) => item.hash === hash);
  });
}

function issuePeopleSession(social, name) {
  const issued = crypto.randomBytes(24).toString("hex");
  social.sessions[issued] = { name, seen: Date.now() };
  return issued;
}

function accountName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function freshAccountName(social, preferred) {
  const base = accountName(preferred).length >= 2 ? accountName(preferred) : "Apple";
  if (!social.accounts[base.toLowerCase()]) return base;
  let index = 2;
  while (social.accounts[`${base} ${index}`.toLowerCase()]) index += 1;
  return `${base} ${index}`;
}

function accountForApple(social, sub) {
  return Object.values(social.accounts).find((account) => account.appleSub === sub) || null;
}

function personSession(token, account) {
  const givenName = account.givenName || "";
  const familyName = account.familyName || "";
  const displayName = [givenName, familyName].filter(Boolean).join(" ") || account.name;
  return { token, name: account.name, givenName, familyName, displayName };
}

export async function verifyAppleIdentity(token, { nonce, audience, keys, now = Date.now() } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    const error = new Error("Apple nie potwierdziło tożsamości.");
    error.status = 401;
    throw error;
  }
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  const list = keys || await loadAppleKeys(header.kid);
  const jwk = list.find((key) => key.kid === header.kid);
  if (!jwk || header.alg !== "RS256") {
    const error = new Error("Apple nie potwierdziło tożsamości.");
    error.status = 401;
    throw error;
  }
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], "base64url");
  if (!verifier.verify(key, signature)) {
    const error = new Error("Apple nie potwierdziło tożsamości.");
    error.status = 401;
    throw error;
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const expected = audience || "pl.galleryos.app";
  if (claims.iss !== "https://appleid.apple.com" || !audiences.includes(expected) || !claims.sub) {
    const error = new Error("Apple nie potwierdziło tożsamości.");
    error.status = 401;
    throw error;
  }
  if (!claims.exp || claims.exp * 1000 < now) {
    const error = new Error("Potwierdzenie Apple wygasło. Spróbuj jeszcze raz.");
    error.status = 401;
    throw error;
  }
  if (nonce) {
    const hashed = crypto.createHash("sha256").update(String(nonce)).digest("hex");
    if (claims.nonce !== hashed) {
      const error = new Error("Apple nie potwierdziło tożsamości.");
      error.status = 401;
      throw error;
    }
  }
  return claims;
}

const appleKeyCache = { at: 0, keys: [] };

async function loadAppleKeys(kid) {
  if (appleKeyCache.keys.length && Date.now() - appleKeyCache.at < 60 * 60 * 1000 && appleKeyCache.keys.some((key) => key.kid === kid)) {
    return appleKeyCache.keys;
  }
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    const error = new Error("Nie udało się potwierdzić Apple ID.");
    error.status = 503;
    throw error;
  }
  const json = await response.json();
  appleKeyCache.at = Date.now();
  appleKeyCache.keys = json.keys || [];
  return appleKeyCache.keys;
}

async function handlePeople(req, res, url, pathname, root, body, send, peopleOptions = {}) {
  const social = loadSocial(root);
  const token = peopleToken(req);
  const session = social.sessions[token];
  if (session) session.seen = Date.now();
  const me = session?.name || "";

  if (req.method === "POST" && pathname === "/v1/people/register") {
    const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
    const name = String(payload.name || "").trim();
    const password = String(payload.password || "");
    const key = name.toLowerCase();
    if (name.length < 2 || password.length < 4) {
      send(res, 400, { error: "Nazwa ma mieć co najmniej 2 znaki, a hasło 4." });
      return;
    }
    if (social.accounts[key]) {
      send(res, 409, { error: "Ta nazwa jest zajęta." });
      return;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    social.accounts[key] = { name, salt, hash: hashPassword(password, salt) };
    const issued = issuePeopleSession(social, name);
    saveSocial(root, social);
    send(res, 200, { token: issued, name });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/sessions") {
    const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
    const key = String(payload.name || "").trim().toLowerCase();
    const account = social.accounts[key];
    if (!account?.hash || !account.salt || hashPassword(String(payload.password || ""), account.salt) !== account.hash) {
      send(res, 401, { error: "Błędny login lub hasło." });
      return;
    }
    const issued = issuePeopleSession(social, account.name);
    saveSocial(root, social);
    send(res, 200, { token: issued, name: account.name });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/enter") {
    const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
    const name = accountName(payload.name);
    const password = String(payload.password || "");
    if (name.length < 2 || password.length < 4) {
      send(res, 400, { error: "Nazwa ma mieć co najmniej 2 znaki, a hasło 4." });
      return;
    }
    const key = name.toLowerCase();
    const existing = social.accounts[key];
    if (!existing) {
      const salt = crypto.randomBytes(16).toString("hex");
      social.accounts[key] = { name, salt, hash: hashPassword(password, salt) };
      const issued = issuePeopleSession(social, name);
      saveSocial(root, social);
      send(res, 200, { token: issued, name, created: true });
      return;
    }
    if (existing.appleSub && !existing.hash) {
      send(res, 409, { error: "To konto jest przez Apple ID. Stuknij przycisk Apple." });
      return;
    }
    if (!existing.hash || !existing.salt || hashPassword(password, existing.salt) !== existing.hash) {
      send(res, 401, { error: "To konto już jest. Hasło się nie zgadza." });
      return;
    }
    const issued = issuePeopleSession(social, existing.name);
    saveSocial(root, social);
    send(res, 200, { token: issued, name: existing.name, created: false });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/apple") {
    const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
    const claims = await verifyAppleIdentity(payload.identityToken, {
      nonce: payload.nonce,
      audience: peopleOptions.appleAudience,
      keys: peopleOptions.appleKeys || undefined,
    });
    const givenName = accountName(payload.givenName);
    const familyName = accountName(payload.familyName);
    const existing = accountForApple(social, claims.sub);
    if (existing) {
      if (givenName) existing.givenName = givenName;
      if (familyName) existing.familyName = familyName;
      const issued = issuePeopleSession(social, existing.name);
      saveSocial(root, social);
      send(res, 200, personSession(issued, existing));
      return;
    }
    const email = String(claims.email || "");
    const emailName = email.split("@")[0];
    const relay = email.includes("privaterelay.appleid.com");
    const preferred = [givenName, familyName].filter(Boolean).join(" ") || accountName(payload.name) || (relay ? "" : emailName);
    const name = freshAccountName(social, preferred);
    const account = { name, appleSub: claims.sub, givenName, familyName };
    social.accounts[name.toLowerCase()] = account;
    const issued = issuePeopleSession(social, name);
    saveSocial(root, social);
    send(res, 200, personSession(issued, account));
    return;
  }
  if (pathname.startsWith("/v1/people/pair/")) {
    await handlePairing(req, res, url, pathname, body, send);
    return;
  }
  if (!me) {
    send(res, 401, { error: "Zaloguj się." });
    return;
  }
  const online = (name) => {
    const seen = Object.values(social.sessions).find((item) => item.name === name)?.seen || 0;
    return Date.now() - seen < 2 * 60 * 1000;
  };
  if (req.method === "GET" && pathname === "/v1/people/library") {
    saveSocial(root, social);
    send(res, 200, { library: (social.libraries || {})[me] || null });
    return;
  }
  if (req.method === "PUT" && pathname === "/v1/people/library") {
    const payload = JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}");
    social.libraries = social.libraries || {};
    social.libraries[me] = {
      place: String(payload.place || ""),
      kind: String(payload.kind || ""),
      host: String(payload.host || ""),
      port: Number(payload.port || 0),
      username: String(payload.username || ""),
      directory: String(payload.directory || ""),
      localHost: String(payload.localHost || ""),
      localPort: Number(payload.localPort || 0),
      localName: String(payload.localName || ""),
      remoteHost: String(payload.remoteHost || ""),
    };
    saveSocial(root, social);
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && pathname === "/v1/people/friends") {
    const names = social.friends[me] || [];
    saveSocial(root, social);
    send(res, 200, { friends: names.map((name) => ({ name, online: online(name) })) });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/invites") {
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    social.invites[code] = { owner: me, at: Date.now() };
    saveSocial(root, social);
    send(res, 200, { code });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/invites/accept") {
    const payload = JSON.parse((await body(req, 16 * 1024)).toString("utf8") || "{}");
    const code = String(payload.code || "").trim().toUpperCase();
    const invite = social.invites[code];
    if (!invite) {
      send(res, 404, { error: "Nie ma takiego kodu." });
      return;
    }
    if (invite.owner === me) {
      send(res, 400, { error: "To Twój kod." });
      return;
    }
    social.friends[me] = Array.from(new Set([...(social.friends[me] || []), invite.owner]));
    social.friends[invite.owner] = Array.from(new Set([...(social.friends[invite.owner] || []), me]));
    delete social.invites[code];
    saveSocial(root, social);
    send(res, 200, { friend: invite.owner });
    return;
  }
  if (req.method === "GET" && pathname === "/v1/people/albums") {
    const albums = social.albums.filter((album) => album.owner === me || (album.members || []).includes(me));
    saveSocial(root, social);
    send(res, 200, { albums });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/albums") {
    const payload = JSON.parse((await body(req, 1024 * 1024)).toString("utf8") || "{}");
    const title = String(payload.title || "").trim() || "Album";
    const known = new Set(social.friends[me] || []);
    const members = (payload.members || []).map((name) => String(name)).filter((name) => known.has(name));
    const items = (payload.items || []).map((item) => ({
      hash: String(item.hash || ""),
      ext: String(item.ext || "jpg"),
    })).filter((item) => /^[a-f0-9]{16,}$/i.test(item.hash));
    const album = { id: crypto.randomUUID(), title, owner: me, members, items };
    social.albums.push(album);
    saveSocial(root, social);
    send(res, 200, album);
    return;
  }
  const fileRoute = pathname.match(/^\/v1\/people\/shares\/([a-f0-9]+)\/(thumbnail|original)$/i);
  if (fileRoute) {
    const hash = fileRoute[1].toLowerCase();
    const kind = fileRoute[2];
    if (!canSeeHash(social, me, hash) && req.method !== "PUT") {
      send(res, 403, { error: "To zdjęcie nie jest Ci udostępnione." });
      return;
    }
    const ext = url.searchParams.get("ext") || "jpg";
    const file = shareFile(root, hash, kind, ext);
    if (req.method === "PUT") {
      if (fs.existsSync(file)) {
        send(res, 200, { exists: true });
        return;
      }
      const data = await body(req, 64 * 1024 * 1024);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      send(res, 204, "");
      return;
    }
    if (req.method === "GET") {
      if (!fs.existsSync(file)) {
        send(res, 404, { error: "Brak pliku." });
        return;
      }
      send(res, 200, fs.readFileSync(file), "application/octet-stream");
      return;
    }
  }
  send(res, 404, { error: "Nie ma takiej ścieżki." });
}

// Apple TV pairing: the TV publishes a public key and gets a short code, the phone encrypts the
// server for that key. This service only ever relays ciphertext, entries live in memory for minutes.
const pairings = new Map();
const pairAttempts = new Map();
const pairAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const pairLifetime = 10 * 60 * 1000;

function purgePairings(now = Date.now()) {
  for (const [id, item] of pairings) {
    if (item.expires <= now) pairings.delete(id);
  }
  for (const [key, item] of pairAttempts) {
    if (item.reset <= now) pairAttempts.delete(key);
  }
}

function pairCode() {
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (const byte of bytes) code += pairAlphabet[byte % pairAlphabet.length];
  return code;
}

function pairThrottle(req) {
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const entry = pairAttempts.get(key) || { count: 0, reset: now + 60 * 1000 };
  entry.count += 1;
  pairAttempts.set(key, entry);
  return entry.count <= 30;
}

function findPairing(code) {
  const clean = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 4) return null;
  for (const [id, item] of pairings) {
    if (item.code === clean && item.expires > Date.now()) return { id, item };
  }
  return null;
}

async function handlePairing(req, res, url, pathname, body, send) {
  purgePairings();
  if (req.method === "POST" && pathname === "/v1/people/pair/start") {
    if (pairings.size >= 500 || !pairThrottle(req)) {
      send(res, 429, { error: "Za dużo prób. Spróbuj za chwilę." });
      return;
    }
    const payload = JSON.parse((await body(req, 4 * 1024)).toString("utf8") || "{}");
    const publicKey = String(payload.publicKey || "");
    if (publicKey.length < 40 || publicKey.length > 400) {
      send(res, 400, { error: "Brak klucza Apple TV." });
      return;
    }
    let code = pairCode();
    while (findPairing(code)) code = pairCode();
    const id = crypto.randomBytes(16).toString("hex");
    pairings.set(id, { code, publicKey, sealed: null, expires: Date.now() + pairLifetime });
    send(res, 200, { id, code, expiresIn: pairLifetime / 1000 });
    return;
  }
  if (req.method === "GET" && pathname === "/v1/people/pair/poll") {
    const id = String(url.searchParams.get("id") || "");
    const item = pairings.get(id);
    if (!item) {
      send(res, 404, { error: "Kod wygasł." });
      return;
    }
    if (!item.sealed) {
      send(res, 200, { status: "waiting" });
      return;
    }
    pairings.delete(id);
    send(res, 200, { status: "ready", sealed: item.sealed });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/pair/lookup") {
    if (!pairThrottle(req)) {
      send(res, 429, { error: "Za dużo prób. Spróbuj za chwilę." });
      return;
    }
    const payload = JSON.parse((await body(req, 4 * 1024)).toString("utf8") || "{}");
    const found = findPairing(payload.code);
    if (!found || found.item.sealed) {
      send(res, 404, { error: "Ten kod nie pasuje do żadnego Apple TV." });
      return;
    }
    send(res, 200, { publicKey: found.item.publicKey });
    return;
  }
  if (req.method === "POST" && pathname === "/v1/people/pair/claim") {
    if (!pairThrottle(req)) {
      send(res, 429, { error: "Za dużo prób. Spróbuj za chwilę." });
      return;
    }
    const payload = JSON.parse((await body(req, 32 * 1024)).toString("utf8") || "{}");
    const found = findPairing(payload.code);
    const sealed = payload.sealed || {};
    if (!found || found.item.sealed) {
      send(res, 404, { error: "Ten kod nie pasuje do żadnego Apple TV." });
      return;
    }
    if (typeof sealed.ephemeral !== "string" || typeof sealed.box !== "string" || sealed.box.length > 16 * 1024) {
      send(res, 400, { error: "Brak danych do przekazania." });
      return;
    }
    found.item.sealed = { ephemeral: sealed.ephemeral, box: sealed.box };
    send(res, 200, { ok: true });
    return;
  }
  send(res, 404, { error: "Nie ma takiej ścieżki." });
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

const invokedDirectly = process.env.pm_id || (
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
);
if (invokedDirectly) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.GALLERYOS_HOST || "0.0.0.0";
  const server = createServer();
  server.on("error", (error) => {
    process.stderr.write(`${error.message}\n`);
  });
  server.listen(port, host, () => {
    process.stdout.write(`GalleryOS library listening on ${host}:${port}\n`);
  });
}
