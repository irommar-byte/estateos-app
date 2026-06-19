import type { AddOfferDictionary } from "@/i18n/addOfferDictionary";

export const OFFER_AMENITY_DEFS = [
  { id: "balcony", dictKey: "amenityBalcony" as const, field: "hasBalcony" as const },
  { id: "parking", dictKey: "amenityGarage" as const, field: "hasParking" as const },
  { id: "storage", dictKey: "amenityStorage" as const, field: "hasStorage" as const },
  { id: "garden", dictKey: "amenityGarden" as const, field: "hasGarden" as const },
  { id: "duplex", dictKey: "amenityDuplex" as const, field: "isDuplex" as const },
  { id: "elevator", dictKey: "amenityElevator" as const, field: "hasElevator" as const },
  { id: "ac", dictKey: "amenityAc" as const, field: "hasAirConditioning" as const },
] as const;

export type OfferAmenityId = (typeof OFFER_AMENITY_DEFS)[number]["id"];

export type OfferAmenityField = (typeof OFFER_AMENITY_DEFS)[number]["field"];

export function buildAmenityOptions(ao: AddOfferDictionary) {
  return OFFER_AMENITY_DEFS.map(({ id, dictKey }) => ({ id, label: ao[dictKey] }));
}

export function readAmenitySelectionFromOffer(offer: Record<string, unknown>): OfferAmenityId[] {
  const selected: OfferAmenityId[] = [];
  for (const def of OFFER_AMENITY_DEFS) {
    if (offer[def.field]) selected.push(def.id);
  }
  return selected;
}

export function amenityBooleanPatch(selection: Iterable<OfferAmenityId>): Record<OfferAmenityField, boolean> {
  const set = new Set(selection);
  const patch = {} as Record<OfferAmenityField, boolean>;
  for (const def of OFFER_AMENITY_DEFS) {
    patch[def.field] = set.has(def.id);
  }
  return patch;
}

export function amenityLabelsFromOffer(
  offer: Record<string, unknown>,
  ao: AddOfferDictionary,
): string[] {
  const ids = readAmenitySelectionFromOffer(offer);
  return ids.map((id) => {
    const def = OFFER_AMENITY_DEFS.find((d) => d.id === id);
    return def ? ao[def.dictKey] : id;
  });
}
