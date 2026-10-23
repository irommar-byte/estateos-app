import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import SafeModal from '../SafeModal';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useIsDarkTheme } from '../../store/useThemeStore';
import { decideOutbox, fetchOutboxItem, type OutboxItem } from '../../services/outboxService';
import { emitOutboxChanged, onOutboxOpen, onOutboxQueued } from '../../lib/outboxEvents';

/**
 * Podgląd każdej wiadomości do klienta przed wysłaniem.
 * Pojawia się sam, gdy serwer odłoży wiadomość do akceptacji, i z ekranu „Dziś”.
 */

const CHANNEL_LABEL: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  email: { label: 'E-mail', icon: 'mail' },
  sms: { label: 'SMS', icon: 'chatbox' },
  chat: { label: 'Panel klienta', icon: 'chatbubbles' },
  push: { label: 'Powiadomienie', icon: 'notifications' },
};

// Opóźnienie, żeby zdążył się zamknąć arkusz, z którego wyszła akcja (iOS pokazuje jeden modal naraz).
const PRESENT_DELAY_MS = 550;

function wrapEmailHtml(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>
    html,body{margin:0;padding:0;background:#f4f4f5;-webkit-text-size-adjust:100%}
    img{max-width:100%!important;height:auto!important}
    table{max-width:100%!important}
    a{pointer-events:none}
  </style></head><body>${html}</body></html>`;
}

export default function OutboxReviewHost() {
  const token = useAuthStore((s) => s.token);
  const isDark = useIsDarkTheme();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<number[]>([]);
  const [visible, setVisible] = useState(false);
  const [item, setItem] = useState<OutboxItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'cancel' | null>(null);
  const [autoFromNow, setAutoFromNow] = useState(false);
  const presentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = useMemo(
    () => ({
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      raised: isDark ? '#2C2C2E' : '#F2F2F7',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#98989F' : '#6C6C70',
      hairline: isDark ? 'rgba(84,84,88,0.5)' : 'rgba(60,60,67,0.14)',
      green: '#34C759',
      red: '#FF453A',
      blue: isDark ? '#0A84FF' : '#007AFF',
    }),
    [isDark],
  );

  const enqueue = useCallback((ids: number[]) => {
    setQueue((current) => [...current, ...ids.filter((id) => !current.includes(id))]);
    if (presentTimer.current) clearTimeout(presentTimer.current);
    presentTimer.current = setTimeout(() => setVisible(true), PRESENT_DELAY_MS);
  }, []);

  useEffect(() => {
    const queued = onOutboxQueued((items) => enqueue(items.map((row) => row.id)));
    const opened = onOutboxOpen((id) => enqueue([id]));
    return () => {
      queued.remove();
      opened.remove();
      if (presentTimer.current) clearTimeout(presentTimer.current);
    };
  }, [enqueue]);

  const currentId = queue[0] ?? null;

  useEffect(() => {
    if (!visible || currentId == null || !token) return;
    let alive = true;
    setLoading(true);
    setItem(null);
    setAutoFromNow(false);
    void fetchOutboxItem(token, currentId).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.ok) setItem(res.item);
      else {
        // Już rozpatrzona albo zniknęła — przejdź do następnej.
        setQueue((current) => current.slice(1));
      }
    });
    return () => {
      alive = false;
    };
  }, [visible, currentId, token]);

  useEffect(() => {
    if (visible && queue.length === 0) setVisible(false);
  }, [visible, queue.length]);

  const next = () => setQueue((current) => current.slice(1));

  const decide = async (action: 'approve' | 'cancel') => {
    if (!token || !item) return;
    setBusy(action);
    const res = await decideOutbox(token, item.id, action, { autoFromNow: action === 'approve' && autoFromNow });
    setBusy(null);
    if (!res.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Wiadomość', res.message);
      return;
    }
    void Haptics.notificationAsync(
      action === 'approve' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    emitOutboxChanged(item.id, action === 'approve' ? 'sent' : 'cancelled');
    next();
  };

  const close = () => {
    // Zamknięcie bez decyzji: wiadomości zostają w „Dziś → Do wysłania”.
    setVisible(false);
    setQueue([]);
  };

  return (
    <SafeModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.secondary }]}>
              DO WYSŁANIA{queue.length > 1 ? ` · 1 Z ${queue.length}` : ''}
            </Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {item?.subject || 'Wiadomość do klienta'}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Zamknij" style={[styles.closeBtn, { backgroundColor: colors.raised }]}>
            <Ionicons name="close" size={18} color={colors.secondary} />
          </Pressable>
        </View>

        {loading || !item ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.secondary} />
          </View>
        ) : (
          <>
            <View style={[styles.meta, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.secondary }]}>Do</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                  {item.clientName}
                  {item.recipient ? <Text style={{ color: colors.secondary }}>{`  ·  ${item.recipient}`}</Text> : null}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.secondary }]}>Rodzaj</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                  {item.categoryLabel}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
              <View style={[styles.metaRow, { alignItems: 'flex-start' }]}>
                <Text style={[styles.metaLabel, { color: colors.secondary, marginTop: 4 }]}>Kanały</Text>
                <View style={styles.chips}>
                  {item.channels.map((channel) => {
                    const meta = CHANNEL_LABEL[channel] || { label: channel, icon: 'ellipse' as const };
                    return (
                      <View key={channel} style={[styles.chip, { backgroundColor: colors.raised }]}>
                        <Ionicons name={meta.icon} size={12} color={colors.blue} />
                        <Text style={[styles.chipText, { color: colors.text }]}>{meta.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.preview, { borderColor: colors.hairline, backgroundColor: item.previewHtml ? '#F4F4F5' : colors.card }]}>
              {item.previewHtml ? (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: wrapEmailHtml(item.previewHtml) }}
                  style={{ flex: 1, backgroundColor: '#F4F4F5' }}
                  showsVerticalScrollIndicator={false}
                  setSupportMultipleWindows={false}
                />
              ) : (
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                  <Text style={[styles.previewText, { color: colors.text }]}>{item.previewText || '—'}</Text>
                </ScrollView>
              )}
            </View>

            <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom), borderTopColor: colors.hairline, backgroundColor: colors.bg }]}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setAutoFromNow((value) => !value);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: autoFromNow }}
                style={styles.autoRow}
              >
                <View
                  style={[
                    styles.check,
                    { borderColor: autoFromNow ? colors.green : colors.hairline, backgroundColor: autoFromNow ? colors.green : 'transparent' },
                  ]}
                >
                  {autoFromNow ? <Ionicons name="checkmark" size={14} color="#052E16" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.autoTitle, { color: colors.text }]}>Od teraz wysyłaj takie automatycznie</Text>
                  <Text style={[styles.autoHint, { color: colors.secondary }]}>
                    Tylko do tego klienta i tylko „{item.categoryLabel.toLowerCase()}”. Wyłączysz na karcie klienta.
                  </Text>
                </View>
              </Pressable>
              <View style={styles.buttons}>
                <Pressable
                  onPress={() => void decide('cancel')}
                  disabled={busy != null}
                  style={({ pressed }) => [styles.btn, { backgroundColor: colors.raised, opacity: pressed ? 0.8 : 1 }]}
                >
                  {busy === 'cancel' ? (
                    <ActivityIndicator color={colors.red} />
                  ) : (
                    <Text style={[styles.btnText, { color: colors.red }]}>Nie wysyłaj</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void decide('approve')}
                  disabled={busy != null}
                  style={({ pressed }) => [styles.btn, styles.btnPrimary, { backgroundColor: colors.green, opacity: pressed ? 0.85 : 1 }]}
                >
                  {busy === 'approve' ? (
                    <ActivityIndicator color="#052E16" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#052E16" />
                      <Text style={[styles.btnText, { color: '#052E16' }]}>Wyślij</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Text style={[styles.footnote, { color: colors.secondary }]}>
                Zamknięcie zostawia wiadomość w „Dziś → Do wysłania”.
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 4, lineHeight: 25 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  metaLabel: { width: 62, fontSize: 13, fontWeight: '600' },
  metaValue: { flex: 1, fontSize: 15, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  preview: { flex: 1, marginHorizontal: 16, marginTop: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  previewText: { fontSize: 15, lineHeight: 22 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, gap: 12 },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  autoTitle: { fontSize: 14, fontWeight: '700' },
  autoHint: { fontSize: 12, marginTop: 1 },
  buttons: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1.6, flexDirection: 'row', gap: 8 },
  btnText: { fontSize: 16, fontWeight: '800' },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: -4 },
});
