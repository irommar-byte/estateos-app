import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import CommissionRateSlider from '../components/agency/CommissionRateSlider';
import SignaturePad from '../components/agency/SignaturePad';
import AcquisitionStepIndicator from '../components/agency/AcquisitionStepIndicator';
import AcquisitionGuideChrome from '../components/agency/AcquisitionGuideChrome';
import AcquisitionDatePickerModal from '../components/agency/AcquisitionDatePickerModal';
import AcquisitionAddressMapField from '../components/agency/AcquisitionAddressMapField';
import AcquisitionRoomScanner, { type RoomItem } from '../components/agency/AcquisitionRoomScanner';
import AcquisitionKwField from '../components/agency/AcquisitionKwField';
import EkwBookViewerModal from '../components/admin/EkwBookViewerModal';
import MultiSelectChipGroup from '../components/agency/MultiSelectChipGroup';
import SellerPropertyTypePicker, {
  sellerPropertyTypeLabel,
  type SellerPropertyTypeId,
} from '../components/agency/SellerPropertyTypePicker';
import ContactMessageAttachment from '../components/messaging/ContactMessageAttachment';
import AgencyClientRadarSurvey, {
  clientRadarFiltersFromUnknown,
  clientRadarSurveyHint,
  clientRadarSurveyReady,
  defaultClientRadarFilters,
  type ClientRadarFilters,
} from '../components/agency/AgencyClientRadarSurvey';
import MatchPhotoCascade, { type CascadeOrigin } from '../components/agency/MatchPhotoCascade';
import MatchImportAgentMeta from '../components/agency/MatchImportAgentMeta';
import IntelligenceAssistantCard, {
  DEFAULT_INTELLIGENCE_SETTINGS,
} from '../components/agency/IntelligenceAssistantCard';
import {
  DEFAULT_INTELLIGENCE_LOCKS,
  type IntelligenceLocks,
} from '../lib/intelligenceAssistantOptions';
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
  postAgencyClientAction,
  uploadClientPortalAttachment,
  type AcquisitionFormData,
  type AcquisitionRecord,
  type AgencyClientDetail,
  type AgencyClientMatch,
} from '../services/agencyClientService';
import { formatCurrencyPLN, formatPhoneNumber, formatPriceInput, parseGroupedNumber } from '../utils/crmFormatters';
import { storeCommissionPercent } from '../types/leadTransfer';
import { formatClientFeedbackForAgent } from '../utils/clientPortalFeedback';
import { formatOfferDescriptionForDisplay } from '../utils/offerDescriptionDisplay';
import {
  cleanAttachmentOnlyMessage,
  formatContactAttachmentName,
  normalizeContactMediaUrl,
} from '../utils/contactAttachment';
import { API_URL } from '../config/network';
import type { WholePropertyScan } from '../types/roomScan';
import { listingRoomCountFromRooms, livableAreaFromRooms } from '../lib/roomScan/refineScanSections';
import MarketValuationCard from '../components/market/MarketValuationCard';
import {
  ACQUISITION_GUIDE_STEPS,
  acquisitionOfferErrorKeys,
  acquisitionOfferErrorSteps,
  findAcquisitionOfferGaps,
} from '../lib/acquisitionOfferReady';
import {
  canSubmitOfferForOfficeActivation,
  officeOfferStatusColor,
  resolveOfficeOfferUiStatus,
  type LinkedOfferSnapshot,
} from '../lib/officeOfferStatusUi';
import { fetchOfficeReviewCapability, postOfficeReviewAction } from '../services/agencyCompanyService';
import { LAND_REGISTRY_REGEX } from '../utils/landRegistry';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STEPS = ACQUISITION_GUIDE_STEPS.map((item) => ({ id: item.id, title: item.title }));
const ERROR_RED = '#FF3B30';

function portalAttachmentSummary(attachment: { mimeType?: string; name?: string } | undefined) {
  if (!attachment) return 'Brak wiadomości';
  const mime = String(attachment.mimeType || '').toLowerCase();
  const name = String(attachment.name || '').toLowerCase();
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(name)) return 'Nagranie audio';
  if (mime.startsWith('image/')) return 'Zdjęcie';
  if (mime.startsWith('video/')) return 'Wideo';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'Dokument PDF';
  return 'Załącznik';
}

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

function acquisitionSnapshot(form: AcquisitionFormData | null, step: number) {
  return JSON.stringify({ form, step });
}

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? `${API_URL}${raw}` : `${API_URL}/${raw}`;
}

function matchOfferImages(offer: AgencyClientMatch['offer']): string[] {
  const raw = Array.isArray(offer.imageUrls) && offer.imageUrls.length
    ? offer.imageUrls
    : offer.imageUrl
      ? [offer.imageUrl]
      : [];
  const out: string[] = [];
  for (const item of raw) {
    const uri = mediaUrl(item);
    if (uri && !out.includes(uri)) out.push(uri);
  }
  return out;
}

function MatchRow({
  item,
  colors,
  sent,
  busy,
  onSend,
  onResend,
  onOpen,
}: {
  item: AgencyClientMatch;
  colors: { text: string; secondary: string; accent: string; border: string; card: string };
  sent: boolean;
  busy: boolean;
  onSend: () => void;
  onResend?: () => void;
  onOpen: () => void;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [origin, setOrigin] = useState<CascadeOrigin | null>(null);
  const thumbRef = useRef<View>(null);
  const meta = [item.offer.city, item.offer.district, item.offer.area ? `${item.offer.area} m²` : null]
    .filter(Boolean)
    .join(' · ');
  const feedback = formatClientFeedbackForAgent(item.clientFeedback);
  const scoreColor = item.score >= 85 ? '#34C759' : item.score >= 70 ? '#A3E635' : item.score >= 55 ? '#FF9F0A' : '#FF453A';
  const description = formatOfferDescriptionForDisplay(item.offer.description || item.offer.excerpt);
  const images = matchOfferImages(item.offer);

  const toggle = (next: () => void) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    next();
  };

  const openGallery = () => {
    if (!images.length) {
      onOpen();
      return;
    }
    thumbRef.current?.measureInWindow((x, y, width, height) => {
      setOrigin({ x, y, width, height });
      setGalleryOpen(true);
    });
  };

  const inner = (
    <>
      <MatchPhotoCascade visible={galleryOpen} images={images} origin={origin} onClose={() => setGalleryOpen(false)} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View ref={thumbRef} collapsable={false}>
          <Pressable onPress={openGallery}>
          {images[0] ? (
            <Image
              source={{ uri: images[0] }}
              contentFit="contain"
              style={{ width: 88, height: 72, borderRadius: 12, backgroundColor: colors.border }}
            />
          ) : (
            <View
              style={{
                width: 88,
                height: 72,
                borderRadius: 12,
                backgroundColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="home-outline" size={22} color={colors.secondary} />
            </View>
          )}
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Pressable onPress={onOpen}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{item.offer.title}</Text>
            {item.intelligenceSent ? (
              <Text style={{ color: '#7B4DFF', fontWeight: '900', fontSize: 10, letterSpacing: 0.4, marginTop: 3 }}>
                DOMYSŁ ESTATEOS™ INTELLIGENCE
              </Text>
            ) : null}
            <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 13, marginTop: 2 }}>
              {formatCurrencyPLN(item.offer.price)}
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>{meta}</Text>
          </Pressable>
          <MatchImportAgentMeta brief={item.importBrief} colors={colors} />
          {description ? (
            <Pressable onPress={() => toggle(() => setDescOpen((value) => !value))}>
              <Text
                style={{ color: colors.secondary, fontSize: 11, marginTop: 4, lineHeight: 16 }}
                numberOfLines={descOpen ? undefined : 2}
              >
                {description}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.border, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(8, Math.min(100, item.score || 0))}%`, height: 6, backgroundColor: scoreColor }} />
            </View>
            <Text style={{ color: scoreColor, fontWeight: '900', fontSize: 11 }}>{item.score || 0}%</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        {sent ? (
          <>
            <View style={{ backgroundColor: 'rgba(52,199,89,0.16)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 11 }}>Wysłano</Text>
            </View>
            {onResend ? (
              <Pressable
                onPress={onResend}
                style={{ backgroundColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>{busy ? '…' : 'Wyślij ponownie'}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Pressable
            onPress={onSend}
            style={{ backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
          >
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 11 }}>{busy ? '…' : 'Wyślij'}</Text>
          </Pressable>
        )}
      </View>
      {feedback ? (
        <View style={{ marginTop: 8, borderRadius: 12, backgroundColor: 'rgba(255,159,10,0.12)', padding: 10 }}>
          <Text style={{ color: '#C93400', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 }}>REAKCJA KLIENTA</Text>
          <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>{feedback}</Text>
          {item.clientFeedbackAt ? (
            <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 4 }}>
              {new Date(item.clientFeedbackAt).toLocaleString('pl-PL')}
            </Text>
          ) : null}
        </View>
      ) : sent ? (
        <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6 }}>Klient jeszcze nie odniósł się do tej oferty.</Text>
      ) : null}
    </>
  );

  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: item.intelligenceSent ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      {item.intelligenceSent ? (
        <LinearGradient
          colors={['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, padding: 2 }}
        >
          <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 10 }}>{inner}</View>
        </LinearGradient>
      ) : (
        inner
      )}
    </View>
  );
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
  const [wholePropertyScan, setWholePropertyScan] = useState<WholePropertyScan | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [pendingChatFile, setPendingChatFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [chatFocused, setChatFocused] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [radarExpanded, setRadarExpanded] = useState(false);
  const [presentationExpanded, setPresentationExpanded] = useState(false);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const chatPinnedToEndRef = useRef(true);
  const [presentationAt, setPresentationAt] = useState('');
  const [presentationOfferId, setPresentationOfferId] = useState('');

  // Seller Buyer Radar Controls
  const [sellerRadarSearching, setSellerRadarSearching] = useState(false);
  const [buyerFilters, setBuyerFilters] = useState<ClientRadarFilters>(defaultClientRadarFilters);
  const [intelLocks, setIntelLocks] = useState<IntelligenceLocks>(DEFAULT_INTELLIGENCE_LOCKS);

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
  const [showOfferErrors, setShowOfferErrors] = useState(false);
  const [linkedOffer, setLinkedOffer] = useState<LinkedOfferSnapshot | null>(null);
  const [ekwViewerKw, setEkwViewerKw] = useState<string | null>(null);
  const [canManageOfficeOffers, setCanManageOfficeOffers] = useState(false);
  const [offerActionBusy, setOfferActionBusy] = useState(false);

  const DRAFT_KEY = `@eos_acq_detail_draft_${clientId}`;
  const savedSnapshotRef = useRef('');
  const hydratedRef = useRef(false);
  const draftPromptedRef = useRef(false);
  const persistInFlightRef = useRef(false);
  const formRef = useRef<AcquisitionFormData | null>(null);
  const stepRef = useRef(1);
  const signedRef = useRef(false);
  formRef.current = form;
  stepRef.current = step;

  const handleCreateOfferFromAcquisition = async () => {
    if (!token || !client?.id) return;
    const gaps = findAcquisitionOfferGaps(formRef.current);
    if (gaps.length) {
      setShowOfferErrors(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(gaps[0].step);
      Alert.alert(
        'Oferta z karty',
        `Uzupełnij pola podświetlone na czerwono: ${gaps.map((item) => item.label).join(', ')}.`,
      );
      return;
    }
    setCreatingOffer(true);
    try {
      const saved = await persist(stepRef.current, { silent: true });
      if (!saved) {
        Alert.alert('Oferta z karty', 'Nie udało się zapisać karty przed utworzeniem oferty.');
        return;
      }
      const res = await createOfferFromAcquisition(token, client.id);
      if (!res.ok) {
        setShowOfferErrors(true);
        Alert.alert('Oferta z karty', res.message);
        return;
      }
      setShowOfferErrors(false);
      Alert.alert(
        'Oferta utworzona!',
        `Nowa oferta #${res.offerId} została pomyślnie utworzona z danych karty pozyskania i przypisana do klienta.`,
        [{ text: 'OK', onPress: () => void load() }],
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
    if (Number(detail.client.portalUnreadCount || 0) > 0) {
      void postAgencyClientAction(token, clientId, { action: 'mark_portal_messages_read' });
    }
    setSignerName(`${detail.client.firstName} ${detail.client.lastName}`.trim());
    setSignerEmail(detail.client.email || '');

    if (detail.client.buyerFilters) {
      setSellerRadarSearching(true);
      setBuyerFilters(clientRadarFiltersFromUnknown(detail.client.buyerFilters));
    } else {
      setSellerRadarSearching(detail.client.type === 'BUYER');
      setBuyerFilters(defaultClientRadarFilters());
    }
    setIntelLocks(detail.client.intelligence?.lockedFields || DEFAULT_INTELLIGENCE_LOCKS);

    if (detail.client.type === 'SELLER') {
      const acq = await fetchAcquisition(token, clientId);
      if (acq.ok) {
        setRecord(acq.acquisition);
        const nextForm = acq.acquisition?.formData || acq.defaultForm;
        const nextStep = acq.acquisition?.status === 'SIGNED' ? 7 : acq.acquisition?.currentStep || 1;
        setForm(nextForm);
        setStep(nextStep);
        savedSnapshotRef.current = acquisitionSnapshot(nextForm, nextStep);
        try {
          const storedRooms = JSON.parse(String((nextForm.property as Record<string, unknown>)?.roomsJson || '[]'));
          if (Array.isArray(storedRooms)) setRooms(storedRooms);
        } catch {
          /* ignore */
        }
        try {
          const storedWholeScan = JSON.parse(
            String((nextForm.property as Record<string, unknown>)?.wholeScanJson || 'null'),
          );
          if (storedWholeScan?.scanMeta) setWholePropertyScan(storedWholeScan);
        } catch {
          /* ignore */
        }
        const storedPlans = String((nextForm.property as Record<string, unknown>)?.planImages || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (storedPlans.length) setPlanImages(storedPlans);

        const nextLinkedOffer =
          acq.linkedOffer ??
          (acq.linkedOfferId
            ? { id: acq.linkedOfferId }
            : detail.client.linkedOfferId
              ? { id: detail.client.linkedOfferId }
              : null);
        setLinkedOffer(nextLinkedOffer);
        void fetchOfficeReviewCapability(token).then(setCanManageOfficeOffers).catch(() => setCanManageOfficeOffers(false));

        if (!draftPromptedRef.current && !acq.acquisition?.signedAt) {
          draftPromptedRef.current = true;
          try {
            const raw = await AsyncStorage.getItem(DRAFT_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              const draftSnap = acquisitionSnapshot(parsed?.form || null, Number(parsed?.step) || nextStep);
              if (!parsed?.form || draftSnap === savedSnapshotRef.current) {
                await AsyncStorage.removeItem(DRAFT_KEY);
              } else {
                Alert.alert(
                  'Niezapisany szkic pozyskania',
                  'Wykryto zmiany, które mogły nie zdążyć zapisać się na serwerze. Czy chcesz je przywrócić?',
                  [
                    {
                      text: 'Odrzuć',
                      style: 'destructive',
                      onPress: () => void AsyncStorage.removeItem(DRAFT_KEY),
                    },
                    {
                      text: 'Przywróć',
                      onPress: () => {
                        setForm(parsed.form);
                        if (parsed.step) setStep(Number(parsed.step) || nextStep);
                      },
                    },
                  ],
                );
              }
            }
          } catch {
            /* ignore corrupt draft */
          }
        } else {
          void AsyncStorage.removeItem(DRAFT_KEY);
        }
        hydratedRef.current = true;
      }
    }
  }, [token, clientId]);

  useEffect(() => {
    hydratedRef.current = false;
    draftPromptedRef.current = false;
    savedSnapshotRef.current = '';
    void load();
  }, [load]);

  useEffect(() => {
    setForm((current) => {
      if (!current) return current;
      const roomsJson = JSON.stringify(rooms);
      const wholeScanJson = wholePropertyScan ? JSON.stringify(wholePropertyScan) : '';
      const planJoined = planImages.join(',');
      const measuredArea = livableAreaFromRooms(rooms);
      const listingRooms = listingRoomCountFromRooms(rooms);
      const property = (current.property || {}) as Record<string, unknown>;
      if (
        String(property.roomsJson || '') === roomsJson &&
        String(property.wholeScanJson || '') === wholeScanJson &&
        String(property.planImages || '') === planJoined &&
        (!measuredArea || String(property.area || '') === measuredArea.toFixed(1)) &&
        (!listingRooms || String(property.rooms || '') === String(listingRooms))
      ) {
        return current;
      }
      return setSection(current, 'property', {
        roomsJson,
        wholeScanJson,
        planImages: planJoined,
        ...(measuredArea ? { area: measuredArea.toFixed(1) } : {}),
        ...(listingRooms ? { rooms: String(listingRooms) } : {}),
      });
    });
  }, [rooms, wholePropertyScan, planImages]);

  const signed = record?.status === 'SIGNED';
  signedRef.current = signed;
  const offerUiStatus = resolveOfficeOfferUiStatus(linkedOffer);
  const canSubmitLinkedOffer = canSubmitOfferForOfficeActivation(linkedOffer);
  const clientKwNumbers = useMemo(() => {
    const seen = new Set<string>();
    const rows: { kw: string; verified: boolean }[] = [];
    const push = (raw: unknown, verified: boolean) => {
      const kw = String(raw || '').trim().toUpperCase();
      if (!kw || !LAND_REGISTRY_REGEX.test(kw) || seen.has(kw)) return;
      seen.add(kw);
      rows.push({ kw, verified });
    };
    const fromAcquisition = LAND_REGISTRY_REGEX.test(
      String(form?.ownership?.landRegisterNumber || '').trim().toUpperCase(),
    );
    const offerVerified =
      linkedOffer?.isLegalSafeVerified === true ||
      String(linkedOffer?.legalCheckStatus || '').toUpperCase() === 'VERIFIED';
    push(form?.ownership?.landRegisterNumber, fromAcquisition || offerVerified);
    push(linkedOffer?.landRegistryNumber, fromAcquisition || offerVerified);
    return rows;
  }, [form?.ownership?.landRegisterNumber, linkedOffer]);

  const submitLinkedOfferActivation = async () => {
    if (!token || !linkedOffer?.id) return;
    setOfferActionBusy(true);
    try {
      const res = await postOfficeReviewAction(token, { action: 'submit', offerId: linkedOffer.id });
      if (!res.ok) {
        Alert.alert('Aktywacja oferty', res.message || 'Nie udało się wysłać oferty do aktywacji.');
        return;
      }
      const acq = await fetchAcquisition(token, clientId);
      if (acq.ok) {
        setLinkedOffer(
          acq.linkedOffer ??
            (acq.linkedOfferId ? { id: acq.linkedOfferId } : linkedOffer ? { ...linkedOffer } : null),
        );
      }
      await load();
      Alert.alert(
        'Aktywacja oferty',
        canManageOfficeOffers
          ? 'Oferta została aktywowana.'
          : 'Oferta trafiła do kolejki akceptacji kierownika biura.',
      );
    } finally {
      setOfferActionBusy(false);
    }
  };

  const planUploadInFlight = useRef(false);
  useEffect(() => {
    if (!token || signed || planUploadInFlight.current) return;
    const locals = planImages
      .map((uri, index) => ({ uri, index }))
      .filter(({ uri }) => uri && !uri.startsWith('http') && !uri.startsWith('/'));
    if (!locals.length) return;
    planUploadInFlight.current = true;
    let cancelled = false;
    void (async () => {
      const next = [...planImages];
      for (const item of locals) {
        const res = await uploadAcquisitionPaper(
          token,
          clientId,
          { uri: item.uri, name: `rzut-${Date.now()}-${item.index}.jpg`, mimeType: 'image/jpeg' },
          'plan',
        );
        if (cancelled) return;
        if (res.ok && res.file?.url) {
          const remoteUrl = res.file.url.startsWith('http') ? res.file.url : `https://estateos.pl${res.file.url}`;
          next[item.index] = remoteUrl;
          setWholePropertyScan((current) =>
            current?.floorPlanPngUri === item.uri
              ? { ...current, floorPlanPngUri: remoteUrl }
              : current,
          );
        }
      }
      if (!cancelled) setPlanImages(next);
      planUploadInFlight.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [planImages, token, clientId, signed]);

  const scanAssetUploadInFlight = useRef(false);
  useEffect(() => {
    if (!token || signed || scanAssetUploadInFlight.current) return;
    const isLocal = (uri?: string) =>
      Boolean(uri && !uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('/'));
    const hasLocalRoomAsset = rooms.some(
      (room) => isLocal(room.floorPlanPngUri) || isLocal(room.floorPlan3dUri),
    );
    const hasLocalWholeModel = isLocal(wholePropertyScan?.floorPlan3dUri);
    if (!hasLocalRoomAsset && !hasLocalWholeModel) return;

    let cancelled = false;
    scanAssetUploadInFlight.current = true;
    void (async () => {
      const uploadAsset = async (uri: string, name: string, mimeType: string) => {
        const result = await uploadAcquisitionPaper(
          token,
          clientId,
          { uri, name, mimeType },
          'asset',
        );
        if (!result.ok || !result.file?.url) {
          throw new Error(result.ok ? 'Brak adresu zapisanego skanu.' : result.message);
        }
        return result.file.url.startsWith('http')
          ? result.file.url
          : `https://estateos.pl${result.file.url}`;
      };

      try {
        const uploadedRooms: RoomItem[] = [];
        for (const room of rooms) {
          let floorPlanPngUri = room.floorPlanPngUri;
          let floorPlan3dUri = room.floorPlan3dUri;
          if (isLocal(floorPlanPngUri)) {
            floorPlanPngUri = await uploadAsset(
              floorPlanPngUri!,
              `${room.id}-plan.png`,
              'image/png',
            );
          }
          if (isLocal(floorPlan3dUri)) {
            floorPlan3dUri = await uploadAsset(
              floorPlan3dUri!,
              `${room.id}-3d.usdz`,
              'model/vnd.usdz+zip',
            );
          }
          uploadedRooms.push({ ...room, floorPlanPngUri, floorPlan3dUri });
        }
        if (!cancelled) setRooms(uploadedRooms);

        if (wholePropertyScan && isLocal(wholePropertyScan.floorPlan3dUri)) {
          const floorPlan3dUri = await uploadAsset(
            wholePropertyScan.floorPlan3dUri,
            `whole-property-${clientId}.usdz`,
            'model/vnd.usdz+zip',
          );
          if (!cancelled) {
            setWholePropertyScan((current) => (current ? { ...current, floorPlan3dUri } : current));
          }
        }
      } catch (uploadError) {
        if (!cancelled) {
          Alert.alert(
            'Zapis skanu LiDAR',
            uploadError instanceof Error ? uploadError.message : 'Nie udało się zapisać planu.',
          );
        }
      } finally {
        scanAssetUploadInFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, rooms, signed, token, wholePropertyScan]);

  const expectedPrice = parseGroupedNumber(String(form?.strategy?.expectedPrice ?? ''));
  const commissionValue = parseGroupedNumber(String(form?.cooperation?.commissionValue ?? '')) || 2.5;

  const persist = async (nextStep = stepRef.current, opts?: { silent?: boolean }): Promise<boolean> => {
    const silent = Boolean(opts?.silent);
    const currentForm = formRef.current;
    if (!token || !currentForm || signedRef.current) return true;
    while (persistInFlightRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    persistInFlightRef.current = true;
    if (!silent) setBusy('save');
    try {
      const res = await saveAcquisition(token, clientId, {
        formData: currentForm,
        currentStep: nextStep,
        status: 'IN_MEETING',
      });
      if (!res.ok) {
        if (!silent) Alert.alert('Pozyskanie', res.message);
        return false;
      }
      savedSnapshotRef.current = acquisitionSnapshot(currentForm, nextStep);
      await AsyncStorage.removeItem(DRAFT_KEY);
      setRecord(res.acquisition);
      if (nextStep !== stepRef.current) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setStep(nextStep);
      }
      return true;
    } finally {
      persistInFlightRef.current = false;
      if (!silent) setBusy('');
    }
  };

  useEffect(() => {
    if (!hydratedRef.current || !form || signed) return;
    const snap = acquisitionSnapshot(form, step);
    if (snap === savedSnapshotRef.current) {
      void AsyncStorage.removeItem(DRAFT_KEY);
      return;
    }
    void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
    const t = setTimeout(() => {
      void persist(step, { silent: true });
    }, 900);
    return () => clearTimeout(t);
  }, [form, step, signed]);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', () => {
      if (signed || !hydratedRef.current || !formRef.current) return;
      const snap = acquisitionSnapshot(formRef.current, stepRef.current);
      if (snap !== savedSnapshotRef.current) {
        void persist(stepRef.current, { silent: true });
      }
    });
    return sub;
  }, [navigation, signed]);

  const areaNum = parseGroupedNumber(form?.property?.area) || 0;
  const latNum = Number(String(form?.property?.lat || '').replace(',', '.'));
  const lngNum = Number(String(form?.property?.lng || '').replace(',', '.'));
  const roomsNum = parseGroupedNumber(form?.property?.rooms);
  const floorNum = parseGroupedNumber(form?.property?.floor);
  const offerGaps = findAcquisitionOfferGaps(form);
  const errorKeys = showOfferErrors ? acquisitionOfferErrorKeys(offerGaps) : new Set<string>();
  const errorSteps = showOfferErrors ? acquisitionOfferErrorSteps(offerGaps) : [];

  const goToStep = (next: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
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
    savedSnapshotRef.current = acquisitionSnapshot(form, 6);
    if (name === 'sign') {
      signedRef.current = true;
      await AsyncStorage.removeItem(DRAFT_KEY);
      if (res.offerId) {
        Alert.alert('Oferta pozyskana', `Umowa zamknięta. Szkic oferty #${res.offerId} nie jest publiczny — klient zobaczy go w panelu.`);
      } else if (res.offerError) {
        Alert.alert(
          'Oferta pozyskana',
          `Umowa zamknięta. Szkicu nie utworzono automatycznie: ${res.offerError}.`,
        );
      }
    } else if (name === 'prepare_terms') {
      Alert.alert(
        'Warunki gotowe',
        'Sprawdź podgląd poniżej. Dopiero potem wyślij klientowi — dostanie link do dokumentu w przeglądarce, nie załącznik HTML.',
      );
    } else if (name === 'send_preview') {
      Alert.alert(
        'Podgląd wysłany',
        res.emailSent
          ? 'Klient dostał e-mail z linkiem do dokumentu i panelu — bez załącznika HTML.'
          : 'Warunki zapisane. Jeśli klient ma e-mail, wyślij wizytówkę z panelu.',
      );
    }
    setRecord(res.acquisition);
    setStep(name === 'sign' ? 7 : 6);
  };

  const field = (
    section: keyof AcquisitionFormData,
    key: string,
    label: string,
    extra?: { address?: boolean; isDate?: boolean; isKW?: boolean }
  ) => {
    const value = String((form?.[section] as Record<string, unknown>)?.[key] || '');
    const invalid = errorKeys.has(`${section}.${key}`);
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: invalid ? ERROR_RED : colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text>
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
            style={[
              styles.input,
              {
                flex: 1,
                backgroundColor: colors.input,
                color: colors.text,
                borderColor: invalid ? ERROR_RED : colors.border,
              },
            ]}
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
    const invalid = errorKeys.has(`${section}.${key}`);
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: invalid ? ERROR_RED : colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text>
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
            style={[styles.stepBtn, { borderColor: invalid ? ERROR_RED : colors.border }]}
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
              {
                flex: 1,
                backgroundColor: colors.input,
                color: colors.text,
                borderColor: invalid ? ERROR_RED : colors.border,
                textAlign: 'center',
              },
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
  const pendingMatches = matches
    .filter((item) => !item.notifiedAt && !item.sharedAt)
    .sort((a, b) => b.score - a.score);
  const sentMatches = matches
    .filter((item) => Boolean(item.notifiedAt || item.sharedAt))
    .sort((a, b) => b.score - a.score);
  const showRadarSurvey = Boolean(client && (client.type === 'BUYER' || sellerRadarSearching));
  const portalMessages = client?.messages || [];
  const latestPortalMessage = portalMessages[portalMessages.length - 1];
  const latestPortalText = latestPortalMessage
    ? cleanAttachmentOnlyMessage(latestPortalMessage.content, latestPortalMessage.attachments)
    : '';
  const chatSummary = latestPortalMessage
    ? `Ostatnia: ${latestPortalText || portalAttachmentSummary(latestPortalMessage.attachments?.[0])}`
    : 'Brak wiadomości — napisz pierwszy';
  const radarSummary = [
    buyerFilters.city || null,
    buyerFilters.selectedDistricts.length
      ? `${buyerFilters.selectedDistricts.length} ${buyerFilters.selectedDistricts.length === 1 ? 'dzielnica' : 'dzielnice'}`
      : null,
    `${buyerFilters.matchThreshold}% próg`,
    pendingMatches.length ? `${pendingMatches.length} do wysłania` : 'brak nowych',
    sentMatches.length ? `${sentMatches.length} wysłanych` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const reactedMatches = sentMatches.filter((item) => Boolean(formatClientFeedbackForAgent(item.clientFeedback)));
  const presentationStatusLabel = client?.presentation
    ? client.presentation.status === 'pending'
      ? 'oczekuje na potwierdzenie'
      : 'potwierdzona'
    : 'brak terminu';
  const meetingStatusLabel = client?.meeting
    ? client.meeting.status === 'pending'
      ? 'spotkanie oczekuje'
      : 'spotkanie potwierdzone'
    : null;
  const presentationSummary = [
    `${sentMatches.length} wysłanych`,
    `${reactedMatches.length} z opinią`,
    pendingMatches.length ? `${pendingMatches.length} do wysłania` : null,
    `Prezentacja: ${presentationStatusLabel}`,
    meetingStatusLabel,
  ]
    .filter(Boolean)
    .join(' · ');
  const clientInitials = `${(client?.firstName || '').trim().charAt(0)}${(client?.lastName || '').trim().charAt(0)}`.toUpperCase() || 'K';

  const saveBuyerRadar = async (enabled: boolean, filters = buyerFilters) => {
    if (!token) return false;
    if (enabled && !clientRadarSurveyReady(filters)) {
      Alert.alert('Ankieta radaru', clientRadarSurveyHint(filters) || 'Uzupełnij parametry poszukiwań.');
      return false;
    }
    setBusy('save_radar');
    const res = await patchAgencyClient(token, clientId, {
      alsoSearching: enabled,
      buyerFilters: enabled ? { ...filters, pushNotifications: false } : null,
      intelligence: { lockedFields: intelLocks },
    });
    if (res.ok && enabled) {
      await refreshClientMatches(token, clientId);
    }
    setBusy('');
    if (!res.ok) {
      Alert.alert('Radar', res.message);
      return false;
    }
    void load();
    return true;
  };

  const saveIntelligence = async (next: typeof DEFAULT_INTELLIGENCE_SETTINGS) => {
    if (!token) return;
    setBusy('intel');
    const res = await patchAgencyClient(token, clientId, {
      alsoSearching: true,
      buyerFilters: { ...buyerFilters, pushNotifications: false },
      intelligence: { ...next, lockedFields: { ...intelLocks, maxPrice: true } },
    });
    if (res.ok) setIntelLocks((current) => ({ ...current, maxPrice: true }));
    setBusy('');
    if (!res.ok) Alert.alert('Asystent', res.message);
    else void load();
  };

  const sendMatches = async (offerIds: number[], allowResend = false) => {
    if (!token || !offerIds.length) return;
    setBusy(`prop_${offerIds[0]}`);
    const res = await proposeClientOffers(token, clientId, offerIds, { allowResend });
    setBusy('');
    if (!res.ok) {
      Alert.alert('Wysyłka', res.message);
      return;
    }
    Alert.alert(
      'Wysyłka',
      offerIds.length > 1
        ? `Wysłano ${offerIds.length} ofert do panelu klienta${client?.email ? ' i na e-mail' : ''}.`
        : `Oferta jest w panelu klienta${client?.email ? ' i poszła na e-mail' : ''}.`,
    );
    void load();
  };

  const runNextStep = () => {
    if (!client?.nextStep) return;
    const action = client.nextStep.action;
    if (action === 'send_offers') {
      const ids = pendingMatches.map((item) => item.offer.id);
      if (ids.length) void sendMatches(ids);
      else void refreshMatchesAndReload();
      return;
    }
    if (action === 'refresh_matches') {
      void refreshMatchesAndReload();
      return;
    }
    if (action === 'open_portal' || action === 'collect_feedback' || action === 'watch_listing') {
      if (client.portalUrl) {
        Linking.openURL(client.portalUrl.startsWith('http') ? client.portalUrl : `https://estateos.pl${client.portalUrl}`);
      }
      return;
    }
    if (action === 'propose_presentation') {
      Alert.alert('Prezentacja', 'Wybierz ofertę z listy poniżej i zaproponuj termin.');
      return;
    }
    if (action === 'accept_schedule') {
      Alert.alert('Termin', 'Sprawdź sekcję spotkania poniżej i zaakceptuj propozycję klienta.');
      return;
    }
    if (action === 'finish_acquisition' || action === 'create_offer') {
      Alert.alert('Pozyskanie', 'Kontynuuj przewodnik pozyskania poniżej.');
      return;
    }
    if (action === 'set_criteria' || action === 'verify_contact') {
      Alert.alert('Klient', client.nextStep.hint);
    }
  };

  const refreshMatchesAndReload = async () => {
    if (!token) return;
    setBusy('refresh');
    const res = await refreshClientMatches(token, clientId);
    setBusy('');
    if (!res.ok) Alert.alert('Radar', res.message);
    else void load();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Date Picker Modal */}
      <AcquisitionDatePickerModal
        visible={Boolean(dateModalField)}
        isDark={isDark}
        mode={dateModalField === 'targetTimeline' ? 'timeline' : 'meeting'}
        title={
          dateModalField === 'targetTimeline'
            ? 'Horyzont sprzedaży'
            : dateModalField === 'presentation'
              ? 'Termin prezentacji'
              : 'Termin'
        }
        initialValue={
          dateModalField === 'presentation'
            ? presentationAt
            : dateModalField && form
              ? String((form.meeting as Record<string, string>)[dateModalField] || '')
              : ''
        }
        onClose={() => setDateModalField(null)}
        onSelect={(formattedDate) => {
          if (dateModalField === 'presentation') {
            setPresentationAt(formattedDate);
            return;
          }
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
          scrollEnabled={!isSigning && !chatFocused}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 240 }}
        >
          {!client ? (
            <ActivityIndicator color="#34C759" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Client Info Banner */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border, overflow: 'hidden', padding: 0 },
                ]}
              >
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(52,199,89,0.22)', 'rgba(52,199,89,0.06)', colors.card]
                      : ['rgba(52,199,89,0.18)', 'rgba(52,199,89,0.05)', '#FFFFFF']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 16 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(52,199,89,0.2)',
                        borderWidth: 1,
                        borderColor: 'rgba(52,199,89,0.35)',
                      }}
                    >
                      <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '900', letterSpacing: 0.4 }}>
                        {clientInitials}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 999,
                            backgroundColor: 'rgba(52,199,89,0.16)',
                          }}
                        >
                          <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>
                            {client.type === 'SELLER' ? 'SPRZEDAJĄCY' : 'KUPUJĄCY'}
                          </Text>
                        </View>
                        {client.portalUrl ? (
                          <Pressable
                            onPress={() =>
                              Linking.openURL(
                                client.portalUrl!.startsWith('http')
                                  ? client.portalUrl!
                                  : `https://estateos.pl${client.portalUrl}`
                              )
                            }
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 999,
                              backgroundColor: colors.card,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Ionicons name="open-outline" size={13} color="#007AFF" />
                            <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 11 }}>Panel</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 6 }} numberOfLines={1}>
                        {client.firstName} {client.lastName}
                      </Text>
                      <View style={{ marginTop: 8, gap: 6 }}>
                        {client.phone ? (
                          <Pressable
                            onPress={() => Linking.openURL(`tel:${client.phone}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                          >
                            <Ionicons name="call-outline" size={14} color={colors.secondary} />
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                              {formatPhoneNumber(client.phone)}
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => (client.email ? Linking.openURL(`mailto:${client.email}`) : undefined)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                          <Ionicons name="mail-outline" size={14} color={colors.secondary} />
                          <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                            {client.email || 'Brak e-maila'}
                          </Text>
                        </Pressable>
                        {client.pesel ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="card-outline" size={14} color={colors.secondary} />
                            <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }}>
                              PESEL {client.pesel}
                            </Text>
                          </View>
                        ) : null}
                        {clientKwNumbers.map((item) => (
                          <Pressable
                            key={item.kw}
                            onPress={() => setEkwViewerKw(item.kw)}
                            hitSlop={8}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                          >
                            <Ionicons
                              name={item.verified ? 'shield-checkmark' : 'document-text-outline'}
                              size={14}
                              color={item.verified ? '#34C759' : colors.secondary}
                            />
                            <Text
                              style={{
                                color: item.verified ? colors.text : colors.secondary,
                                fontSize: 13,
                                fontWeight: '700',
                                fontVariant: ['tabular-nums'],
                              }}
                            >
                              KW {item.kw}
                            </Text>
                            <Ionicons name="open-outline" size={13} color="#007AFF" />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>WYSŁANE</Text>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{sentMatches.length}</Text>
                    </View>
                    <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>Z OPINIĄ</Text>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{reactedMatches.length}</Text>
                    </View>
                    <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>CZAT</Text>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{portalMessages.length}</Text>
                    </View>
                  </View>

                  {client.nextStep ? (
                    <Pressable onPress={runNextStep} style={[styles.primary, { marginTop: 14, minHeight: 52, height: undefined, paddingVertical: 10 }]}>
                      <Text style={styles.primaryText}>{client.nextStep.label}</Text>
                      <Text style={{ color: '#052e16', fontSize: 11, marginTop: 3, opacity: 0.8, textAlign: 'center' }} numberOfLines={2}>
                        {client.nextStep.hint}
                      </Text>
                    </Pressable>
                  ) : null}
                </LinearGradient>
              </View>

              {/* Acquisition Card (For Sellers) */}
              {client.type === 'SELLER' && form ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' }}>
                    PRZEWODNIK POZYSKANIA
                  </Text>

                  <AcquisitionStepIndicator
                    steps={STEPS}
                    currentStep={step}
                    errorSteps={errorSteps}
                    onSelectStep={goToStep}
                    isDark={isDark}
                    locked={signed}
                  />

                  <AcquisitionGuideChrome step={step} hasError={errorSteps.includes(step)} isDark={isDark} />

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
                      {String(form.property.propertyType || 'Mieszkanie') === 'Mieszkanie' ||
                      String(form.property.propertyType || '') === 'FLAT' ? (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                            NUMER MIESZKANIA (CRM)
                          </Text>
                          <TextInput
                            editable={!signed}
                            value={String(form.property.apartmentNumber || '')}
                            onChangeText={(next) =>
                              setForm((c) => (c ? setSection(c, 'property', { apartmentNumber: next.slice(0, 32) }) : c))
                            }
                            placeholder="np. 12"
                            placeholderTextColor={colors.secondary}
                            style={{
                              marginTop: 4,
                              backgroundColor: colors.input,
                              color: colors.text,
                              borderColor: colors.border,
                              borderWidth: 1,
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              fontSize: 15,
                            }}
                          />
                          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6, lineHeight: 15 }}>
                            Tylko agent i klient — nie publikujemy na ogłoszeniu.
                          </Text>
                        </View>
                      ) : null}

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
                      {field('ownership', 'ownershipBasis', 'PODSTAWA NABYCIA / AKT NOTARIALNY')}
                      <MultiSelectChipGroup
                        label="STAN CYWILNY / ZGODA MAŁŻONKA"
                        options={['Kawaler / panna', 'Żonaty / zamężna', 'Wymagana zgoda małżonka', 'Rozdzielność majątkowa']}
                        selected={((form.ownership.maritalStatus as string) || '').split(',').map((s) => s.trim())}
                        onToggle={(opt) => toggleChipSelection('ownership', 'maritalStatus', opt)}
                        isDark={isDark}
                        disabled={signed}
                      />
                      <MultiSelectChipGroup
                        label="KTO KORZYSTA Z LOKALU"
                        options={['Wolny', 'Zamieszkany przez właściciela', 'Najemca', 'Wymagane opróżnienie']}
                        selected={((form.ownership.occupancy as string) || '').split(',').map((s) => s.trim())}
                        onToggle={(opt) => toggleChipSelection('ownership', 'occupancy', opt)}
                        isDark={isDark}
                        disabled={signed}
                      />
                      {field('ownership', 'legalNotes', 'UWAGI PRAWNE')}
                    </>
                  ) : null}

                  {/* Step 3: Nieruchomość */}
                  {step === 3 ? (
                    <>
                      <SellerPropertyTypePicker
                        value={String(form.property.propertyType || 'Mieszkanie')}
                        onChange={(id: SellerPropertyTypeId) =>
                          setForm((current) =>
                            current
                              ? setSection(current, 'property', {
                                  propertyType: sellerPropertyTypeLabel(id),
                                  apartmentNumber: id === 'FLAT' ? String(current.property.apartmentNumber || '') : '',
                                })
                              : current,
                          )
                        }
                        isDark={isDark}
                        disabled={signed}
                      />
                      {sellerPropertyTypeLabel(form.property.propertyType) === 'Mieszkanie' ? (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                            NUMER MIESZKANIA (CRM)
                          </Text>
                          <TextInput
                            editable={!signed}
                            value={String(form.property.apartmentNumber || '')}
                            onChangeText={(next) =>
                              setForm((c) => (c ? setSection(c, 'property', { apartmentNumber: next.slice(0, 32) }) : c))
                            }
                            placeholder="np. 12"
                            placeholderTextColor={colors.secondary}
                            style={{
                              marginTop: 4,
                              backgroundColor: colors.input,
                              color: colors.text,
                              borderColor: colors.border,
                              borderWidth: 1,
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              fontSize: 15,
                            }}
                          />
                          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 6, lineHeight: 15 }}>
                            Widoczny tylko dla prowadzącego agenta i klienta — nie trafia na ogłoszenie.
                          </Text>
                        </View>
                      ) : null}
                      <AcquisitionAddressMapField
                        token={token}
                        value={{
                          address: String(form.property.address || ''),
                          city: String((form.property as Record<string, string>).city || client?.sellerCity || ''),
                          district: String((form.property as Record<string, string>).district || client?.sellerDistrict || ''),
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
                                  district: next.district || '',
                                  lat: next.lat != null ? String(next.lat) : '',
                                  lng: next.lng != null ? String(next.lng) : '',
                                })
                              : current
                          )
                        }
                        isDark={isDark}
                        disabled={signed}
                        errorKeys={errorKeys}
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
                          invalid={errorKeys.has('property.rooms')}
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
                          invalid={errorKeys.has('property.area')}
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

                      <MultiSelectChipGroup
                        label="PRZYLEGŁOŚCI I DODATKI"
                        options={['Garaż', 'Miejsce postojowe', 'Komórka lokatorska', 'Piwnica', 'Balkon', 'Taras', 'Ogródek', 'Winda']}
                        selected={String(form.property.amenities || '').split(',').map((s) => s.trim()).filter(Boolean)}
                        onToggle={(opt) => toggleChipSelection('property', 'amenities', opt)}
                        isDark={isDark}
                        disabled={signed}
                      />
                      {field('property', 'parking', 'GARAŻ / MIEJSCE — numer, piętro, dokument')}
                      {field('property', 'storage', 'KOMÓRKA / PIWNICA — numer, powierzchnia')}

                      <AcquisitionRoomScanner
                        rooms={rooms}
                        planImages={planImages}
                        onChangeRooms={setRooms}
                        onChangePlanImages={setPlanImages}
                        wholeScan={wholePropertyScan}
                        onChangeWholeScan={setWholePropertyScan}
                        isDark={isDark}
                        disabled={signed}
                        autoOpen={step === 3}
                      />
                    </>
                  ) : null}

                  {/* Step 4: Strategia */}
                  {step === 4 ? (
                    <>
                      <MarketValuationCard
                        token={token}
                        lat={Number.isFinite(latNum) ? latNum : null}
                        lng={Number.isFinite(lngNum) ? lngNum : null}
                        area={areaNum || null}
                        rooms={roomsNum || null}
                        floor={floorNum}
                        city={form?.property?.city || client?.sellerCity || 'Warszawa'}
                        district={String(form?.property?.district || client?.sellerDistrict || '')}
                        address={form?.property?.address}
                        listingPrice={parseGroupedNumber(String(form?.strategy?.expectedPrice ?? ''))}
                        purpose="crm"
                        colors={colors}
                        reportEmail={client?.email}
                        clientId={client?.id}
                        onApply={
                          signed
                            ? undefined
                            : (price) =>
                                setForm((c) =>
                                  c
                                    ? setSection(c, 'strategy', {
                                        expectedPrice: formatPriceInput(String(price)),
                                        recommendedPrice: formatPriceInput(String(price)),
                                      })
                                    : c,
                                )
                        }
                      />

                      {stepper('strategy', 'expectedPrice', 'CENA OCZEKIWANA (zł)', 5000, true)}
                      {stepper('strategy', 'recommendedPrice', 'CENA REKOMENDOWANA (zł)', 5000, true)}
                      {stepper('strategy', 'minimumPrice', 'DOLNA GRANICA AKCEPTACJI (zł)', 5000, true)}
                      {field('strategy', 'presentationRules', 'ZASADY PREZENTACJI I DOSTĘPNOŚĆ')}
                      {(
                        [
                          ['photoConsent', 'Zgoda na sesję zdjęciową'],
                          ['marketingConsent', 'Zgoda na marketing oferty'],
                          ['portalConsent', 'Publikacja w portalach'],
                          ['socialMediaConsent', 'Media społecznościowe'],
                          ['keysHandover', 'Klucze przekazane agentowi'],
                        ] as const
                      ).map(([key, label]) => {
                        const checked = Boolean(form.strategy[key]);
                        return (
                          <Pressable
                            key={key}
                            disabled={signed}
                            onPress={() =>
                              setForm((current) =>
                                current ? setSection(current, 'strategy', { [key]: !checked }) : current,
                              )
                            }
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}
                          >
                            <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} />
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </>
                  ) : null}

                  {/* Step 5: Współpraca */}
                  {step === 5 ? (
                    <>
                      <MultiSelectChipGroup
                        label="RODZAJ UMOWY"
                        options={['Na wyłączność', 'Otwarta']}
                        selected={[form.cooperation.agreementType === 'OPEN' ? 'Otwarta' : 'Na wyłączność']}
                        onToggle={(opt) =>
                          setForm((current) =>
                            current
                              ? setSection(current, 'cooperation', {
                                  agreementType: opt === 'Otwarta' ? 'OPEN' : 'EXCLUSIVE',
                                  durationMonths:
                                    opt === 'Otwarta'
                                      ? '0'
                                      : Number(current.cooperation.durationMonths) > 0
                                        ? String(current.cooperation.durationMonths)
                                        : '6',
                                })
                              : current,
                          )
                        }
                        isDark={isDark}
                        disabled={signed}
                      />
                      {form.cooperation.agreementType === 'OPEN' || Number(form.cooperation.durationMonths) <= 0 ? (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>
                            OKRES UMOWY
                          </Text>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 6 }}>
                            Czas nieokreślony
                          </Text>
                        </View>
                      ) : (
                        stepper('cooperation', 'durationMonths', 'OKRES UMOWY (MIESIĄCE)')
                      )}
                      {stepper('cooperation', 'noticeDays', 'WYPOWIEDZENIE (DNI)')}
                      <Pressable
                        disabled={signed}
                        onPress={() =>
                          setForm((current) =>
                            current
                              ? setSection(current, 'cooperation', {
                                  commissionVatIncluded: !current.cooperation.commissionVatIncluded,
                                })
                              : current,
                          )
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}
                      >
                        <Ionicons
                          name={form.cooperation.commissionVatIncluded ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={colors.accent}
                        />
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
                          Prowizja zawiera VAT
                        </Text>
                      </Pressable>
                      <CommissionRateSlider
                        value={commissionValue}
                        onChange={(value) =>
                          setForm((current) =>
                            current
                              ? setSection(current, 'cooperation', {
                                  commissionValue: storeCommissionPercent(value),
                                  commissionType: 'PERCENT',
                                })
                              : current
                          )
                        }
                        offerPrice={expectedPrice}
                        isDark={isDark}
                      />
                      {field('cooperation', 'agentObligations', 'OBOWIĄZKI AGENTA')}
                      {field('cooperation', 'clientObligations', 'OBOWIĄZKI KLIENTA')}
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
                        <Text style={styles.primaryText}>{busy === 'prepare_terms' ? 'Przygotowuję…' : record?.agreementSnapshot ? 'Odśwież warunki' : 'Przygotuj warunki'}</Text>
                      </Pressable>
                      {record?.agreementSnapshot ? (
                        <View
                          style={{
                            marginTop: 12,
                            maxHeight: 360,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 16,
                            backgroundColor: colors.card,
                            padding: 14,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, marginBottom: 8 }}>
                            Podgląd warunków — sprawdź przed wysłaniem
                          </Text>
                          <ScrollView nestedScrollEnabled>
                            <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
                              {record.agreementSnapshot}
                            </Text>
                          </ScrollView>
                        </View>
                      ) : null}
                      <Pressable
                        disabled={signed || Boolean(busy) || !record?.agreementSnapshot}
                        onPress={() => void runAction('send_preview')}
                        style={[styles.secondary, { borderColor: colors.border, marginTop: 10, opacity: record?.agreementSnapshot ? 1 : 0.5 }]}
                      >
                        <Text style={{ color: colors.text, fontWeight: '800' }}>
                          {busy === 'send_preview' ? 'Wysyłam…' : 'Wyślij podgląd do klienta'}
                        </Text>
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

                  {step === 7 ? (
                    <View style={{ marginTop: 8, padding: 16, borderRadius: 16, backgroundColor: 'rgba(52,199,89,0.12)' }}>
                      <Text style={{ color: '#34C759', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>OFERTA POZYSKANA</Text>
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 6 }}>Umowa zamknięta</Text>
                      <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
                        Kopia poszła do klienta. Od tej pory nic w umowie nie zmieniasz — tylko podgląd. Szkic ogłoszenia nie jest publiczny, dopóki go nie opublikujesz.
                      </Text>
                      {linkedOffer ? (
                        <View
                          style={{
                            marginTop: 14,
                            padding: 14,
                            borderRadius: 14,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>
                              {linkedOffer.title?.trim() || `Szkic oferty #${linkedOffer.id}`}
                            </Text>
                            <Text
                              style={{
                                color: officeOfferStatusColor(offerUiStatus.key, isDark),
                                fontSize: 10,
                                fontWeight: '900',
                                letterSpacing: 0.6,
                                textTransform: 'uppercase',
                              }}
                            >
                              {offerUiStatus.label}
                            </Text>
                          </View>
                          {linkedOffer.landRegistryNumber ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                              <Ionicons
                                name={
                                  linkedOffer.isLegalSafeVerified ||
                                  String(linkedOffer.legalCheckStatus || '').toUpperCase() === 'VERIFIED'
                                    ? 'shield-checkmark'
                                    : 'document-text-outline'
                                }
                                size={14}
                                color={
                                  linkedOffer.isLegalSafeVerified ||
                                  String(linkedOffer.legalCheckStatus || '').toUpperCase() === 'VERIFIED'
                                    ? '#34C759'
                                    : colors.secondary
                                }
                              />
                              <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                                KW {linkedOffer.landRegistryNumber}
                              </Text>
                            </View>
                          ) : null}
                          {canSubmitLinkedOffer ? (
                            <Pressable
                              disabled={offerActionBusy}
                              onPress={() => void submitLinkedOfferActivation()}
                              style={[
                                styles.primary,
                                { marginTop: 12, opacity: offerActionBusy ? 0.6 : 1 },
                              ]}
                            >
                              <Text style={styles.primaryText}>
                                {offerActionBusy
                                  ? 'Przetwarzam…'
                                  : canManageOfficeOffers
                                    ? 'Aktywuj ofertę'
                                    : 'Wyślij do aktywacji'}
                              </Text>
                            </Pressable>
                          ) : offerUiStatus.key === 'review' ? (
                            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
                              {canManageOfficeOffers
                                ? 'Oferta czeka w kolejce biura — możesz ją zaakceptować w ekranie Biuro.'
                                : 'Oferta czeka na akceptację kierownika biura.'}
                            </Text>
                          ) : offerUiStatus.key === 'active' ? (
                            <Pressable
                              onPress={() => navigation.navigate('OfferDetail', { offerId: linkedOffer.id })}
                              style={[styles.secondary, { marginTop: 12, borderColor: colors.border }]}
                            >
                              <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>
                                Otwórz aktywne ogłoszenie
                              </Text>
                            </Pressable>
                          ) : offerUiStatus.key === 'rejected' ? (
                            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
                              Kierownik poprosił o poprawki przed aktywacją. Po korekcie wyślij ponownie.
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {!signed ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      {step > 1 ? (
                        <Pressable
                          onPress={() => goToStep(step - 1)}
                          style={[styles.secondary, { flex: 1, borderColor: colors.border, marginTop: 14 }]}
                        >
                          <Text style={{ color: colors.text, fontWeight: '800' }}>Wstecz</Text>
                        </Pressable>
                      ) : null}
                      {step < 6 ? (
                        <Pressable
                          onPress={() => void persist(step + 1)}
                          style={[styles.primary, { flex: 1, marginTop: 14 }]}
                        >
                          <Text style={styles.primaryText}>{busy === 'save' ? 'Zapisuję…' : 'Dalej'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}


              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border, overflow: 'hidden', padding: 0 },
                ]}
              >
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setPresentationExpanded((current) => !current);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: presentationExpanded }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderBottomWidth: presentationExpanded ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(52,199,89,0.14)',
                    }}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                      {client.type === 'BUYER' ? 'PREZENTACJA' : 'WSPÓŁPRACA'} · {sentMatches.length} WYSŁANYCH
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
                      {client.type === 'BUYER' ? 'Prezentacja oferty' : 'Współpraca z klientem'}
                    </Text>
                    <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '600', marginTop: 3 }} numberOfLines={2}>
                      {presentationSummary}
                    </Text>
                    {!presentationExpanded ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        <View style={[styles.miniStat, { backgroundColor: colors.input, borderColor: colors.border }]}>
                          <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>WYSŁANE</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>{sentMatches.length}</Text>
                        </View>
                        <View style={[styles.miniStat, { backgroundColor: colors.input, borderColor: colors.border }]}>
                          <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>ZROBIONE</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>{reactedMatches.length}</Text>
                        </View>
                        <View style={[styles.miniStat, { backgroundColor: colors.input, borderColor: colors.border }]}>
                          <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>DO WYSŁANIA</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>{pendingMatches.length}</Text>
                        </View>
                        <View style={[styles.miniStat, { backgroundColor: colors.input, borderColor: colors.border }]}>
                          <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '800' }}>TERMIN</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>
                            {client.presentation
                              ? client.presentation.status === 'pending'
                                ? 'Czeka'
                                : 'OK'
                              : 'Brak'}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.input,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name={presentationExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                  </View>
                </Pressable>

                {presentationExpanded ? (
                <View style={{ padding: 16, paddingTop: 12 }}>
                {client.meeting ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>SPOTKANIE</Text>
                    <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>
                      {new Date(client.meeting.startsAt).toLocaleString('pl-PL')}
                    </Text>
                    {client.meeting.location ? (
                      <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 2 }}>{client.meeting.location}</Text>
                    ) : null}
                    <Text style={{ color: client.meeting.status === 'pending' ? '#FF9500' : colors.accent, fontWeight: '800', fontSize: 12, marginTop: 4 }}>
                      {client.meeting.status === 'pending'
                        ? client.meeting.reason
                          ? `Propozycja klienta: ${client.meeting.reason}`
                          : 'Oczekuje na Twoją decyzję'
                        : 'Potwierdzone'}
                    </Text>
                    {client.meeting.status === 'pending' ? (
                      <Pressable
                        onPress={async () => {
                          if (!token) return;
                          setBusy('accept_meeting');
                          const res = await postAgencyClientAction(token, clientId, { action: 'accept_schedule_change', kind: 'meeting' });
                          setBusy('');
                          if (!res.ok) Alert.alert('Termin', res.message);
                          else void load();
                        }}
                        style={[styles.secondary, { borderColor: colors.accent, marginTop: 8 }]}
                      >
                        <Text style={{ color: colors.accent, fontWeight: '800', textAlign: 'center' }}>
                          {busy === 'accept_meeting' ? '…' : 'Akceptuj nowy termin'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {client.type === 'BUYER' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>PREZENTACJA OFERTY</Text>
                  {client.presentation ? (
                    <>
                      <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>
                        {new Date(client.presentation.startsAt).toLocaleString('pl-PL')}
                      </Text>
                      <Text style={{ color: client.presentation.status === 'pending' ? '#FF9500' : colors.accent, fontWeight: '800', fontSize: 12, marginTop: 4 }}>
                        {client.presentation.status === 'pending' ? 'Propozycja wysłana obu stronom' : 'Potwierdzona'}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                      Wybierz ofertę z dopasowań i zaproponuj termin — dostaną go kupujący i sprzedający.
                    </Text>
                  )}
                  {(client.matches || []).length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {[...(client.matches || [])]
                        .sort((a, b) => Number(Boolean(b.notifiedAt)) - Number(Boolean(a.notifiedAt)) || b.score - a.score)
                        .slice(0, 8)
                        .map((m) => {
                          const selected = presentationOfferId === String(m.offer.id);
                          return (
                            <Pressable
                              key={m.id}
                              onPress={() => setPresentationOfferId(String(m.offer.id))}
                              style={{
                                maxWidth: '100%',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: selected ? colors.accent : colors.border,
                                backgroundColor: selected ? 'rgba(52,199,89,0.14)' : colors.input,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                              }}
                            >
                              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }} numberOfLines={1}>
                                #{m.offer.id} · {m.offer.title}
                              </Text>
                              <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 2 }}>
                                {m.notifiedAt ? 'Wysłana' : 'Match'} · {m.score}%
                              </Text>
                            </Pressable>
                          );
                        })}
                    </View>
                  ) : (
                    <TextInput
                      value={presentationOfferId}
                      onChangeText={setPresentationOfferId}
                      keyboardType="number-pad"
                      placeholder="ID oferty do prezentacji"
                      placeholderTextColor={colors.secondary}
                      style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 8 }]}
                    />
                  )}
                  <Pressable
                    onPress={() => setDateModalField('presentation')}
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 8, justifyContent: 'center' }]}
                  >
                    <Text style={{ color: presentationAt ? colors.text : colors.secondary, fontWeight: '700' }}>
                      {presentationAt || 'Wybierz termin prezentacji'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!presentationAt || !presentationOfferId.trim() || busy === 'propose_pres'}
                    onPress={async () => {
                      if (!token || !presentationAt) return;
                      const m = presentationAt.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
                      if (!m) {
                        Alert.alert('Prezentacja', 'Wybierz kompletny termin.');
                        return;
                      }
                      setBusy('propose_pres');
                      const startsAt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
                      const res = await postAgencyClientAction(token, clientId, {
                        action: 'propose_presentation',
                        startsAt,
                        offerId: Number(presentationOfferId),
                      });
                      setBusy('');
                      if (!res.ok) Alert.alert('Prezentacja', res.message);
                      else {
                        setPresentationAt('');
                        void load();
                      }
                    }}
                    style={[styles.primary, { marginTop: 8, opacity: presentationAt && presentationOfferId.trim() ? 1 : 0.5 }]}
                  >
                    <Text style={styles.primaryText}>{busy === 'propose_pres' ? 'Wysyłam…' : 'Zaproponuj termin obu stronom'}</Text>
                  </Pressable>
                </View>
                ) : null}
                </View>
                ) : null}

              </View>

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    overflow: 'hidden',
                    padding: 0,
                  },
                ]}
              >
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setChatExpanded((current) => !current);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: chatExpanded }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 12,
                    borderBottomWidth: chatExpanded ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(52,199,89,0.14)',
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                      LIVE CHAT · {portalMessages.length}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 16, marginTop: 2, fontWeight: '900' }} numberOfLines={1}>
                      {client.firstName} {client.lastName}
                    </Text>
                    <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3, fontWeight: '600' }} numberOfLines={1}>
                      {chatSummary}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.input,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name={chatExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                  </View>
                </Pressable>

                {chatExpanded ? (
                  <>
                  <ScrollView
                  ref={chatScrollRef}
                  nestedScrollEnabled
                  directionalLockEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  bounces={false}
                  style={styles.chatThread}
                  contentContainerStyle={[
                    styles.chatThreadContent,
                    { justifyContent: (client.messages || []).length ? 'flex-start' : 'center' },
                  ]}
                  onTouchStart={() => setChatFocused(true)}
                  onTouchEnd={() => setChatFocused(false)}
                  onTouchCancel={() => setChatFocused(false)}
                  onScrollBeginDrag={() => setChatFocused(true)}
                  onScrollEndDrag={() => setChatFocused(false)}
                  onMomentumScrollEnd={() => setChatFocused(false)}
                  onScroll={(event) => {
                    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                    chatPinnedToEndRef.current =
                      contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
                  }}
                  scrollEventThrottle={16}
                  onContentSizeChange={() => {
                    if (chatPinnedToEndRef.current) {
                      chatScrollRef.current?.scrollToEnd({ animated: true });
                    }
                  }}
                >
                    {(client.messages || []).length === 0 ? (
                      <Text style={{ color: colors.secondary, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                        Brak wiadomości. Napisz pierwszy — klient zobaczy to w Live Chat.
                      </Text>
                    ) : (
                      portalMessages.map((msg) => {
                        const attachments = (msg.attachments || [])
                          .map((attachment) => {
                            const url = normalizeContactMediaUrl(attachment.url);
                            if (!url) return null;
                            return {
                              ...attachment,
                              url,
                              name: formatContactAttachmentName(attachment.name),
                            };
                          })
                          .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment));
                        const visibleContent = cleanAttachmentOnlyMessage(msg.content, attachments);
                        return (
                          <View
                          key={msg.id}
                          style={{
                            alignSelf: msg.fromMe ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.fromMe ? 'rgba(52,199,89,0.16)' : colors.input,
                            borderRadius: 16,
                            borderBottomRightRadius: msg.fromMe ? 6 : 16,
                            borderBottomLeftRadius: msg.fromMe ? 16 : 6,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            marginBottom: 8,
                            maxWidth: '86%',
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                            <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800' }}>
                              {msg.fromMe ? 'Ty' : client.firstName}
                            </Text>
                            <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '600' }}>
                              {new Date(msg.createdAt).toLocaleString('pl-PL', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                          {visibleContent ? (
                            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
                              {visibleContent}
                            </Text>
                          ) : null}
                          {attachments.map((attachment) => (
                            <ContactMessageAttachment
                              key={attachment.url}
                              attachment={attachment}
                              isMe={msg.fromMe}
                              isDark={isDark}
                            />
                          ))}
                          </View>
                        );
                      })
                    )}
                </ScrollView>

                <View style={[styles.chatComposer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                  {pendingChatFile ? (
                    <View
                      style={{
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: colors.input,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons name="attach-outline" size={16} color={colors.accent} />
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                        {formatContactAttachmentName(pendingChatFile.name)}
                      </Text>
                      <Pressable onPress={() => setPendingChatFile(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.secondary} />
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={chatDraft}
                    onChangeText={setChatDraft}
                    placeholder="Wiadomość do klienta…"
                    placeholderTextColor={colors.secondary}
                    style={[styles.input, { flex: 1, backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  />
                  <Pressable
                    onPress={async () => {
                      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
                      if (picked.canceled || !picked.assets?.[0]) return;
                      const file = picked.assets[0];
                      setPendingChatFile({
                        uri: file.uri,
                        name: file.name || 'zalacznik',
                        mimeType: file.mimeType || 'application/octet-stream',
                      });
                    }}
                    style={[styles.iconBtn, { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }]}
                  >
                    <Ionicons name="attach-outline" size={20} color={colors.text} />
                  </Pressable>
                  <Pressable
                    disabled={busy === 'chat' || (!chatDraft.trim() && !pendingChatFile)}
                    onPress={async () => {
                      if (!token || busy === 'chat') return;
                      if (!chatDraft.trim() && !pendingChatFile) return;
                      setBusy('chat');
                      let attachments: Array<{ url: string; name: string; mimeType: string; size: number }> = [];
                      if (pendingChatFile) {
                        const uploaded = await uploadClientPortalAttachment(token, clientId, pendingChatFile);
                        if (!uploaded.ok) {
                          setBusy('');
                          Alert.alert('Załącznik', uploaded.message);
                          return;
                        }
                        attachments = [uploaded.attachment];
                      }
                      const res = await postAgencyClientAction(token, clientId, {
                        action: 'send_portal_message',
                        content: chatDraft.trim(),
                        attachments,
                      });
                      setBusy('');
                      if (!res.ok) Alert.alert('Wiadomość', res.message);
                      else {
                        setChatDraft('');
                        setPendingChatFile(null);
                        void load();
                      }
                    }}
                    style={[
                      styles.sendBtn,
                      {
                        backgroundColor: colors.accent,
                        opacity: busy === 'chat' || (!chatDraft.trim() && !pendingChatFile) ? 0.45 : 1,
                      },
                    ]}
                  >
                    {busy === 'chat' ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Ionicons name="send" size={18} color="#000" />
                    )}
                  </Pressable>
                  </View>
                  </View>
                  </>
                ) : null}
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
                        <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 2, fontWeight: '700' }}>
                          Szkic niepubliczny — klient zobaczy go po zamknięciu pozysku
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
                        Brak szkicu oferty. Po podpisie i wysłaniu kopii powstanie niepubliczny szkic do akceptacji.
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
                          Utwórz szkic oferty (niepubliczny)
                        </Text>
                      </Pressable>
                      {showOfferErrors && offerGaps.length > 0 ? (
                        <Text style={{ color: ERROR_RED, fontSize: 12, fontWeight: '700', marginTop: 8 }}>
                          Brakuje: {offerGaps.map((item) => item.label).join(', ')}. Kroki i pola podświetlone na czerwono.
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              ) : null}

              {/* Dedicated Seller Buyer Radar Section */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border, overflow: 'hidden', padding: 0 },
                ]}
              >
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setRadarExpanded((current) => !current);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: radarExpanded }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderBottomWidth: radarExpanded ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(52,199,89,0.14)',
                    }}
                  >
                    <Ionicons name="radio-outline" size={21} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                      RADAR · {matches.length} DOPASOWAŃ
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
                      {client.type === 'BUYER'
                        ? `Radar dopasowań · ${client.firstName}`
                        : `Radar zakupowy · ${client.firstName}`}
                    </Text>
                    <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '600', marginTop: 3 }} numberOfLines={1}>
                      {radarSummary}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.input,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name={radarExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                  </View>
                </Pressable>

                {radarExpanded ? (
                  <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>
                        Parametry, automatyczne dopasowania i wysyłka ofert do klienta.
                      </Text>
                    </View>
                    <Pressable
                    onPress={async () => {
                      if (!token) return;
                      setBusy('matches');
                      const res = await refreshClientMatches(token, clientId);
                      setBusy('');
                      if (!res.ok) Alert.alert('Radar', res.message);
                      else void load();
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.input,
                    }}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
                      {busy === 'matches' ? '…' : 'Odśwież'}
                    </Text>
                  </Pressable>
                  </View>

                {client.type === 'SELLER' && (
                  <Pressable
                    onPress={() => {
                      const nextVal = !sellerRadarSearching;
                      setSellerRadarSearching(nextVal);
                      if (!nextVal) {
                        void saveBuyerRadar(false);
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

                {showRadarSurvey ? (
                  <View style={{ marginTop: 8 }}>
                    <AgencyClientRadarSurvey
                      value={buyerFilters}
                      onChange={setBuyerFilters}
                      isDark={isDark}
                      title="ANKIETA RADARU"
                      subtitle="Miasto, dzielnice, budżet, metraż i udogodnienia — potem radar dobiera oferty. Kłódka: asystent nie zmieni pola."
                      locks={intelLocks}
                      onLocksChange={setIntelLocks}
                    />
                    <Pressable
                      onPress={() => void saveBuyerRadar(true)}
                      style={[styles.secondary, { borderColor: colors.border, marginTop: 10 }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>
                        {busy === 'save_radar' ? 'Dopasowuję…' : 'Zapisz ankietę i dopasuj oferty'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {showRadarSurvey && token ? (
                  <View style={{ marginTop: 14 }}>
                    <IntelligenceAssistantCard
                      clientId={clientId}
                      token={token}
                      value={client.intelligence || DEFAULT_INTELLIGENCE_SETTINGS}
                      colors={colors}
                      busy={busy === 'intel'}
                      onSave={(next) => void saveIntelligence(next)}
                    />
                  </View>
                ) : null}

                <View style={{ marginTop: 12 }}>
                  {pendingMatches.length > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                        DO WYSŁANIA · {pendingMatches.length}
                      </Text>
                      <Pressable onPress={() => void sendMatches(pendingMatches.map((item) => item.offer.id))}>
                        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
                          {busy.startsWith('prop_') ? '…' : 'Wyślij wszystkie'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {matches.length === 0 ? (
                    <Text style={{ color: colors.secondary, fontSize: 13, marginVertical: 8 }}>
                      {showRadarSurvey
                        ? 'Brak ofert powyżej progu. Zapisz ankietę albo obniż próg dopasowania.'
                        : 'Włącz radar zakupowy, żeby dobierać oferty temu klientowi.'}
                    </Text>
                  ) : (
                    <>
                      {pendingMatches.map((item) => (
                        <MatchRow
                          key={item.id}
                          item={item}
                          colors={colors}
                          sent={false}
                          busy={busy === `prop_${item.offer.id}`}
                          onSend={() => void sendMatches([item.offer.id])}
                          onOpen={() => navigation.navigate('OfferDetail', { offerId: item.offer.id })}
                        />
                      ))}
                      {sentMatches.length > 0 ? (
                        <Text
                          style={{
                            color: colors.secondary,
                            fontSize: 11,
                            fontWeight: '900',
                            letterSpacing: 0.5,
                            marginTop: pendingMatches.length ? 14 : 0,
                            marginBottom: 8,
                          }}
                        >
                          WYSŁANE KLIENTOWI · {sentMatches.length}
                        </Text>
                      ) : null}
                      {sentMatches.map((item) => (
                        <MatchRow
                          key={item.id}
                          item={item}
                          colors={colors}
                          sent
                          busy={busy === `prop_${item.offer.id}`}
                          onSend={() => undefined}
                          onResend={() => {
                            Alert.alert(
                              'Wyślij ponownie',
                              'Klient dostał już tę ofertę. Wysłać jeszcze raz?',
                              [
                                { text: 'Anuluj', style: 'cancel' },
                                {
                                  text: 'Wyślij',
                                  onPress: () => void sendMatches([item.offer.id], true),
                                },
                              ],
                            );
                          }}
                          onOpen={() => navigation.navigate('OfferDetail', { offerId: item.offer.id })}
                        />
                      ))}
                    </>
                  )}
                </View>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <EkwBookViewerModal
        visible={ekwViewerKw !== null}
        landRegistryNumber={ekwViewerKw}
        onClose={() => setEkwViewerKw(null)}
        theme={{
          background: colors.bg,
          text: colors.text,
          subtitle: colors.secondary,
          glass: isDark ? 'dark' : 'light',
        }}
      />
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
    gap: 8,
  },
  navBtn: { width: 44, height: 36, justifyContent: 'center', alignItems: 'center' },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statChip: {
    minWidth: 78,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniStat: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 64,
  },
  chatThread: {
    height: 268,
    overflow: 'hidden',
  },
  chatThreadContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  chatComposer: {
    zIndex: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
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
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
