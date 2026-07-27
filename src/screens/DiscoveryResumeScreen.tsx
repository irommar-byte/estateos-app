import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';
import { useAuthStore } from '../store/useAuthStore';
import { useDiscoveryStore } from '../store/useDiscoveryStore';
import { trackDiscoveryEvent } from '../services/discoveryService';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';

export default function DiscoveryResumeScreen({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryResumeInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function DiscoveryResumeInner({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const session = useDiscoveryStore((state) => state.session);
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>DISCOVERY™</Text>
      <Text style={styles.title}>Twój trop czeka spokojnie.</Text>
      <Text style={styles.text}>Nie zaczynasz od zera. Możesz kontynuować, odświeżyć kierunek lub wrócić później.</Text>
      <ApplePressable
        style={styles.primary}
        onPress={() => {
          void trackDiscoveryEvent({ token, eventType: 'DISCOVERY_RESUME', sessionId: session?.id });
          navigation.replace('EstateDiscovery');
        }}
      >
        <Text style={styles.primaryText}>Kontynuuj trop</Text>
      </ApplePressable>
      <ApplePressable style={styles.secondary} onPress={() => navigation.navigate('DiscoveryLifeShift')}>
        <Text style={styles.secondaryText}>Sprawdź, co się przesunęło</Text>
      </ApplePressable>
      <ApplePressable style={styles.later} haptic="none" onPress={() => navigation.goBack()}>
        <Text style={styles.laterText}>Wróć później</Text>
      </ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040405', alignItems: 'center', justifyContent: 'center', padding: 30 },
  kicker: { color: DISCOVERY_COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#FFF', fontSize: 29, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  primary: { width: '100%', height: 52, borderRadius: 26, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  primaryText: { color: '#080808', fontWeight: '900', fontSize: 15 },
  secondary: { padding: 16 },
  secondaryText: { color: DISCOVERY_COLORS.ivory, fontWeight: '800', fontSize: 14 },
  later: { padding: 10 },
  laterText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '700' },
});
