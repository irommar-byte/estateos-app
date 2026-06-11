export const ADMIN_STATS_TABS = [
  { id: 'pageViews', label: 'Wizyty', color: '#10b981', icon: 'eye-outline' as const },
  { id: 'uniqueViews', label: 'Unikalne IP', color: '#3b82f6', icon: 'person-circle-outline' as const },
  { id: 'offers', label: 'Oferty', color: '#ec4899', icon: 'home-outline' as const },
  { id: 'users', label: 'Rejestracje', color: '#8b5cf6', icon: 'person-add-outline' as const },
];

export const ADMIN_STATS_PERIODS = [
  'Ostatnie 30 Dni',
  'Ten Rok',
  'Według roku',
  'Godziny Szczytu',
  'Dni Szczytu',
] as const;

export const ADMIN_STATS_PROPERTY_TYPES = [
  'Wszystkie',
  'Mieszkanie',
  'Dom',
  'Działka',
  'Komercyjne',
] as const;

export type AdminStatsPeriod = (typeof ADMIN_STATS_PERIODS)[number];
export type AdminStatsTabId = (typeof ADMIN_STATS_TABS)[number]['id'];

const ESTATEOS_TIMEZONE = 'Europe/Warsaw';
const WEEKDAY_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

/** MySQL DATETIME / ISO z API — czas ścienny Warszawa na serwerze produkcyjnym. */
export function parseStatsDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) {
    return instantFromWarsawWall(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    );
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return instantFromWarsawWall(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    );
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

function instantFromWarsawWall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: ESTATEOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  let t = target - 2 * 3_600_000;
  for (let i = 0; i < 5; i++) {
    const parts = fmt.formatToParts(new Date(t));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value || 0);
    const actual = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    const delta = target - actual;
    if (delta === 0) break;
    t += delta;
  }
  return new Date(t);
}

function warsawHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: ESTATEOS_TIMEZONE, hour: 'numeric', hour12: false }).format(d),
  );
}

function warsawDay(d: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: ESTATEOS_TIMEZONE, weekday: 'short' }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function warsawYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ESTATEOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function warsawYm(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ESTATEOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${mo}`;
}

export function formatStatsDateTime(value: string | Date | null | undefined): string {
  const d = parseStatsDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: ESTATEOS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode === 'UNKNOWN') return '🌍';
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

export function processAdminStatsChartData(period: AdminStatsPeriod, timeline: any) {
  if (!timeline) return [] as any[];
  const now = new Date();
  const buckets: any[] = [];

  if (period === 'Godziny Szczytu') {
    for (let i = 0; i < 24; i += 1) {
      buckets.push({
        name: `${String(i).padStart(2, '0')}:00`,
        hourMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else if (period === 'Dni Szczytu') {
    for (let i = 0; i < 7; i += 1) {
      buckets.push({
        name: WEEKDAY_PL[i],
        dayMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else if (period === 'Ostatnie 30 Dni') {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        name: d.toLocaleDateString('pl-PL', { timeZone: ESTATEOS_TIMEZONE, day: '2-digit', month: 'short' }),
        dateMatch: warsawYmd(d),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else if (period === 'Ten Rok') {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        name: d.toLocaleDateString('pl-PL', { timeZone: ESTATEOS_TIMEZONE, month: 'short' }),
        dateMatch: warsawYm(d),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else {
    const y = now.getFullYear();
    for (let year = y - 5; year <= y; year += 1) {
      buckets.push({
        name: String(year),
        dateMatch: String(year),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set<string>(),
      });
    }
  }

  const assignToBucket = (dateStr: string, callback: (bucket: any) => void) => {
    const d = parseStatsDate(dateStr);
    if (Number.isNaN(d.getTime())) return;
    let match: any;
    if (period === 'Godziny Szczytu') match = buckets.find((b) => b.hourMatch === warsawHour(d));
    else if (period === 'Dni Szczytu') match = buckets.find((b) => b.dayMatch === warsawDay(d));
    else if (period === 'Ostatnie 30 Dni') match = buckets.find((b) => b.dateMatch === warsawYmd(d));
    else if (period === 'Ten Rok') match = buckets.find((b) => b.dateMatch === warsawYm(d));
    else {
      const year = new Intl.DateTimeFormat('en-CA', { timeZone: ESTATEOS_TIMEZONE, year: 'numeric' }).format(d);
      match = buckets.find((b) => b.dateMatch === year);
    }
    if (match) callback(match);
  };

  timeline.visits?.forEach((v: any) => {
    assignToBucket(v.createdAt, (b) => {
      b.pageViews += 1;
      b.uniqueIps.add(String(v.ip || ''));
    });
  });
  timeline.offers?.forEach((o: any) => {
    assignToBucket(o.createdAt, (b) => {
      b.offers += 1;
    });
  });
  timeline.users?.forEach((u: any) => {
    assignToBucket(u.createdAt, (b) => {
      b.users += 1;
    });
  });

  return buckets.map((b) => ({ ...b, uniqueViews: b.uniqueIps.size }));
}

export function buildAdminStatsVisitorsList(timeline: any) {
  if (Array.isArray(timeline?.visitors) && timeline.visitors.length > 0) {
    return timeline.visitors
      .map((v: any) => ({
        ip: v.ip,
        country: v.countryCode || v.country,
        count: v.count,
        mainPageViews: v.mainPageViews,
        lastVisit: parseStatsDate(v.lastVisit),
        city: v.city,
        deviceType: v.deviceType,
      }))
      .slice(0, 50);
  }

  if (!timeline?.visits) return [] as any[];
  const vMap = new Map<string, any>();
  timeline.visits.forEach((v: any) => {
    const at = parseStatsDate(v.createdAt);
    const existing = vMap.get(v.ip);
    if (!existing || at > existing.lastVisit) {
      vMap.set(v.ip, {
        ip: v.ip,
        country: v.country,
        count: (existing?.count || 0) + 1,
        mainPageViews: (existing?.mainPageViews || 0) + (v.path === '/' ? 1 : 0),
        lastVisit: at,
        path: v.path,
      });
    } else {
      existing.count += 1;
      if (v.path === '/') existing.mainPageViews += 1;
    }
  });
  return Array.from(vMap.values())
    .sort((a: any, b: any) => b.lastVisit.getTime() - a.lastVisit.getTime())
    .slice(0, 50);
}

const PROPERTY_FILTER_MAP: Record<string, string[]> = {
  Mieszkanie: ['FLAT', 'Mieszkanie', 'MIESZKANIE'],
  Dom: ['HOUSE', 'Dom', 'DOM'],
  'Działka': ['PLOT', 'Działka', 'DZIALKA', 'Działka'],
  Komercyjne: ['COMMERCIAL', 'Komercyjne', 'KOMERCYJNE'],
};

export function buildAdminStatsMarketData(stats: any, marketFilter: string) {
  if (!stats?.timeline?.offers) return null;

  let filtered = stats.timeline.offers.filter(
    (o: any) => String(o.status || '').toUpperCase() !== 'REJECTED',
  );
  if (marketFilter !== 'Wszystkie') {
    const allowed = PROPERTY_FILTER_MAP[marketFilter] || [marketFilter];
    filtered = filtered.filter((o: any) => allowed.includes(String(o.propertyType || '')));
  }

  let totalWarsawPrice = 0;
  let totalWarsawArea = 0;
  const districtMap = new Map<string, { totalPrice: number; totalArea: number; count: number }>();

  filtered.forEach((o: any) => {
    const price = parseInt(String(o.price || '0').replace(/\D/g, ''), 10) || 0;
    const areaStr = String(o.area || '0').replace(',', '.').replace(/[^\d.]/g, '');
    const area = parseFloat(areaStr) || 0;

    if (price > 0 && area > 0) {
      totalWarsawPrice += price;
      totalWarsawArea += area;

      const d = o.district || 'Inna';
      if (!districtMap.has(d)) districtMap.set(d, { totalPrice: 0, totalArea: 0, count: 0 });
      const dStats = districtMap.get(d)!;
      dStats.totalPrice += price;
      dStats.totalArea += area;
      dStats.count += 1;
    }
  });

  const avgWarsawSqm = totalWarsawArea > 0 ? Math.round(totalWarsawPrice / totalWarsawArea) : 0;
  const districts = Array.from(districtMap.entries())
    .map(([name, data]) => ({
      name,
      avgSqm: data.totalArea > 0 ? Math.round(data.totalPrice / data.totalArea) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.avgSqm - a.avgSqm);

  const maxDistrictPrice = districts.length > 0 ? districts[0].avgSqm : 1;
  return { avgWarsawSqm, districts, maxDistrictPrice };
}

export function buildAdminStatsInsights(stats: any) {
  if (stats?.insights) return stats.insights;
  const timeline = stats?.timeline;
  if (!timeline) return null;

  const weekdays = WEEKDAY_PL.map((day, dayIndex) => ({
    day,
    dayIndex,
    visits: 0,
    offers: 0,
    users: 0,
  }));

  const bump = (createdAt: string, field: 'visits' | 'offers' | 'users') => {
    const d = parseStatsDate(createdAt);
    if (Number.isNaN(d.getTime())) return;
    const idx = warsawDay(d);
    if (weekdays[idx]) weekdays[idx][field] += 1;
  };

  timeline.visits?.forEach((v: any) => bump(v.createdAt, 'visits'));
  timeline.offers?.forEach((o: any) => bump(o.createdAt, 'offers'));
  timeline.users?.forEach((u: any) => bump(u.createdAt, 'users'));

  const pick = (field: 'visits' | 'offers', mode: 'max' | 'min') => {
    const rows = weekdays.filter((r) => r[field] > 0);
    if (!rows.length) return null;
    return rows.reduce((best, row) => (mode === 'max' ? (row[field] > best[field] ? row : best) : row[field] < best[field] ? row : best));
  };

  return {
    weekdays,
    visits: { best: pick('visits', 'max'), worst: pick('visits', 'min') },
    offers: { best: pick('offers', 'max'), worst: pick('offers', 'min') },
    monthlyOffers: [],
    yearlyOffers: [],
  };
}
