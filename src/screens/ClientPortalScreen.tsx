import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { formatCurrencyPLN } from '../utils/crmFormatters';
import { groupPortalOfferStacks, OFFER_STACKS, resolveAssistantPulse, type OfferStackId } from '../lib/clientPortalBoard';
import { rememberPortalSession } from '../lib/clientPortalSession';
import { registerClientPortalPushIfPossible } from '../hooks/usePushNotifications';
import {
  fetchClientPortal,
  linkPortalAccount,
  listPortalMessages,
  markPortalMessagesRead,
  sendPortalMessage,
  submitPortalCheckback,
  submitPortalFeedback,
  type ClientPortalPayload,
  type PortalChatMessage,
  type PortalMatch,
} from '../services/clientPortalService';

const LIKE_PHRASES = ['Świetna lokalizacja', 'Podoba mi się układ', 'Dobry metraż', 'Pasuje do budżetu'];
const DISLIKE_PHRASES = ['Za drogo', 'Brak balkonu', 'Nie ta dzielnica', 'Za mało pokoi'];

export default function ClientPortalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const user = useAuthStore((s) => s.user);
  const authToken = useAuthStore((s) => s.token);
  const loginWithPasskey = useAuthStore((s) => s.loginWithPasskey);

  const portalToken = String(route.params?.portalToken || '').trim();
  const palette = isDark
    ? {
        bg: '#000',
        card: '#1C1C1E',
        text: '#F5F5F7',
        muted: 'rgba(255,255,255,0.55)',
        line: 'rgba(255,255,255,0.12)',
        gold: '#E8C36A',
        green: '#34C759',
      }
    : {
        bg: '#F2F2F7',
        card: '#FFFFFF',
        text: '#111827',
        muted: '#6B7280',
        line: 'rgba(0,0,0,0.08)',
        gold: '#B45309',
        green: '#059669',
      };

  const [portal, setPortal] = useState<ClientPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStacks, setOpenStacks] = useState<OfferStackId[]>(['new', 'like']);
  const [openMatchIds, setOpenMatchIds] = useState<number[]>([]);
  const [pendingPhrases, setPendingPhrases] = useState<Record<number, string[]>>({});
  const [linking, setLinking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [messages, setMessages] = useState<PortalChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const silent = useRef(false);

  const load = useCallback(
    async (mode: 'full' | 'silent' | 'refresh' = 'full') => {
      if (!portalToken) {
        setError('Brak tokenu panelu.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'full') setLoading(true);
      try {
        const next = await fetchClientPortal(portalToken, authToken);
        setPortal(next);
        setError(null);
        await rememberPortalSession({
          token: portalToken,
          clientName: next.clientName,
          agencyName: next.agencyName,
        });
        void registerClientPortalPushIfPossible({ prompt: true });
      } catch (err: any) {
        if (mode !== 'silent') setError(err?.message || 'Nie udało się otworzyć panelu.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [portalToken, authToken],
  );

  useEffect(() => {
    void load('full');
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (silent.current) return;
      void load('silent');
    }, 8000);
    return () => clearInterval(id);
  }, [load]);

  const stacks = useMemo(() => groupPortalOfferStacks(portal?.matches || []), [portal?.matches]);
  const pulse = useMemo(
    () =>
      resolveAssistantPulse({
        intelligenceEnabled: Boolean(portal?.intelligenceEnabled),
        pendingNewCount: stacks.new.length,
        unscoredCount: portal?.unscoredMatchCount || 0,
        pendingCheckback: Boolean(portal?.pendingCheckback),
      }),
    [portal, stacks.new.length],
  );

  const toggleStack = (id: OfferStackId) => {
    setOpenStacks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleMatch = (id: number) => {
    setOpenMatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const rateMatch = async (match: PortalMatch, sentiment: 'like' | 'maybe' | 'dislike') => {
    silent.current = true;
    try {
      await submitPortalFeedback(portalToken, {
        matchId: match.id,
        sentiment,
        phrases: pendingPhrases[match.id] || [],
      });
      setOpenStacks((prev) => (prev.includes(sentiment) ? prev : [...prev, sentiment]));
      await load('silent');
    } catch (err: any) {
      Alert.alert('Reakcja', err?.message || 'Nie udało się zapisać oceny.');
    } finally {
      silent.current = false;
    }
  };

  const answerCheckback = async (optionId: string) => {
    if (!portal?.pendingCheckback) return;
    silent.current = true;
    try {
      await submitPortalCheckback(portalToken, {
        activityId: portal.pendingCheckback.activityId,
        optionId,
      });
      await load('silent');
    } catch (err: any) {
      Alert.alert('Asystent', err?.message || 'Nie udało się zapisać odpowiedzi.');
    } finally {
      silent.current = false;
    }
  };

  const onLinkAccount = async () => {
    if (!authToken) {
      Alert.alert(
        'Powiąż z kontem',
        'Zaloguj się tym samym e-mailem co w CRM (Passkey). Po reinstalacji panel wróci sam.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Passkey',
            onPress: () => {
              void loginWithPasskey(null);
            },
          },
          {
            text: 'Zaloguj e-mailem',
            onPress: () =>
              navigation.navigate('MainTabs', {
                screen: 'Profil',
                params: { authIntent: 'login' },
              }),
          },
        ],
      );
      return;
    }
    setLinking(true);
    try {
      await linkPortalAccount(portalToken, authToken);
      await load('silent');
    } catch (err: any) {
      Alert.alert('Powiązanie', err?.message || 'Nie udało się powiązać konta.');
    } finally {
      setLinking(false);
    }
  };

  useEffect(() => {
    if (!authToken || !portalToken || portal?.account?.linkedToYou) return;
    void linkPortalAccount(portalToken, authToken)
      .then(() => load('silent'))
      .catch(() => {});
  }, [authToken, portalToken, portal?.account?.linkedToYou, load]);

  const openChat = async () => {
    setChatOpen(true);
    try {
      const state = await listPortalMessages(portalToken);
      setMessages(state.messages);
      await markPortalMessagesRead(portalToken);
    } catch {
      /* keep modal */
    }
  };

  const sendChat = async () => {
    const content = chatDraft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await sendPortalMessage(portalToken, content);
      setChatDraft('');
      const state = await listPortalMessages(portalToken);
      setMessages(state.messages);
    } catch (err: any) {
      Alert.alert('Czat', err?.message || 'Nie wysłano wiadomości.');
    } finally {
      setSending(false);
    }
  };

  if (loading && !portal) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
        <ActivityIndicator color={palette.green} />
      </View>
    );
  }

  if (error && !portal) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg, paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={{ color: palette.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.green, fontWeight: '700' }}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }} numberOfLines={1}>
            {(portal?.agencyName || 'EstateOS').toUpperCase()}
          </Text>
          <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
            Panel klienta
          </Text>
        </View>
        <Pressable onPress={openChat} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={palette.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      >
        <Text style={{ color: palette.muted, marginBottom: 12 }}>
          Cześć {portal?.clientName || ''} — tu są oferty od {portal?.agentName || 'Twojego agenta'}.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.line }]}>
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>
            {portal?.account?.linkedToYou ? 'Panel powiązany z kontem' : 'Powiąż z kontem'}
          </Text>
          <Text style={{ color: palette.muted, marginTop: 6, lineHeight: 20 }}>
            {portal?.account?.linkedToYou
              ? 'Po reinstalacji wystarczy się zalogować (Passkey) — panel wróci sam. Powiadomienia idą na to urządzenie.'
              : `Ten sam e-mail co w CRM${portal?.account?.emailMasked ? ` (${portal.account.emailMasked})` : ''}. Passkey albo logowanie — wtedy panel i push zostają przy Twoim koncie.`}
          </Text>
          {!portal?.account?.linkedToYou ? (
            <Pressable
              onPress={onLinkAccount}
              disabled={linking}
              style={[styles.cta, { backgroundColor: palette.green, opacity: linking ? 0.6 : 1 }]}
            >
              <Text style={styles.ctaText}>{user ? 'Powiąż z tym kontem' : 'Zaloguj i powiąż'}</Text>
            </Pressable>
          ) : null}
        </View>

        {portal?.pendingCheckback ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.gold, borderWidth: 1.5 }]}>
            <Text style={{ color: palette.gold, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>
              WYMAGA TWOJEJ ODPOWIEDZI
            </Text>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 18, marginTop: 8 }}>
              {portal.pendingCheckback.body}
            </Text>
            <Text style={{ color: palette.muted, marginTop: 6 }}>Dopóki nie wybierzesz, kolejna oferta nie pójdzie.</Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {portal.pendingCheckback.options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => answerCheckback(option.id)}
                  style={[styles.choice, { borderColor: palette.gold }]}
                >
                  <Text style={{ color: palette.text, fontWeight: '700' }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {pulse ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.line }]}>
            <Text style={{ color: palette.gold, fontWeight: '800', fontSize: 12 }}>{pulse.badge.toUpperCase()}</Text>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 17, marginTop: 6 }}>{pulse.title}</Text>
            <Text style={{ color: palette.muted, marginTop: 6, lineHeight: 20 }}>{pulse.body}</Text>
            {pulse.cta ? (
              <Pressable onPress={() => setOpenStacks((prev) => (prev.includes('new') ? prev : [...prev, 'new']))} style={{ marginTop: 10 }}>
                <Text style={{ color: palette.green, fontWeight: '800' }}>{pulse.cta}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {[
            ['Nowe', stacks.new.length],
            ['Oglądać', stacks.like.length],
            ['Może', stacks.maybe.length],
            ['Nie', stacks.dislike.length],
          ].map(([label, value]) => (
            <View key={String(label)} style={[styles.stat, { backgroundColor: palette.card, borderColor: palette.line }]}>
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: 18 }}>{value}</Text>
              <Text style={{ color: palette.muted, fontSize: 11 }}>{label}</Text>
            </View>
          ))}
        </View>

        {OFFER_STACKS.map((stack) => {
          const items = stacks[stack.id];
          const open = openStacks.includes(stack.id);
          return (
            <View key={stack.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.line }]}>
              <Pressable onPress={() => toggleStack(stack.id)} style={styles.stackHead}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>
                    {stack.title} · {items.length}
                  </Text>
                  <Text style={{ color: palette.muted, marginTop: 4 }}>{stack.hint}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
              </Pressable>
              {open
                ? items.map((match) => {
                    const expanded = openMatchIds.includes(match.id);
                    const phrases = stack.id === 'new' ? [...LIKE_PHRASES, ...DISLIKE_PHRASES] : [];
                    const selected = pendingPhrases[match.id] || [];
                    return (
                      <View key={match.id} style={[styles.match, { borderTopColor: palette.line }]}>
                        <Pressable onPress={() => toggleMatch(match.id)} style={{ flexDirection: 'row', gap: 12 }}>
                          {match.offer.imageUrl ? (
                            <Image source={{ uri: match.offer.imageUrl }} style={styles.thumb} />
                          ) : (
                            <View style={[styles.thumb, { backgroundColor: palette.line }]} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: palette.text, fontWeight: '700' }} numberOfLines={2}>
                              {match.offer.title}
                            </Text>
                            <Text style={{ color: palette.muted, marginTop: 4 }}>
                              {[match.offer.city, match.offer.district].filter(Boolean).join(' · ')}
                            </Text>
                            <Text style={{ color: palette.text, marginTop: 4, fontWeight: '700' }}>
                              {formatCurrencyPLN(match.offer.price)} {match.score ? `· ${match.score}%` : ''}
                            </Text>
                          </View>
                        </Pressable>
                        {expanded ? (
                          <View style={{ marginTop: 12 }}>
                            {match.clientWhy ? (
                              <Text style={{ color: palette.muted, marginBottom: 8 }}>{match.clientWhy}</Text>
                            ) : null}
                            <Pressable
                              onPress={() =>
                                navigation.navigate('OfferDetail', {
                                  offer: { id: match.offer.id },
                                  id: match.offer.id,
                                  offerId: match.offer.id,
                                })
                              }
                            >
                              <Text style={{ color: palette.green, fontWeight: '700', marginBottom: 10 }}>Zobacz ogłoszenie</Text>
                            </Pressable>
                            {stack.id === 'new' ? (
                              <>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                  {phrases.map((phrase) => {
                                    const on = selected.includes(phrase);
                                    return (
                                      <Pressable
                                        key={phrase}
                                        onPress={() =>
                                          setPendingPhrases((prev) => {
                                            const current = prev[match.id] || [];
                                            const next = on ? current.filter((p) => p !== phrase) : [...current, phrase];
                                            return { ...prev, [match.id]: next };
                                          })
                                        }
                                        style={[
                                          styles.phrase,
                                          {
                                            borderColor: on ? palette.green : palette.line,
                                            backgroundColor: on ? 'rgba(52,199,89,0.12)' : 'transparent',
                                          },
                                        ]}
                                      >
                                        <Text style={{ color: palette.text, fontSize: 12 }}>{phrase}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <Pressable onPress={() => rateMatch(match, 'like')} style={[styles.rate, { backgroundColor: '#059669' }]}>
                                    <Text style={styles.rateText}>Chcę oglądać</Text>
                                  </Pressable>
                                  <Pressable onPress={() => rateMatch(match, 'maybe')} style={[styles.rate, { backgroundColor: '#D97706' }]}>
                                    <Text style={styles.rateText}>Może</Text>
                                  </Pressable>
                                  <Pressable onPress={() => rateMatch(match, 'dislike')} style={[styles.rate, { backgroundColor: '#E11D48' }]}>
                                    <Text style={styles.rateText}>Nie</Text>
                                  </Pressable>
                                </View>
                              </>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                : null}
              {open && items.length === 0 ? (
                <Text style={{ color: palette.muted, paddingTop: 8 }}>Pusto w tym stosie.</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => setChatOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={26} color={palette.text} />
            </Pressable>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 18, marginLeft: 12 }}>Czat z agentem</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {messages.map((message) => {
              const mine = message.from === 'client';
              return (
                <View
                  key={message.id}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? palette.green : palette.card,
                    padding: 10,
                    borderRadius: 14,
                    maxWidth: '82%',
                  }}
                >
                  <Text style={{ color: mine ? '#052e1c' : palette.text }}>{message.content || message.body}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', padding: 12, paddingBottom: insets.bottom + 12, gap: 8 }}>
            <TextInput
              value={chatDraft}
              onChangeText={setChatDraft}
              placeholder="Napisz do agenta…"
              placeholderTextColor={palette.muted}
              style={{
                flex: 1,
                backgroundColor: palette.card,
                color: palette.text,
                borderRadius: 14,
                paddingHorizontal: 12,
                minHeight: 44,
              }}
            />
            <Pressable onPress={sendChat} disabled={sending} style={[styles.cta, { backgroundColor: palette.green, marginTop: 0 }]}>
              <Text style={styles.ctaText}>Wyślij</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  cta: { marginTop: 12, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  ctaText: { color: '#052e1c', fontWeight: '800' },
  choice: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  stat: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, alignItems: 'center' },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  match: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  phrase: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  rate: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  rateText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
