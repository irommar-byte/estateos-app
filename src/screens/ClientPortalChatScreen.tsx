import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InstantMessageThread, { type IMThreadMessage } from '../components/messaging/InstantMessageThread';
import { useThemeStore } from '../store/useThemeStore';
import { getChatTheme } from '../components/messaging/chatTheme';
import { useAppActiveInterval } from '../hooks/useAppActivePoll';
import {
  listPortalMessages,
  markPortalMessagesRead,
  sendPortalMessage,
  type PortalChatMessage,
} from '../services/clientPortalService';

const CLIENT_SENDER_ID = 1;
const AGENT_SENDER_ID = 0;

function mapPortalMessage(message: PortalChatMessage): IMThreadMessage {
  const mine = message.from === 'client';
  return {
    id: message.id,
    senderId: mine ? CLIENT_SENDER_ID : AGENT_SENDER_ID,
    content: String(message.content || message.body || '').trim(),
    createdAt: message.createdAt,
    isRead: true,
  };
}

export default function ClientPortalChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const { headerStyles } = useMemo(() => getChatTheme(isDark), [isDark]);

  const portalToken = String(route.params?.portalToken || '').trim();
  const agentName = String(route.params?.agentName || 'Agent').trim();

  const [messages, setMessages] = useState<IMThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const silent = useRef(false);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!portalToken) {
      setError('Brak tokenu panelu.');
      setLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    try {
      const state = await listPortalMessages(portalToken);
      if (seq !== loadSeq.current) return;
      setMessages(state.messages.map(mapPortalMessage));
      setError(null);
      await markPortalMessagesRead(portalToken);
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      setError(err?.message || 'Nie udało się wczytać wiadomości.');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [portalToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useAppActiveInterval(() => {
    if (silent.current) return;
    void load();
  }, 5000, Boolean(portalToken));

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending || !portalToken) return;
    setSending(true);
    silent.current = true;
    try {
      await sendPortalMessage(portalToken, content);
      setDraft('');
      await load();
    } catch (err: any) {
      Alert.alert('Wiadomość', err?.message || 'Nie udało się wysłać wiadomości.');
    } finally {
      setSending(false);
      silent.current = false;
    }
  };

  if (!portalToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#000' : '#F2F2F7' }}>
        <Text style={{ color: isDark ? '#FFF' : '#000' }}>Brak tokenu panelu.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#F2F2F7' }}>
      <View style={[headerStyles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={headerStyles.backBtn}>
          <ChevronLeft size={24} color={isDark ? '#F5F5F7' : '#111827'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={headerStyles.title} numberOfLines={1}>
            {agentName}
          </Text>
          <Text style={headerStyles.subtitle}>Czat w panelu klienta</Text>
        </View>
      </View>

      {error && messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: isDark ? '#FFF' : '#000', textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => void load()} style={{ marginTop: 12 }}>
            <Text style={{ color: '#34C759', fontWeight: '700' }}>Spróbuj ponownie</Text>
          </Pressable>
        </View>
      ) : loading && messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#34C759" />
        </View>
      ) : (
        <InstantMessageThread
          messages={messages}
          currentUserId={CLIENT_SENDER_ID}
          loading={loading}
          draft={draft}
          onDraftChange={setDraft}
          onSend={onSend}
          sending={sending}
          placeholder="Napisz do agenta…"
          isDark={isDark}
        />
      )}
    </View>
  );
}
