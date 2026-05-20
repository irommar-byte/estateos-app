#!/usr/bin/env node
/**
 * Smoke: edycja oferty (KW / nr mieszkania) — PUT /api/mobile/v1/offers
 *
 * Wymaga: BASE_URL, TOKEN (Bearer JWT mobilny), OFFER_ID, USER_ID (właściciel oferty)
 *
 * Przykład:
 *   BASE_URL=https://estateos.pl \
 *   TOKEN=eyJ... \
 *   OFFER_ID=123 \
 *   USER_ID=45 \
 *   node scripts/smoke-offer-kw-update.mjs
 */

const base = String(process.env.BASE_URL || "").replace(/\/$/, "");
const token = String(process.env.TOKEN || "").trim();
const offerId = Number(process.env.OFFER_ID || "");
const userId = Number(process.env.USER_ID || "");

if (!base || !token || !Number.isFinite(offerId) || offerId <= 0 || !Number.isFinite(userId) || userId <= 0) {
  console.error("Ustaw BASE_URL, TOKEN, OFFER_ID, USER_ID (env).");
  process.exit(2);
}

const url = `${base}/api/mobile/v1/offers`;

async function put(body, label) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: offerId, userId, ...body }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  console.log(`\n=== ${label} ===`);
  console.log("status", res.status);
  console.log(JSON.stringify(json, null, 2));
  return res.status;
}

const kwOk = "WA3D/00012345/9";

await put({ landRegistryNumber: kwOk }, "Tylko KW");
await put({ apartmentNumber: "12A" }, "Tylko nr mieszkania");
await put({ title: `Smoke ${Date.now()}` }, "Bez KW / apartment (tylko inne pole)");
await put({ landRegistryNumber: "INVALID" }, "KW zły format (oczekiwane 400)");
