export type KeiAiRewriteProgress = {
  working: boolean;
  rewrittenByAi: boolean;
  titleBefore: string;
  titleAfter: string;
  descriptionBefore: string;
  descriptionAfter: string;
  skipReason?: string;
};

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
      step: 'check_duplicate' | 'fetch_portal' | 'create_offer' | 'images' | 'activate';
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
      exported: Array<{
        keiListingId?: string;
        offerId: number;
        portalUrl: string;
        publicUrl: string;
        editUrl: string;
      }>;
      skipped: Array<{
        keiListingId?: string;
        portalUrl: string;
        reason: string;
        existingOfferId?: number;
      }>;
      message: string;
    };

export type KeiExportProgressEmitter = (event: KeiExportProgressEvent) => void;
