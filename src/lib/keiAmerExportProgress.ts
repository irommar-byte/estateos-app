export type KeiAiRewriteProgress = {
  working: boolean;
  rewrittenByAi: boolean;
  titleBefore: string;
  titleAfter: string;
  descriptionBefore: string;
  descriptionAfter: string;
  skipReason?: string;
};

/** Dlaczego pozycja nie weszła: duplikat to norma, błąd wymaga uwagi. */
export type KeiSkipKind = 'duplicate' | 'blocked' | 'inactive' | 'quality' | 'error' | 'cancelled';
export type KeiPublishState = 'published' | 'review';

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
      /** Dane do karty postępu (miniatura, tytuł, cena) — po pobraniu z portalu. */
      type: 'item_meta';
      index: number;
      thumbUrl?: string | null;
      title?: string | null;
      price?: number | null;
      area?: number | null;
      district?: string | null;
    }
  | {
      type: 'item_done';
      index: number;
      keiListingId: string;
      offerId: number;
      portalUrl: string;
      publicUrl: string;
      editUrl: string;
      /** published = na rynku; review = szkic czeka na przejrzenie agenta. */
      publishState?: KeiPublishState;
      aiRewritten?: boolean;
      imageCount?: number;
      note?: string;
    }
  | {
      type: 'item_skip';
      index: number;
      keiListingId: string;
      portalUrl: string;
      reason: string;
      existingOfferId?: number;
      kind?: KeiSkipKind;
    }
  | {
      type: 'batch_done';
      message: string;
      exportedCount: number;
      skippedCount: number;
      aiRewrittenCount?: number;
      reviewCount?: number;
    }
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
