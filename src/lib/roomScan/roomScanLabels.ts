import type { Locale } from '@/i18n/config';

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

const ROOM_LABELS: Record<Locale, Record<string, string>> = {
  pl: {
    livingRoom: 'Salon',
    livingRoomKitchenette: 'Salon z aneksem kuchennym',
    bedroom: 'Sypialnia',
    room: 'Pokój',
    bathroom: 'Łazienka',
    wc: 'WC',
    kitchen: 'Kuchnia',
    diningRoom: 'Jadalnia',
    office: 'Gabinet',
    hallway: 'Przedpokój',
    closet: 'Garderoba',
    storageUnit: 'Komórka lokatorska',
    laundry: 'Pralnia',
    garage: 'Garaż',
    balcony: 'Balkon',
    unspecified: 'Pomieszczenie',
  },
  en: {
    livingRoom: 'Living room',
    livingRoomKitchenette: 'Living room with kitchenette',
    bedroom: 'Bedroom',
    room: 'Room',
    bathroom: 'Bathroom',
    wc: 'WC',
    kitchen: 'Kitchen',
    diningRoom: 'Dining room',
    office: 'Office',
    hallway: 'Hallway',
    closet: 'Closet',
    storageUnit: 'Storage',
    laundry: 'Laundry',
    garage: 'Garage',
    balcony: 'Balcony',
    unspecified: 'Room',
  },
  uk: {
    livingRoom: 'Вітальня',
    livingRoomKitchenette: 'Вітальня з кухнею',
    bedroom: 'Спальня',
    room: 'Кімната',
    bathroom: 'Ванна',
    wc: 'WC',
    kitchen: 'Кухня',
    diningRoom: 'Їдальня',
    office: 'Кабінет',
    hallway: 'Коридор',
    closet: 'Гардероб',
    storageUnit: 'Комора',
    laundry: 'Пральня',
    garage: 'Гараж',
    balcony: 'Балкон',
    unspecified: 'Приміщення',
  },
};

const ROOM_COUNT: Record<Locale, { one: string; few: string; many: string }> = {
  pl: {
    one: '{{count}} pomieszczenie',
    few: '{{count}} pomieszczenia',
    many: '{{count}} pomieszczeń',
  },
  en: {
    one: '{{count}} room',
    few: '{{count}} rooms',
    many: '{{count}} rooms',
  },
  uk: {
    one: '{{count}} приміщення',
    few: '{{count}} приміщення',
    many: '{{count}} приміщень',
  },
};

function interpolate(template: string, count: number): string {
  return template.replace('{{count}}', String(count));
}

export function getRoomScanSectionLabel(key: string, locale: Locale = 'pl'): string {
  const normalized = ROOM_TYPE_KEYS.has(key) ? key : 'unspecified';
  return ROOM_LABELS[locale][normalized] || ROOM_LABELS.en[normalized];
}

export { inferRoomTypeFromObjects } from './roomScanClassify';

export function formatRoomScanRoomCount(count: number, locale: Locale): string {
  const templates = ROOM_COUNT[locale] || ROOM_COUNT.en;
  if (locale === 'pl') {
    if (count === 1) return interpolate(templates.one, count);
    if (count >= 2 && count <= 4) return interpolate(templates.few, count);
    return interpolate(templates.many, count);
  }
  if (locale === 'uk') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return interpolate(templates.one, count);
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return interpolate(templates.few, count);
    }
    return interpolate(templates.many, count);
  }
  if (count === 1) return interpolate(templates.one, count);
  return interpolate(templates.many, count);
}
