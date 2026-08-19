import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, Dimensions, Platform, Pressable, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import type { Camera } from 'react-native-maps';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isAgencyAgentPendingApproval } from '../../utils/agencyMembershipAccess';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import AddOfferStepper from '../../components/AddOfferStepper';
import { getStepBlockMessage, hasAddOfferDraftProgress, isStepValid } from './flow';
import { resolvePlotAreaForSubmit } from './validation';
import {
  REST_OF_COUNTRY_CITY,
  normalizeOfferLocationForApi,
  formatLocationLabel,
  stripHouseNumber,
  getDraftLocationPresentation,
  getLocationDraftRepairPatch,
  locationDraftPatchHasChanges,
  type LocationDraftFieldsPatch,
  isPolandLocationDraft,
  hasValidMapCoordinates,
  resolvePinLocationFromGeocodedPlace,
} from '../../constants/locationEcosystem';
import { flagEmojiFromIso2 } from '../../utils/phoneRegions';
import { getPublicMapPresentation } from '../../utils/publicLocationPrivacy';
import { isValidLandRegistryNumber } from '../../utils/landRegistry';
import { submitOwnerLegalVerification } from '../../services/legalVerificationService';
import {
  allowsMultipleCountableListings,
  getAdditionalListingSlots,
  hasAdditionalPlusPublication,
  userAfterPakietPlusPurchase,
} from '../../utils/listingQuota';
import { purchasePakietPlusConsumable, PAKIET_PLUS_PRICE_LABEL } from '../../services/iapPakietPlus';
import {
  activateOfferPublication,
  getPublicationCopy,
  buildCreatePublicationPayload,
  fetchPublicationQuote,
  isPublicationActivationSkippedResponse,
  isPublicationRequiresPlusError,
} from '../../services/offerPublicationService';
import type { CreatePublicationRedemption } from '../../contracts/offerPublicationContract';
import { gatherPublicationBonusCoupons } from '../../services/publicationBonusCoupons';
import { recordPositiveAppMoment, shouldOfferAppRatingPrompt } from '../../services/appRatingPrompt';
import { readUserFirstFreePublicationUsed } from '../../utils/userPublicationFlags';
import { markProfilePromoCouponUsed } from '../../services/profilePromoService';
import PublicationChoiceModal, {
  type PublicationChoiceConfirm,
} from '../../components/publication/PublicationChoiceModal';
import { useI18n } from '../../i18n';
import { archiveOwnOfferViaMobileAdmin } from '../../utils/mobileOfferArchive';
import { buildOfferPricePayload } from '../../money/offerPrice';
import { getEurPlnRate } from '../../money/fxRateService';
import { listingAmountFromPln, normalizeListingCurrency } from '../../money/convert';
import { formatAmountWithCurrency, formatApproxLine } from '../../money/format';
import { adminFeePlnFromInput, formatAdminFeeDisplay } from '../../money/adminFee';
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
import { parseRentAdditionalFeeForApi } from '../../lib/rentAdditionalFees';
import { formatOfferConditionLabel } from '../../utils/offerFieldLabels';

const { width } = Dimensions.get('window');
const DARK_COLORS = { primary: '#10b981', background: '#000000', card: '#1C1C1E', text: '#FFFFFF', subtitle: '#8E8E93', danger: '#ef4444' };
const LIGHT_COLORS = { primary: '#10b981', background: '#F2F2F7', card: '#FFFFFF', text: '#111827', subtitle: '#6B7280', danger: '#ef4444' };
// Fallback for static StyleSheet colors; runtime theme overrides are applied inline via `colors`.
const Colors = DARK_COLORS;

/** Kredyt Pakiet Plus po zakupie — zużycie dopiero przy udanym POST /offers. */
type PlusPublishContext = {
  transactionId: string;
  deferConsume: boolean;
};

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

function formatFloorSummary(f: unknown, translate: (key: string) => string): string {
  if (f === null || f === undefined || f === '') return '';
  const s = String(f).trim();
  if (s.toLowerCase() === 'parter') return translate('addOffer.common.groundFloor');
  return s;
}


const AMENITY_LABEL_KEYS: Record<
  'hasBalcony' | 'hasParking' | 'hasStorage' | 'hasElevator' | 'hasGarden' | 'isTwoLevel' | 'isFurnished',
  string
> = {
  hasBalcony: 'addOffer.step6.amenities.balcony',
  hasParking: 'addOffer.step6.amenities.parking',
  hasStorage: 'addOffer.step6.amenities.storage',
  hasElevator: 'addOffer.step6.amenities.elevator',
  hasGarden: 'addOffer.step6.amenities.garden',
  isTwoLevel: 'addOffer.step6.amenities.twoLevel',
  isFurnished: 'addOffer.step6.amenities.furnished',
};

const HEATING_LABEL_KEYS: Record<string, string> = {
  '': 'addOffer.step3.heating.none',
  Miejskie: 'addOffer.step3.heating.district',
  Gazowe: 'addOffer.step3.heating.gas',
  Elektryczne: 'addOffer.step3.heating.electric',
  'Pompa Ciepła': 'addOffer.step3.heating.heatPump',
  'Węglowe/Pellet': 'addOffer.step3.heating.coalPellet',
  Inne: 'addOffer.step3.heating.other',
};

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
  translate,
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
  translate: (key: string, params?: Record<string, string | number>) => string;
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
      <Text style={[styles.sectionTitle, { marginBottom: 10, color: subtitleColor }]}>{translate('addOffer.step6.mapPreview.title')}</Text>
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
            <Marker coordinate={coordinate} title={translate('addOffer.step6.mapPreview.markerTitle')} pinColor="#ef4444" />
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
          ? translate('addOffer.step6.mapPreview.exactCaption')
          : translate('addOffer.step6.mapPreview.approximateCaption', {
              radius: publicPresentation.circleRadiusM,
            })}
      </Text>
    </View>
  );
}

const AMENITY_META: Array<keyof typeof AMENITY_LABEL_KEYS> = [
  'hasBalcony',
  'hasParking',
  'hasStorage',
  'hasElevator',
  'hasGarden',
  'isTwoLevel',
  'isFurnished',
];

export default function Step6_Summary({ theme }: { theme: any }) {
  const { locale, t } = useI18n();
  const publicationCopy = useMemo(() => getPublicationCopy(), [locale]);
  const { draft, resetDraft, setCurrentStep } = useOfferStore();
  const { user, token, refreshUser } = useAuthStore();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const pendingPlusCreditRef = useRef<PlusPublishContext | null>(null);
  const publishedOfferIdRef = useRef<number | null>(null);
  const [publicationChoiceVisible, setPublicationChoiceVisible] = useState(false);
  const [publicationChoiceCoupons, setPublicationChoiceCoupons] = useState<
    Awaited<ReturnType<typeof gatherPublicationBonusCoupons>>['coupons']
  >([]);
  const [publicationChoicePlusSlots, setPublicationChoicePlusSlots] = useState(0);
  const [publicationChoiceHasPlus, setPublicationChoiceHasPlus] = useState(false);
  const [prefetchedPublicationCoupons, setPrefetchedPublicationCoupons] = useState<
    Awaited<ReturnType<typeof gatherPublicationBonusCoupons>>['coupons']
  >([]);
  const isDark = Boolean(theme?.dark || theme?.glass === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const isCompactScreen = width <= 390;
  const isFinalDraftValid = [1, 2, 3, 4, 5].every((step) => isStepValid(step, draft));
  const invalidSteps = [1, 2, 3, 4, 5].filter((step) => !isStepValid(step, draft));
  const locationPresentation = getDraftLocationPresentation(draft);
  const locationFlag = flagEmojiFromIso2(locationPresentation.countryIso);
  const mapExact = draft.isExactLocation !== false;
  const [previewFxRate, setPreviewFxRate] = useState(4.32);
  const [previewFxDate, setPreviewFxDate] = useState('');
  const listingCurrency = normalizeListingCurrency(draft.priceCurrency);

  useEffect(() => {
    let cancelled = false;
    void getEurPlnRate().then((snap) => {
      if (!cancelled) {
        setPreviewFxRate(snap.rate);
        setPreviewFxDate(snap.date || '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Po udanej publikacji `resetDraft()` ustawia `needsFreshAddOfferEntry`.
   * Jeśli stack nadal wskazuje Step6, zwijamy go do Step1 (tylko wtedy).
   */
  useFocusEffect(
    useCallback(() => {
      const store = useOfferStore.getState();
      if (store.needsFreshAddOfferEntry) {
        if (hasAddOfferDraftProgress(store.draft)) {
          store.resetDraft();
        } else {
          store.clearFreshAddOfferEntry();
        }
        // @ts-ignore — popToTop istnieje dla native-stack-navigator
        if (typeof (navigation as any).popToTop === 'function') {
          (navigation as any).popToTop();
        } else {
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Step1' }] }));
        }
        return;
      }
      const currentDraft = store.draft;
      const repair = getLocationDraftRepairPatch(currentDraft);
      if (repair && locationDraftPatchHasChanges(currentDraft, repair)) {
        useOfferStore.getState().updateDraft(repair);
      }
      setCurrentStep(6);
      if (token && user?.id) {
        void gatherPublicationBonusCoupons({
          apiUrl: API_URL,
          token,
          userId: user.id,
          email: user.email,
          firstFreePublicationUsed: readUserFirstFreePublicationUsed(user),
          t,
        }).then((gathered) => {
          setPrefetchedPublicationCoupons(gathered.coupons);
          setPublicationChoiceCoupons(gathered.coupons);
        });
      }
    }, [navigation, setCurrentStep, token, user?.id, t]),
  );

  const runPakietPlusPurchaseAndPublish = async () => {
    if (!token) return;
    const r = await purchasePakietPlusConsumable(API_URL, token);
    if (!r.ok) {
      if (!r.cancelled && r.message) {
        Alert.alert(t('addOffer.common.alerts.store.title'), r.message);
      }
      return;
    }

    await refreshUser();
    const patched = userAfterPakietPlusPurchase(useAuthStore.getState().user, {
      backendRegistered: Boolean(r.backendRegistered),
      extraListings: r.extraListings,
    });
    const currentUser = useAuthStore.getState().user;
    if (patched && currentUser) {
      useAuthStore.setState({ user: { ...currentUser, ...patched } });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUploadProgressText(publicationCopy.publishAfterPurchase);
    await handlePublish(true);
  };

  const handlePublicationChoice = (result: PublicationChoiceConfirm) => {
    setPublicationChoiceVisible(false);
    if (result.action === 'cancel') return;
    if (result.action === 'buy_plus') {
      void runPakietPlusPurchaseAndPublish();
      return;
    }
    void handlePublish(true, undefined, result.redemption);
  };

  const handlePublish = async (
    skipChoiceModal = false,
    plusCtx?: PlusPublishContext,
    redemption?: CreatePublicationRedemption | null,
  ) => {
    if (loading) return;
    if (publishedOfferIdRef.current != null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        t('addOffer.step6.alerts.congratulations.title'),
        t('addOffer.step6.alerts.congratulations.messageDefault'),
      );
      return;
    }

    if (!isFinalDraftValid) {
      const firstInvalidStep = [1, 2, 3, 4, 5].find((step) => !isStepValid(step, draft)) || 1;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('addOffer.common.alerts.completeOffer.title'), getStepBlockMessage(firstInvalidStep, draft), [
        {
          text: t('addOffer.common.alerts.completeOffer.fixData'),
          onPress: () => navigation.navigate(`Step${firstInvalidStep}` as never),
        },
      ]);
      return;
    }
    
    if (!user || !user.id || !token) {
      Alert.alert(t('addOffer.common.alerts.authError.title'), t('addOffer.common.alerts.authError.message'));
      return;
    }

    if (isAgencyAgentPendingApproval(user, useAuthStore.getState().agencyMembership)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('profile.agency.publishBlockedTitle'), t('profile.agency.publishBlockedBody'));
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
      if (!phoneVerified) missing.push(t('addOffer.common.alerts.verificationRequired.missingPhone'));
      if (!emailVerified) missing.push(t('addOffer.common.alerts.verificationRequired.missingEmail'));
      Alert.alert(
        t('addOffer.common.alerts.verificationRequired.title'),
        t('addOffer.common.alerts.verificationRequired.message', { missing: missing.join(` ${locale === 'en' ? 'and' : 'oraz'} `) }),
        [
          { text: t('addOffer.common.cancel'), style: 'cancel' },
          {
            text: t('addOffer.common.alerts.verificationRequired.goToProfile'),
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

    const pendingPlus = pendingPlusCreditRef.current;
    const plusConsume = plusCtx ?? pendingPlus;

    const hasPlusCredit = hasAdditionalPlusPublication(latestUser);
    const plusSlots = getAdditionalListingSlots(latestUser);
    const gathered = await gatherPublicationBonusCoupons({
      apiUrl: API_URL,
      token,
      userId: user.id,
      email: latestUser?.email,
      firstFreePublicationUsed: readUserFirstFreePublicationUsed(latestUser),
      t,
    });
    setPrefetchedPublicationCoupons(gathered.coupons);
    const hasPublicationCoupons = gathered.coupons.length > 0;
    const mustPickPublicationMethod =
      (!allowsMultipleCountableListings(latestUser) || hasPublicationCoupons) &&
      !plusConsume &&
      !redemption;

    if (mustPickPublicationMethod) {
      setPublicationChoiceCoupons(gathered.coupons);
      setPublicationChoicePlusSlots(plusSlots);
      setPublicationChoiceHasPlus(hasPlusCredit);
      setPublicationChoiceVisible(true);
      return;
    }

    let publicationQuote: Awaited<ReturnType<typeof fetchPublicationQuote>>['quote'] | null = null;
    if (!allowsMultipleCountableListings(latestUser) && !plusConsume) {
      const q = await fetchPublicationQuote(API_URL, token);
      publicationQuote = q.quote;
      if (redemption?.source === 'plus_credit' && hasPlusCredit) {
        publicationQuote = {
          ...q.quote,
          requiresPayment: false,
          reason: 'PLUS_CREDIT_AVAILABLE',
        };
      }
      if (redemption?.source === 'bonus_coupon') {
        publicationQuote = {
          ...q.quote,
          requiresPayment: false,
          allowedFreeFirst: true,
          kind: 'FREE_FIRST',
        };
      }
    }

    const isPolandOffer = isPolandLocationDraft(draft);
    const landRegistryRaw = String(draft.landRegistryNumber || '').trim();
    if (isPolandOffer && landRegistryRaw && !isValidLandRegistryNumber(landRegistryRaw)) {
      Alert.alert(t('addOffer.common.alerts.validation.title'), t('addOffer.common.alerts.validation.landRegistryFormat'));
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
          Alert.alert(t('addOffer.step6.alerts.agentCommission.title'), validation.message);
          return;
        }
        agentCommissionPercentForApi = validation.percent;
      }
    }

    setLoading(true);
    setUploadProgressText(t('addOffer.step6.publish.creating'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const publication = buildCreatePublicationPayload({
      plusTransactionId: plusConsume?.transactionId,
      quote: publicationQuote,
      redemption: redemption ?? null,
    });

    const fxSnap = await getEurPlnRate();
    const listingCurrency = normalizeListingCurrency(draft.priceCurrency);
    const pricePayload = buildOfferPricePayload({
      priceString: draft.price || '0',
      priceCurrency: listingCurrency,
      rate: fxSnap.rate,
    });

    const apiLocation = await (async () => {
      let publishDraft = draft;
      if (hasValidMapCoordinates(draft.lat, draft.lng)) {
        try {
          const reverse = await Location.reverseGeocodeAsync({
            latitude: Number(draft.lat),
            longitude: Number(draft.lng),
          });
          if (reverse[0]) {
            const resolution = resolvePinLocationFromGeocodedPlace(reverse[0]);
            if (resolution.mode === 'locality') {
              publishDraft = {
                ...draft,
                city: resolution.city,
                district: resolution.district,
                localityCountry: resolution.localityCountry,
                localityCountryCode: resolution.localityCountryCode,
              };
            }
          }
        } catch {
          // zostaw szkic — walidacja API i tak złapie rozjazd
        }
      }
      return normalizeOfferLocationForApi(publishDraft);
    })();

    const offerData = {
      userId: user.id,
      activateOnCreate: true,
      ...(publication ? { publication } : {}),
      lat: draft.lat || 52.2297,
      lng: draft.lng || 21.0122,
      title:
        draft.title ||
        (draft.city === REST_OF_COUNTRY_CITY
          ? (draft.propertyType === 'FLAT'
              ? t('addOffer.step6.defaultTitle.flatRest', { locality: draft.district || t('addOffer.step6.defaultTitle.defaultCountry') })
              : t('addOffer.step6.defaultTitle.propertyRest', { locality: draft.district || t('addOffer.step6.defaultTitle.defaultCountry') }))
          : (draft.propertyType === 'FLAT'
              ? t('addOffer.step6.defaultTitle.flatCity', { city: draft.city || t('addOffer.step6.defaultTitle.defaultCity') })
              : t('addOffer.step6.defaultTitle.propertyCity', { city: draft.city || t('addOffer.step6.defaultTitle.defaultCity') }))),
      propertyType: draft.propertyType,
      transactionType: draft.transactionType,
      condition: draft.condition || 'READY',
      city: apiLocation.city,
      district: apiLocation.district,
      localityCountry: apiLocation.localityCountry,
      localityCountryCode: apiLocation.localityCountryCode,
      street: draft.street || '',
      buildingNumber: draft.buildingNumber || '',
      isExactLocation: draft.isExactLocation !== undefined ? draft.isExactLocation : true,
      
      area: draft.area || '0',
      price: pricePayload.price,
      priceAmount: pricePayload.priceAmount,
      priceCurrency: pricePayload.priceCurrency,
      pricePln: pricePayload.pricePln,
      adminFee:
        draft.transactionType === 'RENT'
          ? parseRentAdditionalFeeForApi(draft.adminFee)
          : adminFeePlnFromInput(draft.adminFee || draft.rent, listingCurrency, fxSnap.rate),
      deposit: draft.deposit || null,
      plotArea: resolvePlotAreaForSubmit(draft),
      rooms: draft.rooms || '0',        
      floor: normalizeFloorForCreate(draft.floor),
      totalFloors: draft.totalFloors || null,
      yearBuilt: normalizeYearBuiltForCreate(draft.yearBuilt ?? draft.buildYear),
      
      hasBalcony: draft.hasBalcony || false,
      hasElevator: draft.hasElevator || false,
      hasStorage: draft.hasStorage || false,
      hasParking: draft.hasParking || false,
      hasGarden: draft.hasGarden || false,
      isTwoLevel: draft.isTwoLevel || false,
      isFurnished: draft.isFurnished || false,
      heating: String(draft.heating || '').trim() || null,
      ...(isPolandOffer
        ? {
            landRegistryNumber: String(draft.landRegistryNumber || '').trim() || undefined,
          }
        : {}),
      
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

      if (response.ok) {
        const data = await response.json();
        createdOfferId = Number(data.offer?.id);
      } else {
        const errData = await response.json().catch(() => ({}));
        if (
          publication &&
          isPublicationActivationSkippedResponse(errData)
        ) {
          const skippedId = Number((errData as { offer?: { id?: number } }).offer?.id);
          const activation = await activateOfferPublication(API_URL, token, skippedId, {
            redemption: redemption ?? null,
            iapTransactionId: plusConsume?.transactionId,
          });
          if (activation.ok) {
            createdOfferId = skippedId;
          } else {
            await archiveOwnOfferViaMobileAdmin(API_URL, token, skippedId);
            throw new Error(
              activation.body?.message ||
                activation.body?.error ||
                t('addOffer.step6.alerts.publishError.serverError'),
            );
          }
        } else if (response.status === 422 && isPublicationRequiresPlusError(errData)) {
          const orphanId = Number((errData as { offer?: { id?: number } }).offer?.id);
          if (Number.isFinite(orphanId) && orphanId > 0) {
            await archiveOwnOfferViaMobileAdmin(API_URL, token, orphanId);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const u = useAuthStore.getState().user;
          const gathered = await gatherPublicationBonusCoupons({
            apiUrl: API_URL,
            token,
            userId: user.id,
            email: u?.email,
            firstFreePublicationUsed: readUserFirstFreePublicationUsed(u),
            t,
          });
          setPublicationChoiceCoupons(gathered.coupons);
          setPublicationChoicePlusSlots(getAdditionalListingSlots(u));
          setPublicationChoiceHasPlus(hasAdditionalPlusPublication(u));
          setPublicationChoiceVisible(true);
          return;
        } else if (
          response.status === 422 &&
          (errData as { code?: string }).code === 'NEEDS_USER_INPUT'
        ) {
          const issues =
            (errData as {
              issues?: Array<{ field?: string; kind?: string; to?: string; message?: string }>;
            }).issues || [];
          const cityIssue = issues.find((i) => i.field === 'city' && i.kind === 'suggest_replace' && i.to);
          if (cityIssue?.to) {
            setLoading(false);
            Alert.alert(
              'Lokalizacja',
              `${cityIssue.message || 'Nazwa miejscowości różni się od pinezki.'}\n\nUżyć „${cityIssue.to}”?`,
              [
                { text: 'Anuluj', style: 'cancel' },
                {
                  text: `Użyj ${cityIssue.to}`,
                  onPress: () => {
                    useOfferStore.getState().updateDraft({ city: String(cityIssue.to) });
                    void handlePublish(skipChoiceModal, plusCtx, redemption);
                  },
                },
              ],
            );
            return;
          }
          setLoading(false);
          Alert.alert(
            'Uzupełnij dane',
            issues.map((i) => i.message).filter(Boolean).join('\n') ||
              String((errData as { message?: string }).message || ''),
            [
              {
                text: 'Popraw',
                onPress: () => {
                  const step = issues.some((i) => i.field === 'area') ? 3 : 2;
                  navigation.navigate(`Step${step}` as never);
                },
              },
            ],
          );
          return;
        } else {
          const orphanId = Number((errData as { offer?: { id?: number } }).offer?.id);
          if (Number.isFinite(orphanId) && orphanId > 0) {
            await archiveOwnOfferViaMobileAdmin(API_URL, token, orphanId);
          }
          throw new Error(
            (errData as { message?: string }).message ||
              (errData as { error?: string }).error ||
              t('addOffer.step6.alerts.publishError.serverError'),
          );
        }
      }

      if (!Number.isFinite(createdOfferId) || createdOfferId <= 0) {
        throw new Error(t('addOffer.step6.alerts.publishError.serverError'));
      }

      // 2. WGRYWANIE ZDJĘĆ
      if (createdOfferId && draft.images && draft.images.length > 0) {
        for (let i = 0; i < draft.images.length; i++) {
          let localUri = draft.images[i];
          let filename = localUri.split('/').pop() || `image_${i}.jpg`;
          let type = 'image/jpeg';

          if (localUri.toLowerCase().endsWith('.heic') || localUri.toLowerCase().endsWith('.heif')) {
            setUploadProgressText(t('addOffer.step6.publish.convertingPhoto', { current: i + 1 }));
            const manipResult = await ImageManipulator.manipulateAsync(
              localUri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
            );
            localUri = manipResult.uri;
            filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          }

          setUploadProgressText(t('addOffer.step6.publish.uploadingPhoto', { current: i + 1, total: draft.images.length }));

          const formData = new FormData();
          formData.append('offerId', String(createdOfferId));
          formData.append('file', { uri: localUri, name: filename, type } as any);

          const uploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.json().catch(() => ({ error: t('addOffer.step6.alerts.publishError.uploadUnknown') }));
            throw new Error(
              t('addOffer.step6.alerts.publishError.photoError', {
                index: i + 1,
                message: errText.error || t('addOffer.step6.alerts.publishError.uploadRejected'),
              }),
            );
          }
        }
      }

      // 3. WGRYWANIE RZUTU NIERUCHOMOŚCI
      if (createdOfferId && draft.floorPlan) {
          let fpUri = draft.floorPlan;
          let fpName = fpUri.split('/').pop() || 'floorplan.jpg';
          const fpMime = fpName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          
          if (fpUri.toLowerCase().endsWith('.heic') || fpUri.toLowerCase().endsWith('.heif')) {
              setUploadProgressText(t('addOffer.step6.publish.convertingFloorPlan'));
              const manip = await ImageManipulator.manipulateAsync(
                  fpUri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
              );
              fpUri = manip.uri;
              fpName = fpName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          }

          setUploadProgressText(t('addOffer.step6.publish.uploadingFloorPlan'));
          const fpFormData = new FormData();
          fpFormData.append('offerId', String(createdOfferId));
          fpFormData.append('file', { uri: fpUri, name: fpName, type: fpMime } as any);
          fpFormData.append('isFloorPlan', 'true');

          const fpUploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
              method: 'POST',
              body: fpFormData,
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!fpUploadRes.ok) {
            const errText = await fpUploadRes.json().catch(() => ({ error: t('addOffer.step6.alerts.publishError.floorPlanUnknown') }));
            throw new Error(
              t('addOffer.step6.alerts.publishError.floorPlanError', {
                message: errText.error || t('addOffer.step6.alerts.publishError.uploadRejected'),
              }),
            );
          }
      }

      if (createdOfferId && draft.floorPlan3d) {
          setUploadProgressText(t('addOffer.step6.publish.uploadingFloorPlan3d'));
          const modelForm = new FormData();
          modelForm.append('offerId', String(createdOfferId));
          modelForm.append('file', {
            uri: draft.floorPlan3d,
            name: 'floorplan-3d.usdz',
            type: 'model/vnd.usdz+zip',
          } as any);
          modelForm.append('isFloorPlan3d', 'true');
          if (draft.floorPlanScanMeta) {
            modelForm.append('floorPlanScanMeta', String(draft.floorPlanScanMeta));
          }

          const modelUploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
            method: 'POST',
            body: modelForm,
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!modelUploadRes.ok) {
            const errText = await modelUploadRes.json().catch(() => ({ error: t('addOffer.step6.alerts.publishError.floorPlanUnknown') }));
            throw new Error(
              t('addOffer.step6.alerts.publishError.floorPlanError', {
                message: errText.error || t('addOffer.step6.alerts.publishError.uploadRejected'),
              }),
            );
          }
      }

      // 5. OSOBNE PLANY POMIESZCZEŃ — nie nadpisują planu całej nieruchomości.
      if (createdOfferId && Array.isArray(draft.propertyRoomScans) && draft.propertyRoomScans.length) {
        const uploadRoomAsset = async (
          uri: string | undefined,
          name: string,
          mimeType: string,
        ): Promise<string | undefined> => {
          if (!uri || uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/')) {
            return uri;
          }
          const form = new FormData();
          form.append('offerId', String(createdOfferId));
          form.append('purpose', 'roomPlanAsset');
          form.append('file', { uri, name, type: mimeType } as any);
          const response = await fetch(`${API_URL}/api/upload/mobile`, {
            method: 'POST',
            body: form,
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error || `Nie udało się zapisać zasobu ${name}.`);
          }
          return String(payload?.url || payload?.path || uri);
        };

        const uploadedRooms = [];
        for (let index = 0; index < draft.propertyRoomScans.length; index += 1) {
          const room = draft.propertyRoomScans[index];
          setUploadProgressText(
            `Zapisywanie planu pomieszczenia ${index + 1}/${draft.propertyRoomScans.length}…`,
          );
          const safeName = String(room.name || `room-${index + 1}`)
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .slice(0, 48);
          const floorPlanPngUri = await uploadRoomAsset(
            room.floorPlanPngUri,
            `${safeName || 'room'}-plan.png`,
            'image/png',
          );
          const floorPlan3dUri = await uploadRoomAsset(
            room.floorPlan3dUri,
            `${safeName || 'room'}-3d.usdz`,
            'model/vnd.usdz+zip',
          );
          uploadedRooms.push({ ...room, floorPlanPngUri, floorPlan3dUri });
        }

        let baseMeta: Record<string, unknown> = {};
        try {
          baseMeta =
            typeof draft.floorPlanScanMeta === 'string'
              ? JSON.parse(draft.floorPlanScanMeta)
              : draft.floorPlanScanMeta || {};
        } catch {
          baseMeta = {};
        }
        const finalScanMeta = JSON.stringify({
          ...baseMeta,
          roomScans: uploadedRooms,
          roomAreaTotalSqM: uploadedRooms.reduce((sum, room) => {
            const value = Number(String(room.areaM2 || '').replace(',', '.'));
            return sum + (Number.isFinite(value) ? value : 0);
          }, 0),
        });
        const metaResponse = await fetch(`${API_URL}/api/mobile/v1/offers/${createdOfferId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ floorPlanScanMeta: finalScanMeta }),
        });
        if (!metaResponse.ok) {
          const payload = await metaResponse.json().catch(() => ({}));
          throw new Error(payload?.message || 'Nie udało się przypisać planów do pomieszczeń.');
        }
      }

      let legalQueueSubmitted = false;
      if (createdOfferId && token && isPolandOffer) {
        const kwSubmit = String(draft.landRegistryNumber || '').trim();
        if (kwSubmit && isValidLandRegistryNumber(kwSubmit)) {
          try {
            await submitOwnerLegalVerification(
              createdOfferId,
              { landRegistryNumber: kwSubmit, apartmentNumber: null, ownerNote: null },
              token,
            );
            legalQueueSubmitted = true;
          } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
              t('offer.edit.alerts.partialSaveTitle'),
              String(err?.message || t('offer.edit.kw.submitFailed')),
            );
          }
        }
      }

      if (plusConsume?.transactionId) {
        pendingPlusCreditRef.current = null;
      }
      if (redemption?.source === 'bonus_coupon') {
        const usedCouponId = redemption.couponId;
        setPublicationChoiceCoupons((prev) => prev.filter((c) => c.id !== usedCouponId));
        setPrefetchedPublicationCoupons((prev) => prev.filter((c) => c.id !== usedCouponId));
        await markProfilePromoCouponUsed(user.id, usedCouponId, token);
      }
      await refreshUser();

      publishedOfferIdRef.current = createdOfferId;

      const resetAfterPublish = () => {
        resetDraft();
        try {
          if (typeof (navigation as any).popToTop === 'function') {
            (navigation as any).popToTop();
          } else {
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'Step1' }] }),
            );
          }
        } catch {
          /* noop */
        }
      };

      resetAfterPublish();

      // 4. SUKCES
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void recordPositiveAppMoment('offer_published');

      const successAlertDelayMs =
        Platform.OS === 'ios' && (await shouldOfferAppRatingPrompt()) ? 1400 : 0;

      const showPublishSuccessAlert = () => {
        Alert.alert(
          t('addOffer.step6.alerts.congratulations.title'),
          legalQueueSubmitted
            ? t('addOffer.step6.alerts.congratulations.messageWithLegal')
            : t('addOffer.step6.alerts.congratulations.messageDefault'),
          [{ text: t('addOffer.common.super'), onPress: () => {
              const rootNav = navigation.getParent?.();
              if (rootNav) {
                rootNav.navigate('Radar');
              } else {
                navigation.navigate('Radar' as never);
              }
          }}]
        );
      };

      if (successAlertDelayMs > 0) {
        setTimeout(showPublishSuccessAlert, successAlertDelayMs);
      } else {
        showPublishSuccessAlert();
      }

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let detail = '';
      if (plusConsume?.transactionId) {
        pendingPlusCreditRef.current = plusConsume;
        detail += t('addOffer.step6.alerts.publishError.plusPaidRetry');
      }
      if (createdOfferId != null && token) {
        const archived = await archiveOwnOfferViaMobileAdmin(API_URL, token, createdOfferId);
        detail += archived
          ? t('addOffer.step6.alerts.publishError.archived')
          : t('addOffer.step6.alerts.publishError.archiveFailed', { id: createdOfferId });
      }

      Alert.alert(
        t('addOffer.common.alerts.error.title'),
        `${error.message || t('addOffer.step6.alerts.publishError.connectionFallback')}${detail}`,
      );
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

  const LocationAddressSection = () => {
    const { locationText, countryLabelPl } = locationPresentation;
    const publicAddress = (() => {
      if (draft.street) {
        return mapExact
          ? String(draft.street)
          : t('addOffer.step6.location.hiddenWithArea', {
              street: stripHouseNumber(draft.street) || draft.street,
            });
      }
      return !mapExact ? t('addOffer.step6.location.hiddenApprox') : '';
    })();
    const publicAddressIcon: React.ComponentProps<typeof Ionicons>['name'] = mapExact ? 'map' : 'shield-checkmark-outline';

    if (!locationText && !publicAddress) return null;

    const iconBg = isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.18)';

    const StackItem = ({
      icon,
      label,
      children,
    }: {
      icon: React.ComponentProps<typeof Ionicons>['name'];
      label: string;
      children: React.ReactNode;
    }) => (
      <View style={styles.locationStackItem}>
        <View style={styles.locationStackHead}>
          <View style={[styles.detailIconBox, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
          <Text style={[styles.locationStackLabel, { color: colors.subtitle }]}>{label}</Text>
        </View>
        <View style={styles.locationStackBody}>{children}</View>
      </View>
    );

    return (
      <View style={styles.locationStack}>
        {locationText ? (
          <StackItem icon="location" label={t('addOffer.step6.location.label')}>
            <Text style={styles.locationFlag} accessibilityLabel={countryLabelPl}>
              {locationFlag}
            </Text>
            <Text style={[styles.locationStackValue, { color: colors.text }]}>{locationText}</Text>
          </StackItem>
        ) : null}
        {publicAddress ? (
          <StackItem icon={publicAddressIcon} label={t('addOffer.step6.location.publicAddress')}>
            <Text style={[styles.locationStackValue, { color: colors.text }]}>{publicAddress}</Text>
          </StackItem>
        ) : null}
      </View>
    );
  };

  const priceNum = parseLocaleNumber(draft.price);
  const areaNum = parseLocaleNumber(draft.area);
  const pricePerSqm = areaNum > 0 && priceNum > 0 ? Math.round(priceNum / areaNum) : null;
  const yearLabel = String(draft.yearBuilt || draft.buildYear || '').trim();
  const depositNum = parseLocaleNumber(draft.deposit);
  const adminFeeValue = parseLocaleNumber(draft.adminFee || draft.rent);
  const adminFeeSummaryLabel = (() => {
    if (!(adminFeeValue > 0)) return '';
    if (draft.transactionType === 'RENT') {
      // Picker trzyma kwoty w PLN; na podsumowaniu pokazujemy w walucie oferty.
      return formatAdminFeeDisplay({
        adminFeePln: adminFeeValue,
        listingCurrency,
        displayPreference: 'LISTING',
        rate: previewFxRate,
      });
    }
    // Sprzedaż: draft jest już w walucie oferty.
    return `${Math.round(adminFeeValue).toLocaleString('pl-PL')} ${listingCurrency}`;
  })();
  const adminFeeSummaryAmountOnly = (() => {
    if (!(adminFeeValue > 0)) return '';
    if (draft.transactionType === 'RENT') {
      const shown = listingAmountFromPln(adminFeeValue, listingCurrency, previewFxRate);
      return shown > 0 ? Math.round(shown).toLocaleString('pl-PL') : '';
    }
    return Math.round(adminFeeValue).toLocaleString('pl-PL');
  })();
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
      ? t('addOffer.step4.commission.amountZero')
      : priceNum > 0 && summaryCommissionAmount < 1
        ? t('addOffer.step6.commissionSummary.amountUnderOne')
        : formatPlnAmount(summaryCommissionAmount);
  const summaryAccent = summaryIsZeroCommission ? '#10b981' : '#FF9F0A';
  const summaryAccentBorder = summaryIsZeroCommission ? 'rgba(16,185,129,0.55)' : 'rgba(255,159,10,0.45)';
  const summaryAccentBadgeBg = summaryIsZeroCommission ? 'rgba(16,185,129,0.18)' : 'rgba(255,159,10,0.14)';
  const activeAmenities = AMENITY_META.filter((key) => draft[key]);
  const propertyTypeLabel =
    draft.propertyType === 'FLAT' || draft.propertyType === 'APARTMENT'
      ? t('addOffer.step6.propertyType.flat')
      : draft.propertyType === 'HOUSE'
        ? t('addOffer.step6.propertyType.house')
        : draft.propertyType === 'PLOT'
          ? t('addOffer.step6.propertyType.plot')
          : draft.propertyType === 'PREMISES'
            ? t('addOffer.step6.propertyType.premises')
            : t('addOffer.step6.propertyType.fallback');
  const conditionLabel = formatOfferConditionLabel(draft.condition, t, { empty: '' });
  const heatingSummaryLabel = t(
    HEATING_LABEL_KEYS[String(draft.heating || '')] || 'addOffer.step3.heating.none',
  );
  const propertyTypeIcon: React.ComponentProps<typeof Ionicons>['name'] =
    draft.propertyType === 'HOUSE' ? 'home-outline' :
    draft.propertyType === 'PLOT' ? 'map-outline' :
    draft.propertyType === 'PREMISES' ? 'storefront-outline' :
    'business-outline';
  const plotAreaSummary = resolvePlotAreaForSubmit(draft);
  const areaBadgeLabel =
    draft.propertyType === 'PLOT'
      ? t('addOffer.step6.badges.plot')
      : t('addOffer.step6.badges.area');
  const areaBadgeValue = draft.area ? `${draft.area} m²` : '';
  const conditionIcon: React.ComponentProps<typeof Ionicons>['name'] =
    draft.condition === 'READY' ? 'sparkles-outline' :
    draft.condition === 'RENOVATION' ? 'construct-outline' :
    draft.condition === 'DEVELOPER' ? 'cube-outline' :
    'information-circle-outline';
  const mapLat = draft.lat != null && !Number.isNaN(Number(draft.lat)) ? Number(draft.lat) : 52.2297;
  const mapLng = draft.lng != null && !Number.isNaN(Number(draft.lng)) ? Number(draft.lng) : 21.0122;

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
              <Text style={{ marginTop: 10, color: colors.subtitle, fontWeight: '600' }}>{t('addOffer.step6.noPhotos')}</Text>
            </View>
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
            {draft.title?.trim() ? <Text style={[styles.offerTitle, { color: colors.text }]} numberOfLines={3}>{draft.title.trim()}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.priceLarge, { color: colors.text }]}>
                  {formatAmountWithCurrency(priceNum, listingCurrency)}
                </Text>
                {priceNum > 0 ? (
                  <Text style={[styles.pricePerSqmText, { color: colors.subtitle, marginTop: 6 }]}>
                    {formatApproxLine(priceNum, listingCurrency, previewFxRate, previewFxDate)}
                  </Text>
                ) : null}
                {draft.transactionType === 'RENT' ? (
                  <Text style={[styles.priceSubLabel, { marginTop: 4, color: colors.subtitle }]}>{t('addOffer.step6.rentLabel')}</Text>
                ) : null}
                {pricePerSqm != null ? (
                  <Text style={[styles.pricePerSqmText, { color: colors.subtitle }]}>
                    {pricePerSqm.toLocaleString('pl-PL')} {listingCurrency} / m²
                  </Text>
                ) : null}
                {draft.transactionType === 'RENT' && depositNum > 0 ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle }]}>
                    {t('addOffer.step6.depositLabel', { amount: Math.round(depositNum).toLocaleString('pl-PL') })}
                  </Text>
                ) : null}
                {draft.transactionType === 'RENT' && adminFeeValue > 0 ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle }]}>
                    {t('addOffer.step6.rentAdditionalFeesLabel', {
                      amount: adminFeeSummaryAmountOnly,
                      currency: listingCurrency,
                    })}
                  </Text>
                ) : null}
                {draft.transactionType === 'SALE' && adminFeeValue > 0 ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle }]}>
                    {t('addOffer.step6.adminFeeLabel', {
                      amount: adminFeeSummaryAmountOnly,
                      currency: listingCurrency,
                    })}
                  </Text>
                ) : null}
                {showSummaryCommission ? (
                  <Text style={[styles.financeSecondary, { color: colors.subtitle, marginTop: 6, fontWeight: '600' }]}>
                    {t('addOffer.step6.commissionSummary.label')}{' '}
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {summaryIsZeroCommission
                        ? t('addOffer.step6.commissionSummary.zero')
                        : `${formatPercentLabel(summaryCommissionPercent!)} · ${summaryCommissionAmountLabel}`}
                    </Text>
                  </Text>
                ) : null}
              </View>
              <View style={[styles.typePill, { backgroundColor: draft.transactionType === 'RENT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.typePillText, { color: draft.transactionType === 'RENT' ? '#60a5fa' : '#34d399' }]}>
                  {draft.transactionType === 'RENT' ? t('addOffer.step6.transactionPill.rent') : t('addOffer.step6.transactionPill.sell')}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)' }]} />
            <LocationAddressSection />
            <SummaryLocationMap
              latitude={mapLat}
              longitude={mapLng}
              isExact={mapExact}
              isDark={isDark}
              subtitleColor={colors.subtitle}
              cardBorderColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.12)'}
              cardBgColor={isDark ? '#141416' : '#E5E7EB'}
              draftSalt={`${draft.city || ''}|${draft.district || ''}|${draft.street || ''}|${mapLat.toFixed(5)}:${mapLng.toFixed(5)}`}
              translate={t}
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
                    {t('addOffer.step6.commission.badge')}
                  </Text>
                </View>
                <Text style={[styles.commissionSummaryPercent, { color: summaryAccent }]}>
                  {formatPercentLabel(summaryCommissionPercent!)}
                </Text>
              </View>
              <Text style={[styles.commissionSummaryTitle, { color: colors.text }]}>
                {summaryIsZeroCommission ? t('addOffer.step6.commission.titleZero') : t('addOffer.step6.commission.titleDefault')}
              </Text>
              <Text style={[styles.commissionSummaryAmount, { color: colors.text }]}>
                {summaryCommissionAmountLabel}
              </Text>
              <Text style={[styles.commissionSummaryDesc, { color: colors.subtitle }]}>
                {summaryIsZeroCommission ? (
                  <>
                    {t('addOffer.step6.commission.subtitleZeroPrefix')}{' '}
                    <Text style={{ fontWeight: '800', color: summaryAccent }}>
                      {t('addOffer.step6.commission.subtitleZeroHighlight')}
                    </Text>{' '}
                    {t('addOffer.step6.commission.subtitleZeroSuffix')}
                  </>
                ) : (
                  <>
                    {t('addOffer.step6.commission.subtitleDefaultPrefix')}{' '}
                    <Text style={{ fontWeight: '800', color: summaryAccent }}>
                      {formatPercentLabel(summaryCommissionPercent!)}
                    </Text>{' '}
                    {t('addOffer.step6.commission.subtitleDefaultSuffix')}{' '}
                    <Text style={{ fontWeight: '800', color: colors.text }}>
                      {t('addOffer.step6.commission.subtitleVatNote')}
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
            <Text style={[styles.sectionTitle, { color: colors.subtitle }]}>{t('addOffer.step6.sections.parameters')}</Text>
            <View style={styles.gridBox}>
              <InfoBadge label={t('addOffer.step6.badges.type')} value={propertyTypeLabel} icon={propertyTypeIcon} />
              <InfoBadge label={areaBadgeLabel} value={areaBadgeValue} icon={draft.propertyType === 'PLOT' ? 'map-outline' : 'resize-outline'} />
              <InfoBadge
                label={t('addOffer.step6.badges.rooms')}
                value={draft.rooms ? t('addOffer.step6.badges.roomsValue', { count: draft.rooms }) : ''}
                icon="bed-outline"
              />
              <InfoBadge label={t('addOffer.step6.badges.floor')} value={formatFloorSummary(draft.floor, t)} icon="layers-outline" />
              <InfoBadge label={t('addOffer.step6.badges.yearBuilt')} value={yearLabel} icon="calendar-outline" />
              <InfoBadge label={t('addOffer.step6.badges.adminFee')} value={adminFeeSummaryLabel} icon="wallet-outline" />
              <InfoBadge label={t('addOffer.step6.badges.heating')} value={heatingSummaryLabel} icon="flame-outline" />
              <InfoBadge label={t('addOffer.step6.badges.furnished')} value={draft.isFurnished ? t('addOffer.common.yes') : t('addOffer.common.no')} icon="bed-outline" />
              <InfoBadge label={t('addOffer.step6.badges.totalFloors')} value={draft.totalFloors ? String(draft.totalFloors) : ''} icon="albums-outline" />
              <InfoBadge
                label={t('addOffer.step6.badges.plot')}
                value={draft.propertyType === 'HOUSE' && plotAreaSummary ? `${plotAreaSummary} m²` : ''}
                icon="trail-sign-outline"
              />
              <InfoBadge label={t('addOffer.step6.badges.condition')} value={draft.propertyType !== 'PLOT' ? conditionLabel : ''} icon={conditionIcon} />
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 18, color: colors.subtitle }]}>{t('addOffer.step6.sections.media')}</Text>
            <Text style={[styles.mediaSummaryText, { color: colors.subtitle }]}>
              {t('addOffer.step6.mediaSummary', {
                photos: draft.images?.length || 0,
                floorPlan: draft.floorPlan ? t('addOffer.step6.mediaYes') : t('addOffer.step6.mediaNo'),
                video: draft.videoUrl?.trim() ? t('addOffer.step6.mediaYes') : t('addOffer.step6.mediaNo'),
              })}
            </Text>
          </View>

          {activeAmenities.length > 0 ? (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
              <Text style={[styles.sectionTitle, { color: colors.subtitle }]}>{t('addOffer.step6.sections.amenities')}</Text>
              <View style={styles.amenitiesWrap}>
                {activeAmenities.map((key) => (
                  <View key={key} style={[styles.amenityPill, { backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.1)' }]}>
                    <Text style={[styles.amenityPillText, { color: colors.text }]}>{t(AMENITY_LABEL_KEYS[key])}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {draft.description ? (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.08)', shadowColor: isDark ? '#000' : '#9CA3AF' }]}>
              <Text style={[styles.sectionTitle, { color: colors.subtitle }]}>{t('addOffer.step6.sections.description')}</Text>
              <Text style={[styles.descriptionText, { color: colors.text }]}>{draft.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.absoluteBottom}>
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={[styles.blurWrapper, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.1)' }]}>
          {!isFinalDraftValid && invalidSteps.length > 0 ? (
            <Text style={[styles.validationHint, { color: colors.subtitle }]}>
              {t('addOffer.step6.validationHint', { steps: invalidSteps.join(', ') })}
            </Text>
          ) : null}
          {isFinalDraftValid && prefetchedPublicationCoupons.length > 0 ? (
            <Text style={[styles.validationHint, { color: '#FF9F0A' }]}>
              {t('addOffer.step6.couponPublishHint', { count: prefetchedPublicationCoupons.length })}
            </Text>
          ) : isFinalDraftValid && hasAdditionalPlusPublication(user) ? (
            <Text style={[styles.validationHint, { color: '#10B981' }]}>
              {t('addOffer.step6.plusCreditHint')}
            </Text>
          ) : null}
          <Pressable
            onPress={() => { void handlePublish(); }}
            disabled={loading}
            style={({ pressed }) => [
              styles.publishButton,
              {
                opacity: loading ? 0.45 : !isFinalDraftValid ? 0.72 : pressed ? 0.8 : 1,
                transform: [{ scale: pressed && !loading ? 0.98 : 1 }],
              },
            ]}
          >
            {loading ? <ActivityIndicator color="#FFF" style={{ marginRight: 10 }} /> : <Ionicons name="rocket" size={20} color="#fff" style={{ marginRight: 10 }} />}
            <Text style={styles.publishButtonText}>
              {loading
                ? uploadProgressText || t('addOffer.step6.publish.publishing')
                : isFinalDraftValid
                  ? t('addOffer.step6.publish.publish')
                  : t('addOffer.step6.publish.completeData')}
            </Text>
          </Pressable>
          <Pressable onPress={handleGoBack} disabled={loading} style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.5 : 1 }]}>
            <Text style={[styles.editButtonText, { color: colors.subtitle }]}>{t('addOffer.step6.publish.editData')}</Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
      <PublicationChoiceModal
        visible={publicationChoiceVisible}
        isDark={isDark}
        title={t('addOffer.step6.publicationChoice.title')}
        subtitle={t('addOffer.step6.publicationChoice.subtitle')}
        couponsSectionTitle={t('addOffer.step6.publicationChoice.couponsSection')}
        couponsEmptyHint={t('addOffer.step6.publicationChoice.couponsEmpty')}
        plusSectionTitle={t('addOffer.step6.publicationChoice.plusSection')}
        plusCreditLabel={t('addOffer.step6.publicationChoice.plusCreditTitle')}
        plusCreditSubtitle={t('addOffer.step6.publicationChoice.plusCreditSubtitle', {
          count: publicationChoicePlusSlots,
        })}
        buyPlusLabel={t('addOffer.step6.publicationChoice.buyPlusTitle')}
        buyPlusSubtitle={t('addOffer.step6.publicationChoice.buyPlusSubtitle', {
          price: PAKIET_PLUS_PRICE_LABEL,
        })}
        publishLabel={t('addOffer.step6.publicationChoice.publish')}
        cancelLabel={t('common.cancel')}
        couponPriorityHint={t('addOffer.step6.publicationChoice.couponPriorityHint')}
        coupons={publicationChoiceCoupons}
        plusSlots={publicationChoicePlusSlots}
        hasPlusCredit={publicationChoiceHasPlus}
        onConfirm={handlePublicationChoice}
        onClose={() => setPublicationChoiceVisible(false)}
      />
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
  detailIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' },
  locationStack: { marginBottom: 16, gap: 14 },
  locationStackItem: { gap: 6 },
  locationStackHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationStackLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  locationStackBody: { paddingLeft: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  locationStackValue: { fontSize: 16, fontWeight: '700', lineHeight: 22, flex: 1 },
  locationFlag: { fontSize: 20, lineHeight: 24 },
  validationHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 4, fontWeight: '600' },
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
