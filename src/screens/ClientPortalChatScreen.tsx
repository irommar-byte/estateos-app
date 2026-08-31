import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InstantMessageThread, { type IMThreadMessage } from '../components/messaging/InstantMessageThread';
import { useThemeStore } from '../store/useThemeStore';
import { getChatTheme } from '../components/messaging/chatTheme';
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
  const silent = useRef(false);

  const load = useCallback(async () => {
    if (!portalToken) return;
    try {
      const state = await listPortalMessages(portalToken);
      setMessages(state.messages.map(mapPortalMessage));
      await markPortalMessagesRead(portalToken);
    } finally {
      setLoading(false);
    }
  }, [portalToken]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (silent.current) return;
      void load();
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending || !portalToken) return;
    setSending(true);
    silent.current = true;
    try {
      await sendPortalMessage(portalToken, content);
      setDraft('');
      await load();
    } finally {
      setSending(false);
      silent.current = false;
    }
  };

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

      {loading && messages.length === 0 ? (
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
