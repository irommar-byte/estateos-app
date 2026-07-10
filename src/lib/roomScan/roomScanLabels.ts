import { getAppLocale, t } from '../../i18n';

const ROOM_TYPE_KEYS = new Set([
  'livingRoom',
  'bedroom',
  'bathroom',
  'kitchen',
  'diningRoom',
  'office',
  'hallway',
  'closet',
  'laundry',
  'garage',
  'balcony',
  'unspecified',
]);

export function getRoomScanSectionLabel(key: string): string {
  const normalized = ROOM_TYPE_KEYS.has(key) ? key : 'unspecified';
  return t(`addOffer.step5.roomScan.roomTypes.${normalized}`);
}

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
