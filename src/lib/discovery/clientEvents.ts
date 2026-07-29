export const DISCOVERY_UPDATED_EVENT = "discovery:updated";
export const INTELLIGENCE_LEARN_EVENT = "estateos:intelligence-learn";
export const INTELLIGENCE_SHEET_OPEN_EVENT = "estateos:intelligence-sheet-open";

export type DiscoveryUpdatedDetail = {
  offerId: number;
  eventType: "LIKE" | "DISLIKE" | "SERIOUS" | "OPEN";
};

export type IntelligenceLearnDetail = {
  offerId?: number;
  eventType?: string;
  kind?: "like" | "dislike" | "serious" | "open" | "other";
};

const BROADCAST_KEY = "estateos:discovery-updated";

function learnKind(eventType?: string): IntelligenceLearnDetail["kind"] {
  const t = String(eventType || "").toUpperCase();
  if (t.includes("LIKE") && !t.includes("DISLIKE")) return "like";
  if (t.includes("DISLIKE")) return "dislike";
  if (t.includes("SERIOUS") || t.includes("PRIORITY")) return "serious";
  if (t.includes("OPEN")) return "open";
  return "other";
}

export function dispatchDiscoveryUpdated(detail: DiscoveryUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DISCOVERY_UPDATED_EVENT, { detail }));
  const kind = learnKind(detail.eventType);
  if (kind === "like" || kind === "dislike" || kind === "serious") {
    window.dispatchEvent(
      new CustomEvent(INTELLIGENCE_LEARN_EVENT, {
        detail: { offerId: detail.offerId, eventType: detail.eventType, kind } satisfies IntelligenceLearnDetail,
      }),
    );
  }
  try {
    localStorage.setItem(
      BROADCAST_KEY,
      JSON.stringify({ ...detail, ts: Date.now() }),
    );
  } catch {
    /* private mode / quota — same-tab event still works */
  }
}

/** Subscribe to same-tab CustomEvent + cross-tab localStorage ping. */
export function subscribeDiscoveryUpdated(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === BROADCAST_KEY && e.newValue) handler();
  };
  window.addEventListener(DISCOVERY_UPDATED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DISCOVERY_UPDATED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function subscribeIntelligenceLearn(
  handler: (detail?: IntelligenceLearnDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = (e: Event) => {
    handler((e as CustomEvent<IntelligenceLearnDetail>).detail);
  };
  window.addEventListener(INTELLIGENCE_LEARN_EVENT, onCustom);
  return () => window.removeEventListener(INTELLIGENCE_LEARN_EVENT, onCustom);
}

export function dispatchIntelligenceSheetOpen(open: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INTELLIGENCE_SHEET_OPEN_EVENT, { detail: { open } }));
}

export function subscribeIntelligenceSheetOpen(handler: (open: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = (e: Event) => {
    handler(Boolean((e as CustomEvent<{ open: boolean }>).detail?.open));
  };
  window.addEventListener(INTELLIGENCE_SHEET_OPEN_EVENT, onCustom);
  return () => window.removeEventListener(INTELLIGENCE_SHEET_OPEN_EVENT, onCustom);
}
