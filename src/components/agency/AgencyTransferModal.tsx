import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { fetchAgencyCatalog, requestLeadTransfer } from '../../services/leadTransferService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  visible: boolean;
  offerId: number;
  offerTitle?: string;
  onClose: () => void;
  onSent?: () => void;
};

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

export default function AgencyTransferModal({ visible, offerId, offerTitle, onClose, onSent }: Props) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agencies, setAgencies] = useState<
    Array<{ id: number; displayName: string; image: string | null; averageRating: number | null; reviewsCount: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
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
    onClose();
  };

  const handleSelectAgency = async (agencyId: number) => {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      const res = await requestLeadTransfer(token, { offerId, agencyId });
      if (!res.ok) {
        Alert.alert('Concierge', res.message || 'Nie udało się wysłać zapytania.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(3);
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

        {step === 3 ? (
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
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => setStep(1)} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Wróć do wyjaśnienia</Text>
            </Pressable>
            <Text style={styles.title}>Wybierz biuro</Text>
            <Text style={styles.subtitle}>Katalog zweryfikowanych partnerów EstateOS™.</Text>

            {loading ? (
              <ActivityIndicator color="#34C759" style={{ marginTop: 40 }} />
            ) : (
              <View style={{ gap: 10, marginTop: 16 }}>
                {agencies.map((agency) => {
                  const avatar = mediaUrl(agency.image);
                  return (
                    <Pressable
                      key={agency.id}
                      disabled={submitting}
                      onPress={() => void handleSelectAgency(agency.id)}
                      style={({ pressed }) => [
                        styles.agencyRow,
                        { opacity: pressed || submitting ? 0.7 : 1 },
                      ]}
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
                          {agency.reviewsCount} opinii
                        </Text>
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
  kicker: { color: '#34C759', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900', marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 21, marginTop: 10 },
  infoCard: {
    marginTop: 20,
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
  primaryBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
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
  agencyName: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  agencyMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  successTitle: { color: '#34C759', fontSize: 24, fontWeight: '900', marginTop: 16 },
  successBody: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  successHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
