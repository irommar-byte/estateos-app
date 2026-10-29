import type { OfferShareCard } from '@/lib/offerShareLanding';
import { truncateOfferShareDescription } from '@/lib/offerSharePrint';

/** Dane ofertówki — wspólne dla rysowania na serwerze (PDF, JPEG, druk, podgląd). */
export type OfferSheetData = {
  id: number;
  hero: string | null;
  photos: string[];
  title: string;
  kicker: string;
  address: string;
  price: string;
  ppsm: string | null;
  description: string;
  rows: Array<{ label: string; value: string }>;
  big: Array<{ label: string; value: string }>;
  amenities: string[];
  floorPlanUrl: string | null;
  lat: number | null;
  lng: number | null;
  canonicalUrl: string;
  url: string;
  agent: { name: string; company: string | null; contact: string; image: string | null; initials: string; role: string } | null;
  ref: string;
  transaction: string;
};

function shorten(text: string, max: number): string {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/[\s,;:·|–—-]+\S*$/, '')}…`;
}

/** „3 pokoje | 49 m² | balkon” → „3 pokoje · 49 m² · balkon” — tytuł z portali bywa zlepkiem kresek. */
export function cleanSheetTitle(title: string): string {
  return String(title || '')
    .replace(/\s*[|/]\s*/g, ' · ')
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s·]+|[\s·]+$/g, '')
    .trim();
}

/** Adres na kartkę: ulica, dzielnica, miasto — bez kodu, województwa i „Polska” z geokodera. */
export function cleanSheetAddress(card: Pick<OfferShareCard, 'street' | 'district' | 'city' | 'addressLine' | 'locationLabel'>): string {
  const parts = [card.street, card.district, card.city]
    .map((part) => String(part || '').trim())
    .filter((part) => part && part !== 'OTHER');
  const unique = parts.filter((part, index) => parts.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === index);
  if (unique.length) return unique.join(', ');
  return String(card.addressLine || card.locationLabel || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^\d{2}-\d{3}/.test(part) && !/wojew|polska|poland/i.test(part))
    .filter((part, index, all) => all.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === index)
    .join(', ');
}

export function offerSheetData(card: OfferShareCard): OfferSheetData {
  const floor =
    card.floor == null || String(card.floor).trim() === ''
      ? null
      : Number(card.floor) === 0
        ? 'parter'
        : card.totalFloors
          ? `${card.floor} z ${card.totalFloors}`
          : String(card.floor);
  const area = card.area != null ? `${String(card.area).replace('.', ',')} m²` : null;
  const rows = [
    area ? { label: 'Powierzchnia', value: area } : null,
    card.plotArea ? { label: 'Działka', value: `${card.plotArea} m²` } : null,
    card.rooms != null ? { label: 'Pokoje', value: String(card.rooms) } : null,
    floor ? { label: 'Piętro', value: floor } : null,
    card.yearBuilt != null ? { label: 'Rok budowy', value: String(card.yearBuilt) } : null,
    card.conditionLabel ? { label: 'Stan', value: card.conditionLabel } : null,
    card.heating ? { label: 'Ogrzewanie', value: card.heating } : null,
    card.adminFeeLabel ? { label: 'Czynsz', value: card.adminFeeLabel } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  const big = [
    area ? { label: 'powierzchnia', value: area } : null,
    card.rooms != null ? { label: 'pokoje', value: String(card.rooms) } : null,
    floor ? { label: 'piętro', value: floor.replace(' z ', ' / ') } : null,
    card.yearBuilt != null ? { label: 'rok budowy', value: String(card.yearBuilt) } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  const publisher = card.publisher;
  const agentName = publisher ? publisher.personName || publisher.displayName : '';
  return {
    id: card.id,
    hero: card.imageUrl || card.images[0] || null,
    photos: card.gallery,
    title: shorten(cleanSheetTitle(card.title), 90),
    kicker: [card.propertyTypeLabel, card.district || card.city].filter(Boolean).join(' · '),
    address: cleanSheetAddress(card),
    price: card.priceLabel,
    ppsm: card.pricePerSqmLabel,
    description: truncateOfferShareDescription(card.description, 340),
    rows: rows.slice(0, 8),
    big,
    amenities: card.amenities.slice(0, 6),
    floorPlanUrl: card.floorPlanUrl,
    lat: card.lat,
    lng: card.lng,
    canonicalUrl: card.canonicalUrl,
    url: `estateos.pl/o/${card.id}`,
    agent: publisher
      ? {
          name: agentName,
          company: publisher.companyName && publisher.companyName !== agentName ? publisher.companyName : null,
          contact: [publisher.phone, publisher.email].filter(Boolean).join('  ·  '),
          image: publisher.imageUrl,
          initials: agentName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join(''),
          role: publisher.isPresentingAgent ? 'Twój doradca' : publisher.isAgent ? 'Opiekun oferty' : 'Kontakt',
        }
      : null,
    ref: `Nr ${card.id}`,
    transaction: card.transactionLabel,
  };
}
