import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import CommissionRateSlider from '../components/agency/CommissionRateSlider';
import SignaturePad from '../components/agency/SignaturePad';
import {
  acquisitionAction,
  archiveAgencyClient,
  fetchAcquisition,
  fetchAgencyClient,
  patchAgencyClient,
  proposeClientOffers,
  refreshClientMatches,
  saveAcquisition,
  suggestAddresses,
  uploadAcquisitionPaper,
  type AcquisitionFormData,
  type AcquisitionRecord,
  type AgencyClientDetail,
} from '../services/agencyClientService';

const STEPS = [
  { id: 1, title: 'Spotkanie' },
  { id: 2, title: 'Stan prawny' },
  { id: 3, title: 'Nieruchomość' },
  { id: 4, title: 'Strategia' },
  { id: 5, title: 'Współpraca' },
  { id: 6, title: 'Podpis' },
];

function setSection(form: AcquisitionFormData, section: keyof AcquisitionFormData, patch: Record<string, unknown>): AcquisitionFormData {
  const current = form[section];
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    return { ...form, [section]: { ...(current as object), ...patch } };
  }
  return form;
}

export default function AgencyClientDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const clientId = Number(route.params?.clientId);
  const [client, setClient] = useState<AgencyClientDetail | null>(null);
  const [form, setForm] = useState<AcquisitionFormData | null>(null);
  const [record, setRecord] = useState<AcquisitionRecord | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  const [addressHints, setAddressHints] = useState<Array<{ id: string; label: string }>>([]);

  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
  };

  const load = useCallback(async () => {
    if (!token || !clientId) return;
    const detail = await fetchAgencyClient(token, clientId);
    if (!detail.ok) {
      Alert.alert('Klient', detail.message);
      return;
    }
    setClient(detail.client);
    setSignerName(`${detail.client.firstName} ${detail.client.lastName}`.trim());
    setSignerEmail(detail.client.email || '');
    if (detail.client.type === 'SELLER') {
      const acq = await fetchAcquisition(token, clientId);
      if (acq.ok) {
        setRecord(acq.acquisition);
        setForm(acq.acquisition?.formData || acq.defaultForm);
        setStep(acq.acquisition?.currentStep || 1);
      }
    }
  }, [token, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const signed = record?.status === 'SIGNED';
  const expectedPrice = Number(String(form?.strategy?.expectedPrice || '').replace(/\s/g, '').replace(',', '.')) || 0;
  const commissionValue = Number(String(form?.cooperation?.commissionValue || '').replace(',', '.')) || 2.5;

  const persist = async (nextStep = step) => {
    if (!token || !form || signed) return;
    setBusy('save');
    const res = await saveAcquisition(token, clientId, { formData: form, currentStep: nextStep, status: 'IN_MEETING' });
    setBusy('');
    if (!res.ok) {
      Alert.alert('Pozyskanie', res.message);
      return;
    }
    setRecord(res.acquisition);
    setStep(nextStep);
  };

  const runAction = async (name: 'prepare_terms' | 'send_preview' | 'sign') => {
    if (!token || !form) return;
    setBusy(name);
    const res = await acquisitionAction(token, clientId, {
      action: name,
      formData: form,
      currentStep: 6,
      approvedTemplateConfirmed: templateConfirmed,
      signerName,
      signerEmail,
      signatureData,
    });
    setBusy('');
    if (!res.ok) {
      Alert.alert('Pozyskanie', res.message);
      return;
    }
    setRecord(res.acquisition);
    setStep(6);
  };

  const field = (section: keyof AcquisitionFormData, key: string, label: string, extra?: { address?: boolean }) => {
    const value = String((form?.[section] as Record<string, unknown>)?.[key] || '');
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text>
        <TextInput
          editable={!signed}
          value={value}
          onChangeText={async (text) => {
            setForm((current) => (current ? setSection(current, section, { [key]: text }) : current));
            if (extra?.address && token && text.length >= 3) {
              setAddressHints(await suggestAddresses(token, text));
            }
          }}
          style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
        />
        {extra?.address
          ? addressHints.map((hint) => (
              <Pressable
                key={hint.id}
                onPress={() => {
                  setForm((current) => (current ? setSection(current, section, { [key]: hint.label }) : current));
                  setAddressHints([]);
                }}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: colors.secondary }}>{hint.label}</Text>
              </Pressable>
            ))
          : null}
      </View>
    );
  };

  const stepper = (section: keyof AcquisitionFormData, key: string, label: string, stepValue = 1) => {
    const value = String((form?.[section] as Record<string, unknown>)?.[key] || '');
    const numeric = Number(String(value).replace(',', '.')) || 0;
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Pressable
            onPress={() => setForm((current) => (current ? setSection(current, section, { [key]: String(Math.max(0, numeric - stepValue)) }) : current))}
            style={[styles.stepBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <TextInput
            value={value}
            editable={!signed}
            keyboardType="numeric"
            onChangeText={(text) => setForm((current) => (current ? setSection(current, section, { [key]: text }) : current))}
            style={[styles.input, { flex: 1, backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 0, textAlign: 'center' }]}
          />
          <Pressable
            onPress={() => setForm((current) => (current ? setSection(current, section, { [key]: String(numeric + stepValue) }) : current))}
            style={[styles.stepBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>
    );
  };

  const matches = client?.matches || [];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
          {client ? `${client.firstName} ${client.lastName}` : 'Klient'}
        </Text>
        <Pressable
          onPress={() => {
            Alert.alert('Archiwum', 'Zarchiwizować tego klienta?', [
              { text: 'Anuluj', style: 'cancel' },
              {
                text: 'Archiwizuj',
                style: 'destructive',
                onPress: async () => {
                  if (!token) return;
                  const res = await archiveAgencyClient(token, clientId);
                  if (res.ok) navigation.goBack();
                  else Alert.alert('Klient', res.message);
                },
              },
            ]);
          }}
          hitSlop={12}
          style={styles.navBtn}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {!client ? <ActivityIndicator color="#34C759" /> : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: '#34C759', fontSize: 10, fontWeight: '800' }}>{client.type === 'SELLER' ? 'SPRZEDAJĄCY' : 'KUPUJĄCY'}</Text>
              <Text style={{ color: colors.text, fontSize: 16, marginTop: 6 }}>{client.email || 'Brak e-mail'}</Text>
              <Text style={{ color: colors.secondary, marginTop: 4 }}>{client.phone || 'Brak telefonu'}</Text>
              {client.portalUrl ? (
                <Pressable onPress={() => Linking.openURL(client.portalUrl!.startsWith('http') ? client.portalUrl! : `https://estateos.pl${client.portalUrl}`)}>
                  <Text style={{ color: '#007AFF', marginTop: 8, fontWeight: '700' }}>Otwórz panel klienta</Text>
                </Pressable>
              ) : null}
            </View>

            {client.type === 'SELLER' && form ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Karta pozyskania</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
                  {STEPS.map((item) => (
                    <Pressable key={item.id} onPress={() => setStep(item.id)} style={[styles.stepChip, { backgroundColor: step === item.id ? '#34C759' : colors.input }]}>
                      <Text style={{ fontWeight: '800', color: step === item.id ? '#000' : colors.text }}>{item.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {step === 1 ? (
                  <>
                    {field('meeting', 'startsAt', 'TERMIN')}
                    {field('meeting', 'location', 'MIEJSCE', { address: true })}
                    {field('meeting', 'clientGoal', 'CEL KLIENTA')}
                    {field('meeting', 'targetTimeline', 'TERMIN SPRZEDAŻY')}
                    {field('meeting', 'reasonForSale', 'MOTYWACJA')}
                  </>
                ) : null}
                {step === 2 ? (
                  <>
                    {field('ownership', 'owners', 'WŁAŚCICIELE')}
                    {field('ownership', 'landRegisterNumber', 'KSIĘGA WIECZYSTA')}
                    {field('ownership', 'mortgage', 'HIPOTEKA')}
                    {field('ownership', 'encumbrances', 'OBCIĄŻENIA')}
                  </>
                ) : null}
                {step === 3 ? (
                  <>
                    {field('property', 'address', 'ADRES', { address: true })}
                    {field('property', 'propertyType', 'RODZAJ')}
                    {stepper('property', 'area', 'POWIERZCHNIA m²')}
                    {stepper('property', 'rooms', 'POKOJE')}
                    {stepper('property', 'floor', 'PIĘTRO')}
                    {stepper('property', 'yearBuilt', 'ROK BUDOWY')}
                  </>
                ) : null}
                {step === 4 ? (
                  <>
                    {stepper('strategy', 'expectedPrice', 'CENA OCZEKIWANA', 5000)}
                    {stepper('strategy', 'recommendedPrice', 'CENA REKOMENDOWANA', 5000)}
                    {stepper('strategy', 'minimumPrice', 'DOLNA GRANICA', 5000)}
                  </>
                ) : null}
                {step === 5 ? (
                  <>
                    {stepper('cooperation', 'durationMonths', 'OKRES (MIESIĄCE)')}
                    <CommissionRateSlider value={commissionValue} onChange={(value) => setForm((current) => (current ? setSection(current, 'cooperation', { commissionValue: String(value), commissionType: 'PERCENT' }) : current))} offerPrice={expectedPrice} isDark={isDark} />
                  </>
                ) : null}
                {step === 6 ? (
                  <>
                    <Pressable disabled={signed || Boolean(busy)} onPress={() => void runAction('prepare_terms')} style={styles.primary}>
                      <Text style={styles.primaryText}>{busy === 'prepare_terms' ? 'Przygotowuję…' : 'Przygotuj warunki'}</Text>
                    </Pressable>
                    <Pressable
                      disabled={signed}
                      onPress={async () => {
                        const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/pdf', 'image/*'] });
                        if (picked.canceled || !picked.assets?.[0] || !token) return;
                        const asset = picked.assets[0];
                        const res = await uploadAcquisitionPaper(token, clientId, {
                          uri: asset.uri,
                          name: asset.name || 'umowa.pdf',
                          mimeType: asset.mimeType || 'application/pdf',
                        });
                        if (!res.ok) Alert.alert('Umowa', res.message);
                        else if (res.formData) setForm(res.formData);
                      }}
                      style={[styles.secondary, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800' }}>Wgraj skan umowy</Text>
                    </Pressable>
                    {(form.paperContracts || []).map((file) => (
                      <Pressable key={file.url} onPress={() => Linking.openURL(file.url.startsWith('http') ? file.url : `https://estateos.pl${file.url}`)}>
                        <Text style={{ color: '#007AFF', marginTop: 8 }}>{file.name}</Text>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => setTemplateConfirmed((v) => !v)} style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
                      <Ionicons name={templateConfirmed ? 'checkbox' : 'square-outline'} size={22} color="#34C759" />
                      <Text style={{ color: colors.text, flex: 1 }}>Potwierdzam zatwierdzony wzór firmy</Text>
                    </Pressable>
                    <TextInput value={signerName} onChangeText={setSignerName} style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]} />
                    <TextInput value={signerEmail} onChangeText={setSignerEmail} autoCapitalize="none" style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]} />
                    <SignaturePad isDark={isDark} onChange={setSignatureData} disabled={signed} />
                    <Pressable disabled={signed || !signatureData || !templateConfirmed} onPress={() => void runAction('sign')} style={[styles.primary, { opacity: signed || !signatureData || !templateConfirmed ? 0.5 : 1 }]}>
                      <Text style={styles.primaryText}>{busy === 'sign' ? 'Podpisuję…' : 'Podpisz i wyślij kopię'}</Text>
                    </Pressable>
                  </>
                ) : null}
                {!signed && step < 6 ? (
                  <Pressable onPress={() => void persist(step + 1)} style={styles.primary}>
                    <Text style={styles.primaryText}>{busy === 'save' ? 'Zapisuję…' : 'Zapisz i dalej'}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                  {client.type === 'SELLER' ? 'Radar zakupowy' : 'Dopasowania'}
                </Text>
                <Pressable
                  onPress={async () => {
                    if (!token) return;
                    setBusy('matches');
                    const res = await refreshClientMatches(token, clientId);
                    setBusy('');
                    if (!res.ok) Alert.alert('Radar', res.message);
                    else void load();
                  }}
                >
                  <Text style={{ color: '#34C759', fontWeight: '800' }}>{busy === 'matches' ? '…' : 'Odśwież'}</Text>
                </Pressable>
              </View>
              {client.type === 'SELLER' && !client.buyerFilters ? (
                <Pressable
                  onPress={async () => {
                    if (!token) return;
                    await patchAgencyClient(token, clientId, {
                      alsoSearching: true,
                      buyerFilters: {
                        calibrationMode: 'CITY',
                        transactionType: 'SELL',
                        propertyType: 'FLAT',
                        city: client.sellerCity || 'Warszawa',
                        selectedDistricts: [],
                        maxPrice: 0,
                        minArea: 0,
                        minYear: 1900,
                        requireBalcony: false,
                        requireGarden: false,
                        requireElevator: false,
                        requireParking: false,
                        requireFurnished: false,
                        requireTwoLevel: false,
                        pushNotifications: false,
                        matchThreshold: 70,
                        lat: null,
                        lng: null,
                        radiusKm: null,
                      },
                    });
                    void load();
                  }}
                  style={[styles.secondary, { borderColor: colors.border, marginTop: 12 }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Włącz „klient też szuka”</Text>
                </Pressable>
              ) : null}
              {matches.map((match) => (
                <View key={match.id} style={[styles.match, { borderColor: colors.border }]}>
                  <Image source={{ uri: match.offer.imageUrl }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{match.offer.title}</Text>
                    <Text style={{ color: colors.secondary, marginTop: 4 }}>
                      {match.offer.city} · {Math.round(match.offer.price).toLocaleString('pl-PL')} zł · {match.score}%
                    </Text>
                    {match.clientFeedback ? <Text style={{ color: '#FF9F0A', marginTop: 6 }}>{match.clientFeedback}</Text> : null}
                  </View>
                  <Pressable
                    onPress={async () => {
                      if (!token) return;
                      const res = await proposeClientOffers(token, clientId, [match.offer.id]);
                      if (!res.ok) Alert.alert('Propozycja', res.message);
                      else {
                        Alert.alert('Propozycja', 'Oferta została zaproponowana klientowi.');
                        void load();
                      }
                    }}
                  >
                    <Text style={{ color: '#34C759', fontWeight: '800', fontSize: 11 }}>{match.notifiedAt ? 'Wysłano' : 'Zaproponuj'}</Text>
                  </Pressable>
                </View>
              ))}
              {matches.length === 0 ? <Text style={{ color: colors.secondary, marginTop: 10 }}>Brak dopasowań.</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 14 },
  input: { marginTop: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  stepChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  primary: { marginTop: 12, backgroundColor: '#34C759', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { fontWeight: '800', color: '#000' },
  secondary: { marginTop: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: 'center' },
  match: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#333' },
});
