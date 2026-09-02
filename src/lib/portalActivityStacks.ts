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
    k === "PRESENTATION_CONFIRMED"
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
    k === "MARKETING_NOTE"
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

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  if (item.groupName) return `Facebook · ${item.groupName}`;
  return item.portal || item.siteName || item.title || "Publikacja";
}

export function summarizePortalStack(
  kind: PortalStackKind,
  items: PortalStackable[],
  options?: { activePortals?: string[] },
): string {
  const latest = items[0];
  const when = latest ? formatWhen(latest.createdAt) : "";
  if (kind === "reports") {
    if (items.length === 1) {
      return `Wysłano ${when}. Otwórz dokument, żeby ponownie odczytać analizę z aktów notarialnych.`;
    }
    return `${items.length} raporty w archiwum. Ostatni: ${when}. Każdy dokument można otworzyć ponownie.`;
  }
  if (kind === "promotions") {
    const live = uniqueNames(options?.activePortals || []);
    const names = uniqueNames(items.map(channelName));
    const liveLine = live.length ? `Teraz aktywne: ${live.join(", ")}. ` : "";
    const countLabel =
      items.length === 1 ? "1 publikacja w historii" : `${items.length} publikacji w historii`;
    return `${liveLine}${countLabel}: ${names.join(", ")}. Ostatnia aktywność: ${when}.`;
  }
  if (kind === "presentations") {
    if (items.length === 1) {
      return `${latest?.title || "Prezentacja"} · ${when}`;
    }
    return `${items.length} wpisy o prezentacjach. Ostatnia: ${when}.`;
  }
  if (items.length === 1) {
    return `${latest?.title || "Aktualizacja"} · ${when}`;
  }
  return `${items.length} kolejne kroki współpracy. Ostatni: ${when}.`;
}

export function groupPortalPath(
  items: PortalStackable[],
  options?: { activePortals?: string[] },
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
        label: STACK_LABEL[kind],
        kicker: STACK_KICKER[kind],
        summary: summarizePortalStack(kind, list, options),
        latestAt: list[0].createdAt,
        items: list,
      },
    ];
  });
}
