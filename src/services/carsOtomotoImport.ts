import { API_URL } from '../config/network';
import type { CarListingMissingFieldKey } from '../utils/carRegistrationPrefill';
import type { VehicleType } from '../utils/vehicleTypes';

export type OtomotoCarImportPrefill = {
  vehicleType?: VehicleType;
  title: string;
  description: string;
  make: string;
  model: string;
  year: string;
  mileageKm: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  exteriorColor: string;
  generation: string;
  enginePower: string;
  engineCapacity: string;
  trimVersion: string;
  doorCount: string;
  pricePln: string;
  city: string;
  cityLat: number | null;
  cityLng: number | null;
  localityCountry: string;
  imageUrl: string;
  images: string[];
  sourceUrl: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
};

export function isSupportedOtomotoOfferUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host !== 'otomoto.pl') return false;
    return /\/oferta\//i.test(url.pathname);
  } catch {
    return false;
  }
}

export async function importCarFromOtomotoUrl(url: string): Promise<{
  prefill: OtomotoCarImportPrefill;
  missingFields: CarListingMissingFieldKey[];
}> {
  const response = await fetch(`${API_URL}/api/cars/otomoto-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    prefill?: OtomotoCarImportPrefill;
    missingFields?: CarListingMissingFieldKey[];
  };
  if (!response.ok || !data.prefill) {
    throw new Error(data.error || 'Nie udało się przenieść ogłoszenia z Otomoto.');
  }
  return {
    prefill: data.prefill,
    missingFields: data.missingFields || [],
  };
}
