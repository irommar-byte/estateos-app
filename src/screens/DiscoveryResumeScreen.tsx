import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../components/ApplePressable';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryTheme } from '../components/discovery/discoveryTheme';
import { useAuthStore } from '../store/useAuthStore';
import { useDiscoveryStore } from '../store/useDiscoveryStore';
import { trackDiscoveryEvent } from '../services/discoveryService';
import { useIsDarkTheme } from '../store/useThemeStore';

export default function DiscoveryResumeScreen({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryResumeInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function DiscoveryResumeInner({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const token = useAuthStore((state) => state.token);
  const session = useDiscoveryStore((state) => state.session);
  const brand = isDark ? '#D4AF37' : '#B45309';

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('MainTabs', { screen: 'Market' });
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
      <Text style={[styles.title, { color: theme.text }]}>Twój trop czeka spokojnie.</Text>
      <Text style={[styles.text, { color: theme.textMuted }]}>
        Nie zaczynasz od zera. Możesz kontynuować, odświeżyć kierunek lub wrócić później.
      </Text>
      <ApplePressable
        style={[styles.primary, { backgroundColor: brand }]}
        onPress={() => {
          void trackDiscoveryEvent({ token, eventType: 'DISCOVERY_RESUME', sessionId: session?.id });
          navigation.replace('EstateDiscovery');
        }}
      >
        <Text style={[styles.primaryText, { color: isDark ? '#080808' : '#FFFFFF' }]}>
          Kontynuuj trop
        </Text>
      </ApplePressable>
      <ApplePressable style={styles.secondary} onPress={() => navigation.navigate('DiscoveryLifeShift')}>
        <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>
          Sprawdź, co się przesunęło
        </Text>
      </ApplePressable>
      <ApplePressable style={styles.later} haptic="none" onPress={goBack}>
        <Text style={[styles.laterText, { color: theme.textMuted }]}>Wróć później</Text>
      </ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  title: { fontSize: 29, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  primary: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  primaryText: { fontWeight: '900', fontSize: 15 },
  secondary: { padding: 16 },
  secondaryText: { fontWeight: '800', fontSize: 14 },
  later: { padding: 10 },
  laterText: { fontSize: 13, fontWeight: '700' },
});
