import type { CarFormState } from "@/components/cars/CarListingForm";

export const CAR_DRAFT_KEY = "estateos_car_listing_draft_v1";

type DraftPayload = {
  form: CarFormState;
  savedAt: number;
};

export function readCarListingDraft(): DraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CAR_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed?.form || typeof parsed.form !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCarListingDraft(form: CarFormState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: DraftPayload = { form, savedAt: Date.now() };
    window.localStorage.setItem(CAR_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearCarListingDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CAR_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function draftHasContent(form?: Partial<CarFormState> | null): boolean {
  const draft = form || readCarListingDraft()?.form;
  if (!draft) return false;
  const textKeys: (keyof CarFormState)[] = [
    "title",
    "make",
    "model",
    "year",
    "vin",
    "registrationNumber",
    "mileageKm",
    "pricePln",
    "city",
    "description",
  ];
  if (textKeys.some((key) => String(draft[key] || "").trim())) return true;
  if (Array.isArray(draft.images) && draft.images.length > 0) return true;
  return false;
}
