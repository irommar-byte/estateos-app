import { countryDisplayName, flagEmojiFromCountryCode, geoSourceLabel } from './visitGeo';
import { parseEventDate } from './warsawDateTime';

export type RawPageVisit = {
  ip: string;
  country?: string | null;
  city?: string | null;
  regionName?: string | null;
  isp?: string | null;
  geoSource?: string | null;
  deviceType?: string | null;
  path: string;
  userAgent?: string | null;
  createdAt: string | Date;
};

export type AggregatedVisitor = {
  ip: string;
  countryCode: string;
  countryName: string;
  flag: string;
  city: string | null;
  regionName: string | null;
  isp: string | null;
  geoSource: string;
  geoSourceLabel: string;
  deviceType: string;
  count: number;
  mainPageViews: number;
  uniquePaths: number;
  topPaths: string[];
  firstVisit: Date;
  lastVisit: Date;
  isRelay: boolean;
};

export type VisitorCountryStat = {
  countryCode: string;
  countryName: string;
  flag: string;
  visitors: number;
  pageViews: number;
  sharePct: number;
};

function normalizePath(path: string): string {
  const p = String(path || '/').trim() || '/';
  return p.length > 80 ? `${p.slice(0, 77)}…` : p;
}

export function aggregateVisitorsFromVisits(visits: RawPageVisit[], limit = 50): AggregatedVisitor[] {
  const map = new Map<string, {
    ip: string;
    countryCode: string;
    city: string | null;
    regionName: string | null;
    isp: string | null;
    geoSource: string;
    deviceType: string;
    count: number;
    mainPageViews: number;
    paths: Map<string, number>;
    firstVisit: Date;
    lastVisit: Date;
    isRelay: boolean;
  }>();

  for (const visit of visits) {
    const ip = String(visit.ip || '').trim() || 'unknown';
    const createdAt = parseEventDate(visit.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;

    const countryCode = String(visit.country || 'UN').trim().toUpperCase().slice(0, 8) || 'UN';
    let row = map.get(ip);
    if (!row) {
      row = {
        ip,
        countryCode,
        city: visit.city ? String(visit.city) : null,
        regionName: visit.regionName ? String(visit.regionName) : null,
        isp: visit.isp ? String(visit.isp) : null,
        geoSource: String(visit.geoSource || 'unknown'),
        deviceType: String(visit.deviceType || 'unknown'),
        count: 0,
        mainPageViews: 0,
        paths: new Map(),
        firstVisit: createdAt,
        lastVisit: createdAt,
        isRelay: countryCode === 'LO',
      };
      map.set(ip, row);
    }

    row.count += 1;
    const path = normalizePath(visit.path);
    row.paths.set(path, (row.paths.get(path) || 0) + 1);
    if (path === '/') row.mainPageViews += 1;
    if (createdAt < row.firstVisit) row.firstVisit = createdAt;
    if (createdAt > row.lastVisit) {
      row.lastVisit = createdAt;
      row.countryCode = countryCode;
      row.city = visit.city ? String(visit.city) : row.city;
      row.regionName = visit.regionName ? String(visit.regionName) : row.regionName;
      row.isp = visit.isp ? String(visit.isp) : row.isp;
      row.geoSource = String(visit.geoSource || row.geoSource);
      row.deviceType = String(visit.deviceType || row.deviceType);
    }
  }

  return Array.from(map.values())
    .map((row) => {
      const topPaths = Array.from(row.paths.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([path, hits]) => (hits > 1 ? `${path} (×${hits})` : path));
      return {
        ip: row.ip,
        countryCode: row.countryCode,
        countryName: countryDisplayName(row.countryCode),
        flag: flagEmojiFromCountryCode(row.countryCode),
        city: row.city,
        regionName: row.regionName,
        isp: row.isp,
        geoSource: row.geoSource,
        geoSourceLabel: geoSourceLabel(row.geoSource),
        deviceType: row.deviceType,
        count: row.count,
        mainPageViews: row.mainPageViews,
        uniquePaths: row.paths.size,
        topPaths,
        firstVisit: row.firstVisit,
        lastVisit: row.lastVisit,
        isRelay: row.isRelay || row.countryCode === 'LO',
      };
    })
    .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
    .slice(0, limit);
}

export function buildVisitorCountryStats(visitors: AggregatedVisitor[]): VisitorCountryStat[] {
  const byCountry = new Map<string, { visitors: number; pageViews: number }>();
  let totalViews = 0;

  for (const v of visitors) {
    totalViews += v.count;
    const prev = byCountry.get(v.countryCode) || { visitors: 0, pageViews: 0 };
    prev.visitors += 1;
    prev.pageViews += v.count;
    byCountry.set(v.countryCode, prev);
  }

  return Array.from(byCountry.entries())
    .map(([countryCode, stats]) => ({
      countryCode,
      countryName: countryDisplayName(countryCode),
      flag: flagEmojiFromCountryCode(countryCode),
      visitors: stats.visitors,
      pageViews: stats.pageViews,
      sharePct: totalViews > 0 ? Math.round((stats.pageViews / totalViews) * 100) : 0,
    }))
    .sort((a, b) => b.pageViews - a.pageViews);
}
