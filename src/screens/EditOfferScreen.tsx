import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  useColorScheme,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { Picker } from '@react-native-picker/picker';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import {
  applyLandRegistryPrefix,
  getCourtByLandRegistryPrefix,
  getLandRegistryPrefixSuggestions,
  isValidLandRegistryNumber,
  normalizeLandRegistryNumber,
} from '../utils/landRegistry';
import { formatPublicAddress, resolveIsExactLocation, stripHouseNumber } from '../constants/locationEcosystem';
import {
  AGENT_COMMISSION_DEFAULT_PERCENT,
  AGENT_COMMISSION_MAX_PERCENT,
  AGENT_COMMISSION_MIN_PERCENT,
  AGENT_COMMISSION_STEP_PERCENT,
  AGENT_COMMISSION_ZERO_PERCENT,
  computeAgentCommissionAmount,
  extractAgentCommissionPercent,
  formatPercentLabel,
  formatPlnAmount,
  isMobileAgentRole,
  isZeroCommissionPercent,
  parseAgentCommissionPercent,
  roundToQuarter,
  validateAgentCommissionPercent,
} from '../lib/agentCommission';
import { API_URL } from '../config/network';

const { width } = Dimensions.get('window');
const MAX_IMAGES = 15;
const HEATING_OPTIONS = ['', 'Miejskie', 'Gazowe', 'Elektryczne', 'Pompa Ciepła', 'Węglowe/Pellet', 'Inne'];

/** Wyciąga ukryte tokeny weryfikacyjne `<!-- ESTATEOS_VERIFY:... -->` z opisu.
 *  Są one wstawiane przez system i NIE powinny być widoczne właścicielowi w edytorze.
 *  Przy zapisie dołączamy je z powrotem, żeby nie utracić danych weryfikacji. */
function extractVerifyTokens(desc: string): { clean: string; tokens: string[] } {
  const tokens: string[] = [];
  const clean = desc
    .replace(/<!--\s*ESTATEOS_VERIFY:[^>]*-->/gi, (m) => { tokens.push(m); return ''; })
    .replace(/^\s+|\s+$/g, '');
  return { clean, tokens };
}

/** Pomocnicze formatowanie liczby z separatorem tysięcy (PL). */
function fmtPLN(val: string | number): string {
  const n = Number(String(val || '').replace(/\D/g, ''));
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString('pl-PL');
}

/**
 * Android wymaga ręcznego włączenia LayoutAnimation. Robimy to raz, top-level,
 * a flaga jest idempotentna — wielokrotne wywołanie z true nic nie psuje.
 */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type EditableImage = {
  /** Pełny URI do podglądu (zarówno lokalne pliki jak i URL serwera). */
  uri: string;
  /** True jeśli zdjęcie pochodzi z serwera (już opublikowane). */
  isRemote: boolean;
  /** Względna ścieżka serwerowa (np. `/uploads/abc.jpg`) — wysyłana w payloadzie. */
  serverPath?: string;
};

const isTrue = (val: any) => val === true || val === 'true' || val === 1;

const easeOut = Easing.out(Easing.cubic);

/**
 * Spójna animacja LayoutAnimation dla mikro-zmian (reorder zdjęć, pokazywanie
 * paska niezapisanych zmian). „spring" daje miękki, premium feel typowy dla
 * iOS, a 240 ms to sweet-spot między widocznym a nie irytującym.
 */
const enqueueLayoutSpring = () => {
  LayoutAnimation.configureNext({
    duration: 240,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'spring', springDamping: 0.78 },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
};

export default function EditOfferScreen({ route }: any) {
  const { offerId } = route.params;
  const navigation = useNavigation<any>();
  const mainScrollRef = useRef<ScrollView>(null);
  const { user, token } = useAuthStore() as any;
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  // --- APPLE COLOR PALETTE ---
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');
  const bgColor = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBgElevated = isDark ? '#252527' : '#FFFFFF';
  const txtColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = '#8E8E93';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const primaryColor = '#007AFF';

  const cardShadow = {
    shadowColor: isDark ? '#000000' : '#334155',
    shadowOpacity: isDark ? 0.72 : 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  };

  const controlShadow = {
    shadowColor: isDark ? '#000000' : '#94A3B8',
    shadowOpacity: isDark ? 0.55 : 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  // --- ZMIENNE FORMULARZA ---
  const [images, setImages] = useState<EditableImage[]>([]);
  const [originalImageKeys, setOriginalImageKeys] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [rooms, setRooms] = useState('');
  const [floor, setFloor] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [heating, setHeating] = useState('');
  const [verifyTokens, setVerifyTokens] = useState<string[]>([]);
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [landRegistryNumber, setLandRegistryNumber] = useState('');
  const [price, setPrice] = useState('');
  const [adminFee, setAdminFee] = useState('');
  /**
   * Procent prowizji agenta (string z TextInput — akceptuje `.` i `,`).
   * '' = brak (kupujący widzi ofertę bez pigułki prowizji).
   * '0' = świadome „BEZ PROWIZJI" (zielona pigułka u kupującego).
   * Inna wartość = standardowa prowizja w zakresie 0.5%–10%.
   */
  const [agentCommissionPercent, setAgentCommissionPercent] = useState<string>('');
  const [condition, setCondition] = useState<'READY' | 'DEVELOPER' | 'TO_RENOVATION'>('READY');
  const [isExactLocation, setIsExactLocation] = useState(true);
  const [amenities, setAmenities] = useState({
    hasBalcony: false,
    hasParking: false,
    hasStorage: false,
    hasElevator: false,
    hasGarden: false,
    isFurnished: false,
  });

  const landRegistryRaw = landRegistryNumber.trim();
  const isLandRegistryValid = isValidLandRegistryNumber(landRegistryRaw);
  const landRegistrySuggestions = getLandRegistryPrefixSuggestions(landRegistryRaw);
  const selectedCourt = getCourtByLandRegistryPrefix(landRegistryRaw);

  // -------- HELPERY ŚCIEŻEK ZDJĘĆ --------
  const toAbsoluteImageUrl = (img: string) => (img.startsWith('/uploads') ? `${API_URL}${img}` : img);
  const toServerPath = (img: string) => (img.startsWith(`${API_URL}/uploads`) ? img.replace(API_URL, '') : img);
  const isLocalUri = (uri: string) =>
    !uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('/uploads');

  // -------- POBRANIE OFERTY --------
  const fetchOffer = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${user?.id || ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        const offer = data.offers.find((o: any) => Number(o.id) === Number(offerId));
        if (offer) {
          setOriginalData(offer);
          setTitle(offer.title || '');
          const { clean: cleanDesc, tokens } = extractVerifyTokens(offer.description || '');
          setDescription(cleanDesc);
          setVerifyTokens(tokens);
          setPrice(offer.price?.toString() || '');
          setAdminFee(offer.adminFee?.toString() || '');
          // Prowizja agenta — backend zwraca `agentCommissionPercent` (number | null).
          // 0 → '0' (świadome „BEZ PROWIZJI"), null/undefined → '' (brak).
          const cp = extractAgentCommissionPercent(offer);
          if (cp === null) {
            setAgentCommissionPercent('');
          } else if (cp === 0) {
            setAgentCommissionPercent('0');
          } else {
            setAgentCommissionPercent(String(cp).replace('.', ','));
          }
          setArea(offer.area?.toString() || '');
          setRooms(offer.rooms?.toString() || '');
          setFloor(offer.floor?.toString() || '');
          setYearBuilt(offer.yearBuilt?.toString() || offer.buildYear?.toString() || '');
          setHeating(String(offer.heating || ''));
          setApartmentNumber(String(offer.apartmentNumber || ''));
          setLandRegistryNumber(String(offer.landRegistryNumber || ''));
          setCondition(offer.condition || 'READY');
          // Odczyt „Dokładnej lokalizacji" zunifikowany z resztą ekosystemu:
          // używamy `resolveIsExactLocation`, który traktuje wartości typu
          // `'false'`, `0`, `'0'`, `false` jako WYŁĄCZONE, a wszystko inne
          // (włącznie z `undefined`/brakiem pola) jako WŁĄCZONE — tak samo
          // jak `OfferDetail`, `Step6_Summary`, `LocationPreview`.
          // Dzięki temu, jeśli backend zwraca `false` w dowolnej formie,
          // przełącznik utrzyma stan po reopen.
          setIsExactLocation(resolveIsExactLocation(offer.isExactLocation));

          let parsedImages: string[] = [];
          if (offer.images) {
            parsedImages = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
            const mapped = parsedImages.map((img: string) => ({
              uri: toAbsoluteImageUrl(img),
              isRemote: true,
              serverPath: toServerPath(img),
            }));
            setImages(mapped);
            setOriginalImageKeys(mapped.map((i: EditableImage) => i.serverPath || i.uri));
          }

          setAmenities({
            hasBalcony: isTrue(offer.hasBalcony),
            hasParking: isTrue(offer.hasParking),
            hasStorage: isTrue(offer.hasStorage),
            hasElevator: isTrue(offer.hasElevator),
            hasGarden: isTrue(offer.hasGarden),
            isFurnished: isTrue(offer.isFurnished),
          });
        }
      }
    } catch (error) {
      Alert.alert('Błąd', 'Nie udało się pobrać oferty do edycji.');
    }
    setLoading(false);
  }, [offerId, token, user?.id]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  // -------- ANIMOWANY HERO --------
  // Delikatne, zapętlone „dychnięcie" ikony pióra w bocie powitalnym. Trwa
  // 2.4 s na cykl — wystarczy, by przyciągnąć wzrok, ale nie irytuje przy
  // dłuższej edycji.
  const heroBreath = useRef(new Animated.Value(0)).current;
  const heroSparkle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroBreath, { toValue: 1, duration: 1200, easing: easeOut, useNativeDriver: true }),
        Animated.timing(heroBreath, { toValue: 0, duration: 1200, easing: easeOut, useNativeDriver: true }),
      ])
    );
    loop.start();
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(heroSparkle, { toValue: 1, duration: 900, easing: easeOut, useNativeDriver: true }),
        Animated.timing(heroSparkle, { toValue: 0, duration: 900, easing: easeOut, useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    sparkleLoop.start();
    return () => {
      loop.stop();
      sparkleLoop.stop();
    };
  }, [heroBreath, heroSparkle]);

  // -------- DETEKCJA NIEZAPISANYCH ZMIAN --------
  /**
   * Porównanie aktualnego stanu z `originalData` zwraca licznik różnic
   * (max 6 — żeby uniknąć przeskalowanego komunikatu) oraz flagę `isDirty`.
   * Dzięki temu pokazujemy pasek „Niezapisane zmiany" dokładnie wtedy, gdy są,
   * a po zapisie pasek znika. Również steruje to active-state przycisku
   * sticky-save oraz alertem o utracie zmian przy `goBack`.
   */
  const { isDirty, dirtyCount } = useMemo(() => {
    if (!originalData) return { isDirty: false, dirtyCount: 0 };
    const diffs: string[] = [];
    const same = (a: any, b: any) => String(a ?? '') === String(b ?? '');
    const originalCleanDescription = extractVerifyTokens(originalData.description || '').clean;
    if (!same(title, originalData.title)) diffs.push('tytuł');
    if (!same(description.trim(), originalCleanDescription)) diffs.push('opis');
    if (!same(price, originalData.price)) diffs.push('cena');
    if (!same(adminFee, originalData.adminFee)) diffs.push('czynsz');
    // Prowizja — porównujemy SPARSOWANE liczby, żeby '2,5' vs '2.5' vs 2.5 dawały
    // ten sam diff (bez fałszywych „dirty"). null vs null = brak zmian.
    {
      const originalCp = extractAgentCommissionPercent(originalData);
      const currentCp = parseAgentCommissionPercent(agentCommissionPercent);
      const a = originalCp === null ? 'NULL' : String(roundToQuarter(originalCp));
      const b = currentCp === null ? 'NULL' : String(roundToQuarter(currentCp));
      if (a !== b) diffs.push('prowizja');
    }
    if (!same(area, originalData.area)) diffs.push('powierzchnia');
    if (!same(rooms, originalData.rooms)) diffs.push('pokoje');
    if (!same(floor, originalData.floor)) diffs.push('piętro');
    if (!same(yearBuilt, originalData.yearBuilt ?? originalData.buildYear)) diffs.push('rok');
    if (!same(heating, originalData.heating)) diffs.push('ogrzewanie');
    if (!same(apartmentNumber, originalData.apartmentNumber)) diffs.push('nr mieszkania');
    if (!same(landRegistryNumber, originalData.landRegistryNumber)) diffs.push('KW');
    if (!same(condition, originalData.condition || 'READY')) diffs.push('stan');
    if (Boolean(isExactLocation) !== resolveIsExactLocation(originalData.isExactLocation)) diffs.push('lokalizacja');
    (
      ['hasBalcony', 'hasParking', 'hasStorage', 'hasElevator', 'hasGarden', 'isFurnished'] as const
    ).forEach((k) => {
      if (Boolean((amenities as any)[k]) !== isTrue(originalData[k])) diffs.push(k);
    });
    const currentKeys = images.map((i) => i.serverPath || i.uri);
    const sameImages =
      currentKeys.length === originalImageKeys.length &&
      currentKeys.every((k, i) => k === originalImageKeys[i]) &&
      images.every((i) => i.isRemote);
    if (!sameImages) diffs.push('zdjęcia');
    return { isDirty: diffs.length > 0, dirtyCount: diffs.length };
  }, [
    originalData,
    title,
    description,
    price,
    adminFee,
    agentCommissionPercent,
    area,
    rooms,
    floor,
    yearBuilt,
    heating,
    apartmentNumber,
    landRegistryNumber,
    condition,
    isExactLocation,
    amenities,
    images,
    originalImageKeys,
  ]);

  // -------- BLOK „BACK" GDY SĄ NIEZAPISANE --------
  /**
   * Jeśli użytkownik próbuje opuścić ekran (Anuluj / swipe-back) mając brudny
   * formularz, pokazujemy bezpieczne potwierdzenie zamiast cichej utraty danych.
   * Słuchamy zdarzenia React Navigation `beforeRemove` — używamy `e.preventDefault()`
   * tylko gdy mamy zmiany do uratowania.
   */
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty || saving) return;
      e.preventDefault();
      Alert.alert(
        'Niezapisane zmiany',
        'Masz wprowadzone zmiany, które nie zostały jeszcze zapisane. Czy na pewno chcesz wyjść?',
        [
          { text: 'Wróć do edycji', style: 'cancel' },
          {
            text: 'Wyjdź bez zapisu',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsub;
  }, [navigation, isDirty, saving]);

  // -------- ZARZĄDZANIE ZDJĘCIAMI --------
  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentCount = images.length;
    if (currentCount >= MAX_IMAGES) {
      Alert.alert('Limit zdjęć', `Możesz dodać maksymalnie ${MAX_IMAGES} zdjęć.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      const slotsLeft = MAX_IMAGES - currentCount;
      const newItems: EditableImage[] = result.assets.slice(0, slotsLeft).map((asset) => ({
        uri: asset.uri,
        isRemote: false,
      }));
      enqueueLayoutSpring();
      setImages((prev) => [...prev, ...newItems]);
      if (result.assets.length > slotsLeft) {
        Alert.alert('Limit zdjęć', `Dodano tylko ${slotsLeft} zdjęć (maksymalnie ${MAX_IMAGES}).`);
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    enqueueLayoutSpring();
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  /**
   * Zamiana miejscami sąsiadami — proste strzałki ←/→. Wybór nie-najbliższego
   * sąsiada robi się wprost: kilka razy w prawo. Świadomie zostawiamy strzałki
   * zamiast drag-handle, bo na mniejszych iPhone'ach trafienie w uchwyt przy
   * trzymanej kamerze potrafi być nieprecyzyjne — strzałki są deterministyczne.
   */
  const moveImage = (from: number, dir: -1 | 1) => {
    setImages((prev) => {
      const to = from + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[to];
      next[to] = next[from];
      next[from] = tmp;
      return next;
    });
    Haptics.selectionAsync();
    enqueueLayoutSpring();
  };

  /**
   * Awansowanie zdjęcia na okładkę — przesuwa wybrany obraz na pozycję 0,
   * a pozostałe „przepada" o jedno w prawo. Klasyczny pattern z Photos.app.
   */
  const setAsCover = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    enqueueLayoutSpring();
  };

  // -------- RESET FORMULARZA DO ORYGINAŁU --------
  const resetForm = () => {
    if (!originalData) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    enqueueLayoutSpring();
    setTitle(originalData.title || '');
    const { clean: cleanDesc, tokens } = extractVerifyTokens(originalData.description || '');
    setDescription(cleanDesc);
    setVerifyTokens(tokens);
    setPrice(originalData.price?.toString() || '');
    setAdminFee(originalData.adminFee?.toString() || '');
    {
      const cp = extractAgentCommissionPercent(originalData);
      if (cp === null) setAgentCommissionPercent('');
      else if (cp === 0) setAgentCommissionPercent('0');
      else setAgentCommissionPercent(String(cp).replace('.', ','));
    }
    setArea(originalData.area?.toString() || '');
    setRooms(originalData.rooms?.toString() || '');
    setFloor(originalData.floor?.toString() || '');
    setYearBuilt(originalData.yearBuilt?.toString() || originalData.buildYear?.toString() || '');
    setHeating(String(originalData.heating || ''));
    setApartmentNumber(String(originalData.apartmentNumber || ''));
    setLandRegistryNumber(String(originalData.landRegistryNumber || ''));
    setCondition(originalData.condition || 'READY');
    setIsExactLocation(resolveIsExactLocation(originalData.isExactLocation));
    setAmenities({
      hasBalcony: isTrue(originalData.hasBalcony),
      hasParking: isTrue(originalData.hasParking),
      hasStorage: isTrue(originalData.hasStorage),
      hasElevator: isTrue(originalData.hasElevator),
      hasGarden: isTrue(originalData.hasGarden),
      isFurnished: isTrue(originalData.isFurnished),
    });
    // Przywracamy oryginalną kolejność zdjęć z serwera (bez lokalnych draftów).
    setImages(
      originalImageKeys.map((key) => ({
        uri: toAbsoluteImageUrl(key),
        isRemote: true,
        serverPath: key.startsWith('/uploads') ? key : toServerPath(key),
      }))
    );
  };

  // -------- ZAPIS --------
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    const remoteImages = images
      .filter((img) => img.isRemote && img.serverPath)
      .map((img) => img.serverPath as string);
    const localImages = images.filter((img) => !img.isRemote && isLocalUri(img.uri));

    if (!title.trim()) {
      Alert.alert('Walidacja', 'Tytuł oferty nie może być pusty.');
      setSaving(false);
      return;
    }
    if (!price || Number(price) <= 0) {
      Alert.alert('Walidacja', 'Podaj poprawną cenę oferty.');
      setSaving(false);
      return;
    }
    if (!isLandRegistryValid) {
      Alert.alert(
        'Walidacja',
        'Numer księgi wieczystej ma niepoprawny format. Użyj wzoru: WA4N/00012345/6'
      );
      setSaving(false);
      return;
    }

    /*
     * Walidacja prowizji agenta — przepuszczamy TYLKO jeśli aktualny user to
     * AGENT. Dla pozostałych ról pole jest defensywnie ignorowane (backend i
     * tak wymusza tę regułę poprzez `resolveAgentCommissionFromBody`).
     *
     * Reguły walidacji (zgodne z helperem):
     *   • '' (puste) → wyślemy `null` (CLEAR prowizji)
     *   • '0' → tryb „BEZ PROWIZJI", legalny
     *   • [0.5, 10] → standardowa prowizja, snap do 0.25 po stronie backendu
     *   • (0, 0.5) lub > 10 → blokujemy z dedykowanym alertem
     */
    const isAgentUser = isMobileAgentRole(user?.role);
    let resolvedCommission: number | null | undefined = undefined; // undefined = nie wysyłaj pola
    if (isAgentUser) {
      const rawCommission = agentCommissionPercent?.toString().trim() ?? '';
      if (rawCommission === '') {
        resolvedCommission = null;
      } else {
        const validation = validateAgentCommissionPercent(rawCommission);
        if (!validation.ok) {
          Alert.alert('Prowizja agenta', validation.message);
          setSaving(false);
          return;
        }
        resolvedCommission = validation.percent;
      }
    }

    // Wymuszamy literalny boolean dla `isExactLocation` — niektóre warianty
    // backendu interpretują `undefined`/brak pola jako „brak zmiany" lub
    // default `true`. Wysyłamy też alias `is_exact_location` (snake_case),
    // żeby pokryć backendy, które nie mapują automatycznie nazewnictwa.
    // To jest belt-and-suspenders dla bardzo konkretnego bug-reportu:
    // „klikam wyłączenie i nie zapisuje się dokładna lokalizacja".
    const isExactLocationBool = Boolean(isExactLocation);
    const updatePayload: Record<string, any> = {
      id: offerId,
      userId: user.id,
      title: title.trim(),
      description: [description?.trim() || '', ...verifyTokens].filter(Boolean).join('\n\n'),
      area: area ? Number(area) : 0,
      rooms: rooms ? Number(rooms) : null,
      floor: floor !== '' ? Number(floor) : null,
      yearBuilt: yearBuilt ? Number(yearBuilt) : null,
      price: Number(price),
      adminFee: adminFee ? Number(adminFee) : null,
      condition,
      isExactLocation: isExactLocationBool,
      is_exact_location: isExactLocationBool,
      hideExactAddress: !isExactLocationBool,
      status: originalData?.status || 'ACTIVE',
      images: remoteImages,
      ...amenities,
      heating: heating.trim() || null,
      apartmentNumber: apartmentNumber.trim() || undefined,
      landRegistryNumber: landRegistryNumber.trim() || undefined,
    };
    if (isAgentUser && resolvedCommission !== undefined) {
      updatePayload.agentCommissionPercent = resolvedCommission;
    }

    try {
      const response = await fetch(`${API_URL}/api/mobile/v1/offers`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) throw new Error('Odrzucone przez serwer.');
      const saveData = await response.json().catch(() => ({}));
      if (!saveData?.success) {
        throw new Error(saveData?.message || 'Serwer odrzucił zapis.');
      }
      if (__DEV__) {
        // Pomocne przy diagnostyce „nie zapisuje się przybliżonej lokalizacji":
        // od razu widać co serwer odesłał (jeśli echo'uje obiekt).
        const echoed = saveData?.offer?.isExactLocation;
        // eslint-disable-next-line no-console
        console.log('[EditOffer] PUT response — isExactLocation echo:', echoed, 'sent:', isExactLocationBool);
      }

      // Upload tylko nowych lokalnych zdjęć — uploadu nie próbujemy, jeśli
      // backend nie potwierdził zapisu meta. Dzięki temu nie zostają „sieroty"
      // w storage.
      for (let i = 0; i < localImages.length; i += 1) {
        const img = localImages[i];
        let localUri = img.uri;
        let filename = localUri.split('/').pop() || `image_${Date.now()}_${i}.jpg`;
        const mimeType = 'image/jpeg';

        const lower = localUri.toLowerCase();
        const isHeicLike = lower.endsWith('.heic') || lower.endsWith('.heif');
        if (isHeicLike) {
          const converted = await ImageManipulator.manipulateAsync(localUri, [], {
            format: ImageManipulator.SaveFormat.JPEG,
            compress: 0.88,
          });
          localUri = converted.uri;
          filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
        } else if (!filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
          filename = `${filename}.jpg`;
        }

        const formData = new FormData();
        formData.append('offerId', String(offerId));
        formData.append('file', { uri: localUri, name: filename, type: mimeType } as any);
        const uploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.text();
          throw new Error(uploadErr || `Upload zdjęcia ${i + 1} nie powiódł się.`);
        }
      }

      // Lokalnie aktualizujemy „original snapshot", żeby `isDirty` zgasł
      // natychmiast po zapisie, bez kolejnego round-tripu sieci.
      setOriginalData({
        ...(originalData || {}),
        title: updatePayload.title,
        description: updatePayload.description,
        price: updatePayload.price,
        adminFee: updatePayload.adminFee,
        agentCommissionPercent:
          isAgentUser && resolvedCommission !== undefined ? resolvedCommission : originalData?.agentCommissionPercent ?? null,
        area: updatePayload.area,
        rooms: updatePayload.rooms,
        floor: updatePayload.floor,
        yearBuilt: updatePayload.yearBuilt,
        heating: updatePayload.heating || '',
        apartmentNumber: updatePayload.apartmentNumber || '',
        landRegistryNumber: updatePayload.landRegistryNumber || '',
        condition: updatePayload.condition,
        isExactLocation: updatePayload.isExactLocation,
        hasBalcony: updatePayload.hasBalcony,
        hasParking: updatePayload.hasParking,
        hasStorage: updatePayload.hasStorage,
        hasElevator: updatePayload.hasElevator,
        hasGarden: updatePayload.hasGarden,
        isFurnished: updatePayload.isFurnished,
      });
      setOriginalImageKeys(images.filter((i) => i.isRemote).map((i) => i.serverPath || i.uri));

      /**
       * WERYFIKACJA PO ZAPISIE — „czy serwer rzeczywiście przyjął
       * `isExactLocation`?".
       *
       * Bug-report: użytkownik zmienia przełącznik na „przybliżoną lokalizację",
       * zapisuje, po reopen widok wraca do trybu dokładnego. Możliwe przyczyny
       * po stronie backendu:
       *   • PUT ignoruje pole (np. brak w whitelist DTO),
       *   • PUT zapisuje wartość, ale GET zwraca default `true`.
       *
       * Próbujemy ponownego GET-a i porównujemy. Gdy serwer NIE odebrał zmiany,
       * informujemy użytkownika wprost (zamiast po cichu kłamać UI-em), żeby
       * wiedział że to nie jest „klik nie działa" — tylko serwer wymaga
       * dopytania pomocy technicznej.
       */
      try {
        const verifyRes = await fetch(
          `${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${user?.id || ''}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );
        const verifyJson = await verifyRes.json().catch(() => ({}));
        const fresh = Array.isArray(verifyJson?.offers)
          ? verifyJson.offers.find((o: any) => Number(o?.id) === Number(offerId))
          : null;
        if (fresh) {
          const persisted = resolveIsExactLocation(fresh.isExactLocation);
          if (persisted !== isExactLocationBool) {
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.warn(
                '[EditOffer] Backend zignorował isExactLocation. Wysłano:',
                isExactLocationBool,
                'po PUT widzimy:',
                persisted
              );
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
              'Częściowo zapisano',
              isExactLocationBool
                ? 'Zmiany zostały zapisane, ale serwer nie odebrał włączenia „Dokładnej lokalizacji". Spróbuj jeszcze raz lub skontaktuj się z pomocą.'
                : 'Zmiany zostały zapisane, ale serwer nie odebrał wyłączenia „Dokładnej lokalizacji" — adres może być nadal widoczny publicznie. Spróbuj jeszcze raz lub skontaktuj się z pomocą.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            setSaving(false);
            return;
          }
        }
      } catch {
        // Weryfikacja jest best-effort — brak sieci nie powinien blokować
        // dalszego flow. Zapis już się powiódł od strony PUT-a.
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Zapisano', 'Zmiany zostały pomyślnie zapisane.', [
        { text: 'Super', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Błąd', e?.message || 'Wystąpił problem podczas zapisywania na serwerze.');
    }
    setSaving(false);
  };

  // -------- HINT GALERII (znika po pierwszej zmianie kolejności) --------
  const [galleryHintDismissed, setGalleryHintDismissed] = useState(false);
  useEffect(() => {
    if (images.length === 0) return;
    // Hint pokazujemy tylko gdy są ≥2 zdjęcia (jest co przestawiać).
    if (images.length < 2) setGalleryHintDismissed(true);
  }, [images.length]);

  /* ===========================================================
   *  PROWIZJA AGENTA — UI helpery (kopia logiki ze `Step4_Finance`).
   *  Sekcja jest renderowana TYLKO gdy aktualny user ma rolę `AGENT`.
   *  Cena oferty nie jest podnoszona — to wyłącznie informacja dla
   *  kupującego, jaka część ceny stanowi prowizję agenta.
   * =========================================================== */
  const isAgentUserUI = isMobileAgentRole(user?.role);
  const commissionPercentParsed = parseAgentCommissionPercent(agentCommissionPercent);
  const hasCommissionSlot = commissionPercentParsed !== null;
  const isZeroCommission = isZeroCommissionPercent(commissionPercentParsed);
  const commissionAmount = isZeroCommission
    ? 0
    : computeAgentCommissionAmount(price, commissionPercentParsed);
  const commissionInRange =
    commissionPercentParsed !== null &&
    (commissionPercentParsed === AGENT_COMMISSION_ZERO_PERCENT ||
      (commissionPercentParsed >= AGENT_COMMISSION_MIN_PERCENT &&
        commissionPercentParsed <= AGENT_COMMISSION_MAX_PERCENT));

  const commissionAccent = isZeroCommission ? '#10b981' : '#FF9F0A';
  const commissionAccentBgLight = isZeroCommission ? 'rgba(16,185,129,0.12)' : 'rgba(255,159,10,0.12)';
  const commissionAccentBgStrong = isZeroCommission ? 'rgba(16,185,129,0.18)' : 'rgba(255,159,10,0.16)';
  const commissionAccentBorder = isZeroCommission ? 'rgba(16,185,129,0.55)' : 'rgba(255,159,10,0.55)';

  const handleCommissionChange = (text: string) => {
    // Akceptujemy tylko cyfry, kropkę i przecinek — agresywna walidacja
    // dzieje się w `handleSave` (`validateAgentCommissionPercent`).
    const cleaned = text.replace(/[^0-9.,]/g, '');
    setAgentCommissionPercent(cleaned);
  };

  /** Zmiana o ±0.25 z preserwacją „twardych" przejść:
   *   • 0% + krok dodatni → skacze do `AGENT_COMMISSION_MIN_PERCENT` (0.5%)
   *   • 0.5% + krok ujemny → skacze do 0% (świadomy tryb „Bez prowizji"). */
  const adjustCommission = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const base = commissionPercentParsed ?? AGENT_COMMISSION_DEFAULT_PERCENT;
    if (delta > 0 && base === 0) {
      setAgentCommissionPercent(String(AGENT_COMMISSION_MIN_PERCENT).replace('.', ','));
      return;
    }
    if (delta < 0 && base <= AGENT_COMMISSION_MIN_PERCENT) {
      setAgentCommissionPercent('0');
      return;
    }
    const next = Math.max(
      AGENT_COMMISSION_MIN_PERCENT,
      Math.min(AGENT_COMMISSION_MAX_PERCENT, roundToQuarter(base + delta)),
    );
    setAgentCommissionPercent(String(next).replace('.', ','));
  };

  const enableDefaultCommission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAgentCommissionPercent(String(AGENT_COMMISSION_DEFAULT_PERCENT).replace('.', ','));
  };
  const enableZeroCommission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAgentCommissionPercent('0');
  };
  const clearCommission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAgentCommissionPercent('');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const TILE = (width - 16 * 2 - 12 * 2 - 8 * 2) / 3;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* APPLE PREMIUM HEADER */}
      <BlurView
        intensity={isDark ? 80 : 100}
        tint={isDark ? 'dark' : 'light'}
        style={styles.headerGlass}
      >
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={[styles.headerBtnText, { color: primaryColor, fontWeight: '400' }]}>Anuluj</Text>
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[styles.headerTitle, { color: txtColor }]}>Edycja oferty</Text>
            {isDirty && (
              <Text style={styles.headerSubtitle}>
                {dirtyCount} {dirtyCount === 1 ? 'zmiana' : dirtyCount < 5 ? 'zmiany' : 'zmian'} do zapisania
              </Text>
            )}
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saving || !isDirty}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Text
                style={[
                  styles.headerBtnText,
                  {
                    color: isDirty ? primaryColor : subColor,
                    fontWeight: '700',
                  },
                ]}
              >
                Zapisz
              </Text>
            )}
          </Pressable>
        </View>
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets
        >
          {/* ====== HERO „TWOJE OKNO EDYCJI" ====== */}
          <View style={[styles.heroCard, { backgroundColor: cardBgElevated, borderColor }]}>
            <View style={styles.heroIconWrap}>
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: heroBreath.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.heroIconBubble}>
                  <Ionicons name="create" size={22} color="#FFFFFF" />
                </View>
              </Animated.View>
              <Animated.View
                style={[
                  styles.heroSparkle,
                  {
                    opacity: heroSparkle.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }),
                    transform: [
                      {
                        scale: heroSparkle.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="sparkles" size={11} color="#FFD60A" />
              </Animated.View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>TWOJE OKNO EDYCJI</Text>
              <Text style={[styles.heroTitle, { color: txtColor }]}>Doszlifuj swoje ogłoszenie</Text>
              <Text style={[styles.heroSubtitle, { color: subColor }]}>
                Zmiany zapisują się natychmiast i pojawiają w Radarze, na liście ofert i w karcie publicznej.
                Możesz wracać tu kiedy chcesz.
              </Text>
            </View>
          </View>

          {/* ====== PASEK NIEZAPISANYCH ZMIAN ====== */}
          {isDirty && (
            <View style={styles.dirtyPill}>
              <View style={styles.dirtyDot} />
              <Text style={styles.dirtyText}>
                Niezapisane zmiany ({dirtyCount}) — pamiętaj, by zatwierdzić „Zapisz”
              </Text>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Cofnij wszystkie zmiany?',
                    'Wrócisz do wersji oferty zapisanej na serwerze. Tego nie da się cofnąć.',
                    [
                      { text: 'Anuluj', style: 'cancel' },
                      { text: 'Cofnij', style: 'destructive', onPress: resetForm },
                    ]
                  );
                }}
                style={styles.dirtyResetBtn}
              >
                <Text style={styles.dirtyResetText}>Cofnij</Text>
              </Pressable>
            </View>
          )}

          {/* ====== GALERIA ZDJĘĆ ====== */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>GALERIA ZDJĘĆ</Text>
            <Text style={styles.sectionSubtitle}>
              {images.length} / {MAX_IMAGES}
            </Text>
          </View>

          {/* Animowana wskazówka — fade-out po pierwszym układaniu */}
          {!galleryHintDismissed && images.length >= 2 && (
            <View style={styles.galleryHint}>
              <Ionicons name="bulb" size={14} color="#10B981" />
              <Text style={styles.galleryHintText}>
                Pierwsze zdjęcie to okładka. Użyj strzałek ← → aby przestawić, albo gwiazdki, aby ustawić jako
                główne.
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  enqueueLayoutSpring();
                  setGalleryHintDismissed(true);
                }}
              >
                <Ionicons name="close" size={14} color="#10B981" />
              </Pressable>
            </View>
          )}

          <View style={[styles.premiumGroup, { backgroundColor: cardBg, padding: 12 }]}>
            <View style={styles.imageGrid}>
              <Pressable
                style={[
                  styles.addImageBtn,
                  { width: TILE, height: TILE, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                ]}
                onPress={pickImage}
              >
                <Ionicons name="camera" size={26} color={primaryColor} />
                <Text style={[styles.addImageText, { color: primaryColor }]}>Dodaj</Text>
              </Pressable>

              {images.map((img, index) => {
                const isFirst = index === 0;
                const isLast = index === images.length - 1;
                return (
                  <View key={`${img.uri}-${index}`} style={[styles.imageWrapper, { width: TILE, height: TILE }]}>
                    <Image
                      source={{ uri: img.uri }}
                      style={styles.imageThumbnail}
                      contentFit="cover"
                      transition={200}
                    />

                    {/* Delete */}
                    <Pressable
                      style={styles.deleteImageBtn}
                      onPress={() => removeImage(index)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="#FFF" />
                    </Pressable>

                    {/* Cover badge */}
                    {isFirst ? (
                      <View style={styles.mainPhotoBadge}>
                        <Ionicons name="star" size={9} color="#FFD60A" />
                        <Text style={styles.mainPhotoText}>Główne</Text>
                      </View>
                    ) : null}

                    {/* Mini-pasek akcji ←  ☆  → przy dolnej krawędzi */}
                    <View style={styles.imageActionsBar}>
                      <Pressable
                        disabled={isFirst}
                        onPress={() => moveImage(index, -1)}
                        style={[styles.imageActionBtn, isFirst && styles.imageActionBtnDisabled]}
                        hitSlop={6}
                      >
                        <Ionicons name="chevron-back" size={14} color={isFirst ? '#888' : '#FFF'} />
                      </Pressable>
                      {!isFirst ? (
                        <Pressable
                          onPress={() => setAsCover(index)}
                          style={styles.imageActionBtn}
                          hitSlop={6}
                        >
                          <Ionicons name="star-outline" size={13} color="#FFD60A" />
                        </Pressable>
                      ) : (
                        <View style={[styles.imageActionBtn, styles.imageActionBtnDisabled]}>
                          <Ionicons name="star" size={13} color="#FFD60A" />
                        </View>
                      )}
                      <Pressable
                        disabled={isLast}
                        onPress={() => moveImage(index, 1)}
                        style={[styles.imageActionBtn, isLast && styles.imageActionBtnDisabled]}
                        hitSlop={6}
                      >
                        <Ionicons name="chevron-forward" size={14} color={isLast ? '#888' : '#FFF'} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={styles.sectionFooter}>
            Pierwsze zdjęcie pokazujemy w wynikach Radaru i jako okładkę oferty publicznej. Zmieniaj kolejność,
            aż dopasujesz idealny pierwszy kadr.
          </Text>

          {/* ====== INFORMACJE GŁÓWNE ====== */}
          <Text style={styles.sectionTitle}>INFORMACJE GŁÓWNE</Text>
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor, ...cardShadow }]}>
            <View style={styles.fieldHeaderRow}>
              <View style={[styles.fieldIconBadge, { backgroundColor: isDark ? '#10243D' : '#E8F2FF' }]}>
                <Ionicons name="text" size={17} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldTitle, { color: txtColor }]}>Tytuł oferty</Text>
                <Text style={[styles.fieldHint, { color: subColor }]}>
                  Krótki, konkretny nagłówek widoczny w Radarze i na liście.
                </Text>
              </View>
            </View>
            <TextInput
              style={[
                styles.titleInputPremium,
                {
                  color: txtColor,
                  backgroundColor: isDark ? '#141416' : '#F7F8FA',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Tytuł ogłoszenia"
              placeholderTextColor={subColor}
            />
          </View>

          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor, ...cardShadow }]}>
            <View style={styles.fieldHeaderRow}>
              <View style={[styles.fieldIconBadge, { backgroundColor: isDark ? '#1F1830' : '#F4ECFF' }]}>
                <Ionicons name="document-text" size={17} color="#AF52DE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldTitle, { color: txtColor }]}>Opis publiczny</Text>
                <Text style={[styles.fieldHint, { color: subColor }]}>
                  Tekst widoczny dla kupujących. Dane techniczne i weryfikacyjne są niżej, oddzielnie.
                </Text>
              </View>
            </View>
            <TextInput
              style={[
                styles.textAreaPremium,
                {
                  color: txtColor,
                  backgroundColor: isDark ? '#141416' : '#F7F8FA',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Opis nieruchomości…"
              placeholderTextColor={subColor}
              multiline
            />
          </View>

          {/* ====== PARAMETRY ====== */}
          <Text style={styles.sectionTitle}>PARAMETRY NIERUCHOMOŚCI</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            {/* Powierzchnia — TextInput bo zakres jest szeroki */}
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Powierzchnia</Text>
              <TextInput
                style={[styles.inputRightPremium, { color: txtColor }]}
                value={area}
                onChangeText={(t) => setArea(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={subColor}
              />
              <Text style={styles.inputSuffix}>m²</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* Liczba pokoi — stepper */}
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Liczba pokoi</Text>
              <View style={styles.stepperInline}>
                <Pressable
                  hitSlop={8}
                  style={[
                    styles.stepperMiniBtn,
                    {
                      borderColor,
                      backgroundColor: isDark ? '#151518' : '#FFFFFF',
                      ...controlShadow,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRooms(String(Math.max(0, Number(rooms || 0) - 1)));
                  }}
                >
                  <Ionicons name="remove" size={16} color={primaryColor} />
                </Pressable>
                <TextInput
                  style={[styles.stepperValueInput, { color: txtColor }]}
                  value={rooms}
                  onChangeText={(t) => setRooms(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={subColor}
                  textAlign="center"
                />
                <Pressable
                  hitSlop={8}
                  style={[
                    styles.stepperMiniBtn,
                    {
                      borderColor,
                      backgroundColor: isDark ? '#151518' : '#FFFFFF',
                      ...controlShadow,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRooms(String(Number(rooms || 0) + 1));
                  }}
                >
                  <Ionicons name="add" size={16} color={primaryColor} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* Piętro — stepper (może być 0) */}
            <View style={styles.inputRowPremium}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Piętro</Text>
                {floor === '0' && (
                  <Text style={{ fontSize: 11, color: subColor, marginTop: 1 }}>Parter</Text>
                )}
              </View>
              <View style={styles.stepperInline}>
                <Pressable
                  hitSlop={8}
                  style={[
                    styles.stepperMiniBtn,
                    {
                      borderColor,
                      backgroundColor: isDark ? '#151518' : '#FFFFFF',
                      ...controlShadow,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFloor(String(Math.max(0, Number(floor || 0) - 1)));
                  }}
                >
                  <Ionicons name="remove" size={16} color={primaryColor} />
                </Pressable>
                <TextInput
                  style={[styles.stepperValueInput, { color: txtColor }]}
                  value={floor}
                  onChangeText={(t) => setFloor(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={subColor}
                  textAlign="center"
                />
                <Pressable
                  hitSlop={8}
                  style={[
                    styles.stepperMiniBtn,
                    {
                      borderColor,
                      backgroundColor: isDark ? '#151518' : '#FFFFFF',
                      ...controlShadow,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFloor(String(Number(floor || 0) + 1));
                  }}
                >
                  <Ionicons name="add" size={16} color={primaryColor} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* Rok budowy — TextInput (zakres 1900-2099) */}
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Rok budowy</Text>
              <TextInput
                style={[styles.inputRightPremium, { color: txtColor }]}
                value={yearBuilt}
                onChangeText={(t) => setYearBuilt(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="np. 2009"
                placeholderTextColor={subColor}
                maxLength={4}
              />
            </View>
          </View>

          {/* ====== CENA ====== */}
          <Text style={styles.sectionTitle}>CENA I KOSZTY</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            {/* Podgląd ceny sformatowanej + input inline */}
            <View style={styles.priceHeaderRow}>
              <View>
                <Text style={[styles.priceLabel, { color: subColor }]}>Cena ofertowa</Text>
                <Text style={[styles.priceFormatted, { color: txtColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {fmtPLN(price) || '—'}{' '}
                  <Text style={[styles.priceCurrency, { color: subColor }]}>PLN</Text>
                </Text>
                {Number(area) > 0 && Number(price) > 0 ? (
                  <Text style={[styles.priceSqm, { color: subColor }]}>
                    {Math.round(Number(price) / Number(area)).toLocaleString('pl-PL')} PLN/m²
                  </Text>
                ) : null}
              </View>
              <TextInput
                style={[styles.priceInput, { color: txtColor, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]}
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={subColor}
                textAlign="right"
              />
            </View>
            {/* Quickpick steppers */}
            <View style={styles.priceStepperRow}>
              {([-50000, -5000, -1000, 1000, 5000, 50000] as const).map((delta) => {
                const isPos = delta > 0;
                const abs = Math.abs(delta);
                const label = `${isPos ? '+' : '−'}${abs >= 1000 ? `${abs / 1000}k` : abs}`;
                return (
                  <Pressable
                    key={delta}
                    style={[
                      styles.priceStepBtn,
                      {
                        borderColor: isPos ? 'rgba(52,199,89,0.36)' : 'rgba(255,59,48,0.32)',
                        backgroundColor: isPos
                          ? isDark ? 'rgba(52,199,89,0.14)' : 'rgba(52,199,89,0.10)'
                          : isDark ? 'rgba(255,59,48,0.14)' : 'rgba(255,59,48,0.09)',
                        ...controlShadow,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const cur = Number(price || 0);
                      const next = Math.max(0, cur + delta);
                      setPrice(String(next));
                    }}
                    hitSlop={4}
                  >
                    <Text style={[styles.priceStepTxt, { color: isPos ? '#34C759' : '#FF3B30' }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Czynsz admin.</Text>
              <TextInput
                style={[styles.inputRightPremium, { color: txtColor }]}
                value={adminFee}
                onChangeText={(t) => setAdminFee(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={subColor}
              />
              <Text style={styles.inputSuffix}>PLN / mc</Text>
            </View>
          </View>
          <Text style={styles.sectionFooter}>Sama zmiana ceny nie ukrywa oferty z Radaru.</Text>

          {/*
            ====== PROWIZJA AGENTA ======
            Sekcja widoczna TYLKO dla użytkowników z rolą AGENT. Pozwala:
              • dodać świeżą prowizję (CTA „2,5%" lub „Bez prowizji"),
              • edytować istniejącą (stepper ±0,25 / input z procentem),
              • przejść w tryb 0% („Bez prowizji" — zielona pigułka u kupującego),
              • wyczyścić (X) — wtedy oferta przestaje pokazywać pigułkę prowizji.
            Walidacja zakresu wykonuje się przy zapisie (handleSave).
          */}
          {isAgentUserUI ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>PROWIZJA AGENTA</Text>
              <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
                <View style={styles.commissionHeader}>
                  <View
                    style={[
                      styles.commissionHeaderBadge,
                      { backgroundColor: commissionAccentBgStrong, borderColor: commissionAccentBorder },
                    ]}
                  >
                    <Ionicons
                      name={isZeroCommission ? 'gift-outline' : 'briefcase-outline'}
                      size={14}
                      color={commissionAccent}
                    />
                    <Text style={[styles.commissionHeaderBadgeText, { color: commissionAccent }]}>
                      EstateOS™ Agent
                    </Text>
                  </View>
                  {hasCommissionSlot ? (
                    <Pressable onPress={clearCommission} hitSlop={10} style={styles.commissionClearBtn}>
                      <Ionicons name="close-circle" size={20} color={subColor} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[styles.commissionTitle, { color: txtColor }]}>
                  {isZeroCommission ? 'Oferta bez prowizji' : 'Twoja prowizja'}
                </Text>
                <Text style={[styles.commissionSubtitle, { color: subColor }]}>
                  {isZeroCommission ? (
                    <>
                      Kupujący nie płaci prowizji od tej oferty. Adnotacja „Bez prowizji” pojawi się na ogłoszeniu — przyciąga uwagę i buduje zaufanie.
                    </>
                  ) : hasCommissionSlot ? (
                    <>
                      Cena oferty pozostaje bez zmian. Kupujący zobaczy adnotację, że z tej ceny{' '}
                      <Text style={{ fontWeight: '800', color: txtColor }}>
                        {formatPercentLabel(commissionPercentParsed!)}
                      </Text>{' '}
                      stanowi Twoją prowizję — opłacaną Tobie bezpośrednio po sfinalizowaniu transakcji.{' '}
                      <Text style={{ fontWeight: '800', color: txtColor }}>
                        Kwota jest BRUTTO (zawiera VAT) — kupujący nie dopłaca żadnego podatku.
                      </Text>
                    </>
                  ) : (
                    <>
                      Wybierz prowizję 0,5%–10% lub tryb „Bez prowizji” (0%). Cena oferty się NIE zmieni — kupujący zobaczy tylko adnotację o prowizji.{' '}
                      <Text style={{ fontWeight: '800', color: txtColor }}>
                        Wpisana kwota jest BRUTTO — zawiera VAT, bez dodatkowego podatku.
                      </Text>
                    </>
                  )}
                </Text>

                {!hasCommissionSlot ? (
                  <View style={styles.commissionCtaRow}>
                    <Pressable
                      onPress={enableDefaultCommission}
                      style={({ pressed }) => [
                        styles.commissionAddCta,
                        {
                          flex: 1,
                          backgroundColor: isDark ? 'rgba(255,159,10,0.16)' : 'rgba(255,159,10,0.12)',
                          borderColor: 'rgba(255,159,10,0.6)',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="add-circle-outline" size={20} color="#FF9F0A" />
                      <Text style={[styles.commissionAddCtaText, { color: '#FF9F0A' }]} numberOfLines={1}>
                        Prowizja {formatPercentLabel(AGENT_COMMISSION_DEFAULT_PERCENT)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={enableZeroCommission}
                      style={({ pressed }) => [
                        styles.commissionAddCta,
                        {
                          flex: 1,
                          backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
                          borderColor: 'rgba(16,185,129,0.6)',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="gift-outline" size={20} color="#10b981" />
                      <Text style={[styles.commissionAddCtaText, { color: '#10b981' }]} numberOfLines={1}>
                        Bez prowizji
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.commissionCard,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        borderColor: commissionInRange ? commissionAccentBorder : '#FF3B30',
                        shadowColor: commissionAccent,
                        shadowOpacity: isDark ? 0.18 : 0.12,
                        shadowRadius: 14,
                        shadowOffset: { width: 0, height: 5 },
                        elevation: 3,
                      },
                    ]}
                  >
                    <View style={styles.commissionRow}>
                      <View style={styles.commissionInputCol}>
                        <Text style={[styles.commissionLabel, { color: subColor }]}>Prowizja</Text>
                        <View
                          style={[
                            styles.commissionInputBox,
                            { backgroundColor: commissionAccentBgLight, borderColor: commissionAccentBorder },
                          ]}
                        >
                          <TextInput
                            style={[styles.commissionInput, { color: txtColor }]}
                            value={String(agentCommissionPercent || '')}
                            onChangeText={handleCommissionChange}
                            placeholder={String(AGENT_COMMISSION_DEFAULT_PERCENT).replace('.', ',')}
                            placeholderTextColor={subColor}
                            keyboardType="decimal-pad"
                            maxLength={5}
                          />
                          <Text style={[styles.commissionInputSuffix, { color: txtColor }]}>%</Text>
                        </View>
                        <View style={styles.commissionStepRow}>
                          <Pressable
                            onPress={() => adjustCommission(-AGENT_COMMISSION_STEP_PERCENT)}
                            style={[
                              styles.commissionStepBtn,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
                            ]}
                          >
                            <Ionicons name="remove" size={16} color={txtColor} />
                          </Pressable>
                          <Pressable
                            onPress={() => adjustCommission(AGENT_COMMISSION_STEP_PERCENT)}
                            style={[
                              styles.commissionStepBtn,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
                            ]}
                          >
                            <Ionicons name="add" size={16} color={txtColor} />
                          </Pressable>
                          <Text style={[styles.commissionStepHint, { color: subColor }]}>
                            krok {formatPercentLabel(AGENT_COMMISSION_STEP_PERCENT)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.commissionAmountCol}>
                        <Text style={[styles.commissionLabel, { color: subColor }]} numberOfLines={1}>
                          {isZeroCommission ? 'dla kupującego' : 'z ceny ofertowej'}
                        </Text>
                        <Text
                          style={[styles.commissionAmountValue, { color: commissionAccent }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.5}
                        >
                          {isZeroCommission
                            ? 'BEZ PROWIZJI'
                            : commissionAmount > 0
                              ? formatPlnAmount(commissionAmount)
                              : '— PLN'}
                        </Text>
                        <Text style={[styles.commissionAmountHint, { color: subColor }]} numberOfLines={2}>
                          {isZeroCommission
                            ? 'Kupujący nie płaci prowizji.'
                            : 'To Twoje wynagrodzenie z transakcji.'}
                        </Text>
                      </View>
                    </View>

                    {!commissionInRange ? (
                      <View style={styles.commissionWarn}>
                        <Ionicons name="warning-outline" size={14} color="#FF3B30" />
                        <Text style={[styles.commissionWarnText, { color: '#FF3B30' }]}>
                          Prowizja musi być równa 0% (bez prowizji) lub w zakresie{' '}
                          {formatPercentLabel(AGENT_COMMISSION_MIN_PERCENT)}–
                          {formatPercentLabel(AGENT_COMMISSION_MAX_PERCENT)}.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              <Text style={styles.sectionFooter}>
                Cena oferty NIE jest podnoszona. Klient widzi tylko adnotację o prowizji.
              </Text>
            </>
          ) : null}

          {/* ====== STAN ====== */}
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>STAN WYKOŃCZENIA</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <View style={styles.segmentContainer}>
              {(['READY', 'DEVELOPER', 'TO_RENOVATION'] as const).map((t) => {
                const isActive = condition === t;
                const labels = { READY: 'Gotowe', DEVELOPER: 'Deweloperski', TO_RENOVATION: 'Do remontu' };
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCondition(t);
                    }}
                    style={[
                      styles.segmentBtn,
                      isActive && {
                        backgroundColor: isDark ? '#48484A' : '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.12,
                        shadowRadius: 3,
                      },
                    ]}
                  >
                    <Text style={[styles.segmentText, isActive && { color: txtColor, fontWeight: '700' }]}>
                      {labels[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ====== UDOGODNIENIA ====== */}
          <Text style={styles.sectionTitle}>WYPOSAŻENIE I CECHY</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <AmenityRow
              icon="leaf"
              tint="#34C759"
              label="Balkon / Taras"
              value={amenities.hasBalcony}
              onChange={(v) => setAmenities({ ...amenities, hasBalcony: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="flower"
              tint="#FF2D55"
              label="Prywatny ogródek"
              value={amenities.hasGarden}
              onChange={(v) => setAmenities({ ...amenities, hasGarden: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="car"
              tint="#5856D6"
              label="Miejsce parkingowe"
              value={amenities.hasParking}
              onChange={(v) => setAmenities({ ...amenities, hasParking: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="swap-vertical"
              tint="#007AFF"
              label="Winda w budynku"
              value={amenities.hasElevator}
              onChange={(v) => setAmenities({ ...amenities, hasElevator: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="cube"
              tint="#FF9500"
              label="Piwnica / Komórka"
              value={amenities.hasStorage}
              onChange={(v) => setAmenities({ ...amenities, hasStorage: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="bed"
              tint="#AF52DE"
              label="Pełne umeblowanie"
              value={amenities.isFurnished}
              onChange={(v) => setAmenities({ ...amenities, isFurnished: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
              <Text style={[styles.switchSubtitle, { marginTop: 0, marginBottom: 6 }]}>Ogrzewanie</Text>
              <View
                style={[
                  styles.heatingPickerWrap,
                  { borderColor, backgroundColor: isDark ? '#2C2C2E' : '#F6F6F8' },
                ]}
              >
                <Picker
                  selectedValue={heating}
                  onValueChange={(v) => {
                    Haptics.selectionAsync();
                    setHeating(String(v || ''));
                  }}
                  mode="dialog"
                  dropdownIconColor={txtColor}
                  style={{ color: txtColor }}
                >
                  {HEATING_OPTIONS.map((opt) => (
                    <Picker.Item key={opt || 'none'} label={opt || 'Nie podano'} value={opt} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {/* ====== WERYFIKACJA NIERUCHOMOŚCI — TARCZA BEZPIECZEŃSTWA ====== */}
          <Text style={styles.sectionTitle}>TARCZA BEZPIECZEŃSTWA</Text>

          {/* Karta wyjaśniająca — co zyskujesz */}
          <View
            style={[
              styles.shieldExplainCard,
              {
                backgroundColor: isDark
                  ? isLandRegistryValid ? 'rgba(52,199,89,0.08)' : 'rgba(255,255,255,0.03)'
                  : isLandRegistryValid ? 'rgba(52,199,89,0.06)' : 'rgba(0,0,0,0.02)',
                borderColor: isLandRegistryValid
                  ? 'rgba(52,199,89,0.55)'
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
            {/* Header: ikona + status */}
            <View style={styles.shieldHeaderRow}>
              <View
                style={[
                  styles.shieldIconCircle,
                  {
                    backgroundColor: isLandRegistryValid
                      ? 'rgba(52,199,89,0.15)'
                      : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                    borderColor: isLandRegistryValid ? 'rgba(52,199,89,0.6)' : 'transparent',
                    shadowColor: isLandRegistryValid ? '#34C759' : 'transparent',
                    shadowOpacity: isLandRegistryValid ? 0.45 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: isLandRegistryValid ? 4 : 0,
                  },
                ]}
              >
                <Ionicons
                  name={isLandRegistryValid ? 'shield-checkmark' : 'shield-outline'}
                  size={28}
                  color={isLandRegistryValid ? '#34C759' : subColor}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.shieldBadgeRow}>
                  <View
                    style={[
                      styles.shieldBadge,
                      {
                        backgroundColor: isLandRegistryValid
                          ? 'rgba(52,199,89,0.18)'
                          : isDark ? 'rgba(142,142,147,0.18)' : 'rgba(142,142,147,0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.shieldBadgeText,
                        { color: isLandRegistryValid ? '#34C759' : subColor },
                      ]}
                    >
                      {isLandRegistryValid ? '✓  ZWERYFIKOWANA' : 'NIEZWERYFIKOWANA'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.shieldTitle, { color: txtColor }]}>
                  {isLandRegistryValid
                    ? 'Nieruchomość zweryfikowana'
                    : 'Dodaj numer KW — zwiększ zaufanie'}
                </Text>
                <Text style={[styles.shieldSub, { color: subColor }]}>
                  {isLandRegistryValid
                    ? 'Twoja oferta wyświetla zielony znaczek dla kupujących.'
                    : 'Nieruchomości z weryfikacją KW wzbudzają o 3× więcej zainteresowania.'}
                </Text>
              </View>
            </View>

            {/* Lista korzyści */}
            <View style={[styles.shieldBenefits, { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
              {[
                { icon: 'checkmark-circle', text: 'Brak hipotek i obciążeń — potwierdzamy to my' },
                { icon: 'checkmark-circle', text: 'Czysta księga wieczysta, status na bieżąco' },
                { icon: 'checkmark-circle', text: 'Zielony badge „Bezpieczna nieruchomość" na karcie oferty' },
                { icon: 'lock-closed', text: 'Numer KW chroniony — używamy go wyłącznie do weryfikacji, nigdy nie pokazujemy go publicznie' },
              ].map((item, i) => (
                <View key={i} style={styles.shieldBenefitRow}>
                  <Ionicons
                    name={item.icon as any}
                    size={14}
                    color={isLandRegistryValid ? '#34C759' : subColor}
                  />
                  <Text style={[styles.shieldBenefitText, { color: subColor }]}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Formularz danych */}
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow, marginTop: 8 }]}>
            {/* Numer mieszkania */}
            <View style={styles.inputRowPremium}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Nr mieszkania</Text>
                <Text style={{ fontSize: 11, color: subColor, marginTop: 1 }}>Opcjonalnie</Text>
              </View>
              <TextInput
                style={[styles.inputRightPremium, { color: txtColor, maxWidth: 120 }]}
                value={apartmentNumber}
                onChangeText={setApartmentNumber}
                placeholder="np. 14B"
                placeholderTextColor={subColor}
                autoCapitalize="characters"
              />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* Numer KW z formatowaniem i walidacją */}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
              <View style={styles.kwLabelRow}>
                <View style={styles.kwLockBadge}>
                  <Ionicons name="lock-closed" size={10} color="#34C759" />
                  <Text style={styles.kwLockText}>SZYFROWANE</Text>
                </View>
                <Text style={[styles.inputLabelPremium, { color: txtColor, flex: 1, marginLeft: 8 }]}>
                  Numer Księgi Wieczystej
                </Text>
              </View>
              <Text style={[styles.kwFormatHint, { color: subColor }]}>
                Format: <Text style={{ fontWeight: '800', color: txtColor, letterSpacing: 1 }}>XXXX / XXXXXXXX / X</Text>
                {'  '}np. <Text style={{ fontWeight: '700' }}>WA4N/00012345/6</Text>
              </Text>
              <TextInput
                style={[
                  styles.kwInput,
                  {
                    color: txtColor,
                    borderColor: landRegistryRaw
                      ? isLandRegistryValid
                        ? '#34C759'
                        : '#FF3B30'
                      : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                    backgroundColor: isDark ? '#2C2C2E' : '#F6F6F8',
                  },
                ]}
                value={landRegistryNumber}
                onChangeText={(t) => setLandRegistryNumber(normalizeLandRegistryNumber(t))}
                onFocus={() => {
                  setTimeout(() => mainScrollRef.current?.scrollToEnd({ animated: true }), 320);
                }}
                placeholder="WA4N/00012345/6"
                placeholderTextColor={subColor}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {/* Sugestie prefiksu */}
              {landRegistrySuggestions.length > 0 && !isLandRegistryValid ? (
                <View
                  style={[
                    styles.suggestionsWrap,
                    { borderColor, backgroundColor: isDark ? '#111214' : '#F8FAFC', marginHorizontal: 0, marginTop: 8 },
                  ]}
                >
                  {landRegistrySuggestions.map((item) => (
                    <Pressable
                      key={item.prefix}
                      style={styles.suggestionRow}
                      onPress={() =>
                        setLandRegistryNumber(applyLandRegistryPrefix(landRegistryNumber, item.prefix))
                      }
                    >
                      <Text style={[styles.suggestionPrefix, { color: txtColor }]}>{item.prefix}</Text>
                      <Text style={[styles.suggestionCourt, { color: subColor }]} numberOfLines={1}>
                        {item.courtName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {/* Status walidacji */}
              {landRegistryRaw ? (
                <View style={styles.kwValidRow}>
                  <Ionicons
                    name={isLandRegistryValid ? 'checkmark-circle' : 'alert-circle'}
                    size={14}
                    color={isLandRegistryValid ? '#34C759' : '#FF3B30'}
                  />
                  <Text style={[styles.kwValidText, { color: isLandRegistryValid ? '#34C759' : '#FF3B30' }]}>
                    {isLandRegistryValid
                      ? `Format poprawny${selectedCourt ? ` · ${selectedCourt.courtName}` : ''}`
                      : 'Nieprawidłowy format. Wzór: WA4N/00012345/6'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ====== LOKALIZACJA — Z ŻYWYM PODGLĄDEM ====== */}
          <Text style={styles.sectionTitle}>MAPA I WIDOCZNOŚĆ</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <View style={[styles.switchRow, { alignItems: 'flex-start' }]}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Dokładna lokalizacja</Text>
                <Text style={styles.switchSubtitle}>
                  Włączone: na publicznej karcie oferty widać <Text style={{ fontWeight: '700' }}>ulicę i numer</Text> + dokładny pin.
                  {'\n'}Wyłączone: widzimy <Text style={{ fontWeight: '700' }}>tylko nazwę ulicy</Text> (bez numeru) + przybliżony obszar.
                </Text>
              </View>
              <Switch
                value={isExactLocation}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  enqueueLayoutSpring();
                  setIsExactLocation(v);
                }}
                trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <LocationPreview
              isExactLocation={isExactLocation}
              isDark={isDark}
              txtColor={txtColor}
              city={originalData?.city}
              district={originalData?.district}
              street={originalData?.street || originalData?.addressStreet}
            />
          </View>
          <Text style={styles.sectionFooter}>
            To ustawienie wpływa wyłącznie na publiczną kartę oferty. W panelu zarządzania zawsze widzisz pełen
            adres i precyzyjny pin — kupujący tylko to, co masz powyżej.
          </Text>

          {/* Bufor pod sticky save */}
          <View style={{ height: 110 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ====== STICKY SAVE BAR ====== */}
      <View
        style={[
          styles.stickyBar,
          { backgroundColor: isDark ? 'rgba(20,20,22,0.85)' : 'rgba(255,255,255,0.92)' },
        ]}
        pointerEvents="box-none"
      >
        <BlurView intensity={isDark ? 50 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable
          onPress={handleSave}
          disabled={saving || !isDirty}
          style={({ pressed }) => [
            styles.stickyBtn,
            {
              backgroundColor: !isDirty ? (isDark ? '#2C2C2E' : '#E5E5EA') : primaryColor,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons
                name={isDirty ? 'checkmark-circle' : 'checkmark-done'}
                size={18}
                color={!isDirty ? subColor : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.stickyBtnText,
                  { color: !isDirty ? subColor : '#FFFFFF' },
                ]}
              >
                {!isDirty
                  ? 'Wszystko zapisane'
                  : `Zapisz zmiany${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ============================================================================
   AMENITY ROW — uniformowa „Apple settings" linia z ikoną w kafelku i Switchem
   ============================================================================ */
function AmenityRow({
  icon,
  tint,
  label,
  value,
  onChange,
  txtColor,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  borderColor?: string;
  txtColor: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={[styles.amenityIconWrap, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={[styles.amenityLabel, { color: txtColor }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onChange(v);
        }}
        trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }}
      />
    </View>
  );
}

/* ============================================================================
   LOCATION PREVIEW — pokazuje DOKŁADNIE jak adres wygląda na publicznej karcie
   oferty w obu trybach. Dwa rzędy:
     1) „Tak widzą kupujący" — mini-karta z prawdziwą linią adresu wg trybu
        (`formatPublicAddress`). Animowane przejście wartości.
     2) Mapa-mock z pinem precyzyjnym (ON) lub okręgiem ~500 m (OFF).
   ============================================================================ */
function LocationPreview({
  isExactLocation,
  isDark,
  txtColor,
  city,
  district,
  street,
}: {
  isExactLocation: boolean;
  isDark: boolean;
  txtColor: string;
  city?: string;
  district?: string;
  street?: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  // Animujemy fade na samym TEKŚCIE adresu, żeby zmiana była natychmiast czytelna.
  const addressFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: easeOut, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [pulse]);
  useEffect(() => {
    addressFade.setValue(0.35);
    Animated.timing(addressFade, {
      toValue: 1,
      duration: 260,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [isExactLocation, addressFade]);

  const cityRaw = String(city || '').trim();
  const districtRaw = String(district || '').trim();
  const streetRaw = String(street || '').trim();
  const hasStreet = streetRaw.length > 0;
  const previewLine = formatPublicAddress(cityRaw, districtRaw, streetRaw, isExactLocation, 'Polska');
  const visibleStreet = hasStreet ? (isExactLocation ? streetRaw : stripHouseNumber(streetRaw)) : '';

  const surfaceColor = isDark ? '#2C2C2E' : '#EEF1F5';
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 10 }}>
      {/* ===== 1) PODGLĄD LINII ADRESU ===== */}
      <View
        style={[
          styles.locAddressPreview,
          {
            backgroundColor: isDark ? '#101012' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <View style={styles.locAddressHeader}>
          <View
            style={[
              styles.locAddressBadge,
              {
                backgroundColor: isExactLocation ? 'rgba(0,122,255,0.12)' : 'rgba(52,199,89,0.14)',
                borderColor: isExactLocation ? 'rgba(0,122,255,0.4)' : 'rgba(52,199,89,0.5)',
              },
            ]}
          >
            <Ionicons
              name={isExactLocation ? 'eye' : 'eye-off'}
              size={10}
              color={isExactLocation ? '#007AFF' : '#34C759'}
            />
            <Text
              style={[
                styles.locAddressBadgeText,
                { color: isExactLocation ? '#007AFF' : '#34C759' },
              ]}
            >
              {isExactLocation ? 'PEŁNY ADRES' : 'TYLKO ULICA'}
            </Text>
          </View>
          <Text style={styles.locAddressEyebrow}>TAK WIDZĄ KUPUJĄCY</Text>
        </View>

        <Animated.View style={{ opacity: addressFade }}>
          <Text style={[styles.locAddressLine, { color: txtColor }]} numberOfLines={2}>
            <Ionicons name="location-sharp" size={14} color="#8E8E93" />
            {'  '}
            {previewLine}
          </Text>
          {hasStreet ? (
            isExactLocation ? (
              <Text style={styles.locAddressHint}>
                Numer „{(streetRaw.match(/\d+[A-Za-z]?(?:[\/\-]\d+[A-Za-z]?)?\s*$/u) || [''])[0].trim() || '—'}”
                jest widoczny w ogłoszeniu.
              </Text>
            ) : (
              <Text style={styles.locAddressHint}>
                Numer budynku <Text style={{ fontWeight: '700', color: '#FF9500' }}>ukryty</Text>. Widoczna tylko
                nazwa ulicy „{visibleStreet || streetRaw}”.
              </Text>
            )
          ) : (
            <Text style={styles.locAddressHint}>
              Ta oferta nie ma jeszcze ulicy w bazie — kupujący widzi tylko miasto i dzielnicę.
            </Text>
          )}
        </Animated.View>
      </View>

      {/* ===== 2) PODGLĄD MAPY ===== */}
      <View style={[styles.locPreviewWrap, { backgroundColor: surfaceColor }]}>
        <View style={styles.locGridOverlay} pointerEvents="none">
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={`h-${i}`}
              style={[
                styles.locGridLine,
                { top: `${(i + 1) * 14}%`, width: '100%', height: StyleSheet.hairlineWidth },
              ]}
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={`v-${i}`}
              style={[
                styles.locGridLine,
                { left: `${(i + 1) * 14}%`, height: '100%', width: StyleSheet.hairlineWidth },
              ]}
            />
          ))}
        </View>

        <View style={styles.locCenterMark}>
          {isExactLocation ? (
            <>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(0,122,255,0.25)',
                  transform: [
                    {
                      scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }),
                    },
                  ],
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                }}
              />
              <View style={styles.locExactPin}>
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </View>
            </>
          ) : (
            <>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  borderWidth: 1.5,
                  borderColor: 'rgba(52, 199, 89, 0.45)',
                  backgroundColor: 'rgba(52, 199, 89, 0.10)',
                  transform: [
                    { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) },
                  ],
                }}
              />
              <View style={[styles.locExactPin, { backgroundColor: 'rgba(52,199,89,0.85)' }]}>
                <Ionicons name="navigate-circle" size={18} color="#FFFFFF" />
              </View>
            </>
          )}
        </View>

        <View style={styles.locLegend}>
          <Text style={[styles.locLegendTitle, { color: txtColor }]}>
            {isExactLocation ? 'Pin precyzyjny' : 'Obszar ~250 m'}
          </Text>
          <Text style={styles.locLegendSub}>
            {isExactLocation
              ? 'Pinezka pokazuje dokładny budynek.'
              : 'Zielony krąg ukrywa budynek — a środek tarczy jest celowo przesunięty, więc nie pokazuje też położenia domu.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ========================================================================== */
const styles = StyleSheet.create({
  container: { flex: 1 },

  headerGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11, fontWeight: '600', color: '#FF9500', marginTop: 2, letterSpacing: 0.2 },
  headerBtnText: { fontSize: 16, letterSpacing: -0.3 },

  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 110 : 90,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  /* ===== HERO ===== */
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    marginBottom: 10,
    shadowColor: '#007AFF',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroIconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroSparkle: { position: 'absolute', top: -2, right: -2 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#007AFF',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  heroTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  heroSubtitle: { fontSize: 12.5, lineHeight: 17 },

  /* ===== DIRTY PILL ===== */
  dirtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,149,0,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,149,0,0.45)',
    marginBottom: 6,
  },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9500' },
  dirtyText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#FF9500' },
  dirtyResetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,149,0,0.18)',
  },
  dirtyResetText: { fontSize: 11.5, fontWeight: '800', color: '#FF9500', letterSpacing: 0.4 },

  /* ===== GALLERY HINT ===== */
  galleryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.30)',
  },
  galleryHintText: { flex: 1, fontSize: 12, color: '#10B981', fontWeight: '600', lineHeight: 16 },

  /* ===== SECTION HEADERS ===== */
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 18,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 4,
    marginBottom: 6,
    marginTop: 22,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  sectionFooter: { fontSize: 12, color: '#8E8E93', marginLeft: 4, marginTop: 6, lineHeight: 17 },
  premiumGroup: {
    borderRadius: 14,
    overflow: 'visible',
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderLeftColor: 'rgba(255,255,255,0.05)',
    borderRightColor: 'rgba(127,127,127,0.08)',
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },

  /* ===== COMMISSION (PROWIZJA AGENTA) — wzór z `AddOffer/Step4_Finance` ===== */
  commissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  commissionHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  commissionHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  commissionClearBtn: {
    padding: 2,
  },
  commissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 10,
    marginHorizontal: 14,
  },
  commissionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginHorizontal: 14,
  },
  commissionCtaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  commissionAddCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  commissionAddCtaText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  commissionCard: {
    marginTop: 14,
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  commissionRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  commissionInputCol: {
    flex: 1.1,
    minWidth: 0,
  },
  commissionAmountCol: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  commissionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  commissionInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  commissionInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    padding: 0,
  },
  commissionInputSuffix: {
    fontSize: 18,
    fontWeight: '800',
  },
  commissionStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  commissionStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commissionStepHint: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  commissionAmountValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  commissionAmountHint: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 14,
  },
  commissionWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,59,48,0.10)',
  },
  commissionWarnText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },

  /* ===== IMAGES ===== */
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addImageBtn: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.4)',
  },
  addImageText: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  imageWrapper: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  imageThumbnail: { width: '100%', height: '100%' },
  deleteImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainPhotoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  mainPhotoText: {
    color: '#FFD60A',
    fontSize: 8.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageActionsBar: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  imageActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageActionBtnDisabled: { opacity: 0.4 },

  /* ===== INPUTS ===== */
  fieldCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
    borderTopColor: 'rgba(255,255,255,0.16)',
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  fieldIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTitle: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.25 },
  fieldHint: { fontSize: 12, lineHeight: 16, marginTop: 2, fontWeight: '500' },
  titleInputPremium: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    letterSpacing: -0.35,
  },
  inputPremium: {
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
    letterSpacing: -0.3,
  },
  textAreaPremium: {
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    textAlignVertical: 'top',
    letterSpacing: -0.3,
    lineHeight: 23,
  },
  inputRowPremium: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  inputLabelPremium: { fontSize: 16, width: 150, fontWeight: '500', letterSpacing: -0.3 },
  inputRightPremium: { flex: 1, fontSize: 17, textAlign: 'right', letterSpacing: -0.3 },
  inputSuffix: { fontSize: 15, color: '#8E8E93', marginLeft: 6, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },

  /* ===== SEGMENT ===== */
  segmentContainer: {
    flexDirection: 'row',
    padding: 3,
    margin: 12,
    backgroundColor: 'rgba(150,150,150,0.16)',
    borderRadius: 10,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
  segmentText: { fontSize: 13, color: '#8E8E93', fontWeight: '600', letterSpacing: -0.2 },

  /* ===== SWITCH ROWS ===== */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  amenityIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityLabel: { flex: 1, fontSize: 16, fontWeight: '500', letterSpacing: -0.3 },
  switchTextGroup: { flex: 1, paddingRight: 12 },
  switchTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  switchSubtitle: { fontSize: 12.5, color: '#8E8E93', marginTop: 4, lineHeight: 17 },

  heatingPickerWrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },

  /* ===== STEPPER INLINE (pokoje, piętro) ===== */
  stepperInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueInput: {
    width: 54,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },

  /* ===== CENA ===== */
  priceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  priceLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase', marginBottom: 4 },
  priceFormatted: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  priceCurrency: { fontSize: 16, fontWeight: '600' },
  priceSqm: { fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.1 },
  priceInput: {
    fontSize: 22,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 130,
    letterSpacing: -0.4,
  },
  priceStepperRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexWrap: 'wrap',
  },
  priceStepBtn: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  priceStepTxt: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },

  /* ===== SHIELD / TARCZA BEZPIECZEŃSTWA ===== */
  shieldExplainCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 0,
  },
  shieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  shieldIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shieldBadgeRow: { flexDirection: 'row', marginBottom: 6 },
  shieldBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  shieldBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  shieldTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  shieldSub: { fontSize: 12.5, lineHeight: 17 },
  shieldBenefits: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  shieldBenefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  shieldBenefitText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },

  /* ===== KW INPUT ===== */
  kwLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  kwLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.4)',
  },
  kwLockText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34C759',
    letterSpacing: 0.7,
  },
  kwFormatHint: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  kwInput: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontVariant: ['tabular-nums'],
  },
  kwValidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  kwValidText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  /* ===== LEGACY KW (zachowane dla suggestii) ===== */
  suggestionsWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  suggestionPrefix: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  suggestionCourt: { marginTop: 2, fontSize: 12, fontWeight: '500' },
  landRegistryCourt: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    fontSize: 12,
    fontWeight: '600',
  },

  /* ===== LOCATION PREVIEW ===== */
  locAddressPreview: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  locAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  locAddressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locAddressBadgeText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  locAddressEyebrow: { fontSize: 9, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.7 },
  locAddressLine: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, lineHeight: 20 },
  locAddressHint: { fontSize: 11.5, color: '#8E8E93', marginTop: 6, lineHeight: 16 },
  locPreviewWrap: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  locGridOverlay: { ...StyleSheet.absoluteFillObject },
  locGridLine: { position: 'absolute', backgroundColor: 'rgba(127,127,127,0.18)' },
  locCenterMark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locExactPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  locLegend: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    right: 12,
  },
  locLegendTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  locLegendSub: { fontSize: 11, color: '#8E8E93', lineHeight: 14, marginTop: 2 },

  /* ===== STICKY SAVE BAR ===== */
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.25)',
  },
  stickyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#007AFF',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  stickyBtnText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});
