import { getAppLocale, t } from '../../i18n';
import type { RoomScanObjectCategory } from '../../types/roomScan';

const ROOM_TYPE_KEYS = new Set([
  'livingRoom',
  'livingRoomKitchenette',
  'bedroom',
  'room',
  'bathroom',
  'wc',
  'kitchen',
  'diningRoom',
  'office',
  'hallway',
  'closet',
  'storageUnit',
  'laundry',
  'garage',
  'balcony',
  'unspecified',
]);

const OBJECT_CATEGORIES = new Set<RoomScanObjectCategory>([
  'storage',
  'refrigerator',
  'stove',
  'bed',
  'sink',
  'washerDryer',
  'toilet',
  'bathtub',
  'oven',
  'dishwasher',
  'table',
  'sofa',
  'chair',
  'fireplace',
  'television',
  'stairs',
  'unknown',
]);

export function getRoomScanSectionLabel(key: string): string {
  const normalized = ROOM_TYPE_KEYS.has(key) ? key : 'unspecified';
  return t(`addOffer.step5.roomScan.roomTypes.${normalized}`);
}

export function normalizeRoomScanObjectCategory(raw: string): RoomScanObjectCategory {
  const key = String(raw || '').trim();
  if (OBJECT_CATEGORIES.has(key as RoomScanObjectCategory)) return key as RoomScanObjectCategory;
  // Apple czasem zwraca synonimy / warianty.
  if (key === 'refrigerator' || key === 'fridge') return 'refrigerator';
  if (key === 'stove' || key === 'cooktop') return 'stove';
  if (key === 'washer' || key === 'dryer' || key === 'washerDryer') return 'washerDryer';
  if (key === 'tv' || key === 'television') return 'television';
  return 'unknown';
}

export function getRoomScanObjectLabel(category: RoomScanObjectCategory): string {
  return t(`addOffer.step5.roomScan.objects.${category}`);
}

/** Ikona Ionicons dla kategorii obiektu na liście (nie SVG). */
export function getRoomScanObjectIcon(category: RoomScanObjectCategory): string {
  switch (category) {
    case 'stove':
    case 'oven':
      return 'flame-outline';
    case 'refrigerator':
      return 'snow-outline';
    case 'dishwasher':
    case 'sink':
      return 'water-outline';
    case 'washerDryer':
      return 'sync-outline';
    case 'toilet':
    case 'bathtub':
      return 'water-outline';
    case 'bed':
      return 'bed-outline';
    case 'sofa':
      return 'cafe-outline';
    case 'table':
    case 'chair':
      return 'grid-outline';
    case 'television':
      return 'tv-outline';
    case 'fireplace':
      return 'flame-outline';
    case 'storage':
      return 'file-tray-stacked-outline';
    case 'stairs':
      return 'git-commit-outline';
    default:
      return 'cube-outline';
  }
}

import { inferRoomTypeFromObjects } from './roomScanClassify';
export { inferRoomTypeFromObjects } from './roomScanClassify';

export function formatRoomScanRoomCount(count: number): string {
  const locale = getAppLocale();
  if (locale === 'pl') {
    if (count === 1) return t('addOffer.step5.roomScan.roomCountOne', { count });
    if (count >= 2 && count <= 4) return t('addOffer.step5.roomScan.roomCountFew', { count });
    return t('addOffer.step5.roomScan.roomCountMany', { count });
  }
  if (locale === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return t('addOffer.step5.roomScan.roomCountOne', { count });
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return t('addOffer.step5.roomScan.roomCountFew', { count });
    }
    return t('addOffer.step5.roomScan.roomCountMany', { count });
  }
  if (count === 1) return t('addOffer.step5.roomScan.roomCountOne', { count });
  return t('addOffer.step5.roomScan.roomCountMany', { count });
}
