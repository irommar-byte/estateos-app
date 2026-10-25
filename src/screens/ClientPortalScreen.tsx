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
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { forgetPortalSession, rememberPortalSession } from '../lib/clientPortalSession';
import { useAppActiveInterval } from '../hooks/useAppActivePoll';
import {
  getClientPortalPushPermissionStatus,
  registerClientPortalPushAfterLink,
  registerClientPortalPushIfPossible,
} from '../hooks/usePushNotifications';
import {
  activatePortalAccount,
  fetchClientPortal,
  linkPortalAccount,
  submitPortalCheckback,
  submitPortalFeedback,
  type ClientPortalPayload,
  type PortalAccount,
  type PortalMatch,
} from '../services/clientPortalService';
import SellerPortalView from '../components/clientPortal/SellerPortalView';
import PortalScheduleCard from '../components/clientPortal/PortalScheduleCard';
import ClientPortalAgentReplyInbox from '../components/clientPortal/ClientPortalAgentReplyInbox';
import { collectAgentOfferReplies } from '../utils/clientPortalFeedback';
import { luxPalette, LUX_SERIF, plnFormat, sentimentOf } from '../components/clientPortal/lux/luxTheme';
import type { LuxMatch, LuxPortal } from '../components/clientPortal/lux/types';
import { luxAction } from '../components/clientPortal/lux/luxApi';
import LuxHeader from '../components/clientPortal/lux/LuxHeader';
import LuxAxis, { type LuxStage } from '../components/clientPortal/lux/LuxAxis';
import LuxTools, { type LuxTool } from '../components/clientPortal/lux/LuxTools';
import LuxOfferCard from '../components/clientPortal/lux/LuxOfferCard';
import LuxOfferSheet from '../components/clientPortal/lux/LuxOfferSheet';
import LuxCompareSheet from '../components/clientPortal/lux/LuxCompareSheet';
import LuxBookingSheet, { type BookingOffer } from '../components/clientPortal/lux/LuxBookingSheet';
import LuxPartnerSheet from '../components/clientPortal/lux/LuxPartnerSheet';
import LuxAreaSheet from '../components/clientPortal/lux/LuxAreaSheet';
import LuxCostSheet from '../components/clientPortal/lux/LuxCostSheet';
import LuxDocuments from '../components/clientPortal/lux/LuxDocuments';
import { LuxReferral, LuxReview } from '../components/clientPortal/lux/LuxReviewReferral';
import { LuxBuyerOffers, LuxCompetition, LuxNetSheet, LuxSellerStats, LuxShowingFeedback } from '../components/clientPortal/lux/LuxSeller';
import { LuxButton, LuxCard, LuxChip, LuxKicker } from '../components/clientPortal/lux/LuxUI';

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
  const [activateEmail, setActivateEmail] = useState('');
  const [activatePhoneSuffix, setActivatePhoneSuffix] = useState('');
  const [activatePassword, setActivatePassword] = useState('');
  const [activating, setActivating] = useState(false);
  const establishSession = useAuthStore((s) => s.establishSession);
  const silent = useRef(false);
  const stacksInitialized = useRef(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const autoLinkAttempted = useRef(false);
  const loadSeq = useRef(0);
  const linkInFlight = useRef(false);

  // ── Panel „lux” (jak na www) ──
  const [sheetMatchId, setSheetMatchId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingOfferId, setBookingOfferId] = useState<number | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);
  const [offerFilter, setOfferFilter] = useState<'all' | 'new' | 'fav' | 'like' | 'maybe' | 'dislike'>('all');
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionY = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!portalToken) return;
    void AsyncStorage.getItem(`eos-compare:${portalToken}`)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setCompareIds(parsed.map(Number).filter(Number.isFinite).slice(0, 4));
      })
      .catch(() => null);
  }, [portalToken]);

  const toggleCompare = (matchId: number) => {
    setCompareIds((prev) => {
      const next = prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId].slice(-4);
      void AsyncStorage.setItem(`eos-compare:${portalToken}`, JSON.stringify(next)).catch(() => null);
      return next;
    });
  };


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
          void registerClientPortalPushIfPossible({ prompt: false, authToken });
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

  useEffect(() => {
    if (!portalToken || portal?.type !== 'BUYER') {
      setGuideOpen(false);
      return;
    }
    const key = `estateos_buyer_onboard_${portalToken.slice(-12)}`;
    void AsyncStorage.getItem(key).then((value) => setGuideOpen(value !== '1'));
  }, [portalToken, portal?.type]);

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
        await registerClientPortalPushAfterLink({
          prompt: options?.promptPush ?? false,
          authToken,
        });
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
      navigation.navigate('MainTabs', {
        screen: 'Profil',
        params: { authIntent: intent },
      });
    },
    [navigation],
  );

  const onActivatePortal = async () => {
    const email = activateEmail.trim().toLowerCase();
    const password = activatePassword;
    const activation = portal?.account?.activation;
    if (!email.includes('@')) {
      Alert.alert('Aktywacja', 'Podaj pełny adres e-mail od agenta.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Aktywacja', 'Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    if (activation?.available && activation.phoneSuffixRequired && activatePhoneSuffix.replace(/\D/g, '').length < 4) {
      Alert.alert('Aktywacja', 'Podaj ostatnie 4 cyfry telefonu podane agentowi.');
      return;
    }
    setActivating(true);
    try {
      const data = await activatePortalAccount(portalToken, {
        email,
        password,
        phoneSuffix: activatePhoneSuffix,
      });
      const ok = await establishSession(String(data.token), data.user, email);
      if (!ok) throw new Error('Nie udało się zapisać sesji.');
      patchAccountStatus('linked');
      await registerClientPortalPushAfterLink({
        prompt: true,
        authToken: String(data.token),
      });
      await refreshPushStatus();
      await load('silent');
    } catch (err: any) {
      Alert.alert('Aktywacja panelu', err?.message || 'Nie udało się aktywować panelu.');
    } finally {
      setActivating(false);
    }
  };

  const onLinkAccount = async () => {
    if (!authToken) {
      await onActivatePortal();
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

    const activation = account?.activation;
    if (activation && activation.available === false) {
      return (
        <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Brak e-maila w CRM</Text>
          <Text style={[styles.rowSub, { color: colors.secondary, marginTop: 4 }]}>
            Poproś agenta o uzupełnienie Twojego adresu e-mail — wtedy aktywujesz panel tutaj jednym krokiem.
          </Text>
        </ProfileCardShell>
      );
    }

    const phoneRequired = activation?.available && activation.phoneSuffixRequired;

    return (
      <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>Zapisz panel na swoim koncie</Text>
        <Text style={[styles.rowSub, { color: colors.secondary, marginTop: 4 }]}>
          {account?.emailMasked
            ? `Potwierdź, że to Ty — ten sam e-mail co w CRM (${account.emailMasked}), hasło (min. 6 znaków)${phoneRequired ? ' i ostatnie 4 cyfry telefonu u agenta' : ''}. Konto założy się automatycznie.`
            : 'Podaj e-mail od agenta i ustaw hasło — konto założy się automatycznie.'}
        </Text>
        <TextInput
          value={activateEmail}
          onChangeText={setActivateEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={account?.emailMasked ? `E-mail (${account.emailMasked})` : 'E-mail od agenta'}
          placeholderTextColor={colors.secondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        />
        {phoneRequired ? (
          <TextInput
            value={activatePhoneSuffix}
            onChangeText={setActivatePhoneSuffix}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={activation.phoneSuffixLabel}
            placeholderTextColor={colors.secondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        ) : null}
        <TextInput
          value={activatePassword}
          onChangeText={setActivatePassword}
          secureTextEntry
          placeholder="Nowe hasło (min. 6 znaków)"
          placeholderTextColor={colors.secondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        />
        <Pressable
          onPress={onActivatePortal}
          disabled={activating}
          style={[styles.primaryBtn, { opacity: activating ? 0.6 : 1 }]}
        >
          <Text style={styles.primaryBtnText}>{activating ? 'Aktywuję…' : 'Aktywuj i zapisz panel'}</Text>
        </Pressable>
        <Pressable onPress={() => openPortalAuth('login')} style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>Masz już konto w apce? Zaloguj się w Profilu</Text>
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
          void registerClientPortalPushAfterLink({ prompt: true, authToken }).then(refreshPushStatus);
        }}
        style={[styles.pushRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Ionicons name="notifications-outline" size={18} color={colors.green} />
        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
          {pushPermission === 'denied'
            ? 'Włącz powiadomienia w ustawieniach iPhone'
            : portal?.type === 'SELLER'
              ? 'Włącz powiadomienia o działaniach agenta'
              : 'Włącz powiadomienia o nowych ofertach'}
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

  const lp = luxPalette(isDark);
  const lux = portal as unknown as LuxPortal | null;
  if (!lux) return null;

  const isPartner = lux.viewer?.role === 'partner';
  const partnerName = lux.viewer?.role === 'partner' ? lux.viewer.name : null;
  const agentFirst = (lux.agentName || '').split(' ')[0] || lux.agentName || 'Agent';
  const permissions = lux.permissions;
  const matches = lux.matches || [];
  const sheetMatch = matches.find((m) => m.id === sheetMatchId) || null;
  const compareMatches = compareIds.map((id) => matches.find((m) => m.id === id)).filter(Boolean) as LuxMatch[];
  const ratedCount = matches.filter((m) => sentimentOf(m.clientFeedback)).length;
  const favoriteCount = matches.filter((m) => m.favorite).length;
  const likedOffers: BookingOffer[] = matches
    .filter((m) => sentimentOf(m.clientFeedback) === 'like' || m.favorite)
    .map((m) => ({ offerId: m.offer.id, title: m.offer.title }));
  const bookingOffers: BookingOffer[] = likedOffers.length ? likedOffers : matches.map((m) => ({ offerId: m.offer.id, title: m.offer.title }));
  const presentationPendingFuture =
    lux.presentation?.status === 'pending' && new Date(lux.presentation.startsAt).getTime() > Date.now();
  const canSelfBook = lux.type === 'BUYER' && !isPartner && permissions?.selfBooking !== false && matches.length > 0 && !presentationPendingFuture;
  const seller = lux.seller || null;
  const listPrice = Number(lux.listing?.price || 0);
  const openBuyerOffers = seller?.buyerOffers.filter((o) => o.status === 'OPEN') || [];
  const favoritePrice = Number(matches.find((m) => m.favorite)?.offer.price || matches[0]?.offer.price || 0);
  const documents = lux.documents || [];
  const criteria = lux.searchCriteria || null;
  const unreadReplies = collectAgentOfferReplies(portal?.matches || []).filter((r: { unread?: boolean }) => r.unread).length;

  const scrollTo = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  const onSection = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const silentReload = () => void load('silent');

  const toggleFavorite = async (match: LuxMatch) => {
    try {
      await luxAction(portalToken, 'toggle_favorite', { matchId: match.id, favorite: !match.favorite });
      silentReload();
    } catch (e) {
      Alert.alert('Ulubione', e instanceof Error ? e.message : 'Nie udało się.');
    }
  };

  const rateFromSheet = async (match: LuxMatch, sentiment: 'like' | 'maybe' | 'dislike', note: string) => {
    try {
      if (isPartner) {
        await luxAction(portalToken, 'partner_feedback', { matchId: match.id, sentiment, note });
      } else {
        let prev: { liked?: string; disliked?: string; phrases?: string[]; note?: string } = {};
        try {
          prev = match.clientFeedback ? JSON.parse(match.clientFeedback) : {};
        } catch {
          prev = {};
        }
        await luxAction(portalToken, 'submit_feedback', {
          matchId: match.id,
          sentiment,
          liked: String(prev.liked || ''),
          disliked: String(prev.disliked || ''),
          phrases: Array.isArray(prev.phrases) ? prev.phrases.map(String) : [],
          note: note || String(prev.note || ''),
        });
      }
      await load('silent');
    } catch (e) {
      Alert.alert('Ocena', e instanceof Error ? e.message : 'Nie udało się zapisać oceny.');
    }
  };

  const openListing = (offerId: number) =>
    navigation.navigate('OfferDetail', { offer: { id: offerId }, id: offerId, offerId });

  const presentationCard = lux.presentation ? (
    <PortalScheduleCard
      portalToken={portalToken}
      kind="presentation"
      slot={lux.presentation}
      role={lux.type}
      canInteract={canInteract && !isPartner}
      isDark={isDark}
      colors={colors}
      onDone={silentReload}
    />
  ) : null;

  const checkbackCard =
    lux.pendingCheckback && canInteract && !isPartner ? (
      <LuxCard palette={lp} style={{ borderColor: lp.accent, borderWidth: 1 }}>
        <LuxKicker palette={lp}>Pytanie od {agentFirst}</LuxKicker>
        <Text style={{ color: lp.ink, fontWeight: '700', fontSize: 17, marginTop: 8, lineHeight: 23 }}>{lux.pendingCheckback.body}</Text>
        <View style={{ marginTop: 12, gap: 8 }}>
          {lux.pendingCheckback.options.map((option) => (
            <LuxButton key={option.id} palette={lp} variant="ghost" label={option.label} onPress={() => void answerCheckback(option.id)} />
          ))}
        </View>
      </LuxCard>
    ) : null;

  const bookingCta = canSelfBook ? (
    <LuxButton
      palette={lp}
      label={`Wybierz termin z kalendarza ${agentFirst}`}
      onPress={() => {
        setBookingOfferId(null);
        setBookingOpen(true);
      }}
      icon={<Ionicons name="calendar" size={16} color={isDark ? '#000' : '#D8C3A0'} />}
    />
  ) : null;

  const documentsCard =
    permissions?.documents !== false && documents.length ? (
      <View onLayout={onSection('documents')}>
        <LuxDocuments
          token={portalToken}
          documents={documents}
          summary={lux.documentsSummary}
          palette={lp}
          agentFirst={agentFirst}
          canUpload={!isPartner && canInteract}
          onChanged={silentReload}
        />
      </View>
    ) : null;

  // ── Oś kupującego ──
  const phase = lux.purchase?.phase;
  const buyerStageIndex =
    phase === 'closed' ? 6 : phase === 'negotiating' ? 3 : lux.presentation || likedOffers.length ? 2 : matches.length || criteria ? 1 : 0;
  const stateFor = (i: number, current: number): LuxStage['state'] => (i < current ? 'done' : i === current ? 'current' : 'future');
  const link = (label: string, onPress: () => void) => (
    <Text onPress={onPress} style={{ color: lp.accent, fontWeight: '800' }}>
      {label}
    </Text>
  );
  const buyerStages: LuxStage[] = [
    {
      id: 'criteria',
      label: 'Kryteria',
      state: stateFor(0, buyerStageIndex),
      summary: (
        <Text style={{ fontSize: 13, color: lp.muted, lineHeight: 18 }}>
          {criteria
            ? [criteria.location, criteria.maxBudget ? `do ${criteria.maxBudget}` : null, criteria.minRooms ? `od ${criteria.minRooms} pok.` : null].filter(Boolean).join(' · ')
            : `${agentFirst} ustala z Tobą, czego szukamy.`}
          {!isPartner && criteria ? ' · ' : ''}
          {!isPartner && criteria ? link(lux.searchPolygon ? 'obszar na mapie ✓' : 'narysuj obszar', () => setAreaOpen(true)) : null}
        </Text>
      ),
    },
    {
      id: 'proposals',
      label: matches.length ? `Propozycje · ${ratedCount} ${ratedCount === 1 ? 'oceniona' : 'ocenionych'}` : 'Propozycje',
      state: stateFor(1, buyerStageIndex),
      summary: matches.length ? (
        <Text style={{ fontSize: 13, color: lp.muted }}>
          {favoriteCount ? `${favoriteCount} ulubionych · ` : ''}
          {link('zobacz wszystkie', () => scrollTo('offers'))}
          {compareIds.length >= 2 ? ' · ' : ''}
          {compareIds.length >= 2 ? link('porównaj', () => setCompareOpen(true)) : null}
        </Text>
      ) : (
        'Pierwsze propozycje pojawią się tutaj — dostaniesz powiadomienie.'
      ),
      content: checkbackCard,
    },
    {
      id: 'viewings',
      label: 'Oglądania',
      state: stateFor(2, buyerStageIndex),
      summary: lux.presentation
        ? `${new Date(lux.presentation.startsAt).getTime() < Date.now() ? 'Ostatnie' : 'Najbliższe'}: ${new Date(lux.presentation.startsAt).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
        : 'Gdy coś się spodoba — umówimy oglądanie.',
      content:
        presentationCard || bookingCta ? (
          <>
            {presentationCard}
            {bookingCta}
          </>
        ) : undefined,
    },
    {
      id: 'offer',
      label: 'Oferta i negocjacje',
      state: stateFor(3, buyerStageIndex),
      summary: lux.purchase && lux.purchase.phase !== 'viewed' ? `${lux.purchase.title} · ${lux.purchase.statusLabel}` : 'Propozycja ceny, odpowiedź sprzedającego, warunki.',
      content: lux.purchase ? (
        <LuxCard palette={lp} style={{ marginBottom: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: lp.ink }}>{lux.purchase.title}</Text>
          {lux.purchase.address ? <Text style={{ fontSize: 13, color: lp.muted, marginTop: 2 }}>{lux.purchase.address}</Text> : null}
          <Text style={{ fontFamily: LUX_SERIF, fontSize: 24, color: lp.ink, marginTop: 8 }}>{lux.purchase.price ? plnFormat(lux.purchase.price) : 'Cena do uzgodnienia'}</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: lp.accent, marginTop: 4 }}>{lux.purchase.statusLabel}</Text>
        </LuxCard>
      ) : undefined,
    },
    {
      id: 'contract',
      label: 'Umowa, kredyt, notariusz',
      state: stateFor(4, buyerStageIndex),
      summary: lux.documentsSummary?.required
        ? `Dokumenty: ${lux.documentsSummary.done} z ${lux.documentsSummary.required}`
        : 'Lista dokumentów i terminy w jednym miejscu.',
      content: buyerStageIndex < 3 ? documentsCard || undefined : undefined,
    },
    {
      id: 'keys',
      label: 'Klucze',
      state: phase === 'closed' ? 'done' : stateFor(5, buyerStageIndex),
      summary: phase === 'closed' ? 'Gratulacje — nieruchomość jest Twoja.' : 'Protokół przekazania i stany liczników.',
    },
  ];

  // ── Oś sprzedającego ──
  const signed = lux.acquisition?.status === 'SIGNED';
  const listingStatus = String(lux.listing?.status || '').toUpperCase();
  const listingLive = listingStatus === 'ACTIVE' || listingStatus === 'PUBLISHED';
  const listingSold = ['SOLD', 'ARCHIVED'].includes(listingStatus);
  const accepted = seller?.buyerOffers.find((o) => o.status === 'ACCEPTED' || o.clientResponse === 'accept') || null;
  const sellerDone = [signed, Boolean(lux.listing), listingLive || listingSold, Boolean(accepted) || listingSold, listingSold, listingSold, listingSold];
  const firstOpen = sellerDone.findIndex((d) => !d);
  const sellerCurrent = firstOpen === -1 ? 7 : firstOpen;
  const sellerStages: LuxStage[] = [
    { id: 'agreement', label: 'Umowa i wycena', state: stateFor(0, sellerCurrent), summary: signed ? 'Umowa podpisana' : `${agentFirst} przygotowuje umowę.` },
    { id: 'prep', label: 'Przygotowanie', state: stateFor(1, sellerCurrent), summary: lux.listing ? 'Zdjęcia, rzut i opis gotowe.' : 'Sesja zdjęciowa, rzut i opis.' },
    {
      id: 'publish',
      label: 'Publikacja',
      state: stateFor(2, sellerCurrent),
      summary: listingLive ? `Aktywne${lux.activeChannels?.length ? ` na ${lux.activeChannels.length + 1} portalach` : ''}` : lux.listing?.statusLabel || 'Ogłoszenie trafi na portale po akceptacji.',
    },
    {
      id: 'viewings',
      label: 'Oglądania i oferty',
      state: stateFor(3, sellerCurrent),
      summary: seller?.stats
        ? `${seller.stats.showings} ${seller.stats.showings === 1 ? 'oglądanie' : 'oglądań'} · ${openBuyerOffers.length} ${openBuyerOffers.length === 1 ? 'oferta' : 'ofert'} do decyzji`
        : 'Pokazy i oferty kupujących.',
      content: openBuyerOffers.length ? (
        <LuxButton palette={lp} label={`Zobacz oferty kupujących (${openBuyerOffers.length})`} onPress={() => scrollTo('buyerOffers')} />
      ) : undefined,
    },
    {
      id: 'preliminary',
      label: 'Umowa przedwstępna',
      state: stateFor(4, sellerCurrent),
      summary: accepted ? `Przyjęta oferta: ${accepted.buyerLabel} · ${plnFormat(accepted.amount)}` : 'Zadatek, terminy, warunki kredytu kupującego.',
    },
    {
      id: 'deed',
      label: 'Akt notarialny',
      state: stateFor(5, sellerCurrent),
      summary: lux.documentsSummary?.required ? `Dokumenty: ${lux.documentsSummary.done} z ${lux.documentsSummary.required}` : 'Dokumenty do sprzedaży i termin u notariusza.',
      content: documentsCard ? <LuxButton palette={lp} variant="ghost" label="Lista dokumentów" onPress={() => scrollTo('documents')} /> : undefined,
    },
    { id: 'handover', label: 'Przekazanie mieszkania', state: stateFor(6, sellerCurrent), summary: 'Protokół, liczniki, klucze.' },
  ];

  const stages = lux.type === 'BUYER' ? buyerStages : sellerStages;
  const current = stages.find((s) => s.state === 'current');
  const doneCount = stages.filter((s) => s.state === 'done').length;
  const headline =
    lux.type === 'BUYER'
      ? ({ criteria: 'Ustalamy, czego szukamy.', proposals: matches.length ? 'Wybieramy najlepsze propozycje.' : 'Szukamy dla Ciebie.', viewings: 'Jesteśmy na etapie oglądań.', offer: 'Negocjujemy warunki.', contract: 'Dopinamy formalności.', keys: 'Klucze są Twoje.' } as Record<string, string>)[current?.id || 'keys']
      : ({ agreement: 'Zaczynamy współpracę.', prep: 'Przygotowujemy ogłoszenie.', publish: 'Ogłoszenie trafia na rynek.', viewings: 'Sprzedaż trwa.', preliminary: 'Mamy kupującego.', deed: 'Przed aktem notarialnym.', handover: 'Przekazanie mieszkania.' } as Record<string, string>)[current?.id || 'handover'] || 'Sprzedane.';
  const finished = lux.type === 'BUYER' ? phase === 'closed' : listingSold;

  const filters: Array<[typeof offerFilter, string, number]> = [
    ['all', 'Wszystkie', matches.length],
    ['new', 'Do oceny', matches.filter((m) => !sentimentOf(m.clientFeedback)).length],
    ['fav', 'Ulubione', favoriteCount],
    ['like', 'Chcę obejrzeć', matches.filter((m) => sentimentOf(m.clientFeedback) === 'like').length],
    ['maybe', 'Może', matches.filter((m) => sentimentOf(m.clientFeedback) === 'maybe').length],
    ['dislike', 'Nie pasuje', matches.filter((m) => sentimentOf(m.clientFeedback) === 'dislike').length],
  ];
  const visibleMatches = matches.filter((m) => {
    const s = sentimentOf(m.clientFeedback);
    if (offerFilter === 'all') return s !== 'dislike';
    if (offerFilter === 'new') return !s;
    if (offerFilter === 'fav') return Boolean(m.favorite);
    return s === offerFilter;
  });

  const docsTool: LuxTool[] =
    documents.length && !isPartner
      ? [{ key: 'docs', title: 'Dokumenty', description: lux.documentsSummary?.missing ? `Brakuje ${lux.documentsSummary.missing}` : 'Komplet', icon: 'document-text-outline', onPress: () => scrollTo('documents'), badge: lux.documentsSummary?.missing ? String(lux.documentsSummary.missing) : undefined }]
      : [];
  const chatTool: LuxTool = { key: 'chat', title: 'Rozmowa', description: `Napisz do ${agentFirst}`, icon: 'chatbubble-ellipses-outline', onPress: openChat };
  const buyerTools: LuxTool[] = [
    {
      key: 'compare',
      title: 'Porównanie',
      description: compareIds.length ? `${compareIds.length} ${compareIds.length === 1 ? 'oferta' : 'oferty'} obok siebie` : 'Zaznacz „Porównaj” przy ofertach',
      icon: 'git-compare-outline',
      onPress: () => (compareIds.length >= 2 ? setCompareOpen(true) : scrollTo('offers')),
      badge: compareIds.length ? String(compareIds.length) : undefined,
    },
    ...(!isPartner && criteria
      ? [{ key: 'area', title: 'Moje kryteria', description: lux.searchPolygon ? 'Obszar na mapie zapisany' : 'Narysuj obszar na mapie', icon: 'map-outline' as const, onPress: () => setAreaOpen(true) }]
      : []),
    ...(canSelfBook
      ? [{ key: 'booking', title: 'Umów oglądanie', description: `Wolne terminy ${agentFirst}`, icon: 'calendar-outline' as const, onPress: () => { setBookingOfferId(null); setBookingOpen(true); } }]
      : []),
    { key: 'calc', title: 'Rata i koszty', description: 'Kredyt, podatek, notariusz, prowizja', icon: 'calculator-outline', onPress: () => setCalcOpen(true) },
    ...(!isPartner && permissions?.partnerAccess !== false
      ? [{ key: 'partner', title: 'Druga osoba', description: lux.companions?.length ? `${lux.companions.map((c) => c.name).join(', ')} ma dostęp` : 'Wybierajcie razem', icon: 'people-outline' as const, onPress: () => setPartnerOpen(true) }]
      : []),
    ...docsTool,
    chatTool,
  ];
  const sellerTools: LuxTool[] = [
    ...(seller ? [{ key: 'net', title: 'Ile na rękę', description: 'Po prowizji, podatku i kredycie', icon: 'calculator-outline' as const, onPress: () => setNetOpen(true) }] : []),
    ...(openBuyerOffers.length ? [{ key: 'offers', title: 'Oferty kupujących', description: `${openBuyerOffers.length} do decyzji`, icon: 'cash-outline' as const, onPress: () => scrollTo('buyerOffers'), badge: String(openBuyerOffers.length) }] : []),
    ...(lux.listing?.id ? [{ key: 'listing', title: 'Ogłoszenie', description: 'Zobacz, co widzą kupujący', icon: 'home-outline' as const, onPress: () => openListing(Number(lux.listing?.id)) }] : []),
    ...docsTool,
    chatTool,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: lp.bg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + (compareIds.length ? 96 : 40) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={lp.accent} />}
      >
        <LuxHeader
          insetsTop={insets.top}
          onBack={() => navigation.goBack()}
          greeting={lux.greeting || `Dzień dobry, ${lux.clientFirstName || lux.clientName}`}
          headline={headline}
          done={doneCount}
          total={stages.length}
          agencyName={lux.agencyName}
          agencyLogo={lux.agencyLogo}
          agentName={lux.agentName}
          agentPhoto={lux.agentPhoto}
          agentTitle={lux.agentTitle}
          agentPhone={lux.agentPhone || lux.agencyPhone || null}
          partnerName={partnerName}
          onChat={openChat}
          unread={unreadReplies}
        >
          {lux.type === 'SELLER' ? (
            <>
              {lux.listing ? (
                <Pressable onPress={() => openListing(Number(lux.listing?.id))} style={styles.luxListing}>
                  {lux.listing.imageUrl ? <Image source={{ uri: lux.listing.imageUrl }} style={{ width: 76, height: 76, borderRadius: 14 }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F6F3EE', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                      {lux.listing.title}
                    </Text>
                    <Text style={{ fontFamily: LUX_SERIF, color: '#F6F3EE', fontSize: 20, marginTop: 2 }}>{lux.listing.price ? plnFormat(lux.listing.price) : 'Cena na zapytanie'}</Text>
                    <Text style={{ color: '#BDB6AA', fontSize: 12, marginTop: 2 }}>{lux.listing.statusLabel || ''}</Text>
                  </View>
                </Pressable>
              ) : null}
              {seller ? <LuxSellerStats stats={seller.stats} /> : null}
            </>
          ) : null}
        </LuxHeader>

        <View style={{ padding: 16, paddingTop: 20 }}>
          {renderAccountSection()}
          {renderPushRow()}

          <LuxAxis title={lux.type === 'BUYER' ? 'Droga do kluczy' : 'Droga do aktu'} stages={stages} palette={lp} />

          {lux.type === 'BUYER' && !isPartner ? (
            <ClientPortalAgentReplyInbox
              portalToken={portalToken}
              replies={collectAgentOfferReplies(portal?.matches || [])}
              canInteract={canInteract}
              colors={colors}
              onOpenOffer={(matchId) => setSheetMatchId(matchId)}
              onDone={silentReload}
            />
          ) : null}

          {lux.type === 'BUYER' && buyerStageIndex !== 1 ? checkbackCard : null}

          {lux.type === 'SELLER' && seller ? (
            <View onLayout={onSection('buyerOffers')}>
              <LuxBuyerOffers seller={seller} listPrice={listPrice} token={portalToken} palette={lp} agentFirst={agentFirst} onChanged={silentReload} />
            </View>
          ) : null}

          {lux.type === 'BUYER' ? (
            <View onLayout={onSection('offers')} style={{ marginTop: 8 }}>
              <LuxKicker palette={lp}>Propozycje</LuxKicker>
              <Text style={{ fontFamily: LUX_SERIF, fontSize: 26, color: lp.ink, marginTop: 4 }}>
                {matches.length ? `${matches.length} ${matches.length === 1 ? 'oferta' : 'ofert'} dla Ciebie` : 'Szukamy dla Ciebie'}
              </Text>
              {matches.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
                  {filters
                    .filter(([id, , count]) => id === 'all' || count > 0)
                    .map(([id, label, count]) => (
                      <LuxChip key={id} palette={lp} label={`${label} · ${count}`} on={offerFilter === id} onPress={() => setOfferFilter(id)} />
                    ))}
                </ScrollView>
              ) : (
                <Text style={{ fontSize: 14, color: lp.muted, marginTop: 8, marginBottom: 14, lineHeight: 20 }}>
                  {agentFirst} wybiera oferty pod Twoje kryteria. Pierwsza pojawi się tutaj — dostaniesz powiadomienie.
                </Text>
              )}
              {visibleMatches.map((m) => (
                <LuxOfferCard
                  key={m.id}
                  match={m}
                  palette={lp}
                  inCompare={compareIds.includes(m.id)}
                  onOpen={() => setSheetMatchId(m.id)}
                  onToggleFavorite={() => void toggleFavorite(m)}
                  onToggleCompare={() => toggleCompare(m.id)}
                  canFavorite={!isPartner && canInteract}
                />
              ))}
            </View>
          ) : null}

          {lux.type === 'BUYER' ? (buyerStageIndex >= 3 ? documentsCard : null) : documentsCard}

          {lux.type === 'SELLER' && seller ? (
            <>
              <LuxShowingFeedback seller={seller} palette={lp} agentFirst={agentFirst} recommendation={lux.sellerNextStep?.clientMessage || null} />
              <LuxCompetition seller={seller} palette={lp} />
            </>
          ) : null}

          <LuxTools kicker="Narzędzia" title={lux.type === 'BUYER' ? 'Żeby wybrać pewnie' : 'Wszystko o sprzedaży'} tools={lux.type === 'BUYER' ? buyerTools : sellerTools} palette={lp} />

          {lux.type === 'SELLER' && portal ? (
            <View style={{ marginBottom: 6 }}>
              <LuxKicker palette={lp}>Szczegóły sprzedaży</LuxKicker>
              <View style={{ height: 10 }} />
              <SellerPortalView
                portal={portal}
                portalToken={portalToken}
                isDark={isDark}
                colors={colors}
                insetsTop={0}
                refreshing={false}
                onRefresh={silentReload}
                onOpenChat={openChat}
                canChat={canChat}
                canInteract={canInteract && !isPartner}
                accountSection={null}
                pushSection={null}
                onBack={() => navigation.goBack()}
                embedded
              />
            </View>
          ) : null}

          {finished && !isPartner ? (
            <LuxReview token={portalToken} palette={lp} agentFirst={agentFirst} review={lux.review} reviewLink={lux.reviewLink} onChanged={silentReload} />
          ) : null}
          <LuxReferral token={portalToken} palette={lp} agentFirst={agentFirst} />

          <Pressable onPress={openChat} style={[styles.luxChat, { backgroundColor: isDark ? '#161617' : '#000' }]}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#D8C3A0" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F6F3EE', fontSize: 16, fontWeight: '800' }}>Masz pytanie? Napisz</Text>
              <Text style={{ color: '#8C877D', fontSize: 13, marginTop: 2 }}>{agentFirst} odpowie tutaj — dostaniesz powiadomienie.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8C877D" />
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 18, marginTop: 26 }}>
            {!user ? (
              <Pressable onPress={() => openPortalAuth('login')} hitSlop={8}>
                <Text style={{ color: lp.accent, fontSize: 13, fontWeight: '700' }}>Zaloguj się jako agent</Text>
              </Pressable>
            ) : null}
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert(
                  'Wyjść z panelu na tym telefonie?',
                  'Aplikacja przestanie otwierać ten panel przy starcie. Wrócisz do niego linkiem od agenta albo kodem.',
                  [
                    { text: 'Anuluj', style: 'cancel' },
                    {
                      text: 'Wyjdź',
                      style: 'destructive',
                      onPress: () => {
                        void forgetPortalSession(portalToken).then(() => {
                          navigation.navigate('MainTabs', { screen: 'Profil' });
                        });
                      },
                    },
                  ],
                )
              }
            >
              <Text style={{ color: lp.muted, fontSize: 13, fontWeight: '700' }}>Wyjdź z panelu</Text>
            </Pressable>
          </View>

          <Text style={{ textAlign: 'center', color: lp.muted, fontSize: 12, marginTop: 14 }}>
            {lux.agencyName} · panel klienta EstateOS{isPartner ? ' · widok drugiej osoby' : ''}
          </Text>
        </View>
      </ScrollView>

      {lux.type === 'BUYER' && compareIds.length ? (
        <View style={[styles.compareBar, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
          <Pressable onPress={() => (compareIds.length >= 2 ? setCompareOpen(true) : scrollTo('offers'))} style={styles.compareBtn}>
            <Ionicons name="git-compare" size={16} color="#D8C3A0" />
            <Text style={{ color: '#D8C3A0', fontWeight: '800', fontSize: 14 }}>
              {compareIds.length >= 2 ? `Porównaj ${compareIds.length} oferty` : 'Wybierz jeszcze jedną do porównania'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {sheetMatch ? (
        <LuxOfferSheet
          match={sheetMatch}
          palette={lp}
          onClose={() => setSheetMatchId(null)}
          isPartner={isPartner}
          inCompare={compareIds.includes(sheetMatch.id)}
          onToggleCompare={() => toggleCompare(sheetMatch.id)}
          onToggleFavorite={() => void toggleFavorite(sheetMatch)}
          onRate={(s, note) => rateFromSheet(sheetMatch, s, note)}
          onBook={() => {
            setBookingOfferId(sheetMatch.offer.id);
            setSheetMatchId(null);
            setTimeout(() => setBookingOpen(true), 350);
          }}
          canBook={canSelfBook}
          onOpenListing={() => {
            const id = sheetMatch.offer.id;
            setSheetMatchId(null);
            setTimeout(() => openListing(id), 300);
          }}
        />
      ) : null}
      <LuxCompareSheet
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        matches={compareMatches}
        palette={lp}
        onOpenOffer={(m) => {
          setCompareOpen(false);
          setTimeout(() => setSheetMatchId(m.id), 350);
        }}
        onRemove={toggleCompare}
      />
      <LuxPartnerSheet open={partnerOpen} onClose={() => setPartnerOpen(false)} token={portalToken} companions={lux.companions || []} palette={lp} onChanged={silentReload} />
      <LuxBookingSheet
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        token={portalToken}
        offers={bookingOffers}
        initialOfferId={bookingOfferId}
        agentName={agentFirst}
        palette={lp}
        onBooked={silentReload}
      />
      <LuxAreaSheet
        open={areaOpen}
        onClose={() => setAreaOpen(false)}
        token={portalToken}
        initial={lux.searchPolygon || null}
        criteriaEditAllowed={Boolean(permissions?.criteriaEdit)}
        agentName={agentFirst}
        palette={lp}
        onSaved={silentReload}
      />
      <LuxCostSheet open={calcOpen} onClose={() => setCalcOpen(false)} initialPrice={favoritePrice} palette={lp} />
      {seller ? (
        <LuxNetSheet open={netOpen} onClose={() => setNetOpen(false)} seller={seller} defaultPrice={listPrice} token={portalToken} palette={lp} onSaved={silentReload} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  luxListing: { flexDirection: 'row', gap: 12, marginTop: 16, padding: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(216,195,160,0.18)' },
  luxChat: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, marginTop: 4 },
  compareBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  compareBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#000', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
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
  input: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
