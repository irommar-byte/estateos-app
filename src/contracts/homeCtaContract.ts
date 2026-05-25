export type HomeCtaId = 'RADAR' | 'LIST' | 'ACCOUNT' | 'PRO';
export type HomeCtaMode = 'APP';
export type HomeCtaAnalyticsEvent =
  | 'home_cta_click'
  | 'home_cta_route_resolved'
  | 'home_cta_flow_opened';

export type HomeCtaContractEntry = {
  id: HomeCtaId;
  mode: HomeCtaMode;
  appRoute: string;
  webRoute: string;
};

/**
 * Parity z aplikacją: jedno konto — Radar (szukaj), Dodaj ofertę, Profil.
 * Pro / partner tylko na WWW (/cennik, /moje-konto).
 */
export const HOME_CTA_CONTRACT: Record<HomeCtaId, HomeCtaContractEntry> = {
  RADAR: {
    id: 'RADAR',
    mode: 'APP',
    appRoute: 'MainTabs/Radar',
    webRoute: '/odkryj-mape',
  },
  LIST: {
    id: 'LIST',
    mode: 'APP',
    appRoute: 'MainTabs/Dodaj',
    webRoute: '/dodaj-oferte',
  },
  ACCOUNT: {
    id: 'ACCOUNT',
    mode: 'APP',
    appRoute: 'MainTabs/Profil',
    webRoute: '/moje-konto',
  },
  PRO: {
    id: 'PRO',
    mode: 'APP',
    appRoute: 'WebOnly/Cennik',
    webRoute: '/cennik',
  },
};

/** @deprecated Użyj HOME_CTA_CONTRACT — mapowanie starych ID z analytics. */
export const LEGACY_HOME_CTA_MAP: Record<string, HomeCtaId> = {
  BUY: 'RADAR',
  SELL: 'LIST',
  INVESTOR: 'RADAR',
  OWNER: 'ACCOUNT',
};
