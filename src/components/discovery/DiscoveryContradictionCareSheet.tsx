import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { visible: boolean; onSlow: () => void; onShift: () => void; onPause: () => void };

export default function DiscoveryContradictionCareSheet({ visible, onSlow, onShift, onPause }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onSlow}>
      <Text style={styles.title}>Nie wszystko musi być jasne od razu.</Text>
      <Text style={styles.text}>Widzimy napięcie między różnymi kierunkami. To częste — możesz iść wolniej, zmienić trop albo zrobić przerwę.</Text>
      <ApplePressable onPress={onSlow} style={styles.primary}><Text style={styles.primaryText}>Kontynuuj wolniej</Text></ApplePressable>
      <ApplePressable onPress={onShift} style={styles.secondary}><Text style={styles.secondaryText}>Sprawdź, co się przesunęło</Text></ApplePressable>
      <ApplePressable onPress={onPause} haptic="none" style={styles.pause}><Text style={styles.pauseText}>Pauza</Text></ApplePressable>
    </DiscoveryGlassSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: '#FFF', fontSize: 20, fontWeight: '800', lineHeight: 27 },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  primary: { height: 50, borderRadius: 25, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: '#080808', fontWeight: '900', fontSize: 14 },
  secondary: { padding: 14, alignItems: 'center' },
  secondaryText: { color: DISCOVERY_COLORS.ivory, fontWeight: '800', fontSize: 14 },
  pause: { paddingBottom: 3, alignItems: 'center' },
  pauseText: { color: DISCOVERY_COLORS.textMuted, fontWeight: '700', fontSize: 13 },
});
