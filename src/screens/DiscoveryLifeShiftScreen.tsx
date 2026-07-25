import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';

const HINTS = ['Więcej spokoju', 'Bliżej miasta', 'Inny budżet', 'Wynajem', 'Kupno'];

export default function DiscoveryLifeShiftScreen({ navigation }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (hint: string) => setSelected((prev) => prev.includes(hint) ? prev.filter((value) => value !== hint) : [...prev, hint]);
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>DISCOVERY™</Text>
      <Text style={styles.title}>Życie mogło się przesunąć.</Text>
      <Text style={styles.text}>To tylko hipotezy, nie nowy formularz. Najwięcej powiedzą nam Twoje kolejne wybory.</Text>
      <View style={styles.chips}>
        {HINTS.map((hint) => (
          <ApplePressable key={hint} onPress={() => toggle(hint)} style={[styles.chip, selected.includes(hint) && styles.chipActive]}>
            <Text style={[styles.chipText, selected.includes(hint) && styles.chipTextActive]}>{hint}</Text>
          </ApplePressable>
        ))}
      </View>
      <ApplePressable
        style={styles.primary}
        onPress={() => {
          navigation.replace('EstateDiscovery');
        }}
      >
        <Text style={styles.primaryText}>Ucz się z kolejnych wyborów</Text>
      </ApplePressable>
      <ApplePressable style={styles.cancel} haptic="none" onPress={() => navigation.goBack()}><Text style={styles.cancelText}>Anuluj</Text></ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040405', padding: 28, justifyContent: 'center' },
  kicker: { color: DISCOVERY_COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  text: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 24 },
  chip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 13 },
  chipActive: { borderColor: DISCOVERY_COLORS.gold, backgroundColor: 'rgba(212,175,55,0.14)' },
  chipText: { color: DISCOVERY_COLORS.ivory, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: DISCOVERY_COLORS.gold },
  primary: { height: 52, borderRadius: 26, backgroundColor: DISCOVERY_COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  primaryText: { color: '#080808', fontSize: 14, fontWeight: '900' },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: DISCOVERY_COLORS.textMuted, fontWeight: '700', fontSize: 13 },
});
