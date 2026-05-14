import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, Dimensions, Platform, Pressable, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import type { Camera } from 'react-native-maps';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import AddOfferStepper from '../../components/AddOfferStepper';
import { REST_OF_COUNTRY_CITY, formatLocationLabel, stripHouseNumber } from '../../constants/locationEcosystem';
import { getPublicMapPresentation } from '../../utils/publicLocationPrivacy';
import { isValidLandRegistryNumber } from '../../utils/landRegistry';
import { submitOwnerLegalVerification } from '../../services/legalVerificationService';
import {
  fetchCountableUserOffers,
  allowsMultipleCountableListings,
  canPublishCountableListing,
  getAdditionalListingSlots,
  openPlusStripeCheckout,
} from '../../utils/listingQuota';
import { purchasePakietPlusConsumable, PAKIET_PLUS_PRICE_LABEL } from '../../services/iapPakietPlus';
import { archiveOwnOfferViaMobileAdmin } from '../../utils/mobileOfferArchive';
import {
  computeAgentCommissionAmount,
  formatPercentLabel,
  formatPlnAmount,
  isAgentCommissionAccount,
  isZeroCommissionPercent,
  parseAgentCommissionPercent,
  validateAgentCommissionPercent,
} from '../../lib/agentCommission';
import { API_URL } from '../../config/network';

const { width } = Dimensions.get('window');
const DARK_COLORS = { primary: '#10b981', background: '#000000', card: '#1C1C1E', text: '#FFFFFF', subtitle: '#8E8E93', danger: '#ef4444' };
const LIGHT_COLORS = { primary: '#10b981', background: '#F2F2F7', card: '#FFFFFF', text: '#111827', subtitle: '#6B7280', danger: '#ef4444' };
// Fallback for static StyleSheet colors; runtime theme overrides are applied inline via `colors`.
const Colors = DARK_COLORS;

/** Backend zapisuje piętro jako liczbę; „Parter” z pickera → 0. */
function normalizeFloorForCreate(f: unknown): number {
  if (f === null || f === undefined || f === '') return 0;
  const s = String(f).trim().toLowerCase();
  if (s === 'parter') return 0;
  const n = parseInt(String(f).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Krok 3 zapisuje rok w buildYear — scalamy z yearBuilt przed POST. */
function normalizeYearBuiltForCreate(y: unknown): number | null {
  if (y === null || y === undefined || y === '') return null;
  const n = parseInt(String(y).trim(), 10);
  return Number.isFinite(n) && n >= 1800 && n <= 2100 ? n : null;
}

function parseLocaleNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const s = String(raw).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatFloorSummary(f: unknown): string {
  if (f === null || f === undefined || f === '') return '';
  const s = String(f).trim();
  if (s.toLowerCase() === 'parter') return 'Parter';
  return s;
}

function formatConditionLabel(cond: unknown): string {
  if (cond === 'READY') return 'Gotowe';
  if (cond === 'RENOVATION') return 'Do remontu';
  if (cond === 'DEVELOPER') return 'Deweloperski';
  return cond ? String(cond) : '';
}

/** Kąt i przybliżenie jak przy „locie” kamery w kroku 2 — budynki 3D przy wyższym pitch. */
function buildPreviewCamera(lat: number, lng: number, isExact: boolean): Camera {
  return {
    center: { latitude: lat, longitude: lng },
    pitch: isExact ? 74 : 36,
    heading: isExact ? 46 : 18,
    altitude: isExact ? 210 : 3400,
    zoom: isExact ? 18.6 : 13.3,
  };
}

function SummaryLocationMap({
  latitude,
  longitude,
  isExact,
  isDark,
  subtitleColor,
  cardBorderColor,
  cardBgColor,
  draftSalt,
}: {
  latitude: number;
  longitude: number;
  isExact: boolean;
  isDark: boolean;
  subtitleColor: string;
  cardBorderColor: string;
  cardBgColor: string;
  /**
   * Stabilny „salt" do deterministycznego przesunięcia środka okręgu.
   * Dla draftu (brak `offer.id`) używamy stringa z adresu — żeby przy każdym
   * wejściu w podgląd pokazywać dokładnie ten sam zjitterowany punkt.
   */
  draftSalt?: string | null;
}) {
  // PODGLĄD W SUMMARY = TO, CO ZOBACZY PUBLICZNOŚĆ.
  // Owner sam jest autorem, więc jeśli wyłącza „Dokładną lokalizację", powinien
  // zobaczyć dokładnie takie pole tarczy, jakie potem zobaczy kupujący — łącznie
  // z przesuniętym środkiem (żeby nie zdziwił się, że pin „skoczył" po publikacji).
  const publicPresentation = useMemo(
    () =>
      getPublicMapPresentation({
        lat: latitude,
        lng: longitude,
        offerId: draftSalt ?? null,
        isExactLocation: isExact,
        viewerIsOwner: false,
      }),
    [latitude, longitude, draftSalt, isExact],
  );
  const camera = useMemo(
    () =>
      buildPreviewCamera(publicPresentation.latitude, publicPresentation.longitude, isExact),
    [publicPresentation.latitude, publicPresentation.longitude, isExact],
  );
  const coordinate = useMemo(
    () => ({ latitude: publicPresentation.latitude, longitude: publicPresentation.longitude }),
    [publicPresentation.latitude, publicPresentation.longitude],
  );

  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[styles.sectionTitle, { marginBottom: 10, color: subtitleColor }]}>PODGLĄD MAPY</Text>
      <View style={[styles.mapPreviewOuter, { borderColor: cardBorderColor, backgroundColor: cardBgColor }]}>
        <MapView
          style={styles.mapPreview}
          initialCamera={camera}
          mapType="standard"
          showsBuildings
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          zoomTapEnabled={false}
          toolbarEnabled={false}
          loadingEnabled={false}
          pointerEvents="none"
          userInterfaceStyle={isDark ? 'dark' : 'light'}
        >
          {publicPresentation.mode === 'pin' ? (
            <Marker coordinate={coordinate} title="Lokalizacja oferty" pinColor="#ef4444" />
          ) : (
            <Circle
              center={coordinate}
              radius={publicPresentation.circleRadiusM}
              strokeColor="rgba(239,68,68,0.9)"
              fillColor="rgba(239,68,68,0.14)"
              strokeWidth={2}
            />
          )}
        </MapView>
      </View>
      <Text style={[styles.mapPreviewCaption, { color: subtitleColor }]}>
        {publicPresentation.mode === 'pin'
          ? 'Dokładny punkt — widok z perspektywy (budynki 3D)'
          : `Obszar ~${publicPresentation.circleRadiusM} m · środek przesunięty losowo (budynek leży gdzieś wewnątrz okręgu)`}
      </Text>
    </View>
  );
}

const AMENITY_META: { key: 'hasBalcony' | 'hasParking' | 'hasStorage' | 'hasElevator' | 'hasGarden' | 'isFurnished'; label: string }[] = [
  { key: 'hasBalcony', label: 'Balkon / taras' },
  { key: 'hasParking', label: 'Parking' },
  { key: 'hasStorage', label: 'Komórka / piwnica' },
  { key: 'hasElevator', label: 'Winda' },
  { key: 'hasGarden', label: 'Ogródek' },
  { key: 'isFurnished', label: 'Umeblowane' },
];

export default function Step6_Summary({ theme }: { theme: any }) {
  const { draft, resetDraft, setCurrentStep } = useOfferStore();
  const { user, token, refreshUser } = useAuthStore();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const isDark = Boolean(theme?.dark || theme?.glass === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const isCompactScreen = width <= 390;

  /**
   * Po opublikowaniu robimy `resetDraft()` + `popToTop()`. Defensywa: jeśli z
   * jakiegoś powodu Step6 odzyska focus z PUSTYM draftem (świeży reset po
   * publikacji), natychmiast wracamy do Step1 — żeby user nie zobaczył
   * niedopubliokowanej kopii oferty z poprzedniego flow.
   */
  useFocusEffect(
    useCallback(() => {
      const currentDraft = useOfferStore.getState().draft;
      const looksLikeFreshDraft =
        !String(currentDraft?.title || '').trim() &&
        !String(currentDraft?.price || '').trim() &&
        !String(currentDraft?.description || '').trim() &&
        (!Array.isArray(currentDraft?.images) || currentDraft.images.length === 0);
      if (looksLikeFreshDraft) {
        // @ts-ignore — popToTop istnieje dla native-stack-navigator
        if (typeof (navigation as any).popToTop === 'function') {
          (navigation as any).popToTop();
        } else {
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Step1' }] }));
        }
        return;
      }
      setCurrentStep(6);
    }, [navigation, setCurrentStep]),
  );

  const handlePublish = async (forceBypass = false) => {
    if (loading) return;
    
    if (!user || !user.id || !token) {
      Alert.alert("Błąd autoryzacji", "Zaloguj się ponownie, aby opublikować ofertę.");
      return;
    }

    await refreshUser();
    const latestUser = useAuthStore.getState().user;

    /* Twardy guard weryfikacji konta — oferty mogą publikować TYLKO osoby
       z potwierdzonym numerem telefonu i adresem e-mail. Inaczej ofiarą padają
       kupujący (brak kontaktu) i baza zaśmieca się "ghost-ofertami".
       Sprawdzamy ZA `refreshUser`, żeby user, który właśnie potwierdził
       weryfikację w innym tabie, nie musiał restartować aplikacji. */
    const phoneVerified = Boolean(latestUser?.isVerifiedPhone);
    const emailVerified = Boolean(latestUser?.isEmailVerified);
    if (!phoneVerified || !emailVerified) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const missing: string[] = [];
      if (!phoneVerified) missing.push('numer telefonu');
      if (!emailVerified) missing.push('adres e-mail');
      Alert.alert(
        'Weryfikacja wymagana',
        `Aby opublikować ofertę musisz najpierw potwierdzić: ${missing.join(' oraz ')}.\n\nPrzejdź do Profilu → Edytuj dane i dokończ weryfikację SMS-em oraz kodem z e-maila.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Przejdź do profilu',
            onPress: () => {
              const rootNav = navigation.getParent?.();
              if (rootNav) rootNav.navigate('Profil');
              else navigation.navigate('Profil' as never);
            },
          },
        ],
      );
      return;
    }

    if (!forceBypass && !allowsMultipleCountableListings(latestUser)) {
      const existingCount = await fetchCountableUserOffers(API_URL, token, user.id);
      if (!canPublishCountableListing(latestUser, existingCount)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const slots = getAdditionalListingSlots(latestUser);
        const quotaBody =
          Platform.OS === 'ios'
            ? `Na koncie standardowym możesz mieć jednocześnie jedno aktywne lub oczekujące ogłoszenie. Dokupione sloty aktywne: ${slots}. Kolejne ogłoszenia wymagają Pakietu Plus (ok. ${PAKIET_PLUS_PRICE_LABEL} za 30 dni za 1 dodatkowy slot). Zakup w App Store.`
            : `Na koncie standardowym możesz mieć jednocześnie jedno aktywne lub oczekujące ogłoszenie. Dokupione sloty aktywne: ${slots}. Kolejne ogłoszenia wymagają Pakietu Plus (ok. ${PAKIET_PLUS_PRICE_LABEL} za 30 dni za 1 dodatkowy slot). Natywna płatność: App Store / Google Play; alternatywnie Stripe na estateos.pl.`;
        const quotaButtons: {
          text: string;
          style?: 'cancel' | 'default' | 'destructive';
          onPress?: () => void;
        }[] = [{ text: 'Zamknij', style: 'cancel' }];
        if (Platform.OS !== 'ios') {
          quotaButtons.push({
            text: 'Wykup na stronie (Stripe)',
            onPress: () => {
              void openPlusStripeCheckout(API_URL, token);
            },
          });
        }
        quotaButtons.push({
          text: Platform.OS === 'ios' ? `Kup w App Store (~${PAKIET_PLUS_PRICE_LABEL})` : `Kup w sklepie (~${PAKIET_PLUS_PRICE_LABEL})`,
          onPress: () => {
            void (async () => {
              const r = await purchasePakietPlusConsumable(API_URL, token);
              if (r.ok) {
                await refreshUser();
                if (r.backendRegistered) {
                  Alert.alert('Pakiet Plus', 'Płatność potwierdzona. Publikuję ofertę...', [
                    {
                      text: 'OK',
                      onPress: () => {
                        void handlePublish(true);
                      },
                    },
                  ]);
                } else {
                  Alert.alert(
                    'Pakiet Plus',
                    'Zakup w sklepie został dokończony. Publikuję ofertę jednorazowo na podstawie potwierdzonej płatności. Jeśli backend jeszcze nie odświeżył slotu, synchronizacja dojdzie chwilę później.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          void handlePublish(true);
                        },
                      },
                    ]
                  );
                }
              } else if (!r.cancelled && r.message) {
                Alert.alert('Sklep', r.message);
              }
            })();
          },
        });
        Alert.alert('Limit darmowej publikacji', quotaBody, quotaButtons);
        return;
      }
    }

    const landRegistryRaw = String(draft.landRegistryNumber || '').trim();
    if (!isValidLandRegistryNumber(landRegistryRaw)) {
      Alert.alert('Walidacja', 'Numer księgi wieczystej ma niepoprawny format. Użyj wzoru: WA4N/00012345/6');
      return;
    }

    /* Walidacja prowizji agenta — tylko gdy zalogowany user to AGENT i pole
       jest wypełnione. Puste pole = agent świadomie nie ujawnia prowizji
       (np. oferta sponsorska / własna nieruchomość) — to dozwolone. */
    const isAgentSubmitter = isAgentCommissionAccount(user);
    let agentCommissionPercentForApi: number | null = null;
    if (isAgentSubmitter) {
      const rawCommission = String(draft.agentCommissionPercent || '').trim();
      if (rawCommission) {
        const validation = validateAgentCommissionPercent(rawCommission);
        if (!validation.ok) {
          Alert.alert('Prowizja agenta', validation.message);
          return;
        }
        agentCommissionPercentForApi = validation.percent;
      }
    }

    setLoading(true);
    setUploadProgressText('Tworzenie oferty w bazie...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const offerData = {
      userId: user.id, 
      lat: draft.lat || 52.2297,
      lng: draft.lng || 21.0122,
      title:
        draft.title ||
        (draft.city === REST_OF_COUNTRY_CITY
          ? `${draft.propertyType === 'FLAT' ? 'Mieszkanie' : 'Nieruchomość'} — ${draft.district || 'Polska'}`
          : `${draft.propertyType === 'FLAT' ? 'Mieszkanie' : 'Nieruchomość'} w ${draft.city || 'Warszawie'}`),
      propertyType: draft.propertyType,
      transactionType: draft.transactionType,
      condition: draft.condition || 'READY',
      city: draft.city || 'Warszawa',
      district: draft.district || 'Śródmieście',
      street: draft.street || '',
      buildingNumber: draft.buildingNumber || '',
      isExactLocation: draft.isExactLocation !== undefined ? draft.isExactLocation : true,
      
      area: draft.area || '0',          
      price: draft.price || '0',
      adminFee: draft.transactionType !== 'RENT' && parseLocaleNumber(draft.adminFee || draft.rent) > 0
        ? parseLocaleNumber(draft.adminFee || draft.rent)
        : null,
      deposit: draft.deposit || null,
      plotArea: draft.plotArea || null,
      rooms: draft.rooms || '0',        
      floor: normalizeFloorForCreate(draft.floor),
      totalFloors: draft.totalFloors || null,
      yearBuilt: normalizeYearBuiltForCreate(draft.yearBuilt ?? draft.buildYear),
      
      hasBalcony: draft.hasBalcony || false,
      hasElevator: draft.hasElevator || false,
      hasStorage: draft.hasStorage || false,
      hasParking: draft.hasParking || false,
      hasGarden: draft.hasGarden || false,
      isFurnished: draft.isFurnished || false,
      heating: String(draft.heating || '').trim() || null,
      apartmentNumber: String(draft.apartmentNumber || '').trim() || undefined,
      landRegistryNumber: String(draft.landRegistryNumber || '').trim() || undefined,
      
      description: draft.description || '', 
      images: '[]', 
      videoUrl: draft.videoUrl || '',
      floorPlanUrl: '',
      /**
       * Prowizja agenta (procent, 0.5–10). Backend zapisuje w
       * `Offer.agentCommissionPercent` i zwraca w GET endpointach.
       * Dla osób prywatnych zawsze `null`. Cena oferty nie jest
       * modyfikowana — wartość służy WYŁĄCZNIE do wyświetlenia
       * adnotacji kupującemu w OfferDetail.
       */
      agentCommissionPercent: agentCommissionPercentForApi,
    };

    let createdOfferId: number | null = null;

    try {
      // 1. ZAPIS TEKSTOWY
      const response = await fetch(`${API_URL}/api/mobile/v1/offers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(offerData)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Błąd serwera przy tworzeniu oferty');
      }

      const data = await response.json();
      createdOfferId = Number(data.offer.id);

      // 2. WGRYWANIE ZDJĘĆ
      if (createdOfferId && draft.images && draft.images.length > 0) {
        for (let i = 0; i < draft.images.length; i++) {
          let localUri = draft.images[i];
          let filename = localUri.split('/').pop() || `image_${i}.jpg`;
          let type = 'image/jpeg';

          if (localUri.toLowerCase().endsWith('.heic') || localUri.toLowerCase().endsWith('.heif')) {
            setUploadProgressText(`Konwersja zdjęcia ${i + 1} (HEIC ➜ JPG)...`);
            const manipResult = await ImageManipulator.manipulateAsync(
              localUri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
            );
            localUri = manipResult.uri;
            filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          }

          setUploadProgressText(`Wysyłanie zdjęcia ${i + 1} z ${draft.images.length}...`);

          const formData = new FormData();
          formData.append('offerId', String(createdOfferId));
          formData.append('file', { uri: localUri, name: filename, type } as any);

          const uploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.json().catch(() => ({ error: 'Nieznany błąd uploadu' }));
            throw new Error(`Zdjęcie ${i + 1}: ${errText.error || 'Odrzucone przez serwer'}`);
          }
        }
      }

      // 3. WGRYWANIE RZUTU NIERUCHOMOŚCI
      if (createdOfferId && draft.floorPlan) {
          let fpUri = draft.floorPlan;
          let fpName = fpUri.split('/').pop() || 'floorplan.jpg';
          
          if (fpUri.toLowerCase().endsWith('.heic') || fpUri.toLowerCase().endsWith('.heif')) {
              setUploadProgressText('Konwersja rzutu (HEIC ➜ JPG)...');
              const manip = await ImageManipulator.manipulateAsync(
                  fpUri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
              );
              fpUri = manip.uri;
              fpName = fpName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          }

          setUploadProgressText('Wysyłanie rzutu nieruchomości...');
          const fpFormData = new FormData();
          fpFormData.append('offerId', String(createdOfferId));
          fpFormData.append('file', { uri: fpUri, name: fpName, type: 'image/jpeg' } as any);
          fpFormData.append('isFloorPlan', 'true');

          const fpUploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
              method: 'POST',
              body: fpFormData,
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!fpUploadRes.ok) {
            const errText = await fpUploadRes.json().catch(() => ({ error: 'Nieznany błąd rzutu' }));
            throw new Error(`Rzut: ${errText.error || 'Odrzucony przez serwer'}`);
          }
      }

      let legalQueueSubmitted = false;
      if (createdOfferId && token) {
        const kwSubmit = String(draft.landRegistryNumber || '').trim();
        const aptSubmit = String(draft.apartmentNumber || '').trim();
        if (kwSubmit && aptSubmit && isValidLandRegistryNumber(kwSubmit)) {
          try {
            await submitOwnerLegalVerification(
              createdOfferId,
              { landRegistryNumber: kwSubmit, apartmentNumber: aptSubmit, ownerNote: null },
              token,
            );
            legalQueueSubmitted = true;
          } catch {
            /* Endpoint może nie być wdrożony — oferta i tak jest w bazie; właściciel zgłosi KW z karty oferty. */
          }
        }
      }

      // 4. SUKCES
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Gratulacje! 🎉',
        legalQueueSubmitted
          ? 'Oferta została pomyślnie dodana, a numer KW wraz z lokalem został wysłany do weryfikacji administratora. Ogłoszenie po moderacji będzie widoczne na radarze.'
          : 'Oferta została pomyślnie dodana. Po szybkiej weryfikacji będzie widoczna na radarze.',
        [{ text: "Super", onPress: () => {
            /* 1) Wyczyść draft NATYCHMIAST — w razie powrotu do taba "Dodaj"
                  user widzi czysty Step1, nie poprzednią ofertę.
               2) `popToTop()` — natywna metoda native-stack-navigator, zwija
                  cały stos AddOffer do pierwszego ekranu (Step1). Działa
                  pewniej niż `CommonActions.reset` (które po cichu się
                  wywalało).
               3) Przepnij ROOT (tab navigator) na zakładkę Radar — `popToTop`
                  na lokalnym stacku nie zmienia taba, dlatego używamy
                  `getParent()`. */
            resetDraft();
            try {
              // @ts-ignore — popToTop jest dostępne w native-stack
              if (typeof (navigation as any).popToTop === 'function') {
                (navigation as any).popToTop();
              } else {
                navigation.dispatch(
                  CommonActions.reset({ index: 0, routes: [{ name: 'Step1' }] }),
                );
              }
            } catch {}
            const rootNav = navigation.getParent?.();
            if (rootNav) {
              rootNav.navigate('Radar');
            } else {
              navigation.navigate('Radar' as never);
            }
        }}]
      );

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let detail = '';
      if (createdOfferId != null && token) {
        const archived = await archiveOwnOfferViaMobileAdmin(API_URL, token, createdOfferId);
        detail = archived
          ? '\n\nNieukończoną ofertę wycofaliśmy automatycznie — możesz bezpiecznie spróbować ponownie.'
          : `\n\nNie udało się automatycznie wycofać oferty z błędem publikacji (ID: ${createdOfferId}). Napisz do pomocy, żeby usunęli duplikat.`;
      }

      Alert.alert('Błąd', `${error.message || 'Wystąpił problem z połączeniem.'}${detail}`);
    } finally {
      setLoading(false);
      setUploadProgressText('');
    }
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const InfoBadge = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
  }) => {
    if (!value) return null;
    return (
      <View
        style={[
          styles.badgeContainer,
          isCompactScreen && styles.badgeContainerCompact,
          { backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(17,24,39,0.08)' },
        ]}
      >
        <View style={styles.badgeTextCol}>
          <Text
            style={[styles.badgeLabel, { color: colors.subtitle }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            allowFontScaling={false}
          >
            {label}
          </Text>
          <Text
            style={[styles.badgeValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            allowFontScaling={false}
          >
            {value}
          </Text>
        </View>
        <View
          style={[
            styles.badgeIconWrap,
            isCompactScreen && styles.badgeIconWrapCompact,
            { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.18)' },
          ]}
        >
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
      </View>
    );
  };

  const DetailRow = ({ icon, label, value }: { icon: any, label: string, value: string }) => {
    if (!value) return null;
    return (
      <View style={styles.detailRow}>
        <View style={[styles.detailIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.18)' }]}><Ionicons name={icon} size={18} color={colors.primary} /></View>
        <Text style={[styles.detailLabel, { color: colors.subtitle }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
    );
  };

  const priceNum = parseLocaleNumber(draft.price);
  const areaNum = parseLocaleNumber(draft.area);
  const pricePerSqm = areaNum > 0 && priceNum > 0 ? Math.round(priceNum / areaNum) : null;
  const yearLabel = String(draft.yearBuilt || draft.buildYear || '').trim();
  const depositNum = parseLocaleNumber(draft.deposit);
  const adminFeeValue = parseLocaleNumber(draft.adminFee || draft.rent);
  const isAgentSummary = isAgentCommissionAccount(user);
  const summaryCommissionPercent = parseAgentCommissionPercent(draft.agentCommissionPercent);
  const summaryIsZeroCommission = isZeroCommissionPercent(summaryCommissionPercent);
  const summaryCommissionAmount = summaryIsZeroCommission
    ? 0
    : computeAgentCommissionAmount(priceNum, summaryCommissionPercent);
  /** Nie wymagamy kwoty > 0 — przy niskiej cenie zaokrąglenie do PLN daje 0 i karta znikała mimo wpisanego %. */
  const showSummaryCommission =
    isAgentSummary &&
    summaryCommissionPercent !== null &&
    (summaryIsZeroCommission || priceNum > 0);
  const summaryCommissionAmountLabel =
    summaryIsZeroCommission
      ? 'BEZ PROWIZJI'
      : priceNum > 0 && summaryCommissionAmount < 1
        ? '< 1 PLN'
        : formatPlnAmount(summaryCommissionAmount);
  const summaryAccent = summaryIsZeroCommission ? '#10b981' : '#FF9F0A';
  const summaryAccentBorder = summaryIsZeroCommission ? 'rgba(16,185,129,0.55)' : 'rgba(255,159,10,0.45)';
  const summaryAccentBadgeBg = summaryIsZeroCommission ? 'rgba(16,185,129,0.18)' : 'rgba(255,159,10,0.14)';
  const activeAmenities = AMENITY_META.filter((a) => draft[a.key]);
  const propertyTypeLabel =
    draft.propertyType === 'FLAT' || draft.propertyType === 'APARTMENT' ? 'Mieszkanie' :
    draft.propertyType === 'HOUSE' ? 'Dom' :
    draft.propertyType === 'PLOT' ? 'Działka' :
    draft.propertyType === 'PREMISES' ? 'Lokal' : String(draft.propertyType || '');
  const conditionLabel = formatConditionLabel(draft.condition);
  const propertyTypeIcon: React.ComponentProps<typeof Ionicons>['name'] =
    draft.propertyType === 'HOUSE' ? 'home-outline' :
    draft.propertyType === 'PLOT' ? 'map-outline' :
    draft.propertyType === 'PREMISES' ? 'storefront-outline' :
    'business-outline';
  const conditionIcon: React.ComponentProps<typeof Ionicons>['name'] =
    draft.condition === 'READY' ? 'sparkles-outline' :
    draft.condition === 'RENOVATION' ? 'construct-outline' :
    draft.condition === 'DEVELOPER' ? 'cube-outline' :
    'information-circle-outline';
  const mapLat = draft.lat != null && !Number.isNaN(Number(draft.lat)) ? Number(draft.lat) : 52.2297;
  const mapLng = draft.lng != null && !Number.isNaN(Number(draft.lng)) ? Number(draft.lng) : 21.0122;
  const mapExact = draft.isExactLocation !== false;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 190 }}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.headerTop}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, paddingRight: 28 }}>
            <AddOfferStepper currentStep={6} draft={draft} theme={theme} navigation={navigation} />
          </View>
        </View>

        <View style={styles.mediaSection}>
          {draft.images && draft.images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.85 + 15} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 20 }}>
              {draft.images.map((uri: string, idx: number) => (
                <View key={idx} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.carouselImage} resizeMode="cover" />
                  <View style={styles.imageVignette} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.carouselImage, { backgroundColor: isDark ? '#111' : '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginLeft: 20, borderWidth: 1, borderColor: isDark ? '#333' : '#D1D5DB' }]}>
              <Ionicons name="images-outline" size={50} color={colors.subtitle} />
              <Text style={{ marginTop: 10, color: colors.subtitle, fontWeight: '600' }}>Brak zdjęć w ofercie</Text>
            </View>
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
            {draft.title?.trim() ? <Text style={[styles.offerTitle, { color: colors.text }]} numberOfLines={3}>{draft.title.trim()}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.priceLarge, { color: colors.text }]}>{Math.round(priceNum).toLocaleString('pl-PL')} <Text style={{ fontSize: 22, color: colors.subtitle }}>PLN</Text></Text>
                {draft.transactionType === 'RENT' ? (
                  <Text style={[styles.priceSubLabel, { marginTop: 4, color: colors.subtitle }]}>Czynsz najmu (całkowity)</Text>
                ) : null}
                {pricePerSqm != null ? (
                  <Text style={[styles.pricePerSqmText, { color: colors.subtitle }]}>{pricePerSqm.toLocaleString('pl-PL')} PLN / m²</Text>
                ) : null}
                {draft.transactionType === 'RENT' && depositNum > 0 ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle }]}>Kaucja {Math.round(depositNum).toLocaleString('pl-PL')} PLN</Text>
                ) : null}
                {draft.transactionType === 'SALE' && adminFeeValue > 0 ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle }]}>Czynsz administracyjny ~ {Math.round(adminFeeValue).toLocaleString('pl-PL')} PLN</Text>
                ) : null}
                {showSummaryCommission ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle, marginTop: 6, fontWeight: '600' }]}>
                    Prowizja:{' '}
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {summaryIsZeroCommission
                        ? 'bez prowizji (0%)'
                        : `${formatPercentLabel(summaryCommissionPercent!)} · ${summaryCommissionAmountLabel}`}
                    </Text>
                  </Text>
                ) : null}
              </View>
              <View style={[styles.typePill, { backgroundColor: draft.transactionType === 'RENT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.typePillText, { color: draft.transactionType === 'RENT' ? '#60a5fa' : '#34d399' }]}>
                  {draft.transactionType === 'RENT' ? 'WYNAJEM' : 'SPRZEDAŻ'}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)' }]} />
            <DetailRow icon="location" label="Lokalizacja" value={formatLocationLabel(draft.city, draft.district, 'Polska')} />
            {/* Publiczna widoczność adresu:
                  • ON  — pełen adres („Reymonta 12") + dokładny pin,
                  • OFF — sama nazwa ulicy („Reymonta", bez numeru) + obszar ~200 m.
                Tutaj pokazujemy DOKŁADNIE to, co zobaczy kupujący, żeby decyzja
                o przełączeniu była jednoznaczna. */}
            {draft.street ? (
              mapExact ? (
                <DetailRow icon="map" label="Adres publiczny" value={draft.street} />
              ) : (
                <DetailRow
                  icon="shield-checkmark-outline"
                  label="Adres publiczny"
                  value={`${stripHouseNumber(draft.street) || draft.street} · numer ukryty (obszar ~200 m)`}
                />
              )
            ) : (
              !mapExact ? (
                <DetailRow icon="shield-checkmark-outline" label="Adres publiczny" value="Ukryty (obszar ~200 m)" />
              ) : null
            )}
            <SummaryLocationMap
              latitude={mapLat}
              longitude={mapLng}
              isExact={mapExact}
              isDark={isDark}
              subtitleColor={colors.subtitle}
              cardBorderColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.12)'}
              cardBgColor={isDark ? '#141416' : '#E5E7EB'}
              draftSalt={`${draft.city || ''}|${draft.district || ''}|${draft.street || ''}|${mapLat.toFixed(5)}:${mapLng.toFixed(5)}`}
            />
          </View>

          {showSummaryCommission ? (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: summaryAccentBorder, shadowColor: summaryAccent }]}>
              <View style={styles.commissionSummaryHeader}>
                <View style={[styles.commissionSummaryBadge, { backgroundColor: summaryAccentBadgeBg, borderColor: summaryAccentBorder }]}>
                  <Ionicons
                    name={summaryIsZeroCommission ? 'gift-outline' : 'briefcase-outline'}
                    size={14}
                    color={summaryAccent}
                  />
                  <Text style={[styles.commissionSummaryBadgeText, { color: summaryAccent }]}>
                    EstateOS™ Agent
                  </Text>
                </View>
                <Text style={[styles.commissionSummaryPercent, { color: summaryAccent }]}>
                  {formatPercentLabel(summaryCommissionPercent!)}
                </Text>
              </View>
              <Text style={[styles.commissionSummaryTitle, { color: colors.text }]}>
                {summaryIsZeroCommission ? 'Oferta bez prowizji' : 'Twoja prowizja'}
              </Text>
              <Text style={[styles.commissionSummaryAmount, { color: colors.text }]}>
                {summaryCommissionAmountLabel}
              </Text>
              <Text style={[styles.commissionSummaryDesc, { color: colors.subtitle }]}>
                {summaryIsZeroCommission ? (
                  <>
                    Kupujący <Text style={{ fontWeight: '800', color: summaryAccent }}>nie płaci prowizji</Text> na tej ofercie. Adnotacja „Bez prowizji” pojawi się przy ogłoszeniu — buduje zaufanie i przyciąga uwagę.
                  </>
                ) : (
                  <>
                    Cena oferty pozostaje bez zmian. Kupujący zobaczy adnotację, że z tej ceny{' '}
                    <Text style={{ fontWeight: '800', color: summaryAccent }}>{formatPercentLabel(summaryCommissionPercent!)}</Text>{' '}
                    stanowi Twoją prowizję — opłacaną bezpośrednio agentowi po sfinalizowaniu transakcji.{' '}
                    <Text style={{ fontWeight: '800', color: colors.text }}>
                      Kwota jest BRUTTO (zawiera VAT) — kupujący nie dopłaca żadnego podatku ani opłat dodatkowych.
                    </Text>
                  </>
                )}
              </Text>
              {user?.companyName ? (
                <View style={[styles.commissionSummaryCompany, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)' }]}>
                  <Ionicons name="business-outline" size={14} color={colors.subtitle} />
                  <Text style={[styles.commissionSummaryCompanyText, { color: colors.subtitle }]} numberOfLines={1}>
                    {user.companyName}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
            <Text style={[styles.sectionTitle, { color: colors.subtitle }]}>PARAMETRY NIERUCHOMOŚCI</Text>
            <View style={styles.gridBox}>
              <InfoBadge label="Typ" value={propertyTypeLabel} icon={propertyTypeIcon} />
              <InfoBadge label="Powierzchnia" value={draft.area ? `${draft.area} m²` : ''} icon="resize-outline" />
              <InfoBadge label="Pokoje" value={draft.rooms ? `${draft.rooms} pok.` : ''} icon="bed-outline" />
              <InfoBadge label="Piętro" value={formatFloorSummary(draft.floor)} icon="layers-outline" />
              <InfoBadge label="Rok budowy" value={yearLabel} icon="calendar-outline" />
              <InfoBadge label="Czynsz admin." value={adminFeeValue > 0 ? `${Math.round(adminFeeValue).toLocaleString('pl-PL')} PLN` : ''} icon="wallet-outline" />
              <InfoBadge label="Ogrzewanie" value={String(draft.heating || '').trim()} icon="flame-outline" />
              <InfoBadge label="Umeblowanie" value={draft.isFurnished ? 'Tak' : 'Nie'} icon="bed-outline" />
              <InfoBadge label="Kondygnacje w bud." value={draft.totalFloors ? String(draft.totalFloors) : ''} icon="albums-outline" />
              <InfoBadge label="Działka" value={draft.plotArea ? `${draft.plotArea} m²` : ''} icon="trail-sign-outline" />
              <InfoBadge label="Stan" value={draft.propertyType !== 'PLOT' ? conditionLabel : ''} icon={conditionIcon} />
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 18, color: colors.subtitle }]}>MEDIA I MATERIAŁY</Text>
            <Text style={[styles.mediaSummaryText, { color: colors.subtitle }]}>
              Zdjęcia: {draft.images?.length || 0} · Plan rzutu: {draft.floorPlan ? 'tak' : 'nie'} · Wideo: {draft.videoUrl?.trim() ? 'tak' : 'nie'}
            </Text>
          </View>

          {activeAmenities.length > 0 ? (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
              <Text style={[styles.sectionTitle, { color: colors.subtitle }]}>UDOGODNIENIA</Text>
              <View style={styles.amenitiesWrap}>
                {activeAmenities.map((a) => (
                  <View key={a.key} style={[styles.amenityPill, { backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.1)' }]}>
                    <Text style={[styles.amenityPillText, { color: colors.text }]}>{a.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {draft.description ? (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
              <Text style={[styles.sectionTitle, { color: colors.subtitle }]}>OPIS AI / WŁASNY</Text>
              <Text style={[styles.descriptionText, { color: colors.text }]}>{draft.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.absoluteBottom}>
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={[styles.blurWrapper, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.1)' }]}>
          <Pressable onPress={() => { void handlePublish(); }} disabled={loading} style={({ pressed }) => [styles.publishButton, { opacity: pressed || loading ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            {loading ? <ActivityIndicator color="#FFF" style={{ marginRight: 10 }} /> : <Ionicons name="rocket" size={20} color="#fff" style={{ marginRight: 10 }} />}
            <Text style={styles.publishButtonText}>
              {loading ? (uploadProgressText || 'Publikowanie...') : 'Opublikuj w Ekosystemie'}
            </Text>
          </Pressable>
          <Pressable onPress={handleGoBack} disabled={loading} style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.5 : 1 }]}>
            <Text style={[styles.editButtonText, { color: colors.subtitle }]}>Wróć i popraw dane</Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25 },
  backButton: { marginRight: 15, padding: 5, marginLeft: -5 },
  mediaSection: { marginBottom: 20 },
  imageWrapper: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, marginRight: 15 },
  carouselImage: { width: width * 0.85, height: 260, borderRadius: 24 },
  imageVignette: { ...StyleSheet.absoluteFillObject, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.1)' },
  contentContainer: { paddingHorizontal: 20, gap: 15 },
  premiumCard: { backgroundColor: Colors.card, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 },
  offerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 18, lineHeight: 26 },
  priceLarge: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  priceSubLabel: { fontSize: 11, fontWeight: '700', color: Colors.subtitle, letterSpacing: 0.8, textTransform: 'uppercase' },
  pricePerSqmText: { fontSize: 13, fontWeight: '600', color: Colors.subtitle, marginTop: 10 },
  financeSecondary: { fontSize: 14, fontWeight: '600', color: Colors.subtitle, marginTop: 6 },
  typePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  typePillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 18 },
  mapPreviewOuter: {
    width: '100%',
    height: Math.min(240, width * 0.72),
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#141416',
  },
  mapPreview: { width: '100%', height: '100%' },
  mapPreviewCaption: { fontSize: 12, fontWeight: '600', color: Colors.subtitle, marginTop: 10, lineHeight: 17 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.subtitle },
  detailValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.subtitle, letterSpacing: 1.5, marginBottom: 15 },
  gridBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaSummaryText: { fontSize: 14, fontWeight: '600', color: '#D1D1D6', lineHeight: 20 },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityPill: { backgroundColor: '#2C2C2E', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  amenityPillText: { fontSize: 13, fontWeight: '700', color: Colors.text },

  /* — karta prowizji agenta w podsumowaniu (Step6) — */
  commissionSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  commissionSummaryBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,159,10,0.14)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.4)',
  },
  commissionSummaryBadgeText: { fontSize: 11, fontWeight: '800', color: '#FF9F0A', marginLeft: 6, letterSpacing: 0.6, textTransform: 'uppercase' },
  commissionSummaryPercent: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  commissionSummaryTitle: { fontSize: 13, fontWeight: '700', color: Colors.subtitle, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
  commissionSummaryAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 4, marginBottom: 12 },
  commissionSummaryDesc: { fontSize: 13, lineHeight: 19 },
  commissionSummaryCompany: {
    marginTop: 14, paddingTop: 12, borderTopWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  commissionSummaryCompanyText: { fontSize: 12, fontWeight: '600', flex: 1 },
  badgeContainer: {
    width: '48%',
    backgroundColor: '#2C2C2E',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeContainerCompact: {
    width: '100%',
    paddingVertical: 12,
  },
  badgeTextCol: { flex: 1, minWidth: 0 },
  badgeLabel: { fontSize: 11, fontWeight: '600', color: Colors.subtitle, marginBottom: 4, lineHeight: 14 },
  badgeValue: { fontSize: 15, fontWeight: '800', color: Colors.text, lineHeight: 20 },
  badgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  badgeIconWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  descriptionText: { fontSize: 15, lineHeight: 24, color: '#D1D1D6', fontWeight: '400' },
  absoluteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  blurWrapper: { paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 25, paddingHorizontal: 20, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 15 },
  publishButton: { backgroundColor: Colors.primary, height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 8 },
  publishButtonText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  editButton: { alignItems: 'center', paddingVertical: 5 },
  editButtonText: { color: Colors.subtitle, fontSize: 14, fontWeight: '600' }
});
