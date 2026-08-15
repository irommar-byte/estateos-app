export type KeiPropertyKind = 'apartment' | 'house';
export type KeiTransactionKind = 'sale' | 'rent';

export type KeiPreviewListing = {
  keiId: string;
  date: string;
  address: string;
  price: string;
  area: string;
  portalUrl: string;
  portalHost?: string;
  sourceLabel: string;
  transactionKind: KeiTransactionKind;
  transactionLabel: string;
  alreadyImported: boolean;
  existingOfferId: number | null;
  outreachSent?: boolean;
  outreachSentAt?: string | null;
  blockedReason?: 'imported' | 'outreach' | 'inactive' | null;
  portalActive?: boolean | null;
  portalCheckReason?: string | null;
};

export type KeiSessionResponse = {
  ok: boolean;
  loggedIn: boolean;
  message: string;
};

export type KeiPreviewResponse = {
  ok: boolean;
  mode?: 'feed' | 'search';
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  listings: KeiPreviewListing[];
  message: string;
  verified?: boolean;
};

export type KeiListingSearchParams = {
  mode?: 'feed' | 'search';
  propertyKind: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
  page?: number;
  pageSize?: number;
  selectionPool?: boolean;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  dateFrom?: string;
  dateTo?: string;
  verify?: boolean;
};

export type KeiFacetOption = {
  id: string;
  label: string;
  count: number;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  dateFrom?: string;
  dateTo?: string;
};

export type KeiSearchFacetsResponse = {
  ok: boolean;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  sampled: number;
  districts: KeiFacetOption[];
  priceRanges: KeiFacetOption[];
  areaRanges: KeiFacetOption[];
  datePresets: KeiFacetOption[];
};

export type KeiImportJobSnapshot = {
  id: string;
  adminUserId: number;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  message: string;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  items: Array<{
    index: number;
    keiListingId: string;
    portalUrl: string;
    address?: string;
    status: 'pending' | 'active' | 'done' | 'skipped';
    completedSteps: KeiImportStepId[];
    currentStep: KeiImportStepId | null;
    stepLabel: string;
    stepDetail?: string;
    imageProgress?: { index: number; total: number; label: string; asFloorPlan: boolean };
    offerId?: number;
    publicUrl?: string;
    editUrl?: string;
    reason?: string;
  }>;
  exported: KeiExportResultItem[];
  skipped: KeiExportSkippedItem[];
  cancelRequested: boolean;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type KeiPeekResponse = {
  ok: boolean;
  portalUrl: string;
  title: string;
  imageCount: number;
  lastImageUrl: string | null;
  suggestedFloorPlan: boolean;
  suggestedFloorPlanIndex: number | null;
  imageUrls: string[];
  previewUrls: string[];
};

export type KeiFloorPlanSelection = {
  enabled: boolean;
  imageIndex: number;
};

export type KeiExportSelection = {
  keiId?: string;
  portalUrl: string;
  address?: string;
};

export type KeiAiRewriteProgress = {
  working: boolean;
  rewrittenByAi: boolean;
  titleBefore: string;
  titleAfter: string;
  descriptionBefore: string;
  descriptionAfter: string;
  skipReason?: string;
};

export type KeiExportRequest = {
  targetUserId?: number;
  agentCommissionPercent?: number;
  count?: number;
  propertyKind?: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
  selections?: KeiExportSelection[];
  floorPlanOverrides?: Record<string, boolean>;
  floorPlanSelections?: Record<string, KeiFloorPlanSelection>;
};

export type KeiImportStepId = 'check_duplicate' | 'fetch_portal' | 'create_offer' | 'images' | 'activate';

export type KeiExportProgressEvent =
  | { type: 'connected'; message: string; jobId?: string }
  | { type: 'batch_start'; total: number }
  | {
      type: 'item_start';
      index: number;
      total: number;
      keiListingId: string;
      portalUrl: string;
      address?: string;
    }
  | {
      type: 'step';
      index: number;
      step: KeiImportStepId;
      label: string;
      detail?: string;
    }
  | {
      type: 'ai_rewrite';
      index: number;
      rewrite: KeiAiRewriteProgress;
    }
  | {
      type: 'image_progress';
      index: number;
      imageIndex: number;
      imageTotal: number;
      asFloorPlan: boolean;
      label: string;
    }
  | {
      type: 'floor_plan_decision';
      index: number;
      portalUrl: string;
      lastImageUrl: string | null;
      asFloorPlan: boolean;
      source: 'override' | 'auto';
    }
  | {
      type: 'item_done';
      index: number;
      keiListingId: string;
      offerId: number;
      portalUrl: string;
      publicUrl: string;
      editUrl: string;
    }
  | {
      type: 'item_skip';
      index: number;
      keiListingId: string;
      portalUrl: string;
      reason: string;
      existingOfferId?: number;
    }
  | { type: 'batch_done'; message: string; exportedCount: number; skippedCount: number }
  | { type: 'error'; message: string }
  | {
      type: 'result';
      ok: boolean;
      exported: KeiExportResultItem[];
      skipped: KeiExportSkippedItem[];
      message: string;
    };

export type KeiExportResultItem = {
  keiListingId?: string;
  offerId: number;
  portalUrl: string;
  publicUrl: string;
  editUrl: string;
};

export type KeiExportSkippedItem = {
  keiListingId?: string;
  portalUrl: string;
  reason: string;
  existingOfferId?: number;
};

export const KEI_IMPORT_STEPS: KeiImportStepId[] = [
  'check_duplicate',
  'fetch_portal',
  'create_offer',
  'images',
  'activate',
];

export const KEI_STEP_LABELS: Record<KeiImportStepId, string> = {
  check_duplicate: 'Duplikat',
  fetch_portal: 'Portal',
  create_offer: 'Oferta',
  images: 'Zdjęcia',
  activate: 'Publikacja',
};

export function keiFallbackDatePresets(now = new Date()): KeiFacetOption[] {
  const isoDay = (offset: number) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  return [
    { id: '7d', label: 'Ostatnie 7 dni', count: -1, dateFrom: isoDay(-7) },
    { id: '30d', label: 'Ostatnie 30 dni', count: -1, dateFrom: isoDay(-30) },
    { id: '90d', label: 'Ostatnie 90 dni', count: -1, dateFrom: isoDay(-90) },
    { id: 'older90', label: 'Starsze niż 90 dni', count: -1, dateTo: isoDay(-91) },
  ];
}
export const KEI_MAX_SELECT = 25;
export const KEI_PAGE_SIZE = 20;

export const KEI_FALLBACK_DISTRICTS: KeiFacetOption[] = [
  'Bemowo',
  'Białołęka',
  'Bielany',
  'Mokotów',
  'Ochota',
  'Praga-Południe',
  'Praga-Północ',
  'Rembertów',
  'Śródmieście',
  'Targówek',
  'Ursus',
  'Ursynów',
  'Wawer',
  'Wesoła',
  'Wilanów',
  'Włochy',
  'Wola',
  'Żoliborz',
].map((name) => ({ id: name, label: name, count: -1, district: name }));

export const KEI_FALLBACK_SALE_PRICE_RANGES: KeiFacetOption[] = [
  { id: 'lt500k', label: 'do 500 tys.', count: -1, maxPrice: 499_999 },
  { id: '500-800k', label: '500–800 tys.', count: -1, minPrice: 500_000, maxPrice: 799_999 },
  { id: '800k-1.2m', label: '800 tys.–1,2 mln', count: -1, minPrice: 800_000, maxPrice: 1_199_999 },
  { id: '1.2-2m', label: '1,2–2 mln', count: -1, minPrice: 1_200_000, maxPrice: 1_999_999 },
  { id: 'gt2m', label: 'powyżej 2 mln', count: -1, minPrice: 2_000_000 },
];

export const KEI_FALLBACK_RENT_PRICE_RANGES: KeiFacetOption[] = [
  { id: 'lt3k', label: 'do 3 tys.', count: -1, maxPrice: 2_999 },
  { id: '3-5k', label: '3–5 tys.', count: -1, minPrice: 3_000, maxPrice: 4_999 },
  { id: '5-8k', label: '5–8 tys.', count: -1, minPrice: 5_000, maxPrice: 7_999 },
  { id: '8-12k', label: '8–12 tys.', count: -1, minPrice: 8_000, maxPrice: 11_999 },
  { id: 'gt12k', label: 'powyżej 12 tys.', count: -1, minPrice: 12_000 },
];

export const KEI_FALLBACK_APARTMENT_AREA_RANGES: KeiFacetOption[] = [
  { id: 'lt40', label: 'do 40 m²', count: -1, maxArea: 39.99 },
  { id: '40-55', label: '40–55 m²', count: -1, minArea: 40, maxArea: 54.99 },
  { id: '55-70', label: '55–70 m²', count: -1, minArea: 55, maxArea: 69.99 },
  { id: '70-90', label: '70–90 m²', count: -1, minArea: 70, maxArea: 89.99 },
  { id: '90-120', label: '90–120 m²', count: -1, minArea: 90, maxArea: 119.99 },
  { id: 'gt120', label: 'powyżej 120 m²', count: -1, minArea: 120 },
];

export const KEI_FALLBACK_HOUSE_AREA_RANGES: KeiFacetOption[] = [
  { id: 'lt100', label: 'do 100 m²', count: -1, maxArea: 99.99 },
  { id: '100-150', label: '100–150 m²', count: -1, minArea: 100, maxArea: 149.99 },
  { id: '150-200', label: '150–200 m²', count: -1, minArea: 150, maxArea: 199.99 },
  { id: '200-300', label: '200–300 m²', count: -1, minArea: 200, maxArea: 299.99 },
  { id: 'gt300', label: 'powyżej 300 m²', count: -1, minArea: 300 },
];
