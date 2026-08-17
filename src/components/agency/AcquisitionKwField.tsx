import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  applyLandRegistryPrefix,
  getCourtByLandRegistryPrefix,
  getLandRegistryPrefixSuggestions,
  isValidLandRegistryNumber,
  normalizeLandRegistryNumber,
} from '../../utils/landRegistry';
import EkwBookViewerModal from '../admin/EkwBookViewerModal';

export default function AcquisitionKwField({
  value,
  onChange,
  isDark,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  isDark?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [ekwOpen, setEkwOpen] = useState(false);

  const colors = {
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    card: isDark ? '#111214' : '#F8FAFC',
    accent: '#34C759',
  };

  const raw = String(value || '').trim();
  const valid = Boolean(raw) && isValidLandRegistryNumber(raw);
  const incomplete = Boolean(raw) && !valid;
  const court = getCourtByLandRegistryPrefix(raw);
  const suggestions = useMemo(() => {
    if (valid) return [];
    if (!focused && !raw) return [];
    return getLandRegistryPrefixSuggestions(raw, 12);
  }, [focused, raw, valid]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.secondary }]}>NUMER KSIĘGI WIECZYSTEJ (KW)</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TextInput
          editable={!disabled}
          value={value}
          placeholder="WA4N/00012345/6"
          placeholderTextColor={colors.secondary}
          autoCapitalize="characters"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={(text) => onChange(normalizeLandRegistryNumber(text))}
          style={[
            styles.input,
            {
              flex: 1,
              backgroundColor: colors.input,
              color: colors.text,
              borderColor: incomplete ? '#FF3B30' : colors.border,
              letterSpacing: 0.8,
            },
          ]}
        />
        <Pressable
          onPress={() => {
            if (raw) setEkwOpen(true);
            else Linking.openURL('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW');
          }}
          style={[styles.iconBtn, { backgroundColor: '#007AFF' }]}
        >
          <Ionicons name="open-outline" size={18} color="#fff" />
        </Pressable>
      </View>

      {suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {suggestions.map((item) => (
            <Pressable
              key={item.prefix}
              onPress={() => onChange(applyLandRegistryPrefix(value, item.prefix))}
              style={styles.suggestionRow}
            >
              <Text style={[styles.prefix, { color: colors.text }]}>{item.prefix}</Text>
              <Text style={[styles.court, { color: colors.secondary }]} numberOfLines={2}>
                {item.courtName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {court ? (
        <Text style={[styles.hint, { color: colors.secondary }]}>Właściwy sąd: {court.courtName}</Text>
      ) : null}
      {raw ? (
        <Text style={[styles.hint, { color: valid ? colors.accent : '#FF3B30' }]}>
          {valid ? 'Format KW poprawny' : 'Wzór: WA4N/00012345/6'}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.secondary }]}>
          Wpisz kod sądu (np. WA4N) — podpowiemy wydział KW z bazy EstateOS.
        </Text>
      )}

      <EkwBookViewerModal
        visible={ekwOpen}
        landRegistryNumber={raw || null}
        onClose={() => setEkwOpen(false)}
        theme={{
          background: isDark ? '#000' : '#fff',
          text: colors.text,
          subtitle: colors.secondary,
          glass: isDark ? 'dark' : 'light',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  suggestions: { marginTop: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,120,128,0.2)' },
  prefix: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  court: { fontSize: 11, marginTop: 2 },
  hint: { fontSize: 11, fontWeight: '700', marginTop: 6 },
});
