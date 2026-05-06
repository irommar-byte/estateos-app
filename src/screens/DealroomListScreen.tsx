import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  StyleSheet, View, Text, ScrollView as RNScrollView, Pressable, Platform, 
  ActivityIndicator, Modal, Appearance, Image, Alert,
  type ColorSchemeName,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, Swipeable, RectButton } from 'react-native-gesture-handler';
import Animated, { 
  FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, 
  withRepeat, withSequence, withTiming, withDelay, withSpring, Easing 
} from 'react-native-reanimated';
import { 
  ChevronRight, ChevronLeft, ChevronDown, MessageCircle, ShieldCheck, 
  AlertCircle, User, X, Star, ImageIcon, PlayCircle, Zap, CheckCircle2, Sparkles,
  Trash2, Pin, CalendarClock,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { API_URL } from '../config/network';
import { requestMobileDealDeletion } from '../utils/mobileDealDelete';
import { buildDealListActivityLine } from '../utils/dealListActivityLine';
import PresentationCountdown from '../components/dealroom/PresentationCountdown';
import { isFinalizedOwnerAcceptanceMessage } from '../contracts/parityContracts';
import EliteStatusBadges from '../components/EliteStatusBadges';

/** Kolejność ID na liście — pierwsze na górze sekcji (jak pinezka w Mail). */
const DEALROOM_PINS_STORAGE_KEY = '@EstateOS_dealroom_pins';

// === LUKSUSOWA PALETA DYNAMICZNA (CERAMIC & DARK GLASS) ===
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#000000' : '#F2F2F7', // Klasyczne iOS background
  card: isDark ? 'rgba(28, 28, 30, 0.65)' : 'rgba(255, 255, 255, 0.75)', // Półprzezroczyste dla BlurView
  cardSolid: isDark ? '#1C1C1E' : '#FFFFFF',
  cardPress: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(240, 240, 245, 0.9)',
  gold: isDark ? '#D4AF37' : '#B8860B',
  goldDimmed: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 134, 11, 0.1)',
  textMain: isDark ? '#FFFFFF' : '#000000',
  textSec: isDark ? '#EBEBF5' : '#3C3C43',
  textMuted: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  borderHighlight: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
  green: isDark ? '#32D74B' : '#34C759',
  greenDimmed: isDark ? 'rgba(50, 215, 75, 0.15)' : 'rgba(52, 199, 89, 0.15)',
  yellow: isDark ? '#FFD60A' : '#FF9500',
  yellowDimmed: isDark ? 'rgba(255, 214, 10, 0.15)' : 'rgba(255, 149, 0, 0.15)',
  purple: isDark ? '#BF5AF2' : '#5856D6',
  purpleDimmed: isDark ? 'rgba(191, 90, 242, 0.22)' : 'rgba(88, 86, 214, 0.18)',
  red: isDark ? '#FF453A' : '#FF3B30',
  shadow: isDark ? '#000000' : '#8A8A93',
  overlay: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)',
});

// === HELPERY ===
type DealPhase = 'started' | 'active' | 'finalized';

function tryParseDealEventPayload(content: string): Record<string, unknown> | null {
  const c = String(content || '');
  for (const prefix of ['[[DEAL_EVENT]]', '[[deal_event]]']) {
    if (!c.startsWith(prefix)) continue;
    try {
      const parsed = JSON.parse(c.slice(prefix.length));
      return parsed && typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      /* następny prefix */
    }
  }
  return null;
}

/** Klasyfikacja na podstawie treści wiadomości w wątku (spójnie z czatem dealroom). */
function classifyDealPhaseFromMessages(messages: any[]): DealPhase {
  for (const m of messages) {
    const body = String(m?.content ?? m?.text ?? '');
    if (isFinalizedOwnerAcceptanceMessage(body)) return 'finalized';
  }
  for (const m of messages) {
    const body = String(m?.content ?? m?.text ?? '');
    const ev = tryParseDealEventPayload(body);
    if (!ev) continue;
    const action = String(ev.action || '').toUpperCase();
    const entity = String(ev.entity || '').toUpperCase();
    if (action === 'ACCEPTED' && (entity === 'BID' || entity === 'APPOINTMENT')) return 'active';
  }
  return 'started';
}

/** Ostatni zaakceptowany termin prezentacji z wątku (wg daty wiadomości). */
function getAcceptedPresentationIso(messages: any[] | undefined): string | null {
  if (!messages?.length) return null;
  type Row = { iso: string; created: number };
  const rows: Row[] = [];
  for (const m of messages) {
    const ev = tryParseDealEventPayload(String(m?.content ?? ''));
    if (!ev) continue;
    if (String(ev.entity || '').toUpperCase() !== 'APPOINTMENT') continue;
    if (String(ev.action || '').toUpperCase() !== 'ACCEPTED') continue;
    const raw = ev.proposedDate;
    if (!raw) continue;
    const iso = String(raw);
    const created = new Date(m?.createdAt || 0).getTime();
    rows.push({ iso, created: Number.isFinite(created) ? created : 0 });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.created - a.created);
  return rows[0].iso;
}

function isFutureAcceptedPresentationDeal(dealId: number, dealMessagesById: Record<number, any[]>): boolean {
  const iso = getAcceptedPresentationIso(dealMessagesById[dealId]);
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Czy wątek czeka na decyzję użytkownika (ostatnia oferta/termin od drugiej strony). */
function needsReactionFromMessages(messages: any[] | undefined, myUserId: number): boolean {
  if (!messages?.length || !myUserId) return false;
  const sorted = [...messages].sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
  );
  for (const msg of sorted) {
    const ev = tryParseDealEventPayload(String(msg?.content ?? msg?.text ?? ''));
    if (!ev) continue;
    const entity = String(ev.entity || '').toUpperCase();
    if (entity !== 'BID' && entity !== 'APPOINTMENT') continue;
    const action = String(ev.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'DECLINED'].includes(action)) continue;
    const senderId = Number(msg?.senderId || 0);
    if (['PROPOSED', 'COUNTERED'].includes(action)) {
      return senderId > 0 && senderId !== myUserId;
    }
    return false;
  }
  return false;
}

const firstDefined = (...values: unknown[]) =>
  values.find((v) => v !== undefined && v !== null && v !== '');

const parseUserId = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseUserName = (value: unknown): string | null => {
  const s = String(value ?? '').trim();
  return s ? s : null;
};

/** Jak w miniaturkach ofert: jedna baza bez końcowego `/`, żeby uniknąć `//` i złych ścieżek. */
function normalizeMediaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^data:/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  const base = API_URL.replace(/\/+$/, '');
  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s.replace(/^\/+/, '')}`;
}

function extractPublicProfileAvatarUrl(profile: any): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const raw = firstDefined(
    profile.user?.image,
    profile.user?.avatar,
    profile.user?.avatarUrl,
    profile.user?.profilePhoto,
    profile.user?.profileImage,
    profile.user?.profileImageUrl,
    profile.user?.photoUrl,
    profile.user?.photoURL,
    profile.user?.photo,
    profile.user?.picture,
    profile.profile?.image,
    profile.profile?.avatar,
    profile.profile?.photoUrl,
    profile.metadata?.avatar,
    profile.metadata?.image,
    profile.image,
    profile.avatar,
    profile.avatarUrl,
    profile.profilePhoto,
    profile.picture,
    profile.photoUrl,
    profile.photoURL,
    profile.photo
  );
  if (typeof raw !== 'string' || !String(raw).trim()) return null;
  return normalizeMediaUrl(String(raw).trim());
}

function pickUserLikeByIdFromDeal(deal: any, uid: number): any {
  const n = Number(uid);
  if (!Number.isFinite(n) || n <= 0) return null;
  const idOf = (obj: any) => parseUserId(firstDefined(obj?.id, obj?.userId, obj?.user?.id));
  if (deal?.buyer && idOf(deal.buyer) === n) return deal.buyer;
  if (deal?.seller && idOf(deal.seller) === n) return deal.seller;
  if (Array.isArray(deal?.participants)) {
    const hit = deal.participants.find((p: any) => idOf(p) === n);
    if (hit) return hit;
  }
  for (const key of ['otherParty', 'counterparty', 'partner']) {
    const o = deal?.[key];
    if (o && idOf(o) === n) return o;
  }
  return null;
}

/** Fallback, gdy /public nie zwraca avatara — pola często są już na obiekcie deala z listy. */
function extractPartnerAvatarFromDeal(deal: any, partnerUserId: number | null): string | null {
  if (!deal || partnerUserId == null) return null;
  const uid = Number(partnerUserId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const node = pickUserLikeByIdFromDeal(deal, uid);
  const fromNode = firstDefined(
    node?.image,
    node?.avatar,
    node?.avatarUrl,
    node?.photoUrl,
    node?.photoURL,
    node?.photo,
    node?.picture,
    node?.profilePhoto,
    node?.profileImage,
    node?.user?.image,
    node?.user?.avatar,
    node?.user?.photoUrl
  );
  if (typeof fromNode === 'string' && fromNode.trim()) return normalizeMediaUrl(fromNode.trim());

  const buyerId = parseUserId(firstDefined(deal?.buyerId, deal?.buyer?.id));
  const sellerId = parseUserId(firstDefined(deal?.sellerId, deal?.seller?.id));

  if (uid === buyerId) {
    const r = firstDefined(
      deal?.buyerAvatar,
      deal?.buyerImage,
      deal?.buyerPhoto,
      deal?.buyer?.image,
      deal?.buyer?.avatar,
      deal?.buyer?.photoUrl
    );
    if (typeof r === 'string' && r.trim()) return normalizeMediaUrl(r.trim());
  }
  if (uid === sellerId) {
    const r = firstDefined(
      deal?.sellerAvatar,
      deal?.sellerImage,
      deal?.sellerPhoto,
      deal?.seller?.image,
      deal?.seller?.avatar,
      deal?.seller?.photoUrl
    );
    if (typeof r === 'string' && r.trim()) return normalizeMediaUrl(r.trim());
  }

  const loose = firstDefined(deal?.otherPartyImage, deal?.counterpartyImage, deal?.partnerImage);
  if (typeof loose === 'string' && loose.trim()) return normalizeMediaUrl(loose.trim());

  return null;
}

function extractOfferIdFromDeal(deal: any): number | null {
  const id = deal?.offerId ?? deal?.offer?.id ?? deal?.offer?.offerId ?? deal?.listingId ?? deal?.propertyId;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Pierwsze zdjęcie z obiektu oferty / listingu – jak w OfferDetail / Radar (images jako JSON lub tablica stringów). */
function pickFirstImageFromOfferLike(source: any): string | null {
  if (!source || typeof source !== 'object') return null;
  const direct = firstDefined(
    source.mainImage,
    source.mainPhoto,
    source.imageUrl,
    source.image,
    source.thumbnail,
    source.thumbnailUrl,
    source.coverUrl,
    source.coverImage,
    source.photoUrl,
    source.previewUrl,
    source.heroImage
  );
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  let imgs = source.images;
  if (typeof imgs === 'string') {
    try {
      imgs = JSON.parse(imgs);
    } catch {
      imgs = null;
    }
  }
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  const first = imgs[0];
  if (typeof first === 'string' && first.trim()) return first.trim();
  if (first && typeof first === 'object') {
    const u = firstDefined(first.url, first.uri, first.src, first.path);
    if (typeof u === 'string' && u.trim()) return u.trim();
  }
  return null;
}

function extractOfferImageFromDeal(deal: any): string | null {
  if (!deal) return null;
  const sources = [
    deal.offer,
    deal.listing,
    deal.property,
    deal.listing?.offer,
    deal.offer?.listing,
    deal,
  ].filter(Boolean);
  for (const src of sources) {
    const raw = pickFirstImageFromOfferLike(src);
    if (raw) return normalizeMediaUrl(raw);
  }
  return null;
}

/** Rozwiązanie roli kontrahenta — używane także przy budowaniu opisu aktywności z wątku wiadomości. */
function resolveDealCounterparty(
  deal: any,
  user: { id?: number } | null | undefined,
  counterpartyNameById: Record<number, string>
) {
  const me = Number(user?.id || 0);
  const buyerId = parseUserId(firstDefined(deal?.buyerId, deal?.buyer?.id));
  const sellerId = parseUserId(firstDefined(deal?.sellerId, deal?.seller?.id));
  const buyerName = parseUserName(firstDefined(deal?.buyer?.name, deal?.buyer?.fullName, deal?.buyerName));
  const sellerName = parseUserName(firstDefined(deal?.seller?.name, deal?.seller?.fullName, deal?.sellerName));

  const participants = Array.isArray(deal?.participants) ? deal.participants : [];
  const firstOtherParticipant = participants.find((p: any) => {
    const pid = parseUserId(firstDefined(p?.id, p?.userId, p?.user?.id));
    return pid && pid !== me;
  });
  const participantId = parseUserId(firstDefined(firstOtherParticipant?.id, firstOtherParticipant?.userId, firstOtherParticipant?.user?.id));
  const participantName = parseUserName(
    firstDefined(
      firstOtherParticipant?.name,
      firstOtherParticipant?.fullName,
      firstOtherParticipant?.user?.name,
      firstOtherParticipant?.user?.fullName
    )
  );

  const explicitOtherId = parseUserId(firstDefined(deal?.otherUserId, deal?.counterpartyId, deal?.partnerId, deal?.userId));
  const explicitOtherName = parseUserName(firstDefined(deal?.otherUserName, deal?.counterpartyName, deal?.partnerName, deal?.userName));

  if (me && buyerId && me === buyerId) {
    const id = sellerId ?? participantId ?? explicitOtherId;
    const name = sellerName ?? participantName ?? explicitOtherName ?? (id ? counterpartyNameById[id] : null);
    return { sideLabel: 'Sprzedający', id: id || null, name: name || (id ? `Użytkownik #${id}` : 'Brak danych') };
  }
  if (me && sellerId && me === sellerId) {
    const id = buyerId ?? participantId ?? explicitOtherId;
    const name = buyerName ?? participantName ?? explicitOtherName ?? (id ? counterpartyNameById[id] : null);
    return { sideLabel: 'Kupujący', id: id || null, name: name || (id ? `Użytkownik #${id}` : 'Brak danych') };
  }

  const guessedId = participantId ?? explicitOtherId ?? (me === buyerId ? sellerId : buyerId) ?? sellerId ?? buyerId;
  const guessedName =
    participantName ??
    explicitOtherName ??
    (guessedId && guessedId === sellerId ? sellerName : null) ??
    (guessedId && guessedId === buyerId ? buyerName : null) ??
    (guessedId ? counterpartyNameById[guessedId] : null);

  return {
    sideLabel: 'Kontrahent',
    id: guessedId || null,
    name: guessedName || (guessedId ? `Użytkownik #${guessedId}` : 'Brak danych'),
  };
}

// === KOMPONENTY ===
/** Zgodnie z działem listy: żółty Start | zielony Aktywne | fioletowy Finalizowanie (mocny „oddech”). */
function DealPhasePill({ phase, colors }: { phase: DealPhase; colors: ReturnType<typeof getColors> }) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (phase === 'started') {
      scale.value = 1;
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.42, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else if (phase === 'finalized') {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.28, { duration: 480, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 480, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 480, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 480, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      opacity.value = withTiming(1, { duration: 220 });
      scale.value = withTiming(1, { duration: 220 });
    }
  }, [phase, opacity, scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const label =
    phase === 'started' ? 'Start negocjacji' : phase === 'active' ? 'Negocjacje aktywne' : 'Finalizowanie';

  const shell =
    phase === 'started'
      ? { bg: colors.yellowDimmed, border: 'rgba(255,214,10,0.32)', fg: colors.yellow }
      : phase === 'active'
        ? { bg: colors.greenDimmed, border: 'rgba(50,215,75,0.28)', fg: colors.green }
        : { bg: colors.purpleDimmed, border: 'rgba(191,90,242,0.45)', fg: colors.purple };

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          gap: 4,
          borderWidth: 1,
          backgroundColor: shell.bg,
          borderColor: shell.border,
        },
        pulseStyle,
      ]}
    >
      {phase === 'finalized' ? (
        <Sparkles size={12} color={shell.fg} strokeWidth={2.8} />
      ) : (
        <ShieldCheck size={12} color={shell.fg} strokeWidth={3} />
      )}
      <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: shell.fg }}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** Czerwona cyferka — ponad warstwami karty, subtelny „bounce” jak galaretka. */
function UnreadBadge({ count, colors }: { count: number; colors: ReturnType<typeof getColors> }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withDelay(
          2800,
          withSequence(
            withTiming(1.16, { duration: 380, easing: Easing.out(Easing.quad) }),
            withSpring(1, { damping: 9, stiffness: 200, mass: 0.45 })
          )
        )
      ),
      -1,
      false
    );
  }, [scale]);

  const jelly = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      style={[
        {
          position: 'absolute',
          top: -10,
          right: -10,
          minWidth: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.red,
          borderWidth: 2.5,
          borderColor: colors.cardSolid,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 5,
          zIndex: 999,
          elevation: Platform.OS === 'android' ? 16 : 0,
        },
        jelly,
      ]}
    >
      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>{count}</Text>
    </Animated.View>
  );
}

function AttentionBadge({
  colors,
  compact = false,
  text = 'REAKCJA',
}: {
  colors: ReturnType<typeof getColors>;
  compact?: boolean;
  text?: string;
}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.32, { duration: 520, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [opacity]);
  const blink = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (compact) {
    return (
      <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red }, blink]} />
    );
  }

  return (
    <Animated.View style={[{ borderRadius: 999, backgroundColor: colors.red, paddingHorizontal: 8, paddingVertical: 4 }, blink]}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>{text}</Text>
    </Animated.View>
  );
}

function DealOfferThumb({ uri, colors }: { uri: string | null; colors: ReturnType<typeof getColors> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const showPlaceholder = !uri || failed;
  return (
    <View style={{ flex: 1, borderRadius: 19, overflow: 'hidden' }}>
      {showPlaceholder ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.border,
            borderRadius: 19,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.borderHighlight,
          }}
        >
          <ImageIcon size={22} color={colors.textMuted} strokeWidth={1.5} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

// === GŁÓWNY EKRAN ===
export default function DealroomListScreen() {
  const navigation = useNavigation<any>();
  const { token, user } = useAuthStore() as any; 
  
  const themeMode = useThemeStore((s) => s.themeMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return systemScheme !== 'light';
  }, [themeMode, systemScheme]);

  const COLORS = useMemo(() => getColors(isDark), [isDark]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedPartnerDeal, setSelectedPartnerDeal] = useState<any>(null);
  const [selectedProfileLoading, setSelectedProfileLoading] = useState(false);
  const [partnerAvatarFailed, setPartnerAvatarFailed] = useState(false);
  const [openingOfferId, setOpeningOfferId] = useState<number | null>(null);
  const [offerImageByOfferId, setOfferImageByOfferId] = useState<Record<number, string>>({});
  const [counterpartyNameById, setCounterpartyNameById] = useState<Record<number, string>>({});
  const offerImageCacheRef = useRef<Record<number, string>>({});
  const [dealPhaseById, setDealPhaseById] = useState<Record<number, DealPhase>>({});
  const [dealMessagesById, setDealMessagesById] = useState<Record<number, any[]>>({});
  const [phasesReady, setPhasesReady] = useState(false);
  const [phaseRefreshTick, setPhaseRefreshTick] = useState(0);
  const [pinnedDealIds, setPinnedDealIds] = useState<number[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<DealPhase, boolean>>({
    started: false,
    active: false,
    finalized: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DEALROOM_PINS_STORAGE_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPinnedDealIds(parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0));
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    offerImageCacheRef.current = offerImageByOfferId;
  }, [offerImageByOfferId]);

  const dealIdsSig = useMemo(() => deals.map((d) => String(d.id)).sort().join(','), [deals]);

  useFocusEffect(
    useCallback(() => {
      setPhaseRefreshTick((t) => t + 1);
    }, [])
  );

  useEffect(() => {
    if (!token || deals.length === 0) {
      setDealPhaseById({});
      setDealMessagesById({});
      setPhasesReady(true);
      return;
    }
    let cancelled = false;
    setPhasesReady(false);
    (async () => {
      const next: Record<number, DealPhase> = {};
      const nextMsgs: Record<number, any[]> = {};
      await Promise.all(
        deals.map(async (deal) => {
          const id = Number(deal?.id);
          if (!Number.isFinite(id) || id <= 0) return;
          try {
            const res = await fetch(`${API_URL}/api/mobile/v1/deals/${id}/messages`, {
              headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
            });
            if (!res.ok) {
              next[id] = 'started';
              nextMsgs[id] = [];
              return;
            }
            const data = await res.json().catch(() => ({}));
            const messages = Array.isArray(data?.messages) ? data.messages : [];
            nextMsgs[id] = messages;
            next[id] = classifyDealPhaseFromMessages(messages);
          } catch {
            next[id] = 'started';
            nextMsgs[id] = [];
          }
        })
      );
      if (!cancelled) {
        setDealPhaseById(next);
        setDealMessagesById(nextMsgs);
        setPhasesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, dealIdsSig, phaseRefreshTick]);

  /** Najpierw transakcje z nadchodzącą zaakceptowaną prezentacją (najbliższy termin na górze), potem kolejność pinezek. */
  const presentationAndPinSortDeals = useCallback(
    (arr: any[]) =>
      [...arr].sort((a, b) => {
        const idA = Number(a?.id);
        const idB = Number(b?.id);
        const futA = isFutureAcceptedPresentationDeal(idA, dealMessagesById);
        const futB = isFutureAcceptedPresentationDeal(idB, dealMessagesById);
        if (futA !== futB) return futA ? -1 : 1;
        if (futA && futB) {
          const isoA = getAcceptedPresentationIso(dealMessagesById[idA]);
          const isoB = getAcceptedPresentationIso(dealMessagesById[idB]);
          const tA = isoA ? new Date(isoA).getTime() : 0;
          const tB = isoB ? new Date(isoB).getTime() : 0;
          return tA - tB;
        }
        const ia = pinnedDealIds.indexOf(idA);
        const ib = pinnedDealIds.indexOf(idB);
        const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
        const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
        return ra - rb;
      }),
    [pinnedDealIds, dealMessagesById]
  );

  /** Te same karty pokazywane są na samej górze listy — wyklucz je z sekcji etapów. */
  const presentationTopDealsSorted = useMemo(() => {
    return presentationAndPinSortDeals(
      deals.filter((d) => isFutureAcceptedPresentationDeal(Number(d?.id), dealMessagesById))
    );
  }, [deals, dealMessagesById, presentationAndPinSortDeals]);

  const groupedDeals = useMemo(() => {
    const started: any[] = [];
    const active: any[] = [];
    const finalized: any[] = [];
    for (const deal of deals) {
      const id = Number(deal?.id);
      if (isFutureAcceptedPresentationDeal(id, dealMessagesById)) continue;
      const phase = dealPhaseById[id] ?? 'started';
      if (phase === 'finalized') finalized.push(deal);
      else if (phase === 'active') active.push(deal);
      else started.push(deal);
    }
    return {
      started: presentationAndPinSortDeals(started),
      active: presentationAndPinSortDeals(active),
      finalized: presentationAndPinSortDeals(finalized),
    };
  }, [deals, dealPhaseById, presentationAndPinSortDeals, dealMessagesById]);

  const dealNeedsAttentionById = useMemo(() => {
    const out: Record<number, boolean> = {};
    const myId = Number(user?.id || 0);
    for (const deal of deals) {
      const id = Number(deal?.id || 0);
      if (!id) continue;
      const unread = Number(deal?.unread || 0);
      if (unread > 0) {
        out[id] = true;
        continue;
      }
      out[id] = needsReactionFromMessages(dealMessagesById[id], myId);
    }
    return out;
  }, [deals, dealMessagesById, user?.id]);

  const sectionNeedsAttention = useMemo(
    () => ({
      started: groupedDeals.started.some((d) => dealNeedsAttentionById[Number(d?.id)]),
      active: groupedDeals.active.some((d) => dealNeedsAttentionById[Number(d?.id)]),
      finalized: groupedDeals.finalized.some((d) => dealNeedsAttentionById[Number(d?.id)]),
    }),
    [groupedDeals, dealNeedsAttentionById]
  );

  const toggleSection = useCallback((phase: DealPhase) => {
    Haptics.selectionAsync();
    setCollapsedSections((prev) => ({ ...prev, [phase]: !prev[phase] }));
  }, []);

  const dealsSortedFlat = useMemo(() => presentationAndPinSortDeals(deals), [deals, presentationAndPinSortDeals]);

  const resolvedPartnerAvatarUrl = useMemo(() => {
    const fromApi = selectedProfile ? extractPublicProfileAvatarUrl(selectedProfile) : null;
    if (fromApi) return fromApi;
    if (selectedProfileId != null && selectedPartnerDeal) {
      return extractPartnerAvatarFromDeal(selectedPartnerDeal, selectedProfileId);
    }
    return null;
  }, [selectedProfile, selectedProfileId, selectedPartnerDeal]);

  useEffect(() => {
    setPartnerAvatarFailed(false);
  }, [selectedProfileId, resolvedPartnerAvatarUrl]);

  const normalizeDealsPayload = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.deals)) return payload.deals;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data?.deals)) return payload.data.deals;
    if (Array.isArray(payload.data?.items)) return payload.data.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const isActiveDeal = (deal: any) => {
    const status = String(deal?.status || '').toUpperCase();
    if (!status) return true;
    // DONE/CLOSED często ustawiane po uzgodnieniu ceny lub terminu — dealroom ma pozostać na liście.
    const inactiveStatuses = ['ARCHIVED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
    return !inactiveStatuses.includes(status);
  };

  useEffect(() => {
    const fetchDeals = async () => {
      if (!token) { setDeals([]); setLoading(false); return; }
      try {
        const res = await fetch('https://estateos.pl/api/mobile/v1/deals', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const activeDeals = normalizeDealsPayload(data).filter(isActiveDeal);

        // WAŻNE: nie pobieramy /messages z listy dealroomów.
        // W wielu backendach samo wejście w endpoint wiadomości oznacza "seen/read",
        // co psuło licznik nieprzeczytanych bez otwierania czatu.
        const enrichedDeals = activeDeals;
        setDeals(enrichedDeals);

        const missingOfferIds = new Set<number>();
        for (const d of enrichedDeals) {
          const oid = extractOfferIdFromDeal(d);
          if (!oid) continue;
          if (extractOfferImageFromDeal(d)) continue;
          if (!offerImageCacheRef.current[oid]) missingOfferIds.add(oid);
        }
        if (missingOfferIds.size > 0 && token) {
          try {
            const offersRes = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const offersJson = await offersRes.json();
            const offersList = Array.isArray(offersJson?.offers) ? offersJson.offers : [];
            const patch: Record<number, string> = {};
            for (const o of offersList) {
              const id = Number(o?.id || 0);
              if (!missingOfferIds.has(id)) continue;
              const raw = pickFirstImageFromOfferLike(o);
              const url = raw ? normalizeMediaUrl(raw) : null;
              if (url) patch[id] = url;
            }
            if (Object.keys(patch).length > 0) {
              setOfferImageByOfferId((prev) => ({ ...prev, ...patch }));
            }
          } catch {
            // noop
          }
        }
      } catch (e) { setDeals([]); } finally { setLoading(false); }
    };
    
    fetchDeals();
    const interval = setInterval(fetchDeals, 4000); // Szybszy polling
    return () => clearInterval(interval);
  }, [token, user?.id]);

  const getReadableDealTitle = (deal: any) => {
    const customTitle = deal?.offer?.title || deal?.title;
    if (customTitle) return customTitle;
    const offerId = extractOfferIdFromDeal(deal);
    if (offerId) return `Oferta #${offerId}`;
    return 'Negocjacja oferty';
  };

  /** Krótki opis z pól listy API, zanim wczyta się pełny wątek wiadomości. */
  const getCurrentDealActivity = (deal: any, counterpartyHint?: { sideLabel: string; name: string }) => {
    const status = String(deal?.status || '').toUpperCase();
    const raw = String(deal?.lastMessage || '');
    const msg = raw.toLowerCase();
    const unread = Number(deal?.unread || 0);
    const peer = counterpartyHint?.name ? String(counterpartyHint.name).split(/\s+/)[0] : null;
    const side = counterpartyHint?.sideLabel;

    if (status === 'ACCEPTED') return 'Etap: warunki transakcji uzgodnione';
    if (status === 'REJECTED') return 'Etap: negocjacja przerwana — szczegóły w czacie';
    if (status === 'INITIATED') {
      if (side === 'Sprzedający' && peer) {
        return `Etap: start — możesz wysłać ${peer} pierwszą propozycję ceny lub terminu prezentacji`;
      }
      if (side === 'Kupujący' && peer) {
        return `Etap: start — czekasz na pierwszy ruch od ${peer}`;
      }
      return 'Etap: start negocjacji — wyślij propozycję ceny lub terminu';
    }

    if (raw.startsWith('[[DEAL_ATTACHMENT]]') || raw.startsWith('[[deal_attachment]]')) {
      return peer ? `Nowy dokument od ${peer} — zobacz w czacie` : 'Nowy dokument w wątku — zobacz w czacie';
    }

    if (msg.includes('"appointment"')) {
      return peer
        ? `Termin prezentacji w toku — ostatnia zmiana w czacie (partner: ${peer})`
        : 'Termin prezentacji w toku — zajrzyj do czatu';
    }
    if (msg.includes('"bid"') || msg.includes('"BID"')) {
      return peer
        ? `Negocjacja ceny w toku — ostatnia zmiana w czacie (partner: ${peer})`
        : 'Negocjacja ceny w toku — zajrzyj do czatu';
    }

    if (unread > 0) {
      return peer ? `Nowa wiadomość od ${peer}` : 'Masz nieprzeczytaną wiadomość w wątku';
    }
    return peer ? `Aktywny wątek z ${peer}` : 'Aktywny wątek — zajrzyj do czatu';
  };

  const getCounterparty = useCallback(
    (deal: any) => resolveDealCounterparty(deal, user, counterpartyNameById),
    [user, counterpartyNameById]
  );

  useEffect(() => {
    if (!token || !user?.id || deals.length === 0) return;
    const me = Number(user.id);
    const idsToResolve = new Set<number>();

    for (const deal of deals) {
      const c = getCounterparty(deal);
      if (!c.id) continue;
      const hasConcreteName = c.name && c.name !== 'Brak danych' && !String(c.name).startsWith('Użytkownik #');
      if (!hasConcreteName && !counterpartyNameById[c.id]) idsToResolve.add(c.id);
    }

    if (idsToResolve.size === 0) return;
    let cancelled = false;

    (async () => {
      const patch: Record<number, string> = {};
      for (const uid of idsToResolve) {
        if (!uid || uid === me) continue;
        try {
          const res = await fetch(`${API_URL}/api/users/${uid}/public`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          const resolvedName = parseUserName(
            firstDefined(
              data?.user?.name,
              data?.user?.fullName,
              data?.name,
              data?.fullName,
              data?.displayName
            )
          );
          if (resolvedName) patch[uid] = resolvedName;
        } catch {
          // noop
        }
      }
      if (!cancelled && Object.keys(patch).length > 0) {
        setCounterpartyNameById((prev) => ({ ...prev, ...patch }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user?.id, deals, counterpartyNameById]);

  const formatLastMessage = (msg?: string) => {
    const raw = String(msg || '').trim();
    if (!raw) return 'Brak wpisów w wątku.';
    const lower = raw.toLowerCase();
    if (lower.startsWith('[[deal_attachment]]') || raw.startsWith('[[DEAL_ATTACHMENT]]')) {
      return 'Ostatnia aktywność: załącznik — dokument w czacie';
    }
    const parsed = tryParseDealEventPayload(raw);
    if (parsed) {
      const entity = String(parsed.entity || '').toUpperCase();
      const action = String(parsed.action || '').toUpperCase();
      const amt = Number(parsed.amount || 0);
      if (entity === 'APPOINTMENT') {
        if (action === 'ACCEPTED') return 'Ostatnio w czacie: termin prezentacji zaakceptowany';
        if (action === 'COUNTERED') return 'Ostatnio w czacie: kontroferta terminu — wymaga Twojej reakcji';
        return 'Ostatnio w czacie: propozycja terminu prezentacji';
      }
      if (entity === 'BID') {
        if (action === 'ACCEPTED' && amt > 0) {
          return `Ostatnio w czacie: uzgodniona cena ${amt.toLocaleString('pl-PL')} PLN`;
        }
        if (amt > 0) return `Ostatnio w czacie: propozycja ceny ${amt.toLocaleString('pl-PL')} PLN`;
        return 'Ostatnio w czacie: zmiana w negocjacji ceny';
      }
    }
    if (lower.startsWith('[[deal_event]]') || raw.startsWith('[[DEAL_EVENT]]')) {
      return 'Ostatnio w czacie: aktualizacja negocjacji';
    }
    if (raw.startsWith('📅')) return raw;
    const preview = raw.replace(/\s+/g, ' ').slice(0, 52);
    return `Ostatnio: „${preview}${raw.length > 52 ? '…' : ''}”`;
  };

  const togglePinForDeal = useCallback((dealId: number) => {
    const id = Number(dealId);
    setPinnedDealIds((prev) => {
      const idx = prev.indexOf(id);
      const next =
        idx >= 0 ? prev.filter((x) => x !== id) : [id, ...prev.filter((x) => x !== id)];
      void AsyncStorage.setItem(DEALROOM_PINS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const requestDeleteDeal = useCallback(
    (deal: any) => {
      const id = Number(deal?.id);
      if (!id || !token) return;
      Alert.alert(
        'Usunąć transakcję?',
        'Tej operacji nie cofniesz — transakcja zniknie z Dealroom bezpowrotnie.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Usuń',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await requestMobileDealDeletion(id, token);
                if (!result.ok) {
                  Alert.alert('Nie udało się usunąć', result.message);
                  return;
                }
                setDeals((prev) => prev.filter((d) => Number(d.id) !== id));
                setPinnedDealIds((prev) => {
                  const next = prev.filter((x) => x !== id);
                  void AsyncStorage.setItem(DEALROOM_PINS_STORAGE_KEY, JSON.stringify(next));
                  return next;
                });
                setDealPhaseById((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setDealMessagesById((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                Alert.alert('Błąd', 'Sprawdź połączenie i spróbuj ponownie.');
              }
            },
          },
        ]
      );
    },
    [token]
  );

  const openCounterpartyProfile = async (userId?: number | null, dealContext?: any) => {
    if (!userId) return;
    Haptics.selectionAsync();
    setSelectedProfileId(userId);
    setSelectedProfile(null);
    setSelectedPartnerDeal(dealContext ?? null);
    setSelectedProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/public`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (__DEV__) {
        try {
          console.log('[public profile]', JSON.stringify(data, null, 2));
        } catch {
          console.log('[public profile]', data);
        }
      }
      if (res.ok && !data?.error) setSelectedProfile(data);
    } catch {
    } finally {
      setSelectedProfileLoading(false);
    }
  };

  const openOfferPreview = async (deal: any) => {
    const offerId = Number(extractOfferIdFromDeal(deal) || 0);
    if (!offerId) return;
    Haptics.selectionAsync();
    setOpeningOfferId(offerId);
    try {
      const res = await fetch(`https://estateos.pl/api/mobile/v1/offers?includeAll=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await res.json();
      const fullOffer = (Array.isArray(data?.offers) ? data.offers : []).find((o: any) => Number(o?.id || 0) === offerId);
      navigation.navigate('OfferDetail', fullOffer ? { offer: fullOffer } : { id: offerId });
    } catch {
      navigation.navigate('OfferDetail', { id: offerId });
    } finally { setOpeningOfferId(null); }
  };

  const renderDealCard = (deal: any, animDelayIndex: number, listPhase: DealPhase) => {
    const counterparty = getCounterparty(deal);
    const unreadCount = Number(deal.unread || 0);
    const offerIdNum = extractOfferIdFromDeal(deal);
    const thumbUrl =
      extractOfferImageFromDeal(deal) || (offerIdNum ? offerImageByOfferId[offerIdNum] : null);
    const dealNumericId = Number(deal?.id);
    const thread = dealMessagesById[dealNumericId];
    const activityLine =
      phasesReady && thread !== undefined
        ? buildDealListActivityLine(thread, {
            myUserId: Number(user?.id || 0),
            dealStatus: String(deal?.status || ''),
            peerName: counterparty.name,
            peerSideLabel: counterparty.sideLabel,
          })
        : getCurrentDealActivity(deal, { sideLabel: counterparty.sideLabel, name: counterparty.name });
    const presentationIsoForCountdown =
      phasesReady && thread
        ? getAcceptedPresentationIso(thread)
        : null;
    const showPresentationCountdown = Boolean(
      presentationIsoForCountdown && new Date(presentationIsoForCountdown).getTime() > Date.now()
    );
    const isPinned =
      Number.isFinite(dealNumericId) && dealNumericId > 0 && pinnedDealIds.includes(dealNumericId);
    const canDeleteSwipe = phasesReady && listPhase === 'started';
    const needsAttention = Boolean(dealNeedsAttentionById[dealNumericId]);

    return (
      <Animated.View
        key={deal.id}
        entering={FadeInDown.delay(animDelayIndex * 90).springify().damping(12).stiffness(150).mass(0.8)}
        style={[styles.cardContainer, needsAttention && styles.cardContainerElevated]}
      >
        <Swipeable
          friction={2}
          overshootLeft={false}
          overshootRight={canDeleteSwipe}
          enableTrackpadTwoFingerGesture
          containerStyle={styles.swipeableContainer}
          childrenContainerStyle={styles.swipeableChild}
          renderLeftActions={(_progress, _drag, swipeable) => (
            <View style={styles.swipeLeftActions}>
              <RectButton
                style={[styles.swipePinBtn, isPinned && styles.swipePinBtnActive]}
                onPress={() => {
                  swipeable.close();
                  togglePinForDeal(dealNumericId);
                }}
              >
                <Pin size={22} color="#fff" fill={isPinned ? '#fff' : 'transparent'} strokeWidth={2.2} />
                <Text style={styles.swipeActionCaption}>{isPinned ? 'Odepnij' : 'Przypnij'}</Text>
              </RectButton>
            </View>
          )}
          renderRightActions={
            canDeleteSwipe
              ? (_progress, _drag, swipeable) => (
                  <View style={styles.swipeRightActions}>
                    <RectButton
                      style={styles.swipeDeleteBtn}
                      onPress={() => {
                        swipeable.close();
                        requestDeleteDeal(deal);
                      }}
                    >
                      <Trash2 size={22} color="#fff" strokeWidth={2.2} />
                      <Text style={styles.swipeActionCaption}>Usuń</Text>
                    </RectButton>
                  </View>
                )
              : undefined
          }
        >
          <Pressable
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate('DealroomChat', {
                dealId: deal.id,
                offerId: extractOfferIdFromDeal(deal),
                title: deal.title,
              });
            }}
          >
          <BlurView
            intensity={isDark ? 30 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.dealCard,
              needsAttention && styles.dealCardUnread,
              needsAttention && styles.dealCardBadgeBleed,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.dealId}>TX-{deal?.id || '-'}</Text>
                <DealPhasePill phase={listPhase} colors={COLORS} />
              </View>
              <Text style={styles.timeText}>{deal.time}</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Pressable onPress={(e) => { e.stopPropagation(); openOfferPreview(deal); }} hitSlop={10}>
                  <Text style={styles.offerTitle} numberOfLines={1}>
                    {openingOfferId === Number(extractOfferIdFromDeal(deal) || 0)
                      ? 'Otwieranie...'
                      : getReadableDealTitle(deal)}
                  </Text>
                </Pressable>
                <Text style={styles.activityDesc} numberOfLines={2}>
                  {activityLine}
                </Text>
                {showPresentationCountdown && presentationIsoForCountdown ? (
                  <View style={styles.countdownInCard}>
                    <PresentationCountdown presentationIso={presentationIsoForCountdown} variant="panel" />
                  </View>
                ) : null}

                <Pressable
                  style={styles.userRow}
                  onPress={(e) => { e.stopPropagation(); openCounterpartyProfile(counterparty.id, deal); }}
                  hitSlop={10}
                >
                  <View style={styles.userAvatar}>
                    <User size={12} color={COLORS.gold} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.userLabel}>{counterparty.sideLabel}: </Text>
                  <Text style={styles.userName}>{counterparty.name}</Text>
                </Pressable>
              </View>

              <View style={styles.thumbColumn}>
                <View style={styles.thumbWrapper}>
                  <DealOfferThumb uri={thumbUrl} colors={COLORS} />
                </View>
                {unreadCount > 0 ? (
                  <UnreadBadge count={unreadCount} colors={COLORS} />
                ) : needsAttention ? (
                  <View style={styles.reactionBadgeWrap}>
                    <AttentionBadge colors={COLORS} compact />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.messagePreviewRow}>
                <MessageCircle
                  size={15}
                  color={needsAttention ? COLORS.gold : COLORS.textMuted}
                  strokeWidth={needsAttention ? 2.5 : 2}
                />
                <Text
                  style={[styles.lastMessageText, needsAttention && styles.lastMessageTextUnread]}
                  numberOfLines={1}
                >
                  {formatLastMessage(deal.lastMessage)}
                </Text>
              </View>
              <ChevronRight size={18} color={COLORS.textMuted} />
            </View>
          </BlurView>
        </Pressable>
        </Swipeable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tło pod szkło (Opcjonalne, daje głębię w light mode) */}
      {!isDark && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F2F2F7' }]} />}

      {/* HEADER */}
      <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.4 }]}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ChevronLeft size={30} color={COLORS.textMain} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.headerSubtitle}>TWOJE PORTFOLIO</Text>
          <Text style={styles.headerTitle}>Dealroom</Text>
        </View>
      </BlurView>

      {loading ? (
        <Animated.View entering={FadeIn} style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loaderText}>Wczytywanie transakcji...</Text>
        </Animated.View>
      ) : deals.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.loaderCenter}>
          <AlertCircle size={36} color={COLORS.textMuted} strokeWidth={1.5} />
          <Text style={styles.loaderText}>Brak aktywnych transakcji.</Text>
        </Animated.View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!phasesReady && deals.length > 0 ? (
            <View style={styles.phaseBanner}>
              <ActivityIndicator size="small" color={COLORS.gold} />
              <Text style={styles.phaseBannerText}>Układanie według etapów…</Text>
            </View>
          ) : null}

          {!phasesReady
            ? dealsSortedFlat.map((deal, index) =>
                renderDealCard(deal, index, dealPhaseById[Number(deal.id)] ?? 'started')
              )
            : (
              <>
                {presentationTopDealsSorted.length > 0 ? (
                  <View style={styles.phaseSection}>
                    <View style={styles.phaseSectionHeaderRow}>
                      <View style={[styles.phaseSectionIconWrap, styles.phaseSectionIconWrapActive]}>
                        <CalendarClock size={20} color={COLORS.green} strokeWidth={2.2} />
                      </View>
                      <View style={styles.phaseSectionTitles}>
                        <Text style={styles.phaseEyebrow}>Prezentacja</Text>
                        <Text style={styles.phaseTitle}>Nadchodzące prezentacje</Text>
                        <Text style={styles.phaseHint}>
                          Uzgodniony termin w czacie — na górze od najbliższej daty, z odliczaniem jak w wątku.
                        </Text>
                      </View>
                    </View>
                    {presentationTopDealsSorted.map((deal, idx) =>
                      renderDealCard(deal, idx, dealPhaseById[Number(deal.id)] ?? 'active')
                    )}
                  </View>
                ) : null}

                {groupedDeals.started.length > 0 ? (
                  <View style={styles.phaseSection}>
                    <Pressable style={styles.phaseSectionHeaderRow} onPress={() => toggleSection('started')}>
                      <View style={styles.phaseSectionIconWrap}>
                        <PlayCircle size={20} color={COLORS.gold} strokeWidth={2.2} />
                      </View>
                      <View style={styles.phaseSectionTitles}>
                        <Text style={styles.phaseEyebrow}>Negocjacje</Text>
                        <Text style={styles.phaseTitle}>Rozpoczęte ({groupedDeals.started.length})</Text>
                        <Text style={styles.phaseHint}>
                          Jeszcze bez potwierdzonej ceny i bez potwierdzonego terminu prezentacji — pierwsze propozycje wysyłasz w czacie.
                        </Text>
                      </View>
                      <View style={styles.phaseHeaderMeta}>
                        {sectionNeedsAttention.started ? <AttentionBadge colors={COLORS} text="UWAGA" /> : null}
                        {collapsedSections.started ? (
                          <ChevronRight size={20} color={COLORS.textMuted} strokeWidth={2.6} />
                        ) : (
                          <ChevronDown size={20} color={COLORS.textMuted} strokeWidth={2.6} />
                        )}
                      </View>
                    </Pressable>
                    {!collapsedSections.started
                      ? groupedDeals.started.map((deal, idx) => renderDealCard(deal, idx, 'started'))
                      : null}
                  </View>
                ) : null}

                {groupedDeals.active.length > 0 ? (
                  <View style={styles.phaseSection}>
                    <Pressable style={styles.phaseSectionHeaderRow} onPress={() => toggleSection('active')}>
                      <View style={[styles.phaseSectionIconWrap, styles.phaseSectionIconWrapActive]}>
                        <Zap size={20} color={COLORS.green} strokeWidth={2.2} />
                      </View>
                      <View style={styles.phaseSectionTitles}>
                        <Text style={styles.phaseEyebrow}>W toku</Text>
                        <Text style={styles.phaseTitle}>Aktywne ({groupedDeals.active.length})</Text>
                        <Text style={styles.phaseHint}>
                          Cena i/lub termin prezentacji już uzgodnione — kolejne ustalenia prowadzicie w czacie.
                        </Text>
                      </View>
                      <View style={styles.phaseHeaderMeta}>
                        {sectionNeedsAttention.active ? <AttentionBadge colors={COLORS} text="UWAGA" /> : null}
                        {collapsedSections.active ? (
                          <ChevronRight size={20} color={COLORS.textMuted} strokeWidth={2.6} />
                        ) : (
                          <ChevronDown size={20} color={COLORS.textMuted} strokeWidth={2.6} />
                        )}
                      </View>
                    </Pressable>
                    {!collapsedSections.active
                      ? groupedDeals.active.map((deal, idx) => renderDealCard(deal, idx, 'active'))
                      : null}
                  </View>
                ) : null}

                {groupedDeals.finalized.length > 0 ? (
                  <View style={styles.phaseSection}>
                    <Pressable style={styles.phaseSectionHeaderRow} onPress={() => toggleSection('finalized')}>
                      <View style={[styles.phaseSectionIconWrap, styles.phaseSectionIconWrapDone]}>
                        <CheckCircle2 size={20} color={COLORS.purple} strokeWidth={2.2} />
                      </View>
                      <View style={styles.phaseSectionTitles}>
                        <Text style={styles.phaseEyebrow}>Domknięcie</Text>
                        <Text style={styles.phaseTitle}>Sfinalizowane ({groupedDeals.finalized.length})</Text>
                        <Text style={styles.phaseHint}>
                          Transakcja zamknięta przez właściciela — oferta przeniesiona do archiwum.
                        </Text>
                      </View>
                      <View style={styles.phaseHeaderMeta}>
                        {sectionNeedsAttention.finalized ? <AttentionBadge colors={COLORS} text="UWAGA" /> : null}
                        {collapsedSections.finalized ? (
                          <ChevronRight size={20} color={COLORS.textMuted} strokeWidth={2.6} />
                        ) : (
                          <ChevronDown size={20} color={COLORS.textMuted} strokeWidth={2.6} />
                        )}
                      </View>
                    </Pressable>
                    {!collapsedSections.finalized
                      ? groupedDeals.finalized.map((deal, idx) => renderDealCard(deal, idx, 'finalized'))
                      : null}
                  </View>
                ) : null}
              </>
            )}
        </ScrollView>
      )}

      {/* WIZYTÓWKA MODAL */}
      <Modal
        visible={!!selectedProfileId}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedProfileId(null);
          setSelectedPartnerDeal(null);
        }}
      >
        <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setSelectedProfileId(null);
              setSelectedPartnerDeal(null);
            }}
          />
          <Animated.View entering={FadeInDown.springify().damping(15)} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wizytówka Partnera</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedProfileId(null);
                  setSelectedPartnerDeal(null);
                }}
                style={styles.modalCloseBtn}
                hitSlop={15}
              >
                <X size={20} color={COLORS.textMain} />
              </Pressable>
            </View>

            {selectedProfileLoading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator color={COLORS.gold} size="large" />
              </View>
            ) : (
              <>
                <View style={styles.profileHero}>
                  <View style={styles.profileBigAvatar}>
                    {resolvedPartnerAvatarUrl && !partnerAvatarFailed ? (
                      <Image
                        key={`${selectedProfileId}-${resolvedPartnerAvatarUrl}`}
                        source={{ uri: resolvedPartnerAvatarUrl }}
                        style={styles.profileBigAvatarImage}
                        resizeMode="cover"
                        onError={() => setPartnerAvatarFailed(true)}
                      />
                    ) : (
                      <User size={36} color={COLORS.gold} strokeWidth={2} />
                    )}
                  </View>
                  <Text style={styles.profileName}>{selectedProfile?.user?.name || `Użytkownik #${selectedProfileId}`}</Text>
                  <EliteStatusBadges subject={selectedProfile?.user || selectedProfile} isDark={isDark} compact />
                  <Text style={styles.profileIdText}>ID w systemie: {selectedProfile?.user?.id || selectedProfileId}</Text>
                  
                  {(() => {
                    const reviews = Array.isArray(selectedProfile?.reviews) ? selectedProfile.reviews : [];
                    const avg = reviews.length > 0 ? reviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) / reviews.length : 0;
                    return (
                      <View style={styles.ratingRow}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={14} color={s <= Math.round(avg) ? COLORS.gold : COLORS.textMuted} fill={s <= Math.round(avg) ? COLORS.gold : 'transparent'} />
                        ))}
                        <Text style={styles.ratingText}>{avg.toFixed(1)} <Text style={{color: COLORS.textMuted}}>({reviews.length})</Text></Text>
                      </View>
                    );
                  })()}
                </View>

                <RNScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sectionHeader}>OSTATNIE OPINIE</Text>
                  {!Array.isArray(selectedProfile?.reviews) || selectedProfile.reviews.length === 0 ? (
                    <Text style={styles.emptyText}>Brak zweryfikowanych opinii.</Text>
                  ) : selectedProfile.reviews.slice(0, 5).map((r: any) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewTop}>
                        <View style={{flexDirection: 'row', gap: 2}}>
                          {[1, 2, 3, 4, 5].map((s) => (
                             <Star key={`${r.id}_${s}`} size={10} color={s <= Number(r?.rating || 0) ? COLORS.gold : COLORS.border} fill={s <= Number(r?.rating || 0) ? COLORS.gold : 'transparent'} />
                          ))}
                        </View>
                        <Text style={styles.reviewDate}>{r?.createdAt ? new Date(r.createdAt).toLocaleDateString('pl-PL') : ''}</Text>
                      </View>
                      <Text style={styles.reviewBody}>{r?.comment || 'Bez komentarza.'}</Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionHeader, { marginTop: 24 }]}>PORTFOLIO OFERT</Text>
                  {!Array.isArray(selectedProfile?.offers || selectedProfile?.user?.offers) || (selectedProfile?.offers || selectedProfile?.user?.offers).length === 0 ? (
                    <Text style={styles.emptyText}>Brak aktywnych ofert publicznych.</Text>
                  ) : (selectedProfile?.offers || selectedProfile?.user?.offers).slice(0, 6).map((o: any) => (
                    <Pressable
                      key={o.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedProfileId(null);
                        navigation.navigate('OfferDetail', { offer: o });
                      }}
                      style={({ pressed }) => [styles.offerLinkCard, pressed && { opacity: 0.5 }]}
                    >
                      <Text style={styles.offerLinkTitle} numberOfLines={1}>{o?.title || `Oferta #${o?.id || '-'}`}</Text>
                      <ChevronRight size={16} color={COLORS.textMuted} />
                    </Pressable>
                  ))}
                </RNScrollView>
              </>
            )}
          </Animated.View>
        </BlurView>
      </Modal>
    </View>
  );
}

// === STYLE ===
const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingTop: Platform.OS === 'ios' ? 54 : 44, 
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  backButton: { marginRight: 12, marginLeft: -8, padding: 4 },
  headerTextWrapper: { flex: 1, justifyContent: 'center' },
  headerSubtitle: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { color: colors.textMain, fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: colors.textSec, fontSize: 13, fontWeight: '500', marginTop: 16, letterSpacing: 0.5 },
  
  scrollContent: { paddingHorizontal: 16, paddingBottom: 50, paddingTop: 16 },

  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: colors.cardSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderHighlight,
  },
  phaseBannerText: { color: colors.textSec, fontSize: 13, fontWeight: '600' },

  phaseSection: { marginBottom: 28 },
  phaseSectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 2 },
  phaseHeaderMeta: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 44, paddingTop: 2, gap: 8 },
  phaseSectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.goldDimmed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  phaseSectionIconWrapActive: {
    backgroundColor: colors.greenDimmed,
    borderColor: 'rgba(52,199,89,0.35)',
  },
  phaseSectionIconWrapDone: {
    backgroundColor: colors.purpleDimmed,
    borderColor: 'rgba(191,90,242,0.38)',
  },
  phaseSectionTitles: { flex: 1, paddingTop: 2 },
  phaseEyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  phaseTitle: {
    color: colors.textMain,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  phaseHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 6,
  },
  
  cardContainer: { marginBottom: 16 },
  /** Wyżej od kolejnej karty — żeby badge nie był „pod” sąsiadem */
  cardContainerElevated: {
    zIndex: 20,
    elevation: Platform.OS === 'android' ? 12 : 0,
  },

  swipeableContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  swipeableChild: {
    flex: 1,
  },
  swipeLeftActions: {
    width: 92,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  swipeRightActions: {
    width: 92,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  swipePinBtn: {
    flex: 1,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  swipePinBtnActive: {
    backgroundColor: '#C93400',
  },
  swipeDeleteBtn: {
    flex: 1,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  swipeActionCaption: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    letterSpacing: 0.15,
  },
  
  // GLASSMORPHISM CARD
  dealCard: { 
    backgroundColor: colors.card, 
    borderRadius: 24, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: colors.borderHighlight,
    overflow: 'hidden',
    shadowColor: colors.shadow, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 16, 
    elevation: 4 
  },
  dealCardUnread: { borderColor: colors.gold, backgroundColor: colors.cardSolid, shadowOpacity: 0.15, shadowColor: colors.gold },
  /** Bez clip przy nieprzeczytanych — kółko badge wystaje poza szkło */
  dealCardBadgeBleed: { overflow: 'visible' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dealId: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  timeText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  
  cardBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, overflow: 'visible' },
  cardInfo: { flex: 1, paddingRight: 16 },
  offerTitle: { color: colors.textMain, fontSize: 19, fontWeight: '700', letterSpacing: 0.2, marginBottom: 4 },
  activityDesc: { color: colors.textSec, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  countdownInCard: { marginTop: 6, alignSelf: 'stretch' },

  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.border, borderRadius: 12 },
  userAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.goldDimmed, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  userLabel: { color: colors.textSec, fontSize: 12, fontWeight: '500' },
  userName: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  
  thumbColumn: {
    width: 80,
    position: 'relative',
    overflow: 'visible',
    zIndex: 50,
    alignSelf: 'center',
  },
  thumbWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  reactionBadgeWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 999,
    elevation: Platform.OS === 'android' ? 16 : 0,
  },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderHighlight },
  messagePreviewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 },
  lastMessageText: { color: colors.textMuted, fontSize: 13, marginLeft: 8, flex: 1, fontWeight: '500' },
  lastMessageTextUnread: { color: colors.textMain, fontWeight: '700' },
  
  // MODAL
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.cardSolid, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: colors.textSec, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  modalLoader: { paddingVertical: 50, alignItems: 'center' },
  
  profileHero: { alignItems: 'center', marginBottom: 28 },
  profileBigAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.goldDimmed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.goldDimmed,
    overflow: 'hidden',
  },
  profileBigAvatarImage: { width: 70, height: 70, borderRadius: 35 },
  profileName: { color: colors.textMain, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  profileIdText: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14, backgroundColor: colors.goldDimmed, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  ratingText: { color: colors.gold, fontSize: 15, fontWeight: '800', marginLeft: 4 },
  
  modalScroll: { flexGrow: 0 },
  sectionHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  
  reviewCard: { backgroundColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewDate: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  reviewBody: { color: colors.textMain, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  
  offerLinkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  offerLinkTitle: { color: colors.textMain, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 16 },
});