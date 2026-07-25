import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { visible: boolean; onConfirm: () => void; onSaveContinue: () => void; onCancel: () => void };

export default function DiscoveryPrioritySheet({ visible, onConfirm, onSaveContinue, onCancel }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onCancel}>
      <View style={styles.icon}><Ionicons name="flash" size={23} color={DISCOVERY_COLORS.gold} /></View>
      <Text style={styles.title}>Ważny trop</Text>
      <Text style={styles.text}>Nadaj mu priorytet. Możesz potem spokojnie pogłębić go w swoim tempie.</Text>
      <ApplePressable onPress={onConfirm} haptic="medium" style={styles.primary}><Text style={styles.primaryText}>Potwierdź pilność</Text></ApplePressable>
      <ApplePressable onPress={onSaveContinue} haptic="light" style={styles.secondary}><Text style={styles.secondaryText}>Zapisz i kontynuuj</Text></ApplePressable>
      <ApplePressable onPress={onCancel} haptic="none" style={styles.cancel}><Text style={styles.cancelText}>Anuluj</Text></ApplePressable>
    </DiscoveryGlassSheet>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.14)', marginBottom: 14 },
  title: { color: '#FFF', fontSize: 21, fontWeight: '800' },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  primary: { height: 50, borderRadius: 25, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: '#080808', fontSize: 15, fontWeight: '900' },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingBottom: 2 },
  cancelText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '600' },
});
