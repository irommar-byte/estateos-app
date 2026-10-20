import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "./server.mjs";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const appleJwk = publicKey.export({ format: "jwk" });
appleJwk.kid = "test-apple";
appleJwk.alg = "RS256";
appleJwk.use = "sig";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "galleryos-"));
const server = createServer({
  root,
  user: "gallery",
  password: "galleryos",
  appleKeys: [appleJwk],
  appleAudience: "pl.galleryos.app",
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const session = await request("/v1/sessions", {
  method: "POST",
  body: JSON.stringify({ username: "gallery", password: "galleryos" }),
});
assert.equal(session.status, 200);
const token = session.json.token;
assert.ok(token);

const denied = await request("/v1/changes");
assert.equal(denied.status, 401);

const reserve = await request("/v1/assets", {
  method: "POST",
  token,
  body: JSON.stringify({ hash: "abcd", bytes: 5, path: "GalleryOS/originals/ab/abcd.jpg" }),
});
assert.equal(reserve.json.exists, false);
const first = Buffer.from("hello");
const second = Buffer.from("!");
const chunkA = await request(`/v1/assets/${reserve.json.id}/chunks?offset=0`, { method: "PUT", token, body: first });
const chunkB = await request(`/v1/assets/${reserve.json.id}/chunks?offset=5`, { method: "PUT", token, body: second });
assert.equal(chunkA.status, 204);
assert.equal(chunkB.status, 204);
const commit = await request(`/v1/assets/${reserve.json.id}/commit`, {
  method: "POST",
  token,
  body: JSON.stringify({ path: "GalleryOS/originals/ab/abcd.jpg" }),
});
assert.equal(commit.status, 200);
const again = await request("/v1/assets", {
  method: "POST",
  token,
  body: JSON.stringify({ hash: "abcd", bytes: 6, path: "GalleryOS/originals/ab/abcd.jpg" }),
});
assert.equal(again.json.exists, true);

const line = JSON.stringify({
  seq: 1,
  device: "phone",
  at: "2026-10-14T00:00:00Z",
  asset: { hash: "abcd", created: "2026-10-14T00:00:00Z", pixelWidth: 1, pixelHeight: 1, traits: 0, favorite: false, duration: 0, albumNames: [], resources: [], updatedAt: "2026-10-14T00:00:00Z" },
});
const journal = await request("/v1/files/GalleryOS/state/journal-phone.jsonl", { method: "PUT", token, body: Buffer.from(`${line}\n`) });
assert.equal(journal.status, 204);
const changes = await request("/v1/changes?cursor=0", { token });
assert.equal(changes.json.cursor, 1);
assert.equal(changes.json.lines[0].asset.hash, "abcd");
const original = await request("/v1/assets/abcd/original", { token });
assert.equal(original.status, 200);
assert.equal(Buffer.from(original.raw).toString(), "hello!");
const names = await request("/v1/list?path=GalleryOS/state", { token });
assert.ok(names.json.names.includes("journal-phone.jsonl"));

const person = await request("/v1/people/register", {
  method: "POST",
  body: JSON.stringify({ name: "Ania", password: "tajne" }),
});
assert.equal(person.status, 200);
const friend = await request("/v1/people/register", {
  method: "POST",
  body: JSON.stringify({ name: "Bartek", password: "tajne" }),
});
const invite = await request("/v1/people/invites", { method: "POST", token: person.json.token, body: "{}" });
const accepted = await request("/v1/people/invites/accept", {
  method: "POST",
  token: friend.json.token,
  body: JSON.stringify({ code: invite.json.code }),
});
assert.equal(accepted.json.friend, "Ania");
const thumb = await request("/v1/people/shares/abcdabcdabcdabcd/thumbnail", {
  method: "PUT",
  token: person.json.token,
  body: Buffer.from("thumb"),
});
assert.equal(thumb.status, 204);
const againThumb = await request("/v1/people/shares/abcdabcdabcdabcd/thumbnail", {
  method: "PUT",
  token: person.json.token,
  body: Buffer.from("thumb"),
});
assert.equal(againThumb.json.exists, true);
const album = await request("/v1/people/albums", {
  method: "POST",
  token: person.json.token,
  body: JSON.stringify({ title: "Lato", members: ["Bartek"], items: [{ hash: "abcdabcdabcdabcd", ext: "jpg" }] }),
});
assert.equal(album.status, 200);
const seen = await request("/v1/people/albums", { token: friend.json.token });
assert.equal(seen.json.albums[0].title, "Lato");
const fetched = await request("/v1/people/shares/abcdabcdabcdabcd/thumbnail", { token: friend.json.token });
assert.equal(Buffer.from(fetched.raw).toString(), "thumb");

const nonce = "apple-nonce";
const hashed = crypto.createHash("sha256").update(nonce).digest("hex");
const appleToken = signApple({
  iss: "https://appleid.apple.com",
  aud: "pl.galleryos.app",
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: "001234.apple",
  nonce: hashed,
  email: "xa1@privaterelay.appleid.com",
});
const apple = await request("/v1/people/apple", {
  method: "POST",
  body: JSON.stringify({ identityToken: appleToken, nonce, givenName: "Marian", familyName: "Kowalski" }),
});
assert.equal(apple.status, 200);
assert.equal(apple.json.displayName, "Marian Kowalski");
const appleAgain = await request("/v1/people/apple", {
  method: "POST",
  body: JSON.stringify({ identityToken: appleToken, nonce }),
});
assert.equal(appleAgain.json.displayName, "Marian Kowalski");
assert.equal(appleAgain.json.name, apple.json.name);
assert.notEqual(appleAgain.json.token, apple.json.token);
const forged = await request("/v1/people/apple", {
  method: "POST",
  body: JSON.stringify({ identityToken: `${appleToken}x`, nonce, name: "Marian" }),
});
assert.equal(forged.status, 401);

const entered = await request("/v1/people/enter", {
  method: "POST",
  body: JSON.stringify({ name: "Ola", password: "haslo" }),
});
assert.equal(entered.status, 200);
assert.equal(entered.json.created, true);
const enteredAgain = await request("/v1/people/enter", {
  method: "POST",
  body: JSON.stringify({ name: "ola", password: "haslo" }),
});
assert.equal(enteredAgain.json.name, "Ola");
assert.equal(enteredAgain.json.created, false);
const wrong = await request("/v1/people/enter", {
  method: "POST",
  body: JSON.stringify({ name: "Ola", password: "inne" }),
});
assert.equal(wrong.status, 401);
const saved = await request("/v1/people/library", {
  method: "PUT",
  token: entered.json.token,
  body: JSON.stringify({ host: "nas.local", port: 5001, username: "ola", remoteHost: "nas.example" }),
});
assert.equal(saved.status, 200);
const loaded = await request("/v1/people/library", { token: entered.json.token });
assert.equal(loaded.json.library.host, "nas.local");
assert.equal(loaded.json.library.password, undefined);
const withSecret = await request("/v1/people/library", {
  method: "PUT",
  token: entered.json.token,
  body: JSON.stringify({
    host: "nas.local",
    port: 5000,
    username: "ola",
    remoteHost: "ola.myqnapcloud.com",
    remotePort: 5001,
    directory: "Multimedia",
    secret: "nas-haslo",
  }),
});
assert.equal(withSecret.status, 200);
const restored = await request("/v1/people/library", { token: entered.json.token });
assert.equal(restored.json.library.remoteHost, "ola.myqnapcloud.com");
assert.equal(restored.json.library.remotePort, 5001);
assert.equal(restored.json.library.secret, "nas-haslo");
const passkey = await request("/v1/people/passkey/login/start", { method: "POST", body: "{}" });
assert.equal(passkey.status, 200);
assert.equal(passkey.json.rpId, "estateos.pl");
assert.ok(passkey.json.challenge);
assert.ok(passkey.json.sessionId);

// Apple TV pairing relays only ciphertext and works once.
const tvKey = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const started = await request("/v1/people/pair/start", {
  method: "POST",
  body: JSON.stringify({ publicKey: tvKey.publicKey.export({ type: "spki", format: "der" }).toString("base64") }),
});
assert.equal(started.status, 200);
assert.match(started.json.code, /^[A-Z2-9]{6}$/);
const waiting = await request(`/v1/people/pair/poll?id=${started.json.id}`);
assert.equal(waiting.json.status, "waiting");
const wrongCode = await request("/v1/people/pair/lookup", { method: "POST", body: JSON.stringify({ code: "ZZZZZZ" }) });
assert.equal(wrongCode.status, 404);
const looked = await request("/v1/people/pair/lookup", { method: "POST", body: JSON.stringify({ code: started.json.code.toLowerCase() }) });
assert.equal(looked.status, 200);
assert.ok(looked.json.publicKey);
const claimed = await request("/v1/people/pair/claim", {
  method: "POST",
  body: JSON.stringify({ code: started.json.code, sealed: { ephemeral: "AAAA", box: "BBBB" } }),
});
assert.equal(claimed.status, 200);
const pairAgain = await request("/v1/people/pair/claim", {
  method: "POST",
  body: JSON.stringify({ code: started.json.code, sealed: { ephemeral: "CCCC", box: "DDDD" } }),
});
assert.equal(pairAgain.status, 404);
const delivered = await request(`/v1/people/pair/poll?id=${started.json.id}`);
assert.equal(delivered.json.status, "ready");
assert.equal(delivered.json.sealed.box, "BBBB");
const pairGone = await request(`/v1/people/pair/poll?id=${started.json.id}`);
assert.equal(pairGone.status, 404);

server.close();
fs.rmSync(root, { recursive: true, force: true });
process.stdout.write("galleryos server ok\n");

function signApple(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-apple" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const data = `${header}.${payload}`;
  const signature = crypto.sign("sha256", Buffer.from(data), privateKey).toString("base64url");
  return `${data}.${signature}`;
}

async function request(pathname, options = {}) {
  const response = await fetch(base + pathname, {
    method: options.method || "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body,
  });
  const raw = Buffer.from(await response.arrayBuffer());
  let json = null;
  try { json = JSON.parse(raw.toString("utf8")); } catch { json = null; }
  return { status: response.status, json, raw };
}
