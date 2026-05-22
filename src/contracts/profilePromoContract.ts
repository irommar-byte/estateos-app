/** Karta promocyjna w slocie „Zakupy i sklep” (Profil). */

export type ProfilePromoCardKind =
  | 'welcome_coupon'
  | 'plus_package'
  | 'admin_promo'
  | 'birthday_coupon';

/** Do czego można wykorzystać kupon (mały znacznik na karcie). */
export type ProfilePromoCouponPurpose = 'publication' | 'off_market_preview' | 'generic';

export type ProfilePromoVisualTheme = 'default' | 'birthday';

export type AdminProfilePromoTemplateId = 'birthday_free_listing' | 'welcome_free_listing';

export type AdminProfilePromoTemplate = {
  id: AdminProfilePromoTemplateId;
  labelPl: string;
  title: string;
  subtitle: string;
  meta: string;
  accentColor: string;
  iconName: string;
  pillLabel: string;
  grantsFreeListing?: boolean;
  purpose?: ProfilePromoCouponPurpose;
};

export type AdminPromoCardPayload = {
  userId: number | string;
  title: string;
  subtitle: string;
  meta?: string;
  accentColor?: string;
  iconName?: string;
  expiresAt?: string | null;
  templateId?: AdminProfilePromoTemplateId;
  grantsFreeListing?: boolean;
  pillLabel?: string;
  purpose?: ProfilePromoCouponPurpose;
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
  /** Można przesunąć palcem w prawo (następna karta w kole). */
  peelable?: boolean;
  /** Przesunięcie w lewo — ukryj kartę na zawsze (po potwierdzeniu). */
  dismissible?: boolean;
  templateId?: AdminProfilePromoTemplateId;
  /** Kupon admina z jedną darmową publikacją (np. urodziny). */
  grantsFreeListing?: boolean;
  couponUsed?: boolean;
  /** Rok nadania kuponu urodzinowego (np. 2026) — tytuł i paleta kolorów. */
  birthdayYear?: number;
  createdAt?: string;
  purpose?: ProfilePromoCouponPurpose;
  purposeLabel?: string;
  purposeIcon?: string;
  visualTheme?: ProfilePromoVisualTheme;
};
