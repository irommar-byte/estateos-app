import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import {
  useLatestUnreadQuickReply,
  type QuickReplyTarget,
} from '../../hooks/useLatestUnreadQuickReply';

type BubbleProps = {
  isDark: boolean;
  accent?: string;
  enabled?: boolean;
};

/**
 * Chmurka na hero Taśm Market — tylko gdy jest nieprzeczytana wiadomość.
 * Tap → szybka odpowiedź bez wchodzenia w zakładkę Wiadomości.
 */
export default function MarketUnreadQuickReplyBubble({
  isDark,
  accent = '#6366F1',
  enabled = true,
}: BubbleProps) {
  const { target, unreadCount, hasUnread, loading, sendReply } = useLatestUnreadQuickReply(enabled);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasUnread) setOpen(false);
  }, [hasUnread]);

  if (!hasUnread || !target) return null;

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || loading) return;
    const result = await sendReply(text);
    if (result.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft('');
      setError(null);
      setOpen(false);
      return;
    }
    setError(result.error || 'Nie udało się wysłać');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  return (
    <>
      <ApplePressable
        accessibilityRole="button"
        accessibilityLabel={`Nowa wiadomość od ${target.title}`}
        haptic="selection"
        pressScale={0.92}
        onPress={() => {
          setDraft('');
          setError(null);
          setOpen(true);
        }}
        style={[
          styles.bubble,
          {
            backgroundColor: isDark ? 'rgba(255,59,48,0.22)' : 'rgba(255,59,48,0.12)',
            borderColor: isDark ? 'rgba(255,59,48,0.45)' : 'rgba(255,59,48,0.35)',
          },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color="#FF3B30" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </ApplePressable>

      <QuickReplyModal
        visible={open}
        isDark={isDark}
        accent={accent}
        target={target}
        draft={draft}
        error={error}
        loading={loading}
        onChangeDraft={setDraft}
        onClose={() => setOpen(false)}
        onSend={() => void onSend()}
      />
    </>
  );
}

function QuickReplyModal({
  visible,
  isDark,
  accent,
  target,
  draft,
  error,
  loading,
  onChangeDraft,
  onClose,
  onSend,
}: {
  visible: boolean;
  isDark: boolean;
  accent: string;
  target: QuickReplyTarget;
  draft: string;
  error: string | null;
  loading: boolean;
  onChangeDraft: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
          <View style={styles.cardHead}>
            <View style={[styles.peerIcon, { backgroundColor: `${accent}22` }]}>
              <Ionicons
                name={target.kind === 'deal' ? 'briefcase' : 'person'}
                size={16}
                color={accent}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.cardTitle, { color: isDark ? '#FFF' : '#0F172A' }]} numberOfLines={1}>
                {target.title}
              </Text>
              {target.preview ? (
                <Text style={styles.preview} numberOfLines={2}>
                  {target.preview}
                </Text>
              ) : (
                <Text style={styles.preview}>Szybka odpowiedź</Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Zamknij">
              <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>

          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Napisz odpowiedź…"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            multiline
            autoFocus
            editable={!loading}
            style={[
              styles.input,
              {
                color: isDark ? '#FFF' : '#0F172A',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              },
            ]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn} disabled={loading}>
              <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: '600' }}>Anuluj</Text>
            </Pressable>
            <ApplePressable
              haptic="medium"
              pressScale={0.96}
              disabled={loading || !draft.trim()}
              onPress={onSend}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: draft.trim() ? accent : isDark ? '#333' : '#E5E7EB',
                  opacity: loading ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={15} color="#FFF" />
                  <Text style={styles.sendLabel}>Wyślij</Text>
                </>
              )}
            </ApplePressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    marginHorizontal: 14,
    marginBottom: Platform.OS === 'ios' ? 28 : 18,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  peerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  preview: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
  },
  input: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  error: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    minWidth: 108,
    justifyContent: 'center',
  },
  sendLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
