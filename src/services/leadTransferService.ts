import { API_URL } from '../config/network';
import type { EnrichedLeadTransfer } from '../types/leadTransfer';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' };
}

export async function fetchLeadTransfers(token: string): Promise<EnrichedLeadTransfer[]> {
  const res = await fetch(`${API_URL}/api/concierge/leads?t=${Date.now()}`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) return [];
  return Array.isArray(json.leads) ? json.leads : [];
}

export async function requestLeadTransfer(
  token: string,
  body: { offerId: number; agencyId: number },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/request`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się wysłać zapytania.') };
  return { ok: true };
}

export async function proposeLeadTerms(
  token: string,
  body: { leadId: number; commissionRate: string; commissionTerms: string },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/respond`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, status: 'TERMS_PROPOSED' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się wysłać warunków.') };
  return { ok: true };
}

export async function acceptLeadTransfer(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/accept`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się zaakceptować.') };
  return { ok: true };
}

export async function rejectLeadTransfer(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/reject`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się odrzucić.') };
  return { ok: true };
}

export type DelegatedOffer = {
  id: number;
  title: string;
  price: number;
  pricePln?: number;
  city: string;
  district: string | null;
  status: string;
  imageUrl: string;
  updatedAt: string;
  agency: { id: number; name: string | null; image: string | null };
  commissionRate: number | null;
  commissionTerms: string | null;
  acceptedAt: string | null;
};

export async function fetchDelegatedOffers(token: string): Promise<DelegatedOffer[]> {
  const res = await fetch(`${API_URL}/api/offers/delegated?t=${Date.now()}`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) return [];
  return Array.isArray(json.offers) ? json.offers : [];
}

export type AgencyCatalogItem = {
  id: number;
  companyId?: number | null;
  slug?: string | null;
  displayName: string;
  image: string | null;
  averageRating: number | null;
  reviewsCount: number;
  activeListings: number;
  memberCount?: number;
  conciergeManaged?: number;
  companyAddress?: string | null;
  companyWebsite?: string | null;
  officePhone?: string | null;
  memberSince?: string | null;
};

export type AgencyConciergeDetail = {
  displayName: string;
  image: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  memberSince: string | null;
  stats: {
    activeListings: number;
    reviewsCount: number;
    averageRating: number | null;
    activeAgents: number;
    conciergeManaged: number;
  };
  offerBreakdown: {
    sell: number;
    rent: number;
    flats: number;
    houses: number;
  };
  offers: Array<{
    id: number;
    title: string;
    price: number;
    pricePln?: number | null;
    city: string | null;
    district: string | null;
    transactionType?: string | null;
    propertyType?: string | null;
    area?: number | null;
    rooms?: number | null;
  }>;
  reviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    authorName: string | null;
  }>;
};

function countOfferBreakdown(
  offers: Array<{ transactionType?: string | null; propertyType?: string | null }>,
) {
  let sell = 0;
  let rent = 0;
  let flats = 0;
  let houses = 0;
  for (const o of offers) {
    const tx = String(o.transactionType || 'SELL').toUpperCase();
    if (tx === 'RENT') rent += 1;
    else sell += 1;
    const pt = String(o.propertyType || '').toUpperCase();
    if (pt === 'HOUSE') houses += 1;
    else if (pt === 'FLAT' || pt === 'APARTMENT') flats += 1;
  }
  return { sell, rent, flats, houses };
}

export async function fetchAgencyCatalog(): Promise<AgencyCatalogItem[]> {
  const res = await fetch(`${API_URL}/api/agencje?t=${Date.now()}`);
  const json = await res.json().catch(() => ({}));
  if (!Array.isArray(json?.agencies)) return [];
  return json.agencies.map((a: Record<string, unknown>) => ({
    id: Number(a.id),
    companyId: a.companyId != null ? Number(a.companyId) : null,
    slug: typeof a.slug === 'string' ? a.slug : null,
    displayName: String(a.displayName || a.companyName || a.name || 'Agencja'),
    image: typeof a.image === 'string' ? a.image : typeof a.companyLogoUrl === 'string' ? a.companyLogoUrl : null,
    averageRating: a.averageRating != null ? Number(a.averageRating) : null,
    reviewsCount: Number(a.reviewsCount) || 0,
    activeListings: Number(a.activeListings) || 0,
    memberCount: a.memberCount != null ? Number(a.memberCount) : undefined,
    conciergeManaged: a.conciergeManaged != null ? Number(a.conciergeManaged) : 0,
    companyAddress: typeof a.companyAddress === 'string' ? a.companyAddress : null,
    companyWebsite: typeof a.companyWebsite === 'string' ? a.companyWebsite : null,
    officePhone: typeof a.officePhone === 'string' ? a.officePhone : typeof a.phone === 'string' ? a.phone : null,
    memberSince: typeof a.memberSince === 'string' ? a.memberSince : null,
  }));
}

export async function fetchAgencyConciergeDetail(
  item: AgencyCatalogItem,
): Promise<AgencyConciergeDetail | null> {
  if (item.companyId) {
    const res = await fetch(`${API_URL}/api/agency-company/public/id/${item.companyId}?t=${Date.now()}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json.company) {
      const offers = Array.isArray(json.offers) ? json.offers : [];
      const reviews = Array.isArray(json.reviews) ? json.reviews : [];
      return {
        displayName: String(json.company.name || item.displayName),
        image: json.company.logoUrl || item.image,
        address: json.company.address ?? item.companyAddress ?? null,
        website: json.company.website ?? item.companyWebsite ?? null,
        phone: json.company.officePhone ?? item.officePhone ?? null,
        memberSince: json.company.memberSince ?? item.memberSince ?? null,
        stats: {
          activeListings: Number(json.stats?.activeListings) || item.activeListings,
          reviewsCount: Number(json.stats?.reviewsCount) || item.reviewsCount,
          averageRating: json.stats?.averageRating != null ? Number(json.stats.averageRating) : item.averageRating,
          activeAgents: Number(json.stats?.activeAgents) || item.memberCount || 0,
          conciergeManaged: item.conciergeManaged ?? 0,
        },
        offerBreakdown: countOfferBreakdown(offers),
        offers: offers.slice(0, 8).map((o: Record<string, unknown>) => ({
          id: Number(o.id),
          title: String(o.title || ''),
          price: Number(o.pricePln ?? o.price) || 0,
          pricePln: o.pricePln != null ? Number(o.pricePln) : null,
          city: typeof o.city === 'string' ? o.city : null,
          district: typeof o.district === 'string' ? o.district : null,
          transactionType: typeof o.transactionType === 'string' ? o.transactionType : null,
          propertyType: typeof o.propertyType === 'string' ? o.propertyType : null,
          area: o.area != null ? Number(o.area) : null,
          rooms: o.rooms != null ? Number(o.rooms) : null,
        })),
        reviews: reviews.slice(0, 6).map((r: Record<string, unknown>) => ({
          id: Number(r.id),
          rating: Number(r.rating) || 0,
          comment: typeof r.comment === 'string' ? r.comment : null,
          createdAt: String(r.createdAt || ''),
          authorName:
            typeof (r.reviewer as { name?: string } | undefined)?.name === 'string'
              ? (r.reviewer as { name: string }).name
              : typeof (r.agent as { name?: string } | undefined)?.name === 'string'
                ? (r.agent as { name: string }).name
                : null,
        })),
      };
    }
  }

  const res = await fetch(`${API_URL}/api/users/${item.id}/public?t=${Date.now()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.user) return null;
  const offers = Array.isArray(json.offers) ? json.offers : [];
  const reviews = Array.isArray(json.reviews) ? json.reviews : [];
  const user = json.user as Record<string, unknown>;
  return {
    displayName: String(user.companyName || user.name || item.displayName),
    image: (user.image as string | null) || item.image,
    address: (user.companyAddress as string | null) ?? item.companyAddress ?? null,
    website: (user.companyWebsite as string | null) ?? item.companyWebsite ?? null,
    phone: (user.officePhone as string | null) || (user.phone as string | null) || item.officePhone || null,
    memberSince: user.memberSince ? String(user.memberSince) : item.memberSince ?? null,
    stats: {
      activeListings: offers.filter((o: { status?: string }) => o.status === 'ACTIVE').length || item.activeListings,
      reviewsCount: reviews.length || item.reviewsCount,
      averageRating:
        reviews.length > 0
          ? Number(
              (
                reviews.reduce((s: number, r: { rating?: number }) => s + (Number(r.rating) || 0), 0) /
                reviews.length
              ).toFixed(1),
            )
          : item.averageRating,
      activeAgents: item.memberCount ?? 1,
      conciergeManaged: item.conciergeManaged ?? 0,
    },
    offerBreakdown: countOfferBreakdown(offers),
    offers: offers.slice(0, 8).map((o: Record<string, unknown>) => ({
      id: Number(o.id),
      title: String(o.title || ''),
      price: Number(o.pricePln ?? o.price) || 0,
      pricePln: o.pricePln != null ? Number(o.pricePln) : null,
      city: typeof o.city === 'string' ? o.city : null,
      district: typeof o.district === 'string' ? o.district : null,
      transactionType: typeof o.transactionType === 'string' ? o.transactionType : null,
      propertyType: typeof o.propertyType === 'string' ? o.propertyType : null,
      area: o.area != null ? Number(o.area) : null,
      rooms: o.rooms != null ? Number(o.rooms) : null,
    })),
    reviews: reviews.slice(0, 6).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      rating: Number(r.rating) || 0,
      comment: typeof r.comment === 'string' ? r.comment : null,
      createdAt: String(r.createdAt || ''),
      authorName: typeof r.reviewerName === 'string' ? r.reviewerName : null,
    })),
  };
}
