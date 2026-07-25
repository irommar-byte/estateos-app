import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import { DISCOVERY_COLORS } from './discoveryMotion';

export type DislikeReason = { key: 'PRICE_TOO_HIGH' | 'LOCATION_MISMATCH' | 'LAYOUT_MISMATCH' | 'QUALITY_LOW'; label: string };
type Props = { visible: boolean; reasons: readonly DislikeReason[]; onChoose: (reason: DislikeReason) => void; onSkip: () => void };

export default function DiscoveryDislikeReasonSheet({ visible, reasons, onChoose, onSkip }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onSkip}>
      <Text style={styles.title}>Co nie zagrało?</Text>
      <Text style={styles.text}>Opcjonalnie — pomoże nam spokojniej prowadzić kolejny trop.</Text>
      <View style={styles.chips}>
        {reasons.map((reason) => (
          <ApplePressable key={reason.key} onPress={() => onChoose(reason)} haptic="light" style={styles.chip}>
            <Text style={styles.chipText}>{reason.label}</Text>
          </ApplePressable>
        ))}
      </View>
      <ApplePressable onPress={onSkip} haptic="none" style={styles.skip}><Text style={styles.skipText}>Pomiń</Text></ApplePressable>
    </DiscoveryGlassSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 },
  chip: { borderWidth: 1, borderColor: DISCOVERY_COLORS.glassBorder, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipText: { color: DISCOVERY_COLORS.ivory, fontSize: 13, fontWeight: '700' },
  skip: { alignItems: 'center', marginTop: 18, padding: 8 },
  skipText: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, fontWeight: '700' },
});
