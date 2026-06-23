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
  fetchDelegatedOffers,
  fetchLeadTransfers,
  proposeLeadTerms,
  rejectLeadTransfer,
  type DelegatedOffer,
} from '../services/leadTransferService';
import type { EnrichedLeadTransfer } from '../types/leadTransfer';
import {
  COMMISSION_RATE_DEFAULT,
  countPendingConciergeLeads,
  formatCommissionRate,
  LEAD_CONDITION_CATALOG,
  parseLeadConditions,
  serializeLeadConditions,
} from '../types/leadTransfer';
import CommissionRateSlider from '../components/agency/CommissionRateSlider';
import DelegatedOffersSection from '../components/agency/DelegatedOffersSection';

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function OwnerTermsDisplay({
  commissionRate,
  commissionTerms,
  colors,
  isDark,
}: {
  commissionRate: number;
  commissionTerms: string | null;
  colors: { text: string; secondary: string };
  isDark: boolean;
}) {
  const parsed = parseLeadConditions(commissionTerms);
  return (
    <View style={[styles.termsBox, { backgroundColor: isDark ? '#132318' : '#E8F8EC' }]}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>
        Prowizja: {formatCommissionRate(commissionRate)}
      </Text>
      {parsed.isStructured && parsed.conditions.length > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {parsed.conditions.map((c, i) => (
            <View key={c.id} style={styles.conditionRow}>
              <Text style={styles.conditionIndex}>{i + 1}</Text>
              <Text style={{ color: colors.secondary, fontSize: 13, flex: 1, lineHeight: 19 }}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      ) : parsed.rawText ? (
        <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
          {parsed.rawText}
        </Text>
      ) : null}
      {parsed.customNote ? (
        <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>Uwagi: </Text>
          {parsed.customNote}
        </Text>
      ) : null}
    </View>
  );
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
  const [delegated, setDelegated] = useState<DelegatedOffer[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [commission, setCommission] = useState<Record<number, number>>({});
  const [terms, setTerms] = useState<Record<number, string>>({});
  const [selectedConditions, setSelectedConditions] = useState<Record<number, string[]>>({});

  const colors = useMemo(
    () => ({
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      separator: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
      accent: '#34C759',
      accentOrange: '#FF9500',
      danger: '#FF3B30',
    }),
    [isDark],
  );

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [leadData, delegatedData] = await Promise.all([
        fetchLeadTransfers(token),
        !isAgency ? fetchDelegatedOffers(token) : Promise.resolve([]),
      ]);
      setLeads(leadData);
      setDelegated(delegatedData);
    } finally {
      setLoading(false);
    }
  }, [isAgency, token]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const pending = useMemo(
    () => leads.filter((l) => countPendingConciergeLeads([l], isAgency) === 1),
    [leads, isAgency],
  );
  const pendingCount = useMemo(() => countPendingConciergeLeads(leads, isAgency), [leads, isAgency]);

  const toggleCondition = (leadId: number, id: string) => {
    setSelectedConditions((prev) => {
      const current = prev[leadId] || [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...prev, [leadId]: next };
    });
  };

  const handlePropose = async (lead: EnrichedLeadTransfer) => {
    if (!token) return;
    const conditionIds = selectedConditions[lead.id] || [];
    if (conditionIds.length < 3) {
      setError('Zaznacz co najmniej 3 konkretne warunki obsługi dla klienta.');
      return;
    }
    setBusyId(lead.id);
    setError('');
    try {
      const commissionTerms = serializeLeadConditions(conditionIds, terms[lead.id]);
      const res = await proposeLeadTerms(token, {
        leadId: lead.id,
        commissionRate: String(commission[lead.id] ?? COMMISSION_RATE_DEFAULT),
        commissionTerms,
      });
      if (!res.ok) {
        setError(res.message || 'Nie udało się wysłać.');
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
      'Agencja przejmie kontakt z kupującymi na zaakceptowanych warunkach. Zachowasz podgląd oferty i statystyk.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Akceptuję warunki',
          onPress: () => {
            void (async () => {
              setBusyId(leadId);
              setError('');
              try {
                const res = await acceptLeadTransfer(token, leadId);
                if (!res.ok) {
                  setError(res.message || 'Nie udało się.');
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
    setError('');
    try {
      const res = await rejectLeadTransfer(token, leadId);
      if (!res.ok) setError(res.message || 'Nie udało się.');
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
        {pendingCount > 0 ? (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
        keyboardShouldPersistTaps="handled"
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

        {error ? (
          <View style={[styles.errorBox, { borderColor: `${colors.danger}55`, backgroundColor: `${colors.danger}14` }]}>
            <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text>
          </View>
        ) : null}

        {loading && pending.length === 0 && delegated.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : pending.length === 0 ? (
          <Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 24 }}>
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
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700' }}>
                    Właściciel: {lead.owner.name}
                    {lead.owner.phone ? ` · ${lead.owner.phone}` : ''}
                  </Text>
                  <CommissionRateSlider
                    value={commission[lead.id] ?? COMMISSION_RATE_DEFAULT}
                    onChange={(next) => setCommission((p) => ({ ...p, [lead.id]: next }))}
                    offerPrice={lead.offer.pricePln ?? lead.offer.price}
                    isDark={isDark}
                  />
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700' }}>
                    Zakres usług (min. 3 punkty)
                  </Text>
                  <View style={{ gap: 8 }}>
                    {LEAD_CONDITION_CATALOG.map((item) => {
                      const checked = (selectedConditions[lead.id] || []).includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleCondition(lead.id, item.id)}
                          style={[
                            styles.conditionChip,
                            {
                              borderColor: checked ? colors.accent : colors.separator,
                              backgroundColor: checked
                                ? isDark
                                  ? 'rgba(52,199,89,0.12)'
                                  : 'rgba(52,199,89,0.08)'
                                : 'transparent',
                            },
                          ]}
                        >
                          <Ionicons
                            name={checked ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={checked ? colors.accent : colors.secondary}
                          />
                          <Text style={{ color: colors.text, fontSize: 13, flex: 1, lineHeight: 19 }}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    placeholder="Uwagi dodatkowe (opcjonalnie)"
                    placeholderTextColor={colors.secondary}
                    multiline
                    value={terms[lead.id] ?? ''}
                    onChangeText={(v) => setTerms((p) => ({ ...p, [lead.id]: v }))}
                    style={[
                      styles.input,
                      styles.textArea,
                      {
                        color: colors.text,
                        borderColor: colors.separator,
                        backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      },
                    ]}
                  />
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

                  {lead.status === 'PENDING' ? (
                    <View style={[styles.waitingBox, { backgroundColor: isDark ? '#0A1A33' : '#E8F0FF' }]}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>Zlecenie w analizie</Text>
                      <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                        Agencja przejrzy ogłoszenie i prześle konkretną listę warunków. Twoja oferta pozostaje u
                        Ciebie — nic się nie zmienia bez Twojej akceptacji.
                      </Text>
                    </View>
                  ) : null}

                  {lead.status === 'TERMS_PROPOSED' && lead.commissionRate != null ? (
                    <>
                      <OwnerTermsDisplay
                        commissionRate={lead.commissionRate}
                        commissionTerms={lead.commissionTerms}
                        colors={colors}
                        isDark={isDark}
                      />
                      <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
                        Akceptując, przekazujesz sprzedaż agencji na powyższych warunkach. Zachowujesz podgląd
                        statystyk i zmian ceny.
                      </Text>
                      <View style={[styles.actions, { marginTop: 12 }]}>
                        <Pressable
                          onPress={() => void handleAccept(lead.id)}
                          disabled={busyId === lead.id}
                          style={[styles.primaryBtn, { opacity: busyId === lead.id ? 0.6 : 1 }]}
                        >
                          <Text style={styles.primaryBtnText}>Akceptuję warunki</Text>
                        </Pressable>
                        <Pressable onPress={() => void handleReject(lead.id)} disabled={busyId === lead.id}>
                          <Text style={{ color: colors.secondary, fontWeight: '700' }}>Odrzuć</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : lead.status === 'USER_COUNTER' ? (
                    <View style={[styles.waitingBox, { backgroundColor: isDark ? '#1A1408' : '#FFF8E8' }]}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>Twoja kontrpropozycja</Text>
                      <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                        Agencja została powiadomiona — poczekaj na nową propozycję warunków.
                      </Text>
                    </View>
                  ) : null}

                  {lead.status !== 'TERMS_PROPOSED' ? (
                    <Pressable
                      onPress={() => void handleReject(lead.id)}
                      disabled={busyId === lead.id}
                      style={{ marginTop: 12, alignSelf: 'flex-start' }}
                    >
                      <Text style={{ color: colors.secondary, fontWeight: '700' }}>Anuluj zapytanie</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          ))
        )}

        {!isAgency ? <DelegatedOffersSection offers={delegated} isDark={isDark} /> : null}
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
  navBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  navBadgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  infoCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
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
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' },
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
  waitingBox: { borderRadius: 12, padding: 12, marginTop: 8 },
  conditionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  conditionIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.15)',
    color: '#34C759',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
});
