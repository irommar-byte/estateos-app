import type { MetadataRoute } from 'next';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';
import { FREE_LISTING_PATHS } from '@/lib/seo/freeListingContent';

const STATIC_PATHS: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: FREE_LISTING_PATHS.hub, priority: 1, changeFrequency: 'weekly' },
  { path: FREE_LISTING_PATHS.home, priority: 0.95, changeFrequency: 'weekly' },
  { path: FREE_LISTING_PATHS.sellAlias, priority: 0.9, changeFrequency: 'weekly' },
  { path: '/cars/start', priority: 0.95, changeFrequency: 'weekly' },
  { path: '/cars/dodaj', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/dodaj-oferte', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/dla-prywatnych', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/start', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/oferty', priority: 0.85, changeFrequency: 'daily' },
  { path: '/cars', priority: 0.85, changeFrequency: 'daily' },
  { path: '/cennik', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/dla-agencji', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/dla-prasy', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/dla-prasy/samochody', priority: 0.65, changeFrequency: 'monthly' },
  { path: '/dolacz', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/odkryj-mape', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/agencje', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/eksperci', priority: 0.55, changeFrequency: 'weekly' },
  { path: '/rejestracja', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/regulamin', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/polityka-prywatnosci', priority: 0.3, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return STATIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${ESTATEOS_SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
