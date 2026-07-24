import { API_URL } from '../config/network';
import { withCarImage, type CarListing } from './carsApi';

export type CarFormPayload = {
  title: string;
  description?: string;
  vehicleType?: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  exteriorColor?: string;
  generation?: string;
  enginePower?: string;
  engineCapacity?: string;
  trimVersion?: string;
  doorCount?: number | null;
  price: number;
  priceAmount?: number;
  priceCurrency?: 'PLN' | 'EUR';
  pricePln: number;
  city: string;
  cityLat?: number | null;
  cityLng?: number | null;
  localityCountry?: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  restrictVehicleDocs?: boolean;
  imageUrl: string;
  images?: string[];
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function isLocalUri(uri: string) {
  return !uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('/uploads');
}

export async function uploadCarImage(
  token: string,
  localUri: string,
  fileName = 'car-photo.jpg',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    name: fileName,
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/api/upload/cars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Upload zdjęcia nie powiódł się.');
  }
  return String(data.url);
}

export async function uploadCarImages(token: string, uris: string[]): Promise<string[]> {
  const uploaded: string[] = [];
  for (let index = 0; index < uris.length; index += 1) {
    const uri = uris[index];
    if (!uri) continue;
    if (isLocalUri(uri)) {
      uploaded.push(await uploadCarImage(token, uri, `car-${Date.now()}-${index}.jpg`));
      continue;
    }
    if (uri.startsWith('/uploads')) {
      uploaded.push(uri);
      continue;
    }
    if (uri.startsWith(`${API_URL}/uploads`)) {
      uploaded.push(uri.slice(API_URL.length));
      continue;
    }
    uploaded.push(uri);
  }
  return uploaded;
}

export async function createCarListing(token: string, payload: CarFormPayload): Promise<CarListing> {
  const response = await fetch(`${API_URL}/api/cars`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się dodać ogłoszenia.');
  }
  return withCarImage(data.listing as CarListing);
}

export async function updateCarListing(
  token: string,
  carId: number,
  payload: CarFormPayload,
): Promise<CarListing> {
  const response = await fetch(`${API_URL}/api/cars/${carId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się zapisać zmian.');
  }
  return withCarImage(data.listing as CarListing);
}

export async function deleteCarListing(token: string, carId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/cars/${carId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się usunąć ogłoszenia.');
  }
}

export type DecodeRegistrationResult = {
  prefill: Record<string, string>;
  missingFields: string[];
};

export async function decodeRegistrationDocument(
  token: string | null,
  input: { aztecPayload?: string; imageUri?: string },
): Promise<DecodeRegistrationResult> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  if (input.imageUri) {
    const formData = new FormData();
    formData.append('file', {
      uri: input.imageUri,
      name: 'registration-document.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await fetch(`${API_URL}/api/cars/decode-registration`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się odczytać zdjęcia dowodu.');
    }
    return {
      prefill: (data?.prefill || {}) as Record<string, string>,
      missingFields: Array.isArray(data?.missingFields) ? data.missingFields.map(String) : [],
    };
  }

  const response = await fetch(`${API_URL}/api/cars/decode-registration`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aztecPayload: input.aztecPayload || '' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udało się odczytać kodu z dowodu.');
  }
  return {
    prefill: (data?.prefill || {}) as Record<string, string>,
    missingFields: Array.isArray(data?.missingFields) ? data.missingFields.map(String) : [],
  };
}
