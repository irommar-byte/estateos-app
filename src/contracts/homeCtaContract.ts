/**
 * HOME CTA parity contract (web <-> mobile).
 * Zmiany tylko po wspólnej decyzji.
 */

export const HOME_CTA_IDS = ['BUY', 'SELL', 'INVESTOR', 'OWNER'] as const;
export type HomeCtaId = (typeof HOME_CTA_IDS)[number];

export const HOME_CTA_MODES = ['BUYER', 'SELLER', 'INVESTOR', 'OWNER'] as const;
export type HomeCtaMode = (typeof HOME_CTA_MODES)[number];

export type HomeCtaRouteSpec =
  | { screen: 'MainTabs'; params: { screen: 'Radar' | 'Dodaj' | 'Profil' } }
  | { screen: 'EstateDiscovery' };

export type HomeCtaContract = {
  id: HomeCtaId;
  labelPl: 'Kupuję' | 'Sprzedaję' | 'Inwestor' | 'Właściciel';
  mode: HomeCtaMode;
  route: HomeCtaRouteSpec;
  tracking: {
    clickEvent: 'home_cta_click';
    routeResolvedEvent: 'home_cta_route_resolved';
    flowOpenedEvent: 'home_cta_flow_opened';
  };
};

/**
 * Referencyjne mapowanie CTA ekranu startowego.
 */
export const HOME_CTA_CONTRACT_MAP: Record<HomeCtaId, HomeCtaContract> = {
  BUY: {
    id: 'BUY',
    labelPl: 'Kupuję',
    mode: 'BUYER',
    route: { screen: 'MainTabs', params: { screen: 'Radar' } },
    tracking: {
      clickEvent: 'home_cta_click',
      routeResolvedEvent: 'home_cta_route_resolved',
      flowOpenedEvent: 'home_cta_flow_opened',
    },
  },
  SELL: {
    id: 'SELL',
    labelPl: 'Sprzedaję',
    mode: 'SELLER',
    route: { screen: 'MainTabs', params: { screen: 'Dodaj' } },
    tracking: {
      clickEvent: 'home_cta_click',
      routeResolvedEvent: 'home_cta_route_resolved',
      flowOpenedEvent: 'home_cta_flow_opened',
    },
  },
  INVESTOR: {
    id: 'INVESTOR',
    labelPl: 'Inwestor',
    mode: 'INVESTOR',
    route: { screen: 'EstateDiscovery' },
    tracking: {
      clickEvent: 'home_cta_click',
      routeResolvedEvent: 'home_cta_route_resolved',
      flowOpenedEvent: 'home_cta_flow_opened',
    },
  },
  OWNER: {
    id: 'OWNER',
    labelPl: 'Właściciel',
    mode: 'OWNER',
    route: { screen: 'MainTabs', params: { screen: 'Profil' } },
    tracking: {
      clickEvent: 'home_cta_click',
      routeResolvedEvent: 'home_cta_route_resolved',
      flowOpenedEvent: 'home_cta_flow_opened',
    },
  },
};

export function resolveHomeCtaContract(id: HomeCtaId): HomeCtaContract {
  return HOME_CTA_CONTRACT_MAP[id];
}
