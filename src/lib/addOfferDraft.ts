export const ADD_OFFER_DRAFT_VERSION = 2;
export const ADD_OFFER_DRAFT_KEY = "estateos_add_offer_draft";

export type AddOfferDraft = {
  version: number;
  data?: Record<string, unknown>;
  currentStep?: number;
  images?: string[];
  floorPlan?: string | null;
  pendingOfferId?: number | null;
};

export function readAddOfferDraft(): AddOfferDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADD_OFFER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AddOfferDraft;
    if (!parsed || (parsed.version !== 1 && parsed.version !== ADD_OFFER_DRAFT_VERSION)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function patchAddOfferDraft(patch: Partial<AddOfferDraft>) {
  if (typeof window === "undefined") return;
  try {
    const current = readAddOfferDraft() || { version: ADD_OFFER_DRAFT_VERSION };
    window.localStorage.setItem(
      ADD_OFFER_DRAFT_KEY,
      JSON.stringify({
        ...current,
        ...patch,
        version: ADD_OFFER_DRAFT_VERSION,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export function clearAddOfferDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADD_OFFER_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export type PendingOfferResumeState =
  | { mode: "none" }
  | { mode: "reuse"; offerId: number }
  | { mode: "already_submitted"; offerId: number };

export async function resolvePendingOfferForPublish(
  pendingOfferId: number | null | undefined,
): Promise<PendingOfferResumeState> {
  if (!pendingOfferId || !Number.isFinite(pendingOfferId) || pendingOfferId <= 0) {
    return { mode: "none" };
  }
  try {
    const res = await fetch(`/api/offers/${pendingOfferId}/publish-resume`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return { mode: "none" };
    const data = await res.json().catch(() => ({}));
    if (!data?.ok) return { mode: "none" };
    if (data.awaitingReview) {
      return { mode: "already_submitted", offerId: pendingOfferId };
    }
    if (data.reusable) {
      return { mode: "reuse", offerId: pendingOfferId };
    }
    return { mode: "none" };
  } catch {
    return { mode: "none" };
  }
}
