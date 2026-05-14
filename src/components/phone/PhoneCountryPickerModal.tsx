import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js';
import {
  ALLOWED_PHONE_COUNTRIES,
  countryLabelInOwnLanguage,
  countryLabelSortPl,
  dialCodeFor,
  flagEmojiFromIso2,
} from '../../utils/phoneRegions';

const { height: SCREEN_H } = Dimensions.get('window');

export type PhoneCountryPickerPanelProps = {
  selectedIso: CountryCode;
  onSelect: (iso: CountryCode) => void;
  onClose: () => void;
  isDark?: boolean;
};

/**
 * Sam panel listy (bez Modal) — do nakładki wewnątrz innego Modal (np. EditPhoneSheet),
 * żeby uniknąć zagnieżdżonych Modal na iOS (martwy dotyk po zamknięciu).
 */
export function PhoneCountryPickerPanel({ selectedIso, onSelect, onClose, isDark = false }: PhoneCountryPickerPanelProps) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...ALLOWED_PHONE_COUNTRIES].map((iso) => ({
      iso,
      dial: dialCodeFor(iso),
      label: countryLabelInOwnLanguage(iso),
      sort: countryLabelSortPl(iso),
    }));
    list.sort((a, b) => a.sort.localeCompare(b.sort, 'pl', { sensitivity: 'base' }));
    if (!needle) return list;
    return list.filter((r) => {
      const hay = `${r.label} ${r.iso} +${r.dial}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q]);

  const surface = isDark ? 'rgba(28,28,30,0.98)' : 'rgba(255,255,255,0.99)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.55)' : 'rgba(17,24,39,0.45)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.95)' : '#F2F2F7';

  const listMaxH = Math.min(SCREEN_H * 0.52, 420);

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: surface,
          borderColor: border,
          paddingBottom: Math.max(insets.bottom, 14),
          maxHeight: SCREEN_H * 0.88,
        },
      ]}
    >
      <View style={[styles.dragBar, { backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }]} />
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: textMain }]}>Kraj i numer</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color={String(textMuted)} />
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: textMuted }]}>Wybierz kraj — format numeru dopasuje się automatycznie.</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Szukaj kraju lub +kod…"
        placeholderTextColor={textMuted}
        style={[styles.search, { color: textMain, backgroundColor: inputBg, borderColor: border }]}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.iso}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: listMaxH }}
        nestedScrollEnabled
        renderItem={({ item }) => {
          const sel = item.iso === selectedIso;
          return (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(item.iso);
                setQ('');
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: border,
                  opacity: pressed ? 0.75 : 1,
                  backgroundColor: sel ? (isDark ? 'rgba(10,132,255,0.18)' : 'rgba(10,132,255,0.1)') : 'transparent',
                },
              ]}
            >
              <Text style={styles.flag}>{flagEmojiFromIso2(item.iso)}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: textMain }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[styles.rowSub, { color: textMuted }]} numberOfLines={1}>
                  {item.iso} · +{item.dial}
                </Text>
              </View>
              {sel ? <Ionicons name="checkmark-circle" size={22} color="#34C759" /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

type ModalProps = PhoneCountryPickerPanelProps & {
  visible: boolean;
};

/**
 * Osobny Modal — OK poza innym Modalem (np. AuthScreen).
 * Blur tylko jako tło (`pointerEvents="none"`), żeby nie pożerał dotyku.
 */
export default function PhoneCountryPickerModal({ visible, onClose, selectedIso, onSelect, isDark = false }: ModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <BlurView
          pointerEvents="none"
          intensity={isDark ? 50 : 65}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij wybór kraju"
          style={[styles.dimBackdrop, StyleSheet.absoluteFill]}
          onPress={onClose}
        />
        <View style={styles.sheetDock} pointerEvents="box-none">
          <PhoneCountryPickerPanel selectedIso={selectedIso} onSelect={onSelect} onClose={onClose} isDark={isDark} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dimBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    zIndex: 1,
  },
  sheetDock: {
    zIndex: 2,
    elevation: 24,
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    width: '100%',
  },
  dragBar: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  search: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  flag: { fontSize: 28, lineHeight: 34 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
});
