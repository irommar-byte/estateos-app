export type MarketingChannelId =
  | "estateos"
  | "facebook"
  | "otodom"
  | "olx"
  | "gratka"
  | "morizon"
  | "portal"
  | "system";

export type MarketingChannelTone = {
  id: MarketingChannelId;
  label: string;
  badge: string;
  accent: string;
};

export type FacebookDestination = {
  host: "facebook.com";
  postUrl: string;
  groupId: string | null;
  groupSlug: string | null;
  groupName: string | null;
  groupUrl: string | null;
};

export type MarketingChannelInput = {
  kind?: string | null;
  portal?: string | null;
  siteName?: string | null;
  host?: string | null;
  url?: string | null;
  groupName?: string | null;
  groupUrl?: string | null;
  title?: string | null;
};

export type FacebookGroupDestination = {
  key: string;
  groupName: string;
  groupUrl: string | null;
  lastPostedAt: string;
  lastPostUrl: string | null;
  postCount: number;
  lastOfferId: number | null;
};

const CHANNELS: Record<MarketingChannelId, MarketingChannelTone> = {
  estateos: { id: "estateos", label: "EstateOS™", badge: "Wyróżnienie", accent: "#C9A227" },
  facebook: { id: "facebook", label: "Facebook", badge: "Grupa / strona", accent: "#1877F2" },
  otodom: { id: "otodom", label: "Otodom", badge: "Portal", accent: "#00A651" },
  olx: { id: "olx", label: "OLX", badge: "Portal", accent: "#002F34" },
  gratka: { id: "gratka", label: "Gratka", badge: "Portal", accent: "#E85D04" },
  morizon: { id: "morizon", label: "Morizon", badge: "Portal", accent: "#1D4ED8" },
  portal: { id: "portal", label: "Portal", badge: "Publikacja", accent: "#0F766E" },
  system: { id: "system", label: "EstateOS™", badge: "Krok sprzedaży", accent: "#64748B" },
};

function haystack(input: MarketingChannelInput): string {
  return [
    input.kind,
    input.portal,
    input.siteName,
    input.host,
    input.url,
    input.groupName,
    input.groupUrl,
    input.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function hostnameFromUrl(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

export function isFacebookHost(value: string | null | undefined): boolean {
  const host = String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
  return (
    host === "facebook.com" ||
    host === "fb.com" ||
    host === "m.facebook.com" ||
    host.endsWith(".facebook.com")
  );
}

function humanizeGroupSlug(slug: string): string {
  const decoded = decodeURIComponent(slug).trim();
  if (!decoded) return "Grupa Facebook";
  if (/^\d{6,}$/.test(decoded)) return `Grupa ${decoded}`;
  return decoded
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

export function parseFacebookDestination(
  url: string | null | undefined,
): FacebookDestination | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!isFacebookHost(parsed.hostname)) return null;

  const postUrl = parsed.toString();
  const groupMatch = parsed.pathname.match(/\/groups\/([^/?#]+)/i);
  const groupSlug = groupMatch?.[1] ? decodeURIComponent(groupMatch[1]) : null;
  const groupId = groupSlug && /^\d+$/.test(groupSlug) ? groupSlug : null;
  const groupUrl = groupSlug
    ? `https://www.facebook.com/groups/${encodeURIComponent(groupSlug)}/`
    : null;

  return {
    host: "facebook.com",
    postUrl,
    groupId,
    groupSlug,
    groupName: groupSlug ? humanizeGroupSlug(groupSlug) : null,
    groupUrl,
  };
}

export function isFacebookPostPermalink(
  url: string | null | undefined,
): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return false;
  }
  if (!isFacebookHost(parsed.hostname)) return false;
  const path = decodeURIComponent(parsed.pathname).toLowerCase();
  if (/\/groups\/[^/]+\/posts\/[^/]+/.test(path)) return true;
  if (/\/groups\/[^/]+\/permalink\/[^/]+/.test(path)) return true;
  if (path.includes("/permalink.php")) return true;
  if (/\/share\/[pv]\//.test(path)) return true;
  if (
    path.includes("/reel/") ||
    path.includes("/videos/") ||
    path.includes("/watch/")
  ) {
    return true;
  }
  if (path.includes("/photo.php") && parsed.searchParams.has("fbid")) return true;
  if (/\/posts\/(pfbid|\d+)/i.test(path)) return true;
  if (parsed.searchParams.has("story_fbid")) return true;
  if (parsed.searchParams.has("multi_permalinks")) return true;
  if (parsed.searchParams.has("sale_post_id")) return true;
  if (
    parsed.searchParams.get("view") === "permalink" &&
    parsed.searchParams.has("id")
  ) {
    return true;
  }
  return false;
}

export function isFacebookGroupHomeUrl(
  url: string | null | undefined,
): boolean {
  if (isFacebookPostPermalink(url)) return false;
  const dest = parseFacebookDestination(url);
  if (!dest?.groupSlug) return false;
  try {
    const parsed = new URL(
      String(url).trim().startsWith("http")
        ? String(url).trim()
        : `https://${String(url).trim()}`,
    );
    const path = parsed.pathname.replace(/\/+$/, "");
    return /^\/groups\/[^/]+$/i.test(path);
  } catch {
    return false;
  }
}

export function facebookClientOpenHref(params: {
  url?: string | null;
  groupUrl?: string | null;
}): string | null {
  const candidates = [params.url, params.groupUrl].filter(
    (value): value is string => Boolean(value && String(value).trim()),
  );
  const post = candidates.find((value) => isFacebookPostPermalink(value));
  if (post) return post;
  const listing = candidates.find((value) => !isFacebookGroupHomeUrl(value));
  return listing || candidates[0] || null;
}

export function facebookOpenLabel(params: {
  href: string | null;
  groupName?: string | null;
}): string {
  if (params.href && isFacebookPostPermalink(params.href)) {
    return params.groupName
      ? `Zobacz ogłoszenie w grupie ${params.groupName}`
      : "Zobacz ogłoszenie na Facebooku";
  }
  return params.groupName
    ? `Otwórz grupę ${params.groupName}`
    : "Otwórz grupę na Facebooku";
}

export function facebookSharerHref(shareUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
}

export function resolveMarketingChannel(
  input: MarketingChannelInput,
): MarketingChannelTone {
  const kind = String(input.kind || "").toUpperCase();
  if (
    kind === "ESTATEOS_PROMOTED" ||
    kind === "LISTING_FEATURED" ||
    kind === "ESTATEOS_ACTIVATED"
  ) {
    return {
      ...CHANNELS.estateos,
      badge: kind === "ESTATEOS_ACTIVATED" ? "Publikacja" : "Wyróżnienie",
      label:
        kind === "ESTATEOS_ACTIVATED" ? "EstateOS™ katalog" : "Wyróżnienie EstateOS™",
    };
  }
  if (kind === "LISTING_LINKED" || kind === "MARKET_REPORT_SENT") {
    return {
      ...CHANNELS.system,
      label: kind === "LISTING_LINKED" ? "Powiązano ogłoszenie" : "Raport rynkowy",
    };
  }

  const text = haystack(input);
  const host = hostnameFromUrl(input.url) || hostnameFromUrl(input.groupUrl) || "";
  const kindLooksExternal = kind.startsWith("EXTERNAL_PORTAL");
  if (
    isFacebookHost(host) ||
    isFacebookHost(input.portal) ||
    isFacebookHost(input.siteName) ||
    text.includes("facebook") ||
    Boolean(input.groupName && kindLooksExternal)
  ) {
    const dest = parseFacebookDestination(input.url || input.groupUrl);
    return {
      ...CHANNELS.facebook,
      label: input.groupName || dest?.groupName || "Facebook",
    };
  }
  if (text.includes("otodom")) return CHANNELS.otodom;
  if (/(^|[^a-z])olx([^a-z]|$)/.test(text)) return CHANNELS.olx;
  if (text.includes("gratka")) return CHANNELS.gratka;
  if (text.includes("morizon") || text.includes("nieruchomosci-online") || text.includes("domiporta")) {
    if (text.includes("morizon")) return CHANNELS.morizon;
    return { ...CHANNELS.portal, label: input.siteName || input.portal || "Portal" };
  }
  if (
    kind.startsWith("EXTERNAL_PORTAL") ||
    kind === "EXTERNAL_PORTAL"
  ) {
    return {
      ...CHANNELS.portal,
      label: input.siteName || input.portal || input.host || "Portal",
    };
  }
  return CHANNELS.system;
}

export function publicationHeadline(input: MarketingChannelInput): string {
  const channel = resolveMarketingChannel(input);
  if (channel.id === "facebook") {
    const dest = parseFacebookDestination(input.url || input.groupUrl);
    const group = input.groupName || dest?.groupName;
    return group ? `Opublikowano na Facebooku · ${group}` : "Opublikowano na Facebooku";
  }
  if (channel.id === "estateos") return channel.label;
  return `Opublikowano na ${channel.label}`;
}

export function listingThumbnailFallback(params: {
  image?: string | null;
  channelId: MarketingChannelId;
  listingImage?: string | null;
}): string | null {
  if (params.image) return params.image;
  if (params.channelId === "estateos" || params.channelId === "facebook") {
    return params.listingImage || null;
  }
  return null;
}

export function isPendingPublicationStatus(
  status: string | null | undefined,
): boolean {
  const key = String(status || "").trim().toLowerCase();
  return key === "pending" || key === "waiting";
}

export function facebookShareRecordGate(params: {
  confirmed?: boolean;
  postUrl?: string | null;
}): boolean {
  return isFacebookPostPermalink(params.postUrl);
}

export function formatPublicationStatus(status: string | null | undefined): string | null {
  const raw = String(status || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === "active") return "Aktywna";
  if (key === "paused") return "Wstrzymana";
  if (key === "expired") return "Wygasła";
  if (key === "removed") return "Usunięta";
  if (key === "pending" || key === "waiting" || key.includes("aktyw")) {
    return "Czeka na aktywację";
  }
  return raw;
}

export function extractFacebookDestinations(
  items: Array<{
    createdAt: string;
    offerId?: number | null;
    portal?: string | null;
    siteName?: string | null;
    host?: string | null;
    externalUrl?: string | null;
    url?: string | null;
    groupName?: string | null;
    groupUrl?: string | null;
    kind?: string | null;
  }>,
): FacebookGroupDestination[] {
  const map = new Map<string, FacebookGroupDestination>();
  for (const item of items) {
    const url = item.externalUrl || item.url || item.groupUrl || "";
    const channel = resolveMarketingChannel({
      kind: item.kind,
      portal: item.portal,
      siteName: item.siteName,
      host: item.host,
      url,
      groupName: item.groupName,
      groupUrl: item.groupUrl,
    });
    if (channel.id !== "facebook") continue;
    const dest = parseFacebookDestination(url);
    const groupUrl = item.groupUrl || dest?.groupUrl || null;
    const groupName =
      item.groupName || dest?.groupName || channel.label || "Facebook";
    const key = (groupUrl || dest?.groupSlug || groupName).toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.postCount += 1;
      if (item.createdAt > existing.lastPostedAt) {
        existing.lastPostedAt = item.createdAt;
        existing.lastPostUrl = url || existing.lastPostUrl;
        existing.lastOfferId = item.offerId ?? existing.lastOfferId;
        existing.groupName = groupName;
        existing.groupUrl = groupUrl || existing.groupUrl;
      }
      continue;
    }
    map.set(key, {
      key,
      groupName,
      groupUrl,
      lastPostedAt: item.createdAt,
      lastPostUrl: url || null,
      postCount: 1,
      lastOfferId: item.offerId ?? null,
    });
  }
  return [...map.values()].sort((a, b) =>
    a.lastPostedAt < b.lastPostedAt ? 1 : -1,
  );
}
