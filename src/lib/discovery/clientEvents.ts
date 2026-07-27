export const DISCOVERY_UPDATED_EVENT = "discovery:updated";

export type DiscoveryUpdatedDetail = {
  offerId: number;
  eventType: "LIKE" | "DISLIKE" | "SERIOUS" | "OPEN";
};

export function dispatchDiscoveryUpdated(detail: DiscoveryUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DISCOVERY_UPDATED_EVENT, { detail }));
}
