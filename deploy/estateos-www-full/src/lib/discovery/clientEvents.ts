export const DISCOVERY_UPDATED_EVENT = "discovery:updated";

export type DiscoveryUpdatedDetail = {
  offerId: number;
  eventType: "LIKE" | "DISLIKE" | "SERIOUS" | "OPEN";
};

const BROADCAST_KEY = "estateos:discovery-updated";

export function dispatchDiscoveryUpdated(detail: DiscoveryUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DISCOVERY_UPDATED_EVENT, { detail }));
  try {
    // Cross-tab: keep /moj-kierunek live while scoring offers in another tab.
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
