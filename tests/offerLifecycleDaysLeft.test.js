/** Standalone checks mirroring resolveOfferDaysLeft / isOfferClosed expiry rules. */
function resolveOfferExpiryMs(offer) {
  for (const raw of [
    offer.expiresAt,
    offer.validUntil,
    offer.publishedUntil,
    offer.expirationDate,
    offer.expireAt,
  ]) {
    if (!raw) continue;
    const ts = new Date(String(raw)).getTime();
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  return null;
}

function resolveOfferDaysLeft(offer, now) {
  const expiryMs = resolveOfferExpiryMs(offer);
  if (expiryMs == null) return null;
  return Math.max(0, Math.ceil((expiryMs - now) / 86400000));
}

function isExpiredByDate(offer, now) {
  const expiryMs = resolveOfferExpiryMs(offer);
  return expiryMs != null && expiryMs < now;
}

const now = Date.parse('2026-09-24T12:00:00.000Z');
const checks = [
  [resolveOfferDaysLeft({ status: 'ACTIVE' }, now) === null, 'no expiry → null'],
  [resolveOfferDaysLeft({ expiresAt: '2026-09-27T12:00:00.000Z' }, now) === 3, '3 days'],
  [resolveOfferDaysLeft({ expiresAt: '2026-09-20T12:00:00.000Z' }, now) === 0, 'past → 0'],
  [isExpiredByDate({ status: 'ACTIVE', expiresAt: '2026-09-20T12:00:00.000Z' }, now), 'closed'],
  [!isExpiredByDate({ status: 'ACTIVE', expiresAt: '2026-09-30T12:00:00.000Z' }, now), 'open'],
  [resolveOfferExpiryMs({ createdAt: '2020-01-01' }) === null, 'no fake +30'],
];

for (const [ok, msg] of checks) {
  if (!ok) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}
console.log('offerLifecycleDaysLeft: OK (' + checks.length + ' checks)');
