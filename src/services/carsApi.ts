import { API_URL } from '../config/network';

export type CarListing = {
  id: number;
  userId?: number | null;
  title: string;
  description?: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  generation?: string;
  enginePower?: string;
  engineCapacity?: string;
  trimVersion?: string;
  doorCount?: number | null;
  pricePln: number;
  city: string;
  cityLat?: number | null;
  cityLng?: number | null;
  localityCountry?: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  imageUrl: string;
  images?: string[] | string;
  createdAt?: string;
  updatedAt?: string;
};

function authHeaders(token?: string | null): HeadersInit | undefined {
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

function absoluteImageUrl(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return `${API_URL}/${trimmed}`;
}

export function parseCarImages(raw: CarListing | Record<string, unknown>): string[] {
  const imageUrl = String(raw?.imageUrl || '').trim();
  const imagesRaw = (raw as CarListing).images;
  if (Array.isArray(imagesRaw)) {
    const urls = imagesRaw.map((item) => absoluteImageUrl(String(item || ''))).filter(Boolean);
    if (urls.length) return urls;
  }
  if (typeof imagesRaw === 'string' && imagesRaw.trim()) {
    try {
      const parsed = JSON.parse(imagesRaw);
      if (Array.isArray(parsed)) {
        const urls = parsed.map((item) => absoluteImageUrl(String(item || ''))).filter(Boolean);
        if (urls.length) return urls;
      }
    } catch {
      // ignore
    }
  }
  return imageUrl ? [absoluteImageUrl(imageUrl)] : [];
}

export function withCarImage(listing: CarListing): CarListing {
  const images = parseCarImages(listing);
  return {
    ...listing,
    images,
    imageUrl: images[0] || absoluteImageUrl(listing.imageUrl),
  };
}

export async function fetchCarsCatalog(): Promise<CarListing[]> {
  const response = await fetch(`${API_URL}/api/cars`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error('Nie udało się pobrać katalogu aut.');
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => withCarImage(row as CarListing));
}

export async function fetchCarById(id: number): Promise<CarListing | null> {
  const response = await fetch(`${API_URL}/api/cars/${id}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Nie udało się pobrać ogłoszenia auta.');
  const payload = await response.json();
  return withCarImage(payload as CarListing);
}

export async function fetchMyCars(token: string): Promise<CarListing[]> {
  const response = await fetch(`${API_URL}/api/cars?scope=mine`, {
    headers: { ...authHeaders(token), 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error('Nie udało się pobrać Twoich ogłoszeń aut.');
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => withCarImage(row as CarListing));
}

export function formatCarPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return 'Cena na zapytanie';
  return `${new Intl.NumberFormat('pl-PL').format(price)} PLN`;
}
