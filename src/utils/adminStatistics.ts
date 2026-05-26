export const ADMIN_STATS_TABS = [
  { id: 'pageViews', label: 'Wizyty', color: '#10b981', icon: 'eye-outline' as const },
  { id: 'uniqueViews', label: 'Unikalni', color: '#3b82f6', icon: 'person-circle-outline' as const },
  { id: 'buyers', label: 'Kupujący', color: '#8b5cf6', icon: 'people-outline' as const },
  { id: 'sellers', label: 'Sprzedający', color: '#f59e0b', icon: 'person-add-outline' as const },
  { id: 'offers', label: 'Oferty', color: '#ec4899', icon: 'home-outline' as const },
  { id: 'agencies', label: 'Agencje', color: '#06b6d4', icon: 'business-outline' as const },
];

export const ADMIN_STATS_PERIODS = [
  'Ostatnie 30 Dni',
  'Ten Rok',
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
        name: `${i}:00`,
        hourMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else if (period === 'Dni Szczytu') {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    for (let i = 0; i < 7; i += 1) {
      buckets.push({
        name: days[i],
        dayMatch: i,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else if (period === 'Ostatnie 30 Dni') {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        name: d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' }),
        dateMatch: d.toISOString().split('T')[0],
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set<string>(),
      });
    }
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        name: d.toLocaleDateString('pl-PL', { month: 'short' }),
        dateMatch: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        pageViews: 0,
        uniqueViews: 0,
        offers: 0,
        agencies: 0,
        privateUsers: 0,
        buyers: 0,
        sellers: 0,
        uniqueIps: new Set<string>(),
      });
    }
  }

  const assignToBucket = (dateStr: string, callback: (bucket: any) => void) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return;
    let match: any;
    if (period === 'Godziny Szczytu') match = buckets.find((b) => b.hourMatch === d.getHours());
    else if (period === 'Dni Szczytu') match = buckets.find((b) => b.dayMatch === d.getDay());
    else if (period === 'Ostatnie 30 Dni') match = buckets.find((b) => b.dateMatch === d.toISOString().split('T')[0]);
    else match = buckets.find((b) => b.dateMatch === d.toISOString().substring(0, 7));
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
      if (o.advertiserType === 'agency') b.agencies += 1;
      else b.privateUsers += 1;
    });
  });
  timeline.users?.forEach((u: any) => {
    assignToBucket(u.createdAt, (b) => {
      if (u.isBuyer) b.buyers += 1;
      if (u.isSeller) b.sellers += 1;
    });
  });

  return buckets.map((b) => ({ ...b, uniqueViews: b.uniqueIps.size }));
}

export function buildAdminStatsVisitorsList(timeline: any) {
  if (!timeline?.visits) return [] as any[];
  const vMap = new Map<string, any>();
  timeline.visits.forEach((v: any) => {
    const existing = vMap.get(v.ip);
    if (!existing || new Date(v.createdAt) > existing.lastVisit) {
      vMap.set(v.ip, {
        ip: v.ip,
        country: v.country,
        count: (existing?.count || 0) + 1,
        mainPageViews: (existing?.mainPageViews || 0) + (v.path === '/' ? 1 : 0),
        lastVisit: new Date(v.createdAt),
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
    (o: any) => String(o.status || '').toUpperCase() !== 'REJECTED'
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
