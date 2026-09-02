import type { PortalMarketingTimelineItem } from "../services/clientPortalService";
import { isPendingPublicationStatus } from "./marketingChannel";

export type PortalListingPathItem = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  startsAt?: string | null;
  url?: string | null;
  image?: string | null;
  siteName?: string | null;
  groupName?: string | null;
  groupUrl?: string | null;
  portal?: string | null;
  status?: string | null;
  promotedUntil?: string | null;
  renewalDueAt?: string | null;
  reportId?: number | null;
};

export function filterVisibleMarketingTimeline(
  items: PortalMarketingTimelineItem[] | null | undefined,
): PortalMarketingTimelineItem[] {
  return (items || []).filter(
    (item) =>
      item.visibleToClient === true &&
      !isPendingPublicationStatus(item.status),
  );
}

export function resolveSellerPortalTimeline(payload: {
  listingPath?: PortalListingPathItem[] | null;
  marketingTimeline?: PortalMarketingTimelineItem[] | null;
}): PortalMarketingTimelineItem[] {
  if (payload.listingPath && payload.listingPath.length > 0) {
    return payload.listingPath.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      portal: item.portal ?? null,
      externalUrl: item.url ?? null,
      status: item.status ?? null,
      renewalDueAt: item.renewalDueAt ?? null,
      promotedUntil: item.promotedUntil ?? null,
      siteName: item.siteName,
      visibleToClient: true,
      groupName: item.groupName,
      groupUrl: item.groupUrl,
      image: item.image,
    }));
  }
  return filterVisibleMarketingTimeline(payload.marketingTimeline);
}

export function isSellerPortalPayload(
  type: string | null | undefined,
): boolean {
  return String(type || "").toUpperCase() === "SELLER";
}

export function summarizeSellerPortal(payload: {
  type?: string;
  listingPath?: PortalListingPathItem[];
  marketingTimeline?: PortalMarketingTimelineItem[];
  pendingDecisions?: { id: number }[];
  activeChannels?: { portal: string }[];
}) {
  return {
    isSeller: isSellerPortalPayload(payload.type),
    timelineCount: resolveSellerPortalTimeline(payload).length,
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
  listingPath?: PortalListingPathItem[];
  marketingTimeline?: PortalMarketingTimelineItem[];
}) {
  return {
    listingState: payload.listing ? ("ready" as const) : ("preparing" as const),
    hasNextStep: Boolean(payload.sellerNextStep),
    pendingDecisionCount: payload.pendingDecisions?.length || 0,
    visibleTimelineCount: resolveSellerPortalTimeline(payload).length,
  };
}
