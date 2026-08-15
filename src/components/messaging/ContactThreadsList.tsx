import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NumericKeyboardAccessory from '../NumericKeyboardAccessory';
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
import { ChevronRight, GripVertical, MessageCircle, Pencil, Trash2 } from 'lucide-react-native';
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
import { formatContactLastMessagePreview } from '../../utils/contactAttachment';
import { formatPresenceSubtitle } from '../../utils/formatLastSeen';

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

function threadPreview(raw?: string | null): string {
  const text = String(raw || '').trim();
  if (!text) return '—';
  if (text.includes('[[CONTACT_ATTACHMENT]]')) {
    return formatContactLastMessagePreview({ content: text }) || '—';
  }
  return text;
}

function syncFloatingFromVisible(visible: ContactThreadRow[], getDisplayName: (id: number, fb: string) => string) {
  const entries = visible.slice(0, 4).map((thread) => ({
    threadId: thread.id,
    peerUserId: thread.peerUserId,
    peerName: getDisplayName(thread.id, thread.peerUserName),
    peerImage: thread.peer?.image ?? null,
    unread: Math.max(0, Number(thread.unread ?? thread.unreadCount ?? 0)),
    lastPreview: threadPreview(thread.lastMessage),
    peerIsOnline: Boolean(thread.peerIsOnline ?? thread.peer?.isOnline),
    peerLastSeenAt: thread.peerLastSeenAt ?? thread.peer?.lastSeenAt ?? null,
  }));
  useFloatingChatsStore.getState().syncEntries(entries);
}

type ThreadCardProps = {
  thread: ContactThreadRow;
  displayName: string;
  colors: Colors;
  isDark: boolean;
  editMode: boolean;
  drag?: () => void;
  isActive?: boolean;
  onRename: () => void;
  onDelete: () => void;
};

const ThreadCard = React.memo(function ThreadCard({
  thread,
  displayName,
  colors,
  isDark,
  editMode,
  drag,
  isActive,
  onRename,
  onDelete,
}: ThreadCardProps) {
  const { t } = useI18n();
  const unread = Math.max(0, Number(thread.unread ?? thread.unreadCount ?? 0));
  const cardBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.98)';
  const isOnline = Boolean(thread.peerIsOnline ?? thread.peer?.isOnline);
  const presenceLine = formatPresenceSubtitle({
    isOnline,
    lastSeenAt: thread.peerLastSeenAt ?? thread.peer?.lastSeenAt,
    onlineLabel: t('contact.presence.online'),
    offlineLabel: t('contact.presence.offline'),
    lastSeenPrefix: t('contact.presence.lastSeen'),
  });

  return (
    <View style={[styles.cardWrap, isActive && styles.cardDragging]}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        {editMode ? (
          <Pressable onLongPress={drag} delayLongPress={120} style={styles.dragHandle}>
            <GripVertical size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <ContactPeerAvatar
          name={displayName}
          peer={thread.peer}
          size={46}
          isDark={isDark}
          isOnline={isOnline}
        />
        <Pressable style={styles.body} disabled={!editMode} onPress={onRename}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.textMain }]} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.directPill}>
              <Text style={styles.directPillText}>{t('contact.list.directBadge')}</Text>
            </View>
          </View>
          <Text
            style={[styles.presence, { color: isOnline ? '#34C759' : colors.textMuted }]}
            numberOfLines={1}
          >
            {presenceLine}
          </Text>
          <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={2}>
            {threadPreview(thread.lastMessage)}
          </Text>
        </Pressable>
        <View style={styles.trailing}>
          {editMode ? (
            <View style={styles.editActions}>
              <Pressable hitSlop={8} onPress={onRename} style={styles.iconBtn}>
                <Pencil size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable hitSlop={8} onPress={onDelete} style={styles.iconBtn}>
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
    </View>
  );
});

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
  const floatingSyncedKeyRef = useRef('');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const sortedThreads = useMemo(
    () => sortContactThreads(threads, order, hidden),
    [threads, order, hidden],
  );

  useEffect(() => {
    if (editMode) return;
    setLocalThreads(sortedThreads);
    const syncKey = sortedThreads
      .map(
        (t) =>
          `${t.id}:${t.lastMessage ?? ''}:${t.unread ?? t.unreadCount ?? 0}:${getDisplayName(t.id, t.peerUserName)}`,
      )
      .join('|');
    if (syncKey !== floatingSyncedKeyRef.current) {
      floatingSyncedKeyRef.current = syncKey;
      syncFloatingFromVisible(sortedThreads, getDisplayName);
    }
  }, [sortedThreads, getDisplayName, editMode]);

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

  const openRename = useCallback((thread: ContactThreadRow) => {
    setRenameTarget(thread);
    setRenameDraft(getDisplayName(thread.id, thread.peerUserName));
  }, [getDisplayName]);

  const renderDraggableItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ContactThreadRow>) => (
      <ScaleDecorator>
        <View style={styles.rowWrap}>
          <ThreadCard
            thread={item}
            displayName={getDisplayName(item.id, item.peerUserName)}
            colors={colors}
            isDark={isDark}
            editMode
            drag={drag}
            isActive={isActive}
            onRename={() => openRename(item)}
            onDelete={() => confirmDelete(item)}
          />
        </View>
      </ScaleDecorator>
    ),
    [colors, isDark, getDisplayName, openRename, confirmDelete],
  );

  const renderListItem = useCallback(
    ({ item }: { item: ContactThreadRow }) => (
      <View style={styles.rowWrap}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onOpenThread(item);
          }}
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        >
          <ThreadCard
            thread={item}
            displayName={getDisplayName(item.id, item.peerUserName)}
            colors={colors}
            isDark={isDark}
            editMode={false}
            onRename={() => openRename(item)}
            onDelete={() => confirmDelete(item)}
          />
        </Pressable>
      </View>
    ),
    [colors, isDark, getDisplayName, onOpenThread, openRename, confirmDelete],
  );

  const finishEditMode = useCallback(() => {
    setEditMode(false);
    void setOrder(localThreads.map((row) => row.id));
    syncFloatingFromVisible(localThreads, getDisplayName);
    floatingSyncedKeyRef.current = localThreads
      .map(
        (t) =>
          `${t.id}:${t.lastMessage ?? ''}:${t.unread ?? t.unreadCount ?? 0}:${getDisplayName(t.id, t.peerUserName)}`,
      )
      .join('|');
  }, [localThreads, setOrder, getDisplayName]);

  const showInitialLoader = loading && sortedThreads.length === 0;

  if (showInitialLoader) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.green || '#34C759'} />
      </View>
    );
  }

  if (!sortedThreads.length) {
    const emptyBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.98)';
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyCard, { backgroundColor: emptyBg }]}>
          <MessageCircle size={32} color={colors.green || '#34C759'} strokeWidth={1.8} />
          <Text style={[styles.emptyTitle, { color: colors.textMain }]}>{t('contact.empty.title')}</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t('contact.empty.subtitle')}</Text>
          <Text style={[styles.emptyHint, { color: colors.textSec }]}>{t('contact.empty.hint')}</Text>
        </View>
      </View>
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
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
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
      <NumericKeyboardAccessory />
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
  cardWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
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
  presence: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
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
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 22,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
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
