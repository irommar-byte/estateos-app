import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { onWiden: () => void; onChangeDirection: () => void; onTropes: () => void; onPause: () => void };

export default function DiscoveryEndDeck({ onWiden, onChangeDirection, onTropes, onPause }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}><Ionicons name="compass" size={29} color={DISCOVERY_COLORS.gold} /></View>
      <Text style={styles.title}>Na dziś ten kierunek jest przejrzany.</Text>
      <Text style={styles.text}>To jest postęp. Możesz poszerzyć trop, zmienić go albo spokojnie wrócić później.</Text>
      <ApplePressable onPress={onWiden} haptic="light" style={styles.primary}><Text style={styles.primaryText}>Poszerz kierunek</Text></ApplePressable>
      <ApplePressable onPress={onChangeDirection} haptic="none" style={styles.secondary}><Text style={styles.secondaryText}>Zmień kierunek</Text></ApplePressable>
      <ApplePressable onPress={onTropes} haptic="none" style={styles.secondary}><Text style={styles.secondaryText}>Zapisane tropy</Text></ApplePressable>
      <ApplePressable onPress={onPause} haptic="none" style={styles.pause}><Text style={styles.pauseText}>Zakończ na dziś</Text></ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingHorizontal: 32 },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.12)', marginBottom: 18 },
  title: { color: DISCOVERY_COLORS.ivory, fontSize: 23, fontWeight: '800', lineHeight: 29, textAlign: 'center' },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  primary: { width: '100%', height: 50, borderRadius: 25, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  primaryText: { color: '#080808', fontSize: 14, fontWeight: '900' },
  secondary: { padding: 13 },
  secondaryText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '800' },
  pause: { padding: 6 },
  pauseText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '700' },
});
