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
import { CLIENT_PREP_ITEMS } from '../constants/clientJourney';
import AgencyClientRadarSurvey, {
  clientRadarSurveyHint,
  clientRadarSurveyReady,
  defaultClientRadarFilters,
  type ClientRadarFilters,
} from '../components/agency/AgencyClientRadarSurvey';
import AgencyClientCreateStepper from '../components/agency/AgencyClientCreateStepper';
import ClientEmailPreviewModal, {
  CLIENT_CARD_EMAIL_INTRO,
  CLIENT_MEETING_EMAIL_INTRO,
  type ClientEmailPreviewData,
} from '../components/agency/ClientEmailPreviewModal';
import {
  capitalizeSentence,
  capitalizeWords,
  formatPolishDateTime,
  parseMeetingLocal,
} from '../lib/polishText';
import SellerPropertyTypePicker, {
  sellerPropertyTypeLabel,
  type SellerPropertyTypeId,
} from '../components/agency/SellerPropertyTypePicker';
import { parsePesel } from '../lib/pesel';

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
  const user = useAuthStore((s) => s.user);
  const membership = useAuthStore((s) => s.agencyMembership);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const [type, setType] = useState<'BUYER' | 'SELLER'>('SELLER');
  const [busy, setBusy] = useState(false);
  const [alsoSearching, setAlsoSearching] = useState(false);
  const [duplicateMatches, setLookupMatches] = useState<LookupMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);
  const [peselCollisionMsg, setPeselCollisionMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    pesel: '',
    sellerCity: '',
    sellerPrice: '',
    buyerCity: 'Warszawa',
    maxPrice: '',
    emailComment: '',
    internalNotes: '',
    listingUrl: '',
    meetingAt: '',
    sellerPropertyType: 'FLAT' as SellerPropertyTypeId,
    apartmentNumber: '',
  });
  const [address, setAddress] = useState<AcquisitionAddressValue>({
    address: '',
    city: null,
    district: null,
    lat: null,
    lng: null,
  });
  const [meetingModal, setMeetingModal] = useState(false);
  const [prepItems, setPrepItems] = useState<string[]>([]);
  const [buyerFilters, setBuyerFilters] = useState<ClientRadarFilters>(defaultClientRadarFilters);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [emailPreview, setEmailPreview] = useState<ClientEmailPreviewData | null>(null);
  const submittedRef = useRef(false);
  const forceCreateRef = useRef(false);

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

  // Draft Autosave & Restore — only prompt when leaving a half-filled form, never after submit.
  useEffect(() => {
    void (async () => {
      if (submittedRef.current) return;
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const hasContent = Boolean(
          parsed?.form?.firstName ||
            parsed?.form?.lastName ||
            parsed?.form?.email ||
            parsed?.form?.phone ||
            parsed?.form?.meetingAt ||
            parsed?.address?.address,
        );
        if (!hasContent) {
          await AsyncStorage.removeItem(DRAFT_KEY);
          return;
        }
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
                if (parsed.form) {
                  setForm((current) => ({
                    ...current,
                    ...parsed.form,
                    emailComment: parsed.form.emailComment || parsed.form.comments || current.emailComment,
                    internalNotes: parsed.form.internalNotes || current.internalNotes,
                  }));
                }
                if (parsed.type) setType(parsed.type);
                if (parsed.alsoSearching !== undefined) setAlsoSearching(parsed.alsoSearching);
                if (parsed.address) setAddress({ district: null, ...parsed.address });
                if (Array.isArray(parsed.prepItems)) setPrepItems(parsed.prepItems);
                if (parsed.buyerFilters) setBuyerFilters((current) => ({ ...current, ...parsed.buyerFilters }));
              },
            },
          ],
        );
      } catch {
        void AsyncStorage.removeItem(DRAFT_KEY);
      }
    })();
  }, []);

  // Save draft on state change — skip after successful create so the dialog does not return.
  useEffect(() => {
    if (submittedRef.current) return;
    const t = setTimeout(() => {
      if (submittedRef.current) return;
      const hasContent = Boolean(form.firstName || form.lastName || form.email || form.phone || form.meetingAt || address.address);
      if (hasContent) {
        void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, type, alsoSearching, address, prepItems, buyerFilters }));
      } else {
        void AsyncStorage.removeItem(DRAFT_KEY);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form, type, alsoSearching, address, prepItems, buyerFilters]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const totalSteps = type === 'SELLER' ? 5 : 4;

  useEffect(() => {
    if (wizardStep > totalSteps) setWizardStep(totalSteps);
  }, [totalSteps, wizardStep]);

  const stepMeta = (() => {
    if (wizardStep === 1) {
      return {
        title: 'Kupujący czy sprzedający?',
        subtitle: 'Wybierz typ klienta — reszta formularza dopasuje się do procesu.',
      };
    }
    if (wizardStep === 2) {
      return {
        title: 'Dane kontaktowe',
        subtitle: 'E-mail i telefon sprawdzamy na żywo w bazie CRM.',
      };
    }
    if (type === 'SELLER' && wizardStep === 3) {
      return { title: 'Adres nieruchomości', subtitle: 'Typ, mapa satelitarna i — przy mieszkaniu — numer lokalu tylko do CRM.' };
    }
    if (type === 'SELLER' && wizardStep === 4) {
      return { title: 'Umówienie spotkania', subtitle: 'Termin, lista przygotowań i komentarz do maila. Notatka wewnętrzna zostaje tylko u Ciebie.' };
    }
    if (type === 'BUYER' && wizardStep === 3) {
      return { title: 'Kryteria poszukiwań', subtitle: 'Ankieta radaru — dopasujemy oferty z bazy.' };
    }
    return { title: 'Podsumowanie', subtitle: 'Sprawdź dane i dodaj klienta do CRM.' };
  })();

  const canGoNext = () => {
    if (wizardStep === 1) return true;
    if (wizardStep === 2) {
      if (!form.firstName.trim() || !form.lastName.trim()) return false;
      if (form.email.trim() && !isValidEmail(form.email.trim())) return false;
      if (form.phone.replace(/\D/g, '').length > 0 && form.phone.replace(/\D/g, '').length < 9) return false;
      if (form.pesel.trim() && !parsePesel(form.pesel)) return false;
      return true;
    }
    if (type === 'SELLER' && wizardStep === 3) {
      return Boolean(address.lat && address.lng && address.address.trim());
    }
    if (type === 'SELLER' && wizardStep === 4) {
      return Boolean(form.meetingAt.trim());
    }
    if (type === 'BUYER' && wizardStep === 3) {
      return clientRadarSurveyReady(buyerFilters);
    }
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (wizardStep === 2 && form.email.trim() && !isValidEmail(form.email.trim())) {
        Alert.alert('E-mail', 'Wpisz poprawny adres e-mail.');
        return;
      }
      if (wizardStep === 2 && form.pesel.trim() && !parsePesel(form.pesel)) {
        Alert.alert('PESEL', 'Wpisz poprawny numer PESEL albo zostaw pole puste.');
        return;
      }
      if (wizardStep === 2) {
        Alert.alert('Dane kontaktowe', 'Uzupełnij imię, nazwisko i poprawny telefon z prefiksem kraju.');
        return;
      }
      if (type === 'SELLER' && wizardStep === 3) {
        Alert.alert('Adres', 'Ustaw pinezkę na mapie i potwierdź adres nieruchomości.');
        return;
      }
      if (type === 'SELLER' && wizardStep === 4) {
        Alert.alert('Spotkanie', 'Wybierz termin spotkania — klient dostanie potwierdzenie mailem.');
        return;
      }
      if (type === 'BUYER' && wizardStep === 3) {
        Alert.alert('Ankieta radaru', clientRadarSurveyHint(buyerFilters) || 'Uzupełnij kryteria poszukiwań.');
        return;
      }
      return;
    }
    if (wizardStep >= totalSteps) {
      void submit();
      return;
    }
    setWizardStep((s) => Math.min(totalSteps, s + 1));
  };

  const goBack = () => {
    if (wizardStep <= 1) {
      navigation.goBack();
      return;
    }
    setWizardStep((s) => Math.max(1, s - 1));
  };

  // Real-time lookup check for duplicates (lightweight quick=1)
  const lookupSeq = useRef(0);
  useEffect(() => {
    const emailTrim = form.email.trim().toLowerCase();
    const phoneDigits = form.phone.replace(/\D/g, '');
    const peselDigits = form.pesel.replace(/\D/g, '');
    const emailOk = isValidEmail(emailTrim);
    const phoneOk = phoneDigits.length >= 9;
    const peselOk = peselDigits.length === 11 && Boolean(parsePesel(peselDigits));

    if (!token || (!emailOk && !phoneOk && !peselOk)) {
      setLookupMatches([]);
      setPeselCollisionMsg(null);
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
        if (peselOk) params.set('pesel', peselDigits);

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
        const collision = json.peselCollision;
        setPeselCollisionMsg(
          collision?.exists
            ? String(collision.message || 'Ta osoba jest już w EstateOS.')
            : null,
        );
      } catch {
        if (seq === lookupSeq.current) {
          setLookupMatches([]);
          setPeselCollisionMsg(null);
        }
      } finally {
        if (seq === lookupSeq.current) setCheckingDuplicates(false);
      }
    }, 600);

    return () => clearTimeout(t);
  }, [form.email, form.phone, form.pesel, token]);

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
    if ((type === 'BUYER' || alsoSearching) && !clientRadarSurveyReady(buyerFilters)) {
      Alert.alert('Ankieta radaru', clientRadarSurveyHint(buyerFilters) || 'Uzupełnij parametry poszukiwań.');
      return;
    }

    if (duplicateMatches.length > 0 && !ignoreDuplicateWarning) {
      Alert.alert(
        'Klient istnieje w bazie',
        `Klient o tych danych (e-mail/telefon) już znajduje się w systemie CRM.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Otwórz istniejącego',
            onPress: () =>
              navigation.replace('AgencyClientDetail', { clientId: duplicateMatches[0].id }),
          },
          {
            text: 'Dodaj mimo to',
            onPress: () => {
              setIgnoreDuplicateWarning(true);
              void continueAfterDuplicateCheck(true);
            },
          },
        ],
      );
      return;
    }

    void continueAfterDuplicateCheck();
  };

  const continueAfterDuplicateCheck = (forceCreate = ignoreDuplicateWarning) => {
    forceCreateRef.current = forceCreate;
    if (form.email.trim()) {
      setEmailPreview(buildEmailPreview());
      return;
    }
    void executeCreate(forceCreate);
  };

  const meetingIso = () => {
    const date = parseMeetingLocal(form.meetingAt);
    return date ? date.toISOString() : null;
  };

  const buildEmailPreview = (): ClientEmailPreviewData => {
    const meetingAt = parseMeetingLocal(form.meetingAt);
    const agencyName =
      membership?.company?.name?.trim() ||
      membership?.companyName?.trim() ||
      user?.companyName?.trim() ||
      'EstateOS';
    const agentName =
      user?.name?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      'Twój agent';
    const prepLabels = CLIENT_PREP_ITEMS.filter((item) => prepItems.includes(item.id)).map((item) => item.label);
    const subject = meetingAt
      ? `Spotkanie ${formatPolishDateTime(meetingAt, { weekday: false, year: false })} · ${agencyName}`
      : `${agentName} · wizytówka ${agencyName}`;
    return {
      to: form.email.trim(),
      subject,
      clientFirstName: form.firstName.trim() || 'Kliencie',
      agentName,
      agentTitle: membership?.titleLabel || membership?.agentTitle || 'Agent nieruchomości',
      agencyName,
      agentPhone: user?.phone || membership?.company?.officePhone || null,
      agentEmail: user?.email || membership?.company?.officeEmail || null,
      agentAvatarUrl: membership?.displayAvatarUrl || user?.avatar || null,
      intro: meetingAt ? CLIENT_MEETING_EMAIL_INTRO : CLIENT_CARD_EMAIL_INTRO,
      meetingAt,
      meetingLocation: address.address || null,
      emailComment: form.emailComment.trim() || null,
      prepLabels,
    };
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
          district: draft.district || address.district,
          lat: draft.lat ?? address.lat,
          lng: draft.lng ?? address.lng,
        });
      }
      Alert.alert('Import', `Odczytano: ${title}. Po dodaniu klienta dokończysz import tak jak w KEI.`);
    } finally {
      setImportBusy(false);
    }
  };

  const executeCreate = async (forceCreate = ignoreDuplicateWarning) => {
    if (!token) return;
    setBusy(true);
    try {
      const startsAt = meetingIso();
      const emailComment = form.emailComment.trim() ? capitalizeSentence(form.emailComment) : '';
      const res = await createAgencyClient(token, {
        type,
        firstName: capitalizeWords(form.firstName),
        lastName: capitalizeWords(form.lastName),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        pesel: form.pesel.trim() || null,
        notes: form.internalNotes.trim() || null,
        forceCreate,
        ...(type === 'SELLER'
          ? {
              sellerCity: address.city || form.sellerCity || null,
              sellerDistrict: address.district || null,
              sellerPropertyType: form.sellerPropertyType,
              apartmentNumber: form.sellerPropertyType === 'FLAT' ? form.apartmentNumber.trim() : '',
              sellerPrice: form.sellerPrice ? parseGroupedNumber(form.sellerPrice) : null,
              listingUrl: form.listingUrl.trim() || null,
              prepItems,
              lat: address.lat,
              lng: address.lng,
              acquisitionMeeting: startsAt
                ? {
                    startsAt,
                    location: address.address || null,
                    notes: emailComment || null,
                    prepItems,
                  }
                : null,
              ...(alsoSearching ? { buyerFilters: { ...buyerFilters, pushNotifications: false } } : {}),
            }
          : {
              buyerFilters: { ...buyerFilters, pushNotifications: false },
            }),
      });

      if (!res.ok) {
        if ('code' in res && res.code === 'DUPLICATE_CLIENT' && res.matches?.length) {
          setLookupMatches(res.matches);
          setIgnoreDuplicateWarning(false);
          Alert.alert('Klient istnieje w bazie', res.message, [
            { text: 'Anuluj', style: 'cancel' },
            {
              text: 'Otwórz istniejącego',
              onPress: () => navigation.replace('AgencyClientDetail', { clientId: res.matches[0].id }),
            },
            {
              text: 'Dodaj mimo to',
              onPress: () => {
                setIgnoreDuplicateWarning(true);
                void executeCreate(true);
              },
            },
          ]);
          return;
        }
        Alert.alert('Klient', res.message);
        return;
      }

      setEmailPreview(null);
      submittedRef.current = true;
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
      <ClientEmailPreviewModal
        visible={Boolean(emailPreview)}
        data={emailPreview}
        isDark={isDark}
        busy={busy}
        onCancel={() => setEmailPreview(null)}
        onConfirm={() => void executeCreate(forceCreateRef.current || ignoreDuplicateWarning)}
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
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        >
          <AgencyClientCreateStepper
            step={wizardStep}
            total={totalSteps}
            title={stepMeta.title}
            subtitle={stepMeta.subtitle}
            isDark={isDark}
          />

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {wizardStep === 1 ? (
              <View style={{ gap: 12 }}>
                <Pressable
                  onPress={() => setType('SELLER')}
                  style={[
                    styles.typeCard,
                    {
                      borderColor: type === 'SELLER' ? colors.accent : colors.border,
                      backgroundColor: type === 'SELLER' ? 'rgba(52,199,89,0.1)' : colors.input,
                    },
                  ]}
                >
                  <Ionicons name="home" size={28} color={type === 'SELLER' ? colors.accent : colors.secondary} />
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>Sprzedający</Text>
                  <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
                    Pozyskanie, umowa, publikacja ogłoszenia i transakcja krok po kroku.
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setType('BUYER')}
                  style={[
                    styles.typeCard,
                    {
                      borderColor: type === 'BUYER' ? '#FF9500' : colors.border,
                      backgroundColor: type === 'BUYER' ? 'rgba(255,149,0,0.1)' : colors.input,
                    },
                  ]}
                >
                  <Ionicons name="search" size={28} color={type === 'BUYER' ? '#FF9500' : colors.secondary} />
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>Kupujący</Text>
                  <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
                    Kryteria, dopasowania ofert i prezentacje nieruchomości.
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {wizardStep === 2 ? (
              <>
                {field('firstName', 'IMIĘ')}
                {field('lastName', 'NAZWISKO')}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    PESEL (OPCJONALNIE)
                  </Text>
                  <TextInput
                    value={form.pesel}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, pesel: value.replace(/[^\d]/g, '').slice(0, 11) }))
                    }
                    keyboardType="number-pad"
                    maxLength={11}
                    placeholder="11 cyfr"
                    placeholderTextColor={colors.secondary}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.input,
                        color: colors.text,
                        borderColor:
                          form.pesel.length > 0 && !parsePesel(form.pesel) ? '#FF3B30' : colors.border,
                      },
                    ]}
                  />
                  {form.pesel.length > 0 ? (
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: '700',
                        color: parsePesel(form.pesel) ? '#34C759' : '#FF3B30',
                      }}
                    >
                      {parsePesel(form.pesel)
                        ? `PESEL poprawny · ${parsePesel(form.pesel)?.gender === 'M' ? 'Mężczyzna' : 'Kobieta'} · ${parsePesel(form.pesel)?.birthDate}`
                        : 'PESEL niepoprawny'}
                    </Text>
                  ) : null}
                </View>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>E-MAIL</Text>
                  <TextInput
                    value={form.email}
                    onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.secondary}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.input,
                        color: colors.text,
                        borderColor:
                          form.email.trim() && !isValidEmail(form.email.trim()) ? '#FF3B30' : colors.border,
                      },
                    ]}
                  />
                </View>
                <AcquisitionPhoneField
                  value={form.phone}
                  onChange={(phone) => setForm((current) => ({ ...current, phone }))}
                  isDark={isDark}
                  defaultCountryIso="PL"
                />
                {type === 'SELLER' ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>LINK DO OGŁOSZENIA KLIENTA</Text>
                    <TextInput
                      value={form.listingUrl}
                      onChangeText={(value) => setForm((current) => ({ ...current, listingUrl: value }))}
                      autoCapitalize="none"
                      keyboardType="url"
                      placeholder="https://www.otodom.pl/pl/oferta/…"
                      placeholderTextColor={colors.secondary}
                      style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                ) : null}
                {peselCollisionMsg ? (
                  <View style={[styles.warningBox, { backgroundColor: 'rgba(0,122,255,0.10)', borderColor: '#007AFF', marginTop: 8 }]}>
                    <Ionicons name="information-circle-outline" size={18} color="#007AFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 12 }}>
                        {peselCollisionMsg}
                      </Text>
                      <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                        Możesz dodać klienta — nie pokazujemy danych właściciela rekordu.
                      </Text>
                    </View>
                  </View>
                ) : null}
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
                        Ten e-mail lub telefon jest już w bazie CRM.
                      </Text>
                      {duplicateMatches.map((match) => (
                        <Pressable
                          key={match.id}
                          onPress={() => navigation.replace('AgencyClientDetail', { clientId: match.id })}
                        >
                          <Text style={{ color: colors.text, fontSize: 11, marginTop: 2, textDecorationLine: 'underline' }}>
                            • {match.firstName} {match.lastName} — otwórz
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {type === 'SELLER' && wizardStep === 3 ? (
              <>
                <SellerPropertyTypePicker
                  value={form.sellerPropertyType}
                  onChange={(sellerPropertyType) =>
                    setForm((current) => ({
                      ...current,
                      sellerPropertyType,
                      apartmentNumber: sellerPropertyType === 'FLAT' ? current.apartmentNumber : '',
                    }))
                  }
                  isDark={isDark}
                />
                {form.sellerPropertyType === 'FLAT' ? (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                      NUMER MIESZKANIA
                    </Text>
                    <TextInput
                      value={form.apartmentNumber}
                      onChangeText={(value) =>
                        setForm((current) => ({ ...current, apartmentNumber: value.slice(0, 32) }))
                      }
                      placeholder="np. 12"
                      placeholderTextColor={colors.secondary}
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.input,
                          color: colors.text,
                          borderColor: colors.border,
                          marginTop: 6,
                        },
                      ]}
                    />
                    <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6, lineHeight: 15 }}>
                      Widoczny tylko dla Ciebie i klienta w CRM — nie publikujemy go na ogłoszeniu.
                    </Text>
                  </View>
                ) : null}
                <AcquisitionAddressMapField
                  token={token}
                  value={address}
                  onChange={(next) => {
                    setAddress(next);
                    setForm((current) => ({ ...current, sellerCity: next.city || current.sellerCity }));
                  }}
                  isDark={isDark}
                />
                <View
                  style={[
                    styles.priceCard,
                    {
                      backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : '#F3FBF4',
                      borderColor: colors.accent,
                    },
                  ]}
                >
                  <View style={styles.priceHead}>
                    <View style={styles.priceIcon}>
                      <Ionicons name="cash-outline" size={18} color="#052e16" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.priceKicker, { color: colors.accent }]}>CENA OCZEKIWANA</Text>
                      <Text style={[styles.priceTitle, { color: colors.text }]}>Ile klient chce uzyskać?</Text>
                    </View>
                  </View>
                  <View style={[styles.priceInputRow, { backgroundColor: isDark ? '#102016' : '#fff', borderColor: colors.accent }]}>
                    <TextInput
                      value={form.sellerPrice}
                      onChangeText={(value) =>
                        setForm((current) => ({ ...current, sellerPrice: formatPriceInput(value) }))
                      }
                      keyboardType="numeric"
                      placeholder="np. 1 250 000"
                      placeholderTextColor={colors.secondary}
                      style={[styles.priceInput, { color: colors.text }]}
                    />
                    <Text style={styles.priceSuffix}>zł</Text>
                  </View>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 8, lineHeight: 16 }}>
                    To pole jest widoczne na karcie klienta i w pozyskaniu — nie chowa się w tłumie pozostałych danych.
                  </Text>
                </View>
              </>
            ) : null}

            {type === 'SELLER' && wizardStep === 4 ? (
              <>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    TERMIN SPOTKANIA
                  </Text>
                  <Pressable
                    onPress={() => setMeetingModal(true)}
                    style={[
                      styles.input,
                      styles.meetingBtn,
                      {
                        backgroundColor: colors.input,
                        borderColor: form.meetingAt ? colors.accent : colors.border,
                        shadowColor: form.meetingAt ? colors.accent : 'transparent',
                        shadowOpacity: form.meetingAt ? 0.18 : 0,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: form.meetingAt ? 3 : 0,
                        minHeight: 56,
                        height: undefined,
                        paddingVertical: 10,
                      },
                    ]}
                  >
                    <Ionicons name="calendar" size={20} color={form.meetingAt ? colors.accent : colors.secondary} />
                    <Text style={{ color: form.meetingAt ? colors.text : colors.secondary, fontWeight: '800', flex: 1, fontSize: 15 }}>
                      {(() => {
                        const d = parseMeetingLocal(form.meetingAt);
                        return d ? formatPolishDateTime(d) : 'Wybierz dzień i godzinę';
                      })()}
                    </Text>
                  </Pressable>
                </View>
                <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                  KLIENT MA PRZYGOTOWAĆ
                </Text>
                {CLIENT_PREP_ITEMS.map((item) => {
                  const checked = prepItems.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        setPrepItems((current) =>
                          checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                        )
                      }
                      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, marginTop: 8 }}
                    >
                      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} />
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 }}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <View style={{ marginTop: 8, gap: 12 }}>
                  <View>
                    <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>KOMENTARZ DO MAILA KLIENTA</Text>
                    <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 3, marginBottom: 4, lineHeight: 16 }}>
                      Ta treść trafia do e-maila z potwierdzeniem spotkania. Zdanie zaczyna się od wielkiej litery.
                    </Text>
                    <TextInput
                      value={form.emailComment}
                      onChangeText={(value) => setForm((current) => ({ ...current, emailComment: value }))}
                      onBlur={() =>
                        setForm((current) =>
                          current.emailComment.trim()
                            ? { ...current, emailComment: capitalizeSentence(current.emailComment) }
                            : current,
                        )
                      }
                      multiline
                      placeholder="Np. Proszę zabrać akt notarialny i dowód."
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
                  <View
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F5F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="lock-closed" size={13} color={colors.secondary} />
                      <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>
                        KOMENTARZ WEWNĘTRZNY — TYLKO AGENT
                      </Text>
                    </View>
                    <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 6, lineHeight: 16 }}>
                      Zostaje w CRM. Klient tego nie dostanie na maila ani w panelu.
                    </Text>
                    <TextInput
                      value={form.internalNotes}
                      onChangeText={(value) => setForm((current) => ({ ...current, internalNotes: value }))}
                      multiline
                      placeholder="Notatka tylko dla Ciebie i biura"
                      placeholderTextColor={colors.secondary}
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? '#1C1C1E' : '#fff',
                          color: colors.text,
                          borderColor: colors.border,
                          height: 88,
                          paddingTop: 10,
                          textAlignVertical: 'top',
                          marginTop: 0,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Pressable onPress={() => setAlsoSearching((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <Ionicons name={alsoSearching ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} />
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
                    Klient szuka również nieruchomości do kupna
                  </Text>
                </Pressable>
                {alsoSearching ? (
                  <AgencyClientRadarSurvey value={buyerFilters} onChange={setBuyerFilters} isDark={isDark} title="RADAR ZAKUPOWY" />
                ) : null}
              </>
            ) : null}

            {type === 'BUYER' && wizardStep === 3 ? (
              <AgencyClientRadarSurvey
                value={buyerFilters}
                onChange={setBuyerFilters}
                isDark={isDark}
                subtitle="Wypełnij ankietę — dopasujemy oferty i pokażemy, które warto wysłać."
              />
            ) : null}

            {wizardStep === totalSteps ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                  {form.firstName} {form.lastName} · {type === 'SELLER' ? 'Sprzedający' : 'Kupujący'}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 13 }}>{form.email || '—'} · {form.phone || '—'}</Text>
                {form.pesel ? (
                  <Text style={{ color: colors.secondary, fontSize: 13 }}>PESEL {form.pesel}</Text>
                ) : null}
                {type === 'SELLER' ? (
                  <>
                    <Text style={{ color: colors.secondary, fontSize: 13 }}>{address.address || '—'}</Text>
                    <Text style={{ color: colors.secondary, fontSize: 13 }}>
                      {sellerPropertyTypeLabel(form.sellerPropertyType)}
                      {form.sellerPropertyType === 'FLAT' && form.apartmentNumber.trim()
                        ? ` · m. ${form.apartmentNumber.trim()}`
                        : ''}
                    </Text>
                    {form.sellerPrice ? (
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>
                        Cena oczekiwana: {form.sellerPrice} zł
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.secondary, fontSize: 13 }}>
                      Spotkanie:{' '}
                      {(() => {
                        const d = parseMeetingLocal(form.meetingAt);
                        return d ? formatPolishDateTime(d) : '—';
                      })()}
                    </Text>
                    {form.emailComment.trim() ? (
                      <Text style={{ color: colors.secondary, fontSize: 13 }}>
                        Mail: {capitalizeSentence(form.emailComment)}
                      </Text>
                    ) : null}
                    {form.internalNotes.trim() ? (
                      <Text style={{ color: colors.secondary, fontSize: 13 }}>Notatka wewnętrzna: tak (nie idzie na mail)</Text>
                    ) : null}
                    {form.listingUrl.trim() ? (
                      <Pressable disabled={importBusy} onPress={() => void runPortalPreview()} style={[styles.importBtn, { borderColor: colors.accent }]}>
                        {importBusy ? <ActivityIndicator color={colors.accent} /> : (
                          <>
                            <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontWeight: '800' }}>Podgląd importu ogłoszenia</Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
        <View
          style={[
            styles.footerBar,
            {
              paddingBottom: Math.max(12, insets.bottom),
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Pressable onPress={goBack} style={[styles.footerBtn, styles.footerGhost, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.footerBtnText, { color: colors.text }]}>{wizardStep === 1 ? 'Anuluj' : 'Wstecz'}</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => (wizardStep >= totalSteps ? void submit() : goNext())}
            style={[styles.footerBtn, { backgroundColor: colors.accent }]}
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={[styles.footerBtnText, { color: '#052e16' }]} numberOfLines={2}>
                {wizardStep >= totalSteps
                  ? duplicateMatches.length > 0 && !ignoreDuplicateWarning
                    ? 'Dodaj mimo duplikatu'
                    : form.email.trim()
                      ? 'Podgląd maila'
                      : 'Dodaj klienta'
                  : 'Dalej'}
              </Text>
            )}
          </Pressable>
        </View>
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  typeCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  footerGhost: {
    borderWidth: 1,
  },
  footerBtnText: {
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
  },
  priceCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#14532d',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  priceHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  priceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  priceTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3, marginTop: 1 },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },
  priceInput: { flex: 1, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  priceSuffix: { fontSize: 18, fontWeight: '800', color: '#166534', marginLeft: 8 },
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
