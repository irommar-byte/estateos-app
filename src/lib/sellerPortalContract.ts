import type { PortalMarketingTimelineItem } from "../services/clientPortalService";

export function filterVisibleMarketingTimeline(
  items: PortalMarketingTimelineItem[] | null | undefined,
): PortalMarketingTimelineItem[] {
  return (items || []).filter((item) => item.visibleToClient !== false);
}

export function isSellerPortalPayload(
  type: string | null | undefined,
): boolean {
  return String(type || "").toUpperCase() === "SELLER";
}

export function summarizeSellerPortal(payload: {
  type?: string;
  marketingTimeline?: PortalMarketingTimelineItem[];
  pendingDecisions?: { id: number }[];
  activeChannels?: { portal: string }[];
}) {
  return {
    isSeller: isSellerPortalPayload(payload.type),
    timelineCount: filterVisibleMarketingTimeline(payload.marketingTimeline)
      .length,
    pendingDecisionCount: payload.pendingDecisions?.length || 0,
    channelCount: payload.activeChannels?.length || 0,
  };
}

export function isSafeSellerPortalUrl(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildSellerPortalViewState(payload: {
  listing?: unknown | null;
  sellerNextStep?: unknown | null;
  pendingDecisions?: { id: number }[];
  marketingTimeline?: PortalMarketingTimelineItem[];
}) {
  return {
    listingState: payload.listing ? ("ready" as const) : ("preparing" as const),
    hasNextStep: Boolean(payload.sellerNextStep),
    pendingDecisionCount: payload.pendingDecisions?.length || 0,
    visibleTimelineCount: filterVisibleMarketingTimeline(
      payload.marketingTimeline,
    ).length,
  };
}
