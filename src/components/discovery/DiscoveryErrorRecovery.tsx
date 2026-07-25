import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { onRetry: () => void; onExit: () => void };

export default function DiscoveryErrorRecovery({ onRetry, onExit }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}><Ionicons name="cloud-offline-outline" size={28} color={DISCOVERY_COLORS.ivory} /></View>
      <Text style={styles.title}>Nie udało się teraz pobrać miejsc.</Text>
      <Text style={styles.text}>Twoje wcześniejsze wybory są bezpieczne. Spróbuj ponownie, gdy połączenie wróci.</Text>
      <ApplePressable onPress={onRetry} haptic="light" style={styles.primary}><Text style={styles.primaryText}>Spróbuj ponownie</Text></ApplePressable>
      <ApplePressable onPress={onExit} haptic="none" style={styles.exit}><Text style={styles.exitText}>Wróć później</Text></ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingHorizontal: 32 },
  icon: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', marginBottom: 18 },
  title: { color: DISCOVERY_COLORS.ivory, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 28 },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  primary: { width: '100%', height: 50, borderRadius: 25, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  primaryText: { color: '#080808', fontSize: 14, fontWeight: '900' },
  exit: { padding: 15 },
  exitText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '700' },
});
