import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';

export default function DiscoveryBridgeScreen({ navigation }: any) {
  const [shareTaste, setShareTaste] = useState(true);
  const [shareTropes, setShareTropes] = useState(false);
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>DISCOVERY™</Text>
      <Text style={styles.title}>Rozmowa z kontekstem</Text>
      <Text style={styles.text}>Ty decydujesz, co ma być widoczne. Profil gustu jest mapą opieki, nie oceną.</Text>
      <ApplePressable onPress={() => setShareTaste((value) => !value)} style={[styles.option, shareTaste && styles.optionOn]}><Text style={styles.optionText}>Reakcje i kierunki gustu</Text></ApplePressable>
      <ApplePressable onPress={() => setShareTropes((value) => !value)} style={[styles.option, shareTropes && styles.optionOn]}><Text style={styles.optionText}>Zapisane tropy</Text></ApplePressable>
      <ApplePressable style={styles.primary} onPress={() => navigation.navigate('MainTabs', { screen: 'Wiadomości', params: { discoveryBridge: { shareTaste, shareTropes } } })}>
        <Text style={styles.primaryText}>Przejdź do rozmów</Text>
      </ApplePressable>
      <ApplePressable haptic="none" style={styles.cancel} onPress={() => navigation.goBack()}><Text style={styles.cancelText}>Anuluj</Text></ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040405', padding: 28, justifyContent: 'center' },
  kicker: { color: DISCOVERY_COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  option: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 18, padding: 15, marginTop: 14 },
  optionOn: { borderColor: DISCOVERY_COLORS.gold, backgroundColor: 'rgba(212,175,55,0.14)' },
  optionText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '800' },
  primary: { height: 52, borderRadius: 26, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  primaryText: { color: '#080808', fontSize: 14, fontWeight: '900' },
  cancel: { alignItems: 'center', padding: 15 },
  cancelText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '700' },
});
