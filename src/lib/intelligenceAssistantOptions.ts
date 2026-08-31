export type IntelligenceLockKey =
  | 'districts'
  | 'maxPrice'
  | 'minArea'
  | 'maxArea'
  | 'minYear'
  | 'minRooms'
  | 'requireBalcony'
  | 'requireGarden'
  | 'requireElevator'
  | 'requireParking'
  | 'requireFurnished';

export type IntelligenceLocks = Record<IntelligenceLockKey, boolean>;

export type IntelligenceChoice = { value: number; label: string };

export const DEFAULT_INTELLIGENCE_LOCKS: IntelligenceLocks = {
  districts: false,
  maxPrice: false,
  minArea: false,
  maxArea: false,
  minYear: false,
  minRooms: false,
  requireBalcony: false,
  requireGarden: false,
  requireElevator: false,
  requireParking: false,
  requireFurnished: false,
};

export const INTELLIGENCE_INTERVAL_OPTIONS: IntelligenceChoice[] = [
  { value: 6, label: 'Co 6 godz.' },
  { value: 12, label: 'Co 12 godz.' },
  { value: 24, label: 'Raz na dobę' },
  { value: 48, label: 'Co 2 dni' },
  { value: 72, label: 'Co 3 dni' },
  { value: 168, label: 'Raz w tygodniu' },
];

export const INTELLIGENCE_DAILY_LIMIT_OPTIONS: IntelligenceChoice[] = [
  { value: 1, label: '1 oferta' },
  { value: 2, label: '2 oferty' },
  { value: 3, label: '3 oferty' },
];

export const INTELLIGENCE_MIN_LEARNS_OPTIONS: IntelligenceChoice[] = [
  { value: 1, label: 'Po 1 reakcji' },
  { value: 2, label: 'Po 2 reakcjach' },
  { value: 3, label: 'Po 3 reakcjach' },
  { value: 5, label: 'Po 5 reakcjach' },
];

export const INTELLIGENCE_MIN_SCORE_OPTIONS: IntelligenceChoice[] = [
  { value: 75, label: '75% · więcej' },
  { value: 80, label: '80% · balans' },
  { value: 85, label: '85% · pewniej' },
  { value: 92, label: '92% · pewne' },
  { value: 95, label: '95% · ostrożnie' },
];
