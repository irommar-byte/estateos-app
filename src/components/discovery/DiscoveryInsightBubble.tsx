import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { visible: boolean; reason: string; onClose: () => void; onReject: () => void };

export default function DiscoveryInsightBubble({ visible, reason, onClose, onReject }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onClose}>
      <View style={styles.icon}>
        <Ionicons name="sparkles" size={20} color={DISCOVERY_COLORS.gold} />
      </View>
      <Text style={styles.eyebrow}>Intelligence</Text>
      <Text style={styles.title}>Dlaczego właśnie to?</Text>
      <Text style={styles.reason}>{reason}</Text>
      <Text style={styles.note}>Hipoteza z Twoich wyborów w Discovery — nie wyrok.</Text>
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
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.14)',
    marginBottom: 12,
  },
  eyebrow: {
    color: DISCOVERY_COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  reason: {
    color: DISCOVERY_COLORS.ivory,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: 10,
  },
  note: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, lineHeight: 18, marginTop: 10 },
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
