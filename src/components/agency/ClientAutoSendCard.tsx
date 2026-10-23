import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { patchAgencyClient } from '../../services/agencyClientService';

/** Rodzaje wiadomości — te same klucze co na serwerze (clientOutbox). */
export const AUTO_SEND_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'offer', label: 'Propozycje ofert od asystenta' },
  { key: 'assistant', label: 'Wiadomości asystenta w czacie' },
  { key: 'reminder', label: 'Przypomnienia o ocenie ofert' },
  { key: 'schedule', label: 'Terminy spotkań i pokazów' },
  { key: 'visit', label: 'Materiały do pokazu i potwierdzenia' },
  { key: 'marketing', label: 'Raporty z promocji oferty' },
  { key: 'documents', label: 'Dokumenty i umowy' },
  { key: 'card', label: 'Wizytówka i powitanie' },
  { key: 'decision', label: 'Prośby o decyzję' },
];

type Colors = { card: string; text: string; secondary: string; border: string; accent: string };

/**
 * Co może wychodzić do klienta bez akceptacji agenta.
 * Domyślnie nic — każda wiadomość czeka w „Dziś → Do wysłania”.
 */
export default function ClientAutoSendCard({
  token,
  clientId,
  value,
  colors,
  onChanged,
}: {
  token: string | null;
  clientId: number;
  value: string[] | undefined;
  colors: Colors;
  onChanged?: () => void;
}) {
  const [enabled, setEnabled] = useState<string[]>(value || []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(value || []);
  }, [value]);

  const toggle = async (key: string, next: boolean) => {
    if (!token) return;
    const previous = enabled;
    const updated = next ? [...new Set([...enabled, key])] : enabled.filter((item) => item !== key);
    setEnabled(updated);
    setSaving(key);
    void Haptics.selectionAsync();
    const res = await patchAgencyClient(token, clientId, {
      autoSendCategories: updated,
      ...(key === 'offer' ? { intelligence: { mode: next ? 'AUTOPILOT' : 'APPROVAL' } } : {}),
    });
    setSaving(null);
    if (!res.ok) {
      setEnabled(previous);
      Alert.alert('Wysyłka', res.message);
      return;
    }
    onChanged?.();
  };

  const autoCount = enabled.length;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((current) => !current);
        }}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={[styles.icon, { backgroundColor: autoCount ? 'rgba(255,159,10,0.16)' : 'rgba(52,199,89,0.16)' }]}>
          <Ionicons name={autoCount ? 'flash' : 'shield-checkmark'} size={17} color={autoCount ? '#FF9F0A' : colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Wiadomości do klienta</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            {autoCount === 0
              ? 'Każda czeka na Twoją akceptację'
              : `${autoCount} ${autoCount === 1 ? 'rodzaj wychodzi' : 'rodzaje wychodzą'} automatycznie`}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.secondary} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: 6 }}>
          {AUTO_SEND_CATEGORIES.map((category, index) => {
            const on = enabled.includes(category.key);
            return (
              <View
                key={category.key}
                style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>{category.label}</Text>
                {saving === category.key ? (
                  <ActivityIndicator size="small" color={colors.secondary} />
                ) : (
                  <Switch value={on} onValueChange={(next) => void toggle(category.key, next)} />
                )}
              </View>
            );
          })}
          <Text style={[styles.footnote, { color: colors.secondary }]}>
            Włączone rodzaje wychodzą bez podglądu. Wyłączone czekają w „Dziś → Do wysłania”.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rowLabel: { flex: 1, fontSize: 15 },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});
