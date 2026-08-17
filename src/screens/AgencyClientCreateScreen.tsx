import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { createAgencyClient, previewPortalListing } from '../services/agencyClientService';
import { API_URL } from '../config/network';
import { formatPriceInput, parseGroupedNumber } from '../utils/crmFormatters';
import AcquisitionPhoneField from '../components/agency/AcquisitionPhoneField';
import AcquisitionAddressMapField, {
  type AcquisitionAddressValue,
} from '../components/agency/AcquisitionAddressMapField';
import AcquisitionDatePickerModal from '../components/agency/AcquisitionDatePickerModal';

const DRAFT_KEY = '@eos_agency_client_create_draft';

type LookupMatch = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  agencyUser?: { name: string } | null;
  matchedBy?: { email?: boolean; phone?: boolean };
};

export default function AgencyClientCreateScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const [type, setType] = useState<'BUYER' | 'SELLER'>('SELLER');
  const [busy, setBusy] = useState(false);
  const [alsoSearching, setAlsoSearching] = useState(false);
  const [duplicateMatches, setLookupMatches] = useState<LookupMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    sellerCity: '',
    sellerPrice: '',
    buyerCity: 'Warszawa',
    maxPrice: '',
    comments: '',
    listingUrl: '',
    meetingAt: '',
  });
  const [address, setAddress] = useState<AcquisitionAddressValue>({
    address: '',
    city: null,
    lat: null,
    lng: null,
  });
  const [meetingModal, setMeetingModal] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<string | null>(null);

  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    warning: '#FF9500',
    accent: '#34C759',
  };

  // Draft Autosave & Restore
  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.form?.firstName || parsed.form?.lastName || parsed.form?.email || parsed.form?.phone)) {
            Alert.alert(
              'Niedokończony formularz',
              'Czy chcesz kontynuować od momentu, w którym skończyłeś?',
              [
                {
                  text: 'Zacznij od nowa',
                  style: 'destructive',
                  onPress: () => {
                    void AsyncStorage.removeItem(DRAFT_KEY);
                  },
                },
                {
                  text: 'Kontynuuj',
                  onPress: () => {
                    if (parsed.form) setForm((current) => ({ ...current, ...parsed.form }));
                    if (parsed.type) setType(parsed.type);
                    if (parsed.alsoSearching !== undefined) setAlsoSearching(parsed.alsoSearching);
                    if (parsed.address) setAddress(parsed.address);
                  },
                },
              ]
            );
          }
        }
      } catch {}
    })();
  }, []);

  // Save draft on state change
  useEffect(() => {
    const t = setTimeout(() => {
      if (form.firstName || form.lastName || form.email || form.phone) {
        void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, type, alsoSearching, address }));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form, type, alsoSearching, address]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // Real-time lookup check for duplicates (lightweight quick=1)
  const lookupSeq = useRef(0);
  useEffect(() => {
    const emailTrim = form.email.trim().toLowerCase();
    const phoneDigits = form.phone.replace(/\D/g, '');
    const emailOk = isValidEmail(emailTrim);
    const phoneOk = phoneDigits.length >= 9;

    if (!token || (!emailOk && !phoneOk)) {
      setLookupMatches([]);
      setCheckingDuplicates(false);
      return;
    }

    setCheckingDuplicates(true);
    const seq = ++lookupSeq.current;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ quick: '1' });
        if (emailOk) params.set('email', emailTrim);
        if (phoneOk) params.set('phone', phoneDigits);

        const res = await fetch(`${API_URL}/api/crm/clients/lookup?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        });
        const json = await res.json().catch(() => ({}));
        if (seq !== lookupSeq.current) return;

        if (res.ok && Array.isArray(json.matches)) {
          setLookupMatches(json.matches);
        } else {
          setLookupMatches([]);
        }
      } catch {
        if (seq === lookupSeq.current) setLookupMatches([]);
      } finally {
        if (seq === lookupSeq.current) setCheckingDuplicates(false);
      }
    }, 600);

    return () => clearTimeout(t);
  }, [form.email, form.phone, token]);

  const submit = async () => {
    if (!token) return;
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert('Klient', 'Imię i nazwisko są wymagane.');
      return;
    }
    if (type === 'SELLER' && !form.meetingAt.trim()) {
      Alert.alert('Termin spotkania', 'Ustal termin i godzinę spotkania — klient dostanie maila z kalendarzem.');
      return;
    }

    if (duplicateMatches.length > 0 && !ignoreDuplicateWarning) {
      Alert.alert(
        'Klient istnieje w bazie',
        `Klient o tych danych (e-mail/telefon) już znajduje się w systemie CRM. Czy na pewno chcesz utworzyć powracający/drugi profil klienta?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Dodaj klienta mimo to',
            onPress: () => {
              setIgnoreDuplicateWarning(true);
              void executeCreate();
            },
          },
        ]
      );
      return;
    }

    void executeCreate();
  };

  const meetingIso = () => {
    const raw = form.meetingAt.trim();
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
  };

  const runPortalPreview = async () => {
    if (!token) return;
    const url = form.listingUrl.trim();
    if (!url) {
      Alert.alert('Import', 'Wklej link do ogłoszenia z Otodom, OLX lub Nieruchomości-Online.');
      return;
    }
    setImportBusy(true);
    try {
      const res = await previewPortalListing(token, url);
      if (!res.ok) {
        Alert.alert('Import', res.message);
        return;
      }
      const draft = res.draft || {};
      const title = res.presentation?.title || draft.title || 'Ogłoszenie odczytane';
      setImportPreview(title);
      if (draft.price) setForm((c) => ({ ...c, sellerPrice: formatPriceInput(String(draft.price)) }));
      const label = [draft.city, draft.district].filter(Boolean).join(', ');
      if (label || (draft.lat && draft.lng)) {
        setAddress({
          address: label || address.address,
          city: draft.city || address.city,
          lat: draft.lat ?? address.lat,
          lng: draft.lng ?? address.lng,
        });
      }
      Alert.alert('Import', `Odczytano: ${title}. Po dodaniu klienta dokończysz import tak jak w KEI.`);
    } finally {
      setImportBusy(false);
    }
  };

  const executeCreate = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const startsAt = meetingIso();
      const res = await createAgencyClient(token, {
        type,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.comments.trim() || null,
        ...(type === 'SELLER'
          ? {
              sellerCity: address.address || form.sellerCity || null,
              sellerDistrict: address.city || null,
              sellerPrice: form.sellerPrice ? parseGroupedNumber(form.sellerPrice) : null,
              listingUrl: form.listingUrl.trim() || null,
              acquisitionMeeting: startsAt
                ? {
                    startsAt,
                    location: address.address || null,
                    notes: form.comments.trim() || null,
                  }
                : null,
              ...(alsoSearching
                ? {
                    buyerFilters: {
                      calibrationMode: 'CITY',
                      transactionType: 'SELL',
                      propertyType: 'FLAT',
                      city: form.buyerCity || 'Warszawa',
                      selectedDistricts: [],
                      maxPrice: parseGroupedNumber(form.maxPrice) || 0,
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
                  }
                : {}),
            }
          : {
              buyerFilters: {
                calibrationMode: 'CITY',
                transactionType: 'SELL',
                propertyType: 'FLAT',
                city: form.buyerCity || 'Warszawa',
                selectedDistricts: [],
                maxPrice: parseGroupedNumber(form.maxPrice) || 0,
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
            }),
      });

      if (!res.ok) {
        Alert.alert('Klient', res.message);
        return;
      }

      await AsyncStorage.removeItem(DRAFT_KEY);
      const listingUrl = form.listingUrl.trim();
      if (listingUrl) {
        Alert.alert(
          'Klient dodany',
          form.email.trim()
            ? 'Wysłaliśmy wizytówkę i termin spotkania na e-mail klienta. Dokończ import ogłoszenia tak jak w KEI.'
            : 'Klient zapisany. Dokończ import ogłoszenia z portalu.',
          [
            {
              text: 'Importuj ogłoszenie',
              onPress: () =>
                navigation.replace('AdminNativeImport', {
                  initialUrl: listingUrl,
                  linkClientId: res.clientId,
                }),
            },
            {
              text: 'Otwórz kartę',
              onPress: () => navigation.replace('AgencyClientDetail', { clientId: res.clientId }),
            },
          ]
        );
        return;
      }
      navigation.replace('AgencyClientDetail', { clientId: res.clientId });
    } finally {
      setBusy(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    keyboardType: 'default' | 'email-address' | 'phone-pad' | 'numeric' = 'default',
    formatter?: (val: string) => string
  ) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(value) => {
          const formatted = formatter ? formatter(value) : value;
          setForm((current) => ({ ...current, [key]: formatted }));
        }}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        placeholderTextColor={colors.secondary}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <AcquisitionDatePickerModal
        visible={meetingModal}
        isDark={isDark}
        mode="meeting"
        title="Termin spotkania"
        initialValue={form.meetingAt}
        onClose={() => setMeetingModal(false)}
        onSelect={(value) => setForm((current) => ({ ...current, meetingAt: value }))}
      />
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Dodaj klienta</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 220 }}
        >
          {/* Type Selector */}
          <View style={[styles.segmented, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setType('SELLER')}
              style={[styles.segBtn, type === 'SELLER' && { backgroundColor: colors.card }]}
            >
              <Text style={{ fontWeight: '800', color: type === 'SELLER' ? colors.text : colors.secondary }}>
                SPRZEDAJĄCY
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('BUYER')}
              style={[styles.segBtn, type === 'BUYER' && { backgroundColor: colors.card }]}
            >
              <Text style={{ fontWeight: '800', color: type === 'BUYER' ? colors.text : colors.secondary }}>
                KUPUJĄCY
              </Text>
            </Pressable>
          </View>

          {/* Form Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {field('firstName', 'IMIĘ')}
            {field('lastName', 'NAZWISKO')}
            {field('email', 'E-MAIL', 'email-address')}
            <AcquisitionPhoneField
              value={form.phone}
              onChange={(phone) => setForm((current) => ({ ...current, phone }))}
              isDark={isDark}
            />

            {/* Duplicate warning banner */}
            {checkingDuplicates ? (
              <View style={styles.dupRow}>
                <ActivityIndicator size="small" color={colors.warning} />
                <Text style={{ color: colors.secondary, fontSize: 11 }}>Sprawdzam bazę klientów…</Text>
              </View>
            ) : duplicateMatches.length > 0 ? (
              <View style={[styles.warningBox, { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: colors.warning }]}>
                <Ionicons name="warning-outline" size={18} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.warning, fontWeight: '800', fontSize: 12 }}>
                    Uwaga: Klient z tym kontaktem istnieje już w bazie!
                  </Text>
                  {duplicateMatches.map((match) => (
                    <Text key={match.id} style={{ color: colors.text, fontSize: 11, marginTop: 2 }}>
                      • {match.firstName} {match.lastName} {match.email || match.phone}
                    </Text>
                  ))}
                  <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 4 }}>
                    Możesz kontynuować i dodać ten profil ponownie.
                  </Text>
                </View>
              </View>
            ) : null}

            {type === 'SELLER' ? (
              <>
                <AcquisitionAddressMapField
                  token={token}
                  value={address}
                  onChange={(next) => {
                    setAddress(next);
                    setForm((current) => ({ ...current, sellerCity: next.address }));
                  }}
                  isDark={isDark}
                />
                {field('sellerPrice', 'CENA OCZEKIWANA (zł)', 'numeric', formatPriceInput)}

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    TERMIN SPOTKANIA
                  </Text>
                  <Pressable
                    onPress={() => setMeetingModal(true)}
                    style={[styles.input, styles.meetingBtn, { backgroundColor: colors.input, borderColor: form.meetingAt ? colors.accent : colors.border }]}
                  >
                    <Ionicons name="calendar-outline" size={18} color={form.meetingAt ? colors.accent : colors.secondary} />
                    <Text style={{ color: form.meetingAt ? colors.text : colors.secondary, fontWeight: '700', flex: 1 }}>
                      {form.meetingAt || 'Wybierz dzień i godzinę'}
                    </Text>
                    {form.meetingAt ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
                  </Pressable>
                  <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6 }}>
                    Kartę pozyskania wypełniasz na miejscu. Tu ustalamy tylko wizytę — klient dostanie maila z
                    wizytówką i plikiem do kalendarza.
                  </Text>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>KOMENTARZ</Text>
                  <TextInput
                    value={form.comments}
                    onChangeText={(value) => setForm((current) => ({ ...current, comments: value }))}
                    multiline
                    placeholder="Notatka do spotkania / dla Ciebie"
                    placeholderTextColor={colors.secondary}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.input,
                        color: colors.text,
                        borderColor: colors.border,
                        height: 88,
                        paddingTop: 10,
                        textAlignVertical: 'top',
                      },
                    ]}
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>
                    LINK DO OGŁOSZENIA KLIENTA
                  </Text>
                  <TextInput
                    value={form.listingUrl}
                    onChangeText={(value) => setForm((current) => ({ ...current, listingUrl: value }))}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="https://www.otodom.pl/pl/oferta/…"
                    placeholderTextColor={colors.secondary}
                    style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  />
                  <Pressable
                    disabled={importBusy}
                    onPress={() => void runPortalPreview()}
                    style={[styles.importBtn, { borderColor: colors.accent }]}
                  >
                    {importBusy ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <>
                        <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
                        <Text style={{ color: colors.accent, fontWeight: '800' }}>Importuj z portalu (jak KEI)</Text>
                      </>
                    )}
                  </Pressable>
                  {importPreview ? (
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 6 }}>
                      Odczytano: {importPreview}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6 }}>
                      Otodom, OLX lub Nieruchomości-Online. Po dodaniu klienta dokończysz publikację tak jak przy
                      imporcie KEI.
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => setAlsoSearching((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}
                >
                  <Ionicons
                    name={alsoSearching ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={colors.accent}
                  />
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
                    Klient sprzedający szuka również nieruchomości do kupienia
                  </Text>
                </Pressable>

                {alsoSearching ? (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12, marginBottom: 8 }}>
                      RADAR ZAKUPOWY DLA SPRZEDAJĄCEGO
                    </Text>
                    {field('buyerCity', 'MIASTO POSZUKIWAŃ')}
                    {field('maxPrice', 'BUDŻET MAX (zł)', 'numeric', formatPriceInput)}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {field('buyerCity', 'MIASTO POSZUKIWAŃ')}
                {field('maxPrice', 'BUDŻET MAX (zł)', 'numeric', formatPriceInput)}
              </>
            )}

            <Pressable disabled={busy} onPress={submit} style={[styles.submitBtn, { backgroundColor: colors.accent }]}>
              {busy ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitText}>
                  {duplicateMatches.length > 0 && !ignoreDuplicateWarning ? 'Dodaj klienta (mimo istniejącego)' : 'Dodaj klienta'}
                </Text>
              )}
            </Pressable>
          </View>
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
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 4,
  },
  dupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 15,
  },
  meetingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  importBtn: {
    marginTop: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
