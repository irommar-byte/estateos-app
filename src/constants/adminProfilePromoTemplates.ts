import type { AdminProfilePromoTemplate } from '../contracts/profilePromoContract';

/** Gotowe szablony kuponów — pierwszy: urodzinowe darmowe ogłoszenie. */
export const ADMIN_PROFILE_PROMO_TEMPLATES: AdminProfilePromoTemplate[] = [
  {
    id: 'birthday_free_listing',
    labelPl: 'Kupon urodzinowy — darmowe ogłoszenie',
    title: 'Darmowe Ogłoszenie',
    subtitle: 'Kupon urodzinowy od EstateOS',
    meta: 'Jedna bezpłatna publikacja ogłoszenia. Po wykorzystaniu karta przejdzie w status „Wykorzystane”.',
    accentColor: '#FF9F0A',
    iconName: 'gift',
    pillLabel: 'Urodziny',
    grantsFreeListing: true,
    purpose: 'publication',
  },
];
