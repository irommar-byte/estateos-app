/**
 * ActivityKit APNs. Uses server secrets only — never create or commit a .p8 here.
 * Configure APNS_KEY_PATH / APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import https from "node:https";

const TOPIC = "pl.nostalgie.eosmusic.push-type.liveactivity";
let cachedJwt = { token: "", exp: 0 };

function loadKey() {
  const inline = process.env.APNS_KEY_P8 || "";
  if (inline.trim()) return inline.replace(/\\n/g, "\n");
  const path = process.env.APNS_KEY_PATH || "";
  if (path && fs.existsSync(path)) return fs.readFileSync(path, "utf8");
  return "";
}

function configured() {
  return !!(loadKey() && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
}

function jwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt.token && cachedJwt.exp > now + 30) return cachedJwt.token;
  const key = loadKey();
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: now })).toString("base64url");
  const signer = crypto.createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  cachedJwt = { token: `${header}.${payload}.${sig}`, exp: now + 50 * 60 };
  return cachedJwt.token;
}

function host() {
  return process.env.APNS_PRODUCTION === "1" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
}

export function sendLiveActivityPush({
  token,
  event,
  contentState,
  timestamp = Math.floor(Date.now() / 1000),
  priority = 5,
  staleDate,
  dismissalDate,
  frequentPushesEnabled = true,
}) {
  if (!configured() || !token) return Promise.resolve({ skipped: true });
  const body = {
    aps: {
      timestamp,
      event,
      "content-state": contentState,
      "stale-date": staleDate || timestamp + 40,
    },
  };
  if (dismissalDate) body.aps["dismissal-date"] = dismissalDate;
  const payload = JSON.stringify(body);
  const headers = {
    authorization: `bearer ${jwt()}`,
    "apns-topic": TOPIC,
    "apns-push-type": "liveactivity",
    "apns-priority": String(priority),
    "content-type": "application/json",
  };
  if (!frequentPushesEnabled && priority === 5) {
    headers["apns-priority"] = "5";
  }
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: host(),
        method: "POST",
        path: `/3/device/${token}`,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      }
    );
    req.on("error", (error) => resolve({ error: error.message }));
    req.write(payload);
    req.end();
  });
}

export function apnsConfigured() {
  return configured();
}
