import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import {
  fetchAgencyCatalog,
  fetchAgencyConciergeDetail,
  requestLeadTransfer,
  type AgencyCatalogItem,
  type AgencyConciergeDetail,
} from '../../services/leadTransferService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  visible: boolean;
  offerId: number;
  offerTitle?: string;
  onClose: () => void;
  onSent?: () => void;
};

type Step = 1 | 2 | 'detail' | 'success';

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <Text style={styles.mutedSmall}>Brak ocen</Text>;
  return (
    <View style={styles.starsRow}>
      <Ionicons name="star" size={14} color="#FFD60A" />
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AgencyDetailBody({
  detail,
  catalogItem,
}: {
  detail: AgencyConciergeDetail;
  catalogItem: AgencyCatalogItem;
}) {
  const avatar = mediaUrl(detail.image || catalogItem.image);
  const since = fmtDate(detail.memberSince);

  return (
    <>
      <View style={styles.detailHero}>
        <View style={styles.agencyAvatarLarge}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Ionicons name="business" size={28} color="#34C759" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.agencyNameLarge} numberOfLines={2}>
            {detail.displayName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Stars rating={detail.stats.averageRating} />
            <Text style={styles.mutedSmall}>{detail.stats.reviewsCount} opinii</Text>
          </View>
          {since ? <Text style={styles.mutedSmall}>Na platformie od {since}</Text> : null}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatPill label="Aktywne oferty" value={detail.stats.activeListings} />
        <StatPill label="Agentów" value={detail.stats.activeAgents} />
        <StatPill label="Concierge" value={detail.stats.conciergeManaged} />
      </View>

      {(detail.offerBreakdown.sell > 0 ||
        detail.offerBreakdown.rent > 0 ||
        detail.offerBreakdown.flats > 0 ||
        detail.offerBreakdown.houses > 0) && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Portfolio biura</Text>
          <Text style={styles.infoLine}>
            Sprzedaż: {detail.offerBreakdown.sell} · Wynajem: {detail.offerBreakdown.rent}
          </Text>
          <Text style={styles.infoLine}>
            Mieszkania: {detail.offerBreakdown.flats} · Domy: {detail.offerBreakdown.houses}
          </Text>
        </View>
      )}

      {detail.address || detail.phone || detail.website ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Kontakt</Text>
          {detail.address ? <Text style={styles.infoLine}>{detail.address}</Text> : null}
          {detail.phone ? <Text style={styles.infoLine}>{detail.phone}</Text> : null}
          {detail.website ? (
            <Pressable onPress={() => void Linking.openURL(detail.website!)}>
              <Text style={[styles.infoLine, { color: '#34C759' }]}>{detail.website}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {detail.reviews.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opinie klientów</Text>
          {detail.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Stars rating={review.rating} />
                {review.authorName ? (
                  <Text style={styles.mutedSmall}>{review.authorName}</Text>
                ) : null}
              </View>
              {review.comment ? (
                <Text style={styles.reviewBody} numberOfLines={5}>
                  {review.comment}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Opinie</Text>
          <Text style={styles.infoLine}>To biuro nie ma jeszcze opinii na EstateOS™.</Text>
        </View>
      )}

      {detail.offers.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Przykładowe aktywne oferty</Text>
          {detail.offers.map((offer) => (
            <View key={offer.id} style={styles.offerRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.offerTitle} numberOfLines={2}>
                  {offer.title}
                </Text>
                <Text style={styles.mutedSmall} numberOfLines={1}>
                  {[offer.city, offer.district].filter(Boolean).join(', ')}
                  {offer.rooms ? ` · ${offer.rooms} pok.` : ''}
                  {offer.area ? ` · ${offer.area} m²` : ''}
                </Text>
              </View>
              <Text style={styles.offerPrice}>{fmtPrice(offer.price)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

export default function AgencyTransferModal({ visible, offerId, offerTitle, onClose, onSent }: Props) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const [step, setStep] = useState<Step>(1);
  const [agencies, setAgencies] = useState<AgencyCatalogItem[]>([]);
  const [selected, setSelected] = useState<AgencyCatalogItem | null>(null);
  const [detail, setDetail] = useState<AgencyConciergeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSelected(null);
    setDetail(null);
    setLoading(true);
    void fetchAgencyCatalog()
      .then(setAgencies)
      .finally(() => setLoading(false));
  }, [visible]);

  const title = useMemo(
    () => (offerTitle?.trim() ? `„${offerTitle.trim()}”` : `Oferta #${offerId}`),
    [offerId, offerTitle],
  );

  const handleClose = () => {
    setStep(1);
    setSelected(null);
    setDetail(null);
    onClose();
  };

  const openAgencyDetail = async (agency: AgencyCatalogItem) => {
    setSelected(agency);
    setDetail(null);
    setStep('detail');
    setDetailLoading(true);
    try {
      const payload = await fetchAgencyConciergeDetail(agency);
      setDetail(payload);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectAgency = async () => {
    if (!token || submitting || !selected) return;
    setSubmitting(true);
    try {
      const res = await requestLeadTransfer(token, { offerId, agencyId: selected.id });
      if (!res.ok) {
        Alert.alert('Concierge', res.message || 'Nie udało się wysłać zapytania.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      onSent?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={26} color="#8E8E93" />
          </Pressable>
        </View>

        {step === 'success' ? (
          <View style={styles.successWrap}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.successTitle}>Zapytanie wysłane</Text>
            <Text style={styles.successBody}>
              Agencja otrzymała powiadomienie i przeanalizuje Twoje ogłoszenie. Gdy prześle warunki współpracy,
              dostaniesz alert — zaakceptujesz je w sekcji Concierge na profilu.
            </Text>
            <Text style={styles.successHint}>
              Do tego czasu oferta pozostaje u Ciebie. Nic nie zmienia się bez Twojej zgody.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={handleClose}>
              <Text style={styles.primaryBtnText}>Rozumiem</Text>
            </Pressable>
          </View>
        ) : step === 1 ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>CONCIERGE</Text>
            <Text style={styles.title}>Oddaj sprzedaż profesjonalnej agencji</Text>
            <Text style={styles.subtitle}>
              {title} — wybierz biuro, które przejmie kontakt z kupującymi i doprowadzi transakcję do końca.
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="shield-checkmark" size={18} color="#34C759" />
                <Text style={styles.infoTitle}>Co się stanie?</Text>
              </View>
              <Text style={styles.infoLine}>1. Wybierasz agencję — wysyłamy im podgląd ogłoszenia.</Text>
              <Text style={styles.infoLine}>2. Biuro proponuje prowizję i zakres usług.</Text>
              <Text style={styles.infoLine}>3. Po Twojej akceptacji agencja przejmuje sprzedaż.</Text>
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => setStep(2)}>
              <Text style={styles.primaryBtnText}>Wybierz agencję</Text>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </Pressable>
          </ScrollView>
        ) : step === 'detail' && selected ? (
          <>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => setStep(2)} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Wróć do listy biur</Text>
              </Pressable>
              <Text style={styles.title}>Profil biura</Text>
              <Text style={styles.subtitle}>Sprawdź doświadczenie i portfolio przed wysłaniem zapytania.</Text>

              {detailLoading ? (
                <ActivityIndicator color="#34C759" style={{ marginTop: 40 }} />
              ) : detail ? (
                <AgencyDetailBody detail={detail} catalogItem={selected} />
              ) : (
                <Text style={[styles.subtitle, { marginTop: 20 }]}>Nie udało się wczytać profilu biura.</Text>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.primaryBtn, { marginTop: 0, opacity: submitting || detailLoading || !detail ? 0.6 : 1 }]}
                disabled={submitting || detailLoading || !detail}
                onPress={() => void handleSelectAgency()}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryBtnText}>Wyślij zapytanie do tego biura</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => setStep(1)} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Wróć do wyjaśnienia</Text>
            </Pressable>
            <Text style={styles.title}>Wybierz biuro</Text>
            <Text style={styles.subtitle}>Katalog zweryfikowanych partnerów EstateOS™ — dotknij, aby zobaczyć szczegóły.</Text>

            {loading ? (
              <ActivityIndicator color="#34C759" style={{ marginTop: 40 }} />
            ) : (
              <View style={{ gap: 10, marginTop: 16 }}>
                {agencies.map((agency) => {
                  const avatar = mediaUrl(agency.image);
                  return (
                    <Pressable
                      key={agency.id}
                      onPress={() => void openAgencyDetail(agency)}
                      style={({ pressed }) => [styles.agencyRow, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View style={styles.agencyAvatar}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : (
                          <Ionicons name="business" size={20} color="#34C759" />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.agencyName} numberOfLines={1}>
                          {agency.displayName}
                        </Text>
                        <Text style={styles.agencyMeta}>
                          {agency.averageRating != null ? `${agency.averageRating} ★ · ` : ''}
                          {agency.reviewsCount} opinii · {agency.activeListings} ofert
                        </Text>
                        {agency.conciergeManaged ? (
                          <Text style={styles.agencyMetaHighlight}>
                            {agency.conciergeManaged} przekazań Concierge
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 20 },
  header: { alignItems: 'flex-end', marginBottom: 8 },
  scroll: { paddingBottom: 24 },
  footer: { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  kicker: { color: '#34C759', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900', marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 21, marginTop: 10 },
  infoCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    gap: 8,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoTitle: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  infoLine: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: '#34C759',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5, textAlign: 'center' },
  backLink: { marginBottom: 8 },
  backLinkText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  agencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
  },
  agencyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyName: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  agencyNameLarge: { color: '#FFF', fontWeight: '900', fontSize: 20, lineHeight: 26 },
  agencyMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  agencyMetaHighlight: { color: '#34C759', fontSize: 10, fontWeight: '700', marginTop: 4 },
  detailHero: { flexDirection: 'row', gap: 14, marginTop: 16, alignItems: 'flex-start' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  statPill: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: { color: '#FFF', fontWeight: '900', fontSize: 18 },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  mutedSmall: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  section: { marginTop: 18, gap: 10 },
  sectionTitle: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  reviewCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    gap: 6,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reviewBody: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19 },
  offerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  offerTitle: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  offerPrice: { color: '#34C759', fontWeight: '900', fontSize: 14 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  successTitle: { color: '#34C759', fontSize: 24, fontWeight: '900', marginTop: 16 },
  successBody: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  successHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
