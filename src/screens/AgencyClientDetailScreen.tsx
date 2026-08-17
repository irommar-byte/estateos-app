import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import CommissionRateSlider from '../components/agency/CommissionRateSlider';
import SignaturePad from '../components/agency/SignaturePad';
import AcquisitionStepIndicator from '../components/agency/AcquisitionStepIndicator';
import AcquisitionDatePickerModal from '../components/agency/AcquisitionDatePickerModal';
import AcquisitionAddressMapField from '../components/agency/AcquisitionAddressMapField';
import AcquisitionRoomScanner, { type RoomItem } from '../components/agency/AcquisitionRoomScanner';
import AcquisitionKwField from '../components/agency/AcquisitionKwField';
import MultiSelectChipGroup from '../components/agency/MultiSelectChipGroup';
import AddOfferWheelPickerColumn from './AddOffer/AddOfferWheelPickerColumn';
import { buildYearBuiltPickerValues } from '../lib/offerYearBuilt';
import {
  acquisitionAction,
  archiveAgencyClient,
  createOfferFromAcquisition,
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
import { formatCurrencyPLN, formatPhoneNumber, formatPriceInput, parseGroupedNumber } from '../utils/crmFormatters';

const STEPS = [
  { id: 1, title: 'Spotkanie' },
  { id: 2, title: 'Stan prawny' },
  { id: 3, title: 'Nieruchomość' },
  { id: 4, title: 'Strategia' },
  { id: 5, title: 'Współpraca' },
  { id: 6, title: 'Podpis' },
];

const ROOM_OPTIONS = ['', ...Array.from({ length: 10 }, (_, i) => String(i + 1))].map((value) => ({
  value,
  label: value || '—',
}));
const FLOOR_OPTIONS = ['', 'Parter', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].map((value) => ({
  value: value === 'Parter' ? '0' : value,
  label: value || '—',
}));
const YEAR_OPTIONS = buildYearBuiltPickerValues().map((value) => ({
  value,
  label: value || '—',
}));
const AREA_OPTIONS = (() => {
  const numeric = new Set<number>();
  for (let i = 15; i <= 80; i += 1) numeric.add(i);
  for (let i = 82; i <= 120; i += 2) numeric.add(i);
  for (let i = 125; i <= 200; i += 5) numeric.add(i);
  for (let i = 210; i <= 400; i += 10) numeric.add(i);
  return ['', ...Array.from(numeric).sort((a, b) => a - b).map(String)].map((value) => ({
    value,
    label: value ? `${value} m²` : '—',
  }));
})();

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

  // Mobile UX Controls
  const [isSigning, setIsSigning] = useState(false);
  const [dateModalField, setDateModalField] = useState<string | null>(null); // 'startsAt' | 'targetTimeline'
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [planImages, setPlanImages] = useState<string[]>([]);

  // Seller Buyer Radar Controls
  const [sellerRadarSearching, setSellerRadarSearching] = useState(false);
  const [sellerRadarCity, setSellerRadarCity] = useState('Warszawa');
  const [sellerRadarMaxPrice, setSellerRadarMaxPrice] = useState('');
  const [sellerRadarMinArea, setSellerRadarMinArea] = useState('');

  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    accent: '#34C759',
  };

  const [creatingOffer, setCreatingOffer] = useState(false);

  const handleCreateOfferFromAcquisition = async () => {
    if (!token || !client?.id) return;
    setCreatingOffer(true);
    try {
      const res = await createOfferFromAcquisition(token, client.id);
      if (!res.ok) {
        Alert.alert('Oferta z karty', res.message);
        return;
      }
      Alert.alert(
        'Oferta utworzona!',
        `Nowa oferta #${res.offerId} została pomyślnie utworzona z danych karty pozyskania i przypisana do klienta.`,
        [{ text: 'OK', onPress: () => void load() }]
      );
    } finally {
      setCreatingOffer(false);
    }
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

    if (detail.client.buyerFilters) {
      setSellerRadarSearching(true);
      setSellerRadarCity(String(detail.client.buyerFilters.city || 'Warszawa'));
      setSellerRadarMaxPrice(formatPriceInput(String(detail.client.buyerFilters.maxPrice || '')));
      setSellerRadarMinArea(String(detail.client.buyerFilters.minArea || ''));
    }

    if (detail.client.type === 'SELLER') {
      const acq = await fetchAcquisition(token, clientId);
      if (acq.ok) {
        setRecord(acq.acquisition);
        const nextForm = acq.acquisition?.formData || acq.defaultForm;
        setForm(nextForm);
        setStep(acq.acquisition?.currentStep || 1);
        try {
          const storedRooms = JSON.parse(String((nextForm.property as Record<string, unknown>)?.roomsJson || '[]'));
          if (Array.isArray(storedRooms)) setRooms(storedRooms);
        } catch {
          /* ignore */
        }
        const storedPlans = String((nextForm.property as Record<string, unknown>)?.planImages || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (storedPlans.length) setPlanImages(storedPlans);
      }
    }
  }, [token, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Autosave draft check
  const DRAFT_KEY = `@eos_acq_detail_draft_${clientId}`;
  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.form && !record?.signedAt) {
            Alert.alert(
              'Niezapisany szkic pozyskania',
              'Wykryto niezapisane zmiany z poprzedniej sesji. Czy chcesz je przywrócić?',
              [
                { text: 'Odrzuć', style: 'destructive', onPress: () => void AsyncStorage.removeItem(DRAFT_KEY) },
                {
                  text: 'Przywróć',
                  onPress: () => {
                    if (parsed.form) setForm(parsed.form);
                    if (parsed.step) setStep(parsed.step);
                  },
                },
              ]
            );
          }
        }
      } catch {}
    })();
  }, [clientId, record?.signedAt]);

  useEffect(() => {
    if (!form) return;
    setForm((current) =>
      current
        ? setSection(current, 'property', {
            roomsJson: JSON.stringify(rooms),
            planImages: planImages.join(','),
          })
        : current,
    );
  }, [rooms, planImages]);

  useEffect(() => {
    if (!clientId || !form) return;
    const t = setTimeout(() => {
      void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
    }, 500);
    return () => clearTimeout(t);
  }, [clientId, form, step]);

  const signed = record?.status === 'SIGNED';
  const expectedPrice = parseGroupedNumber(form?.strategy?.expectedPrice);
  const commissionValue = parseGroupedNumber(form?.cooperation?.commissionValue) || 2.5;

  // Recommended price computation
  const areaNum = parseGroupedNumber(form?.property?.area) || 50;
  const calculatedRecommendedPrice = Math.round(areaNum * 14500);

  const persist = async (nextStep = step) => {
    if (!token || !form || signed) return;
    setBusy('save');
    const res = await saveAcquisition(token, clientId, { formData: form, currentStep: nextStep, status: 'IN_MEETING' });
    setBusy('');
    if (!res.ok) {
      Alert.alert('Pozyskanie', res.message);
      return;
    }
    await AsyncStorage.removeItem(DRAFT_KEY);
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

  const field = (
    section: keyof AcquisitionFormData,
    key: string,
    label: string,
    extra?: { address?: boolean; isDate?: boolean; isKW?: boolean }
  ) => {
    const value = String((form?.[section] as Record<string, unknown>)?.[key] || '');
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TextInput
            editable={!signed}
            value={value}
            onChangeText={async (text) => {
              setForm((current) => (current ? setSection(current, section, { [key]: text }) : current));
              if (extra?.address && token && text.length >= 3) {
                setAddressHints(await suggestAddresses(token, text));
              }
            }}
            style={[styles.input, { flex: 1, backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          />
          {extra?.isDate && (
            <Pressable
              disabled={signed}
              onPress={() => setDateModalField(key)}
              style={[styles.iconBtn, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="calendar-outline" size={20} color="#000" />
            </Pressable>
          )}
          {extra?.isKW && (
            <Pressable
              onPress={() => Linking.openURL('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW')}
              style={[styles.iconBtn, { backgroundColor: '#007AFF' }]}
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
            </Pressable>
          )}
        </View>

        {extra?.address && addressHints.length > 0
          ? addressHints.map((hint) => (
              <Pressable
                key={hint.id}
                onPress={() => {
                  setForm((current) => (current ? setSection(current, section, { [key]: hint.label }) : current));
                  setAddressHints([]);
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 4 }}
              >
                <Text style={{ color: colors.accent, fontWeight: '700' }}>📍 {hint.label}</Text>
              </Pressable>
            ))
          : null}
      </View>
    );
  };

  const stepper = (section: keyof AcquisitionFormData, key: string, label: string, stepValue = 1, money = false) => {
    const value = String((form?.[section] as Record<string, unknown>)?.[key] || '');
    const numeric = parseGroupedNumber(value);
    const display = money ? (value ? formatPriceInput(String(numeric || value)) : '') : value;
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Pressable
            disabled={signed}
            onPress={() =>
              setForm((current) =>
                current
                  ? setSection(current, section, {
                      [key]: money ? formatPriceInput(String(Math.max(0, numeric - stepValue))) : String(Math.max(0, numeric - stepValue)),
                    })
                  : current
              )
            }
            style={[styles.stepBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <TextInput
            value={display}
            editable={!signed}
            keyboardType="numeric"
            onChangeText={(text) =>
              setForm((current) =>
                current ? setSection(current, section, { [key]: money ? formatPriceInput(text) : text }) : current
              )
            }
            style={[
              styles.input,
              { flex: 1, backgroundColor: colors.input, color: colors.text, borderColor: colors.border, textAlign: 'center' },
            ]}
          />
          <Pressable
            disabled={signed}
            onPress={() =>
              setForm((current) =>
                current
                  ? setSection(current, section, {
                      [key]: money ? formatPriceInput(String(numeric + stepValue)) : String(numeric + stepValue),
                    })
                  : current
              )
            }
            style={[styles.stepBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>
    );
  };

  const toggleChipSelection = (section: keyof AcquisitionFormData, key: string, option: string) => {
    if (!form || signed) return;
    const currentVal = String((form[section] as Record<string, unknown>)?.[key] || '');
    const items = currentVal
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let nextItems: string[];
    if (items.includes(option)) {
      nextItems = items.filter((i) => i !== option);
    } else {
      nextItems = [...items, option];
    }
    setForm(setSection(form, section, { [key]: nextItems.join(', ') }));
  };

  const matches = client?.matches || [];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Date Picker Modal */}
      <AcquisitionDatePickerModal
        visible={Boolean(dateModalField)}
        isDark={isDark}
        mode={dateModalField === 'targetTimeline' ? 'timeline' : 'meeting'}
        title={dateModalField === 'targetTimeline' ? 'Horyzont sprzedaży' : 'Termin'}
        initialValue={
          dateModalField && form ? String((form.meeting as Record<string, string>)[dateModalField] || '') : ''
        }
        onClose={() => setDateModalField(null)}
        onSelect={(formattedDate) => {
          if (dateModalField && form) {
            setForm(setSection(form, 'meeting', { [dateModalField]: formattedDate }));
          }
        }}
      />

      {/* Top Navbar */}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          scrollEnabled={!isSigning}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 240 }}
        >
          {!client ? (
            <ActivityIndicator color="#34C759" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Client Info Banner */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                    {client.type === 'SELLER' ? 'SPRZEDAJĄCY' : 'KUPUJĄCY'}
                  </Text>
                  {client.portalUrl ? (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(
                          client.portalUrl!.startsWith('http') ? client.portalUrl! : `https://estateos.pl${client.portalUrl}`
                        )
                      }
                    >
                      <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 12 }}>Panel klienta ↗</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 }}>
                  {client.firstName} {client.lastName}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 2 }}>
                  {formatPhoneNumber(client.phone || '')} • {client.email || 'Brak e-maila'}
                </Text>
              </View>

              {/* Offer Creation / Link Section for Sellers */}
              {client.type === 'SELLER' ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                    OFERTA NIERUCHOMOŚCI
                  </Text>
                  {client.linkedOfferId ? (
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                          Oferta #{client.linkedOfferId}
                        </Text>
                        <Text style={{ color: '#34C759', fontSize: 12, marginTop: 2, fontWeight: '700' }}>
                          ● Widoczna w panelu klienta
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => navigation.navigate('OfferDetail', { offerId: client.linkedOfferId })}
                        style={{ backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
                      >
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>Zobacz ofertę</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ color: colors.secondary, fontSize: 13 }}>
                        Brak przypisanej oferty. Wykorzystaj wprowadzone dane z karty pozyskania do utworzenia oficjalnego ogłoszenia.
                      </Text>
                      <Pressable
                        onPress={handleCreateOfferFromAcquisition}
                        disabled={creatingOffer}
                        style={{
                          marginTop: 12,
                          backgroundColor: '#34C759',
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          opacity: creatingOffer ? 0.7 : 1,
                        }}
                      >
                        {creatingOffer ? (
                          <ActivityIndicator color="#000" size="small" />
                        ) : (
                          <Ionicons name="flash" size={18} color="#000" />
                        )}
                        <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>
                          Utwórz ofertę z karty pozyskania
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}

              {/* Acquisition Card (For Sellers) */}
              {client.type === 'SELLER' && form ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Karta pozyskania</Text>

                  {/* Connected Circle Step Indicator */}
                  <AcquisitionStepIndicator
                    steps={STEPS}
                    currentStep={step}
                    onSelectStep={setStep}
                    isDark={isDark}
                  />

                  {/* Step 1: Spotkanie */}
                  {step === 1 ? (
                    <>
                      {form.meeting.startsAt ? (
                        <View style={{ marginBottom: 14 }}>
                          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>
                            UMÓWIONE SPOTKANIE
                          </Text>
                          <View
                            style={{
                              marginTop: 6,
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: 'rgba(52,199,89,0.12)',
                              borderWidth: 1,
                              borderColor: colors.accent,
                            }}
                          >
                            <Text style={{ color: colors.text, fontWeight: '800' }}>{form.meeting.startsAt}</Text>
                            {form.meeting.location ? (
                              <Text style={{ color: colors.secondary, marginTop: 4 }}>{form.meeting.location}</Text>
                            ) : null}
                            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6 }}>
                              Termin ustalony przy dodawaniu klienta. Kartę wypełniasz na miejscu.
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 12 }}>
                          Spotkanie umawiasz na ekranie Dodaj klienta. Tu na miejscu uzupełniasz cel i horyzont sprzedaży.
                        </Text>
                      )}

                      <MultiSelectChipGroup
                        label="CEL KLIENTA"
                        options={['Sprzedaż nieruchomości', 'Szybka sprzedaż (gotówka)', 'Najem', 'Zamiana']}
                        selected={((form.meeting.clientGoal as string) || '').split(',').map((s) => s.trim())}
                        onToggle={(opt) => toggleChipSelection('meeting', 'clientGoal', opt)}
                        isDark={isDark}
                        disabled={signed}
                      />

                      {field('meeting', 'targetTimeline', 'HORYZONT SPRZEDAŻY', { isDate: true })}

                      <MultiSelectChipGroup
                        label="MOTYWACJA I POWÓD SPRZEDAŻY"
                        options={[
                          'Chęć kupna nowego mieszkania',
                          'Zmiana pracy / przeprowadzka',
                          'Podział majątku / spadek',
                          'Inwestycja',
                          'Potrzeba gotówki',
                        ]}
                        selected={((form.meeting.reasonForSale as string) || '').split(',').map((s) => s.trim())}
                        onToggle={(opt) => toggleChipSelection('meeting', 'reasonForSale', opt)}
                        isDark={isDark}
                        disabled={signed}
                      />
                    </>
                  ) : null}

                  {/* Step 2: Stan prawny */}
                  {step === 2 ? (
                    <>
                      {field('ownership', 'owners', 'WŁAŚCICIELE / DANE Z KW')}
                      <AcquisitionKwField
                        value={String(form.ownership.landRegisterNumber || '')}
                        onChange={(next) => setForm((c) => (c ? setSection(c, 'ownership', { landRegisterNumber: next }) : c))}
                        isDark={isDark}
                        disabled={signed}
                      />

                      {/* Mortgage Switch & Field */}
                      <View style={{ marginVertical: 12 }}>
                        <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>HIPOTEKA</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                          {['BRAK', 'TAK (OBCIĄŻONA)'].map((opt) => {
                            const isYes = opt.startsWith('TAK');
                            const active = isYes
                              ? form.ownership.hasMortgage === 'true' || Boolean(form.ownership.mortgage)
                              : form.ownership.hasMortgage === 'false' || !form.ownership.mortgage;

                            return (
                              <Pressable
                                key={opt}
                                disabled={signed}
                                onPress={() =>
                                  setForm((c) =>
                                    c ? setSection(c, 'ownership', { hasMortgage: isYes ? 'true' : 'false' }) : c
                                  )
                                }
                                style={[
                                  styles.optBtn,
                                  {
                                    backgroundColor: active ? colors.accent : colors.input,
                                    borderColor: active ? colors.accent : colors.border,
                                  },
                                ]}
                              >
                                <Text style={{ color: active ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {form.ownership.hasMortgage === 'true' || Boolean(form.ownership.mortgage)
                        ? stepper('ownership', 'mortgage', 'WYSOKOŚĆ HIPOTEKI (zł)', 10000, true)
                        : null}

                      <MultiSelectChipGroup
                        label="OBCIĄŻENIA I PRAWA"
                        options={['Pełna własność', 'Spółdzielcze własnościowe', 'Służebność osobista', 'Brak obciążeń']}
                        selected={((form.ownership.encumbrances as string) || '').split(',').map((s) => s.trim())}
                        onToggle={(opt) => toggleChipSelection('ownership', 'encumbrances', opt)}
                        isDark={isDark}
                        disabled={signed}
                      />
                    </>
                  ) : null}

                  {/* Step 3: Nieruchomość */}
                  {step === 3 ? (
                    <>
                      <AcquisitionAddressMapField
                        token={token}
                        value={{
                          address: String(form.property.address || ''),
                          city: String((form.property as Record<string, string>).city || client?.sellerCity || ''),
                          lat: Number((form.property as Record<string, string>).lat)
                            ? Number((form.property as Record<string, string>).lat)
                            : null,
                          lng: Number((form.property as Record<string, string>).lng)
                            ? Number((form.property as Record<string, string>).lng)
                            : null,
                        }}
                        onChange={(next) =>
                          setForm((current) =>
                            current
                              ? setSection(current, 'property', {
                                  address: next.address,
                                  city: next.city || '',
                                  lat: next.lat != null ? String(next.lat) : '',
                                  lng: next.lng != null ? String(next.lng) : '',
                                })
                              : current
                          )
                        }
                        isDark={isDark}
                        disabled={signed}
                      />

                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                        <AddOfferWheelPickerColumn
                          title="Pokoje"
                          value={String(form.property.rooms || '')}
                          options={ROOM_OPTIONS}
                          onChange={(v) => setForm((c) => (c ? setSection(c, 'property', { rooms: v }) : c))}
                          disabled={signed}
                          theme={{ text: colors.text, subtitle: colors.secondary }}
                          cardBg={colors.input}
                          cardBorder={colors.border}
                        />
                        <AddOfferWheelPickerColumn
                          title="Piętro"
                          value={String(form.property.floor || '')}
                          options={FLOOR_OPTIONS}
                          onChange={(v) => setForm((c) => (c ? setSection(c, 'property', { floor: v }) : c))}
                          disabled={signed}
                          theme={{ text: colors.text, subtitle: colors.secondary }}
                          cardBg={colors.input}
                          cardBorder={colors.border}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                        <AddOfferWheelPickerColumn
                          title="Powierzchnia"
                          value={String(form.property.area || '')}
                          options={
                            AREA_OPTIONS.some((o) => o.value === String(form.property.area || ''))
                              ? AREA_OPTIONS
                              : [...AREA_OPTIONS, { value: String(form.property.area || ''), label: `${form.property.area} m²` }]
                          }
                          onChange={(v) => setForm((c) => (c ? setSection(c, 'property', { area: v }) : c))}
                          disabled={signed}
                          theme={{ text: colors.text, subtitle: colors.secondary }}
                          cardBg={colors.input}
                          cardBorder={colors.border}
                        />
                        <AddOfferWheelPickerColumn
                          title="Rok budowy"
                          value={String(form.property.yearBuilt || '')}
                          options={YEAR_OPTIONS}
                          onChange={(v) => setForm((c) => (c ? setSection(c, 'property', { yearBuilt: v }) : c))}
                          disabled={signed}
                          theme={{ text: colors.text, subtitle: colors.secondary }}
                          cardBg={colors.input}
                          cardBorder={colors.border}
                        />
                      </View>

                      {/* Interactive Room Scanner & Floor Plan Attachment */}
                      <AcquisitionRoomScanner
                        rooms={rooms}
                        planImages={planImages}
                        onChangeRooms={setRooms}
                        onChangePlanImages={setPlanImages}
                        isDark={isDark}
                        disabled={signed}
                      />
                    </>
                  ) : null}

                  {/* Step 4: Strategia */}
                  {step === 4 ? (
                    <>
                      {/* Recommended price banner */}
                      <View style={[styles.recomBox, { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: colors.accent }]}>
                        <Ionicons name="sparkles" size={20} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 12 }}>
                            SUGEROWANA CENA RYNCKOWA ESTATEOS
                          </Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 }}>
                            {formatCurrencyPLN(calculatedRecommendedPrice)} (~14 500 zł/m²)
                          </Text>
                          <Pressable
                            disabled={signed}
                            onPress={() =>
                              setForm((c) =>
                                c
                                  ? setSection(c, 'strategy', {
                                      expectedPrice: formatPriceInput(String(calculatedRecommendedPrice)),
                                      recommendedPrice: formatPriceInput(String(calculatedRecommendedPrice)),
                                    })
                                  : c
                              )
                            }
                            style={{ marginTop: 6 }}
                          >
                            <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 12 }}>
                              ✓ Zastosuj cenę rekomendowaną
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {stepper('strategy', 'expectedPrice', 'CENA OCZEKIWANA (zł)', 5000, true)}
                      {stepper('strategy', 'recommendedPrice', 'CENA REKOMENDOWANA (zł)', 5000, true)}
                      {stepper('strategy', 'minimumPrice', 'DOLNA GRANICA AKCEPTACJI (zł)', 5000, true)}
                    </>
                  ) : null}

                  {/* Step 5: Współpraca */}
                  {step === 5 ? (
                    <>
                      {stepper('cooperation', 'durationMonths', 'OKRES UMOWY (MIESIĄCE)')}
                      <CommissionRateSlider
                        value={commissionValue}
                        onChange={(value) =>
                          setForm((current) =>
                            current
                              ? setSection(current, 'cooperation', {
                                  commissionValue: String(value),
                                  commissionType: 'PERCENT',
                                })
                              : current
                          )
                        }
                        offerPrice={expectedPrice}
                        isDark={isDark}
                      />
                    </>
                  ) : null}

                  {/* Step 6: Podpis */}
                  {step === 6 ? (
                    <>
                      <Pressable
                        disabled={signed || Boolean(busy)}
                        onPress={() => void runAction('prepare_terms')}
                        style={styles.primary}
                      >
                        <Text style={styles.primaryText}>{busy === 'prepare_terms' ? 'Przygotowuję…' : 'Przygotuj warunki'}</Text>
                      </Pressable>

                      <Pressable
                        disabled={signed}
                        onPress={async () => {
                          const picked = await DocumentPicker.getDocumentAsync({
                            copyToCacheDirectory: true,
                            type: ['application/pdf', 'image/*'],
                          });
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
                        <Text style={{ color: colors.text, fontWeight: '800' }}>Wgraj podpisany skan umowy</Text>
                      </Pressable>

                      {(form.paperContracts || []).map((file) => (
                        <Pressable
                          key={file.url}
                          onPress={() =>
                            Linking.openURL(file.url.startsWith('http') ? file.url : `https://estateos.pl${file.url}`)
                          }
                        >
                          <Text style={{ color: '#007AFF', marginTop: 8 }}>📄 {file.name}</Text>
                        </Pressable>
                      ))}

                      <Pressable
                        onPress={() => setTemplateConfirmed((v) => !v)}
                        style={{ flexDirection: 'row', gap: 8, marginVertical: 12, alignItems: 'center' }}
                      >
                        <Ionicons name={templateConfirmed ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} />
                        <Text style={{ color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' }}>
                          Potwierdzam zgodność z oficjalnym wzorem umowy firmy
                        </Text>
                      </Pressable>

                      <TextInput
                        value={signerName}
                        onChangeText={setSignerName}
                        placeholder="Imię i nazwisko podpisującego"
                        placeholderTextColor={colors.secondary}
                        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                      />
                      <TextInput
                        value={signerEmail}
                        onChangeText={setSignerEmail}
                        autoCapitalize="none"
                        placeholder="Adres e-mail"
                        placeholderTextColor={colors.secondary}
                        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                      />

                      {/* Signature Pad with Scroll Lock */}
                      <SignaturePad
                        isDark={isDark}
                        disabled={signed}
                        onChange={setSignatureData}
                        onBeginDrawing={() => setIsSigning(true)}
                        onEndDrawing={() => setIsSigning(false)}
                      />

                      <Pressable
                        disabled={signed || !signatureData || !templateConfirmed}
                        onPress={() => void runAction('sign')}
                        style={[
                          styles.primary,
                          { opacity: signed || !signatureData || !templateConfirmed ? 0.5 : 1 },
                        ]}
                      >
                        <Text style={styles.primaryText}>{busy === 'sign' ? 'Podpisuję…' : 'Podpisz i wyślij kopię'}</Text>
                      </Pressable>
                    </>
                  ) : null}

                  {!signed && step < 6 ? (
                    <Pressable onPress={() => void persist(step + 1)} style={styles.primary}>
                      <Text style={styles.primaryText}>{busy === 'save' ? 'Zapisuję…' : 'Zapisz i przejdź dalej'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Dedicated Seller Buyer Radar Section */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>
                    Radar poszukiwań dla sprzedającego
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
                    <Text style={{ color: colors.accent, fontWeight: '800' }}>
                      {busy === 'matches' ? '…' : 'Odśwież'}
                    </Text>
                  </Pressable>
                </View>

                {client.type === 'SELLER' && (
                  <Pressable
                    onPress={async () => {
                      const nextVal = !sellerRadarSearching;
                      setSellerRadarSearching(nextVal);
                      if (token) {
                        await patchAgencyClient(token, clientId, {
                          alsoSearching: nextVal,
                          buyerFilters: nextVal
                            ? {
                                calibrationMode: 'CITY',
                                transactionType: 'SELL',
                                propertyType: 'FLAT',
                                city: sellerRadarCity,
                                selectedDistricts: [],
                                maxPrice: parseGroupedNumber(sellerRadarMaxPrice) || 0,
                                minArea: Number(sellerRadarMinArea) || 0,
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
                              }
                            : null,
                        });
                        void load();
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 }}
                  >
                    <Ionicons
                      name={sellerRadarSearching ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={colors.accent}
                    />
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, flex: 1 }}>
                      Klient sprzedający równolegle szuka nowej nieruchomości
                    </Text>
                  </Pressable>
                )}

                {sellerRadarSearching && (
                  <View style={{ marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: colors.input }}>
                    <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800', marginBottom: 6 }}>
                      PARAMETRY POSZUKIWAŃ
                    </Text>
                    <TextInput
                      value={sellerRadarCity}
                      onChangeText={setSellerRadarCity}
                      placeholder="Miasto"
                      placeholderTextColor={colors.secondary}
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TextInput
                        value={sellerRadarMaxPrice}
                        onChangeText={(text) => setSellerRadarMaxPrice(formatPriceInput(text))}
                        keyboardType="numeric"
                        placeholder="Max cena (zł)"
                        placeholderTextColor={colors.secondary}
                        style={[
                          styles.input,
                          { flex: 1, backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
                        ]}
                      />
                      <TextInput
                        value={sellerRadarMinArea}
                        onChangeText={setSellerRadarMinArea}
                        keyboardType="numeric"
                        placeholder="Min m²"
                        placeholderTextColor={colors.secondary}
                        style={[
                          styles.input,
                          { width: 100, backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
                        ]}
                      />
                    </View>
                    <Pressable
                      onPress={async () => {
                        if (!token) return;
                        setBusy('save_radar');
                        await patchAgencyClient(token, clientId, {
                          alsoSearching: true,
                          buyerFilters: {
                            calibrationMode: 'CITY',
                            transactionType: 'SELL',
                            propertyType: 'FLAT',
                            city: sellerRadarCity,
                            selectedDistricts: [],
                            maxPrice: parseGroupedNumber(sellerRadarMaxPrice) || 0,
                            minArea: Number(sellerRadarMinArea) || 0,
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
                        await refreshClientMatches(token, clientId);
                        setBusy('');
                        void load();
                      }}
                      style={[styles.secondary, { borderColor: colors.border, marginTop: 10 }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>
                        {busy === 'save_radar' ? 'Zapisuję…' : 'Zapisz kryteria & dopasuj'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Matching Offers List */}
                <View style={{ marginTop: 12 }}>
                  {matches.length === 0 ? (
                    <Text style={{ color: colors.secondary, fontSize: 13, marginVertical: 8 }}>
                      Brak pasujących ofert dla podanych kryteriów.
                    </Text>
                  ) : (
                    matches.map((item) => (
                      <View
                        key={item.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 10,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Image source={{ uri: item.offer.imageUrl }} style={{ width: 56, height: 56, borderRadius: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
                            {item.offer.title}
                          </Text>
                          <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 12 }}>
                            {formatCurrencyPLN(item.offer.price)}
                          </Text>
                          <Text style={{ color: colors.secondary, fontSize: 11 }}>{item.offer.city}</Text>
                        </View>
                        <Pressable
                          onPress={async () => {
                            if (!token) return;
                            setBusy(`prop_${item.offer.id}`);
                            const res = await proposeClientOffers(token, clientId, [item.offer.id]);
                            setBusy('');
                            if (!res.ok) Alert.alert('Propozycja', res.message);
                            else Alert.alert('Propozycja', 'Wysłano propozycję do panelu klienta!');
                          }}
                          style={{
                            backgroundColor: colors.accent,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: '#000', fontWeight: '800', fontSize: 11 }}>
                            {busy === `prop_${item.offer.id}` ? '…' : 'Zaproponuj'}
                          </Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { width: 44, height: 36, justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800' },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recomBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  primary: {
    backgroundColor: '#34C759',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  primaryText: { color: '#000', fontWeight: '900', fontSize: 15 },
  secondary: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
});
