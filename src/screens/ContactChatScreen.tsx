import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import {
  fetchContactMessages,
  sendContactMessage,
  sendContactTyping,
  setContactMessageReaction,
  type ContactMessageRow,
} from '../services/contactService';
import { setActiveContactThread } from '../utils/activeContactPush';
import { useFloatingChatsStore } from '../store/useFloatingChatsStore';
import { useI18n } from '../i18n';
import InstantMessageThread, { type IMThreadMessage } from '../components/messaging/InstantMessageThread';
import { CHAT_COLORS } from '../components/messaging/chatTheme';

const TYPING_PULSE_MS = 1500;

export default function ContactChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const userId = Number(useAuthStore((s) => s.user?.id) || 0);

  const threadId = Number(route.params?.threadId || 0);
  const peerUserId = Number(route.params?.peerUserId || 0);
  const peerName = String(route.params?.peerName || t('contact.peerFallback', { id: peerUserId || '?' }));

  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const lastTypingSentRef = useRef(0);

  const load = useCallback(async () => {
    if (!token || !threadId) return;
    try {
      const { messages: rows, isTyping } = await fetchContactMessages(token, threadId);
      setMessages(rows);
      setPeerTyping(Boolean(isTyping));
      useFloatingChatsStore.getState().clearUnread(threadId);
    } catch {
      /* polling w tle — zostaw ostatni stabilny stan */
    } finally {
      setLoading(false);
    }
  }, [token, threadId]);

  useFocusEffect(
    useCallback(() => {
      setActiveContactThread(threadId);
      useFloatingChatsStore.getState().setDockSuppressed(true);
      void load();
      const poll = setInterval(() => void load(), 2500);
      return () => {
        clearInterval(poll);
        setActiveContactThread(null);
        useFloatingChatsStore.getState().setDockSuppressed(false);
      };
    }, [threadId, load]),
  );

  useEffect(() => {
    useFloatingChatsStore.getState().upsertThread({
      threadId,
      peerUserId,
      peerName,
    });
  }, [threadId, peerUserId, peerName]);

  const onDraftChange = (text: string) => {
    setDraft(text);
    if (!token || !threadId) return;
    const now = Date.now();
    if (text.length > 0 && now - lastTypingSentRef.current > TYPING_PULSE_MS) {
      lastTypingSentRef.current = now;
      void sendContactTyping(token, threadId);
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !token || sending || !userId) return;

    const optimistic: ContactMessageRow = {
      id: -Date.now(),
      threadId,
      senderId: userId,
      content: text,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    setSending(true);
    setDraft('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessages((prev) => [...prev, optimistic]);

    try {
      const msg = await sendContactMessage(token, threadId, text);
      if (msg) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== optimistic.id);
          if (withoutTemp.some((m) => m.id === msg.id)) return withoutTemp;
          return [...withoutTemp, msg];
        });
      } else {
        await load();
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const onReact = async (messageId: number | string, emoji: string | null) => {
    const numericId = Number(messageId);
    if (!token || !Number.isFinite(numericId) || numericId <= 0) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== numericId) return m;
        const reactions = { ...(m.reactions ?? {}) };
        const key = String(userId);
        if (!emoji) delete reactions[key];
        else reactions[key] = emoji;
        return { ...m, reactions };
      }),
    );

    try {
      const updated = await setContactMessageReaction(token, threadId, numericId, emoji);
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === numericId ? { ...m, ...updated } : m)));
      }
    } catch {
      await load();
    }
  };

  const threadMessages: IMThreadMessage[] = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt,
    isRead: m.isRead,
    reactions: m.reactions,
  }));

  const goBackToContactList = useCallback(() => {
    Haptics.selectionAsync();
    navigation.navigate('MainTabs', {
      screen: 'Wiadomości',
      params: { messagesSegment: 'contact' },
    });
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackToContactList();
      return true;
    });
    return () => sub.remove();
  }, [goBackToContactList]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={goBackToContactList}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <ChevronLeft size={28} color={CHAT_COLORS.textBase} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>{t('contact.chat.eyebrow')}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {peerName}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <InstantMessageThread
        messages={threadMessages}
        currentUserId={userId}
        loading={loading}
        peerTyping={peerTyping}
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={() => void onSend()}
        sending={sending}
        placeholder={t('contact.chat.placeholder')}
        onReact={(messageId, emoji) => void onReact(messageId, emoji)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: CHAT_COLORS.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backButtonPressed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTextContainer: { flex: 1, marginLeft: 8 },
  headerSubtitle: {
    color: CHAT_COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: CHAT_COLORS.textBase,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  headerSpacer: { width: 44 },
});
