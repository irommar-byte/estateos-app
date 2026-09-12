/** Publiczne dokumenty prawne aplikacji iOS ParagonOS™ — osobny produkt od EstateOS™. */
export const PARAGONOS_SITE = "https://estateos.pl";
export const PARAGONOS_CONTACT_EMAIL = "kontakt@estateos.pl";
export const PARAGONOS_PRIVACY_EMAIL = "kontakt@estateos.pl";

export const PARAGONOS_PATHS = {
  home: "/paragonos",
  privacyPl: "/paragonos/polityka-prywatnosci",
  privacyEn: "/paragonos/privacy",
  termsPl: "/paragonos/regulamin",
  termsEn: "/paragonos/terms",
  supportPl: "/paragonos/wsparcie",
  supportEn: "/paragonos/support",
} as const;

export const PARAGONOS_URLS = {
  home: `${PARAGONOS_SITE}${PARAGONOS_PATHS.home}`,
  privacyPl: `${PARAGONOS_SITE}${PARAGONOS_PATHS.privacyPl}`,
  privacyEn: `${PARAGONOS_SITE}${PARAGONOS_PATHS.privacyEn}`,
  termsPl: `${PARAGONOS_SITE}${PARAGONOS_PATHS.termsPl}`,
  termsEn: `${PARAGONOS_SITE}${PARAGONOS_PATHS.termsEn}`,
  supportPl: `${PARAGONOS_SITE}${PARAGONOS_PATHS.supportPl}`,
  supportEn: `${PARAGONOS_SITE}${PARAGONOS_PATHS.supportEn}`,
} as const;
