import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';
import { useAuthStore } from '../store/useAuthStore';
import { trackDiscoveryEvent } from '../services/discoveryService';

export default function DiscoveryJourneyHonorScreen({ navigation, route }: any) {
  const offerId = Number(route?.params?.offerId || 0);
  const token = useAuthStore((state) => state.token);
  const [confirmed, setConfirmed] = useState(false);
  const honor = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (offerId > 0) void trackDiscoveryEvent({ token, eventType: 'DISCOVERY_PHASE_END', offerId });
    setConfirmed(true);
  };
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>DISCOVERY™</Text>
      <Text style={styles.title}>{confirmed ? 'Poszukiwanie domknięte.' : 'Czy to jest Twoje miejsce?'}</Text>
      <Text style={styles.text}>
        {confirmed
          ? 'Doszedłeś tu własnymi wyborami. Discovery nie będzie nęcić kolejnymi ofertami.'
          : 'Nie musisz decydować pod presją. Jeśli to ten trop, możesz uhonorować zakończenie tej fazy.'}
      </Text>
      {confirmed ? (
        <ApplePressable style={styles.primary} onPress={() => navigation.navigate('MainTabs')}><Text style={styles.primaryText}>Wróć do EstateOS</Text></ApplePressable>
      ) : (
        <>
          <ApplePressable style={styles.primary} onPress={honor}><Text style={styles.primaryText}>To jest to</Text></ApplePressable>
          <ApplePressable style={styles.secondary} haptic="none" onPress={() => navigation.goBack()}><Text style={styles.secondaryText}>Jeszcze nie</Text></ApplePressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040405', alignItems: 'center', justifyContent: 'center', padding: 30 },
  kicker: { color: DISCOVERY_COLORS.gold, fontWeight: '900', fontSize: 11, letterSpacing: 3 },
  title: { color: '#FFF', fontWeight: '800', fontSize: 30, textAlign: 'center', marginTop: 15 },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  primary: { width: '100%', height: 53, borderRadius: 27, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  primaryText: { color: '#080808', fontWeight: '900', fontSize: 15 },
  secondary: { padding: 16 },
  secondaryText: { color: DISCOVERY_COLORS.ivory, fontWeight: '800', fontSize: 14 },
});
