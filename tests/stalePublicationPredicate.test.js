/** Sanity: stale ACTIVE publication (endsAt past) must not count as active. */
function isLivePublication(row, nowMs) {
  if (String(row.status).toUpperCase() !== 'ACTIVE') return false;
  const ends = new Date(row.endsAt).getTime();
  return Number.isFinite(ends) && ends > nowMs;
}

const now = Date.parse('2026-09-24T18:00:00.000Z');
const checks = [
  [
    !isLivePublication({ status: 'ACTIVE', endsAt: '2026-09-20T00:00:00.000Z' }, now),
    'past endsAt → not live',
  ],
  [
    isLivePublication({ status: 'ACTIVE', endsAt: '2026-10-20T00:00:00.000Z' }, now),
    'future endsAt → live',
  ],
  [
    !isLivePublication({ status: 'ENDED', endsAt: '2026-10-20T00:00:00.000Z' }, now),
    'ENDED → not live',
  ],
];

for (const [ok, msg] of checks) {
  if (!ok) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}
console.log('stalePublicationPredicate: OK');
