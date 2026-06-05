import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ChevronRight, GripVertical, MessageCircle, Pencil, Trash2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import type { ContactThreadRow } from '../../services/contactService';
import { deleteContactThread } from '../../services/contactService';
import { useI18n } from '../../i18n';
import {
  sortContactThreads,
  useContactThreadPrefsStore,
} from '../../store/useContactThreadPrefsStore';
import { useFloatingChatsStore } from '../../store/useFloatingChatsStore';
import ContactPeerAvatar from './ContactPeerAvatar';

type Colors = Record<string, string>;

type Props = {
  threads: ContactThreadRow[];
  loading: boolean;
  colors: Colors;
  isDark: boolean;
  token: string | null;
  onOpenThread: (thread: ContactThreadRow) => void;
  onThreadsChanged?: () => void;
};

function syncFloatingFromVisible(visible: ContactThreadRow[], getDisplayName: (id: number, fb: string) => string) {
  const entries = visible.slice(0, 4).map((thread) => ({
    threadId: thread.id,
    peerUserId: thread.peerUserId,
    peerName: getDisplayName(thread.id, thread.peerUserName),
    peerImage: thread.peer?.image ?? null,
    unread: Math.max(0, Number(thread.unread ?? thread.unreadCount ?? 0)),
    lastPreview: thread.lastMessage,
  }));
  useFloatingChatsStore.getState().syncEntries(entries);
}

export default function ContactThreadsList({
  threads,
  loading,
  colors,
  isDark,
  token,
  onOpenThread,
  onThreadsChanged,
}: Props) {
  const { t } = useI18n();
  const hydrate = useContactThreadPrefsStore((s) => s.hydrate);
  const order = useContactThreadPrefsStore((s) => s.order);
  const hidden = useContactThreadPrefsStore((s) => s.hidden);
  const setOrder = useContactThreadPrefsStore((s) => s.setOrder);
  const hideThread = useContactThreadPrefsStore((s) => s.hideThread);
  const setAlias = useContactThreadPrefsStore((s) => s.setAlias);
  const getDisplayName = useContactThreadPrefsStore((s) => s.getDisplayName);

  const [editMode, setEditMode] = useState(false);
  const [localThreads, setLocalThreads] = useState<ContactThreadRow[]>([]);
  const [renameTarget, setRenameTarget] = useState<ContactThreadRow | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const sortedThreads = useMemo(
    () => sortContactThreads(threads, order, hidden),
    [threads, order, hidden],
  );

  useEffect(() => {
    setLocalThreads(sortedThreads);
    syncFloatingFromVisible(sortedThreads, getDisplayName);
  }, [sortedThreads, getDisplayName]);

  const confirmDelete = useCallback(
    (thread: ContactThreadRow) => {
      Alert.alert(t('contact.list.deleteTitle'), t('contact.list.deleteMessage', { name: getDisplayName(thread.id, thread.peerUserName) }), [
        { text: t('contact.list.deleteCancel'), style: 'cancel' },
        {
          text: t('contact.list.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                if (token) await deleteContactThread(token, thread.id);
                await hideThread(thread.id);
                useFloatingChatsStore.getState().removeThread(thread.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onThreadsChanged?.();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : t('contact.list.deleteFailed');
                Alert.alert(t('contact.errors.title'), msg);
              }
            })();
          },
        },
      ]);
    },
    [token, hideThread, getDisplayName, onThreadsChanged, t],
  );

  const renderThreadCard = (
    thread: ContactThreadRow,
    drag?: () => void,
    isActive?: boolean,
  ) => {
    const unread = Math.max(0, Number(thread.unread ?? thread.unreadCount ?? 0));
    const displayName = getDisplayName(thread.id, thread.peerUserName);

    return (
      <BlurView intensity={isDark ? 40 : 75} tint={isDark ? 'dark' : 'light'} style={styles.cardBlur}>
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.9)' },
            isActive && styles.cardDragging,
          ]}
        >
          {editMode ? (
            <Pressable onLongPress={drag} delayLongPress={120} style={styles.dragHandle}>
              <GripVertical size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <ContactPeerAvatar name={displayName} peer={thread.peer} size={46} isDark={isDark} />
          <Pressable
            style={styles.body}
            disabled={!editMode}
            onPress={() => {
              if (!editMode) return;
              setRenameTarget(thread);
              setRenameDraft(displayName);
            }}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.name, { color: colors.textMain }]} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.directPill}>
                <Text style={styles.directPillText}>{t('contact.list.directBadge')}</Text>
              </View>
            </View>
            <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={2}>
              {thread.lastMessage || '—'}
            </Text>
          </Pressable>
          <View style={styles.trailing}>
            {editMode ? (
              <View style={styles.editActions}>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setRenameTarget(thread);
                    setRenameDraft(displayName);
                  }}
                  style={styles.iconBtn}
                >
                  <Pencil size={16} color={colors.textMuted} />
                </Pressable>
                <Pressable hitSlop={8} onPress={() => confirmDelete(thread)} style={styles.iconBtn}>
                  <Trash2 size={16} color="#FF3B30" />
                </Pressable>
              </View>
            ) : unread > 0 ? (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : (
              <ChevronRight size={18} color={colors.textMuted} />
            )}
          </View>
        </View>
      </BlurView>
    );
  };

  const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<ContactThreadRow>) => (
    <ScaleDecorator>
      <View style={styles.rowWrap}>{renderThreadCard(item, drag, isActive)}</View>
    </ScaleDecorator>
  );

  const finishEditMode = useCallback(() => {
    setEditMode(false);
    void setOrder(localThreads.map((row) => row.id));
    syncFloatingFromVisible(localThreads, getDisplayName);
  }, [localThreads, setOrder, getDisplayName]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.green || '#34C759'} />
      </View>
    );
  }

  if (!sortedThreads.length) {
    return (
      <Animated.View entering={FadeInDown.springify()} style={styles.emptyWrap}>
        <BlurView intensity={isDark ? 36 : 70} tint={isDark ? 'dark' : 'light'} style={styles.emptyCard}>
          <View style={[styles.emptyInner, { backgroundColor: isDark ? 'rgba(28,28,30,0.7)' : 'rgba(255,255,255,0.88)' }]}>
            <MessageCircle size={32} color={colors.green || '#34C759'} strokeWidth={1.8} />
            <Text style={[styles.emptyTitle, { color: colors.textMain }]}>{t('contact.empty.title')}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('contact.empty.subtitle')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textSec }]}>{t('contact.empty.hint')}</Text>
          </View>
        </BlurView>
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={[styles.toolbarHint, { color: colors.textMuted }]}>
          {editMode ? t('contact.list.editHint') : t('contact.list.manageHint')}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (editMode) finishEditMode();
            else setEditMode(true);
          }}
          style={({ pressed }) => [styles.toolbarBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.toolbarBtnText, { color: colors.green || '#34C759' }]}>
            {editMode ? t('contact.list.done') : t('contact.list.edit')}
          </Text>
        </Pressable>
      </View>

      {editMode ? (
        <DraggableFlatList
          data={localThreads}
          keyExtractor={(item) => String(item.id)}
          onDragEnd={({ data }) => setLocalThreads(data)}
          renderItem={renderDraggableItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={sortedThreads}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40).springify()} style={styles.rowWrap}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  onOpenThread(item);
                }}
                style={({ pressed }) => [pressed && { opacity: 0.92 }]}
              >
                {renderThreadCard(item)}
              </Pressable>
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={renameTarget != null} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRenameTarget(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>{t('contact.list.renameTitle')}</Text>
            <TextInput
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder={t('contact.list.renamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={[
                styles.modalInput,
                {
                  color: colors.textMain,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRenameTarget(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.textMuted }}>{t('contact.list.deleteCancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!renameTarget) return;
                  void setAlias(renameTarget.id, renameDraft.trim() || null);
                  setRenameTarget(null);
                  Haptics.selectionAsync();
                }}
                style={styles.modalBtn}
              >
                <Text style={{ color: colors.green || '#34C759', fontWeight: '700' }}>{t('contact.list.renameSave')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loader: { paddingVertical: 48, alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  toolbarHint: { flex: 1, fontSize: 12, marginRight: 12 },
  toolbarBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  toolbarBtnText: { fontSize: 15, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 50, gap: 10 },
  rowWrap: { marginBottom: 0 },
  cardBlur: { borderRadius: 18, overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 18,
  },
  cardDragging: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  dragHandle: { paddingRight: 2, paddingVertical: 4 },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  directPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(52,199,89,0.16)',
  },
  directPillText: { fontSize: 9, fontWeight: '900', color: '#34C759', letterSpacing: 0.5 },
  preview: { fontSize: 13, lineHeight: 18 },
  trailing: { alignItems: 'center', justifyContent: 'center', minWidth: 24 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 6 },
  unreadDot: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyWrap: { paddingHorizontal: 16, paddingTop: 8 },
  emptyCard: { borderRadius: 22, overflow: 'hidden' },
  emptyInner: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 22,
    gap: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyHint: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 4 },
});
