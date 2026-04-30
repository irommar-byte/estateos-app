import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, Pressable, Platform, 
  ActivityIndicator, Modal, Appearance, Image,
  type ColorSchemeName,
} from 'react-native';
import Animated, { 
  FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, 
  withRepeat, withSequence, withTiming, withDelay, withSpring, Easing 
} from 'react-native-reanimated';
import { 
  ChevronRight, ChevronLeft, MessageCircle, ShieldCheck, 
  AlertCircle, User, X, Star, ImageIcon
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { API_URL } from '../config/network';

const EVENT_PREFIX = '[[DEAL_EVENT]]';

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
  red: isDark ? '#FF453A' : '#FF3B30',
  shadow: isDark ? '#000000' : '#8A8A93',
  overlay: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)',
});

// === HELPERY ===
function parseDealEvent(content?: string) {
  if (!content || !content.startsWith(EVENT_PREFIX)) return null;
  try { return JSON.parse(content.slice(EVENT_PREFIX.length)); } catch { return null; }
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

// Normalizator adresów URL (Naprawia brakujące obrazki)
function normalizeMediaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${API_URL}${s}`;
  return `${API_URL}/${s.replace(/^\//, '')}`;
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

// === KOMPONENTY ===
function DealStatusPill({ pending, label, colors }: { pending: boolean; label: string; colors: any }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (pending) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ), -1, true
      );
    } else {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [pending, opacity]);
  
  return (
    <Animated.View style={[
      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, borderWidth: 1 },
      pending ? { backgroundColor: colors.yellowDimmed, borderColor: 'rgba(255,214,10,0.2)' } : { backgroundColor: colors.greenDimmed, borderColor: 'rgba(50,215,75,0.2)' },
      useAnimatedStyle(() => ({ opacity: opacity.value }))
    ]}>
      <ShieldCheck size={12} color={pending ? colors.yellow : colors.green} strokeWidth={3} />
      <Text style={[
        { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
        pending ? { color: colors.yellow } : { color: colors.green }
      ]}>{label}</Text>
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
  const [selectedProfileLoading, setSelectedProfileLoading] = useState(false);
  const [openingOfferId, setOpeningOfferId] = useState<number | null>(null);
  const [offerImageByOfferId, setOfferImageByOfferId] = useState<Record<number, string>>({});
  const [counterpartyNameById, setCounterpartyNameById] = useState<Record<number, string>>({});
  const offerImageCacheRef = useRef<Record<number, string>>({});

  useEffect(() => {
    offerImageCacheRef.current = offerImageByOfferId;
  }, [offerImageByOfferId]);

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
    const inactiveStatuses = ['CLOSED', 'ARCHIVED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'DONE'];
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

  const getCurrentDealActivity = (deal: any) => {
    const status = String(deal?.status || '').toUpperCase();
    const msg = String(deal?.lastMessage || '').toLowerCase();
    const unread = Number(deal?.unread || 0);

    if (status === 'ACCEPTED') return 'Uzgodnione warunki transakcji';
    if (status === 'REJECTED') return 'Jedna ze stron odrzuciła propozycję';
    if (status === 'INITIATED') return 'Oczekuje na odpowiedź';

    if (msg.startsWith('[[deal_attachment]]')) return 'Dodano nowy dokument';
    if (msg.startsWith('[[deal_event]]') && msg.includes('"appointment"')) return 'Trwa ustalanie terminu';
    if (msg.startsWith('[[deal_event]]') && msg.includes('"bid"')) return 'Trwa negocjacja ceny';
    if (unread > 0) return 'Masz nową wiadomość';
    return 'Aktywna rozmowa';
  };

  const getDealNegotiationVisual = (deal: any) => {
    const status = String(deal?.status || '').toUpperCase();
    const action = String(parseDealEvent(String(deal?.lastMessage || ''))?.action || '').toUpperCase();
    if (action === 'ACCEPTED' || status === 'ACCEPTED' || status === 'NEGOTIATION') return { pending: false, label: 'Negocjacje aktywne' };
    return { pending: true, label: 'Start negocjacji' };
  };

  const getCounterparty = (deal: any) => {
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
  };

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
    if (!raw) return 'Brak wiadomości.';
    if (raw.startsWith('[[DEAL_ATTACHMENT]]')) return 'Wysłano załącznik 📎';
    if (raw.startsWith('[[DEAL_EVENT]]')) {
      if (raw.includes('"APPOINTMENT"')) return 'Zmiana w proponowanym terminie 📅';
      if (raw.includes('"BID"')) return 'Pojawiła się nowa oferta cenowa 💰';
      return 'Aktualizacja negocjacji 🛡️';
    }
    if (raw.startsWith('📅')) return raw;
    return raw;
  };

  const openCounterpartyProfile = async (userId?: number | null) => {
    if (!userId) return;
    Haptics.selectionAsync();
    setSelectedProfileId(userId);
    setSelectedProfile(null);
    setSelectedProfileLoading(true);
    try {
      const res = await fetch(`https://estateos.pl/api/users/${userId}/public`);
      const data = await res.json();
      if (res.ok && !data?.error) setSelectedProfile(data);
    } catch {} finally { setSelectedProfileLoading(false); }
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
          {deals.map((deal, index) => {
            const counterparty = getCounterparty(deal);
            const negotiationVisual = getDealNegotiationVisual(deal);
            const unreadCount = Number(deal.unread || 0);
            const offerIdNum = extractOfferIdFromDeal(deal);
            const thumbUrl =
              extractOfferImageFromDeal(deal) || (offerIdNum ? offerImageByOfferId[offerIdNum] : null);

            return (
              <Animated.View 
                key={deal.id} 
                entering={FadeInDown.delay(index * 90).springify().damping(12).stiffness(150).mass(0.8)}
                style={[styles.cardContainer, unreadCount > 0 && styles.cardContainerElevated]}
              >
                <Pressable 
                  style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DealroomChat', { dealId: deal.id, offerId: extractOfferIdFromDeal(deal), title: deal.title });
                  }}
                >
                  <BlurView
                    intensity={isDark ? 30 : 60}
                    tint={isDark ? 'dark' : 'light'}
                    style={[
                      styles.dealCard,
                      unreadCount > 0 && styles.dealCardUnread,
                      unreadCount > 0 && styles.dealCardBadgeBleed,
                    ]}
                  >
                    
                    {/* GÓRA KARTY */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.dealId}>TX-{deal?.id || '-'}</Text>
                        <DealStatusPill pending={negotiationVisual.pending} label={negotiationVisual.label} colors={COLORS} />
                      </View>
                      <Text style={styles.timeText}>{deal.time}</Text>
                    </View>

                    {/* ŚRODEK KARTY Z MINIATURKĄ */}
                    <View style={styles.cardBody}>
                      <View style={styles.cardInfo}>
                        <Pressable onPress={(e) => { e.stopPropagation(); openOfferPreview(deal); }} hitSlop={10}>
                          <Text style={styles.offerTitle} numberOfLines={1}>
                            {openingOfferId === Number(extractOfferIdFromDeal(deal) || 0) ? 'Otwieranie...' : getReadableDealTitle(deal)}
                          </Text>
                        </Pressable>
                        <Text style={styles.activityDesc} numberOfLines={1}>{getCurrentDealActivity(deal)}</Text>
                        
                        <Pressable 
                          style={styles.userRow} 
                          onPress={(e) => { e.stopPropagation(); openCounterpartyProfile(counterparty.id); }}
                          hitSlop={10}
                        >
                          <View style={styles.userAvatar}><User size={12} color={COLORS.gold} strokeWidth={2.5}/></View>
                          <Text style={styles.userLabel}>{counterparty.sideLabel}: </Text>
                          <Text style={styles.userName}>{counterparty.name}</Text>
                        </Pressable>
                      </View>

                      {/* Miniaturka + badge poza overflow miniatury, żeby kółko nie było ucinane */}
                      <View style={styles.thumbColumn}>
                        <View style={styles.thumbWrapper}>
                          <DealOfferThumb uri={thumbUrl} colors={COLORS} />
                        </View>
                        {unreadCount > 0 ? <UnreadBadge count={unreadCount} colors={COLORS} /> : null}
                      </View>
                    </View>

                    {/* DÓŁ KARTY */}
                    <View style={styles.cardFooter}>
                      <View style={styles.messagePreviewRow}>
                        <MessageCircle size={15} color={unreadCount > 0 ? COLORS.gold : COLORS.textMuted} strokeWidth={unreadCount > 0 ? 2.5 : 2} />
                        <Text style={[styles.lastMessageText, unreadCount > 0 && styles.lastMessageTextUnread]} numberOfLines={1}>
                          {formatLastMessage(deal.lastMessage)}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={COLORS.textMuted} />
                    </View>

                  </BlurView>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      {/* WIZYTÓWKA MODAL */}
      <Modal visible={!!selectedProfileId} transparent animationType="fade" onRequestClose={() => setSelectedProfileId(null)}>
        <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedProfileId(null)} />
          <Animated.View entering={FadeInDown.springify().damping(15)} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wizytówka Partnera</Text>
              <Pressable onPress={() => { Haptics.selectionAsync(); setSelectedProfileId(null); }} style={styles.modalCloseBtn} hitSlop={15}>
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
                     <User size={36} color={COLORS.gold} strokeWidth={2}/>
                  </View>
                  <Text style={styles.profileName}>{selectedProfile?.user?.name || `Użytkownik #${selectedProfileId}`}</Text>
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

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                </ScrollView>
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
  
  cardContainer: { marginBottom: 16 },
  /** Wyżej od kolejnej karty — żeby badge nie był „pod” sąsiadem */
  cardContainerElevated: {
    zIndex: 20,
    elevation: Platform.OS === 'android' ? 12 : 0,
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
  profileBigAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.goldDimmed, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: colors.goldDimmed },
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