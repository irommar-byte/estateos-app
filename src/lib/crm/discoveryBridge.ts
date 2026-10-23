import { prisma } from '@/lib/prisma';
import { createDiscoveryProfileSnapshot, scoreDiscoveryCandidate } from '@/lib/discovery/engine';
import type { DiscoveryCandidate, DiscoveryProfileSnapshot } from '@/lib/discovery/types';

/**
 * Most między „mózgiem” ze strony (DiscoveryProfile) a doborem ofert w CRM.
 *
 * Profil ze strony powstaje z tego, jak klient zachowuje się sam — co przegląda,
 * lubi, odrzuca, zapisuje. To inny, cichszy sygnał niż reakcje w panelu
 * klienta, więc działa wyłącznie jako ograniczona korekta wyniku: nie omija
 * żadnego twardego kryterium i nie wyśle oferty, która nie przeszła progu.
 */

const MIN_CONFIDENCE = 0.3;
const MIN_DECISIONS = 6;
const MAX_BONUS = 8;
const MAX_MALUS = -6;

export type ClientDiscoverySignal = {
  snapshot: DiscoveryProfileSnapshot;
  confidence: number;
  decisions: number;
};

export type DiscoveryOfferLike = {
  id: number;
  title: string | null;
  city: string | null;
  district: string | null;
  price: number | null;
  area: number | null;
  rooms: number | null;
  hasBalcony: boolean | null;
  hasParking: boolean | null;
  hasGarden: boolean | null;
  hasElevator: boolean | null;
  isFurnished: boolean | null;
  propertyType?: string | null;
  transactionType?: string | null;
};

export async function loadClientDiscoverySignal(linkedUserId: number | null | undefined): Promise<ClientDiscoverySignal | null> {
  if (!linkedUserId) return null;
  try {
    const profile = await prisma.discoveryProfile.findUnique({
      where: { userId: linkedUserId },
      select: {
        tasteVector: true,
        preferenceVector: true,
        cityStats: true,
        districtStats: true,
        propertyStats: true,
        reasonStats: true,
        confidence: true,
        contradictionIndex: true,
        explorationHunger: true,
        searchPhase: true,
      },
    });
    if (!profile) return null;
    const snapshot = createDiscoveryProfileSnapshot(profile);
    const decisions = snapshot.tasteVector.behavioural.decisionCount;
    if (snapshot.confidence < MIN_CONFIDENCE || decisions < MIN_DECISIONS) return null;
    // CRM nie „eksploruje” za klienta — agent dobiera, nie testuje.
    snapshot.explorationHunger = 0;
    return { snapshot, confidence: snapshot.confidence, decisions };
  } catch {
    return null;
  }
}

function toCandidate(offer: DiscoveryOfferLike): DiscoveryCandidate {
  const price = Number(offer.price || 0);
  const now = new Date();
  return {
    id: offer.id,
    title: String(offer.title || ''),
    price,
    pricePln: price || null,
    priceCurrency: 'PLN',
    listPricePln: price || null,
    city: String(offer.city || ''),
    district: String(offer.district || ''),
    propertyType: String(offer.propertyType || 'FLAT'),
    transactionType: String(offer.transactionType || 'SELL'),
    area: Number(offer.area || 0),
    rooms: offer.rooms ?? null,
    hasBalcony: Boolean(offer.hasBalcony),
    hasParking: Boolean(offer.hasParking),
    hasGarden: Boolean(offer.hasGarden),
    hasElevator: Boolean(offer.hasElevator),
    isFurnished: Boolean(offer.isFurnished),
    images: null,
    status: 'ACTIVE',
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    embeddingVector: null,
  };
}

/**
 * Korekta wyniku (-6…+8 pkt) z profilu zachowań na stronie.
 * Liczymy tylko składniki wyuczone z zachowania — bez bazowych 50 pkt,
 * bez premii za same udogodnienia i bez eksploracji.
 */
export function discoveryScoreAdjustment(
  signal: ClientDiscoverySignal | null,
  offer: DiscoveryOfferLike,
): { delta: number; reason: string | null } {
  if (!signal) return { delta: 0, reason: null };
  const scored = scoreDiscoveryCandidate({
    candidate: toCandidate(offer),
    profile: signal.snapshot,
    recentShown: new Set(),
    recentDisliked: new Set(),
    recentLiked: new Set(),
  });
  const c = scored.scoreComponents;
  const learned =
    c.cityAffinity +
    c.districtAffinity +
    c.propertyTypeAffinity +
    c.transactionAffinity +
    c.priceAffinity +
    c.spaceAffinity +
    c.embeddingAffinity +
    c.visitPattern;
  const raw = Math.round((learned / 40) * MAX_BONUS * signal.confidence);
  const delta = Math.max(MAX_MALUS, Math.min(MAX_BONUS, raw));
  if (delta >= 3) {
    return { delta, reason: `Na stronie klient sam wybiera podobne miejsca (+${delta} pkt).` };
  }
  if (delta <= -3) {
    return { delta, reason: `Na stronie klient zwykle pomija takie miejsca (${delta} pkt).` };
  }
  return { delta, reason: null };
}

/**
 * Druga strona mostu: reakcja klienta w panelu (Podoba się / Nie) trafia też
 * do jego profilu na stronie, jeśli ma konto. Dzięki temu „Dla Ciebie” na
 * stronie i w aplikacji zna to, czego klient nauczył już agenta.
 * Nigdy nie blokuje zapisu reakcji — błędy są ciche.
 */
export async function mirrorPortalFeedbackToDiscovery(params: {
  linkedUserId: number | null | undefined;
  matchId: number;
  offerId: number;
  sentiment: 'like' | 'maybe' | 'dislike' | null;
  phrases?: string[];
  note?: string | null;
}): Promise<void> {
  if (!params.linkedUserId || !params.sentiment || params.sentiment === 'maybe') return;
  try {
    const { persistDiscoveryEvent } = await import('@/lib/discovery/persistDiscoveryEvent');
    const text = [...(params.phrases || []), params.note || ''].join(' ').toLowerCase();
    let reasonCode: 'PRICE_TOO_HIGH' | 'LOCATION_MISMATCH' | 'LAYOUT_MISMATCH' | 'QUALITY_LOW' | null = null;
    if (params.sentiment === 'dislike') {
      if (/drog|cen|budżet|budzet/.test(text)) reasonCode = 'PRICE_TOO_HIGH';
      else if (/lokaliz|okolic|dzielnic|dojazd|daleko/.test(text)) reasonCode = 'LOCATION_MISMATCH';
      else if (/układ|uklad|pokoj|metraż|metraz|mał|mal|kuchni/.test(text)) reasonCode = 'LAYOUT_MISMATCH';
      else if (/stan|remont|standard|blok|budyn/.test(text)) reasonCode = 'QUALITY_LOW';
    }
    await persistDiscoveryEvent(params.linkedUserId, {
      eventType: params.sentiment === 'like' ? 'DISCOVERY_LIKE' : 'DISCOVERY_DISLIKE',
      offerId: params.offerId,
      idempotencyKey: `crm-feedback:${params.matchId}:${params.sentiment}`,
      reasonCode,
      source: 'crm_client_portal',
      platform: 'web',
      at: new Date(),
    });
  } catch {
    /* profil strony jest dodatkiem — reakcja w CRM jest już zapisana */
  }
}
