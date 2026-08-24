export const SELLER_PROPERTY_TYPES = [
  { id: 'FLAT', label: 'Mieszkanie' },
  { id: 'HOUSE', label: 'Dom' },
  { id: 'PLOT', label: 'Działka' },
  { id: 'COMMERCIAL', label: 'Lokal' },
] as const;

export type SellerPropertyTypeId = (typeof SELLER_PROPERTY_TYPES)[number]['id'];

const LABEL_TO_ID: Record<string, SellerPropertyTypeId> = {
  mieszkanie: 'FLAT',
  flat: 'FLAT',
  apartment: 'FLAT',
  dom: 'HOUSE',
  house: 'HOUSE',
  działka: 'PLOT',
  dzialka: 'PLOT',
  plot: 'PLOT',
  lokal: 'COMMERCIAL',
  commercial: 'COMMERCIAL',
};

export function parseSellerPropertyType(raw: unknown): SellerPropertyTypeId {
  const key = String(raw || '').trim().toLowerCase();
  if (key === 'flat' || key === 'house' || key === 'plot' || key === 'commercial') {
    return key.toUpperCase() as SellerPropertyTypeId;
  }
  return LABEL_TO_ID[key] || 'FLAT';
}

export function sellerPropertyTypeLabel(raw: unknown): string {
  const id = parseSellerPropertyType(raw);
  return SELLER_PROPERTY_TYPES.find((item) => item.id === id)?.label || 'Mieszkanie';
}

export function isFlatSellerProperty(raw: unknown): boolean {
  return parseSellerPropertyType(raw) === 'FLAT';
}

export function normalizeApartmentNumber(raw: unknown): string {
  return String(raw || '').trim().slice(0, 32);
}

export function apartmentNumberForType(propertyType: unknown, apartmentNumber: unknown): string {
  if (!isFlatSellerProperty(propertyType)) return '';
  return normalizeApartmentNumber(apartmentNumber);
}
