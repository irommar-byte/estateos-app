import { prisma } from '@/lib/prisma';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';
import { getBestUserAvatarUrl } from '@/lib/userAvatar';

export type SpotlightResultKind = 'offer' | 'agent' | 'agency';

export type SpotlightResult = {
  id: string;
  kind: SpotlightResultKind;
  title: string;
  subtitle: string;
  detail?: string | null;
  imageUrl: string | null;
  href: string;
  score: number;
};

export type SpotlightSection = {
  kind: SpotlightResultKind;
  label: string;
  items: SpotlightResult[];
};

export type SpotlightSearchResponse = {
  results: SpotlightResult[];
  sections: SpotlightSection[];
  tookMs: number;
};

const OFFER_LIMIT = 10;
const AGENT_LIMIT = 5;
const AGENCY_LIMIT = 4;

function foldDiacritics(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function normalizeQuery(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function tokenizeQuery(raw: string): string[] {
  const q = normalizeQuery(raw);
  if (!q) return [];
  return q
    .split(/[\s,;|/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 1);
}

function stripHtml(raw: unknown): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsFolded(haystack: unknown, needle: string): boolean {
  const h = foldDiacritics(String(haystack || ''));
  const n = foldDiacritics(needle);
  if (!n) return false;
  return h.includes(n);
}

function buildContainsVariants(field: string, token: string) {
  const folded = foldDiacritics(token);
  const variants =
    folded && folded !== token.toLowerCase()
      ? [{ [field]: { contains: token } }, { [field]: { contains: folded } }]
      : [{ [field]: { contains: token } }];
  return variants;
}

function tokenMatchClause(token: string) {
  return {
    OR: [
      ...buildContainsVariants('title', token),
      ...buildContainsVariants('city', token),
      ...buildContainsVariants('district', token),
      ...buildContainsVariants('street', token),
      ...buildContainsVariants('description', token),
    ],
  };
}

function extractSnippet(description: unknown, tokens: string[]): string | null {
  const plain = stripHtml(description);
  if (!plain) return null;
  const folded = foldDiacritics(plain);
  for (const token of tokens) {
    const idx = folded.indexOf(foldDiacritics(token));
    if (idx < 0) continue;
    const start = Math.max(0, idx - 42);
    const end = Math.min(plain.length, idx + token.length + 58);
    const slice = plain.slice(start, end).trim();
    if (slice.length >= 8) {
      return `${start > 0 ? '…' : ''}${slice}${end < plain.length ? '…' : ''}`;
    }
  }
  return null;
}

function offerHref(id: number): string {
  return `/oferta/${id}`;
}

function agentHref(id: number): string {
  return `/profil/${id}`;
}

function agencyHref(slug: string | null, id: number): string {
  return slug ? `/firma/${slug}` : `/firma/${id}`;
}

function mapOfferRow(
  row: {
    id: number;
    title: string;
    city: string | null;
    district: string | null;
    pricePln: number | null;
    price: number | null;
    images: unknown;
    status: string;
    description?: string | null;
  },
  opts?: { badge?: string; score?: number; tokens?: string[] },
): SpotlightResult {
  const image = absolutizeMediaUrl(resolveOfferPrimaryImage(row)) || null;
  const locality = [row.district, row.city].filter(Boolean).join(', ') || row.city || 'Polska';
  const price = row.pricePln || row.price;
  const priceLabel = price ? `${Math.round(Number(price)).toLocaleString('pl-PL')} zł` : '';
  const detail = opts?.tokens?.length ? extractSnippet(row.description, opts.tokens) : null;
  return {
    id: `offer-${row.id}`,
    kind: 'offer',
    title: row.title?.trim() || `Oferta #${row.id}`,
    subtitle: [opts?.badge, `#${row.id}`, locality, priceLabel].filter(Boolean).join(' · '),
    detail,
    imageUrl: image,
    href: offerHref(row.id),
    score: opts?.score ?? 0,
  };
}

function scoreOffer(
  row: {
    id: number;
    title: string | null;
    city: string | null;
    district: string | null;
    street?: string | null;
    description?: string | null;
  },
  tokens: string[],
  rawQuery: string,
): number {
  let score = 0;
  if (/^\d+$/.test(rawQuery) && Number(rawQuery) === row.id) score += 2000;
  const title = row.title || '';
  const city = row.city || '';
  const district = row.district || '';
  const street = row.street || '';
  const description = stripHtml(row.description).slice(0, 1200);

  if (containsFolded(title, rawQuery)) score += 120;
  if (containsFolded(district, rawQuery)) score += 90;
  if (containsFolded(city, rawQuery)) score += 80;
  if (containsFolded(street, rawQuery)) score += 70;
  if (containsFolded(description, rawQuery)) score += 35;

  for (const token of tokens) {
    if (containsFolded(title, token)) score += 55;
    if (containsFolded(district, token)) score += 42;
    if (containsFolded(city, token)) score += 38;
    if (containsFolded(street, token)) score += 30;
    if (containsFolded(description, token)) score += 18;
  }

  return score;
}

function scoreAgent(row: { name: string | null; companyName: string | null }, tokens: string[], rawQuery: string): number {
  let score = 0;
  const name = row.name || '';
  const company = row.companyName || '';
  if (containsFolded(name, rawQuery)) score += 120;
  if (containsFolded(company, rawQuery)) score += 90;
  for (const token of tokens) {
    if (containsFolded(name, token)) score += 60;
    if (containsFolded(company, token)) score += 45;
  }
  return score;
}

function buildSections(results: SpotlightResult[]): SpotlightSection[] {
  const labels: Record<SpotlightResultKind, string> = {
    offer: 'Oferty',
    agent: 'Agenci',
    agency: 'Biura',
  };
  const order: SpotlightResultKind[] = ['offer', 'agent', 'agency'];
  return order
    .map((kind) => ({
      kind,
      label: labels[kind],
      items: results.filter((item) => item.kind === kind),
    }))
    .filter((section) => section.items.length > 0);
}

export async function runSpotlightSearch(
  rawQuery: string,
  viewerUserId?: number | null,
): Promise<SpotlightSearchResponse> {
  const started = Date.now();
  const q = normalizeQuery(rawQuery);
  if (!q) return { results: [], sections: [], tookMs: 0 };

  const tokens = tokenizeQuery(q);
  const out: SpotlightResult[] = [];
  const seen = new Set<string>();

  const push = (item: SpotlightResult) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  if (/^\d+$/.test(q)) {
    const offerId = Number(q);
    if (Number.isFinite(offerId) && offerId > 0) {
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          userId: true,
          title: true,
          city: true,
          district: true,
          pricePln: true,
          price: true,
          images: true,
          status: true,
          expiresAt: true,
          description: true,
        },
      });
      if (offer) {
        const pubIds = await activePublicationOfferIds([offer.id]);
        const isPublic = canShowOfferOnPublicMarket(offer, pubIds);
        const isOwner = viewerUserId && Number(offer.userId) === Number(viewerUserId);
        if (isPublic || isOwner) {
          push(
            mapOfferRow(offer, {
              badge: isPublic ? undefined : 'Twoja oferta',
              score: 2000,
              tokens,
            }),
          );
        }
      }
    }
  }

  if (tokens.length === 0 && out.length) {
    const results = out.slice(0, 12);
    return { results, sections: buildSections(results), tookMs: Date.now() - started };
  }

  if (q.length < 2 && !/^\d+$/.test(q)) {
    const results = out.slice(0, 12);
    return { results, sections: buildSections(results), tookMs: Date.now() - started };
  }

  const offerWhere =
    tokens.length > 0
      ? {
          status: 'ACTIVE' as const,
          AND: tokens.map((token) => tokenMatchClause(token)),
        }
      : {
          status: 'ACTIVE' as const,
          OR: [
            ...buildContainsVariants('title', q),
            ...buildContainsVariants('city', q),
            ...buildContainsVariants('district', q),
            ...buildContainsVariants('street', q),
            ...buildContainsVariants('description', q),
          ],
        };

  const agentTokenClause =
    tokens.length > 0
      ? {
          AND: tokens.map((token) => ({
            OR: [
              ...buildContainsVariants('name', token),
              ...buildContainsVariants('companyName', token),
              ...buildContainsVariants('email', token),
            ],
          })),
        }
      : {
          OR: [
            ...buildContainsVariants('name', q),
            ...buildContainsVariants('companyName', q),
            ...buildContainsVariants('email', q),
          ],
        };

  const [offers, agents, companies] = await Promise.all([
    prisma.offer.findMany({
      where: offerWhere,
      orderBy: { updatedAt: 'desc' },
      take: 24,
      select: {
        id: true,
        title: true,
        city: true,
        district: true,
        street: true,
        pricePln: true,
        price: true,
        images: true,
        status: true,
        expiresAt: true,
        description: true,
      },
    }),
    prisma.user.findMany({
      where: {
        AND: [
          agentTokenClause,
          {
            OR: [{ role: 'AGENT' }, { planType: 'AGENCY' }, { companyName: { not: null } }],
          },
        ],
      },
      take: AGENT_LIMIT * 2,
      select: {
        id: true,
        name: true,
        companyName: true,
        image: true,
        role: true,
        planType: true,
      },
    }),
    prisma.agencyCompany.findMany({
      where: {
        OR: tokens.length
          ? tokens.flatMap((token) => buildContainsVariants('name', token))
          : buildContainsVariants('name', q),
      },
      take: AGENCY_LIMIT * 2,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
      },
    }),
  ]);

  const offerIds = offers.map((row) => row.id);
  const pubIds = offerIds.length ? await activePublicationOfferIds(offerIds) : new Set<number>();

  const rankedOffers = offers
    .filter((offer) => canShowOfferOnPublicMarket(offer, pubIds))
    .map((offer) => ({
      offer,
      score: scoreOffer(offer, tokens.length ? tokens : [q], q),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, OFFER_LIMIT);

  for (const { offer, score } of rankedOffers) {
    push(mapOfferRow(offer, { score, tokens: tokens.length ? tokens : [q] }));
  }

  const rankedAgents = agents
    .map((agent) => ({ agent, score: scoreAgent(agent, tokens.length ? tokens : [q], q) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, AGENT_LIMIT);

  for (const { agent, score } of rankedAgents) {
    const full = String(agent.name || '').trim() || `Agent #${agent.id}`;
    const company = String(agent.companyName || '').trim();
    push({
      id: `agent-${agent.id}`,
      kind: 'agent',
      title: full,
      subtitle: [company || (agent.planType === 'AGENCY' ? 'Biuro nieruchomości' : 'Agent'), `#${agent.id}`]
        .filter(Boolean)
        .join(' · '),
      imageUrl: getBestUserAvatarUrl(agent) || null,
      href: agentHref(agent.id),
      score,
    });
  }

  for (const company of companies.slice(0, AGENCY_LIMIT)) {
    push({
      id: `agency-${company.id}`,
      kind: 'agency',
      title: company.name,
      subtitle: 'Biuro nieruchomości',
      imageUrl: company.logoUrl ? absolutizeMediaUrl(company.logoUrl) || company.logoUrl : null,
      href: agencyHref(company.slug, company.id),
      score: containsFolded(company.name, q) ? 100 : 50,
    });
  }

  const results = out.sort((a, b) => b.score - a.score).slice(0, 16);
  return {
    results,
    sections: buildSections(results),
    tookMs: Date.now() - started,
  };
}
