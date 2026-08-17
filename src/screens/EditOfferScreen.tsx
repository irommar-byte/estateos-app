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
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import RoomScanModal, { isRoomScanSupportedOnDevice } from '../components/roomScan/RoomScanModal';
import type { RoomScanDraftAssets } from '../types/roomScan';
import { normalizeStoredScanMeta } from '../lib/roomScan/parseRoomPlanJson';
import AddOfferWheelPickerColumn from './AddOffer/AddOfferWheelPickerColumn';
import type { AddOfferOption } from './AddOffer/AddOfferOptionField';
import MagicalAiDescribeButton from '../components/MagicalAiDescribeButton';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import CurrencySegmentControl from '../components/CurrencySegmentControl';
import { buildOfferPricePayload } from '../money/offerPrice';
import { getEurPlnRate } from '../money/fxRateService';
import { convertBetweenCurrencies, normalizeListingCurrency } from '../money/convert';
import { formatAmountWithCurrency, formatApproxLine } from '../money/format';
import {
  adminFeeInputFromPln,
  adminFeePlnFromInput,
  convertAdminFeeInput,
  parseAdminFeePln,
} from '../money/adminFee';
import type { ListingCurrency } from '../money/types';
import {
  applyLandRegistryPrefix,
  getCourtByLandRegistryPrefix,
  getLandRegistryPrefixSuggestions,
  isValidLandRegistryNumber,
  normalizeLandRegistryNumber,
} from '../utils/landRegistry';
import {
  formatPublicAddress,
  getDraftLocationPresentation,
  isPolandLocationDraft,
  resolveIsExactLocation,
  stripHouseNumber,
} from '../constants/locationEcosystem';
import {
  AGENT_COMMISSION_DEFAULT_PERCENT,
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
  commissionAmountInputToPercent,
  previewAmountFromPercentDraft,
  previewPercentFromAmountDraft,
  resolveAgentCommissionPercentForSave,
  shouldWarnCommissionPercentDraft,
  roundToQuarter,
  type AgentCommissionInputMode,
  validateAgentCommissionPercent,
} from '../lib/agentCommission';
import { API_URL } from '../config/network';
import { localeToDateFormat, useI18n } from '../i18n';
import {
  extractMobileOfferJson,
  persistMobileOfferUpdate,
  readMobileOfferResponseBody,
  isExplicitMobileOfferSaveFailure,
} from '../utils/mobileOfferUpdate';
import { normalizeOfferConditionForEdit } from '../utils/offerFieldLabels';
import { formatOfferDescriptionForDisplay } from '../utils/offerDescriptionDisplay';
import EditOfferLocationEditor, { type EditOfferLocationState } from './EditOffer/EditOfferLocationEditor';
import { generateListingDescriptionWithGpt } from '../services/offerDescriptionAiService';

const { width } = Dimensions.get('window');
const MAX_IMAGES = 15;
const EDIT_GALLERY_COLUMNS = 3;
const EDIT_GALLERY_GAP = 8;
const HEATING_OPTIONS = [
  { key: '', labelKey: 'offer.shared.heating.none' },
  { key: 'Miejskie', labelKey: 'offer.shared.heating.district' },
  { key: 'Gazowe', labelKey: 'offer.shared.heating.gas' },
  { key: 'Elektryczne', labelKey: 'offer.shared.heating.electric' },
  { key: 'Pompa Ciepła', labelKey: 'offer.shared.heating.heatPump' },
  { key: 'Węglowe/Pellet', labelKey: 'offer.shared.heating.coalPellet' },
  { key: 'Inne', labelKey: 'offer.shared.heating.other' },
] as const;

/** Wyciąga ukryte tokeny weryfikacyjne `<!-- ESTATEOS_VERIFY:... -->` z opisu.
 *  Są one wstawiane przez system i NIE powinny być widoczne właścicielowi w edytorze.
 *  Przy zapisie dołączamy je z powrotem, żeby nie utracić danych weryfikacji. */
function extractVerifyTokens(desc: string): { clean: string; tokens: string[] } {
  const tokens: string[] = [];
  const clean = desc
    .replace(/<!--\s*ESTATEOS_VERIFY:[^>]*-->/gi, (m) => { tokens.push(m); return ''; })
    .replace(/<!--\s*estateos-otodom:\d+\s*-->/gi, '')
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

const editableImageKey = (img: EditableImage) => img.serverPath || img.uri;

const getEditGalleryPosition = (index: number, tileSize: number) => ({
  x: (index % EDIT_GALLERY_COLUMNS) * (tileSize + EDIT_GALLERY_GAP),
  y: Math.floor(index / EDIT_GALLERY_COLUMNS) * (tileSize + EDIT_GALLERY_GAP),
});

function DraggableEditSquare({
  img,
  index,
  total,
  tileSize,
  coverLabel,
  onDragStart,
  onDragEnd,
  onHoverSwap,
  onRemove,
  onMarkAsPlan,
}: {
  img: EditableImage;
  index: number;
  total: number;
  tileSize: number;
  coverLabel: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onHoverSwap: (key: string, targetIndex: number) => void;
  onRemove: (index: number) => void;
  onMarkAsPlan?: (index: number) => void;
}) {
  const pos = useRef(new Animated.ValueXY(getEditGalleryPosition(index, tileSize))).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isActive, setIsActive] = useState(false);
  const isDragging = useRef(false);
  const initialIndex = useRef(index);
  const lastHoveredIndex = useRef(index);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onHoverSwapRef = useRef(onHoverSwap);
  const indexRef = useRef(index);
  const totalRef = useRef(total);
  const keyRef = useRef(editableImageKey(img));
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;
  onHoverSwapRef.current = onHoverSwap;
  indexRef.current = index;
  totalRef.current = total;
  keyRef.current = editableImageKey(img);

  useEffect(() => {
    if (!isDragging.current) {
      Animated.spring(pos, {
        toValue: getEditGalleryPosition(index, tileSize),
        useNativeDriver: true,
        friction: 9,
        tension: 68,
      }).start();
    }
  }, [index, pos, tileSize]);

  const finishDrag = useCallback(() => {
    setIsActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(pos, {
        toValue: getEditGalleryPosition(indexRef.current, tileSize),
        useNativeDriver: true,
        friction: 9,
        tension: 85,
      }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start(() => {
      onDragEndRef.current();
    });
    isDragging.current = false;
  }, [pos, scaleAnim, tileSize]);

  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          isDragging.current = true;
          setIsActive(true);
          initialIndex.current = indexRef.current;
          lastHoveredIndex.current = indexRef.current;
          onDragStartRef.current();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.spring(scaleAnim, { toValue: 1.08, friction: 6, useNativeDriver: true }).start();
        },
        onPanResponderMove: (_e, gestureState) => {
          const startPos = getEditGalleryPosition(initialIndex.current, tileSize);
          const currentX = startPos.x + gestureState.dx;
          const currentY = startPos.y + gestureState.dy;
          pos.setValue({ x: currentX, y: currentY });

          const cellStride = tileSize + EDIT_GALLERY_GAP;
          const centerX = currentX + tileSize / 2;
          const centerY = currentY + tileSize / 2;
          const n = totalRef.current;
          const targetCol = Math.max(0, Math.min(EDIT_GALLERY_COLUMNS - 1, Math.floor(centerX / cellStride)));
          const rowCount = Math.max(1, Math.ceil(n / EDIT_GALLERY_COLUMNS));
          const maxRow = Math.max(0, rowCount - 1);
          const targetRow = Math.max(0, Math.min(maxRow, Math.floor(centerY / cellStride)));
          let targetIndex = targetRow * EDIT_GALLERY_COLUMNS + targetCol;
          targetIndex = Math.min(Math.max(0, targetIndex), Math.max(0, n - 1));

          if (targetIndex !== lastHoveredIndex.current) {
            lastHoveredIndex.current = targetIndex;
            Haptics.selectionAsync();
            onHoverSwapRef.current(keyRef.current, targetIndex);
          }
        },
        onPanResponderRelease: () => finishDragRef.current(),
        onPanResponderTerminate: () => finishDragRef.current(),
      }),
    [pos, scaleAnim, tileSize],
  );

  const stackOrder = isActive ? 1000 : 10 + index;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.dragTile,
        {
          width: tileSize,
          height: tileSize,
          transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: scaleAnim }],
          zIndex: stackOrder,
          shadowColor: isActive ? '#10B981' : '#000',
          shadowOpacity: isActive ? 0.45 : 0,
          shadowOffset: isActive ? { width: 0, height: 8 } : { width: 0, height: 0 },
          shadowRadius: isActive ? 12 : 0,
          elevation: isActive ? 24 : Math.min(2 + index, 20),
        },
      ]}
    >
      <Image source={{ uri: img.uri }} style={styles.imageThumbnail} contentFit="cover" transition={200} />
      <View style={[styles.matrixOverlay, { opacity: isActive ? 0.35 : 1 }]}>
        <View style={styles.dotMatrix}>
          {[...Array(9)].map((_, i) => (
            <View key={i} style={styles.matrixDot} />
          ))}
        </View>
      </View>
      {index === 0 ? (
        <View style={styles.mainPhotoBadge}>
          <Ionicons name="star" size={9} color="#FFD60A" />
          <Text style={styles.mainPhotoText}>{coverLabel}</Text>
        </View>
      ) : null}
      <Pressable style={styles.deleteImageBtn} onPress={() => onRemove(index)} hitSlop={8}>
        <Ionicons name="close" size={14} color="#FFF" />
      </Pressable>
      {onMarkAsPlan ? (
        <Pressable
          style={styles.planImageBtn}
          onPress={() => onMarkAsPlan(index)}
          hitSlop={8}
        >
          <Text style={styles.planImageText}>Plan</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const isTrue = (val: any) => val === true || val === 'true' || val === 1;

const easeOut = Easing.out(Easing.cubic);

const normalizeTextForDirty = (value: unknown) => String(value ?? '').trim();
const normalizeNumberForDirty = (value: unknown) => {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (raw === '') return '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? String(parsed) : raw;
};
const normalizeImageKeyForDirty = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(API_URL, '')
    .replace(/^https?:\/\/[^/]+/i, '');

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
  const { t, locale } = useI18n();
  const dateLocale = localeToDateFormat(locale);
  const translateDirtyField = useCallback((key: string) => t(`offer.edit.dirtyFields.${key}`), [t]);

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
  const [floorPlanPreview, setFloorPlanPreview] = useState<string | null>(null);
  const [floorPlanLocalUri, setFloorPlanLocalUri] = useState<string | null>(null);
  const [floorPlan3dLocalUri, setFloorPlan3dLocalUri] = useState<string | null>(null);
  const [floorPlanScanMetaLocal, setFloorPlanScanMetaLocal] = useState<string | null>(null);
  const [floorPlanCleared, setFloorPlanCleared] = useState(false);
  const [extraFloorPlanUrls, setExtraFloorPlanUrls] = useState<string[]>([]);
  /** Ręczny rzut zastępuje skan LiDAR — przy zapisie czyścimy model 3D i meta na serwerze. */
  const [dropServerFloorPlan3d, setDropServerFloorPlan3d] = useState(false);
  const [originalFloorPlanKey, setOriginalFloorPlanKey] = useState<string | null>(null);
  const [originalFloorPlan3dKey, setOriginalFloorPlan3dKey] = useState<string | null>(null);
  const [originalFloorPlanScanMeta, setOriginalFloorPlanScanMeta] = useState<string | null>(null);
  const [roomScanOpen, setRoomScanOpen] = useState(false);
  const roomScanAvailable = isRoomScanSupportedOnDevice();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [plotArea, setPlotArea] = useState('');
  const [rooms, setRooms] = useState('');
  const [floor, setFloor] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [heating, setHeating] = useState('');
  const [verifyTokens, setVerifyTokens] = useState<string[]>([]);
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [landRegistryNumber, setLandRegistryNumber] = useState('');
  const [price, setPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<ListingCurrency>('PLN');
  const [editFxRate, setEditFxRate] = useState(4.32);
  const [editFxDate, setEditFxDate] = useState('');
  const [adminFee, setAdminFee] = useState('');
  /**
   * Procent prowizji agenta (string z TextInput — akceptuje `.` i `,`).
   * '' = brak (kupujący widzi ofertę bez pigułki prowizji).
   * '0' = świadome „BEZ PROWIZJI" (zielona pigułka u kupującego).
   * Inna wartość = standardowa prowizja w zakresie 0.5%–10%.
   */
  const [agentCommissionPercent, setAgentCommissionPercent] = useState<string>('');
  const [commissionInputMode, setCommissionInputMode] = useState<AgentCommissionInputMode>('percent');
  const [agentCommissionAmountDraft, setAgentCommissionAmountDraft] = useState<string>('');
  const [commissionPercentFocused, setCommissionPercentFocused] = useState(false);
  const [commissionAmountFocused, setCommissionAmountFocused] = useState(false);
  const [condition, setCondition] = useState<'READY' | 'DEVELOPER' | 'TO_RENOVATION'>('READY');
  const [isExactLocation, setIsExactLocation] = useState(true);
  const [locationState, setLocationState] = useState<EditOfferLocationState>({
    lat: 52.2297,
    lng: 21.0122,
    city: '',
    district: '',
    street: '',
  });
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [aiDetailsNotes, setAiDetailsNotes] = useState('');
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);
  const [dragSnapshot, setDragSnapshot] = useState<EditableImage[] | null>(null);
  const dragSnapshotRef = useRef<EditableImage[] | null>(null);
  const descGlowAnim = useRef(new Animated.Value(0)).current;
  const [amenities, setAmenities] = useState({
    hasBalcony: false,
    hasParking: false,
    hasStorage: false,
    hasElevator: false,
    hasGarden: false,
    isTwoLevel: false,
    isFurnished: false,
  });

  const showLandRegistryVerification = isPolandLocationDraft(originalData);
  const landRegistryRaw = landRegistryNumber.trim();
  const isLandRegistryValid = isValidLandRegistryNumber(landRegistryRaw);
  const landRegistrySuggestions = getLandRegistryPrefixSuggestions(landRegistryRaw);
  const selectedCourt = getCourtByLandRegistryPrefix(landRegistryRaw);

  const heatingOptions = useMemo<AddOfferOption[]>(
    () =>
      HEATING_OPTIONS.map((opt) => ({
        value: opt.key,
        label: t(opt.labelKey),
      })),
    [t],
  );

  // -------- HELPERY ŚCIEŻEK ZDJĘĆ --------
  const toAbsoluteImageUrl = (img: string) => (img.startsWith('/uploads') ? `${API_URL}${img}` : img);
  const toServerPath = (img: string) => (img.startsWith(`${API_URL}/uploads`) ? img.replace(API_URL, '') : img);
  const isLocalUri = (uri: string) =>
    !uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('/uploads');

  // -------- POBRANIE OFERTY --------
  const fetchOffer = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      let offer: any = null;

      const detailRes = await fetch(`${API_URL}/api/mobile/v1/offers/${offerId}`, { headers });
      if (detailRes.ok) {
        const detailJson = await detailRes.json().catch(() => ({}));
        offer = extractMobileOfferJson(detailJson);
      }

      if (!offer) {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${user?.id || ''}`, {
          headers,
        });
        const data = await res.json().catch(() => ({}));
        const offers = Array.isArray(data?.offers) ? data.offers : [];
        offer = offers.find((o: any) => Number(o?.id) === Number(offerId)) || null;
      }

        if (offer) {
          setOriginalData(offer);
          setTitle(offer.title || '');
          const { clean: cleanDesc, tokens } = extractVerifyTokens(offer.description || '');
          setDescription(formatOfferDescriptionForDisplay(cleanDesc));
          setVerifyTokens(tokens);
          setPrice(String(offer.priceAmount ?? offer.price ?? '') || '');
          const listingCur = normalizeListingCurrency(offer.priceCurrency ?? offer.price_currency);
          setPriceCurrency(listingCur);
          const fxSnap = await getEurPlnRate();
          setEditFxRate(fxSnap.rate);
          setEditFxDate(fxSnap.date || '');
          const feePln = parseAdminFeePln(offer.adminFee);
          const feeDisplay = adminFeeInputFromPln(feePln, listingCur, fxSnap.rate);
          setAdminFee(feeDisplay > 0 ? String(feeDisplay) : '');
          // Prowizja agenta — backend zwraca `agentCommissionPercent` (number | null).
          // 0 → '0' (świadome „BEZ PROWIZJI"), null/undefined → '' (brak).
          const cp = extractAgentCommissionPercent(offer);
          if (cp === null) {
            setAgentCommissionPercent('');
          } else if (cp === 0) {
            setAgentCommissionPercent('0');
          } else {
            setAgentCommissionPercent(String(cp).replace('.', ','));
            const amt = computeAgentCommissionAmount(offer.priceAmount ?? offer.price, cp);
            if (amt > 0) setAgentCommissionAmountDraft(String(amt));
          }
          setArea(offer.area?.toString() || '');
          const loadedPlotArea =
            offer.plotArea?.toString() ||
            (String(offer.propertyType || '').toUpperCase() === 'PLOT'
              ? offer.area?.toString() || ''
              : '');
          setPlotArea(loadedPlotArea);
          setRooms(offer.rooms?.toString() || '');
          setFloor(offer.floor?.toString() || '');
          setYearBuilt(offer.yearBuilt?.toString() || offer.buildYear?.toString() || '');
          setHeating(String(offer.heating || ''));
          setApartmentNumber(String(offer.apartmentNumber || ''));
          setLandRegistryNumber(String(offer.landRegistryNumber || ''));
          setCondition(normalizeOfferConditionForEdit(offer.condition) || 'READY');
          // Odczyt „Dokładnej lokalizacji" zunifikowany z resztą ekosystemu:
          // używamy `resolveIsExactLocation`, który traktuje wartości typu
          // `'false'`, `0`, `'0'`, `false` jako WYŁĄCZONE, a wszystko inne
          // (włącznie z `undefined`/brakiem pola) jako WŁĄCZONE — tak samo
          // jak `OfferDetail`, `Step6_Summary`, `LocationPreview`.
          // Dzięki temu, jeśli backend zwraca `false` w dowolnej formie,
          // przełącznik utrzyma stan po reopen.
          setIsExactLocation(resolveIsExactLocation(offer.isExactLocation));
          setLocationState({
            lat: Number(offer.lat) || 52.2297,
            lng: Number(offer.lng) || 21.0122,
            city: String(offer.city || '').trim(),
            district: String(offer.district || '').trim(),
            street: String(offer.street || offer.addressStreet || '').trim(),
          });

          let parsedImages: string[] = [];
          if (offer.images) {
            try {
             parsedImages = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
            } catch {
              parsedImages = [];
            }
            if (!Array.isArray(parsedImages)) parsedImages = [];
            const mapped = parsedImages.map((img: string) => ({
              uri: toAbsoluteImageUrl(img),
              isRemote: true,
              serverPath: toServerPath(img),
            }));
            setImages(mapped);
            setOriginalImageKeys(mapped.map((i: EditableImage) => i.serverPath || i.uri));
          }

          const floorPlanRaw = String(offer.floorPlanUrl || offer.floorPlan || '').trim();
          if (floorPlanRaw) {
            const serverPath = toServerPath(floorPlanRaw);
            setOriginalFloorPlanKey(serverPath);
            setFloorPlanPreview(toAbsoluteImageUrl(floorPlanRaw));
            setFloorPlanLocalUri(null);
            setFloorPlanCleared(false);
          } else {
            setOriginalFloorPlanKey(null);
            setFloorPlanPreview(null);
            setFloorPlanLocalUri(null);
          }
          const extraRaw = offer.floorPlanExtraUrls;
          const extras = Array.isArray(extraRaw)
            ? extraRaw
            : (() => {
                try {
                  const parsed = JSON.parse(String(extraRaw || ''));
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return String(extraRaw || '').split(',').map((v: string) => v.trim()).filter(Boolean);
                }
              })();
          setExtraFloorPlanUrls(extras.map((url: string) => toAbsoluteImageUrl(url)).filter(Boolean));

          const floorPlan3dRaw = String(offer.floorPlan3dUrl || '').trim();
          if (floorPlan3dRaw) {
            setOriginalFloorPlan3dKey(toServerPath(floorPlan3dRaw));
          } else {
            setOriginalFloorPlan3dKey(null);
          }
          setFloorPlan3dLocalUri(null);
          const scanMetaRaw = offer.floorPlanScanMeta ? String(offer.floorPlanScanMeta) : null;
          setOriginalFloorPlanScanMeta(scanMetaRaw);
          setFloorPlanScanMetaLocal(scanMetaRaw);
          setDropServerFloorPlan3d(false);

          setAmenities({
            hasBalcony: isTrue(offer.hasBalcony), 
            hasParking: isTrue(offer.hasParking), 
            hasStorage: isTrue(offer.hasStorage),
            hasElevator: isTrue(offer.hasElevator), 
            hasGarden: isTrue(offer.hasGarden), 
            isTwoLevel: isTrue(offer.isTwoLevel),
            isFurnished: isTrue(offer.isFurnished),
          });
      } else {
        Alert.alert(t('offer.edit.alerts.errorTitle'), t('offer.edit.alerts.loadNotFound'));
      }
    } catch (error) {
      Alert.alert(t('offer.edit.alerts.errorTitle'), t('offer.edit.alerts.loadFailed'));
    }
    setLoading(false);
  }, [offerId, token, user?.id]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  useEffect(() => {
    void getEurPlnRate().then((s) => {
      setEditFxRate(s.rate);
      setEditFxDate(s.date || '');
    });
  }, []);

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
  const { isDirty, dirtyCount, dirtyLabels, dirtySummary } = useMemo(() => {
    if (!originalData) return { isDirty: false, dirtyCount: 0, dirtyLabels: [] as string[], dirtySummary: '' };
    const diffs: string[] = [];
    const sameText = (a: any, b: any) => normalizeTextForDirty(a) === normalizeTextForDirty(b);
    const sameNumber = (a: any, b: any) => normalizeNumberForDirty(a) === normalizeNumberForDirty(b);
    const originalCleanDescription = formatOfferDescriptionForDisplay(
      extractVerifyTokens(originalData.description || '').clean,
    );
    if (!sameText(title, originalData.title)) diffs.push('title');
    if (!sameText(description, originalCleanDescription)) diffs.push('description');
    if (!sameNumber(price, originalData.priceAmount ?? originalData.price)) diffs.push('price');
    {
      const originalFeePln = parseAdminFeePln(originalData.adminFee);
      const currentFeePln = adminFeePlnFromInput(adminFee, priceCurrency, editFxRate) || 0;
      if (originalFeePln !== currentFeePln) diffs.push('adminFee');
    }
    // Prowizja — porównujemy SPARSOWANE liczby, żeby '2,5' vs '2.5' vs 2.5 dawały
    // ten sam diff (bez fałszywych „dirty"). null vs null = brak zmian.
    {
      const originalCp = extractAgentCommissionPercent(originalData);
      const currentCp = parseAgentCommissionPercent(agentCommissionPercent);
      const a = originalCp === null ? 'NULL' : String(roundToQuarter(originalCp));
      const b = currentCp === null ? 'NULL' : String(roundToQuarter(currentCp));
      if (a !== b) diffs.push('commission');
    }
    if (!sameNumber(area, originalData.area)) diffs.push('area');
    const originalPlotArea =
      originalData.plotArea ??
      (String(originalData.propertyType || '').toUpperCase() === 'PLOT' ? originalData.area : null);
    if (!sameNumber(plotArea, originalPlotArea)) diffs.push('plotArea');
    if (!sameNumber(rooms, originalData.rooms)) diffs.push('rooms');
    if (!sameNumber(floor, originalData.floor)) diffs.push('floor');
    if (!sameNumber(yearBuilt, originalData.yearBuilt ?? originalData.buildYear)) diffs.push('yearBuilt');
    if (!sameText(heating, originalData.heating)) diffs.push('heating');
    if (!sameText(apartmentNumber, originalData.apartmentNumber)) diffs.push('apartmentNumber');
    if (!sameText(landRegistryNumber, originalData.landRegistryNumber)) diffs.push('landRegistry');
    if (!sameText(condition, normalizeOfferConditionForEdit(originalData.condition) || 'READY')) {
      diffs.push('condition');
    }
    if (Boolean(isExactLocation) !== resolveIsExactLocation(originalData.isExactLocation)) diffs.push('location');
    if (!sameNumber(locationState.lat, originalData.lat)) diffs.push('location');
    if (!sameNumber(locationState.lng, originalData.lng)) diffs.push('location');
    if (!sameText(locationState.city, originalData.city)) diffs.push('location');
    if (!sameText(locationState.district, originalData.district)) diffs.push('location');
    if (!sameText(locationState.street, originalData.street || originalData.addressStreet)) diffs.push('location');
    (
      ['hasBalcony', 'hasParking', 'hasStorage', 'hasElevator', 'hasGarden', 'isTwoLevel', 'isFurnished'] as const
    ).forEach((k) => {
      if (Boolean((amenities as any)[k]) !== isTrue(originalData[k])) diffs.push(k);
    });
    const currentKeys = images.map((i) => normalizeImageKeyForDirty(i.serverPath || i.uri));
    const originalKeys = originalImageKeys.map(normalizeImageKeyForDirty);
    const sameImages =
      currentKeys.length === originalKeys.length &&
      currentKeys.every((k, i) => k === originalKeys[i]) &&
      images.every((i) => i.isRemote);
    if (!sameImages) diffs.push('images');
    if (floorPlanCleared && (originalFloorPlanKey || originalFloorPlan3dKey)) diffs.push('floorPlan');
    if (floorPlanLocalUri || floorPlan3dLocalUri) diffs.push('floorPlan');
    if (dropServerFloorPlan3d && (originalFloorPlan3dKey || originalFloorPlanScanMeta)) diffs.push('floorPlan');
    const dirtySummaryLabels = diffs.map((key) => translateDirtyField(key));
    const dirtySummary =
      dirtySummaryLabels.length <= 3
        ? dirtySummaryLabels.join(', ')
        : `${dirtySummaryLabels.slice(0, 3).join(', ')} +${dirtySummaryLabels.length - 3}`;
    return { isDirty: diffs.length > 0, dirtyCount: diffs.length, dirtyLabels: diffs, dirtySummary };
  }, [
    originalData,
    title,
    description,
    price,
    adminFee,
    priceCurrency,
    editFxRate,
    agentCommissionPercent,
    area,
    plotArea,
    rooms,
    floor,
    yearBuilt,
    heating,
    apartmentNumber,
    landRegistryNumber,
    condition,
    isExactLocation,
    locationState,
    amenities,
    images,
    floorPlanCleared,
    dropServerFloorPlan3d,
    floorPlanLocalUri,
    floorPlan3dLocalUri,
    originalFloorPlanScanMeta,
    originalFloorPlanKey,
    originalFloorPlan3dKey,
    translateDirtyField,
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
        t('offer.edit.alerts.unsavedTitle'),
        t('offer.edit.alerts.unsavedBody', { summary: dirtySummary || t('offer.edit.dirty.formFallback') }),
        [
          { text: t('offer.edit.alerts.stayEditing'), style: 'cancel' },
          {
            text: t('offer.edit.alerts.leaveWithoutSave'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsub;
  }, [navigation, isDirty, saving, dirtySummary]);

  // -------- ZARZĄDZANIE ZDJĘCIAMI --------
  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentCount = images.length;
    if (currentCount >= MAX_IMAGES) {
      Alert.alert(t('offer.edit.alerts.photoLimitTitle'), t('offer.edit.alerts.photoLimitMax', { max: MAX_IMAGES }));
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
        Alert.alert(t('offer.edit.alerts.photoLimitTitle'), t('offer.edit.alerts.photoLimitPartial', { count: slotsLeft, max: MAX_IMAGES }));
      }
    }
  };

  const pickFloorPlan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.88,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setFloorPlanLocalUri(result.assets[0].uri);
      setFloorPlanPreview(result.assets[0].uri);
      setFloorPlan3dLocalUri(null);
      setFloorPlanScanMetaLocal(null);
      setDropServerFloorPlan3d(Boolean(originalFloorPlan3dKey || originalFloorPlanScanMeta));
      setFloorPlanCleared(false);
    }
  };

  const handleRoomScanComplete = (assets: RoomScanDraftAssets) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFloorPlanLocalUri(assets.floorPlanPngUri);
    setFloorPlanPreview(assets.floorPlanPngUri);
    setFloorPlan3dLocalUri(assets.floorPlan3dUri);
    setFloorPlanScanMetaLocal(JSON.stringify(assets.scanMeta));
    setDropServerFloorPlan3d(false);
    setFloorPlanCleared(false);
    setRoomScanOpen(false);
  };

  const removeFloorPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFloorPlanPreview(null);
    setFloorPlanLocalUri(null);
    setFloorPlan3dLocalUri(null);
    setFloorPlanScanMetaLocal(null);
    setDropServerFloorPlan3d(false);
    setFloorPlanCleared(true);
  };

  const removeImage = (indexToRemove: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    enqueueLayoutSpring();
    const source = dragSnapshot ?? images;
    const next = source.filter((_, index) => index !== indexToRemove);
    setDragSnapshot(null);
    dragSnapshotRef.current = null;
    setImages(next);
  };

  const markImageAsPlan = (index: number) => {
    const source = dragSnapshot ?? images;
    const img = source[index];
    if (!img) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = img.serverPath || img.uri;
    if (!floorPlanPreview) {
      setFloorPlanPreview(img.uri);
      setOriginalFloorPlanKey(img.isRemote ? toServerPath(url) : null);
      setFloorPlanLocalUri(img.isRemote ? null : img.uri);
      setFloorPlanCleared(false);
    } else {
      setExtraFloorPlanUrls((prev) => [...prev, img.uri]);
    }
    removeImage(index);
  };

  const handleGalleryDragStart = useCallback(() => {
    const next = [...images];
    dragSnapshotRef.current = next;
    setDragSnapshot(next);
    setIsDraggingGallery(true);
  }, [images]);

  const handleGalleryDragEnd = useCallback(() => {
    setIsDraggingGallery(false);
    const snap = dragSnapshotRef.current;
    if (snap) setImages(snap);
    dragSnapshotRef.current = null;
    setDragSnapshot(null);
  }, []);

  const handleGalleryHoverSwap = useCallback(
    (key: string, targetIndex: number) => {
      setDragSnapshot((prev) => {
        const arr = [...(prev ?? images)];
        const currentIndex = arr.findIndex((img) => editableImageKey(img) === key);
        if (currentIndex === targetIndex || currentIndex === -1) return prev;
        const next = [...arr];
        const [item] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, item);
        dragSnapshotRef.current = next;
        return next;
      });
    },
    [images],
  );

  const startDescriptionTyping = (fullText: string, onDone: () => void) => {
    setDescription('');
    const words = fullText.split(' ');
    let currentWordIndex = 0;
    let tempText = '';
    const typingInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        tempText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        setDescription(tempText);
        if (currentWordIndex % 4 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        currentWordIndex++;
      } else {
        clearInterval(typingInterval);
        onDone();
      }
    }, 36);
  };

  // -------- RESET FORMULARZA DO ORYGINAŁU --------
  const resetForm = () => {
    if (!originalData) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    enqueueLayoutSpring();
    setTitle(originalData.title || '');
    const { clean: cleanDesc, tokens } = extractVerifyTokens(originalData.description || '');
    setDescription(formatOfferDescriptionForDisplay(cleanDesc));
    setVerifyTokens(tokens);
    setPrice(String(originalData.priceAmount ?? originalData.price ?? '') || '');
    const listingCur = normalizeListingCurrency(originalData.priceCurrency ?? originalData.price_currency);
    setPriceCurrency(listingCur);
    const feePln = parseAdminFeePln(originalData.adminFee);
    const feeDisplay = adminFeeInputFromPln(feePln, listingCur, editFxRate);
    setAdminFee(feeDisplay > 0 ? String(feeDisplay) : '');
    {
      const cp = extractAgentCommissionPercent(originalData);
      if (cp === null) {
        setAgentCommissionPercent('');
        setAgentCommissionAmountDraft('');
      } else if (cp === 0) {
        setAgentCommissionPercent('0');
        setAgentCommissionAmountDraft('0');
      } else {
        setAgentCommissionPercent(String(cp).replace('.', ','));
        const amt = computeAgentCommissionAmount(originalData.priceAmount ?? originalData.price, cp);
        setAgentCommissionAmountDraft(amt > 0 ? String(amt) : '');
      }
    }
    setArea(originalData.area?.toString() || '');
    const loadedPlotArea =
      originalData.plotArea?.toString() ||
      (String(originalData.propertyType || '').toUpperCase() === 'PLOT'
        ? originalData.area?.toString() || ''
        : '');
    setPlotArea(loadedPlotArea);
    setRooms(originalData.rooms?.toString() || '');
    setFloor(originalData.floor?.toString() || '');
    setYearBuilt(originalData.yearBuilt?.toString() || originalData.buildYear?.toString() || '');
    setHeating(String(originalData.heating || ''));
    setApartmentNumber(String(originalData.apartmentNumber || ''));
    setLandRegistryNumber(String(originalData.landRegistryNumber || ''));
    setCondition(normalizeOfferConditionForEdit(originalData.condition) || 'READY');
    setIsExactLocation(resolveIsExactLocation(originalData.isExactLocation));
    setLocationState({
      lat: Number(originalData.lat) || 52.2297,
      lng: Number(originalData.lng) || 21.0122,
      city: String(originalData.city || '').trim(),
      district: String(originalData.district || '').trim(),
      street: String(originalData.street || originalData.addressStreet || '').trim(),
    });
    setAmenities({
      hasBalcony: isTrue(originalData.hasBalcony),
      hasParking: isTrue(originalData.hasParking),
      hasStorage: isTrue(originalData.hasStorage),
      hasElevator: isTrue(originalData.hasElevator),
      hasGarden: isTrue(originalData.hasGarden),
      isTwoLevel: isTrue(originalData.isTwoLevel),
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
    setFloorPlanCleared(false);
    setFloorPlanLocalUri(null);
    setFloorPlan3dLocalUri(null);
    setDropServerFloorPlan3d(false);
  };

  const handleGenerateDescription = async () => {
    if (isGeneratingDescription) return;
    const hasBasics =
      String(originalData?.propertyType || '').trim() ||
      String(locationState.city || '').trim() ||
      String(area || '').trim() ||
      String(price || '').trim() ||
      String(aiDetailsNotes || '').trim();
    if (!hasBasics) {
      Alert.alert(t('offer.edit.ai.errorTitle'), t('offer.edit.ai.insufficientData'));
      return;
    }
    if (!token) {
      Alert.alert(t('offer.edit.ai.errorTitle'), t('offer.edit.ai.requiresLogin'));
      return;
    }

    setIsGeneratingDescription(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.loop(
      Animated.sequence([
        Animated.timing(descGlowAnim, { toValue: 0.55, duration: 800, useNativeDriver: true }),
        Animated.timing(descGlowAnim, { toValue: 0.12, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
    try {
      const draftPayload = {
        title: title.trim(),
        description: description.trim(),
        existingDescription: description.trim(),
        userNotes: aiDetailsNotes.trim(),
        propertyType: originalData?.propertyType,
        transactionType: originalData?.transactionType,
        city: locationState.city,
        district: locationState.district,
        street: locationState.street,
        area: area ? Number(String(area).replace(',', '.')) : null,
        plotArea: plotArea.trim() ? Number(String(plotArea).replace(',', '.')) : null,
        rooms: rooms ? Number(rooms) : null,
        floor: floor !== '' ? Number(floor) : null,
        yearBuilt: yearBuilt ? Number(yearBuilt) : null,
        price: price ? Number(String(price).replace(/\s/g, '')) : null,
        adminFee: adminFeePlnFromInput(adminFee, priceCurrency, editFxRate),
        condition,
        heating: heating.trim() || null,
        isExactLocation,
        ...amenities,
      };
      const { description: generated } = await generateListingDescriptionWithGpt(token, draftPayload, locale);
      startDescriptionTyping(generated, () => {
        setIsGeneratingDescription(false);
        descGlowAnim.stopAnimation();
        Animated.timing(descGlowAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    } catch (err: any) {
      setIsGeneratingDescription(false);
      descGlowAnim.stopAnimation();
      Animated.timing(descGlowAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      Alert.alert(
        t('offer.edit.ai.errorTitle'),
        String(err?.message || t('offer.edit.ai.failed')),
      );
    }
  };

  // -------- ZAPIS --------
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    
    if (!token?.trim()) {
      Alert.alert(t('offer.edit.alerts.sessionTitle'), t('offer.edit.alerts.sessionLogin'));
      setSaving(false);
      return;
    }
    if (!user?.id) {
      Alert.alert(t('offer.edit.alerts.sessionTitle'), t('offer.edit.alerts.sessionUserId'));
      setSaving(false);
      return;
    }

    const remoteImages = images
      .filter((img) => img.isRemote && img.serverPath)
      .map((img) => img.serverPath as string);
    const localImages = images.filter((img) => !img.isRemote && isLocalUri(img.uri));

    if (!title.trim()) {
      Alert.alert(t('offer.edit.alerts.validationTitle'), t('offer.edit.alerts.validationTitleEmpty'));
      setSaving(false);
      return;
    }
    if (!price || Number(price) <= 0) {
      Alert.alert(t('offer.edit.alerts.validationTitle'), t('offer.edit.alerts.validationPrice'));
      setSaving(false);
      return;
    }
    if (showLandRegistryVerification && landRegistryRaw && !isLandRegistryValid) {
      Alert.alert(
        t('offer.edit.alerts.validationTitle'),
        t('offer.edit.alerts.validationKw')
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
      // Nie polegamy na setState z commit*Draft — walidujemy bieżące drafty synchronicznie.
      const rawCommission = agentCommissionPercent?.toString().trim() ?? '';
      const amountTrimmed = agentCommissionAmountDraft.trim();
      if (
        rawCommission === '' &&
        (commissionInputMode !== 'amount' || amountTrimmed === '')
      ) {
        resolvedCommission = null;
        setAgentCommissionPercent('');
        setAgentCommissionAmountDraft('');
      } else {
        const validation = resolveAgentCommissionPercentForSave({
          mode: commissionInputMode,
          percentRaw: rawCommission,
          amountRaw: agentCommissionAmountDraft,
          priceRaw: price,
        });
        if (!validation.ok) {
          Alert.alert(t('offer.edit.alerts.commissionTitle'), validation.message);
          setSaving(false);
          return;
        }
        resolvedCommission = validation.percent;
        if (resolvedCommission === 0) {
          setAgentCommissionPercent('0');
          setAgentCommissionAmountDraft('0');
        } else if (resolvedCommission != null) {
          setAgentCommissionPercent(String(resolvedCommission).replace('.', ','));
          setAgentCommissionAmountDraft(
            String(computeAgentCommissionAmount(price, resolvedCommission)),
          );
        }
      }
    }

    // Wymuszamy literalny boolean dla `isExactLocation` — niektóre warianty
    // backendu interpretują `undefined`/brak pola jako „brak zmiany" lub
    // default `true`. Wysyłamy też alias `is_exact_location` (snake_case),
    // żeby pokryć backendy, które nie mapują automatycznie nazewnictwa.
    // To jest belt-and-suspenders dla bardzo konkretnego bug-reportu:
    // „klikam wyłączenie i nie zapisuje się dokładna lokalizacja".
    const isExactLocationBool = Boolean(isExactLocation);
    const fxSnap = await getEurPlnRate();
    const priceFields = buildOfferPricePayload({
      priceString: price,
      priceCurrency,
      rate: fxSnap.rate,
    });

    const updatePayload: Record<string, any> = {
      id: offerId,
      userId: user.id,
      title: title.trim(),
      description: [description?.trim() || '', ...verifyTokens].filter(Boolean).join('\n\n'),
      area: area ? Number(area) : 0,
      plotArea:
        String(originalData?.propertyType || '').toUpperCase() === 'PLOT'
          ? (area ? Number(String(area).replace(',', '.')) : null)
          : plotArea.trim()
            ? Number(String(plotArea).replace(',', '.'))
            : null,
      rooms: rooms ? Number(rooms) : null,
      floor: floor !== '' ? Number(floor) : null,
      yearBuilt: yearBuilt ? Number(yearBuilt) : null,
      price: priceFields.priceAmount,
      priceAmount: priceFields.priceAmount,
      priceCurrency: priceFields.priceCurrency,
      pricePln: priceFields.pricePln,
      adminFee: adminFeePlnFromInput(adminFee, priceCurrency, fxSnap.rate),
      condition,
      isExactLocation: isExactLocationBool,
      is_exact_location: isExactLocationBool,
      hideExactAddress: !isExactLocationBool,
      lat: locationState.lat,
      lng: locationState.lng,
      city: locationState.city || originalData?.city || null,
      district: locationState.district || originalData?.district || null,
      street: locationState.street || null,
      status: originalData?.status || 'ACTIVE',
      images: remoteImages,
      ...amenities,
      heating: heating.trim() || null,
      ...(showLandRegistryVerification
        ? {
            apartmentNumber: apartmentNumber.trim() || null,
            landRegistryNumber: landRegistryNumber.trim() || null,
          }
        : {}),
    };
    if (isAgentUser && resolvedCommission !== undefined) {
      updatePayload.agentCommissionPercent = resolvedCommission;
    }
    if (floorPlanCleared) {
      updatePayload.floorPlanUrl = null;
      updatePayload.floorPlan3dUrl = null;
      updatePayload.floorPlanScanMeta = null;
      updatePayload.floorPlanExtraUrls = null;
    } else if (dropServerFloorPlan3d && !floorPlan3dLocalUri) {
      updatePayload.floorPlan3dUrl = null;
      updatePayload.floorPlanScanMeta = null;
    }
    updatePayload.floorPlanExtraUrls = extraFloorPlanUrls.length
      ? JSON.stringify(extraFloorPlanUrls.map((url) => toServerPath(url)))
      : null;

    try {
      const stringifySaveError = (data: any, response: Response) =>
        data?.message ||
        data?.error ||
        (typeof data?._raw === 'string' ? String(data._raw).slice(0, 420) : null) ||
        `Serwer odrzucił zapis (HTTP ${response.status}).`;
      const isLegacyKwColumnError = (msg: string) => {
        const t = String(msg || '').toLowerCase();
        return (
          (
            t.includes('prisma.offer.findunique') ||
            t.includes('unknown column') ||
            t.includes('invalid prisma')
          ) &&
          (
            t.includes('landregistrynumber') ||
            t.includes('apartmentnumber') ||
            t.includes('dregistrynumber')
          ) &&
          (
            t.includes('does not exist') ||
            t.includes('nie istnieje') ||
            t.includes('unknown column')
          )
        );
      };
      const hasKwPayload = Boolean(
        String(updatePayload?.landRegistryNumber || '').trim() ||
        String(updatePayload?.apartmentNumber || '').trim()
      );

      let effectivePayload = updatePayload;
      let usedLegacyKwFallback = false;
      let response = await persistMobileOfferUpdate({
        offerId: Number(offerId),
        token: token.trim(),
        payload: effectivePayload,
      });
      let saveData = await readMobileOfferResponseBody(response);

      if (isExplicitMobileOfferSaveFailure(saveData, response.ok)) {
        const firstError = stringifySaveError(saveData, response);
        const genericReadWriteError = String(firstError).toLowerCase().includes('błąd zapisu lub odczytu oferty');
        const shouldTryLegacyRetry =
          hasKwPayload ||
          isLegacyKwColumnError(firstError) ||
          genericReadWriteError;

        if (shouldTryLegacyRetry) {
          // Fallback produkcyjny: niezależnie od formatu błędu backendu, przy
          // problemach z kolumnami KW zawsze próbujemy zapis bez pól legal.
          const legacyPayload = { ...updatePayload };
          delete legacyPayload.landRegistryNumber;
          delete legacyPayload.apartmentNumber;
          response = await persistMobileOfferUpdate({
            offerId: Number(offerId),
            token: token.trim(),
            payload: legacyPayload,
          });
          saveData = await readMobileOfferResponseBody(response);
          if (isExplicitMobileOfferSaveFailure(saveData, response.ok)) {
            throw new Error(
              stringifySaveError(saveData, response) ||
              firstError
            );
          }
          effectivePayload = legacyPayload;
          usedLegacyKwFallback = true;
        } else {
          throw new Error(firstError);
        }
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
      let nextFloorPlanKey = originalFloorPlanKey;
      let nextFloorPlan3dKey = originalFloorPlan3dKey;
      let nextScanMeta = originalFloorPlanScanMeta;
      const floorPlanTouched =
        floorPlanCleared ||
        Boolean(floorPlanLocalUri) ||
        Boolean(floorPlan3dLocalUri) ||
        dropServerFloorPlan3d;

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

      if (floorPlanLocalUri) {
        let localUri = floorPlanLocalUri;
        let filename = localUri.split('/').pop() || `floorplan_${Date.now()}.jpg`;
        const lower = localUri.toLowerCase();
        const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
        if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
          const converted = await ImageManipulator.manipulateAsync(localUri, [], {
            format: ImageManipulator.SaveFormat.JPEG,
            compress: 0.88,
          });
          localUri = converted.uri;
          filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
        } else if (!filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
          filename = `${filename}.jpg`;
        }
        const fpForm = new FormData();
        fpForm.append('offerId', String(offerId));
        fpForm.append('isFloorPlan', 'true');
        fpForm.append('file', { uri: localUri, name: filename, type: mime } as any);
        const fpRes = await fetch(`${API_URL}/api/upload/mobile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fpForm,
        });
        if (!fpRes.ok) {
          const fpErr = await fpRes.text();
          throw new Error(fpErr || t('addOffer.step5.alerts.floorPlanFailed.message'));
        }
        const fpJson = await fpRes.json().catch(() => ({}));
        const fpUrl = String(fpJson?.url || fpJson?.path || '').trim();
        if (fpUrl) {
          nextFloorPlanKey = toServerPath(fpUrl.startsWith('http') ? fpUrl : fpUrl);
          setFloorPlanPreview(toAbsoluteImageUrl(nextFloorPlanKey));
        }
      }

      if (floorPlan3dLocalUri) {
        const modelForm = new FormData();
        modelForm.append('offerId', String(offerId));
        modelForm.append('isFloorPlan3d', 'true');
        modelForm.append('file', {
          uri: floorPlan3dLocalUri,
          name: 'floorplan-3d.usdz',
          type: 'model/vnd.usdz+zip',
        } as any);
        if (floorPlanScanMetaLocal) {
          modelForm.append('floorPlanScanMeta', floorPlanScanMetaLocal);
        }
        const modelRes = await fetch(`${API_URL}/api/upload/mobile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: modelForm,
        });
        if (!modelRes.ok) {
          const modelErr = await modelRes.text();
          throw new Error(modelErr || t('addOffer.step5.alerts.floorPlanFailed.message'));
        }
        const modelJson = await modelRes.json().catch(() => ({}));
        const modelUrl = String(modelJson?.url || modelJson?.path || '').trim();
        if (modelUrl) nextFloorPlan3dKey = toServerPath(modelUrl.startsWith('http') ? modelUrl : modelUrl);
        nextScanMeta = floorPlanScanMetaLocal;
      }

      if (floorPlanCleared) {
        nextFloorPlanKey = null;
        nextFloorPlan3dKey = null;
        nextScanMeta = null;
        setFloorPlanPreview(null);
      } else if (dropServerFloorPlan3d && !floorPlan3dLocalUri) {
        nextFloorPlan3dKey = null;
        nextScanMeta = null;
      }

      if (floorPlanTouched) {
        setOriginalFloorPlanKey(nextFloorPlanKey);
        setOriginalFloorPlan3dKey(nextFloorPlan3dKey);
        setOriginalFloorPlanScanMeta(nextScanMeta);
        setFloorPlanLocalUri(null);
        setFloorPlan3dLocalUri(null);
        setFloorPlanScanMetaLocal(nextScanMeta);
        setFloorPlanCleared(false);
        setDropServerFloorPlan3d(false);
      }

      // Lokalnie aktualizujemy „original snapshot", żeby `isDirty` zgasł
      // natychmiast po zapisie, bez kolejnego round-tripu sieci.
      setOriginalData({
        ...(originalData || {}),
        title: effectivePayload.title,
        description: effectivePayload.description,
        price: effectivePayload.price,
        priceAmount: effectivePayload.priceAmount ?? effectivePayload.price,
        priceCurrency: effectivePayload.priceCurrency,
        adminFee: effectivePayload.adminFee,
        agentCommissionPercent:
          isAgentUser && resolvedCommission !== undefined
            ? resolvedCommission
            : originalData?.agentCommissionPercent ?? null,
        area: effectivePayload.area,
        plotArea: effectivePayload.plotArea,
        rooms: effectivePayload.rooms,
        floor: effectivePayload.floor,
        yearBuilt: effectivePayload.yearBuilt,
        heating: effectivePayload.heating || '',
        apartmentNumber: usedLegacyKwFallback
          ? String(originalData?.apartmentNumber || '')
          : effectivePayload.apartmentNumber || '',
        landRegistryNumber: usedLegacyKwFallback
          ? String(originalData?.landRegistryNumber || '')
          : effectivePayload.landRegistryNumber || '',
        condition: effectivePayload.condition,
        isExactLocation: effectivePayload.isExactLocation,
        lat: effectivePayload.lat,
        lng: effectivePayload.lng,
        city: effectivePayload.city,
        district: effectivePayload.district,
        street: effectivePayload.street,
        hasBalcony: effectivePayload.hasBalcony,
        hasParking: effectivePayload.hasParking,
        hasStorage: effectivePayload.hasStorage,
        hasElevator: effectivePayload.hasElevator,
        hasGarden: effectivePayload.hasGarden,
        isTwoLevel: effectivePayload.isTwoLevel,
        isFurnished: effectivePayload.isFurnished,
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
              t('offer.edit.alerts.partialSaveTitle'),
              isExactLocationBool
                ? t('offer.edit.alerts.partialExactOn')
                : t('offer.edit.alerts.partialExactOff'),
              [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
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
      Alert.alert(
        usedLegacyKwFallback ? t('offer.edit.alerts.partialSaveTitle') : t('offer.edit.alerts.savedTitle'),
        usedLegacyKwFallback
          ? t('offer.edit.alerts.savedKwFallback')
          : t('offer.edit.alerts.savedSuccess'),
        [
        { text: t('offer.edit.alerts.savedOk'), onPress: () => navigation.goBack() },
        ]
      );
    } catch (e: any) {
      Alert.alert(t('offer.edit.alerts.errorTitle'), e?.message || t('offer.edit.alerts.saveError'));
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
  const hasCommissionSlot = String(agentCommissionPercent || '').trim() !== '';
  const isZeroCommission = isZeroCommissionPercent(commissionPercentParsed);
  const commissionAmountPreview = previewAmountFromPercentDraft(price, agentCommissionPercent);
  const commissionPercentPreview = previewPercentFromAmountDraft(price, agentCommissionAmountDraft);
  const showCommissionRangeWarning = shouldWarnCommissionPercentDraft(agentCommissionPercent, {
    isFocused: commissionPercentFocused || commissionAmountFocused,
  });
  const commissionInRange = !showCommissionRangeWarning;

  const commissionAccent = isZeroCommission ? '#10b981' : '#FF9F0A';
  const commissionAccentBgLight = isZeroCommission ? 'rgba(16,185,129,0.12)' : 'rgba(255,159,10,0.12)';
  const commissionAccentBgStrong = isZeroCommission ? 'rgba(16,185,129,0.18)' : 'rgba(255,159,10,0.16)';
  const commissionAccentBorder = isZeroCommission ? 'rgba(16,185,129,0.55)' : 'rgba(255,159,10,0.55)';

  const handleCommissionChange = (text: string) => {
    setAgentCommissionPercent(text.replace(/[^0-9.,]/g, ''));
  };

  const handleCommissionAmountChange = (text: string) => {
    setAgentCommissionAmountDraft(text.replace(/[^\d]/g, ''));
  };

  const commitCommissionAmountDraft = () => {
    const trimmed = agentCommissionAmountDraft.trim();
    if (!trimmed) {
      setAgentCommissionAmountDraft('');
      setAgentCommissionPercent('');
      return;
    }
    const synced = commissionAmountInputToPercent(price, trimmed);
    if (!synced) return;
    setAgentCommissionAmountDraft(String(synced.amountPln));
    setAgentCommissionPercent(String(synced.percent).replace('.', ','));
  };

  const commitCommissionPercentDraft = () => {
    const trimmed = String(agentCommissionPercent || '').trim();
    if (!trimmed) {
      setAgentCommissionPercent('');
      return;
    }
    const parsed = parseAgentCommissionPercent(trimmed);
    if (parsed === null) return;
    if (parsed === 0) {
      setAgentCommissionPercent('0');
      setAgentCommissionAmountDraft('0');
      return;
    }
    const normalized = Math.max(AGENT_COMMISSION_MIN_PERCENT, parsed);
    setAgentCommissionPercent(String(normalized).replace('.', ','));
    setAgentCommissionAmountDraft(String(computeAgentCommissionAmount(price, normalized)));
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
    const next = Math.max(AGENT_COMMISSION_MIN_PERCENT, roundToQuarter(base + delta));
    setAgentCommissionPercent(String(next).replace('.', ','));
    setAgentCommissionAmountDraft(String(computeAgentCommissionAmount(price, next)));
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
  const displayGalleryImages = dragSnapshot ?? images;
  const galleryGridHeight =
    Math.ceil((displayGalleryImages.length + 1) / EDIT_GALLERY_COLUMNS) * (TILE + EDIT_GALLERY_GAP);

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
            <Text style={[styles.headerBtnText, { color: primaryColor, fontWeight: '400' }]}>{t('offer.edit.header.cancel')}</Text>
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[styles.headerTitle, { color: txtColor }]}>{t('offer.edit.header.title')}</Text>
            {isDirty && (
              <Text style={styles.headerSubtitle}>
                {dirtyCount === 1 ? t('offer.edit.header.dirtyCountOne', { count: dirtyCount }) : dirtyCount < 5 ? t('offer.edit.header.dirtyCountFew', { count: dirtyCount }) : t('offer.edit.header.dirtyCountMany', { count: dirtyCount })}
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
                {t('offer.edit.header.save')}
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
          scrollEnabled={!isDraggingGallery}
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
              <Text style={styles.heroEyebrow}>{t('offer.edit.hero.eyebrow')}</Text>
              <Text style={[styles.heroTitle, { color: txtColor }]}>{t('offer.edit.hero.title')}</Text>
              <Text style={[styles.heroSubtitle, { color: subColor }]}>
                {t('offer.edit.hero.subtitle')}
              </Text>
            </View>
          </View>

          {/* ====== PASEK NIEZAPISANYCH ZMIAN ====== */}
          {isDirty && (
            <View style={styles.dirtyPill}>
              <View style={styles.dirtyDot} />
              <View style={styles.dirtyTextWrap}>
                <Text style={styles.dirtyText}>
                  {t('offer.edit.dirty.title', { count: dirtyCount })}
                </Text>
                <Text style={styles.dirtySubText} numberOfLines={1}>
                  {t('offer.edit.dirty.changed', { summary: dirtySummary || dirtyLabels.map((key) => translateDirtyField(key)).join(', ') })}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    t('offer.edit.alerts.resetTitle'),
                    t('offer.edit.alerts.resetBody'),
                    [
                      { text: t('offer.edit.alerts.resetCancel'), style: 'cancel' },
                      { text: t('offer.edit.alerts.resetConfirm'), style: 'destructive', onPress: resetForm },
                    ]
                  );
                }}
                style={styles.dirtyResetBtn}
              >
                <Text style={styles.dirtyResetText}>{t('offer.edit.dirty.reset')}</Text>
              </Pressable>
            </View>
          )}

          {/* ====== GALERIA ZDJĘĆ ====== */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>
              {t('offer.edit.gallery.sectionTitle')}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t('offer.edit.gallery.counter', { current: images.length, max: MAX_IMAGES })}
            </Text>
          </View>

          {/* Animowana wskazówka — fade-out po pierwszym układaniu */}
          {!galleryHintDismissed && images.length >= 2 && (
            <View style={styles.galleryHint}>
              <Ionicons name="bulb" size={14} color="#10B981" />
              <Text style={styles.galleryHintText}>
                {t('offer.edit.gallery.hint')}
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
            <View style={[styles.imageGridAbsolute, { height: galleryGridHeight }]}>
              <Pressable
                style={[
                  styles.addImageBtn,
                  {
                    width: TILE,
                    height: TILE,
                    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                    left: getEditGalleryPosition(displayGalleryImages.length, TILE).x,
                    top: getEditGalleryPosition(displayGalleryImages.length, TILE).y,
                  },
                ]}
                onPress={pickImage}
              >
                <Ionicons name="camera" size={26} color={primaryColor} />
                <Text style={[styles.addImageText, { color: primaryColor }]}>{t('offer.edit.gallery.add')}</Text>
              </Pressable>

              {displayGalleryImages.map((img, index) => (
                <DraggableEditSquare
                  key={editableImageKey(img)}
                  img={img}
                  index={index}
                  total={displayGalleryImages.length}
                  tileSize={TILE}
                  coverLabel={t('offer.edit.gallery.cover')}
                  onDragStart={handleGalleryDragStart}
                  onDragEnd={handleGalleryDragEnd}
                  onHoverSwap={handleGalleryHoverSwap}
                  onRemove={removeImage}
                  onMarkAsPlan={markImageAsPlan}
                />
              ))}
            </View>
          </View>
          <Text style={styles.sectionFooter}>
            {t('offer.edit.gallery.footer')}
          </Text>

          <View style={styles.sectionHeaderContainer}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>
              {t('offer.edit.floorPlan.sectionTitle')}
            </Text>
          </View>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, padding: 12 }]}>
            {roomScanAvailable ? (
              <Pressable
                onPress={() => setRoomScanOpen(true)}
                style={[
                  styles.editRoomScanCta,
                  {
                    borderColor: isDark ? 'rgba(56,189,248,0.35)' : 'rgba(14,165,233,0.35)',
                    backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(240,249,255,0.95)',
                    marginBottom: 10,
                  },
                ]}
              >
                <View style={styles.editRoomScanIcon}>
                  <Ionicons name="scan-outline" size={20} color="#0ea5e9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editRoomScanTitle, { color: txtColor }]}>
                    {t('offer.edit.floorPlan.scan')}
                  </Text>
                  <Text style={[styles.editRoomScanHint, { color: subColor }]}>
                    {t('offer.edit.floorPlan.scanHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={subColor} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={pickFloorPlan}
              style={[
                styles.floorPlanBox,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  height: floorPlanPreview ? 200 : 72,
                },
              ]}
            >
              {floorPlanPreview ? (
                <View style={{ width: '100%', height: '100%' }}>
                  <Image source={{ uri: floorPlanPreview }} style={styles.floorPlanImage} contentFit="cover" />
                  {floorPlan3dLocalUri || floorPlanScanMetaLocal || ((originalFloorPlan3dKey || originalFloorPlanScanMeta) && !dropServerFloorPlan3d) ? (
                    <View style={styles.editScannedBadge}>
                      <Ionicons name="cube-outline" size={12} color="#e0f2fe" />
                      <Text style={styles.editScannedBadgeText}>{t('offer.edit.floorPlan.scanned')}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.floorPlanPlaceholder}>
                  <Ionicons name="map-outline" size={24} color={primaryColor} />
                  <Text style={[styles.floorPlanPlaceholderText, { color: primaryColor }]}>
                    {t('offer.edit.floorPlan.upload')}
                  </Text>
                </View>
              )}
            </Pressable>
            {floorPlanPreview ? (
              <View style={styles.floorPlanActions}>
                <Pressable onPress={pickFloorPlan} style={styles.floorPlanActionBtn}>
                  <Text style={[styles.floorPlanActionText, { color: primaryColor }]}>
                    {t('offer.edit.floorPlan.replace')}
                  </Text>
                </Pressable>
                <Pressable onPress={removeFloorPlan} style={styles.floorPlanActionBtn}>
                  <Text style={[styles.floorPlanActionText, { color: '#ef4444' }]}>
                    {t('offer.edit.floorPlan.remove')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <RoomScanModal
            visible={roomScanOpen}
            onClose={() => setRoomScanOpen(false)}
            onComplete={handleRoomScanComplete}
          />
          <Text style={styles.sectionFooter}>{t('offer.edit.floorPlan.hint')}</Text>

          {/* ====== INFORMACJE GŁÓWNE ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.mainInfo.sectionTitle')}</Text>
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor, ...cardShadow }]}>
            <View style={styles.fieldHeaderRow}>
              <View style={[styles.fieldIconBadge, { backgroundColor: isDark ? '#10243D' : '#E8F2FF' }]}>
                <Ionicons name="text" size={17} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldTitle, { color: txtColor }]}>{t('offer.edit.mainInfo.titleLabel')}</Text>
                <Text style={[styles.fieldHint, { color: subColor }]}>
                  {t('offer.edit.mainInfo.titleHint')}
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
              placeholder={t('offer.edit.mainInfo.titlePlaceholder')}
              placeholderTextColor={subColor}
            />
          </View>

          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor, ...cardShadow }]}>
            <View style={styles.fieldHeaderRow}>
              <View style={[styles.fieldIconBadge, { backgroundColor: isDark ? '#1F1830' : '#F4ECFF' }]}>
                <Ionicons name="document-text" size={17} color="#AF52DE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldTitle, { color: txtColor }]}>{t('offer.edit.mainInfo.descriptionLabel')}</Text>
                <Text style={[styles.fieldHint, { color: subColor }]}>
                  {t('offer.edit.mainInfo.descriptionHint')}
                </Text>
              </View>
            </View>
            <Text style={[styles.fieldHint, { color: subColor, marginBottom: 6 }]}>
              {t('offer.edit.ai.detailsNotesLabel')}
            </Text>
            <TextInput
              style={[
                styles.textAreaPremium,
                {
                  color: txtColor,
                  backgroundColor: isDark ? '#141416' : '#F7F8FA',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
                  minHeight: 88,
                  marginBottom: 10,
                },
              ]}
              value={aiDetailsNotes}
              onChangeText={setAiDetailsNotes}
              placeholder={t('offer.edit.ai.detailsNotesPlaceholder')}
              placeholderTextColor={subColor}
              multiline
              editable={!isGeneratingDescription}
            />
            <MagicalAiDescribeButton
              label={t('offer.edit.ai.createProfessional')}
              busyLabel={t('offer.edit.ai.generating')}
              busy={isGeneratingDescription}
              onPress={handleGenerateDescription}
            />
            <View style={{ position: 'relative', marginTop: 12 }}>
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: '#AF52DE',
                    borderRadius: 14,
                    opacity: descGlowAnim,
                  },
                ]}
              />
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
                placeholder={t('offer.edit.mainInfo.descriptionPlaceholder')}
                placeholderTextColor={subColor}
                multiline
                editable={!isGeneratingDescription}
              />
            </View>
          </View>

          {/* ====== PARAMETRY ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.parameters.sectionTitle')}</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            {/* Powierzchnia — TextInput bo zakres jest szeroki */}
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>
                {String(originalData?.propertyType || '').toUpperCase() === 'PLOT'
                  ? t('offer.edit.parameters.plotArea')
                  : t('offer.edit.parameters.area')}
              </Text>
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
            
            {String(originalData?.propertyType || '').toUpperCase() === 'HOUSE' ? (
              <>
            <View style={styles.inputRowPremium}>
                  <Text style={[styles.inputLabelPremium, { color: txtColor }]}>
                    {t('offer.edit.parameters.plotArea')}
                  </Text>
                  <TextInput
                    style={[styles.inputRightPremium, { color: txtColor }]}
                    value={plotArea}
                    onChangeText={(v) => setPlotArea(v.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={subColor}
                  />
                  <Text style={styles.inputSuffix}>m²</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
              </>
            ) : null}

            {/* Liczba pokoi — stepper */}
            <View style={styles.inputRowPremium}>
              <View style={styles.paramLabelStack}>
                <Text style={[styles.inputLabelPremium, styles.inputLabelFlex, { color: txtColor }]}>
                  {t('offer.edit.parameters.rooms')}
                </Text>
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
              <View style={styles.paramLabelStack}>
                <Text style={[styles.inputLabelPremium, styles.inputLabelFlex, { color: txtColor }]}>
                  {t('offer.edit.parameters.floor')}
                </Text>
                {floor === '0' ? (
                  <Text style={[styles.paramLabelHint, { color: subColor }]}>
                    {t('offer.shared.floorGroundLabel')}
                  </Text>
                ) : null}
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

            {/* Rok budowy — od 1850 */}
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>{t('offer.edit.parameters.yearBuilt')}</Text>
              <TextInput
                style={[styles.inputRightPremium, { color: txtColor }]}
                value={yearBuilt}
                onChangeText={(t) => setYearBuilt(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={t('offer.edit.parameters.yearPlaceholder')}
                placeholderTextColor={subColor}
                maxLength={4}
              />
            </View>
          </View>

          {/* ====== CENA ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.price.sectionTitle')}</Text>
          <CurrencySegmentControl
            value={priceCurrency}
            isDark={isDark}
            onChange={(next: ListingCurrency) => {
              const n = Number(price || 0);
              if (n > 0) {
                setPrice(String(convertBetweenCurrencies(n, priceCurrency, next, editFxRate)));
              }
              if (adminFee) {
                setAdminFee(convertAdminFeeInput(adminFee, priceCurrency, next, editFxRate));
              }
              setPriceCurrency(next);
            }}
          />
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <View style={styles.priceHeaderRow}>
              <View style={styles.priceLeftCol}>
                <Text style={[styles.priceLabel, { color: subColor }]}>
                  {t('offer.edit.price.offerPrice', { currency: priceCurrency })}
                </Text>
                <Text
                  style={[styles.priceFormatted, { color: txtColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {Number(price) > 0 ? formatAmountWithCurrency(Number(price), priceCurrency) : '—'}
                </Text>
                <View style={styles.priceNudgeRow}>
                  <Pressable
                    hitSlop={6}
                    style={[
                      styles.priceNudgeBtn,
                      {
                        borderColor: 'rgba(255,59,48,0.32)',
                        backgroundColor: isDark ? 'rgba(255,59,48,0.14)' : 'rgba(255,59,48,0.09)',
                        ...controlShadow,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPrice(String(Math.max(0, Number(price || 0) - 100)));
                    }}
                    accessibilityLabel="-100"
                  >
                    <Ionicons name="remove" size={16} color="#FF3B30" />
                    <Text style={[styles.priceNudgeTxt, { color: '#FF3B30' }]}>100</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={6}
                    style={[
                      styles.priceNudgeBtn,
                      {
                        borderColor: 'rgba(52,199,89,0.36)',
                        backgroundColor: isDark ? 'rgba(52,199,89,0.14)' : 'rgba(52,199,89,0.10)',
                        ...controlShadow,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPrice(String(Math.max(0, Number(price || 0) + 100)));
                    }}
                    accessibilityLabel="+100"
                  >
                    <Ionicons name="add" size={16} color="#34C759" />
                    <Text style={[styles.priceNudgeTxt, { color: '#34C759' }]}>100</Text>
                  </Pressable>
                </View>
                {Number(price) > 0 ? (
                  <Text style={[styles.priceSqm, { color: subColor }]}>
                    {formatApproxLine(Number(price), priceCurrency, editFxRate, editFxDate)}
                  </Text>
                ) : null}
                {Number(area) > 0 && Number(price) > 0 ? (
                  <Text style={[styles.priceSqm, { color: subColor }]}>
                    {Math.round(Number(price) / Number(area)).toLocaleString(dateLocale)} {priceCurrency}/m²
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
            {/* Quickpick — większe kroki */}
            <View style={styles.priceStepperRow}>
              {([-50000, -5000, -1000, 1000, 5000, 50000] as const).map((delta) => {
                const isPos = delta > 0;
                const abs = Math.abs(delta);
                const label = `${isPos ? '+' : '−'}${abs / 1000}k`;
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
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>{t('offer.edit.price.adminFee')}</Text>
              <TextInput
                style={[styles.inputRightPremium, { color: txtColor }]}
                value={adminFee}
                onChangeText={(t) => setAdminFee(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={subColor}
              />
              <Text style={styles.inputSuffix}>{t('offer.edit.price.adminFeeSuffix', { currency: priceCurrency })}</Text>
            </View>
          </View>
          <Text style={styles.sectionFooter}>{t('offer.edit.price.footer')}</Text>

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
              <Text style={styles.sectionTitle}>{t('offer.edit.commission.sectionTitle')}</Text>
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
                      {t('offer.edit.commission.badge')}
                    </Text>
                  </View>
                  {hasCommissionSlot ? (
                    <Pressable onPress={clearCommission} hitSlop={10} style={styles.commissionClearBtn}>
                      <Ionicons name="close-circle" size={20} color={subColor} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[styles.commissionTitle, { color: txtColor }]}>
                  {isZeroCommission ? t('offer.edit.commission.titleZero') : t('offer.edit.commission.titleDefault')}
                </Text>
                <Text style={[styles.commissionSubtitle, { color: subColor }]}>
                  {isZeroCommission ? (
                    <>{t('offer.edit.commission.subtitleZero')}</>
                  ) : hasCommissionSlot ? (
                    <>
                      {t('offer.edit.commission.subtitleWithSlotPrefix')}{' '}
                      <Text style={{ fontWeight: '800', color: txtColor }}>
                        {formatPercentLabel(commissionPercentParsed!)}
                      </Text>{' '}
                      {t('offer.edit.commission.subtitleWithSlotSuffix')}{' '}
                      <Text style={{ fontWeight: '800', color: txtColor }}>
                        {t('offer.edit.commission.subtitleWithSlotVat')}
                      </Text>
                    </>
                  ) : (
                    <>
                      {t('offer.edit.commission.subtitleEmpty')}{' '}
                      <Text style={{ fontWeight: '800', color: txtColor }}>
                        {t('offer.edit.commission.subtitleEmptyVat')}
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
                        {t('offer.edit.commission.addDefault', { percent: formatPercentLabel(AGENT_COMMISSION_DEFAULT_PERCENT) })}
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
                        {t('offer.edit.commission.addZero')}
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
                    <View style={styles.commissionModeRow}>
                      {(['percent', 'amount'] as const).map((m) => {
                        const active = commissionInputMode === m;
                return (
                          <Pressable
                            key={m}
                            onPress={() => {
                              setCommissionInputMode(m);
                              if (m === 'amount') {
                                if (commissionAmountPreview > 0) {
                                  setAgentCommissionAmountDraft(String(commissionAmountPreview));
                                }
                              } else {
                                commitCommissionAmountDraft();
                              }
                            }}
                            style={[
                              styles.commissionModeBtn,
                              {
                                backgroundColor: active ? commissionAccentBgStrong : 'transparent',
                                borderColor: active ? commissionAccentBorder : borderColor,
                              },
                            ]}
                          >
                            <Text style={{ color: active ? commissionAccent : subColor, fontWeight: '800', fontSize: 11 }}>
                              {m === 'percent' ? '%' : 'PLN'}
                            </Text>
                  </Pressable>
                );
              })}
                    </View>
                    <View style={styles.commissionRow}>
                      <View style={styles.commissionInputCol}>
                        <Text style={[styles.commissionLabel, { color: subColor }]}>
                          {commissionInputMode === 'percent'
                            ? t('offer.edit.commission.label')
                            : t('offer.edit.commission.amountColOffer')}
                        </Text>
                        <View
                          style={[
                            styles.commissionInputBox,
                            { backgroundColor: commissionAccentBgLight, borderColor: commissionAccentBorder },
                          ]}
                        >
                          {commissionInputMode === 'percent' ? (
                            <>
                              <TextInput
                                style={[styles.commissionInput, { color: txtColor }]}
                                value={String(agentCommissionPercent || '')}
                                onChangeText={handleCommissionChange}
                                onFocus={() => setCommissionPercentFocused(true)}
                                onBlur={() => {
                                  setCommissionPercentFocused(false);
                                  commitCommissionPercentDraft();
                                }}
                                placeholder={String(AGENT_COMMISSION_DEFAULT_PERCENT).replace('.', ',')}
                                placeholderTextColor={subColor}
                                keyboardType="decimal-pad"
                              />
                              <Text style={[styles.commissionInputSuffix, { color: txtColor }]}>%</Text>
                            </>
                          ) : (
                            <TextInput
                              style={[styles.commissionInput, { color: txtColor, flex: 1 }]}
                              value={agentCommissionAmountDraft}
                              onChangeText={handleCommissionAmountChange}
                              onFocus={() => setCommissionAmountFocused(true)}
                              onBlur={() => {
                                setCommissionAmountFocused(false);
                                commitCommissionAmountDraft();
                              }}
                              placeholder="37000"
                              placeholderTextColor={subColor}
                              keyboardType="number-pad"
                            />
                          )}
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
                            {t('offer.edit.commission.stepHint', { step: formatPercentLabel(AGENT_COMMISSION_STEP_PERCENT) })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.commissionAmountCol}>
                        <Text style={[styles.commissionLabel, { color: subColor }]} numberOfLines={1}>
                          {commissionInputMode === 'amount'
                            ? t('offer.edit.commission.label')
                            : isZeroCommission
                              ? t('offer.edit.commission.amountColBuyer')
                              : t('offer.edit.commission.amountColOffer')}
                        </Text>
                        <Text
                          style={[styles.commissionAmountValue, { color: commissionAccent }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.5}
                        >
                          {commissionInputMode === 'amount'
                            ? commissionPercentPreview !== null
                              ? formatPercentLabel(Math.max(0, commissionPercentPreview))
                              : t('offer.edit.commission.amountEmpty')
                            : isZeroCommission
                              ? t('offer.edit.commission.amountZero')
                              : commissionAmountPreview > 0
                                ? formatPlnAmount(commissionAmountPreview)
                                : t('offer.edit.commission.amountEmpty')}
                        </Text>
                        <Text style={[styles.commissionAmountHint, { color: subColor }]} numberOfLines={2}>
                          {isZeroCommission
                            ? t('offer.edit.commission.amountHintZero')
                            : t('offer.edit.commission.amountHintDefault')}
                        </Text>
            </View>
          </View>

                    {showCommissionRangeWarning ? (
                      <View style={styles.commissionWarn}>
                        <Ionicons name="warning-outline" size={14} color="#FF3B30" />
                        <Text style={[styles.commissionWarnText, { color: '#FF3B30' }]}>
                          {t('offer.edit.commission.rangeWarning', {
                            min: formatPercentLabel(AGENT_COMMISSION_MIN_PERCENT),
                            max: '',
                          }).replace(/\s*–\s*$/, '')}
                        </Text>
            </View>
                    ) : null}
                  </View>
                )}
              </View>
              <Text style={styles.sectionFooter}>
                {t('offer.edit.commission.footer')}
              </Text>
            </>
          ) : null}

          {/* ====== STAN ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.condition.sectionTitle')}</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <View style={styles.segmentContainer}>
              {(['READY', 'DEVELOPER', 'TO_RENOVATION'] as const).map((condKey) => {
                const isActive = condition === condKey;
                return (
                  <Pressable
                    key={condKey}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCondition(condKey);
                    }}
                    style={[
                      styles.segmentBtn,
                      isActive && {
                        backgroundColor: isDark ? '#48484A' : '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.12,
                        shadowRadius: 3,
                        elevation: 2,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.segmentText, isActive && { color: txtColor, fontWeight: '700' }]}
                      numberOfLines={2}
                    >
                      {t(`offer.shared.conditionSegments.${condKey}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ====== UDOGODNIENIA ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.amenities.sectionTitle')}</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <AmenityRow
              icon="leaf"
              tint="#34C759"
              label={t('offer.shared.amenitiesEdit.balcony')}
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
              label={t('offer.shared.amenitiesEdit.garden')}
              value={amenities.hasGarden}
              onChange={(v) => setAmenities({ ...amenities, hasGarden: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="layers"
              tint="#AF52DE"
              label={t('offer.shared.amenitiesEdit.twoLevel')}
              value={amenities.isTwoLevel}
              onChange={(v) => setAmenities({ ...amenities, isTwoLevel: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <AmenityRow
              icon="car"
              tint="#5856D6"
              label={t('offer.shared.amenitiesEdit.parking')}
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
              label={t('offer.shared.amenitiesEdit.elevator')}
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
              label={t('offer.shared.amenitiesEdit.storage')}
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
              label={t('offer.shared.amenitiesEdit.furnished')}
              value={amenities.isFurnished}
              onChange={(v) => setAmenities({ ...amenities, isFurnished: v })}
              borderColor={borderColor}
              txtColor={txtColor}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
              <AddOfferWheelPickerColumn
                title={t('offer.edit.amenities.heating')}
                value={heating}
                options={heatingOptions}
                onChange={(v) => setHeating(String(v || ''))}
                theme={{ text: txtColor, subtitle: subColor, glass: isDark ? 'dark' : 'light' }}
                cardBg={isDark ? '#2C2C2E' : '#F6F6F8'}
                cardBorder={borderColor}
              />
            </View>
          </View>

          {showLandRegistryVerification ? (
          <>
          {/* ====== WERYFIKACJA NIERUCHOMOŚCI — TARCZA BEZPIECZEŃSTWA (tylko PL) ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.kw.sectionTitle')}</Text>

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
                      {isLandRegistryValid ? t('offer.edit.kw.verifiedBadge') : t('offer.edit.kw.unverifiedBadge')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.shieldTitle, { color: txtColor }]}>
                  {isLandRegistryValid
                    ? t('offer.edit.kw.verifiedTitle')
                    : t('offer.edit.kw.unverifiedTitle')}
                </Text>
                <Text style={[styles.shieldSub, { color: subColor }]}>
                  {isLandRegistryValid
                    ? t('offer.edit.kw.verifiedSub')
                    : t('offer.edit.kw.unverifiedSub')}
                </Text>
              </View>
            </View>

            {/* Lista korzyści */}
            <View style={[styles.shieldBenefits, { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
              {[
                { icon: 'checkmark-circle', text: t('offer.edit.kw.benefit1') },
                { icon: 'checkmark-circle', text: t('offer.edit.kw.benefit2') },
                { icon: 'checkmark-circle', text: t('offer.edit.kw.benefit3') },
                { icon: 'lock-closed', text: t('offer.edit.kw.benefit4') },
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
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            {/* Numer mieszkania — ten sam styl pola co KW */}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
              <Text style={[styles.inputLabelPremium, styles.inputLabelFlex, { color: txtColor, marginBottom: 2 }]}>
                {t('offer.edit.kw.apartmentNumber')}
              </Text>
              <Text style={[styles.kwFormatHint, { color: subColor, marginBottom: 8 }]}>
                {t('offer.edit.kw.apartmentOptional')}
              </Text>
              <TextInput
                style={[
                  styles.kwInput,
                  {
                    color: txtColor,
                    borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                    backgroundColor: isDark ? '#2C2C2E' : '#F6F6F8',
                  },
                ]}
                value={apartmentNumber}
                onChangeText={setApartmentNumber}
                placeholder={t('offer.edit.kw.apartmentPlaceholder')}
                placeholderTextColor={subColor}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* Numer KW z formatowaniem i walidacją */}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
              <View style={styles.kwLabelRow}>
                <View style={styles.kwLockBadge}>
                  <Ionicons name="lock-closed" size={10} color="#34C759" />
                  <Text style={styles.kwLockText}>{t('offer.edit.kw.encrypted')}</Text>
                </View>
                <Text style={[styles.inputLabelPremium, { color: txtColor, flex: 1, marginLeft: 8, width: undefined }]}>
                  {t('offer.edit.kw.landRegistryLabel')}
                </Text>
              </View>
              <Text style={[styles.kwFormatHint, { color: subColor }]}>
                {t('offer.edit.kw.formatHint')}{' '}
                <Text style={{ fontWeight: '800', color: txtColor, letterSpacing: 1 }}>XXXX / XXXXXXXX / X</Text>
                {'  '}
                {t('offer.edit.kw.formatExample')} <Text style={{ fontWeight: '700' }}>WA4N/00012345/6</Text>
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
                      : isDark
                        ? 'rgba(255,255,255,0.18)'
                        : 'rgba(0,0,0,0.12)',
                    backgroundColor: isDark ? '#2C2C2E' : '#F6F6F8',
                  },
                ]}
                value={landRegistryNumber}
                onChangeText={(t) => setLandRegistryNumber(normalizeLandRegistryNumber(t))}
                onFocus={() => {
                  setTimeout(() => mainScrollRef.current?.scrollToEnd({ animated: true }), 320);
                }}
                placeholder={t('offer.edit.kw.placeholder')}
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
                      ? t('offer.edit.kw.validFormat', { courtSuffix: selectedCourt ? t('offer.edit.kw.courtSuffix', { court: selectedCourt.courtName }) : '' })
                      : t('offer.edit.kw.invalidFormat')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          </>
          ) : null}

          {/* ====== LOKALIZACJA — Z ŻYWYM PODGLĄDEM ====== */}
          <Text style={styles.sectionTitle}>{t('offer.edit.location.sectionTitle')}</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, ...cardShadow }]}>
            <View style={[styles.switchRow, { alignItems: 'flex-start' }]}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>{t('offer.edit.location.exactTitle')}</Text>
                <Text style={styles.switchSubtitle}>
                  {isExactLocation ? (
                    <>
                      {t('offer.edit.location.exactOnPrefix')}
                      <Text style={{ fontWeight: '700' }}>{t('offer.edit.location.exactSubtitleBoldStreet')}</Text>
                      {t('offer.edit.location.exactOnSuffix')}
                    </>
                  ) : (
                    <>
                      {t('offer.edit.location.exactOffPrefix')}
                      <Text style={{ fontWeight: '700' }}>{t('offer.edit.location.exactSubtitleBoldStreetOnly')}</Text>
                      {t('offer.edit.location.exactOffSuffix')}
                    </>
                  )}
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
            <EditOfferLocationEditor
              value={locationState}
              isExactLocation={isExactLocation}
              isDark={isDark}
              token={token}
              onChange={(patch) => setLocationState((prev) => ({ ...prev, ...patch }))}
            />
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <LocationPreview
              isExactLocation={isExactLocation}
              isDark={isDark}
              txtColor={txtColor}
              city={locationState.city || originalData?.city}
              district={locationState.district || originalData?.district}
              street={locationState.street || originalData?.street || originalData?.addressStreet}
              localityCountry={originalData?.localityCountry}
              localityCountryCode={originalData?.localityCountryCode}
            />
          </View>
          <Text style={styles.sectionFooter}>
            {t('offer.edit.location.footer')}
          </Text>

          {/* Bufor pod sticky save */}
          <View style={{ height: 96 }} />
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
                  ? t('offer.edit.sticky.allSaved')
                  : `${t('offer.edit.sticky.saveChanges', { suffix: dirtyCount > 0 ? t('offer.edit.sticky.saveSuffix', { count: dirtyCount }) : '' })}`}
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
   LOCATION PREVIEW — krótki podgląd linii adresu tak, jak widzą kupujący.
   ============================================================================ */
function LocationPreview({
  isExactLocation,
  isDark,
  txtColor,
  city,
  district,
  street,
  localityCountry,
  localityCountryCode,
}: {
  isExactLocation: boolean;
  isDark: boolean;
  txtColor: string;
  city?: string;
  district?: string;
  street?: string;
  localityCountry?: string;
  localityCountryCode?: string;
}) {
  const { t } = useI18n();
  const addressFade = useRef(new Animated.Value(1)).current;
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
  const locPres = getDraftLocationPresentation({
    city: cityRaw,
    district: districtRaw,
    localityCountry: String(localityCountry ?? ''),
    localityCountryCode: String(localityCountryCode ?? ''),
  });
  const previewLine = formatPublicAddress(
    locPres.city,
    locPres.district,
    streetRaw,
    isExactLocation,
    locPres.countryLabelPl,
  );
  const visibleStreet = hasStreet ? (isExactLocation ? streetRaw : stripHouseNumber(streetRaw)) : '';

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
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
              {isExactLocation ? t('offer.edit.location.badgeFull') : t('offer.edit.location.badgeStreet')}
            </Text>
          </View>
          <Text style={styles.locAddressEyebrow}>{t('offer.edit.location.previewEyebrow')}</Text>
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
                {t('offer.edit.location.numberVisible', {
                  number: (streetRaw.match(/\d+[A-Za-z]?(?:[\/\-]\d+[A-Za-z]?)?\s*$/u) || [''])[0].trim() || '—',
                })}
              </Text>
            ) : (
              <Text style={styles.locAddressHint}>
                {t('offer.edit.location.numberHiddenPrefix')}{' '}
                <Text style={{ fontWeight: '700', color: '#FF9500' }}>{t('offer.edit.location.numberHiddenBold')}</Text>
                . {t('offer.edit.location.numberHiddenSuffix', { street: visibleStreet || streetRaw })}
              </Text>
            )
          ) : (
            <Text style={styles.locAddressHint}>{t('offer.edit.location.noStreet')}</Text>
          )}
        </Animated.View>
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
    paddingBottom: 24,
  },

  /* ===== HERO ===== */
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 12,
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
    marginBottom: 4,
  },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9500' },
  dirtyTextWrap: { flex: 1 },
  dirtyText: { fontSize: 12.5, fontWeight: '800', color: '#FF9500' },
  dirtySubText: { marginTop: 1, fontSize: 11.5, fontWeight: '600', color: 'rgba(201,108,0,0.82)' },
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
  floorPlanBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorPlanImage: { width: '100%', height: '100%' },
  floorPlanPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  floorPlanPlaceholderText: { fontSize: 14, fontWeight: '700' },
  floorPlanActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 12 },
  floorPlanActionBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  floorPlanActionText: { fontSize: 13, fontWeight: '700' },
  editRoomScanCta: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editRoomScanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRoomScanTitle: { fontSize: 14, fontWeight: '800' },
  editRoomScanHint: { fontSize: 11, fontWeight: '500', marginTop: 3, lineHeight: 15 },
  editScannedBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editScannedBadgeText: { color: '#e0f2fe', fontSize: 11, fontWeight: '800' },

  /* ===== SECTION HEADERS ===== */
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 4,
    marginBottom: 8,
    marginTop: 22,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionTitleInHeader: {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  sectionSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  sectionFooter: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
    marginTop: 8,
    marginBottom: 2,
    lineHeight: 17,
  },
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
  commissionModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'flex-end',
  },
  commissionModeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
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
  imageGridAbsolute: { position: 'relative', width: '100%' },
  addImageBtn: {
    position: 'absolute',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.4)',
  },
  addImageText: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  dragTile: { position: 'absolute', borderRadius: 12, overflow: 'hidden', backgroundColor: '#1C1C1E' },
  imageThumbnail: { width: '100%', height: '100%' },
  matrixOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  dotMatrix: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  matrixDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
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
  planImageBtn: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(6,182,212,0.92)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 21,
  },
  planImageText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  aiDescBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  aiDescBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#AF52DE',
  },
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
  inputRowPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  inputLabelPremium: { fontSize: 16, width: 140, fontWeight: '500', letterSpacing: -0.3 },
  inputLabelFlex: { width: undefined, flexShrink: 1 },
  paramLabelStack: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
    justifyContent: 'center',
  },
  paramLabelHint: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  inputRightPremium: { flex: 1, fontSize: 17, textAlign: 'right', letterSpacing: -0.3 },
  inputSuffix: { fontSize: 15, color: '#8E8E93', marginLeft: 6, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  
  /* ===== SEGMENT ===== */
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 4,
    margin: 12,
    backgroundColor: 'rgba(150,150,150,0.16)',
    borderRadius: 10,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 11.5,
    lineHeight: 14,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

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


  /* ===== STEPPER INLINE (pokoje, piętro) ===== */
  stepperInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flexShrink: 0,
    width: 140,
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
    width: 48,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },

  /* ===== CENA ===== */
  priceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  priceLeftCol: {
    flex: 1,
    minWidth: 0,
  },
  priceLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase', marginBottom: 4 },
  priceFormatted: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  priceCurrency: { fontSize: 16, fontWeight: '600' },
  priceNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  priceNudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  priceNudgeTxt: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  priceSqm: { fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.1 },
  priceInput: {
    fontSize: 22,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 120,
    letterSpacing: -0.4,
    marginTop: 18,
  },
  priceStepperRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  priceStepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    flexGrow: 1,
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
