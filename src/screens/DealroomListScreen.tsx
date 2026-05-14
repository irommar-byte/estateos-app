import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  StyleSheet, View, Text, ScrollView as RNScrollView, Pressable, Platform, 
  ActivityIndicator, Modal, Appearance, Image, Alert, LayoutAnimation, UIManager,
  type ColorSchemeName,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, Swipeable, RectButton } from 'react-native-gesture-handler';
import Animated, { 
  FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, 
  withRepeat, withSequence, withTiming, withDelay, withSpring, Easing 
} from 'react-native-reanimated';
// Wykorzystywane przez „Apple-spring stagger" przy pierwszym pokazaniu sekcji
// po wejściu na ekran — `springify()` z sensownym `damping`/`stiffness` daje
// efekt ciężaru i dostojeństwa zamiast tanio sprężynującego skoku.
import { 
  ChevronRight, ChevronLeft, ChevronDown, MessageCircle, ShieldCheck, 
  AlertCircle, User, X, Star, ImageIcon, PlayCircle, Zap, CheckCircle2, Sparkles,
  Trash2, Pin, CalendarClock, HandCoins,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useUnreadBadgeStore } from '../store/useUnreadBadgeStore';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';
import { API_URL } from '../config/network';
import { requestMobileDealDeletion } from '../utils/mobileDealDelete';
import { buildDealListActivityLine } from '../utils/dealListActivityLine';
import PresentationCountdown from '../components/dealroom/PresentationCountdown';
import { canFinalizeTransition, isFinalizedOwnerAcceptanceMessage } from '../contracts/parityContracts';
import EliteStatusBadges from '../components/EliteStatusBadges';
import UserRegionFlag from '../components/UserRegionFlag';
import { formatLocationLabel } from '../constants/locationEcosystem';

/** Kolejność ID na liście — pierwsze na górze sekcji (jak pinezka w Mail). */
const DEALROOM_PINS_STORAGE_KEY = '@EstateOS_dealroom_pins';
const DEALROOM_STACK_PINS_STORAGE_KEY = '@EstateOS_dealroom_stack_pins';
const DEALROOM_COLLAPSED_SECTIONS_KEY = '@EstateOS_dealroom_collapsed_sections';

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
function classifyDealPhaseFromMessages(messages: any[], deal?: any): DealPhase {
  const rawStatus = String(firstDefined(deal?.status, deal?.dealStatus) || '').trim().toUpperCase();
  if (['FINALIZED', 'CLOSED', 'COMPLETED', 'DONE', 'SOLD'].includes(rawStatus)) return 'finalized';
  if (
    canFinalizeTransition({
      dealStatus: rawStatus,
      acceptedBidId: firstDefined(deal?.acceptedBidId, deal?.acceptedBid?.id),
    })
  ) {
    return 'finalized';
  }
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

function buildOfferSummaryLine(deal: any): string {
  const offer = deal?.offer || deal?.listing || deal?.property || {};
  const city = String(firstDefined(offer?.city, offer?.location?.city, deal?.city) || '').trim();
  const district = String(firstDefined(offer?.district, offer?.location?.district, deal?.district) || '').trim();
  const rooms = Number(firstDefined(offer?.rooms, offer?.roomsCount, deal?.rooms) || 0);
  const area = Number(firstDefined(offer?.area, offer?.metrage, deal?.area) || 0);
  const left = formatLocationLabel(city, district, '');
  const right = [
    rooms > 0 ? `${rooms} pok.` : '',
    area > 0 ? `${Math.round(area)} m²` : '',
  ]
    .filter(Boolean)
    .join(' • ');
  return [left, right].filter(Boolean).join('  |  ') || 'Brak opisu lokalizacji';
}

function getStackContactMeta(deal: any, dealMessagesById: Record<number, any[]>) {
  const dealId = Number(deal?.id || 0);
  const thread = dealMessagesById[dealId] || [];
  const sorted = [...thread].sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
  );
  for (const msg of sorted) {
    const ev = tryParseDealEventPayload(String(msg?.content ?? msg?.text ?? ''));
    if (!ev) continue;
    const entity = String(ev.entity || '').toUpperCase();
    const amount = Number(ev.amount || 0);
    const at = new Date(msg?.createdAt || Date.now());
    const atText = Number.isFinite(at.getTime())
      ? at.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '-';
    if (entity === 'APPOINTMENT') {
      return {
        kind: 'appointment' as const,
        text: 'Negocjacja terminu',
        atText,
      };
    }
    if (entity === 'BID') {
      return {
        kind: 'price' as const,
        text: amount > 0 ? `Oferta: ${amount.toLocaleString('pl-PL')} PLN` : 'Negocjacja ceny',
        atText,
      };
    }
  }
  const fallbackAt = new Date(firstDefined(deal?.updatedAt, deal?.lastMessageAt, Date.now()) as any);
  return {
    kind: 'other' as const,
    text: 'Kontakt w transakcji',
    atText: Number.isFinite(fallbackAt.getTime())
      ? fallbackAt.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '-',
  };
}

function getTransactionBadge(deal: any): { label: 'Sprzedaż' | 'Najem'; color: string } {
  const tx = String(
    firstDefined(
      deal?.offer?.transactionType,
      deal?.listing?.transactionType,
      deal?.property?.transactionType,
      deal?.transactionType
    ) || ''
  ).toUpperCase();
  if (tx === 'RENT') return { label: 'Najem', color: '#0A84FF' };
  return { label: 'Sprzedaż', color: '#10B981' };
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

/**
 * Premium 3D-pinezka „przybita do deski".
 *
 * Renderowana POZA `Swipeable` (który ma `overflow: hidden`) i POZA samą
 * kartą — leży w `cardContainer` / `walletStackOuterWrap`. Pozycjonowanie
 * `top: -14` względem rodzica oznacza, że główka pinezki znajduje się
 * NAD krawędzią karty, a jej dolny brzeg wpada w strefę paddingu (16 px)
 * — czyli w miejsce, gdzie z definicji NIE ma żadnego tekstu ani ikon.
 * Dzięki temu pinezka nigdy nie zakrywa zegara, tytułu, nazwy oferty itd.
 *
 * Wygląd jest 3D: 5 nakładek (cień rzucany, gradient metaliczny, kant,
 * refleks światła, środkowy punkcik) + delikatna rotacja `-6°` symuluje
 * ręcznie wbitą pinezkę. Cień rzucany NA papier sugeruje, że pinezka
 * unosi się ułamek nad powierzchnią.
 *
 * Style są **inline statyczne** (a nie z `useMemo(createStyles, …)`), bo
 * komponent siedzi poza klamrami głównego ekranu i nie ma dostępu do
 * lokalnego `styles`. To również najtańsza forma — żadnej alokacji
 * obiektu stylu na rerender.
 */
const PIN_3D_STYLES = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: -14,
    right: 16,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    zIndex: 30,
    elevation: 14,
  },
  shadow: {
    position: 'absolute',
    top: 4,
    width: 28,
    height: 14,
    borderRadius: 14,
    backgroundColor: '#000',
    opacity: 0.22,
    transform: [{ scaleX: 1.1 }],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  head: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    borderWidth: 1.1,
    borderColor: 'rgba(120,0,0,0.55)',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    borderTopWidth: 1.2,
    borderLeftWidth: 1.2,
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderLeftColor: 'rgba(255,255,255,0.45)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: 10,
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
    opacity: 0.9,
  },
  core: {
    position: 'absolute',
    top: 11,
    left: 11,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,0,0,0.55)',
  },
});

function Pin3DBadge({ style }: { style?: any }) {
  return (
    <View style={[PIN_3D_STYLES.anchor, style]} pointerEvents="none">
      <View style={PIN_3D_STYLES.shadow} />
      <View style={PIN_3D_STYLES.head}>
        <LinearGradient
          colors={['#FF7A6E', '#FF3B30', '#B81705']}
          start={{ x: 0.25, y: 0.05 }}
          end={{ x: 0.75, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={PIN_3D_STYLES.highlight} />
        <View style={PIN_3D_STYLES.rim} />
        <View style={PIN_3D_STYLES.shine} />
        <View style={PIN_3D_STYLES.core} />
      </View>
    </View>
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

// =============================================================================
// DEALROOMS — LUKSUSOWY EMPTY-STATE / ONBOARDING
// =============================================================================
/**
 * Empty-state ekranu „EstateOS™ Dealrooms".
 *
 * KIEDY SIĘ POJAWIA
 * ─────────────────
 * Wyłącznie wtedy, gdy backend zwrócił pustą listę transakcji
 * (`deals.length === 0`) ORAZ pierwsze pobranie się zakończyło
 * (`loading === false`). Czyli: użytkownik jest zalogowany, ekran załadowany,
 * ale jeszcze nie ma żadnego aktywnego Dealroomu (ani jako kupujący, ani jako
 * sprzedający). Nie pokazuje się podczas wczytywania (`loading === true`),
 * gdzie renderowany jest osobny `ActivityIndicator` w `loaderCenter`.
 *
 * CZEMU SŁUŻY TEN EKRAN
 * ─────────────────────
 * EstateOS™ Dealroom to dwustronny pokój transakcyjny tworzony AUTOMATYCZNIE
 * w momencie wzajemnego zainteresowania ofertą:
 *   1. Kupujący w widoku oferty wysyła „Propozycję transakcji" (cena + warunki).
 *   2. Sprzedający akceptuje rozmowę → backend tworzy parę
 *      (`buyerId`, `sellerId`, `offerId`) i wystawia Dealroom z czatem,
 *      tablicą propozycji cenowych, planowaniem prezentacji i finalizacją
 *      (z opcjonalnym depozytem zabezpieczającym).
 *
 * Po stworzeniu pierwszego Dealroomu — empty-state znika, a ekran prezentuje
 * grupowanie po fazach:
 *   • Rozpoczęte  — propozycja wysłana, oczekiwanie na akcję
 *   • W toku      — negocjacja cenowa / planowanie prezentacji
 *   • Sfinalizowane — umowa podpisana, depozyt rozliczony
 *
 * CO ZAWIERA EMPTY-STATE
 * ──────────────────────
 *   • Hero: glow'owa bańka z ikoną `HandCoins` (gold) + warstwa „pyłku" `Sparkles`
 *   • Eyebrow „WITAJ W DEALROOMS" w firmowym złocie
 *   • Tytuł „Tu pojawią się Twoje transakcje" (38pt, weight 800)
 *   • Krótki opis czym jest Dealroom
 *   • Trzy karty-kroki (1 → 2 → 3) tłumaczące jak otworzyć pierwszą transakcję:
 *       1. Znajdź ofertę w Radarze
 *       2. Wyślij propozycję transakcji ze szczegółów oferty
 *       3. Po akceptacji pojawi się tutaj Dealroom z czatem
 *   • Primary CTA „Otwórz Radar" → wraca do zakładki Radar (główne wejście do flow)
 *
 * Cały blok wchodzi z animacją `FadeInDown` z lekkim staggerem między kartami.
 */
function DealroomsEmptyState({
  colors,
  onOpenRadar,
}: {
  colors: ReturnType<typeof getColors>;
  onOpenRadar: () => void;
}) {
  const steps = [
    {
      icon: Star,
      title: 'Znajdź ofertę w Radarze',
      desc: 'Otwórz zakładkę Radar, przejrzyj mapę i listę nieruchomości pasujących do Twoich kryteriów.',
    },
    {
      icon: HandCoins,
      title: 'Wyślij propozycję transakcji',
      desc: 'W szczegółach oferty stuknij „Zaproponuj transakcję" i wprowadź cenę oraz warunki.',
    },
    {
      icon: ShieldCheck,
      title: 'Negocjuj i finalizuj bezpiecznie',
      desc: 'Po akceptacji drugiej strony pojawi się tu Dealroom z czatem, propozycjami cen i finalizacją.',
    },
  ];

  return (
    <Animated.View entering={FadeIn.duration(360)} style={emptyStateStyles.root}>
      <ScrollView
        contentContainerStyle={emptyStateStyles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* HERO ICON — gold halo + sparkle drobinki */}
        <Animated.View entering={FadeInDown.duration(420)} style={emptyStateStyles.heroWrap}>
          <View style={[emptyStateStyles.heroHaloOuter, { backgroundColor: colors.goldDimmed }]} />
          <View style={[emptyStateStyles.heroHaloInner, { backgroundColor: colors.goldDimmed, borderColor: colors.gold + '55' }]}>
            <HandCoins size={36} color={colors.gold} strokeWidth={1.8} />
          </View>
          <View style={emptyStateStyles.sparkleA} pointerEvents="none">
            <Sparkles size={14} color={colors.gold} strokeWidth={1.6} />
          </View>
          <View style={emptyStateStyles.sparkleB} pointerEvents="none">
            <Sparkles size={10} color={colors.gold} strokeWidth={1.6} />
          </View>
        </Animated.View>

        {/* HEADER TEXT */}
        <Animated.View entering={FadeInDown.delay(100).duration(420)} style={emptyStateStyles.headerBlock}>
          <Text style={[emptyStateStyles.eyebrow, { color: colors.gold }]}>WITAJ W DEALROOMS</Text>
          <Text style={[emptyStateStyles.title, { color: colors.textMain }]}>
            Tu pojawią się{'\n'}Twoje transakcje
          </Text>
          <Text style={[emptyStateStyles.subtitle, { color: colors.textMuted }]}>
            EstateOS™ Dealroom to bezpieczny pokój negocjacyjny — czat, propozycje cenowe,
            planowanie prezentacji i finalizacja w jednym miejscu. Otwiera się automatycznie,
            gdy obie strony zgodzą się rozmawiać o ofercie.
          </Text>
        </Animated.View>

        {/* 3-CROOK ONBOARDING */}
        <View style={emptyStateStyles.stepsBlock}>
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            return (
              <Animated.View
                key={step.title}
                entering={FadeInDown.delay(200 + idx * 110).duration(420)}
                style={[emptyStateStyles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[emptyStateStyles.stepNumberBubble, { backgroundColor: colors.goldDimmed, borderColor: colors.gold + '44' }]}>
                  <Text style={[emptyStateStyles.stepNumber, { color: colors.gold }]}>{idx + 1}</Text>
                </View>
                <View style={emptyStateStyles.stepTextBlock}>
                  <View style={emptyStateStyles.stepTitleRow}>
                    <StepIcon size={16} color={colors.gold} strokeWidth={2} />
                    <Text style={[emptyStateStyles.stepTitle, { color: colors.textMain }]}>{step.title}</Text>
                  </View>
                  <Text style={[emptyStateStyles.stepDesc, { color: colors.textMuted }]}>{step.desc}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* PRIMARY CTA */}
        <Animated.View entering={FadeInDown.delay(560).duration(420)} style={emptyStateStyles.ctaBlock}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onOpenRadar();
            }}
            style={({ pressed }) => [
              emptyStateStyles.ctaPrimary,
              { backgroundColor: colors.gold, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Text style={emptyStateStyles.ctaPrimaryText}>Otwórz Radar i znajdź ofertę</Text>
            <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          <Text style={[emptyStateStyles.ctaFootnote, { color: colors.textMuted }]}>
            Dealroom utworzymy automatycznie po wzajemnej akceptacji.
          </Text>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const emptyStateStyles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingTop: 24,
    paddingBottom: 140,
    paddingHorizontal: 22,
    alignItems: 'stretch',
  },
  heroWrap: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroHaloOuter: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    opacity: 0.55,
  },
  heroHaloInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sparkleA: {
    position: 'absolute',
    top: 8,
    right: 14,
    opacity: 0.85,
  },
  sparkleB: {
    position: 'absolute',
    bottom: 14,
    left: 10,
    opacity: 0.7,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
  },
  stepsBlock: {
    gap: 12,
    marginBottom: 24,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  stepNumberBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stepTextBlock: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  ctaBlock: {
    alignItems: 'center',
    paddingTop: 4,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ctaFootnote: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});

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
  const [pinnedStackKeysByPhase, setPinnedStackKeysByPhase] = useState<Record<DealPhase, string[]>>({
    started: [],
    active: [],
    finalized: [],
  });
  /**
   * Domyślnie sekcje są ROZWINIĘTE — wcześniej każde wejście do „Wiadomości"
   * resetowało je do stanu zwiniętego (`true`), więc lista za każdym razem
   * skakała w trakcie pierwszego renderu. Stan jest dodatkowo utrwalany w
   * AsyncStorage (patrz efekt poniżej), więc gdy użytkownik raz coś zwinie
   * — zostanie zwinięte także po powrocie z czata albo restarcie aplikacji.
   */
  const [collapsedSections, setCollapsedSections] = useState<Record<DealPhase, boolean>>({
    started: false,
    active: false,
    finalized: false,
  });
  const [collapsedSectionsHydrated, setCollapsedSectionsHydrated] = useState(false);
  const [expandedOfferStacks, setExpandedOfferStacks] = useState<Record<string, boolean>>({});

  /**
   * Bramka „premium reveal" dla sekcji.
   *
   * Wcześniej, gdy użytkownik wchodził w „Wiadomości", lista próbowała się
   * narysować równolegle z hydratacją grup, danymi wątków i obliczaniem faz
   * — i widać było, jak elementy doczepiają się po kolei, co dawało wrażenie
   * szarpania. Tutaj wymuszamy krótką (≈750 ms) chwilę zatrzymania, podczas
   * której pokazujemy spokojny, animowany komunikat „przygotowywania
   * portfolio". Po czasie ustawiamy `sectionsReady = true` i sekcje
   * wystrzeliwują w dół jako spring-stagger — wszystko w jednym, pełnym
   * gracji ruchu, bez gubionych klatek.
   */
  const [sectionsReady, setSectionsReady] = useState(false);
  const sectionsReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Hydratacja stanu zwinięcia sekcji z AsyncStorage — odzwierciedla wybór
  // użytkownika z poprzedniej sesji, więc Wiadomości nie „resetują się" przy
  // każdym wejściu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DEALROOM_COLLAPSED_SECTIONS_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setCollapsedSections({
              started: !!parsed.started,
              active: !!parsed.active,
              finalized: !!parsed.finalized,
            });
          }
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setCollapsedSectionsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!collapsedSectionsHydrated) return;
    void AsyncStorage.setItem(
      DEALROOM_COLLAPSED_SECTIONS_KEY,
      JSON.stringify(collapsedSections)
    ).catch(() => undefined);
  }, [collapsedSections, collapsedSectionsHydrated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DEALROOM_STACK_PINS_STORAGE_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        setPinnedStackKeysByPhase({
          started: Array.isArray(parsed.started) ? parsed.started.map(String) : [],
          active: Array.isArray(parsed.active) ? parsed.active.map(String) : [],
          finalized: Array.isArray(parsed.finalized) ? parsed.finalized.map(String) : [],
        });
      } catch {
        // noop
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      // Premium reveal: każde wejście w „Wiadomości" zaczyna od delikatnego
      // „oddechu" (krótki loader) → sekcje wstrzykiwane są dopiero po nim,
      // przez co cała animacja wjazdu odbywa się na statycznym tle bez
      // konkurencji z hydratacją danych.
      setSectionsReady(false);
      if (sectionsReadyTimerRef.current) {
        clearTimeout(sectionsReadyTimerRef.current);
      }
      sectionsReadyTimerRef.current = setTimeout(() => {
        setSectionsReady(true);
        sectionsReadyTimerRef.current = null;
      }, 760);

      return () => {
        if (sectionsReadyTimerRef.current) {
          clearTimeout(sectionsReadyTimerRef.current);
          sectionsReadyTimerRef.current = null;
        }
      };
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
            next[id] = classifyDealPhaseFromMessages(messages, deal);
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

  /**
   * Propagujemy sumę „kart wymagających uwagi" do globalnego store'u, z którego
   * `App.tsx` czyta liczbę na zakładce „Wiadomości" oraz na ikonie aplikacji.
   *
   * Liczymy KARTY, nie sumę `unread` w wiadomościach — bo czerwona kropka na
   * karcie jest binarna („potrzebuje uwagi" / „nie"). Dzięki temu badge "1"
   * znika natychmiast po wejściu w czat i oznaczeniu wątku przez backend,
   * bez czekania na pełną synchronizację licznika wiadomości.
   */
  const setUnreadBadgeCount = useUnreadBadgeStore((state) => state.setUnreadDealCount);
  useEffect(() => {
    const attentionCount = Object.values(dealNeedsAttentionById).filter(Boolean).length;
    setUnreadBadgeCount(attentionCount);
  }, [dealNeedsAttentionById, setUnreadBadgeCount]);

  const sectionNeedsAttention = useMemo(
    () => ({
      started: groupedDeals.started.some((d) => dealNeedsAttentionById[Number(d?.id)]),
      active: groupedDeals.active.some((d) => dealNeedsAttentionById[Number(d?.id)]),
      finalized: groupedDeals.finalized.some((d) => dealNeedsAttentionById[Number(d?.id)]),
    }),
    [groupedDeals, dealNeedsAttentionById]
  );

  /**
   * Dostojna, Apple-style krzywa rozwijania grup w „Wiadomościach".
   *
   * Świadomie używamy `keyboard` (CAMediaTimingFunction `(0.32, 0.72, 0, 1)`
   * — ta sama, której iOS używa do otwierania klawiatury) — daje miękkie
   * wejście i decelerację. NIE używamy `spring`, bo lista pełna szklanych
   * kafli przy każdej drgającej klatce sprężyny musi się przerysować.
   */
  const configureWalletLayoutAnimation = useCallback((duration: number) => {
    LayoutAnimation.configureNext({
      duration,
      create: {
        type: LayoutAnimation.Types.easeIn,
        property: LayoutAnimation.Properties.opacity,
        duration: Math.round(duration * 0.85),
      },
      update: { type: LayoutAnimation.Types.keyboard },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        duration: Math.round(duration * 0.7),
      },
    });
  }, []);

  const toggleSection = useCallback(
    (phase: DealPhase) => {
      Haptics.selectionAsync();
      // Rozwijanie wolniejsze (płynne ujawnianie), zwijanie nieco szybsze.
      setCollapsedSections((prev) => {
        const isCurrentlyCollapsed = prev[phase] === true;
        configureWalletLayoutAnimation(isCurrentlyCollapsed ? 360 : 280);
        return { ...prev, [phase]: !prev[phase] };
      });
    },
    [configureWalletLayoutAnimation]
  );

  const toggleOfferStack = useCallback(
    (phase: DealPhase, offerId: number) => {
      const key = `${phase}:${offerId}`;
      Haptics.selectionAsync();
      setExpandedOfferStacks((prev) => {
        const isCurrentlyExpanded = !!prev[key];
        configureWalletLayoutAnimation(isCurrentlyExpanded ? 240 : 320);
        return { ...prev, [key]: !prev[key] };
      });
    },
    [configureWalletLayoutAnimation]
  );

  /**
   * Apple Guideline 1.2 — UGC: pomijamy dealroomy z zablokowanym kontrahentem.
   * Lista jest reaktywna na zmiany `blockedIds`, więc kliknięcie „Zablokuj"
   * w czacie powoduje natychmiastowe zniknięcie karty z listy „Wiadomości".
   */
  const blockedIds = useBlockedUsersStore((s) => s.blockedIds);
  const visibleDeals = useMemo(() => {
    if (blockedIds.size === 0) return deals;
    const meId = Number(user?.id || 0);
    return deals.filter((d) => {
      const buyerId = Number(d?.buyerId ?? d?.buyer?.id ?? 0);
      const sellerId = Number(d?.sellerId ?? d?.seller?.id ?? d?.offer?.userId ?? d?.listing?.userId ?? 0);
      const counter =
        buyerId > 0 && buyerId !== meId
          ? buyerId
          : sellerId > 0 && sellerId !== meId
            ? sellerId
            : 0;
      return counter <= 0 || !blockedIds.has(counter);
    });
  }, [deals, blockedIds, user?.id]);

  const dealsSortedFlat = useMemo(() => presentationAndPinSortDeals(visibleDeals), [visibleDeals, presentationAndPinSortDeals]);

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
        const res = await fetch(`${API_URL}/api/mobile/v1/deals`, { headers: { 'Authorization': `Bearer ${token}` } });
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
          const patch: Record<number, string> = {};
          // 1) Najtańszy strzał — single batch z mobile listingu (`includeAll=true`).
          try {
            const offersRes = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const offersJson = await offersRes.json();
            const offersList = Array.isArray(offersJson?.offers) ? offersJson.offers : [];
            for (const o of offersList) {
              const id = Number(o?.id || 0);
              if (!missingOfferIds.has(id)) continue;
              const raw = pickFirstImageFromOfferLike(o);
              const url = raw ? normalizeMediaUrl(raw) : null;
              if (url) patch[id] = url;
            }
          } catch {
            // noop — przejdziemy do fallbacku per-ID
          }
          /*
           * 2) Fallback — dla każdego ID, którego nie pokrył listing (np. oferta
           * agentowska/archiwalna/zamknięta, której endpoint `?includeAll=true`
           * nie pokazuje), strzelamy do pojedynczego web endpointa `/api/offers/:id`.
           * Ten sam wzór, którego używa `OfferDetail` do hydration zamkniętych ofert.
           * Bez tego placeholder z ikoną pozostawał na zawsze.
           */
          const stillMissing: number[] = [];
          missingOfferIds.forEach((id) => {
            if (!patch[id] && !offerImageCacheRef.current[id]) stillMissing.push(id);
          });
          if (stillMissing.length > 0) {
            try {
              const results = await Promise.allSettled(
                stillMissing.map((id) => fetch(`${API_URL}/api/offers/${id}`).then((r) => r.ok ? r.json() : null)),
              );
              results.forEach((res, idx) => {
                if (res.status !== 'fulfilled' || !res.value) return;
                const id = stillMissing[idx];
                const offer = res.value?.offer || res.value?.data || (res.value?.id ? res.value : null);
                if (!offer) return;
                const raw = pickFirstImageFromOfferLike(offer);
                const url = raw ? normalizeMediaUrl(raw) : null;
                if (url) patch[id] = url;
              });
            } catch {
              // noop — placeholder pozostanie, bez awarii UI
            }
          }
          if (Object.keys(patch).length > 0) {
            setOfferImageByOfferId((prev) => ({ ...prev, ...patch }));
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

  const togglePinForStack = useCallback((phase: DealPhase, stackKey: string) => {
    setPinnedStackKeysByPhase((prev) => {
      const current = Array.isArray(prev[phase]) ? prev[phase] : [];
      const isPinned = current.includes(stackKey);
      const nextPhasePins = isPinned ? current.filter((k) => k !== stackKey) : [stackKey, ...current.filter((k) => k !== stackKey)];
      const next = { ...prev, [phase]: nextPhasePins };
      void AsyncStorage.setItem(DEALROOM_STACK_PINS_STORAGE_KEY, JSON.stringify(next));
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
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
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
          {/*
            Wcześniej każda karta dealroomu była osobnym `BlurView`. Przy
            zwijaniu/rozwijaniu sekcji oraz przewijaniu listy iOS musiał
            przerysować rozmytą warstwę szkła dla KAŻDEJ karty — to powodowało
            wyraźne szarpanie. Tu używamy natywnego prostokąta z subtelnym
            gradientem, który wygląda jak szkło, ale jest praktycznie darmowy
            renderowo.
          */}
          <View
            style={[
              styles.dealCard,
              needsAttention && styles.dealCardUnread,
              needsAttention && styles.dealCardBadgeBleed,
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(34,34,40,0.92)', 'rgba(20,20,24,0.96)']
                  : ['rgba(255,255,255,0.95)', 'rgba(247,248,252,0.97)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.dealId}>TX-{deal?.id || '-'}</Text>
                <DealPhasePill phase={listPhase} colors={COLORS} />
              </View>
              <Text style={styles.timeText}>{deal.time}</Text>
            </View>
            {/*
              Pinezka jest renderowana POZA tą kartą — w `cardContainer`
              (Animated.View) na końcu wątku, tak żeby nie wpadała pod
              `overflow: 'hidden'` Swipeable i nie zakrywała zegara.
            */}

            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Pressable onPress={(e) => { e.stopPropagation(); openOfferPreview(deal); }} hitSlop={10}>
                  <Text
                    style={styles.offerTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    allowFontScaling={false}
                  >
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
                  <Text
                    style={styles.userLabel}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    allowFontScaling={false}
                  >
                    {counterparty.sideLabel}:{' '}
                  </Text>
                  <Text
                    style={[styles.userName, { flexShrink: 1 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    allowFontScaling={false}
                  >
                    {counterparty.name}
                  </Text>
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
          </View>
        </Pressable>
        </Swipeable>
        {/*
          3D-pinezka NA wierzchu cardContainer, POZA Swipeable. Dzięki temu
          nie jest klipowana przez `swipeableContainer.overflow: hidden` i
          siedzi PONAD krawędzią karty, w obszarze paddingu — żadnego
          zakrywania zegara ani tytułu.
        */}
        {isPinned ? <Pin3DBadge /> : null}
      </Animated.View>
    );
  };

  const renderPhaseDealsWalletStyle = (phase: DealPhase, phaseDeals: any[]) => {
    const groups = new Map<string, any[]>();
    for (const deal of phaseDeals) {
      const offerId = extractOfferIdFromDeal(deal);
      const key = offerId ? `offer-${offerId}` : `single-${deal?.id}`;
      const arr = groups.get(key) || [];
      arr.push(deal);
      groups.set(key, arr);
    }

    let animIndex = 0;
    const entries = Array.from(groups.entries()).sort((a, b) => {
      const pins = pinnedStackKeysByPhase[phase] || [];
      const ia = pins.indexOf(a[0]);
      const ib = pins.indexOf(b[0]);
      const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
      const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
      return ra - rb;
    });

    return entries.map(([groupKey, dealsInGroup]) => {
      if (dealsInGroup.length <= 1) {
        const node = renderDealCard(dealsInGroup[0], animIndex, phase);
        animIndex += 1;
        return node;
      }
      const offerId = extractOfferIdFromDeal(dealsInGroup[0]) || 0;
      const stackKey = `${phase}:${offerId}`;
      const isExpanded = !!expandedOfferStacks[stackKey];
      const summaryTitle = getReadableDealTitle(dealsInGroup[0]);
      const summaryMeta = buildOfferSummaryLine(dealsInGroup[0]);
      const summaryThumb =
        extractOfferImageFromDeal(dealsInGroup[0]) || (offerId ? offerImageByOfferId[offerId] : null);
      const txBadge = getTransactionBadge(dealsInGroup[0]);
      const isPinnedStack = (pinnedStackKeysByPhase[phase] || []).includes(groupKey);

      if (!isExpanded) {
        const topTabs = dealsInGroup.slice(0, 4);
        const node = (
          <Animated.View
            key={`stack-${groupKey}`}
            style={styles.walletStackWrap}
          >
            <Swipeable
              friction={2}
              overshootLeft={false}
              enableTrackpadTwoFingerGesture
              containerStyle={styles.swipeableContainer}
              childrenContainerStyle={styles.swipeableChild}
              renderLeftActions={(_progress, _drag, swipeable) => (
                <View style={styles.swipeLeftActions}>
                  <RectButton
                    style={[styles.swipePinBtn, isPinnedStack && styles.swipePinBtnActive]}
                    onPress={() => {
                      swipeable.close();
                      togglePinForStack(phase, groupKey);
                    }}
                  >
                    <Pin size={22} color="#fff" fill={isPinnedStack ? '#fff' : 'transparent'} strokeWidth={2.2} />
                    <Text style={styles.swipeActionCaption}>{isPinnedStack ? 'Odepnij' : 'Przypnij'}</Text>
                  </RectButton>
                </View>
              )}
            >
              <Pressable
                style={({ pressed }) => [styles.walletStackPressable, pressed && { opacity: 0.92 }]}
                onPress={() => toggleOfferStack(phase, offerId)}
              >
                {/*
                  Wcześniej każdy zwinięty stos był osobnym `BlurView`. Mając
                  na liście kilkanaście takich kart, GPU musiało odświeżać
                  mocno rozmytą warstwę szkła przy KAŻDYM ruchu palca, co
                  powodowało wyraźne szarpanie podczas grupowania/przewijania.
                  Tu używamy lekkiego, statycznego tła z subtelnym gradientem,
                  które wygląda jak szkło, ale renderuje się jako natywny
                  prostokąt — animacje grupowania są teraz w pełni płynne.
                */}
                <View style={styles.walletStackCard}>
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(40,40,50,0.92)', 'rgba(22,22,30,0.95)']
                        : ['rgba(255,255,255,0.92)', 'rgba(248,249,252,0.95)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.walletNotebookSpine} />
                  <View style={styles.walletNotebookHolesColumn}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={`hole-${i}`} style={styles.walletNotebookHole} />
                    ))}
                  </View>
                  <Text style={styles.walletStackEyebrow}>STOS TRANSAKCJI OFERTY #{offerId || '-'}</Text>
                  <View style={styles.walletPreviewWrap}>
                    <DealOfferThumb uri={summaryThumb} colors={COLORS} />
                    <View style={[styles.walletTxBadgeOnImage, { backgroundColor: txBadge.color }]}>
                      <Text style={styles.walletTxBadgeOnImageText}>{txBadge.label}</Text>
                    </View>
                  </View>
                  <Text
                    style={styles.walletStackTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    allowFontScaling={false}
                  >
                    {summaryTitle}
                  </Text>
                  <Text
                    style={styles.walletStackMeta}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    allowFontScaling={false}
                  >
                    {summaryMeta}
                  </Text>
                  <View style={styles.walletTabsWrap}>
                    {topTabs.map((d, idx) => (
                      (() => {
                        const meta = getStackContactMeta(d, dealMessagesById);
                        const isAppt = meta.kind === 'appointment';
                        const isPrice = meta.kind === 'price';
                        return (
                      <View
                        key={`tab-${d?.id}`}
                        style={[
                          styles.walletCalendarTab,
                          {
                            marginTop: idx === 0 ? 0 : -10,
                            marginLeft: idx * 7,
                            opacity: 1 - idx * 0.11,
                            zIndex: 10 - idx,
                            transform: [{ scale: 1 - idx * 0.012 }],
                          },
                        ]}
                      >
                        <View style={styles.walletTabRow}>
                          <Text style={styles.walletCalendarTabText}>TX-{d?.id}</Text>
                          <View style={styles.walletTabTopic}>
                            {isAppt ? (
                              <CalendarClock size={12} color={COLORS.textMuted} />
                            ) : isPrice ? (
                              <HandCoins size={12} color={COLORS.textMuted} />
                            ) : (
                              <MessageCircle size={12} color={COLORS.textMuted} />
                            )}
                            <Text style={styles.walletTabTopicText} numberOfLines={1}>{meta.text}</Text>
                          </View>
                          <Text style={styles.walletTabDateText}>{meta.atText}</Text>
                        </View>
                      </View>
                        );
                      })()
                    ))}
                  </View>
                  <Text style={styles.walletStackHint}>Przesuń w prawo, aby przypiąć. Dotknij, aby rozłożyć stos.</Text>
                  {/* Pinezka jest renderowana POZA tym kafelkiem (na zewnątrz Swipeable),
                      aby nie zakrywała zawartości stosu. */}
                </View>
              </Pressable>
            </Swipeable>
            {isPinnedStack ? <Pin3DBadge /> : null}
          </Animated.View>
        );
        animIndex += 1;
        return node;
      }

      return (
        <View key={`stack-${groupKey}`} style={styles.walletExpandedWrap}>
          <View style={styles.walletExpandedHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletStackEyebrow}>ROZŁOŻONE KARTY OFERTY #{offerId || '-'}</Text>
              <Text
                style={styles.walletExpandedTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                allowFontScaling={false}
              >
                {summaryTitle}
              </Text>
              <Text
                style={styles.walletStackMeta}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                allowFontScaling={false}
              >
                {summaryMeta}
              </Text>
            </View>
            <Pressable onPress={() => toggleOfferStack(phase, offerId)} style={styles.walletCollapseBtn}>
              <Text style={styles.walletCollapseBtnTxt}>Zwiń</Text>
            </Pressable>
          </View>
          {isPinnedStack ? (
            <View style={styles.pinInlineRow}>
              <Pin size={12} color="#fff" fill="#FF3B30" />
              <Text style={styles.pinInlineText}>Przypięty stos</Text>
            </View>
          ) : null}
          {dealsInGroup.map((deal) => {
            const node = renderDealCard(deal, animIndex, phase);
            animIndex += 1;
            return node;
          })}
        </View>
      );
    });
  };

  const renderCollapsedSectionDeck = useCallback(
    (phase: DealPhase, count: number) => {
      if (count <= 0 || !collapsedSections[phase]) return null;
      const layerCount = Math.min(Math.max(count - 1, 1), 8);
      const tint =
        phase === 'started'
          ? 'rgba(255,214,10,0.22)'
          : phase === 'active'
            ? 'rgba(50,215,75,0.22)'
            : 'rgba(191,90,242,0.24)';

      return (
        <View style={styles.phaseDeckShell}>
          {Array.from({ length: layerCount }).map((_, idx) => (
            <View
              key={`deck-${phase}-${idx}`}
              style={[
                styles.phaseDeckLayer,
                {
                  backgroundColor: tint,
                  transform: [
                    { perspective: 1200 },
                    { translateY: (idx + 1) * 4.2 },
                    { rotateX: `${(idx + 1) * 1.7}deg` },
                    { rotateZ: `${(idx + 1) * -0.4}deg` },
                    { scaleX: 1 - (idx + 1) * 0.012 },
                  ],
                  opacity: Math.max(0.16, 0.34 - idx * 0.03),
                },
              ]}
            />
          ))}
        </View>
      );
    },
    [collapsedSections, styles.phaseDeckLayer, styles.phaseDeckShell]
  );

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
          <Text style={styles.headerTitle}>EstateOS™ Dealrooms</Text>
        </View>
      </BlurView>

      {loading || !sectionsReady ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loaderText}>
            {loading ? 'Wczytywanie transakcji…' : 'Przygotowywanie portfolio…'}
          </Text>
        </Animated.View>
      ) : visibleDeals.length === 0 ? (
        <DealroomsEmptyState
          colors={COLORS}
          onOpenRadar={() => {
            // Wracamy do głównego stacka i przełączamy na zakładkę Radar
            // (`DealroomList` jest pchany ze stacka — `goBack` przywraca tabbar
            // bez utraty stanu Radaru). Jeśli `goBack` nie ma do czego wrócić,
            // fallback: nawigacja imperatywna do MainTabs.
            if (navigation.canGoBack()) {
              navigation.goBack();
              setTimeout(() => {
                navigation.navigate('MainTabs', { screen: 'Radar' });
              }, 80);
            } else {
              navigation.navigate('MainTabs', { screen: 'Radar' });
            }
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!phasesReady && visibleDeals.length > 0 ? (
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
                  <Animated.View
                    entering={FadeInDown.delay(0).springify().damping(15).stiffness(135).mass(0.85)}
                    style={styles.phaseSection}
                  >
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
                  </Animated.View>
                ) : null}

                {groupedDeals.started.length > 0 ? (
                  <Animated.View
                    entering={FadeInDown.delay(90).springify().damping(15).stiffness(135).mass(0.85)}
                    style={[
                      styles.phaseSection,
                      !collapsedSections.started && styles.phaseSectionSurfaceStarted,
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.phaseSectionHeaderRow,
                        collapsedSections.started && [styles.phaseFoldedCard, styles.phaseFoldedCardStarted],
                        sectionNeedsAttention.started && styles.phaseNeedsAttention,
                      ]}
                      onPress={() => toggleSection('started')}
                    >
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
                    {collapsedSections.started
                      ? renderCollapsedSectionDeck('started', groupedDeals.started.length)
                      : renderPhaseDealsWalletStyle('started', groupedDeals.started)}
                  </Animated.View>
                ) : null}

                {groupedDeals.active.length > 0 ? (
                  <Animated.View
                    entering={FadeInDown.delay(180).springify().damping(15).stiffness(135).mass(0.85)}
                    style={[
                      styles.phaseSection,
                      !collapsedSections.active && styles.phaseSectionSurfaceActive,
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.phaseSectionHeaderRow,
                        collapsedSections.active && [styles.phaseFoldedCard, styles.phaseFoldedCardActive],
                        sectionNeedsAttention.active && styles.phaseNeedsAttention,
                      ]}
                      onPress={() => toggleSection('active')}
                    >
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
                    {collapsedSections.active
                      ? renderCollapsedSectionDeck('active', groupedDeals.active.length)
                      : renderPhaseDealsWalletStyle('active', groupedDeals.active)}
                  </Animated.View>
                ) : null}

                {groupedDeals.finalized.length > 0 ? (
                  <Animated.View
                    entering={FadeInDown.delay(270).springify().damping(15).stiffness(135).mass(0.85)}
                    style={[
                      styles.phaseSection,
                      !collapsedSections.finalized && styles.phaseSectionSurfaceFinalized,
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.phaseSectionHeaderRow,
                        collapsedSections.finalized && [styles.phaseFoldedCard, styles.phaseFoldedCardFinalized],
                        sectionNeedsAttention.finalized && styles.phaseNeedsAttention,
                      ]}
                      onPress={() => toggleSection('finalized')}
                    >
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
                    {collapsedSections.finalized
                      ? renderCollapsedSectionDeck('finalized', groupedDeals.finalized.length)
                      : renderPhaseDealsWalletStyle('finalized', groupedDeals.finalized)}
                  </Animated.View>
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
                    <View style={styles.profileAvatarFlag} pointerEvents="none">
                      <UserRegionFlag
                        phone={selectedProfile?.user?.phone || selectedProfile?.user?.contactPhone}
                        fallbackIso="PL"
                        size={28}
                      />
                    </View>
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
                        <Pressable
                          onPress={() => {
                            const reviewerId = Number(r?.reviewerId || 0);
                            if (!reviewerId) return;
                            void openCounterpartyProfile(reviewerId);
                          }}
                          style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
                        >
                          <Text style={styles.reviewAuthorName}>
                            {r?.reviewerName || `Użytkownik #${r?.reviewerId || '-'}`}
                          </Text>
                        </Pressable>
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
                      <Text
                        style={[styles.offerLinkTitle, { flex: 1 }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        allowFontScaling={false}
                      >
                        {o?.title || `Oferta #${o?.id || '-'}`}
                      </Text>
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
  phaseSectionSurfaceStarted: {
    borderRadius: 22,
    padding: 12,
    backgroundColor: colors.yellowDimmed,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.28)',
    shadowColor: '#FFB300',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  phaseSectionSurfaceActive: {
    borderRadius: 22,
    padding: 12,
    backgroundColor: colors.greenDimmed,
    borderWidth: 1,
    borderColor: 'rgba(50,215,75,0.28)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  phaseSectionSurfaceFinalized: {
    borderRadius: 22,
    padding: 12,
    backgroundColor: colors.purpleDimmed,
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.32)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  phaseSectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 2 },
  phaseFoldedCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  phaseNeedsAttention: {
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
  phaseFoldedCardStarted: {
    backgroundColor: 'rgba(255,214,10,0.1)',
    borderColor: 'rgba(255,214,10,0.28)',
  },
  phaseFoldedCardActive: {
    backgroundColor: 'rgba(50,215,75,0.1)',
    borderColor: 'rgba(50,215,75,0.28)',
  },
  phaseFoldedCardFinalized: {
    backgroundColor: 'rgba(191,90,242,0.11)',
    borderColor: 'rgba(191,90,242,0.3)',
  },
  phaseHeaderMeta: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 44, paddingTop: 2, gap: 8 },
  phaseDeckShell: {
    marginTop: -10,
    marginBottom: 8,
    marginHorizontal: 16,
    height: 52,
    position: 'relative',
  },
  phaseDeckLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 4 : 0,
    borderBottomWidth: 1.4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
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
  walletStackWrap: {
    marginBottom: 16,
  },
  walletStackPressable: {
    borderRadius: 22,
    position: 'relative',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: Platform.OS === 'android' ? 16 : 0,
  },
  walletStackCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingLeft: 30,
    minHeight: 180,
    justifyContent: 'center',
    // klipowanie gradientu do zaokrąglonych rogów
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: Platform.OS === 'android' ? 12 : 0,
  },
  walletNotebookSpine: {
    position: 'absolute',
    left: 10,
    top: 10,
    bottom: 10,
    width: 10,
    borderRadius: 8,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  walletNotebookHolesColumn: {
    position: 'absolute',
    left: 13,
    top: 22,
    bottom: 22,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletNotebookHole: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  walletPreviewWrap: {
    width: '100%',
    height: 146,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  walletTxBadgeOnImage: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  walletTxBadgeOnImageText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  walletStackEyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  walletStackTitle: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  walletStackMeta: {
    color: colors.textSec,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  walletTabsWrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  walletCalendarTab: {
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    backgroundColor: colors.cardSolid,
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  walletTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletCalendarTabText: {
    color: colors.textMain,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  walletTabTopic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  walletTabTopicText: {
    color: colors.textSec,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  walletTabDateText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  walletStackHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  walletExpandedWrap: {
    marginBottom: 12,
  },
  walletExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
    gap: 10,
  },
  walletExpandedTitle: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  walletCollapseBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    backgroundColor: colors.cardSolid,
  },
  walletCollapseBtnTxt: {
    color: colors.textSec,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pinInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    marginLeft: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,59,48,0.16)',
    borderColor: 'rgba(255,59,48,0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pinInlineText: {
    color: '#FFB4AF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  /**
   * STARY badge — pozostawiony tylko jako fallback, NIE używać.
   * Aktualnie pinezki kart i stosów są renderowane jako
   * `Pin3DBadge` w `cardContainer` / `walletStackOuterWrap`
   * (patrz `pinHead*` style poniżej) — przez to **nie zakrywają**
   * żadnej zawartości karty (zegara, tytułu itd.).
   */
  pinCornerBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  /*
   * 3D-pinezka jest renderowana przez `Pin3DBadge` ze statycznym
   * `PIN_3D_STYLES` (zdefiniowany powyżej). Tu nie powtarzamy stylów,
   * żeby uniknąć desynchronizacji wyglądu w przyszłości.
   */
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dealId: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  timeText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  
  cardBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, overflow: 'visible' },
  cardInfo: { flex: 1, paddingRight: 16 },
  offerTitle: { color: colors.textMain, fontSize: 19, fontWeight: '700', letterSpacing: 0.2, marginBottom: 4 },
  activityDesc: { color: colors.textSec, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  countdownInCard: { marginTop: 6, alignSelf: 'stretch' },

  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.border, borderRadius: 12 },
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
    position: 'relative',
  },
  profileAvatarFlag: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    zIndex: 3,
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
  reviewAuthorName: { color: colors.textMain, fontSize: 11, fontWeight: '800' },
  reviewDate: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  reviewBody: { color: colors.textMain, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  
  offerLinkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  offerLinkTitle: { color: colors.textMain, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 16 },
});