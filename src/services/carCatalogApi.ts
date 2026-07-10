import { API_URL } from '../config/network';

export type CatalogOption = { value: string; label: string };

export type CatalogResource =
  | 'makes'
  | 'models'
  | 'generations'
  | 'fuel_types'
  | 'engine_powers'
  | 'engine_capacities'
  | 'door_counts'
  | 'gearboxes'
  | 'versions';

export type CatalogQuery = {
  resource: CatalogResource;
  make?: string;
  model?: string;
  year?: string;
  generation?: string;
  fuel_type?: string;
  engine_power?: string;
  engine_capacity?: string;
  door_count?: string;
  gearbox?: string;
};

export async function fetchCarCatalogOptions(query: CatalogQuery): Promise<CatalogOption[]> {
  const search = new URLSearchParams({ resource: query.resource });
  if (query.make) search.set('make', query.make);
  if (query.model) search.set('model', query.model);
  if (query.year) search.set('year', query.year);
  if (query.generation) search.set('generation', query.generation);
  if (query.fuel_type) search.set('fuel_type', query.fuel_type);
  if (query.engine_power) search.set('engine_power', query.engine_power);
  if (query.engine_capacity) search.set('engine_capacity', query.engine_capacity);
  if (query.door_count) search.set('door_count', query.door_count);
  if (query.gearbox) search.set('gearbox', query.gearbox);

  const response = await fetch(`${API_URL}/api/cars/catalog?${search.toString()}`, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  return Array.isArray(data?.options) ? data.options : [];
}

export const BODY_TYPE_OPTIONS = [
  'SUV',
  'Sedan',
  'Kombi',
  'Hatchback',
  'Coupe',
  'Kabriolet',
  'Van',
  'Pickup',
  'Inny',
];
