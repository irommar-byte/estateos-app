export type HomeCtaId = 'BUY' | 'SELL' | 'INVESTOR' | 'OWNER';
export type HomeCtaMode = 'BUYER' | 'SELLER' | 'INVESTOR' | 'OWNER';
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
 * SOT parity z aplikacją mobilną.
 * appRoute pochodzi 1:1 z kontraktu mobile, webRoute to ekwiwalent web flow.
 */
export const HOME_CTA_CONTRACT: Record<HomeCtaId, HomeCtaContractEntry> = {
  BUY: {
    id: 'BUY',
    mode: 'BUYER',
    appRoute: 'MainTabs/Radar',
    webRoute: '/#map',
  },
  SELL: {
    id: 'SELL',
    mode: 'SELLER',
    appRoute: 'MainTabs/Dodaj',
    webRoute: '/dodaj-oferte',
  },
  INVESTOR: {
    id: 'INVESTOR',
    mode: 'INVESTOR',
    appRoute: 'EstateDiscovery',
    webRoute: '/oferty',
  },
  OWNER: {
    id: 'OWNER',
    mode: 'OWNER',
    appRoute: 'MainTabs/Profil',
    webRoute: '/moje-konto',
  },
};

