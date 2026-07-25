import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';
import DiscoveryGlassSheet from './DiscoveryGlassSheet';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = { visible: boolean; onSave: () => void; onContinue: () => void; onUndo: () => void };

export default function DiscoverySaveAffirmationSheet({ visible, onSave, onContinue, onUndo }: Props) {
  return (
    <DiscoveryGlassSheet visible={visible} onDismiss={onContinue}>
      <View style={styles.icon}><Ionicons name="heart" size={22} color={DISCOVERY_COLORS.green} /></View>
      <Text style={styles.title}>To wybrzmiewa mocniej.</Text>
      <Text style={styles.text}>Możesz zapisać ten trop albo po prostu odkrywać dalej.</Text>
      <ApplePressable onPress={onSave} haptic="medium" style={styles.primary}><Text style={styles.primaryText}>Zapisz trop</Text></ApplePressable>
      <ApplePressable onPress={onContinue} haptic="none" style={styles.secondary}><Text style={styles.secondaryText}>Dalej odkrywaj</Text></ApplePressable>
      <ApplePressable onPress={onUndo} haptic="none" style={styles.undo}><Text style={styles.undoText}>Cofnij wybór</Text></ApplePressable>
    </DiscoveryGlassSheet>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(50,215,75,0.12)', marginBottom: 14 },
  title: { color: '#FFF', fontSize: 21, fontWeight: '800' },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  primary: { height: 50, borderRadius: 25, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: '#080808', fontSize: 15, fontWeight: '900' },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '800' },
  undo: { alignItems: 'center', paddingBottom: 2 },
  undoText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '600' },
});
