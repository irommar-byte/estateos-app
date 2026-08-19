import { isStrictOfferCity } from './detectOfferDistrict';
import { REST_OF_COUNTRY_CITY } from '../constants/locationEcosystem';

export const ACQUISITION_GUIDE_STEPS = [
  {
    id: 1,
    title: 'Spotkanie',
    question: 'Po co klient sprzedaje i w jakim horyzoncie czasowym?',
  },
  {
    id: 2,
    title: 'Stan prawny',
    question: 'Kto jest właścicielem i jaki jest stan prawny nieruchomości?',
  },
  {
    id: 3,
    title: 'Nieruchomość',
    question: 'Gdzie jest lokal i jakie ma parametry? Mapą ustawiamy też dzielnicę.',
  },
  {
    id: 4,
    title: 'Strategia',
    question: 'Jaka cena sprzedaży i jakie zgody na marketing?',
  },
  {
    id: 5,
    title: 'Współpraca',
    question: 'Jakie warunki umowy, okres i prowizja?',
  },
  {
    id: 6,
    title: 'Podpis',
    question: 'Potwierdź wzór umowy i zbierz podpis klienta.',
  },
] as const;

export type AcquisitionOfferGap = {
  step: number;
  key: string;
  label: string;
};

function num(raw: unknown): number {
  const n = Number(String(raw ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function findAcquisitionOfferGaps(form: {
  property?: Record<string, unknown>;
  strategy?: Record<string, unknown>;
} | null): AcquisitionOfferGap[] {
  if (!form) return [{ step: 3, key: 'property.address', label: 'Adres nieruchomości' }];
  const property = (form.property || {}) as Record<string, unknown>;
  const strategy = (form.strategy || {}) as Record<string, unknown>;
  const address = String(property.address || '').trim();
  const city = String(property.city || '').trim();
  const district = String(property.district || '').trim();
  const lat = num(property.lat);
  const lng = num(property.lng);
  const area = num(property.area);
  const rooms = num(property.rooms);
  const price = num(strategy.expectedPrice);
  const gaps: AcquisitionOfferGap[] = [];

  if (!address) gaps.push({ step: 3, key: 'property.address', label: 'Adres nieruchomości' });
  if (!(Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01)) {
    gaps.push({ step: 3, key: 'property.pin', label: 'Pinezka na mapie' });
  }
  if (!city) gaps.push({ step: 3, key: 'property.city', label: 'Miasto' });
  if (city && isStrictOfferCity(city) && !district) {
    gaps.push({ step: 3, key: 'property.district', label: 'Dzielnica' });
  }
  if (city === REST_OF_COUNTRY_CITY && !district) {
    gaps.push({ step: 3, key: 'property.district', label: 'Dzielnica / miejscowość' });
  }
  if (area <= 0) gaps.push({ step: 3, key: 'property.area', label: 'Powierzchnia' });
  if (rooms <= 0) gaps.push({ step: 3, key: 'property.rooms', label: 'Liczba pokoi' });
  if (price <= 0) gaps.push({ step: 4, key: 'strategy.expectedPrice', label: 'Cena oczekiwana' });
  return gaps;
}

export function acquisitionOfferErrorKeys(gaps: AcquisitionOfferGap[]): Set<string> {
  return new Set(gaps.map((item) => item.key));
}

export function acquisitionOfferErrorSteps(gaps: AcquisitionOfferGap[]): number[] {
  return [...new Set(gaps.map((item) => item.step))];
}
