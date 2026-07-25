import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { visible: boolean; onPause: () => void; onResume: () => void };

export default function DiscoveryPauseSheet({ visible, onPause, onResume }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onResume}>
      <Text style={styles.title}>Na dziś wystarczy.</Text>
      <Text style={styles.text}>Twój trop i decyzje zostają z Tobą. Możesz wrócić bez zaczynania od zera.</Text>
      <ApplePressable onPress={onPause} haptic="none" style={styles.primary}><Text style={styles.primaryText}>Zakończ sesję</Text></ApplePressable>
      <ApplePressable onPress={onResume} haptic="none" style={styles.resume}><Text style={styles.resumeText}>Wznów</Text></ApplePressable>
    </DiscoveryGlassSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: '#FFF', fontSize: 21, fontWeight: '800' },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  primary: { height: 50, borderRadius: 25, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: '#080808', fontSize: 15, fontWeight: '900' },
  resume: { alignItems: 'center', padding: 15 },
  resumeText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '800' },
});
