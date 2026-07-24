import React from 'react';
import { useEcosystemStore } from '../store/useEcosystemStore';
import RadarHomeScreen from '../screens/RadarHomeScreen';
import CarsCatalogScreen from '../screens/CarsCatalogScreen';

export type MarketSurface = 'market' | 'explore';

type Props = {
  splashDone?: boolean;
  surface: MarketSurface;
  navigation?: any;
  route?: any;
};

/**
 * Shell tabów Market i Mapy+Radar — Homes|Cars z ecosystem store.
 */
export default function MarketExploreShell({ splashDone = true, surface, navigation, route }: Props) {
  const activeVertical = useEcosystemStore((s) => s.activeVertical);
  const baseParams = route?.params && typeof route.params === 'object' ? route.params : {};

  if (activeVertical === 'car') {
    return (
      <CarsCatalogScreen
        surface={surface}
        initialBrowseMode={surface === 'market' ? 'GALLERY' : 'MAP'}
      />
    );
  }

  const openLiveRadar = !!(baseParams.openCalibration || baseParams.radarFocus);
  const params =
    surface === 'market'
      ? {
          ...baseParams,
          tabSurface: 'market' as const,
          radarBrowseMode: 'GALLERY' as const,
          exploreLive: false,
        }
      : {
          ...baseParams,
          tabSurface: 'explore' as const,
          // Mapa katalogu domyślnie; Radar live przy deep linku kalibracji / matches
          radarBrowseMode: 'RADAR' as const,
          exploreLive: openLiveRadar || baseParams.exploreLive === true,
        };

  return (
    <RadarHomeScreen
      splashDone={splashDone}
      navigation={navigation}
      route={{ ...(route || {}), params }}
    />
  );
}
