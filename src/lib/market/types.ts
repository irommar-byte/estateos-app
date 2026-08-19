export type MarketTypeFilter = 'all' | 'pierwotny' | 'wtorny';

export type ValuationPurpose = 'crm' | 'listing' | 'consumer' | 'hub';

export type ValuationSubject = {
  city: string;
  district?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  area: number;
  rooms?: number | null;
  floor?: number | null;
  marketType?: MarketTypeFilter;
};

export type MarketComp = {
  id: number;
  deedAt: string | null;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  price: number;
  ppsm: number;
  address: string | null;
  district: string | null;
  distanceM: number;
  marketType: string | null;
};

export type PriceScore = {
  score: number;
  tone: 'good' | 'fair' | 'high' | 'low';
  label: string;
  detail: string;
  vsMedianPct: number;
};

export type ValuationResult = {
  ok: true;
  subject: ValuationSubject;
  estimated: {
    low: number;
    mid: number;
    high: number;
    ppsm: number;
    recommendedAsk: number;
  };
  stats: {
    medianPpsm: number;
    meanPpsm: number;
    count: number;
    radiusM: number;
    windowMonths: number;
    basis: 'comps' | 'district' | 'city';
  };
  vsListing: PriceScore | null;
  comps: MarketComp[];
  coverage: {
    city: string;
    source: string;
    ingestedAt: string | null;
    transactionCount: number;
    disclaimer: string;
  };
};

export type ValuationErrorBody = {
  ok: false;
  code: string;
  message: string;
};

export type MarketAreaStatView = {
  city: string;
  district: string;
  periodDays: number;
  txnCount: number;
  avgPpsm: number | null;
  medianPpsm: number | null;
  p25Ppsm: number | null;
  p75Ppsm: number | null;
  yoyChangePct: number | null;
};

export type PricePulseTone = 'up' | 'down' | 'flat';
export type PricePulseDirection = 'rising' | 'falling' | 'stable';

export type PricePulseWindow = {
  days: number;
  listingPpsm: number | null;
  deedPpsm: number | null;
  vsDeedsPct: number | null;
  listingChangePct: number | null;
  deedChangePct: number | null;
  listingCount: number;
  deedCount: number;
};

export type PricePulsePoint = {
  date: string;
  listingPpsm: number | null;
  deedPpsm: number | null;
  vsDeedsPct: number | null;
};

export type PricePulseDistrict = {
  district: string;
  vsDeedsPct: number;
  listingPpsm: number;
  deedPpsm: number;
  listingCount: number;
};

export type PricePulsePayload = {
  ok: true;
  city: string;
  source: string;
  disclaimer: string;
  updatedAt: string;
  vsDeedsPct: number | null;
  listingPpsm: number | null;
  deedPpsm: number | null;
  tone: PricePulseTone;
  direction: PricePulseDirection;
  windows: {
    d7: PricePulseWindow;
    d30: PricePulseWindow;
    d90: PricePulseWindow;
  };
  series: PricePulsePoint[];
  sparkline: Array<number | null>;
  districts: PricePulseDistrict[];
};

export type MarketIntelligencePayload = {
  city: string;
  periodDays: number;
  headline: string;
  yoyChangePct: number | null;
  medianPpsm: number | null;
  txnCount: number;
  fastestGrowing: Array<{ district: string; yoyChangePct: number; medianPpsm: number }>;
  mostExpensive: Array<{ district: string; medianPpsm: number; txnCount: number }>;
  mostDeals: Array<{ district: string; txnCount: number; medianPpsm: number }>;
  updatedAt: string | null;
};
