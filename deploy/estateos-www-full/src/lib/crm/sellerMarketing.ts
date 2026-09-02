import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendClientPortalWebPush } from "@/lib/crm/clientPortalWebPush";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { buildPortalUrl } from "@/lib/agencyClientNotify";
import type { PublicLinkPreview } from "@/lib/crm/publicLinkPreview";
import {
  extractFacebookDestinations,
  facebookClientOpenHref,
  facebookShareRecordGate,
  isPendingPublicationStatus,
  listingThumbnailFallback,
  parseFacebookDestination,
  publicationHeadline,
  resolveMarketingChannel,
  type FacebookGroupDestination,
} from "@/lib/crm/marketingChannel";
import { offerSharePath } from "@/lib/publicListingPath";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import { absolutizeMediaUrl, resolvePublicAppOrigin } from "@/lib/offerShareLanding";

export const MARKETING_ACTIVITY = {
  ESTATEOS_ACTIVATED: "ESTATEOS_ACTIVATED",
  ESTATEOS_PROMOTED: "ESTATEOS_PROMOTED",
  EXTERNAL_PORTAL_LISTED: "EXTERNAL_PORTAL_LISTED",
  EXTERNAL_PORTAL_UPDATED: "EXTERNAL_PORTAL_UPDATED",
  MARKETING_NOTE: "MARKETING_NOTE",
  /** @deprecated use ESTATEOS_PROMOTED */
  LISTING_FEATURED: "LISTING_FEATURED",
  /** @deprecated use EXTERNAL_PORTAL_LISTED */
  EXTERNAL_PORTAL: "EXTERNAL_PORTAL",
  MARKET_REPORT: "MARKET_REPORT_SENT",
} as const;

export const MARKETING_KINDS = [
  MARKETING_ACTIVITY.ESTATEOS_ACTIVATED,
  MARKETING_ACTIVITY.ESTATEOS_PROMOTED,
  MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
  MARKETING_ACTIVITY.EXTERNAL_PORTAL_UPDATED,
  MARKETING_ACTIVITY.MARKETING_NOTE,
  MARKETING_ACTIVITY.LISTING_FEATURED,
  MARKETING_ACTIVITY.EXTERNAL_PORTAL,
  MARKETING_ACTIVITY.MARKET_REPORT,
] as const;

export type MarketingMetadata = {
  visibleToClient?: boolean;
  offerId?: number | null;
  sourceActivityId?: number | null;
  portal?: string | null;
  externalUrl?: string | null;
  status?: "active" | "paused" | "expired" | string | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  renewalDueAt?: string | null;
  promotedUntil?: string | null;
  note?: string | null;
  siteName?: string | null;
  host?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  evidenceUrl?: string | null;
  evidenceName?: string | null;
  evidenceMimeType?: string | null;
  renewalReminderSentAt?: string | null;
  url?: string | null;
  days?: number | null;
  until?: string | null;
  activityId?: number | null;
  groupName?: string | null;
  groupUrl?: string | null;
  groupId?: string | null;
};

export type MarketingTimelineItem = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId: number | null;
  createdAt: string;
  visibleToClient: boolean;
  portal: string | null;
  externalUrl: string | null;
  status: string | null;
  publishedAt: string | null;
  renewalDueAt: string | null;
  promotedUntil: string | null;
  siteName: string | null;
  image: string | null;
  sourceActivityId: number | null;
  evidenceUrl: string | null;
  evidenceName: string | null;
  groupName: string | null;
  groupUrl: string | null;
};

export type SellerNextStepPayload = {
  currentStep: string;
  nextAction: string;
  clientMessage: string | null;
  dueAt: string | null;
  visibleToClient: boolean;
  updatedAt: string;
};

export type ClientDecisionPayload = {
  id: number;
  kind: string;
  title: string;
  clientMessage: string;
  status: string;
  clientResponse: string | null;
  dueAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseMarketingMetadata(raw: unknown): MarketingMetadata {
  if (!raw || typeof raw !== "object") return {};
  return raw as MarketingMetadata;
}

export function isMarketingActivityKind(kind: string): boolean {
  return (MARKETING_KINDS as readonly string[]).includes(kind);
}

/** Client visibility is opt-in; missing legacy flags remain private. */
export function isActivityVisibleToClient(metadata: unknown): boolean {
  const meta = parseMarketingMetadata(metadata);
  return meta.visibleToClient === true;
}

export function normalizeExternalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    );
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseOptionalDate(raw: unknown): Date | null {
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date : null;
}

function buildMarketingMetadata(
  base: MarketingMetadata,
  visibleToClient: boolean,
): Prisma.InputJsonObject {
  return {
    ...base,
    visibleToClient,
  } as Prisma.InputJsonObject;
}

async function notifyClientIfVisible(params: {
  clientId: number;
  visibleToClient: boolean;
  title: string;
  body: string;
  email?: { to: string; subject: string; html: string };
  tag?: string;
  notificationType?: string;
}) {
  if (!params.visibleToClient) {
    return { emailed: false, pushed: 0 };
  }

  let emailed = false;
  if (params.email) {
    const client = await prisma.agencyClient.findUnique({
      where: { id: params.clientId },
      select: { portalToken: true },
    });
    const portalUrl = client?.portalToken
      ? buildPortalUrl(client.portalToken)
      : "https://estateos.pl";
    emailed = await sendTransactionalEmail({
      to: params.email.to,
      subject: params.email.subject,
      html: params.email.html.replace(
        /\{\{portalUrl\}\}/g,
        escapeHtml(portalUrl),
      ),
    });
  }

  const push = await sendClientPortalWebPush(params.clientId, {
    title: params.title,
    body: params.body.slice(0, 180),
    tag: params.tag || `seller-marketing-${params.clientId}`,
    notificationType: params.notificationType || "seller_marketing",
    native: true,
  });

  return { emailed, pushed: push.sent || 0 };
}

export function shapeMarketingTimelineItem(activity: {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId: number | null;
  createdAt: Date;
  metadata: unknown;
}): MarketingTimelineItem {
  const meta = parseMarketingMetadata(activity.metadata);
  const externalUrl =
    (typeof meta.externalUrl === "string" && meta.externalUrl) ||
    (typeof meta.url === "string" && meta.url) ||
    null;
  return {
    id: activity.id,
    kind: activity.kind,
    title: activity.title,
    body: activity.body,
    offerId:
      activity.offerId ??
      (typeof meta.offerId === "number" ? meta.offerId : null),
    createdAt: activity.createdAt.toISOString(),
    visibleToClient: isActivityVisibleToClient(activity.metadata),
    portal:
      typeof meta.portal === "string"
        ? meta.portal
        : meta.siteName || meta.host || null,
    externalUrl,
    status: typeof meta.status === "string" ? meta.status : "active",
    publishedAt: typeof meta.publishedAt === "string" ? meta.publishedAt : null,
    renewalDueAt:
      typeof meta.renewalDueAt === "string" ? meta.renewalDueAt : null,
    promotedUntil:
      typeof meta.promotedUntil === "string"
        ? meta.promotedUntil
        : typeof meta.until === "string"
          ? meta.until
          : null,
    siteName: typeof meta.siteName === "string" ? meta.siteName : null,
    image: typeof meta.image === "string" ? meta.image : null,
    sourceActivityId:
      typeof meta.sourceActivityId === "number" ? meta.sourceActivityId : null,
    evidenceUrl: typeof meta.evidenceUrl === "string" ? meta.evidenceUrl : null,
    evidenceName:
      typeof meta.evidenceName === "string" ? meta.evidenceName : null,
    groupName:
      typeof meta.groupName === "string"
        ? meta.groupName
        : parseFacebookDestination(externalUrl)?.groupName || null,
    groupUrl:
      typeof meta.groupUrl === "string"
        ? meta.groupUrl
        : parseFacebookDestination(externalUrl)?.groupUrl || null,
  };
}

async function deliverMarketingNotification(activityId: number) {
  const queued = await prisma.sellerMarketingNotification.findUnique({
    where: { activityId },
    include: {
      activity: {
        include: {
          client: {
            select: { email: true, firstName: true },
          },
        },
      },
    },
  });
  if (!queued || queued.status === "SENT") return { emailed: false, pushed: 0 };

  const activity = queued.activity;
  if (!isActivityVisibleToClient(activity.metadata)) {
    await prisma.sellerMarketingNotification.update({
      where: { id: queued.id },
      data: { status: "CANCELLED", lastError: null },
    });
    return { emailed: false, pushed: 0 };
  }

  try {
    const result = await notifyClientIfVisible({
      clientId: activity.clientId,
      visibleToClient: true,
      title: activity.title || "Aktualizacja promocji oferty",
      body: activity.body || "",
      tag: `marketing-${activity.id}`,
      notificationType: "seller_marketing",
      email: activity.client.email
        ? {
            to: activity.client.email,
            subject: activity.title || "Aktualizacja promocji oferty",
            html: `<div style="font-family:-apple-system,sans-serif;padding:24px;color:#111">
              <p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#059669;font-weight:800">EstateOS™ · sprzedaż</p>
              <h2 style="margin:8px 0 12px">${escapeHtml(activity.title || "Aktualizacja promocji oferty")}</h2>
              <p>Dzień dobry ${escapeHtml(activity.client.firstName)},</p>
              <p>${escapeHtml(activity.body || "")}</p>
              <p><a href="{{portalUrl}}" style="display:inline-block;background:#10b981;color:#052e1c;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none">Otwórz panel współpracy</a></p>
            </div>`,
          }
        : undefined,
    });
    await prisma.sellerMarketingNotification.update({
      where: { id: queued.id },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        sentAt: new Date(),
        lastError: null,
      },
    });
    return result;
  } catch (error) {
    await prisma.sellerMarketingNotification.update({
      where: { id: queued.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 2000),
      },
    });
    return { emailed: false, pushed: 0 };
  }
}

export async function recordMarketingActivity(params: {
  clientId: number;
  agencyUserId: number;
  kind: string;
  title: string;
  body: string;
  offerId?: number | null;
  metadata?: MarketingMetadata;
  visibleToClient?: boolean;
  notifyEmail?: boolean;
}) {
  const client = await prisma.agencyClient.findFirst({
    where: {
      id: params.clientId,
      agencyUserId: params.agencyUserId,
      status: "ACTIVE",
    },
    select: { id: true, email: true, firstName: true, type: true },
  });
  if (!client) return { ok: false as const, error: "Nie znaleziono klienta." };

  const visibleToClient = params.visibleToClient === true;
  const metadata = buildMarketingMetadata(
    {
      ...(params.metadata || {}),
      offerId: params.offerId ?? params.metadata?.offerId ?? null,
      publishedBy: params.agencyUserId,
      publishedAt: params.metadata?.publishedAt || new Date().toISOString(),
    },
    visibleToClient,
  );

  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: params.agencyUserId,
        kind: params.kind,
        title: params.title.slice(0, 255),
        body: params.body,
        offerId: params.offerId ?? null,
        metadata,
      },
    });
    if (visibleToClient) {
      await tx.sellerMarketingNotification.create({
        data: {
          activityId: created.id,
          clientId: client.id,
          status: "PENDING",
        },
      });
    }
    return created;
  });

  const notification = visibleToClient
    ? await deliverMarketingNotification(activity.id)
    : { emailed: false, pushed: 0 };

  return {
    ok: true as const,
    activityId: activity.id,
    visibleToClient,
    emailed: notification.emailed,
    pushed: notification.pushed,
  };
}

export async function setMarketingActivityVisibility(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
  visibleToClient: boolean;
}) {
  const activity = await prisma.agencyClientActivity.findFirst({
    where: {
      id: params.activityId,
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
    },
  });
  if (!activity || !isMarketingActivityKind(activity.kind)) {
    return {
      ok: false as const,
      error: "Nie znaleziono wpisu marketingowego.",
    };
  }

  const meta = parseMarketingMetadata(activity.metadata);
  const wasVisible = isActivityVisibleToClient(activity.metadata);
  const update = prisma.agencyClientActivity.update({
    where: { id: activity.id },
    data: {
      metadata: buildMarketingMetadata(meta, params.visibleToClient),
    },
  });
  const notificationMutation = params.visibleToClient
    ? prisma.sellerMarketingNotification.upsert({
        where: { activityId: activity.id },
        create: {
          activityId: activity.id,
          clientId: params.clientId,
          status: "PENDING",
        },
        update: {
          status: wasVisible ? undefined : "PENDING",
          lastError: null,
        },
      })
    : prisma.sellerMarketingNotification.updateMany({
        where: { activityId: activity.id },
        data: { status: "CANCELLED", lastError: null },
      });
  await prisma.$transaction([update, notificationMutation]);

  const notification =
    params.visibleToClient && !wasVisible
      ? await deliverMarketingNotification(activity.id)
      : { emailed: false, pushed: 0 };

  return {
    ok: true as const,
    visibleToClient: params.visibleToClient,
    ...notification,
  };
}

export async function addExternalPortalListing(params: {
  clientId: number;
  agencyUserId: number;
  preview: PublicLinkPreview;
  visibleToClient?: boolean;
  portal?: string | null;
  status?: string | null;
  note?: string | null;
  publishedAt?: Date | null;
  renewalDueAt?: Date | null;
  evidenceUrl?: string | null;
  evidenceName?: string | null;
  evidenceMimeType?: string | null;
  groupName?: string | null;
}) {
  const client = await prisma.agencyClient.findFirst({
    where: {
      id: params.clientId,
      agencyUserId: params.agencyUserId,
      status: "ACTIVE",
    },
    select: { id: true, linkedOfferId: true },
  });
  if (!client) return { ok: false as const, error: "Nie znaleziono klienta." };

  const publishedAt = params.publishedAt || new Date();
  const renewalDueAt = params.renewalDueAt || null;
  const facebook = parseFacebookDestination(params.preview.url);
  const groupName =
    params.groupName?.trim() ||
    params.preview.groupName ||
    facebook?.groupName ||
    null;
  const groupUrl = params.preview.groupUrl || facebook?.groupUrl || null;
  const headline = publicationHeadline({
    kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
    portal: params.portal || params.preview.host,
    siteName: params.preview.siteName,
    host: params.preview.host,
    url: params.preview.url,
    groupName,
    groupUrl,
    title: params.preview.title,
  });

  return recordMarketingActivity({
    clientId: client.id,
    agencyUserId: params.agencyUserId,
    kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
    offerId: client.linkedOfferId,
    title: headline,
    body: params.note?.trim()
      ? params.note.trim()
      : groupName
        ? `Ogłoszenie jest widoczne na Facebooku w grupie „${groupName}”.`
        : `Twoja nieruchomość jest widoczna na ${params.preview.siteName}. Link do ogłoszenia znajdziesz w panelu.`,
    visibleToClient: params.visibleToClient === true,
    metadata: {
      portal: params.portal || params.preview.host,
      externalUrl: params.preview.url,
      url: params.preview.url,
      host: params.preview.host,
      siteName: params.preview.siteName,
      title: params.preview.title,
      description: params.preview.description,
      image: params.preview.image,
      status: params.status || "active",
      publishedAt: publishedAt.toISOString(),
      renewalDueAt: renewalDueAt?.toISOString() || null,
      note: params.note || null,
      evidenceUrl: params.evidenceUrl || null,
      evidenceName: params.evidenceName || null,
      evidenceMimeType: params.evidenceMimeType || null,
      groupName,
      groupUrl,
      groupId: facebook?.groupId || facebook?.groupSlug || null,
    },
  });
}

export async function updateExternalPortalListing(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
  url?: string | null;
  status?: string | null;
  note?: string | null;
  renewalDueAt?: Date | null;
  visibleToClient?: boolean;
  groupName?: string | null;
  groupUrl?: string | null;
}) {
  const activity = await prisma.agencyClientActivity.findFirst({
    where: {
      id: params.activityId,
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: {
        in: [
          MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
          MARKETING_ACTIVITY.EXTERNAL_PORTAL,
          MARKETING_ACTIVITY.EXTERNAL_PORTAL_UPDATED,
        ],
      },
    },
  });
  if (!activity)
    return {
      ok: false as const,
      error: "Nie znaleziono publikacji zewnętrznej.",
    };

  const meta = parseMarketingMetadata(activity.metadata);
  const nextUrl = params.url
    ? normalizeExternalUrl(params.url)
    : meta.externalUrl || meta.url || null;
  if (params.url && !nextUrl) {
    return { ok: false as const, error: "Link publikacji jest nieprawidłowy." };
  }
  const visibleToClient =
    params.visibleToClient ?? isActivityVisibleToClient(activity.metadata);
  const sourceActivityId = meta.sourceActivityId || activity.id;
  const nextStatus = params.status || meta.status || "active";
  const facebook = parseFacebookDestination(nextUrl || params.groupUrl || meta.groupUrl);
  const groupName =
    params.groupName?.trim() ||
    meta.groupName ||
    facebook?.groupName ||
    null;
  const groupUrl =
    params.groupUrl ||
    meta.groupUrl ||
    facebook?.groupUrl ||
    null;
  const updated = await recordMarketingActivity({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_UPDATED,
    title: `${nextStatus === "removed" ? "Usunięto" : "Zaktualizowano"} publikację na ${groupName || meta.portal || meta.siteName || "portalu"}`,
    body:
      params.note?.trim() ||
      activity.body ||
      "Zaktualizowano publikację zewnętrzną.",
    offerId: activity.offerId,
    visibleToClient,
    metadata: {
      ...meta,
      sourceActivityId,
      externalUrl: nextUrl,
      url: nextUrl,
      status: nextStatus,
      renewalDueAt:
        params.renewalDueAt?.toISOString() || meta.renewalDueAt || null,
      note: params.note ?? meta.note ?? null,
      publishedBy: params.agencyUserId,
      publishedAt: new Date().toISOString(),
      renewalReminderSentAt: null,
      groupName,
      groupUrl,
      groupId: facebook?.groupId || facebook?.groupSlug || meta.groupId || null,
    },
  });

  return updated;
}

export async function removeExternalPortalListing(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
  note?: string | null;
}) {
  const result = await updateExternalPortalListing({
    ...params,
    status: "removed",
    renewalDueAt: null,
    visibleToClient: false,
  });
  return result;
}

export async function recordEstateosPromotion(params: {
  clientId: number;
  agencyUserId: number;
  offerId: number;
  until: Date;
  days: number;
  visibleToClient?: boolean;
}) {
  const untilLabel = params.until.toLocaleDateString("pl-PL");
  return recordMarketingActivity({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: MARKETING_ACTIVITY.ESTATEOS_PROMOTED,
    offerId: params.offerId,
    title: "Wyróżnienie na EstateOS™",
    body: `Ogłoszenie jest wyróżnione w katalogu EstateOS™ przez ${params.days} dni (do ${untilLabel}). To podbicie widoczności — osobno od samej publikacji na platformie.`,
    visibleToClient: params.visibleToClient === true,
    metadata: {
      promotedUntil: params.until.toISOString(),
      until: params.until.toISOString(),
      days: params.days,
      offerId: params.offerId,
    },
  });
}

export async function upsertSellerNextStep(params: {
  clientId: number;
  agencyUserId: number;
  currentStep: string;
  nextAction: string;
  clientMessage?: string | null;
  dueAt?: Date | null;
  visibleToClient?: boolean;
}) {
  const currentStep = params.currentStep.trim();
  const nextAction = params.nextAction.trim();
  if (currentStep.length < 2 || nextAction.length < 2) {
    return {
      ok: false as const,
      error: "Uzupełnij bieżący krok i następne działanie.",
    };
  }
  const owned = await prisma.agencyClient.findFirst({
    where: {
      id: params.clientId,
      agencyUserId: params.agencyUserId,
      type: "SELLER",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!owned)
    return {
      ok: false as const,
      error: "Nie znaleziono klienta sprzedającego.",
    };

  const row = await prisma.sellerNextStep.upsert({
    where: { clientId: params.clientId },
    create: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      currentStep: currentStep.slice(0, 255),
      nextAction: nextAction.slice(0, 255),
      clientMessage: params.clientMessage?.trim() || null,
      dueAt: params.dueAt || null,
      visibleToClient: params.visibleToClient === true,
    },
    update: {
      agencyUserId: params.agencyUserId,
      currentStep: currentStep.slice(0, 255),
      nextAction: nextAction.slice(0, 255),
      clientMessage: params.clientMessage?.trim() || null,
      dueAt: params.dueAt || null,
      visibleToClient: params.visibleToClient === true,
    },
  });

  return { ok: true as const, nextStep: shapeSellerNextStep(row) };
}

export function shapeSellerNextStep(row: {
  currentStep: string;
  nextAction: string;
  clientMessage: string | null;
  dueAt: Date | null;
  visibleToClient: boolean;
  updatedAt: Date;
}): SellerNextStepPayload {
  return {
    currentStep: row.currentStep,
    nextAction: row.nextAction,
    clientMessage: row.clientMessage,
    dueAt: row.dueAt?.toISOString() || null,
    visibleToClient: row.visibleToClient,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createClientDecisionRequest(params: {
  clientId: number;
  agencyUserId: number;
  kind: string;
  title: string;
  clientMessage: string;
  dueAt?: Date | null;
}) {
  const title = params.title.trim();
  const clientMessage = params.clientMessage.trim();
  const kind = params.kind.trim() || "other";
  if (title.length < 3 || clientMessage.length < 5) {
    return {
      ok: false as const,
      error: "Uzupełnij tytuł i komunikat dla klienta.",
    };
  }
  const owned = await prisma.agencyClient.findFirst({
    where: {
      id: params.clientId,
      agencyUserId: params.agencyUserId,
      type: "SELLER",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!owned)
    return {
      ok: false as const,
      error: "Nie znaleziono klienta sprzedającego.",
    };

  const row = await prisma.clientDecisionRequest.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: kind.slice(0, 64),
      title: title.slice(0, 255),
      clientMessage,
      dueAt: params.dueAt || null,
      status: "PENDING",
    },
  });

  await notifyClientIfVisible({
    clientId: params.clientId,
    visibleToClient: true,
    title: "Potrzebujemy Twojej decyzji",
    body: title,
    tag: `decision-${row.id}`,
  });

  return { ok: true as const, decision: shapeClientDecision(row) };
}

export function shapeClientDecision(row: {
  id: number;
  kind: string;
  title: string;
  clientMessage: string;
  status: string;
  clientResponse: string | null;
  dueAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}): ClientDecisionPayload {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    clientMessage: row.clientMessage,
    status: row.status,
    clientResponse: row.clientResponse,
    dueAt: row.dueAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() || null,
  };
}

export function clientDecisionResolution(
  response: "approve" | "reject" | "comment",
) {
  const status =
    response === "approve"
      ? "APPROVED"
      : response === "reject"
        ? "REJECTED"
        : "PENDING";
  return { status, resolved: status !== "PENDING" };
}

export async function respondToClientDecision(params: {
  clientId: number;
  decisionId: number;
  response: "approve" | "reject" | "comment";
  comment?: string | null;
}) {
  const decision = await prisma.clientDecisionRequest.findFirst({
    where: {
      id: params.decisionId,
      clientId: params.clientId,
      status: "PENDING",
    },
  });
  if (!decision)
    return { ok: false as const, error: "Nie znaleziono oczekującej decyzji." };

  const comment = params.comment?.trim() || null;
  if (params.response === "comment" && (!comment || comment.length < 3)) {
    return { ok: false as const, error: "Dopisz komentarz." };
  }

  const resolution = clientDecisionResolution(params.response);
  const status = resolution.status;
  const resolvedAt = resolution.resolved ? new Date() : null;

  const updated = await prisma.clientDecisionRequest.update({
    where: { id: decision.id },
    data: {
      status,
      clientResponse: comment,
      resolvedAt,
    },
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: decision.agencyUserId,
      kind: "CLIENT_DECISION_RESPONSE",
      title: `${status === "PENDING" ? "Komentarz" : "Odpowiedź"} klienta: ${decision.title}`,
      body:
        comment ||
        (status === "APPROVED"
          ? "Zaakceptowano."
          : status === "REJECTED"
            ? "Odrzucono."
            : "Dodano komentarz."),
      metadata: {
        decisionId: decision.id,
        status,
        visibleToClient: false,
      },
    },
  });

  await sendNotificationToAgent(
    decision.agencyUserId,
    params.clientId,
    updated,
  );

  return { ok: true as const, decision: shapeClientDecision(updated) };
}

async function sendNotificationToAgent(
  agencyUserId: number,
  clientId: number,
  decision: { title: string; status: string; clientResponse: string | null },
) {
  const { sendNotification } = await import("@/lib/core/notification.core");
  const { crmAgentPushData } = await import("@/lib/crm/agentPush");
  await sendNotification({
    userId: agencyUserId,
    type: "CRM_EVENT",
    title:
      decision.status === "PENDING" ? "Komentarz klienta" : "Decyzja klienta",
    body: `${decision.title}: ${decision.status}${decision.clientResponse ? ` — ${decision.clientResponse.slice(0, 80)}` : ""}`,
    data: crmAgentPushData(clientId, {
      notificationType: "crm_client_decision",
    }),
  }).catch(() => {});
}

const EXTERNAL_PORTAL_KINDS = new Set<string>([
  MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
  MARKETING_ACTIVITY.EXTERNAL_PORTAL_UPDATED,
  MARKETING_ACTIVITY.EXTERNAL_PORTAL,
]);

export function extractActiveChannels(
  timeline: MarketingTimelineItem[],
  options: { includePaused?: boolean; visibleOnly?: boolean } = {},
) {
  const channels: Array<{
    portal: string;
    externalUrl: string | null;
    status: string | null;
    renewalDueAt: string | null;
    activityId: number;
  }> = [];
  const seen = new Set<string>();

  for (const item of timeline) {
    if (!EXTERNAL_PORTAL_KINDS.has(item.kind)) {
      continue;
    }
    const key = `source:${item.sourceActivityId || item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (options.visibleOnly && !isClientVisibleMarketingItem(item)) continue;
    if (
      item.status === "expired" ||
      item.status === "removed" ||
      isPendingPublicationStatus(item.status) ||
      (item.status === "paused" && options.includePaused === false)
    ) {
      continue;
    }
    channels.push({
      portal: item.groupName || item.portal || item.siteName || "Portal",
      externalUrl:
        facebookClientOpenHref({
          url: item.externalUrl,
          groupUrl: item.groupUrl,
        }) || item.externalUrl,
      status: item.status,
      renewalDueAt: item.renewalDueAt,
      activityId: item.id,
    });
  }

  return channels;
}

export function isClientVisibleMarketingItem(item: MarketingTimelineItem) {
  if (!item.visibleToClient) return false;
  return !isPendingPublicationStatus(item.status);
}

export function filterClientMarketingTimeline(
  timeline: MarketingTimelineItem[],
) {
  return timeline.filter(isClientVisibleMarketingItem);
}

export const SELLER_LISTING_PATH_JOURNEY_KINDS = [
  "PRESENTATION",
  "PRESENTATION_CHANGE",
  "PRESENTATION_CONFIRMED",
  "LISTING_LINKED",
] as const;

export type SellerListingPathItem = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  startsAt: string | null;
  url: string | null;
  image: string | null;
  siteName: string | null;
  groupName: string | null;
  groupUrl: string | null;
  portal: string | null;
  status: string | null;
  renewalDueAt: string | null;
  promotedUntil: string | null;
};

export function buildSellerListingPath(params: {
  activities: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    offerId: number | null;
    createdAt: Date;
    metadata: unknown;
  }>;
  linkedOfferId: number | null;
  listingImage?: string | null;
}): SellerListingPathItem[] {
  const items: SellerListingPathItem[] = [];
  for (const activity of params.activities) {
    const meta =
      activity.metadata && typeof activity.metadata === "object"
        ? (activity.metadata as Record<string, unknown>)
        : {};
    const shaped = shapeMarketingTimelineItem(activity);
    if (isMarketingActivityKind(activity.kind)) {
      if (!isClientVisibleMarketingItem(shaped)) continue;
    } else if (
      !(SELLER_LISTING_PATH_JOURNEY_KINDS as readonly string[]).includes(
        activity.kind,
      )
    ) {
      continue;
    } else {
      const oid = Number(activity.offerId || meta.offerId || 0);
      if (oid && params.linkedOfferId && oid !== params.linkedOfferId) continue;
    }

    const channel = resolveMarketingChannel({
      kind: shaped.kind,
      portal: shaped.portal,
      siteName: shaped.siteName,
      url: shaped.externalUrl,
      groupName: shaped.groupName,
      groupUrl: shaped.groupUrl,
      title: shaped.title,
    });
    items.push({
      id: activity.id,
      kind: activity.kind,
      title: activity.title,
      body: activity.body,
      createdAt: activity.createdAt.toISOString(),
      startsAt: typeof meta.startsAt === "string" ? meta.startsAt : null,
      url:
        facebookClientOpenHref({
          url: shaped.externalUrl,
          groupUrl: shaped.groupUrl,
        }) || shaped.externalUrl,
      image: listingThumbnailFallback({
        image: shaped.image,
        channelId: channel.id,
        listingImage: params.listingImage,
      }),
      siteName: shaped.siteName,
      groupName: shaped.groupName,
      groupUrl: shaped.groupUrl,
      portal: shaped.portal,
      status: shaped.status,
      renewalDueAt: shaped.renewalDueAt,
      promotedUntil: shaped.promotedUntil,
    });
  }
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function shouldSendRenewalReminder(
  metadata: MarketingMetadata,
  now: Date,
  reminderDays = 3,
) {
  if (
    metadata.status === "removed" ||
    metadata.status === "expired" ||
    metadata.status === "paused" ||
    metadata.renewalReminderSentAt
  ) {
    return false;
  }
  const dueAt = parseOptionalDate(metadata.renewalDueAt);
  if (!dueAt) return false;
  const windowEnd = new Date(
    now.getTime() + reminderDays * 24 * 60 * 60 * 1000,
  );
  const staleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return dueAt <= windowEnd && dueAt >= staleCutoff;
}

export async function loadSellerPortalMarketing(
  clientId: number,
  options: { visibleOnly?: boolean } = {},
) {
  const [activities, nextStep, pendingDecisions, client] = await Promise.all([
    prisma.agencyClientActivity.findMany({
      where: { clientId, kind: { in: [...MARKETING_KINDS] } },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        offerId: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.sellerNextStep.findUnique({ where: { clientId } }),
    prisma.clientDecisionRequest.findMany({
      where: { clientId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.agencyClient.findUnique({
      where: { id: clientId },
      select: {
        linkedOffer: {
          select: {
            id: true,
            status: true,
            promotedUntil: true,
            expiresAt: true,
          },
        },
      },
    }),
  ]);

  const allTimeline = activities.map(shapeMarketingTimelineItem);
  const marketingTimeline = options.visibleOnly
    ? filterClientMarketingTimeline(allTimeline)
    : allTimeline;

  return {
    estateos: client?.linkedOffer
      ? {
          offerId: client.linkedOffer.id,
          status: client.linkedOffer.status,
          published:
            String(client.linkedOffer.status).toUpperCase() === "ACTIVE",
          featured: Boolean(
            client.linkedOffer.promotedUntil &&
            client.linkedOffer.promotedUntil.getTime() > Date.now(),
          ),
          promotedUntil:
            client.linkedOffer.promotedUntil?.toISOString() || null,
          publicationEndsAt:
            client.linkedOffer.expiresAt?.toISOString() || null,
        }
      : null,
    marketingTimeline,
    facebookGroups: extractFacebookDestinations(allTimeline),
    activeChannels: extractActiveChannels(allTimeline, {
      includePaused: !options.visibleOnly,
      visibleOnly: options.visibleOnly,
    }),
    sellerNextStep:
      nextStep && (!options.visibleOnly || nextStep.visibleToClient)
        ? shapeSellerNextStep(nextStep)
        : null,
    pendingDecisions: pendingDecisions.map(shapeClientDecision),
  };
}

export async function tickSellerMarketingRenewals(now = new Date()) {
  const rows = await prisma.agencyClientActivity.findMany({
    where: {
      kind: { in: [...EXTERNAL_PORTAL_KINDS] },
      client: { status: "ACTIVE", type: "SELLER" },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true,
      clientId: true,
      agencyUserId: true,
      kind: true,
      metadata: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });

  const seen = new Set<string>();
  let sent = 0;

  for (const row of rows) {
    const meta = parseMarketingMetadata(row.metadata);
    const key = `source:${meta.sourceActivityId || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const renewalDueAt = parseOptionalDate(meta.renewalDueAt);
    if (!renewalDueAt || !shouldSendRenewalReminder(meta, now)) continue;

    const portal = meta.portal || meta.siteName || meta.host || "portalu";
    const clientName = `${row.client.firstName} ${row.client.lastName}`.trim();
    const overdue = renewalDueAt < now;
    const dueLabel = renewalDueAt.toLocaleDateString("pl-PL");
    const { sendNotification } = await import("@/lib/core/notification.core");
    const { crmAgentPushData } = await import("@/lib/crm/agentPush");
    await sendNotification({
      userId: row.agencyUserId,
      type: "CRM_EVENT",
      title: overdue
        ? "Publikacja wymaga odnowienia"
        : "Zbliża się odnowienie publikacji",
      body: `${clientName} · ${portal} · ${overdue ? "termin minął" : `termin ${dueLabel}`}`,
      data: crmAgentPushData(row.clientId, {
        notificationType: "crm_seller_renewal",
      }),
    }).catch(() => {});

    await prisma.agencyClientActivity.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...meta,
          renewalReminderSentAt: now.toISOString(),
        } as Prisma.InputJsonObject,
      },
    });
    sent += 1;
  }

  return { scanned: rows.length, sent };
}

export async function retryPendingMarketingNotifications(limit = 100) {
  const pending = await prisma.sellerMarketingNotification.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 5 },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { activityId: true },
  });
  let delivered = 0;
  for (const row of pending) {
    const result = await deliverMarketingNotification(row.activityId);
    if (result.emailed || result.pushed > 0) delivered += 1;
  }
  return { queued: pending.length, delivered };
}

export type FacebookShareOffer = {
  id: number;
  title: string;
  city: string | null;
  price: number | null;
  imageUrl: string | null;
  linkedClientId: number | null;
};

export function listingFacebookShareUrl(offerId: number, agencyUserId: number) {
  return `${resolvePublicAppOrigin()}${offerSharePath(offerId, { presentingAgentId: agencyUserId })}`;
}

export async function loadAgentFacebookDestinations(
  agencyUserId: number,
): Promise<FacebookGroupDestination[]> {
  const rows = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId,
      kind: { in: [...EXTERNAL_PORTAL_KINDS] },
      client: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: {
      kind: true,
      offerId: true,
      createdAt: true,
      metadata: true,
    },
  });
  return extractFacebookDestinations(
    rows.map((row) => {
      const meta = parseMarketingMetadata(row.metadata);
      return {
        kind: row.kind,
        offerId: row.offerId,
        createdAt: row.createdAt.toISOString(),
        portal: meta.portal,
        siteName: meta.siteName,
        host: meta.host,
        externalUrl: meta.externalUrl || meta.url,
        groupName: meta.groupName,
        groupUrl: meta.groupUrl,
      };
    }),
  );
}

export async function loadAgentShareOffers(
  agencyUserId: number,
): Promise<FacebookShareOffer[]> {
  const [offers, clients] = await Promise.all([
    prisma.offer.findMany({
      where: {
        userId: agencyUserId,
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: {
        id: true,
        title: true,
        city: true,
        price: true,
        images: true,
      },
    }),
    prisma.agencyClient.findMany({
      where: {
        agencyUserId,
        status: "ACTIVE",
        type: "SELLER",
        linkedOfferId: { not: null },
      },
      select: { id: true, linkedOfferId: true },
    }),
  ]);
  const clientByOffer = new Map(
    clients
      .filter((row) => row.linkedOfferId)
      .map((row) => [row.linkedOfferId as number, row.id]),
  );
  return offers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    city: offer.city || null,
    price: offer.price == null ? null : Number(offer.price),
    imageUrl: absolutizeMediaUrl(resolveOfferPrimaryImage(offer)) || null,
    linkedClientId: clientByOffer.get(offer.id) || null,
  }));
}

export async function recordFacebookGroupShare(params: {
  agencyUserId: number;
  clientId: number;
  offerId: number;
  groupName?: string | null;
  groupUrl?: string | null;
  postUrl?: string | null;
  confirmed?: boolean;
  visibleToClient?: boolean;
  renewalDueAt?: Date | null;
}) {
  if (
    !facebookShareRecordGate({
      confirmed: params.confirmed,
      postUrl: params.postUrl,
    })
  ) {
    return {
      ok: false as const,
      error:
        "Wklej link do konkretnego posta na grupie, nie do samej grupy. Na Facebooku: ⋯ przy poście → Kopiuj link.",
    };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId, userId: params.agencyUserId },
    select: { id: true, title: true, images: true },
  });
  if (!offer) {
    return { ok: false as const, error: "Nie znaleziono ogłoszenia do wystawienia." };
  }

  const linkedClient = await prisma.agencyClient.findFirst({
    where: {
      agencyUserId: params.agencyUserId,
      status: "ACTIVE",
      type: "SELLER",
      linkedOfferId: offer.id,
    },
    select: { id: true },
  });
  const currentClient = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId },
    select: { id: true, linkedOfferId: true },
  });
  const targetClientId =
    linkedClient?.id ||
    (currentClient?.linkedOfferId === offer.id ? currentClient.id : null);
  const facebook = parseFacebookDestination(params.postUrl || params.groupUrl);
  const groupName = params.groupName?.trim() || facebook?.groupName || "Facebook";
  const groupUrl = facebook?.groupUrl || params.groupUrl || null;
  const shareUrl = listingFacebookShareUrl(offer.id, params.agencyUserId);
  const recordedUrl = String(params.postUrl || "").trim();
  const listingImage =
    absolutizeMediaUrl(resolveOfferPrimaryImage(offer)) || null;

  if (!targetClientId) {
    return {
      ok: true as const,
      activityId: null,
      visibleToClient: false,
      emailed: false,
      pushed: 0,
      shareUrl,
      groupUrl,
      groupName,
      offerId: offer.id,
      clientId: null,
    };
  }

  const recorded = await addExternalPortalListing({
    clientId: targetClientId,
    agencyUserId: params.agencyUserId,
    preview: {
      url: recordedUrl,
      host: "facebook.com",
      siteName: "Facebook",
      title: groupName,
      description: `Grupa Facebook: ${groupName}`,
      image: listingImage,
      groupName,
      groupUrl,
    },
    portal: "Facebook",
    status: "active",
    note: `Wystawiono ogłoszenie „${offer.title}” na Facebooku${groupName ? ` · ${groupName}` : ""}.`,
    visibleToClient: params.visibleToClient === true,
    renewalDueAt: params.renewalDueAt,
    groupName,
  });

  return {
    ...recorded,
    shareUrl,
    groupUrl,
    groupName,
    offerId: offer.id,
    clientId: targetClientId,
  };
}
