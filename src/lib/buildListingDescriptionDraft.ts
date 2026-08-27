import {
  amenityBooleanPatch,
  type OfferAmenityId,
} from '@/lib/offerAmenities';

export function buildListingDescriptionDraftFromEdit(input: {
  locale?: string;
  data: Record<string, unknown>;
  selectedAmenities: OfferAmenityId[];
  userNotes?: string;
}): Record<string, unknown> {
  const amenityPatch = amenityBooleanPatch(input.selectedAmenities);
  const data = input.data;
  return {
    locale: input.locale || 'pl',
    title: data.title,
    transactionType: data.transactionType,
    propertyType: data.propertyType,
    condition: data.condition,
    city: data.city,
    district: data.district,
    localityCountry: data.localityCountry,
    street: data.street || data.address,
    lat: data.lat,
    lng: data.lng,
    isExactLocation: data.isExactLocation !== false,
    area: data.area,
    plotArea: data.plotArea,
    rooms: data.rooms,
    floor: data.floor,
    totalFloors: data.totalFloors,
    yearBuilt: data.year || data.yearBuilt,
    heating: data.heating,
    isFurnished: data.isFurnished === true,
    existingDescription: String(data.description || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    userNotes: String(input.userNotes || '').trim(),
    hasBalcony: amenityPatch.hasBalcony,
    hasParking: amenityPatch.hasParking,
    hasStorage: amenityPatch.hasStorage,
    hasGarden: amenityPatch.hasGarden,
    isTwoLevel: amenityPatch.isDuplex,
    hasElevator: amenityPatch.hasElevator,
  };
}
