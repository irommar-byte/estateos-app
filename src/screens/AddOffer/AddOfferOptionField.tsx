import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

export type AddOfferOption = {
  value: string;
  label: string;
};

type Props = {
  title: string;
  value: string;
  options: AddOfferOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  theme: { text: string; subtitle: string; glass?: string };
  cardBg: string;
  cardBorder: string;
};

export default function AddOfferOptionField({
  title,
  value,
  options,
  onChange,
  disabled = false,
  theme,
  cardBg,
  cardBorder,
}: Props) {
  const [open, setOpen] = useState(false);
  const isDark = theme.glass === 'dark';

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label || options[0]?.label || '—';
  }, [options, value]);

  const openSheet = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
  };

  const pick = (next: string) => {
    Haptics.selectionAsync();
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={openSheet}
        disabled={disabled}
        style={[
          styles.row,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            opacity: disabled ? 0.38 : 1,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.subtitle }]}>{title}</Text>
        <View style={styles.valueWrap}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.subtitle} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={[styles.sheetHeader, { borderBottomColor: cardBorder }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
            <Pressable hitSlop={12} onPress={() => setOpen(false)}>
              <Ionicons name="close" size={22} color={theme.subtitle} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value || '__empty__'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => pick(item.value)}
                  style={[
                    styles.optionRow,
                    active && { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)' },
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{item.label}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color="#10b981" /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  value: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '52%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
