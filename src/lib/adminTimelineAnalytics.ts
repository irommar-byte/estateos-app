import {
  ESTATEOS_TIMEZONE,
  getWarsawDay,
  getWarsawHour,
  getWarsawYmd,
  getWarsawYm,
  parseMysqlAsWarsawWall,
} from './datetime/warsaw';

export const TIMELINE_TABS = [
  { id: 'pageViews', label: 'Wizyty', color: '#10b981' },
  { id: 'uniqueViews', label: 'Unikalni IP', color: '#3b82f6' },
  { id: 'offers', label: 'Nowe oferty', color: '#ec4899' },
  { id: 'users', label: 'Rejestracje', color: '#8b5cf6' },
] as const;

export const TIMELINE_PERIODS = [
  'Ostatnie 30 Dni',
  'Ten Rok',
  'Według roku',
  'Godziny Szczytu',
  'Dni Szczytu',
] as const;

export type TimelineTabId = (typeof TIMELINE_TABS)[number]['id'];
export type TimelinePeriod = (typeof TIMELINE_PERIODS)[number];

const WEEKDAY_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

export type TimelineInput = {
  visits?: Array<{ ip?: string; createdAt: string | Date }>;
  offers?: Array<{ createdAt: string | Date }>;
  users?: Array<{ createdAt: string | Date }>;
};

type MutableBucket = {
  name: string;
  pageViews: number;
  uniqueViews: number;
  offers: number;
  users: number;
  uniqueIps: Set<string>;
  hourMatch?: number;
  dayMatch?: number;
  dateMatch?: string;
};

export type TimelineChartBucket = {
  name: string;
  pageViews: number;
  uniqueViews: number;
  offers: number;
  users: number;
};

export type WeekdayInsight = {
  day: string;
  dayIndex: number;
  visits: number;
  offers: number;
  users: number;
};

export type TimelineInsights = {
  weekdays: WeekdayInsight[];
  visits: { best: WeekdayInsight | null; worst: WeekdayInsight | null; peakHour: number | null };
  offers: { best: WeekdayInsight | null; worst: WeekdayInsight | null };
  yearlyOffers: Array<{ year: string; count: number }>;
  monthlyOffers: Array<{ month: string; label: string; count: number }>;
  totals: Record<TimelineTabId, number>;
};

function parseAt(value: string | Date): Date | null {
  return parseMysqlAsWarsawWall(value);
}

function warsawNow(): Date {
  return new Date();
}

function createBuckets(period: TimelinePeriod): MutableBucket[] {
  const now = warsawNow();
  const buckets: MutableBucket[] = [];

  if (period === 'Godziny Szczytu') {
    for (let i = 0; i < 24; i += 1) {
      buckets.push({
        name: `${String(i).padStart(2, '0')}:00`,
        hourMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set(),
      });
    }
    return buckets;
  }

  if (period === 'Dni Szczytu') {
    for (let i = 0; i < 7; i += 1) {
      buckets.push({
        name: WEEKDAY_PL[i],
        dayMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set(),
      });
    }
    return buckets;
  }

  if (period === 'Ostatnie 30 Dni') {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        name: d.toLocaleDateString('pl-PL', { timeZone: ESTATEOS_TIMEZONE, day: '2-digit', month: 'short' }),
        dateMatch: getWarsawYmd(d),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set(),
      });
    }
    return buckets;
  }

  if (period === 'Ten Rok') {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        name: d.toLocaleDateString('pl-PL', { timeZone: ESTATEOS_TIMEZONE, month: 'short' }),
        dateMatch: getWarsawYm(d),
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        users: 0,
        uniqueIps: new Set(),
      });
    }
    return buckets;
  }

  const years = new Set<number>();
  const y = now.getFullYear();
  for (let i = y - 5; i <= y; i += 1) years.add(i);
  return Array.from(years)
    .sort((a, b) => a - b)
    .map((year) => ({
      name: String(year),
      dateMatch: String(year),
      pageViews: 0,
      uniqueViews: 0,
      offers: 0,
      users: 0,
      uniqueIps: new Set<string>(),
    }));
}

function findBucket(buckets: MutableBucket[], period: TimelinePeriod, d: Date): MutableBucket | undefined {
  if (period === 'Godziny Szczytu') return buckets.find((b) => b.hourMatch === getWarsawHour(d));
  if (period === 'Dni Szczytu') return buckets.find((b) => b.dayMatch === getWarsawDay(d));
  if (period === 'Ostatnie 30 Dni') return buckets.find((b) => b.dateMatch === getWarsawYmd(d));
  if (period === 'Ten Rok') return buckets.find((b) => b.dateMatch === getWarsawYm(d));
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: ESTATEOS_TIMEZONE, year: 'numeric' }).format(d);
  return buckets.find((b) => b.dateMatch === year);
}

function assign(
  buckets: MutableBucket[],
  period: TimelinePeriod,
  createdAt: string | Date,
  fn: (b: MutableBucket) => void,
) {
  const d = parseAt(createdAt);
  if (!d || Number.isNaN(d.getTime())) return;
  const bucket = findBucket(buckets, period, d);
  if (bucket) fn(bucket);
}

export function buildTimelineChart(period: TimelinePeriod, timeline: TimelineInput | null | undefined): TimelineChartBucket[] {
  if (!timeline) return [];
  const buckets = createBuckets(period);

  timeline.visits?.forEach((v) => {
    assign(buckets, period, v.createdAt, (b) => {
      b.pageViews += 1;
      b.uniqueIps.add(String(v.ip || ''));
    });
  });

  timeline.offers?.forEach((o) => {
    assign(buckets, period, o.createdAt, (b) => {
      b.offers += 1;
    });
  });

  timeline.users?.forEach((u) => {
    assign(buckets, period, u.createdAt, (b) => {
      b.users += 1;
    });
  });

  return buckets.map(({ name, pageViews, offers, users, uniqueIps }) => ({
    name,
    pageViews,
    uniqueViews: uniqueIps.size,
    offers,
    users,
  }));
}

function buildWeekdayRollup(timeline: TimelineInput): WeekdayInsight[] {
  const rows: WeekdayInsight[] = WEEKDAY_PL.map((day, dayIndex) => ({
    day,
    dayIndex,
    visits: 0,
    offers: 0,
    users: 0,
  }));

  const bump = (createdAt: string | Date, field: 'visits' | 'offers' | 'users') => {
    const d = parseAt(createdAt);
    if (!d) return;
    const idx = getWarsawDay(d);
    if (rows[idx]) rows[idx][field] += 1;
  };

  timeline.visits?.forEach((v) => bump(v.createdAt, 'visits'));
  timeline.offers?.forEach((o) => bump(o.createdAt, 'offers'));
  timeline.users?.forEach((u) => bump(u.createdAt, 'users'));

  return rows;
}

function pickExtreme(rows: WeekdayInsight[], field: 'visits' | 'offers', mode: 'max' | 'min'): WeekdayInsight | null {
  const withData = rows.filter((r) => r[field] > 0);
  if (withData.length === 0) return null;
  return withData.reduce((best, row) => {
    if (mode === 'max') return row[field] > best[field] ? row : best;
    return row[field] < best[field] ? row : best;
  });
}

export function buildTimelineInsights(timeline: TimelineInput | null | undefined): TimelineInsights {
  const empty: TimelineInsights = {
    weekdays: WEEKDAY_PL.map((day, dayIndex) => ({ day, dayIndex, visits: 0, offers: 0, users: 0 })),
    visits: { best: null, worst: null, peakHour: null },
    offers: { best: null, worst: null },
    yearlyOffers: [],
    monthlyOffers: [],
    totals: { pageViews: 0, uniqueViews: 0, offers: 0, users: 0 },
  };
  if (!timeline) return empty;

  const weekdays = buildWeekdayRollup(timeline);
  const hourCounts = Array.from({ length: 24 }, () => 0);
  timeline.visits?.forEach((v) => {
    const d = parseAt(v.createdAt);
    if (d) hourCounts[getWarsawHour(d)] += 1;
  });
  const peakHour = hourCounts.some((n) => n > 0) ? hourCounts.indexOf(Math.max(...hourCounts)) : null;

  const yearMap = new Map<string, number>();
  const monthMap = new Map<string, { label: string; count: number }>();
  const currentYear = new Intl.DateTimeFormat('en-CA', { timeZone: ESTATEOS_TIMEZONE, year: 'numeric' }).format(new Date());

  timeline.offers?.forEach((o) => {
    const d = parseAt(o.createdAt);
    if (!d) return;
    const year = new Intl.DateTimeFormat('en-CA', { timeZone: ESTATEOS_TIMEZONE, year: 'numeric' }).format(d);
    yearMap.set(year, (yearMap.get(year) || 0) + 1);
    const ym = getWarsawYm(d);
    if (ym.startsWith(`${currentYear}-`)) {
      const label = d.toLocaleDateString('pl-PL', { timeZone: ESTATEOS_TIMEZONE, month: 'long' });
      const prev = monthMap.get(ym);
      monthMap.set(ym, { label, count: (prev?.count || 0) + 1 });
    }
  });

  const uniqueIps = new Set(timeline.visits?.map((v) => String(v.ip || '')) || []);

  return {
    weekdays,
    visits: {
      best: pickExtreme(weekdays, 'visits', 'max'),
      worst: pickExtreme(weekdays, 'visits', 'min'),
      peakHour,
    },
    offers: {
      best: pickExtreme(weekdays, 'offers', 'max'),
      worst: pickExtreme(weekdays, 'offers', 'min'),
    },
    yearlyOffers: Array.from(yearMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ year, count })),
    monthlyOffers: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, label: data.label, count: data.count })),
    totals: {
      pageViews: timeline.visits?.length || 0,
      uniqueViews: uniqueIps.size,
      offers: timeline.offers?.length || 0,
      users: timeline.users?.length || 0,
    },
  };
}
