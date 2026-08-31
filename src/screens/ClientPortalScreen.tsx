import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileCardShell from '../components/profile/ProfileCardShell';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { formatCurrencyPLN } from '../utils/crmFormatters';
import {
  defaultOpenStackIds,
  groupPortalOfferStacks,
  OFFER_STACKS,
  resolveAssistantPulse,
  type OfferStackId,
} from '../lib/clientPortalBoard';
import { rememberPortalSession, markPortalAuthReturn } from '../lib/clientPortalSession';
import { useAppActiveInterval } from '../hooks/useAppActivePoll';
import {
  getClientPortalPushPermissionStatus,
  registerClientPortalPushAfterLink,
  registerClientPortalPushIfPossible,
} from '../hooks/usePushNotifications';
import {
  fetchClientPortal,
  linkPortalAccount,
  submitPortalCheckback,
  submitPortalFeedback,
  type ClientPortalPayload,
  type PortalAccount,
  type PortalMatch,
} from '../services/clientPortalService';

const LIKE_PHRASES = ['Świetna lokalizacja', 'Podoba mi się układ', 'Dobry metraż', 'Pasuje do budżetu'];
const DISLIKE_PHRASES = ['Za drogo', 'Brak balkonu', 'Nie ta dzielnica', 'Za mało pokoi'];

function accountFromStatus(base: PortalAccount | undefined, status: PortalAccount['status']): PortalAccount {
  return {
    status,
    linked: status === 'linked' || Boolean(base?.linked),
    linkedToYou: status === 'linked',
    emailMasked: base?.emailMasked ?? null,
    sessionEmailMasked: base?.sessionEmailMasked ?? null,
  };
}

export default function ClientPortalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const user = useAuthStore((s) => s.user);
  const authToken = useAuthStore((s) => s.token);

  const portalToken = String(route.params?.portalToken || '').trim();
  const colors = {
    bg: isDark ? '#000000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    green: '#34C759',
    gold: isDark ? '#E8C36A' : '#B45309',
    tint: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.12)',
  };

  const [portal, setPortal] = useState<ClientPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStacks, setOpenStacks] = useState<OfferStackId[]>([]);
  const [openMatchIds, setOpenMatchIds] = useState<number[]>([]);
  const [pendingPhrases, setPendingPhrases] = useState<Record<number, string[]>>({});
  const [linking, setLinking] = useState(false);
  const [pushPermission, setPushPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const silent = useRef(false);
  const stacksInitialized = useRef(false);
  const autoLinkAttempted = useRef(false);
  const loadSeq = useRef(0);
  const linkInFlight = useRef(false);

  useEffect(() => {
    stacksInitialized.current = false;
    autoLinkAttempted.current = false;
    loadSeq.current += 1;
    setPortal(null);
    setOpenStacks([]);
    setOpenMatchIds([]);
    setPendingPhrases({});
    setError(null);
  }, [portalToken]);

  const refreshPushStatus = useCallback(async () => {
    setPushPermission(await getClientPortalPushPermissionStatus());
  }, []);

  const load = useCallback(
    async (mode: 'full' | 'silent' | 'refresh' = 'full') => {
      if (!portalToken) {
        setError('Brak tokenu panelu.');
        setLoading(false);
        return;
      }
      const seq = ++loadSeq.current;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'full') setLoading(true);
      try {
        const next = await fetchClientPortal(portalToken, authToken);
        if (seq !== loadSeq.current) return;
        setPortal(next);
        setError(null);
        if (!stacksInitialized.current) {
          const grouped = groupPortalOfferStacks(next.matches || []);
          setOpenStacks(defaultOpenStackIds(grouped));
          stacksInitialized.current = true;
        }
        await rememberPortalSession({
          token: portalToken,
          clientName: next.clientName,
          agencyName: next.agencyName,
        });
        if (next.account?.status !== 'wrong_account') {
          void registerClientPortalPushIfPossible({ prompt: false });
        }
        await refreshPushStatus();
      } catch (err: any) {
        if (seq !== loadSeq.current) return;
        if (mode !== 'silent') setError(err?.message || 'Nie udało się otworzyć panelu.');
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [portalToken, authToken, refreshPushStatus],
  );

  useEffect(() => {
    void load('full');
  }, [load]);

  useAppActiveInterval(() => {
    if (silent.current) return;
    void load('silent');
  }, 8000, Boolean(portalToken));

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

  const accountStatus = portal?.account?.status ?? 'anonymous';
  const canOfferPush = accountStatus === 'linked' || accountStatus === 'ready';
  const canInteract = accountStatus !== 'wrong_account';
  const canChat = Boolean(portal?.canChat) && canInteract;

  const patchAccountStatus = (status: PortalAccount['status']) => {
    setPortal((prev) => (prev ? { ...prev, account: accountFromStatus(prev.account, status) } : prev));
  };

  const performLink = useCallback(
    async (options?: { promptPush?: boolean }) => {
      if (!authToken || !portalToken || linkInFlight.current) return false;
      linkInFlight.current = true;
      setLinking(true);
      try {
        await linkPortalAccount(portalToken, authToken);
        patchAccountStatus('linked');
        await registerClientPortalPushAfterLink({ prompt: options?.promptPush ?? false });
        await refreshPushStatus();
        await load('silent');
        return true;
      } catch (err: any) {
        Alert.alert('Powiązanie', err?.message || 'Nie udało się powiązać konta.');
        return false;
      } finally {
        linkInFlight.current = false;
        setLinking(false);
      }
    },
    [authToken, portalToken, load, refreshPushStatus],
  );

  const openPortalAuth = useCallback(
    (intent: 'register' | 'login') => {
      void markPortalAuthReturn(portalToken);
      navigation.navigate('MainTabs', {
        screen: 'Profil',
        params: { authIntent: intent },
      });
    },
    [navigation, portalToken],
  );

  const onLinkAccount = async () => {
    if (!authToken) {
      openPortalAuth('register');
      return;
    }
    await performLink({ promptPush: true });
  };

  useEffect(() => {
    if (!authToken || !portalToken || accountStatus !== 'ready' || autoLinkAttempted.current) return;
    autoLinkAttempted.current = true;
    void performLink({ promptPush: false }).then((ok) => {
      if (!ok) autoLinkAttempted.current = false;
    });
  }, [authToken, portalToken, accountStatus, performLink]);

  const toggleStack = (id: OfferStackId) => {
    setOpenStacks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleMatch = (id: number) => {
    setOpenMatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const rateMatch = async (match: PortalMatch, sentiment: 'like' | 'maybe' | 'dislike') => {
    if (!canInteract) return;
    silent.current = true;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitPortalFeedback(portalToken, {
        matchId: match.id,
        sentiment,
        phrases: pendingPhrases[match.id] || [],
      });
      setPendingPhrases((prev) => {
        const next = { ...prev };
        delete next[match.id];
        return next;
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
    if (!portal?.pendingCheckback || !canInteract) return;
    silent.current = true;
    try {
      await Haptics.selectionAsync();
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

  const openChat = () => {
    navigation.navigate('ClientPortalChat', {
      portalToken,
      agentName: portal?.agentName || 'Agent',
    });
  };

  const renderAccountSection = () => {
    const account = portal?.account;
    if (accountStatus === 'linked') {
      return (
        <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Panel powiązany z kontem</Text>
              <Text style={[styles.rowSub, { color: colors.secondary }]}>
                Po reinstalacji wystarczy Passkey — panel wróci sam.
                {account?.emailMasked ? ` · ${account.emailMasked}` : ''}
              </Text>
            </View>
          </View>
        </ProfileCardShell>
      );
    }

    if (accountStatus === 'wrong_account') {
      return (
        <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
          <View style={styles.row}>
            <Ionicons name="alert-circle-outline" size={22} color="#FF9500" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Inne konto</Text>
              <Text style={[styles.rowSub, { color: colors.secondary }]}>
                Ten panel jest dla {account?.emailMasked || 'klienta z CRM'}
                {account?.sessionEmailMasked ? ` · jesteś zalogowany jako ${account.sessionEmailMasked}` : ''}.
                Podglądasz panel — oceny i czat są wyłączone.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'Profil',
                params: { authIntent: 'login' },
              })
            }
            style={[styles.primaryBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.text }]}>Przełącz konto</Text>
          </Pressable>
        </ProfileCardShell>
      );
    }

    if (accountStatus === 'ready') {
      return (
        <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Powiąż z kontem</Text>
          <Text style={[styles.rowSub, { color: colors.secondary, marginTop: 4 }]}>
            Ten sam e-mail co w CRM{account?.emailMasked ? ` (${account.emailMasked})` : ''}. Passkey albo logowanie —
            wtedy panel i push zostają przy Twoim koncie.
          </Text>
          <Pressable
            onPress={onLinkAccount}
            disabled={linking}
            style={[styles.primaryBtn, { opacity: linking ? 0.6 : 1 }]}
          >
            <Text style={styles.primaryBtnText}>{user ? 'Powiąż z tym kontem' : 'Zaloguj i powiąż'}</Text>
          </Pressable>
        </ProfileCardShell>
      );
    }

    return (
      <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>Załóż konto, żeby zapamiętać panel</Text>
        <Text style={[styles.rowSub, { color: colors.secondary, marginTop: 4 }]}>
          {account?.emailMasked
            ? `Pierwszy raz w EstateOS? Zarejestruj się na ${account.emailMasked} — ten sam adres co w CRM. Ustawisz hasło; „odzysk hasła” działa dopiero, gdy konto już istnieje.`
            : 'Zarejestruj się tym samym e-mailem, który podałeś agentowi. Potem panel i powiadomienia zostaną przy Twoim koncie.'}
        </Text>
        <Pressable onPress={onLinkAccount} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Załóż konto i powiąż</Text>
        </Pressable>
        <Pressable onPress={() => openPortalAuth('login')} style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.green, fontWeight: '600', fontSize: 14 }}>Mam już konto — zaloguj się</Text>
        </Pressable>
      </ProfileCardShell>
    );
  };

  const renderPushRow = () => {
    if (!canOfferPush || pushPermission === 'granted') return null;
    return (
      <Pressable
        onPress={() => {
          if (pushPermission === 'denied') {
            void Linking.openSettings();
            return;
          }
          void registerClientPortalPushAfterLink({ prompt: true }).then(refreshPushStatus);
        }}
        style={[styles.pushRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Ionicons name="notifications-outline" size={18} color={colors.green} />
        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
          {pushPermission === 'denied' ? 'Włącz powiadomienia w ustawieniach iPhone' : 'Włącz powiadomienia o nowych ofertach'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
      </Pressable>
    );
  };

  if (loading && !portal) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (error && !portal) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.green, fontWeight: '700' }}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  const visibleStacks = OFFER_STACKS.filter((stack) => stacks[stack.id].length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
            {portal?.agencyName || 'EstateOS'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }} numberOfLines={1}>
            Panel
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {portal?.clientName} · {portal?.agentName}
          </Text>
        </View>
        <Pressable
          onPress={canChat ? openChat : undefined}
          disabled={!canChat}
          hitSlop={8}
          style={[styles.headerBtn, !canChat ? { opacity: 0.35 } : null]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.green} />
        </Pressable>
      </View>

      {pulse ? (
        <View style={[styles.pulseBar, { backgroundColor: colors.tint, borderBottomColor: colors.border }]}>
          {pulse.busy ? <ActivityIndicator size="small" color={colors.green} style={{ marginRight: 8 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
              {pulse.badge.toUpperCase()}
            </Text>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 }}>{pulse.title}</Text>
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {pulse.body}
            </Text>
          </View>
          {pulse.cta ? (
            <Pressable onPress={() => setOpenStacks((prev) => (prev.includes('new') ? prev : [...prev, 'new']))}>
              <Text style={{ color: colors.green, fontWeight: '700', fontSize: 12 }}>{pulse.cta}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      >
        {renderAccountSection()}
        {renderPushRow()}

        {portal?.pendingCheckback && canInteract ? (
          <ProfileCardShell isDark={isDark} style={{ marginBottom: 12, borderWidth: 1, borderColor: colors.gold }}>
            <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>
              WYMAGA TWOJEJ ODPOWIEDZI
            </Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17, marginTop: 8 }}>
              {portal.pendingCheckback.body}
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {portal.pendingCheckback.options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => answerCheckback(option.id)}
                  style={[styles.choiceBtn, { borderColor: colors.gold }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </ProfileCardShell>
        ) : null}

        <View style={styles.pillRow}>
          {[
            ['Nowe', stacks.new.length, colors.green],
            ['Oglądać', stacks.like.length, colors.green],
            ['Może', stacks.maybe.length, '#FF9500'],
            ['Nie', stacks.dislike.length, '#FF3B30'],
          ].map(([label, value, tone]) => (
            <View key={String(label)} style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: String(tone), fontWeight: '800', fontSize: 16 }}>{value}</Text>
              <Text style={{ color: colors.secondary, fontSize: 11 }}>{label}</Text>
            </View>
          ))}
        </View>

        {visibleStacks.length === 0 ? (
          <ProfileCardShell isDark={isDark} faceStyle={{ padding: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Brak ofert w panelu</Text>
            <Text style={{ color: colors.secondary, marginTop: 6 }}>
              Gdy agent wyśle propozycję, pojawi się tutaj — dostaniesz powiadomienie.
            </Text>
          </ProfileCardShell>
        ) : null}

        {visibleStacks.map((stack) => {
          const items = stacks[stack.id];
          const open = openStacks.includes(stack.id);
          return (
            <ProfileCardShell key={stack.id} isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              <Pressable onPress={() => toggleStack(stack.id)} style={styles.stackHead}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                    {stack.title} · {items.length}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 2 }}>{stack.hint}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.secondary} />
              </Pressable>

              {open
                ? items.map((match, index) => {
                    const expanded = openMatchIds.includes(match.id);
                    const phrases = stack.id === 'new' ? [...LIKE_PHRASES, ...DISLIKE_PHRASES] : [];
                    const selected = pendingPhrases[match.id] || [];
                    const isLast = index === items.length - 1;
                    return (
                      <View
                        key={match.id}
                        style={[
                          styles.matchRow,
                          !isLast ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
                        ]}
                      >
                        <Pressable onPress={() => toggleMatch(match.id)} style={styles.matchHead}>
                          {match.offer.imageUrl ? (
                            <Image source={{ uri: match.offer.imageUrl }} style={styles.thumb} />
                          ) : (
                            <View style={[styles.thumb, { backgroundColor: colors.border }]} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={2}>
                              {match.offer.title}
                            </Text>
                            <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 2 }}>
                              {[match.offer.city, match.offer.district].filter(Boolean).join(' · ')}
                            </Text>
                            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 4 }}>
                              {formatCurrencyPLN(match.offer.price)}
                              {match.score ? ` · ${match.score}%` : ''}
                            </Text>
                          </View>
                          <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.secondary}
                          />
                        </Pressable>

                        {expanded ? (
                          <View style={{ marginTop: 12 }}>
                            {match.clientWhy ? (
                              <Text style={{ color: colors.secondary, marginBottom: 8, fontSize: 13 }}>
                                {match.clientWhy}
                              </Text>
                            ) : null}
                            <Pressable
                              onPress={() =>
                                navigation.navigate('OfferDetail', {
                                  offer: { id: match.offer.id },
                                  id: match.offer.id,
                                  offerId: match.offer.id,
                                })
                              }
                              style={{ marginBottom: 10 }}
                            >
                              <Text style={{ color: colors.green, fontWeight: '700' }}>Zobacz ogłoszenie</Text>
                            </Pressable>
                            {stack.id === 'new' && canInteract ? (
                              <>
                                <View style={styles.phraseWrap}>
                                  {phrases.map((phrase) => {
                                    const on = selected.includes(phrase);
                                    return (
                                      <Pressable
                                        key={phrase}
                                        onPress={() =>
                                          setPendingPhrases((prev) => {
                                            const current = prev[match.id] || [];
                                            const next = on
                                              ? current.filter((p) => p !== phrase)
                                              : [...current, phrase];
                                            return { ...prev, [match.id]: next };
                                          })
                                        }
                                        style={[
                                          styles.phraseChip,
                                          {
                                            borderColor: on ? colors.green : colors.border,
                                            backgroundColor: on ? colors.tint : 'transparent',
                                          },
                                        ]}
                                      >
                                        <Text style={{ color: colors.text, fontSize: 12 }}>{phrase}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                                <View style={styles.rateRow}>
                                  <Pressable
                                    onPress={() => rateMatch(match, 'like')}
                                    style={[styles.rateBtn, { backgroundColor: colors.green }]}
                                  >
                                    <Text style={styles.rateBtnText}>Chcę oglądać</Text>
                                  </Pressable>
                                  <Pressable
                                    onPress={() => rateMatch(match, 'maybe')}
                                    style={[styles.rateBtn, { backgroundColor: '#FF9500' }]}
                                  >
                                    <Text style={styles.rateBtnText}>Może</Text>
                                  </Pressable>
                                  <Pressable
                                    onPress={() => rateMatch(match, 'dislike')}
                                    style={[styles.rateBtn, { backgroundColor: '#FF3B30' }]}
                                  >
                                    <Text style={styles.rateBtnText}>Nie</Text>
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
            </ProfileCardShell>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pulseBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  pushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  pill: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchRow: { paddingTop: 12, marginTop: 12 },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  choiceBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  phraseWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  phraseChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  rateRow: { flexDirection: 'row', gap: 8 },
  rateBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  rateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
});
