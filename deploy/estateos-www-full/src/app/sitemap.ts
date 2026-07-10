import type { MetadataRoute } from 'next';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';

const STATIC_PATHS = [
  '',
  '/dla-agencji',
  '/dla-prywatnych',
  '/start',
  '/dla-prasy',
  '/dolacz',
  '/oferty',
  '/cars',
  '/cars/dodaj',
  '/odkryj-mape',
  '/cennik',
  '/agencje',
  '/eksperci',
  '/rejestracja',
  '/login',
  '/regulamin',
  '/polityka-prywatnosci',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return STATIC_PATHS.map((path) => ({
    url: `${ESTATEOS_SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/oferty' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/dla-agencji' || path === '/start' ? 0.9 : 0.7,
  }));
}
