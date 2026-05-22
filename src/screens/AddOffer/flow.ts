export const ADD_OFFER_TOTAL_STEPS = 6;

/** Czy w Zustand jest sensowny postęp kreatora (nie kończ flow po wyjściu z zakładki). */
export function hasAddOfferDraftProgress(draft: Record<string, unknown> | null | undefined): boolean {
  if (!draft) return false;
  if (String(draft.transactionType || '').trim()) return true;
  if (String(draft.propertyType || '').trim()) return true;
  if (String(draft.title || '').trim()) return true;
  if (String(draft.price || '').trim()) return true;
  if (String(draft.description || '').trim()) return true;
  if (String(draft.street || '').trim() || String(draft.buildingNumber || '').trim()) return true;
  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return true;
  if (Array.isArray(draft.images) && draft.images.length > 0) return true;
  return false;
}

export {
  ADD_OFFER_TITLE_MIN,
  ADD_OFFER_TITLE_MAX,
  ADD_OFFER_DESC_MIN,
  ADD_OFFER_DESC_MAX,
  ADD_OFFER_MIN_IMAGES,
  getStepRequirements,
  isStepValid,
  getStepBlockMessage,
  formatCharMeter,
  meterTone,
  type AddOfferRequirement,
} from './validation';
