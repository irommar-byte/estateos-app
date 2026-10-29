import {
  friendlyPromotionName,
  promotionGroupId,
  promotionGroupLabel,
} from "@/lib/crm/marketingChannel";
import { PORTAL_TR_PL, type PortalTr } from "@/i18n/portal/translate";

export type PortalStackKind = "reports" | "promotions" | "presentations" | "path";

export type PortalStackable = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  portal?: string | null;
  siteName?: string | null;
  groupName?: string | null;
  status?: string | null;
};

export type PortalStack = {
  kind: PortalStackKind;
  label: string;
  kicker: string;
  summary: string;
  latestAt: string;
  items: PortalStackable[];
};

export const PORTAL_STACK_ORDER: PortalStackKind[] = [
  "reports",
  "promotions",
  "presentations",
  "path",
];

const STACK_LABEL: Record<PortalStackKind, string> = {
  reports: "Raporty rynkowe",
  promotions: "Promocja oferty",
  presentations: "Prezentacje",
  path: "Pozostałe kroki",
};

const STACK_KICKER: Record<PortalStackKind, string> = {
  reports: "Dokumenty dla Państwa",
  promotions: "Gdzie oferta jest widoczna",
  presentations: "Spotkania i pokazy",
  path: "Ścieżka sprzedaży",
};

export function portalStackKind(kind: string): PortalStackKind {
  const k = String(kind || "").toUpperCase();
  if (k === "MARKET_REPORT_SENT") return "reports";
  if (
    k === "PRESENTATION" ||
    k === "PRESENTATION_CHANGE" ||
    k === "PRESENTATION_CONFIRMED" ||
    k === "PRESENTATION_PROPOSED" ||
    k === "PRESENTATION_CHANGE_PROPOSED" ||
    k === "MEETING_CHANGE_PROPOSED" ||
    k === "MEETING_CONFIRMED" ||
    k === "OPEN_HOUSE_PROPOSAL" ||
    k === "OPEN_HOUSE_CONFIRMED" ||
    k === "OPEN_HOUSE_STARTED" ||
    k === "AUCTION_PROPOSAL" ||
    k === "AUCTION_CONFIRMED" ||
    k === "AUCTION_STARTED"
  ) {
    return "presentations";
  }
  if (
    k === "ESTATEOS_ACTIVATED" ||
    k === "ESTATEOS_PROMOTED" ||
    k === "LISTING_FEATURED" ||
    k === "EXTERNAL_PORTAL_LISTED" ||
    k === "EXTERNAL_PORTAL_UPDATED" ||
    k === "EXTERNAL_PORTAL" ||
    k === "MARKETING_NOTE" ||
    k === "OTHER_AGENCY_OUTREACH"
  ) {
    return "promotions";
  }
  return "path";
}

export function marketReportPortalPath(token: string, activityId: number): string {
  return `/klient/${encodeURIComponent(token)}/raport/${activityId}`;
}

export function marketReportPortalHref(
  token: string,
  activityId: number,
  origin = "https://estateos.pl",
): string {
  return `${origin.replace(/\/+$/, "")}${marketReportPortalPath(token, activityId)}`;
}

function formatWhen(iso: string, tr: PortalTr) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(tr.dateLocale, { day: "numeric", month: "short", year: "numeric" });
}

function uniqueNames(values: Array<string | null | undefined>, limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

function channelName(item: PortalStackable): string {
  return promotionGroupLabel(promotionGroupId(item));
}

export function promotionChannelFoldSummary(
  params: { count: number; latestAt?: string; activeCount: number },
  tr: PortalTr = PORTAL_TR_PL,
): string {
  const parts = [`${params.count} ${tr.p(params.count, "publikacja|publikacje|publikacji")}`];
  if (params.activeCount > 0) parts.push(tr.t("{n} aktywne", { n: params.activeCount }));
  if (params.latestAt) parts.push(tr.t("ost. {date}", { date: formatWhen(params.latestAt, tr) }));
  return parts.join(" · ");
}

/** Jedna krótka linia pod nagłówkiem stosu — szczegóły są po rozwinięciu. */
export function summarizePortalStack(
  kind: PortalStackKind,
  items: PortalStackable[],
  options?: { activePortals?: string[] },
  tr: PortalTr = PORTAL_TR_PL,
): string {
  if (kind === "promotions") {
    const live = uniqueNames((options?.activePortals || []).map((name) => friendlyPromotionName(name)));
    const names = live.length ? live : uniqueNames(items.map(channelName));
    return live.length ? tr.t("Teraz aktywne: {names}", { names: names.join(", ") }) : names.join(", ");
  }
  if (items.length === 1 && kind !== "reports") return items[0]?.title || "";
  return "";
}

export function groupPortalPath(
  items: PortalStackable[],
  options?: { activePortals?: string[] },
  tr: PortalTr = PORTAL_TR_PL,
): PortalStack[] {
  const buckets = new Map<PortalStackKind, PortalStackable[]>();
  for (const item of items) {
    const kind = portalStackKind(item.kind);
    const list = buckets.get(kind) || [];
    list.push(item);
    buckets.set(kind, list);
  }
  return PORTAL_STACK_ORDER.flatMap((kind) => {
    const list = buckets.get(kind);
    if (!list?.length) return [];
    return [
      {
        kind,
        label: tr.t(STACK_LABEL[kind]),
        kicker: tr.t(STACK_KICKER[kind]),
        summary: summarizePortalStack(kind, list, options, tr),
        latestAt: list[0].createdAt,
        items: list,
      },
    ];
  });
}
