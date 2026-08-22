import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type IntelligenceSettings = {
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  minLearns: number;
  minScore: number;
  lastSentAt: string | null;
};

export const DEFAULT_INTELLIGENCE_SETTINGS: IntelligenceSettings = {
  enabled: false,
  intervalHours: 24,
  dailyLimit: 1,
  minLearns: 3,
  minScore: 92,
  lastSentAt: null,
};

export default function IntelligenceAssistantCard({
  value,
  colors,
  busy,
  onSave,
}: {
  value?: IntelligenceSettings | null;
  colors: { text: string; secondary: string; accent: string; border: string; card: string; input: string };
  busy?: boolean;
  onSave: (next: IntelligenceSettings) => void;
}) {
  const [draft, setDraft] = useState<IntelligenceSettings>(value || DEFAULT_INTELLIGENCE_SETTINGS);
  useEffect(() => {
    setDraft(value || DEFAULT_INTELLIGENCE_SETTINGS);
  }, [value]);

  const field = (label: string, key: 'intervalHours' | 'dailyLimit' | 'minLearns' | 'minScore', min: number, max: number) => (
    <View style={{ flex: 1, minWidth: '46%' }}>
      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(draft[key] ?? '')}
        onChangeText={(raw) => {
          const n = Number(raw.replace(/\D/g, ''));
          setDraft((current) => ({ ...current, [key]: Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min }));
        }}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
      />
    </View>
  );

  return (
    <LinearGradient
      colors={['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.frame}
    >
      <View style={[styles.inner, { backgroundColor: colors.card }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Tęczowy asystent · EstateOS™ Intelligence</Text>
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
              Uczy się z reakcji klienta (oglądać / przemyśleć / odłóż + obiekcje) i po kilku próbach sam wysyła
              jedną pewną propozycję w Twoim imieniu.
            </Text>
          </View>
          <Switch
            value={draft.enabled}
            onValueChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {field('Interwał (godziny)', 'intervalHours', 6, 168)}
          {field('Ofert na cykl', 'dailyLimit', 1, 3)}
          {field('Ile reakcji zanim wyśle', 'minLearns', 1, 12)}
          {field('Minimalna pewność (%)', 'minScore', 70, 100)}
        </View>
        {draft.lastSentAt ? (
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 8 }}>
            Ostatni domysł: {new Date(draft.lastSentAt).toLocaleString('pl-PL')}
          </Text>
        ) : null}
        <Pressable
          disabled={busy}
          onPress={() => onSave(draft)}
          style={[styles.save, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}
        >
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
            {busy ? 'Zapisuję…' : 'Zapisz asystenta'}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 16,
  },
  inner: {
    borderRadius: 16,
    padding: 14,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#7B4DFF',
  },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  save: {
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});
