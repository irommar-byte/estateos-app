import type { CarListing } from '../services/carsApi';

export type CarsSortKey = 'newest' | 'price_asc' | 'price_desc' | 'mileage_asc';

export type CarsAdvancedFilters = {
  query: string;
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  generation: string;
  generationSlug: string;
  fuelType: string;
  bodyType: string;
  exteriorColor: string;
  transmission: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  minMileage: string;
  maxMileage: string;
  sort: CarsSortKey;
};

export const EMPTY_CARS_ADVANCED_FILTERS: CarsAdvancedFilters = {
  query: '',
  make: '',
  makeSlug: '',
  model: '',
  modelSlug: '',
  generation: '',
  generationSlug: '',
  fuelType: '',
  bodyType: '',
  exteriorColor: '',
  transmission: '',
  city: '',
  minPrice: '',
  maxPrice: '',
  minYear: '',
  maxYear: '',
  minMileage: '',
  maxMileage: '',
  sort: 'newest',
};

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function parseDigits(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function carsAdvancedFiltersActive(filters: CarsAdvancedFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.make.trim() !== '' ||
    filters.model.trim() !== '' ||
    filters.generation.trim() !== '' ||
    filters.fuelType.trim() !== '' ||
    filters.bodyType.trim() !== '' ||
    filters.exteriorColor.trim() !== '' ||
    filters.transmission.trim() !== '' ||
    filters.city.trim() !== '' ||
    filters.minPrice.trim() !== '' ||
    filters.maxPrice.trim() !== '' ||
    filters.minYear.trim() !== '' ||
    filters.maxYear.trim() !== '' ||
    filters.minMileage.trim() !== '' ||
    filters.maxMileage.trim() !== '' ||
    filters.sort !== 'newest'
  );
}

export function applyCarsAdvancedFilters(
  cars: CarListing[],
  filters: CarsAdvancedFilters,
): CarListing[] {
  const q = filters.query.trim().toLowerCase();
  const minPrice = parseDigits(filters.minPrice);
  const maxPrice = parseDigits(filters.maxPrice);
  const minYear = parseDigits(filters.minYear);
  const maxYear = parseDigits(filters.maxYear);
  const minMileage = parseDigits(filters.minMileage);
  const maxMileage = parseDigits(filters.maxMileage);

  const rows = cars.filter((car) => {
    if (filters.make && normalizeLabel(car.make) !== normalizeLabel(filters.make)) return false;
    if (filters.model && normalizeLabel(car.model) !== normalizeLabel(filters.model)) return false;
    if (filters.generation) {
      const carGeneration = String(car.generation || '').trim();
      if (carGeneration && normalizeLabel(carGeneration) !== normalizeLabel(filters.generation)) return false;
      if (
        !carGeneration &&
        !normalizeLabel([car.make, car.model, car.title].join(' ')).includes(normalizeLabel(filters.generation))
      ) {
        return false;
      }
    }
    if (filters.fuelType && car.fuelType !== filters.fuelType) return false;
    if (filters.bodyType && car.bodyType !== filters.bodyType) return false;
    if (filters.exteriorColor && normalizeLabel(car.exteriorColor || '') !== normalizeLabel(filters.exteriorColor)) {
      return false;
    }
    if (filters.transmission && car.transmission !== filters.transmission) return false;
    if (filters.city && !normalizeLabel(car.city).includes(normalizeLabel(filters.city))) return false;
    if (minPrice != null && car.pricePln < minPrice) return false;
    if (maxPrice != null && car.pricePln > maxPrice) return false;
    if (minYear != null && car.year < minYear) return false;
    if (maxYear != null && car.year > maxYear) return false;
    if (minMileage != null && car.mileageKm < minMileage) return false;
    if (maxMileage != null && car.mileageKm > maxMileage) return false;
    if (q) {
      const haystack = [car.title, car.make, car.model, car.city, car.fuelType, car.exteriorColor, car.bodyType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return sortCarListings(rows, filters.sort);
}

export function sortCarListings(cars: CarListing[], sort: CarsSortKey): CarListing[] {
  const copy = [...cars];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => a.pricePln - b.pricePln);
    case 'price_desc':
      return copy.sort((a, b) => b.pricePln - a.pricePln);
    case 'mileage_asc':
      return copy.sort((a, b) => a.mileageKm - b.mileageKm);
    case 'newest':
    default:
      return copy.sort(
        (a, b) => Date.parse(String(b.createdAt || 0)) - Date.parse(String(a.createdAt || 0)),
      );
  }
}

export function countCarsAdvancedMatches(cars: CarListing[], draft: CarsAdvancedFilters): number {
  return applyCarsAdvancedFilters(cars, draft).length;
}
