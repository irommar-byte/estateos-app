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
  imageUrl: string | null;
  href: string;
};

function normalizeQuery(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
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
  },
  badge?: string,
): SpotlightResult {
  const image = absolutizeMediaUrl(resolveOfferPrimaryImage(row)) || null;
  const locality = [row.district, row.city].filter(Boolean).join(', ') || row.city || 'Polska';
  const price = row.pricePln || row.price;
  const priceLabel = price ? `${Math.round(Number(price)).toLocaleString('pl-PL')} zł` : '';
  return {
    id: `offer-${row.id}`,
    kind: 'offer',
    title: row.title?.trim() || `Oferta #${row.id}`,
    subtitle: [badge, `#${row.id}`, locality, priceLabel].filter(Boolean).join(' · '),
    imageUrl: image,
    href: offerHref(row.id),
  };
}

export async function runSpotlightSearch(
  rawQuery: string,
  viewerUserId?: number | null,
): Promise<SpotlightResult[]> {
  const q = normalizeQuery(rawQuery);
  if (!q) return [];

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
        },
      });
      if (offer) {
        const pubIds = await activePublicationOfferIds([offer.id]);
        const isPublic = canShowOfferOnPublicMarket(offer, pubIds);
        const isOwner = viewerUserId && Number(offer.userId) === Number(viewerUserId);
        if (isPublic || isOwner) {
          push(mapOfferRow(offer, isPublic ? undefined : 'Twoja oferta'));
        }
      }
    }
  }

  if (q.length < 2) return out.slice(0, 8);

  const [offers, agents, companies] = await Promise.all([
    prisma.offer.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { title: { contains: q } },
          { city: { contains: q } },
          { district: { contains: q } },
          { street: { contains: q } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 16,
      select: {
        id: true,
        title: true,
        city: true,
        district: true,
        pricePln: true,
        price: true,
        images: true,
        status: true,
        expiresAt: true,
      },
    }),
    prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [{ name: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }],
          },
          {
            OR: [{ role: 'AGENT' }, { planType: 'AGENCY' }, { companyName: { not: null } }],
          },
        ],
      },
      take: 6,
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
      where: { name: { contains: q } },
      take: 4,
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

  for (const offer of offers) {
    if (out.length >= 8) break;
    if (!canShowOfferOnPublicMarket(offer, pubIds)) continue;
    push(mapOfferRow(offer));
  }

  for (const agent of agents) {
    if (out.length >= 8) break;
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
    });
  }

  for (const company of companies) {
    if (out.length >= 8) break;
    push({
      id: `agency-${company.id}`,
      kind: 'agency',
      title: company.name,
      subtitle: 'Biuro nieruchomości',
      imageUrl: company.logoUrl ? absolutizeMediaUrl(company.logoUrl) || company.logoUrl : null,
      href: agencyHref(company.slug, company.id),
    });
  }

  return out.slice(0, 8);
}
