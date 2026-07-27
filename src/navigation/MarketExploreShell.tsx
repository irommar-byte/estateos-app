import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useEcosystemStore } from '../store/useEcosystemStore';
import RadarHomeScreen from '../screens/RadarHomeScreen';
import CarsCatalogScreen from '../screens/CarsCatalogScreen';
import EstateOsGuideOverlay from '../components/discovery/EstateOsGuideOverlay';
import IntelligencePulseTape from '../components/discovery/IntelligencePulseTape';
import { useIntelligencePreferenceStore } from '../store/useIntelligencePreferenceStore';

export type MarketSurface = 'market' | 'explore';

type Props = {
  splashDone?: boolean;
  surface: MarketSurface;
  navigation?: any;
  route?: any;
};

/**
 * Shell tabów Market i Mapy+Radar — Homes|Cars z ecosystem store.
 * Animacja przełączenia Home↔Car jest montowana raz w MainTabs.
 */
export default function MarketExploreShell({ splashDone = true, surface, navigation, route }: Props) {
  const activeVertical = useEcosystemStore((s) => s.activeVertical);
  const intelligenceEnabled = useIntelligencePreferenceStore((s) => s.enabled);
  const intelligenceHydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const baseParams = route?.params && typeof route.params === 'object' ? route.params : {};

  const openLiveRadar = !!(baseParams.openCalibration || baseParams.radarFocus);
  const homeParams =
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
          radarBrowseMode: 'RADAR' as const,
          exploreLive: openLiveRadar || baseParams.exploreLive === true,
        };

  const showIntelligence =
    activeVertical === 'home' && intelligenceHydrated && intelligenceEnabled;

  return (
    <View style={styles.root}>
      {activeVertical === 'car' ? (
        <CarsCatalogScreen
          surface={surface}
          initialBrowseMode={surface === 'market' ? 'GALLERY' : 'MAP'}
        />
      ) : (
        <RadarHomeScreen
          splashDone={splashDone}
          navigation={navigation}
          route={{ ...(route || {}), params: homeParams }}
        />
      )}
      {showIntelligence && surface === 'explore' ? (
        <EstateOsGuideOverlay navigation={navigation} />
      ) : null}
      {showIntelligence ? <IntelligencePulseTape navigation={navigation} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
