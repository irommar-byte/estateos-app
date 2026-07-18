import { API_URL } from '../config/network';
import type { CarListingMissingFieldKey, CarRegistrationPrefill } from '../utils/carRegistrationPrefill';

export async function fillCarFormFromDocs(
  token: string,
  input: {
    vin: string;
    registrationNumber: string;
    firstRegistrationDate: string;
  },
): Promise<{
  prefill: CarRegistrationPrefill & { insuranceValidUntil?: string; vehicleType?: string };
  missingFields: CarListingMissingFieldKey[];
}> {
  const response = await fetch(`${API_URL}/api/cars/docs-prefill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    prefill?: CarRegistrationPrefill & { insuranceValidUntil?: string; vehicleType?: string };
    missingFields?: CarListingMissingFieldKey[];
  };
  if (!response.ok || !data.prefill) {
    throw new Error(data.error || 'Nie udało się uzupełnić formularza z CEPIK.');
  }
  return {
    prefill: data.prefill,
    missingFields: data.missingFields || [],
  };
}
