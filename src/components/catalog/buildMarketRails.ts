import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { CatalogRailItem, CatalogRailSection } from './CatalogHorizontalRail';
import { resolveOfferPriceDiscount } from '../../utils/offerPriceDiscount';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Loc = { latitude: number; longitude: number } | null;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function publishedAtMs(raw: Record<string, unknown>): number {
  const value = raw?.publishedAt || raw?.published_at || raw?.createdAt || raw?.created_at;
  const ms = new Date(String(value || '')).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizePropertyType(raw: Record<string, unknown>): string {
  return String(raw?.propertyType || raw?.type || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function matchesPropertyRail(raw: Record<string, unknown>, key: string): boolean {
  const t = normalizePropertyType(raw);
  if (key === 'FLAT') return t.includes('FLAT') || t.includes('APART') || t.includes('MIESZKAN');
  if (key === 'HOUSE') return t.includes('HOUSE') || t.includes('DOM') || t.includes('VILLA');
  if (key === 'PLOT') return t.includes('PLOT') || t.includes('DZIAL') || t.includes('LAND');
  if (key === 'COMMERCIAL') {
    return (
      t.includes('COMMERCIAL') ||
      t.includes('PREMISES') ||
      t.includes('LOKAL') ||
      t.includes('OFFICE') ||
      t.includes('STORE')
    );
  }
  return false;
}

export type HomeRailOffer = {
  id: number | string;
  lat?: number;
  lng?: number;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  raw: Record<string, unknown>;
};

function toRailItem(o: HomeRailOffer): CatalogRailItem {
  return {
    id: o.id,
    title: o.title,
    subtitle: o.subtitle,
    imageUrl: o.imageUrl,
    priceLabel: o.priceLabel,
  };
}

type HomeLabels = {
  favorites: string;
  mine: string;
  newest: string;
  nearest: string;
  discounted: string;
  nearDeeds: string;
  flats: string;
  houses: string;
  plots: string;
  commercial: string;
  favoritesEmpty: string;
  mineEmpty: string;
};

export function buildHomeMarketRailSections(args: {
  favorites: HomeRailOffer[];
  mine: HomeRailOffer[];
  catalog: HomeRailOffer[];
  userLocation: Loc;
  labels: HomeLabels;
  deedTape?: CatalogRailItem[];
  intelligenceTape?: CatalogRailItem[];
  intelligenceTitle?: string;
  intelligenceEyebrow?: string;
  nearDeedsEyebrow?: string;
  onNeedMoreDeeds?: () => void;
  deedHasMore?: boolean;
  deedLoadingMore?: boolean;
}): CatalogRailSection[] {
  const {
    favorites,
    mine,
    catalog,
    userLocation,
    labels,
    deedTape = [],
    intelligenceTape = [],
    intelligenceTitle,
    intelligenceEyebrow,
    nearDeedsEyebrow,
    onNeedMoreDeeds,
    deedHasMore,
    deedLoadingMore,
  } = args;

  const newest = [...catalog]
    .sort((a, b) => publishedAtMs(b.raw) - publishedAtMs(a.raw))
    .slice(0, 60)
    .map(toRailItem);

  const nearest =
    userLocation && Number.isFinite(userLocation.latitude)
      ? [...catalog]
          .map((o) => ({
            o,
            d:
              Number.isFinite(o.lat) && Number.isFinite(o.lng)
                ? haversineKm(userLocation.latitude, userLocation.longitude, Number(o.lat), Number(o.lng))
                : Number.POSITIVE_INFINITY,
          }))
          .filter((x) => Number.isFinite(x.d))
          .sort((a, b) => a.d - b.d)
          .slice(0, 60)
          .map((x) => toRailItem(x.o))
      : [];

  const discounted = catalog
    .filter((o) => resolveOfferPriceDiscount(o.raw).isDiscounted)
    .slice(0, 60)
    .map(toRailItem);

  const typeRails: Array<{
    id: string;
    key: string;
    title: string;
    icon: IconName;
    accent: string;
  }> = [
    { id: 'flats', key: 'FLAT', title: labels.flats, icon: 'business', accent: '#6366F1' },
    { id: 'houses', key: 'HOUSE', title: labels.houses, icon: 'home', accent: '#10b981' },
    { id: 'plots', key: 'PLOT', title: labels.plots, icon: 'map', accent: '#F59E0B' },
    { id: 'commercial', key: 'COMMERCIAL', title: labels.commercial, icon: 'storefront', accent: '#0EA5E9' },
  ];

  const sections: CatalogRailSection[] = [
    {
      id: 'favorites',
      title: labels.favorites,
      icon: 'heart',
      accent: '#F777B2',
      items: favorites.map(toRailItem),
      showWhenEmpty: true,
      emptyLabel: labels.favoritesEmpty,
    },
    {
      id: 'mine',
      title: labels.mine,
      icon: 'home',
      accent: '#10b981',
      items: mine.map(toRailItem),
      showWhenEmpty: true,
      emptyLabel: labels.mineEmpty,
    },
    {
      id: 'newest',
      title: labels.newest,
      icon: 'sparkles',
      accent: '#6366F1',
      items: newest,
    },
    ...(intelligenceTape.length
      ? [
          {
            id: 'intelligence',
            title: intelligenceTitle || 'Dla Ciebie',
            icon: 'color-wand' as IconName,
            accent: '#BF5AF2',
            items: intelligenceTape,
            variant: 'rainbow' as const,
            eyebrow: intelligenceEyebrow || 'EstateOS Intelligence',
          },
        ]
      : []),
    {
      id: 'near-deeds',
      title: labels.nearDeeds,
      icon: 'diamond',
      accent: '#C9A227',
      items: deedTape,
      variant: 'proExclusive' as const,
      eyebrow: nearDeedsEyebrow || 'Pakiet Pro · tylko dla Ciebie',
      onNeedMore: onNeedMoreDeeds,
      hasMore: deedHasMore,
      loadingMore: deedLoadingMore,
    },
    {
      id: 'nearest',
      title: labels.nearest,
      icon: 'navigate',
      accent: '#10b981',
      items: nearest,
    },
    {
      id: 'discounted',
      title: labels.discounted,
      icon: 'pricetag',
      accent: '#EF4444',
      items: discounted,
    },
  ];

  for (const rail of typeRails) {
    const items = catalog.filter((o) => matchesPropertyRail(o.raw, rail.key)).map(toRailItem);
    if (!items.length) continue;
    sections.push({
      id: rail.id,
      title: rail.title,
      icon: rail.icon,
      accent: rail.accent,
      items,
    });
  }

  return sections;
}

export type CarRailListing = {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  vehicleType?: string;
  cityLat?: number | null;
  cityLng?: number | null;
  createdAt?: string;
  year?: number;
  city?: string;
  make?: string;
  model?: string;
};

type CarLabels = {
  favorites: string;
  mine: string;
  newest: string;
  nearest: string;
  motorcycle: string;
  car: string;
  van: string;
  truck: string;
  favoritesEmpty: string;
  mineEmpty: string;
};

function carToItem(c: CarRailListing): CatalogRailItem {
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    imageUrl: c.imageUrl,
    priceLabel: c.priceLabel,
  };
}

export function buildCarMarketRailSections(args: {
  favorites: CarRailListing[];
  mine: CarRailListing[];
  catalog: CarRailListing[];
  userLocation: Loc;
  labels: CarLabels;
}): CatalogRailSection[] {
  const { favorites, mine, catalog, userLocation, labels } = args;

  const newest = [...catalog]
    .sort((a, b) => Date.parse(String(b.createdAt || 0)) - Date.parse(String(a.createdAt || 0)))
    .slice(0, 60)
    .map(carToItem);

  const nearest =
    userLocation && Number.isFinite(userLocation.latitude)
      ? [...catalog]
          .map((c) => ({
            c,
            d:
              Number.isFinite(c.cityLat) && Number.isFinite(c.cityLng)
                ? haversineKm(userLocation.latitude, userLocation.longitude, Number(c.cityLat), Number(c.cityLng))
                : Number.POSITIVE_INFINITY,
          }))
          .filter((x) => Number.isFinite(x.d))
          .sort((a, b) => a.d - b.d)
          .slice(0, 60)
          .map((x) => carToItem(x.c))
      : [];

  const typeOrder: Array<{ id: string; type: string; title: string; icon: IconName }> = [
    { id: 'motorcycle', type: 'motorcycle', title: labels.motorcycle, icon: 'bicycle' },
    { id: 'car', type: 'car', title: labels.car, icon: 'car-sport' },
    { id: 'van', type: 'van', title: labels.van, icon: 'bus' },
    { id: 'truck', type: 'truck', title: labels.truck, icon: 'trail-sign' },
  ];

  const sections: CatalogRailSection[] = [
    {
      id: 'favorites',
      title: labels.favorites,
      icon: 'heart',
      accent: '#F777B2',
      items: favorites.map(carToItem),
      showWhenEmpty: true,
      emptyLabel: labels.favoritesEmpty,
    },
    {
      id: 'mine',
      title: labels.mine,
      icon: 'car-sport',
      accent: '#0EA5E9',
      items: mine.map(carToItem),
      showWhenEmpty: true,
      emptyLabel: labels.mineEmpty,
    },
    { id: 'newest', title: labels.newest, icon: 'sparkles', accent: '#0EA5E9', items: newest },
    { id: 'nearest', title: labels.nearest, icon: 'navigate', accent: '#10b981', items: nearest },
  ];

  for (const rail of typeOrder) {
    const items = catalog
      .filter((c) => String(c.vehicleType || 'car') === rail.type)
      .map(carToItem);
    if (!items.length) continue;
    sections.push({
      id: rail.id,
      title: rail.title,
      icon: rail.icon,
      accent: '#0EA5E9',
      items,
    });
  }

  return sections;
}
