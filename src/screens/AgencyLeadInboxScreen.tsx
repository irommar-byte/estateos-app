import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { API_URL } from '../config/network';
import {
  acceptLeadTransfer,
  fetchLeadTransfers,
  proposeLeadTerms,
  rejectLeadTransfer,
} from '../services/leadTransferService';
import type { EnrichedLeadTransfer } from '../types/leadTransfer';
import { LEAD_SERVICE_PRESETS } from '../types/leadTransfer';

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

export default function AgencyLeadInboxScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const isAgency = user?.role === 'AGENT' || user?.role === 'ADMIN' || user?.planType === 'AGENCY';

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<EnrichedLeadTransfer[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [commission, setCommission] = useState<Record<number, string>>({});
  const [terms, setTerms] = useState<Record<number, string>>({});

  const colors = useMemo(
    () => ({
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      separator: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
      accent: '#34C759',
      accentOrange: '#FF9500',
    }),
    [isDark],
  );

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchLeadTransfers(token);
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const pending = useMemo(
    () =>
      leads.filter((l) =>
        isAgency
          ? ['PENDING', 'USER_COUNTER'].includes(l.status)
          : ['TERMS_PROPOSED', 'USER_COUNTER'].includes(l.status),
      ),
    [leads, isAgency],
  );

  const handlePropose = async (lead: EnrichedLeadTransfer) => {
    if (!token) return;
    setBusyId(lead.id);
    try {
      const res = await proposeLeadTerms(token, {
        leadId: lead.id,
        commissionRate: commission[lead.id] || '2.5',
        commissionTerms: terms[lead.id] || LEAD_SERVICE_PRESETS[0],
      });
      if (!res.ok) {
        Alert.alert('Warunki', res.message || 'Nie udało się wysłać.');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (leadId: number) => {
    if (!token) return;
    Alert.alert(
      'Przekazać sprzedaż agencji?',
      'Agencja przejmie kontakt z kupującymi. Zachowasz podgląd oferty i statystyk.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Akceptuję',
          onPress: () => {
            void (async () => {
              setBusyId(leadId);
              try {
                const res = await acceptLeadTransfer(token, leadId);
                if (!res.ok) {
                  Alert.alert('Przekazanie', res.message || 'Nie udało się.');
                  return;
                }
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await reload();
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleReject = async (leadId: number) => {
    if (!token) return;
    setBusyId(leadId);
    try {
      const res = await rejectLeadTransfer(token, leadId);
      if (!res.ok) Alert.alert('Operacja', res.message || 'Nie udało się.');
      else await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.separator }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>
          {isAgency ? 'Zapytania Concierge' : 'Przekazanie do agencji'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
      >
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          <Ionicons name="shield-checkmark" size={22} color={colors.accent} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>Jak działa przekazanie?</Text>
          <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 6 }}>
            {isAgency
              ? 'Właściciel prosi o obsługę sprzedaży. Przejrzyj ogłoszenie, wyślij prowizję i zakres usług — klient dostanie powiadomienie.'
              : 'Agencja proponuje warunki. Po akceptacji przejmuje kontakt z kupującymi — Ty masz podgląd bez odbierania telefonów.'}
          </Text>
        </View>

        {loading && pending.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : pending.length === 0 ? (
          <Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 32 }}>
            Brak aktywnych zapytań o przekazanie.
          </Text>
        ) : (
          pending.map((lead) => (
            <View key={lead.id} style={[styles.leadCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              <Text style={{ color: colors.accentOrange, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                {lead.statusMeta.label.toUpperCase()}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>{lead.statusMeta.hint}</Text>

              <Pressable
                onPress={() => void Linking.openURL(`${API_URL}${lead.offer.href}`)}
                style={[styles.offerPreview, { borderColor: colors.separator }]}
              >
                {mediaUrl(lead.offer.imageUrl) ? (
                  <Image source={{ uri: mediaUrl(lead.offer.imageUrl)! }} style={styles.offerImage} contentFit="cover" />
                ) : (
                  <View style={[styles.offerImage, { backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="home" size={28} color="#8E8E93" />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }} numberOfLines={2}>
                    {lead.offer.title}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                    {lead.offer.locationLabel}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, marginTop: 6 }}>
                    {fmtPrice(lead.offer.pricePln ?? lead.offer.price)}
                  </Text>
                  <Text style={{ color: '#007AFF', fontSize: 11, fontWeight: '700', marginTop: 6 }}>
                    Podgląd ogłoszenia →
                  </Text>
                </View>
              </Pressable>

              {isAgency ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700' }}>
                    Właściciel: {lead.owner.name}
                    {lead.owner.phone ? ` · ${lead.owner.phone}` : ''}
                  </Text>
                  <TextInput
                    placeholder="Prowizja %"
                    placeholderTextColor={colors.secondary}
                    keyboardType="decimal-pad"
                    value={commission[lead.id] ?? ''}
                    onChangeText={(v) => setCommission((p) => ({ ...p, [lead.id]: v }))}
                    style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                  />
                  <TextInput
                    placeholder="Zakres usług"
                    placeholderTextColor={colors.secondary}
                    multiline
                    value={terms[lead.id] ?? ''}
                    onChangeText={(v) => setTerms((p) => ({ ...p, [lead.id]: v }))}
                    style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {LEAD_SERVICE_PRESETS.map((preset) => (
                      <Pressable
                        key={preset}
                        onPress={() => setTerms((p) => ({ ...p, [lead.id]: preset }))}
                        style={[styles.presetChip, { borderColor: colors.separator }]}
                      >
                        <Text style={{ color: colors.secondary, fontSize: 10 }} numberOfLines={2}>
                          {preset.slice(0, 40)}…
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => void handlePropose(lead)}
                      disabled={busyId === lead.id}
                      style={[styles.primaryBtn, { opacity: busyId === lead.id ? 0.6 : 1 }]}
                    >
                      {busyId === lead.id ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Wyślij warunki</Text>
                      )}
                    </Pressable>
                    <Pressable onPress={() => void handleReject(lead.id)} disabled={busyId === lead.id}>
                      <Text style={{ color: colors.secondary, fontWeight: '700' }}>Odrzuć</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 4 }}>
                    Agencja: {lead.agency.name}
                  </Text>
                  {lead.commissionRate != null ? (
                    <View style={[styles.termsBox, { backgroundColor: isDark ? '#132318' : '#E8F8EC' }]}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>Prowizja: {lead.commissionRate}%</Text>
                      {lead.commissionTerms ? (
                        <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                          {lead.commissionTerms}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
                    Po akceptacji agencja przejmuje sprzedaż. Ty zachowujesz podgląd statystyk i zmian ceny.
                  </Text>
                  <View style={[styles.actions, { marginTop: 12 }]}>
                    <Pressable
                      onPress={() => void handleAccept(lead.id)}
                      disabled={busyId === lead.id}
                      style={[styles.primaryBtn, { opacity: busyId === lead.id ? 0.6 : 1 }]}
                    >
                      <Text style={styles.primaryBtnText}>Akceptuję przekazanie</Text>
                    </Pressable>
                    <Pressable onPress={() => void handleReject(lead.id)} disabled={busyId === lead.id}>
                      <Text style={{ color: colors.secondary, fontWeight: '700' }}>Odrzuć</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: { fontSize: 17, fontWeight: '700' },
  infoCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  leadCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  offerPreview: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  offerImage: { width: 88, height: 88, borderRadius: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  presetChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 160,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  primaryBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  termsBox: { borderRadius: 12, padding: 12, marginTop: 8 },
});
