import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../components/ApplePressable';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryTheme } from '../components/discovery/discoveryTheme';
import { useAuthStore } from '../store/useAuthStore';
import { trackDiscoveryEvent } from '../services/discoveryService';
import { useIsDarkTheme } from '../store/useThemeStore';

export default function DiscoveryJourneyHonorScreen({ navigation, route }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryJourneyHonorInner navigation={navigation} route={route} />
    </IntelligenceRequired>
  );
}

function DiscoveryJourneyHonorInner({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const offerId = Number(route?.params?.offerId || 0);
  const token = useAuthStore((state) => state.token);
  const [confirmed, setConfirmed] = useState(false);
  const brand = isDark ? '#D4AF37' : '#B45309';

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('MainTabs', { screen: 'Market' });
  };

  const honor = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (offerId > 0) void trackDiscoveryEvent({ token, eventType: 'DISCOVERY_PHASE_END', offerId });
    setConfirmed(true);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={{ width: '100%' }}>
        <DiscoveryScreenChrome theme={theme} onBack={goBack} />
      </View>
      <Text style={[styles.kicker, { color: brand }]}>DISCOVERY™</Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {confirmed ? 'Poszukiwanie domknięte.' : 'Czy to jest Twoje miejsce?'}
      </Text>
      <Text style={[styles.text, { color: theme.textMuted }]}>
        {confirmed
          ? 'Doszedłeś tu własnymi wyborami. Discovery nie będzie nęcić kolejnymi ofertami.'
          : 'Nie musisz decydować pod presją. Jeśli to ten trop, możesz uhonorować zakończenie tej fazy.'}
      </Text>
      {confirmed ? (
        <ApplePressable
          style={[styles.primary, { backgroundColor: brand }]}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={[styles.primaryText, { color: isDark ? '#080808' : '#FFFFFF' }]}>
            Wróć do EstateOS
          </Text>
        </ApplePressable>
      ) : (
        <>
          <ApplePressable style={[styles.primary, { backgroundColor: brand }]} onPress={honor}>
            <Text style={[styles.primaryText, { color: isDark ? '#080808' : '#FFFFFF' }]}>
              To jest to
            </Text>
          </ApplePressable>
          <ApplePressable style={styles.secondary} haptic="none" onPress={goBack}>
            <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Jeszcze nie</Text>
          </ApplePressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  kicker: { fontWeight: '900', fontSize: 11, letterSpacing: 3 },
  title: { fontWeight: '800', fontSize: 30, textAlign: 'center', marginTop: 15 },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  primary: {
    width: '100%',
    height: 53,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  primaryText: { fontWeight: '900', fontSize: 15 },
  secondary: { padding: 16 },
  secondaryText: { fontWeight: '800', fontSize: 14 },
});
