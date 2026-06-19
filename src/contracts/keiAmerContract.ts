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
};

export type KeiSessionResponse = {
  ok: boolean;
  loggedIn: boolean;
  message: string;
};

export type KeiPreviewResponse = {
  ok: boolean;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  listings: KeiPreviewListing[];
  message: string;
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
  | { type: 'connected'; message: string }
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

export const KEI_MAX_SELECT = 25;
export const KEI_PAGE_SIZE = 20;
