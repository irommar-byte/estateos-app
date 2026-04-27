import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform, ActivityIndicator, Modal } from 'react-native';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ChevronRight, ChevronLeft, MessageCircle, ShieldCheck, AlertCircle, User, X, Star } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore'; // Prawdziwa autoryzacja

const EVENT_PREFIX = '[[DEAL_EVENT]]';

function parseDealEvent(content?: string) {
  if (!content || !content.startsWith(EVENT_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(EVENT_PREFIX.length));
  } catch {
    return null;
  }
}

function DealStatusPill({ pending, label }: { pending: boolean; label: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (pending) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.35, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      opacity.value = withTiming(1, { duration: 220 });
    }
  }, [pending, opacity]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.statusRow, pending ? styles.statusRowPending : styles.statusRowConfirmed, pulseStyle]}>
      <ShieldCheck size={14} color={pending ? '#facc15' : '#10b981'} strokeWidth={2.5} />
      <Text style={[styles.statusText, pending ? styles.statusTextPending : styles.statusTextConfirmed]}>{label}</Text>
    </Animated.View>
  );
}

export default function DealroomListScreen() {
  const navigation = useNavigation<any>();
  const { token, user } = useAuthStore() as any; // Pobieramy Twój prawdziwy token
  
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedProfileLoading, setSelectedProfileLoading] = useState(false);
  const [openingOfferId, setOpeningOfferId] = useState<number | null>(null);

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
    if (!status) return true; // Brak statusu = nie ukrywamy rekordu
    const inactiveStatuses = ['CLOSED', 'ARCHIVED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'DONE'];
    return !inactiveStatuses.includes(status);
  };

  useEffect(() => {
    const fetchDeals = async () => {
      if (!token) {
        setDeals([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('https://estateos.pl/api/mobile/v1/deals', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const normalizedDeals = normalizeDealsPayload(data);
        const activeDeals = normalizedDeals.filter(isActiveDeal);

        const enrichedDeals = await Promise.all(activeDeals.map(async (deal: any) => {
          const existingCounterpartyId = Number(
            deal?.otherUserId ||
            deal?.userId ||
            deal?.buyerId ||
            deal?.buyer?.id ||
            deal?.sellerId ||
            deal?.seller?.id ||
            0
          );
          if (existingCounterpartyId) return deal;

          try {
            const msgRes = await fetch(`https://estateos.pl/api/mobile/v1/deals/${deal.id}/messages`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const msgData = await msgRes.json();
            const messages = Array.isArray(msgData?.messages) ? msgData.messages : [];
            const myId = Number(user?.id || 0);
            const fromOther = messages
              .slice()
              .reverse()
              .find((m: any) => Number(m?.senderId || 0) && Number(m?.senderId || 0) !== myId);
            if (!fromOther) return deal;

            return {
              ...deal,
              otherUserId: Number(fromOther?.senderId || 0) || null,
              otherUserName: fromOther?.senderName || fromOther?.userName || null,
            };
          } catch {
            return deal;
          }
        }));

        setDeals(enrichedDeals);
      } catch (e) {
        console.error('Błąd pobierania listy transakcji:', e);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeals();
    // Odświeżanie listy co 5 sekund (żeby widzieć nowe wiadomości z zewnątrz)
    const interval = setInterval(fetchDeals, 5000);
    return () => clearInterval(interval);
  }, [token, user?.id]);

  const extractOfferIdFromDeal = (deal: any) => (
    deal?.offerId ||
    deal?.offer?.id ||
    deal?.offer?.offerId ||
    deal?.listingId ||
    deal?.propertyId ||
    null
  );

  const getReadableDealTitle = (deal: any) => {
    const offerId = extractOfferIdFromDeal(deal);
    if (offerId) return `Negocjacja oferty #${offerId}`;
    return 'Negocjacja oferty';
  };

  const getCurrentDealActivity = (deal: any) => {
    const status = String(deal?.status || '').toUpperCase();
    const msg = String(deal?.lastMessage || '').toLowerCase();
    const unread = Number(deal?.unread || 0);

    if (status === 'ACCEPTED') return '✅ Uzgodnione warunki transakcji';
    if (status === 'REJECTED') return '❌ Jedna ze stron odrzuciła propozycję';
    if (status === 'INITIATED') return '🟡 Rozpoczęto rozmowę — oczekiwanie na odpowiedź';

    if (msg.startsWith('[[deal_attachment]]')) return '📎 Ostatnio dodano załącznik';
    if (msg.startsWith('[[deal_event]]') && msg.includes('"appointment"')) return '📅 Trwa ustalanie terminu spotkania';
    if (msg.startsWith('[[deal_event]]') && msg.includes('"bid"')) return '💰 Trwa negocjacja ceny';
    if (msg.includes('zaproponowano termin')) return '📅 Oczekuje propozycja terminu spotkania';
    if (msg.includes('zaproponowano') && msg.includes('cen')) return '💰 Oczekuje propozycja ceny';
    if (unread > 0) return '💬 Czeka nowa wiadomość od kontrahenta';
    return '💬 Aktywna rozmowa negocjacyjna';
  };

  const getDealNegotiationVisual = (deal: any) => {
    const status = String(deal?.status || '').toUpperCase();
    const event = parseDealEvent(String(deal?.lastMessage || ''));
    const action = String(event?.action || '').toUpperCase();
    const hasAcceptedStep = action === 'ACCEPTED' || status === 'ACCEPTED' || status === 'NEGOTIATION';
    const isStartedPending = action === 'PROPOSED' || action === 'COUNTERED' || status === 'INITIATED';
    if (hasAcceptedStep) {
      return { pending: false, label: 'Negocjacje aktywne' };
    }
    if (isStartedPending) {
      return { pending: true, label: 'Start negocjacji' };
    }
    return { pending: true, label: 'Start negocjacji' };
  };

  const getCounterparty = (deal: any) => {
    const me = Number(user?.id || 0);
    const buyerId = Number(deal?.buyerId || deal?.buyer?.id || 0);
    const sellerId = Number(deal?.sellerId || deal?.seller?.id || 0);
    const buyerName = deal?.buyer?.name || deal?.buyerName || null;
    const sellerName = deal?.seller?.name || deal?.sellerName || null;

    if (me && buyerId && me === buyerId) {
      return { sideLabel: 'Sprzedający', id: sellerId || null, name: sellerName || `Użytkownik #${sellerId || '?'}` };
    }
    if (me && sellerId && me === sellerId) {
      return { sideLabel: 'Kupujący', id: buyerId || null, name: buyerName || `Użytkownik #${buyerId || '?'}` };
    }

    if (buyerId && sellerId) {
      const guessedId = me && me === buyerId ? sellerId : buyerId;
      const guessedName = guessedId === sellerId ? sellerName : buyerName;
      return { sideLabel: 'Kontrahent', id: guessedId, name: guessedName || `Użytkownik #${guessedId}` };
    }

    const fallbackId = Number(deal?.otherUserId || deal?.userId || 0) || null;
    const fallbackName = deal?.otherUserName || deal?.userName || (fallbackId ? `Użytkownik #${fallbackId}` : 'Brak danych');
    return { sideLabel: 'Kontrahent', id: fallbackId, name: fallbackName };
  };

  const formatLastMessage = (msg?: string) => {
    const raw = String(msg || '').trim();
    if (!raw) return 'Brak wiadomości.';

    if (raw.startsWith('[[DEAL_ATTACHMENT]]')) return '📎 Wysłano załącznik';
    if (raw.startsWith('[[DEAL_EVENT]]')) {
      if (raw.includes('"APPOINTMENT"')) return '📅 Zdarzenie terminu spotkania';
      if (raw.includes('"BID"')) return '💰 Zdarzenie negocjacji ceny';
      return '🛡️ Zdarzenie negocjacyjne';
    }
    if (raw.startsWith('📅')) return raw;
    if (raw.toLowerCase().includes('zaproponowano termin')) return '📅 Zaproponowano termin spotkania';
    if (raw.toLowerCase().includes('zaproponowano') && raw.toLowerCase().includes('cen')) return '💰 Zaproponowano nową cenę';
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
    } catch {
      // noop
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
      const res = await fetch(`https://estateos.pl/api/mobile/v1/offers?includeAll=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      const offers = Array.isArray(data?.offers) ? data.offers : [];
      const fullOffer = offers.find((o: any) => Number(o?.id || 0) === offerId);
      if (fullOffer) {
        navigation.navigate('OfferDetail', { offer: fullOffer });
      } else {
        navigation.navigate('OfferDetail', { id: offerId });
      }
    } catch {
      navigation.navigate('OfferDetail', { id: offerId });
    } finally {
      setOpeningOfferId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
        >
          <ChevronLeft size={32} color="#ffffff" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>DEALROOM</Text>
          <Text style={styles.headerSubtitle}>TWOJE AKTYWNE TRANSAKCJE</Text>
        </View>
      </View>

      {loading ? (
        <Animated.View entering={FadeIn} style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loaderText}>Pobieranie transakcji...</Text>
        </Animated.View>
      ) : deals.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.loaderCenter}>
          <AlertCircle size={40} color="#444" />
          <Text style={styles.loaderText}>Brak aktywnych transakcji.</Text>
        </Animated.View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {deals.map((deal, index) => (
            <Animated.View key={deal.id} entering={FadeInDown.delay(index * 100).springify().damping(16)}>
              {(() => {
                const counterparty = getCounterparty(deal);
                const displayLastMessage = formatLastMessage(deal.lastMessage);
                const isOpeningThisOffer = openingOfferId === Number(extractOfferIdFromDeal(deal) || 0);
                const negotiationVisual = getDealNegotiationVisual(deal);
                return (
              <Pressable 
                style={({ pressed }) => [styles.dealModule, pressed && styles.dealModulePressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const offerId = extractOfferIdFromDeal(deal);
                  navigation.navigate('DealroomChat', { dealId: deal.id, offerId, title: deal.title });
                }}
              >
                <View style={styles.moduleTop}>
                  <View>
                    <Text style={styles.transactionTopLabel}>TRANSAKCJA #{deal?.id || '-'}</Text>
                    <DealStatusPill pending={negotiationVisual.pending} label={negotiationVisual.label} />
                  </View>
                  <Text style={styles.timeText}>{deal.time}</Text>
                </View>
                <View style={styles.moduleMiddle}>
                  <View style={{ flex: 1 }}>
                    <Pressable
                      onPress={(e: any) => { e?.stopPropagation?.(); openOfferPreview(deal); }}
                      style={({ pressed }) => [pressed && { opacity: 0.7 }, { alignSelf: 'flex-start' }]}
                    >
                      <Text style={styles.dealTitleClickable} numberOfLines={1}>
                        {isOpeningThisOffer ? 'Otwieranie oferty...' : getReadableDealTitle(deal)}
                      </Text>
                    </Pressable>
                    <Text style={styles.activityText} numberOfLines={1}>{getCurrentDealActivity(deal)}</Text>
                    <Pressable
                      onPress={() => openCounterpartyProfile(counterparty.id)}
                      style={({ pressed }) => [styles.counterpartyRow, pressed && { opacity: 0.7 }]}
                    >
                      <User size={12} color="#8E8E93" />
                      <Text style={styles.counterpartyLabel}>Kontrahent: </Text>
                      <Text style={styles.counterpartyNameClickable}>
                        {counterparty.name}
                      </Text>
                    </Pressable>
                  </View>
                  {deal.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{deal.unread}</Text></View>}
                </View>
                <View style={styles.moduleBottom}>
                  <MessageCircle size={14} color={deal.unread > 0 ? '#ffffff' : '#86868b'} />
                  <Text style={[styles.lastMessage, deal.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>{displayLastMessage}</Text>
                  <ChevronRight size={18} color="#444" style={styles.chevron} />
                </View>
              </Pressable>
                );
              })()}
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!selectedProfileId} transparent animationType="fade" onRequestClose={() => setSelectedProfileId(null)}>
        <View style={styles.profileOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedProfileId(null)} />
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileTitle}>Profil użytkownika</Text>
              <Pressable onPress={() => setSelectedProfileId(null)} style={styles.profileClose}>
                <X size={16} color="#fff" />
              </Pressable>
            </View>

            {selectedProfileLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <ActivityIndicator color="#10b981" />
                <Text style={styles.profileMuted}>Ładowanie...</Text>
              </View>
            ) : (
              <>
                {(() => {
                  const reviews = Array.isArray(selectedProfile?.reviews) ? selectedProfile.reviews : [];
                  const avg = reviews.length > 0
                    ? reviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) / reviews.length
                    : 0;
                  return (
                    <>
                      <Text style={styles.profileName}>{selectedProfile?.user?.name || `Użytkownik #${selectedProfileId}`}</Text>
                      <Text style={styles.profileMuted}>ID: {selectedProfile?.user?.id || selectedProfileId}</Text>
                      <View style={styles.profileStars}>
                        {[1, 2, 3, 4, 5].map((s) => {
                          const active = s <= Math.round(avg);
                          return <Star key={s} size={13} color={active ? '#f59e0b' : '#444'} fill={active ? '#f59e0b' : 'transparent'} />;
                        })}
                        <Text style={styles.profileMuted}>{avg.toFixed(1)} • {reviews.length} opinii</Text>
                      </View>
                    </>
                  );
                })()}

                <ScrollView style={styles.profileScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.profileSectionTitle}>Komentarze</Text>
                  {!Array.isArray(selectedProfile?.reviews) || selectedProfile.reviews.length === 0 ? (
                    <Text style={styles.profileMuted}>Brak opinii.</Text>
                  ) : selectedProfile.reviews.slice(0, 8).map((r: any) => (
                    <View key={r.id} style={styles.profileReviewItem}>
                      <View style={styles.profileReviewTop}>
                        <View style={styles.profileReviewStars}>
                          {[1, 2, 3, 4, 5].map((s) => {
                            const active = s <= Number(r?.rating || 0);
                            return <Star key={`${r.id}_${s}`} size={10} color={active ? '#f59e0b' : '#444'} fill={active ? '#f59e0b' : 'transparent'} />;
                          })}
                        </View>
                        <Text style={styles.profileReviewDate}>
                          {r?.createdAt ? new Date(r.createdAt).toLocaleDateString('pl-PL') : ''}
                        </Text>
                      </View>
                      <Text style={styles.profileReviewComment}>{r?.comment || 'Bez komentarza.'}</Text>
                    </View>
                  ))}

                  <Text style={[styles.profileSectionTitle, { marginTop: 12 }]}>Oferty użytkownika</Text>
                  {!Array.isArray(selectedProfile?.offers || selectedProfile?.user?.offers) || (selectedProfile?.offers || selectedProfile?.user?.offers).length === 0 ? (
                    <Text style={styles.profileMuted}>Brak aktywnych ofert.</Text>
                  ) : (selectedProfile?.offers || selectedProfile?.user?.offers).slice(0, 6).map((o: any) => (
                    <Pressable
                      key={o.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedProfileId(null);
                        navigation.navigate('OfferDetail', { offer: o });
                      }}
                      style={({ pressed }) => [styles.profileOfferRow, pressed && { opacity: 0.75 }]}
                    >
                      <Text style={styles.profileOfferTitle} numberOfLines={1}>
                        {o?.title || `Oferta #${o?.id || '-'}`}
                      </Text>
                      <ChevronRight size={14} color="#D4AF37" />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 16, paddingBottom: 20 },
  backButton: {
    marginRight: 12,
    marginLeft: -6,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  backButtonPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#ffffff', fontSize: 26, fontWeight: '700', letterSpacing: 2 },
  headerSubtitle: { color: '#86868b', fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginTop: 2 },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#86868b', fontSize: 13, fontWeight: '500', marginTop: 16, letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  dealModule: { backgroundColor: '#111111', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  dealModulePressed: { backgroundColor: '#1A1A1A', transform: [{ scale: 0.98 }] },
  moduleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  transactionTopLabel: { color: '#6B7280', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusRowPending: { backgroundColor: 'rgba(250, 204, 21, 0.14)' },
  statusRowConfirmed: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  statusTextPending: { color: '#facc15' },
  statusTextConfirmed: { color: '#10b981' },
  timeText: { color: '#666666', fontSize: 12, fontWeight: '500' },
  moduleMiddle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dealTitle: { color: '#ffffff', fontSize: 20, fontWeight: '400', letterSpacing: 0.5 },
  dealTitleClickable: { color: '#D4AF37', fontSize: 20, fontWeight: '700', letterSpacing: 0.5, textDecorationLine: 'underline' },
  activityText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginTop: 6 },
  counterpartyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, alignSelf: 'flex-start' },
  counterpartyLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  counterpartyNameClickable: { color: '#D4AF37', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  badge: { backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#000000', fontSize: 12, fontWeight: '800' },
  moduleBottom: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  lastMessage: { color: '#86868b', fontSize: 14, marginLeft: 8, flex: 1 },
  lastMessageUnread: { color: '#ffffff', fontWeight: '600' },
  chevron: { marginLeft: 'auto' },
  profileOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 18 },
  profileCard: { backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  profileClose: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 10 },
  profileMuted: { color: '#8E8E93', fontSize: 12, marginTop: 4 },
  profileStars: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  profileScroll: { marginTop: 12, maxHeight: 300 },
  profileSectionTitle: { color: '#D4AF37', fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  profileReviewItem: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, marginBottom: 6 },
  profileReviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  profileReviewStars: { flexDirection: 'row', gap: 2 },
  profileReviewDate: { color: '#8E8E93', fontSize: 10, fontWeight: '600' },
  profileReviewComment: { color: '#E5E7EB', fontSize: 12, lineHeight: 17 },
  profileOfferRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 6 },
  profileOfferTitle: { color: '#F3E8C8', fontSize: 12, fontWeight: '700', flex: 1, marginRight: 10 },
});
