import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PropertyRoomScan } from '../../types/roomScan';
import { ROOM_PRESET_DEFS, roomTypeKeyFromName } from '../../lib/roomScan/refineScanSections';

type Props = {
  visible: boolean;
  room: PropertyRoomScan | null;
  isDark?: boolean;
  canScan?: boolean;
  onClose: () => void;
  onSave: (room: PropertyRoomScan) => void;
  onRescan?: () => void;
};

function recalcArea(widthM: string, lengthM: string, fallback: string) {
  const w = Number(String(widthM || '').replace(',', '.'));
  const l = Number(String(lengthM || '').replace(',', '.'));
  if (w > 0 && l > 0) return (w * l).toFixed(1);
  return fallback;
}

export default function RoomScanParamsSheet({
  visible,
  room,
  isDark,
  canScan,
  onClose,
  onSave,
  onRescan,
}: Props) {
  const [draft, setDraft] = useState<PropertyRoomScan | null>(room);

  useEffect(() => {
    setDraft(room);
  }, [room]);

  if (!visible || !draft) return null;

  const palette = {
    bg: isDark ? '#111214' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#0f172a',
    secondary: isDark ? '#8E8E93' : '#64748b',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
    input: isDark ? '#2C2C2E' : '#F1F5F9',
    accent: '#0ea5e9',
  };

  const patch = (next: Partial<PropertyRoomScan>, recalculate = false) => {
    setDraft((current) => {
      if (!current) return current;
      const merged = { ...current, ...next };
      if (next.name && !next.typeKey) merged.typeKey = roomTypeKeyFromName(merged.name);
      if (recalculate) merged.areaM2 = recalcArea(merged.widthM, merged.lengthM, merged.areaM2);
      return merged;
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: palette.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Edycja pomieszczenia</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={palette.secondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: palette.secondary }]}>NAZWA</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => patch({ name })}
            style={[styles.input, { color: palette.text, backgroundColor: palette.input, borderColor: palette.border }]}
          />
          <View style={styles.presets}>
            {ROOM_PRESET_DEFS.map((preset) => {
              const selected = (draft.typeKey || roomTypeKeyFromName(draft.name)) === preset.key;
              return (
                <Pressable
                  key={preset.key}
                  onPress={() => patch({ name: preset.label, typeKey: preset.key })}
                  style={[
                    styles.preset,
                    {
                      backgroundColor: selected ? palette.accent : palette.card,
                      borderColor: selected ? palette.accent : palette.border,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? '#fff' : palette.text, fontSize: 11, fontWeight: '800' }}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.grid}>
            {([
              ['widthM', 'SZEROKOŚĆ', 'm', true],
              ['lengthM', 'DŁUGOŚĆ', 'm', true],
              ['heightM', 'WYSOKOŚĆ', 'm', false],
              ['areaM2', 'POWIERZCHNIA', 'm²', false],
            ] as const).map(([key, label, unit, recalc]) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, { color: palette.secondary }]}>{label}</Text>
                <View style={[styles.measure, { backgroundColor: palette.input, borderColor: palette.border }]}>
                  <TextInput
                    value={draft[key]}
                    keyboardType="decimal-pad"
                    onChangeText={(value) => patch({ [key]: value }, recalc)}
                    style={[styles.measureInput, { color: palette.text }]}
                  />
                  <Text style={{ color: palette.secondary, fontWeight: '800', fontSize: 12 }}>{unit}</Text>
                </View>
              </View>
            ))}
          </View>
          {canScan && onRescan ? (
            <Pressable onPress={onRescan} style={[styles.scanBtn, { borderColor: `${palette.accent}66` }]}>
              <Ionicons name="scan" size={18} color={palette.accent} />
              <Text style={{ color: palette.accent, fontWeight: '900' }}>Skanuj ponownie LiDAR</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        <Pressable onPress={() => onSave(draft)} style={styles.saveBtn}>
          <Text style={styles.saveText}>Zapisz i przelicz plan</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '900' },
  body: { paddingHorizontal: 18, paddingBottom: 24 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '800' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  preset: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  field: { width: '47%', flexGrow: 1 },
  measure: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  measureInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 8 },
  scanBtn: {
    marginTop: 18,
    minHeight: 48,
    borderWidth: 1.4,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtn: {
    margin: 16,
    backgroundColor: '#0ea5e9',
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
