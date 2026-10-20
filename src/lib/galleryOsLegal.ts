/** Publiczne dokumenty prawne GalleryOS™ — osobny produkt od EstateOS™ i ParagonOS™. */
export const GALLERYOS_SITE = "https://estateos.pl";
export const GALLERYOS_CONTACT_EMAIL = "kontakt@estateos.pl";
export const GALLERYOS_PHONE_DISPLAY = "+48 733 344 955";
export const GALLERYOS_PHONE_TEL = "+48733344955";

export const GALLERYOS_PATHS = {
  home: "/galleryos",
  privacyPl: "/galleryos/polityka-prywatnosci",
  privacyEn: "/galleryos/privacy",
  termsPl: "/galleryos/regulamin",
  termsEn: "/galleryos/terms",
  supportPl: "/galleryos/wsparcie",
  supportEn: "/galleryos/support",
} as const;

export const GALLERYOS_URLS = {
  home: `${GALLERYOS_SITE}${GALLERYOS_PATHS.home}`,
  privacyPl: `${GALLERYOS_SITE}${GALLERYOS_PATHS.privacyPl}`,
  privacyEn: `${GALLERYOS_SITE}${GALLERYOS_PATHS.privacyEn}`,
  termsPl: `${GALLERYOS_SITE}${GALLERYOS_PATHS.termsPl}`,
  termsEn: `${GALLERYOS_SITE}${GALLERYOS_PATHS.termsEn}`,
  supportPl: `${GALLERYOS_SITE}${GALLERYOS_PATHS.supportPl}`,
  supportEn: `${GALLERYOS_SITE}${GALLERYOS_PATHS.supportEn}`,
} as const;
