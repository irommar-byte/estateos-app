/** Karta promocyjna w slocie „Zakupy i sklep” (Profil). */

export type ProfilePromoCardKind = 'free_listing' | 'plus_package' | 'admin_promo';

export type AdminPromoCardPayload = {
  userId: number | string;
  title: string;
  subtitle: string;
  meta?: string;
  accentColor?: string;
  iconName?: string;
  expiresAt?: string | null;
};

export type ProfilePromoCardRecord = {
  id: string;
  kind: ProfilePromoCardKind;
  title: string;
  subtitle: string;
  meta: string;
  pillLabel: string;
  pillColor: string;
  pillBg: string;
  pillBorder: string;
  iconName: string;
  iconBg: string;
  borderColor: string;
  /** Delikatne „oderwanie” — animacja zachęty. */
  peelHint?: boolean;
  /** Można przesunąć palcem jak kartkę. */
  peelable?: boolean;
  createdAt?: string;
};
