import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import IntelligenceBrainMark from './IntelligenceBrainMark';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { INTELLIGENCE_BRAND_LABEL } from '../../lib/discovery/intelligenceBrand';

type Props = { visible: boolean; reason: string; onClose: () => void; onReject: () => void };

export default function DiscoveryInsightBubble({ visible, reason, onClose, onReject }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onClose}>
      <View style={styles.mark}>
        <IntelligenceBrainMark size={40} softGlyph />
      </View>
      <Text style={styles.eyebrow}>{INTELLIGENCE_BRAND_LABEL}</Text>
      <Text style={styles.title}>Dlaczego właśnie to?</Text>
      <Text style={styles.reason}>{reason}</Text>
      <Text style={styles.note}>Hipoteza z Twoich wyborów — nie wyrok. Jedna decyzja wystarczy.</Text>
      <ApplePressable onPress={onReject} haptic="light" style={styles.reject}>
        <Text style={styles.rejectText}>To nie ja</Text>
      </ApplePressable>
      <ApplePressable onPress={onClose} haptic="none" style={styles.close}>
        <Text style={styles.closeText}>Rozumiem</Text>
      </ApplePressable>
    </DiscoveryGlassSheet>
  );
}

const styles = StyleSheet.create({
  mark: {
    marginBottom: 12,
    alignItems: 'center',
  },
  eyebrow: {
    color: 'rgba(245,245,247,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  reason: {
    color: DISCOVERY_COLORS.ivory,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: 10,
    textAlign: 'center',
  },
  note: {
    color: DISCOVERY_COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  reject: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DISCOVERY_COLORS.glassBorder,
  },
  rejectText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '700' },
  close: { alignItems: 'center', paddingTop: 13 },
  closeText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '600' },
});
