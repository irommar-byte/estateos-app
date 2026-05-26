import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  StyleSheet, View, Text, Pressable, TextInput, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Alert, Linking, Modal
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { 
  ChevronLeft, Send, Paperclip, Check, CheckCheck, 
  FileText, Play, Pause, CalendarClock, HandCoins, MoreHorizontal, Flag, Ban
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import Animated, { 
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, 
  withRepeat, withTiming, withSequence, withDelay 
} from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import BidActionModal from '../components/dealroom/BidActionModal';
import AppointmentActionModal from '../components/dealroom/AppointmentActionModal';
import HeartbeatWaitingPulse from '../components/dealroom/HeartbeatWaitingPulse';
import OwnerFinalDecisionCta from '../components/dealroom/OwnerFinalDecisionCta';
import FinalConfirmationModal from '../components/dealroom/FinalConfirmationModal';
import { API_URL } from '../config/network';
import { postDealroomTextMessage, setOfferStatusPending } from '../utils/dealroomOfferReserve';
import { archiveOwnOfferViaMobileAdmin } from '../utils/mobileOfferArchive';
import { setActiveDealroomContext } from '../utils/activeDealroomPush';
import { offerPresentationCalendarAfterAcceptance } from '../utils/presentationCalendar';
import {
  type DealNegotiationSnapshot,
  buildBidEventFromSnapshot,
  findLatestActionableBidEvent,
  isMessageFromUser,
  normalizeNegotiationSnapshot,
  resolveEventBidId,
} from '../utils/dealBidNegotiation';
import {
  schedulePresentationTwoHourReminder,
  cancelPresentationTwoHourReminder,
} from '../utils/presentationReminderNotification';
import PresentationCountdown from '../components/dealroom/PresentationCountdown';
import ReportSheet from '../components/ReportSheet';
import { useI18n, t } from '../i18n';
import BlockUserSheet from '../components/BlockUserSheet';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';
import {
  parseDealEvent,
  normalizeDealEvent,
  parseJsonMaybe,
} from '../utils/dealEventParse';
import {
  buildSharedDealReviewPayload,
  canFinalizeTransition,
  DEAL_REVIEW_PREFIX,
  isDealSaleFinalizedMessage,
  isDealTransactionFinalized,
  validateSharedDealReviewPayload,
} from '../contracts/parityContracts';

// ==========================================
// CONSTANTS & HELPERS
// ==========================================

const ATTACHMENT_PREFIX = '[[DEAL_ATTACHMENT]]';
const ATTACHMENT_PREFIX_LEGACY = '[[deal_attachment]]';

/** Lokalny cache wystawionej przez nas oceny dla danego deala — żeby po
 *  reloadzie ekranu nie pokazywać znowu formularza i nie generować pop-upu
 *  „Ocena została już wcześniej zapisana". Klucz scope'owany na deal+user. */
function dealReviewCacheKey(dealId: number | string | null, userId: number | string | null | undefined) {
  if (!dealId || !userId) return null;
  return `dealReview:${dealId}:${userId}`;
}
const DEALROOM_ATTACHMENT_LIMIT_BYTES = 50 * 1024 * 1024;

// Złagodzona, natywna paleta iOS Dark Mode
const COLORS = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  primary: '#34C759', // Klasyczny, czysty zielony z iOS
  primaryDimmed: 'rgba(52, 199, 89, 0.15)',
  textBase: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textMuted: 'rgba(235, 235, 245, 0.6)',
  border: 'rgba(255, 255, 255, 0.1)',
  danger: '#FF453A',
};

const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function toUniquePositiveInts(values: unknown[]): number[] {
  return Array.from(
    new Set(
      values
        .map((v) => toPositiveInt(v))
        .filter((v): v is number => Number.isFinite(v as number) && (v as number) > 0)
    )
  );
}

function formatActorLabel(msg: any, myUserId: any) {
  if (String(msg?.senderId ?? '') === String(myUserId ?? '')) return t('dealroom.chat.actorYou');
  const fromPayload =
    firstDefined(
      msg?.senderName,
      msg?.sender?.fullName,
      msg?.sender?.name,
      msg?.authorName,
      msg?.userName,
      msg?.user?.fullName,
      msg?.user?.name
    ) || '';
  const clean = String(fromPayload).trim();
  return clean || t('dealroom.chat.actorCounterparty');
}

function normalizeMediaUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${API_URL}${s}`;
  return `${API_URL}/${s.replace(/^\//, '')}`;
}

function fileNameFromUrl(url: string): string | null {
  try {
    const clean = url.split('?')[0];
    return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1));
  } catch {
    return null;
  }
}

function guessMimeFromFilename(name: string): string {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(lower)) return 'audio/mpeg';
  return 'application/octet-stream';
}

function ensureAttachmentFileName(name: string, mime: string) {
  const lower = name.toLowerCase();
  if (lower.includes('.')) return name;
  const m = String(mime || '').toLowerCase();
  if (m.includes('pdf')) return `${name || t('dealroom.chat.defaultDocName')}.pdf`;
  if (m.startsWith('audio/')) return `${name || t('dealroom.chat.defaultAudioName')}.${m.split('/')[1] || 'm4a'}`;
  return name || 'zalacznik.bin';
}

function extractJsonObjectFromSlice(rest: string): string | null {
  const braceIdx = rest.indexOf('{');
  if (braceIdx < 0) return null;
  let depth = 0;
  for (let i = braceIdx; i < rest.length; i += 1) {
    const ch = rest[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return rest.slice(braceIdx, i + 1);
    }
  }
  return null;
}

function parseDealAttachmentFromContent(content?: string): Record<string, any> | null {
  if (!content) return null;
  const markers = [ATTACHMENT_PREFIX, ATTACHMENT_PREFIX_LEGACY];
  const lower = content.toLowerCase();
  const matches = markers
    .map((marker) => ({ marker, idx: lower.indexOf(marker.toLowerCase()) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (matches.length === 0) return null;
  const cut = matches[0];
  const tail = content.slice(cut.idx + cut.marker.length).trim();
  try {
    const parsed = JSON.parse(tail);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, any>;
  } catch {
    const chunk = extractJsonObjectFromSlice(tail);
    if (chunk) {
      try {
        const parsed = JSON.parse(chunk);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, any>;
      } catch {
        // noop
      }
    }
  }
  return null;
}

function pickUrlFromAttachmentPayload(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const keys = ['url', 'uri', 'path', 'fileUrl', 'filePath', 'href', 'src', 'downloadUrl', 'publicUrl', 'link', 'location', 'previewUrl', 'resourceUrl', 'storageUrl', 'key', 'Key'];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && k === 'file') {
      const nested = pickUrlFromAttachmentPayload(v);
      if (nested) return nested;
    }
  }
  return null;
}

type DealroomResolvedAttachment = { url: string; name: string; mimeType: string; size: number; };

function buildResolvedAttachment(effective: Record<string, any>, resolvedUrl: string): DealroomResolvedAttachment | null {
  const url = normalizeMediaUrl(resolvedUrl);
  if (!url) return null;
  const nameFallback = fileNameFromUrl(url);
  const normalizedName = String(effective?.name || effective?.fileName || nameFallback || '').trim();
  const mimeType = String(effective?.mimeType || effective?.type || guessMimeFromFilename(normalizedName));
  const size = Number(effective?.size ?? effective?.sizeBytes ?? effective?.fileSize ?? 0) || 0;
  return { url, name: ensureAttachmentFileName(normalizedName || nameFallback || t('dealroom.chat.defaultDocName'), mimeType), mimeType, size };
}

function resolveAttachmentFromMessage(msg: any): DealroomResolvedAttachment | null {
  if (!msg) return null;
  const content = String(msg.content ?? '').trim();

  if (content.startsWith('{')) {
    const whole = parseJsonMaybe(content);
    if (whole && pickUrlFromAttachmentPayload(whole)) {
      const rec = buildResolvedAttachment(whole as Record<string, any>, pickUrlFromAttachmentPayload(whole)!);
      if (rec) return rec;
    }
  }

  const candidates: Record<string, any>[] = [];
  const push = (x: any) => {
    if (!x) return;
    if (typeof x === 'string') candidates.push({ url: x });
    else if (typeof x === 'object' && !Array.isArray(x)) candidates.push(x as Record<string, any>);
  };

  const embeddedFromContent = parseDealAttachmentFromContent(content);
  if (embeddedFromContent) candidates.push(embeddedFromContent);
  push(msg.attachment);
  if (Array.isArray(msg.attachments)) msg.attachments.forEach(push);
  if (Array.isArray(msg.messageAttachments)) msg.messageAttachments.forEach(push);
  push(msg.file);
  if (Array.isArray(msg.files)) msg.files.forEach(push);
  push(msg.document);
  push(msg.media);
  const payloadObj = parseJsonMaybe(msg.payload);
  push(payloadObj?.attachment);
  const metaObj = parseJsonMaybe(msg.metadata);
  push(metaObj?.attachment);
  const dataObj = parseJsonMaybe(msg.data);
  push(dataObj?.attachment);
  push(dataObj?.file);

  for (const c of candidates) {
    const rawUrl = pickUrlFromAttachmentPayload(c);
    if (rawUrl) {
      const rec = buildResolvedAttachment(c, rawUrl);
      if (rec) return rec;
    }
  }
  
  const topBlob = {
    url: firstDefined(msg.fileUrl, msg.attachmentUrl, msg.downloadUrl, msg.documentUrl, msg.mediaUrl, msg.path),
    name: firstDefined(msg.fileName, msg.attachmentName, msg.name),
    mimeType: firstDefined(msg.mimeType, msg.contentType),
    size: msg.fileSize ?? msg.size,
  };
  const topUrl = pickUrlFromAttachmentPayload(topBlob);
  if (topUrl) return buildResolvedAttachment(topBlob as Record<string, any>, topUrl);

  return null;
}

function stripChatAttachmentDecorations(rawContent: string | undefined, attachment: DealroomResolvedAttachment | null): string {
  if (!attachment) return String(rawContent || '');
  let text = String(rawContent || '');
  if (text.trim().startsWith('{') && /"url"\s*:/i.test(text.trim())) return '';
  text = text.replace(/\[\[(?:deal_attachment|DEAL_ATTACHMENT)\]\].*/i, '').trim();
  text = text.replace(/Załącznik:\s*[^\n\r]+/gi, '').trim();
  const esc = attachment.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(new RegExp(esc, 'gi'), '').trim();
  return text.replace(/\s+/g, ' ').trim();
}

function parseDealReviewPayload(content?: string): { rating: number; review?: string; senderId?: number | null } | null {
  const raw = String(content || '').trim();
  if (!raw.startsWith(DEAL_REVIEW_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(DEAL_REVIEW_PREFIX.length));
    return validateSharedDealReviewPayload(parsed);
  } catch {
    return null;
  }
}

// ==========================================
// SUBCOMPONENTS
// ==========================================

const TypingDot = ({ delay }: { delay: number }) => {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withDelay(delay, withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 }), withTiming(0, { duration: 600 }))),
      -1, true
    );
  }, [delay, translateY]);
  return <Animated.View style={[styles.typingDot, useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] } ))]} />;
};

// ==========================================
// MAIN SCREEN
// ==========================================

export default function DealroomChatScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const dealId = route.params?.dealId || route.params?.params?.dealId;
  const offerId = route.params?.offerId || route.params?.params?.offerId;
  const title = route.params?.title || route.params?.params?.title || t('dealroom.chat.defaultTitle');
  
  const { user, token } = useAuthStore() as any;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  
  // Modals & Context State
  const [selectedBidEvent, setSelectedBidEvent] = useState<any>(null);
  const [selectedBidHistory, setSelectedBidHistory] = useState<any[]>([]);
  const [selectedAppointmentEvent, setSelectedAppointmentEvent] = useState<any>(null);
  const [selectedAppointmentHistory, setSelectedAppointmentHistory] = useState<any[]>([]);
  const [bidNegotiationSnapshot, setBidNegotiationSnapshot] = useState<DealNegotiationSnapshot | null>(null);
  
  // Upload State
  const [pendingAttachment, setPendingAttachment] = useState<any>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [roomAttachmentBytes, setRoomAttachmentBytes] = useState(0);
  
  // UI Expand State
  const [appointmentSectionExpanded, setAppointmentSectionExpanded] = useState(false);
  const [priceSectionExpanded, setPriceSectionExpanded] = useState(false);
  
  const [resolvedOfferId, setResolvedOfferId] = useState<any>(offerId || null);
  const [isListingOwner, setIsListingOwner] = useState(false);
  const [listingOwnerUserId, setListingOwnerUserId] = useState<number | null>(null);
  const [counterpartyUserId, setCounterpartyUserId] = useState<number | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string>(() => t('dealroom.chat.otherParty'));
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const blockUser = useBlockedUsersStore((s) => s.block);
  const [dealStatusSnapshot, setDealStatusSnapshot] = useState<string | null>(null);
  const [acceptedBidIdSnapshot, setAcceptedBidIdSnapshot] = useState<number | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [myFinalRating, setMyFinalRating] = useState(0);
  const [myFinalReview, setMyFinalReview] = useState('');
  const [isSubmittingFinalReview, setIsSubmittingFinalReview] = useState(false);
  const [mySubmittedReview, setMySubmittedReview] = useState<{ rating: number; review: string; senderId: number | null } | null>(null);
  const [isCounterpartyReviewsOpen, setIsCounterpartyReviewsOpen] = useState(false);
  const [counterpartyPublicProfile, setCounterpartyPublicProfile] = useState<any>(null);
  const [counterpartyProfileLoading, setCounterpartyProfileLoading] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  /** Auto-scroll tylko przy nowej ostatniej wiadomości — nie przy rozwinięciu panelu / ticku zegara (unik blokady przewijania). */
  const lastAutoScrolledMessageIdRef = useRef<string | number | null>(null);
  const lastTypingTime = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const seenNegotiationEventKeysRef = useRef<Set<string>>(new Set());
  const negotiationBootstrappedRef = useRef(false);
  const lastReviewNotificationKeyRef = useRef<string | null>(null);
  const archiveAfterSaleAttemptedRef = useRef(false);

  // Animations
  const attachmentUploadPulse = useSharedValue(0);
  const appointmentAttentionPulse = useSharedValue(1);
  const priceAttentionPulse = useSharedValue(1);
  const appointmentSuccessNudge = useSharedValue(0);
  const priceSuccessNudge = useSharedValue(0);
  const uploadingPillAnim = useAnimatedStyle(() => ({
    opacity: 0.8 + attachmentUploadPulse.value * 0.2,
    transform: [{ scale: 0.995 + attachmentUploadPulse.value * 0.005 }],
  }));
  const appointmentIconAnim = useAnimatedStyle(() => ({
    opacity: appointmentAttentionPulse.value,
    transform: [{ rotate: `${appointmentSuccessNudge.value}deg` }],
  }));
  const priceIconAnim = useAnimatedStyle(() => ({
    opacity: priceAttentionPulse.value,
    transform: [{ rotate: `${priceSuccessNudge.value}deg` }],
  }));

  useEffect(() => {
    lastAutoScrolledMessageIdRef.current = null;
  }, [dealId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.id;
    if (lastId === undefined || lastId === null) return;
    if (lastId === lastAutoScrolledMessageIdRef.current) return;
    lastAutoScrolledMessageIdRef.current = lastId;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  useEffect(() => {
    if (isUploadingAttachment) {
      attachmentUploadPulse.value = withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })), -1, false);
    } else {
      attachmentUploadPulse.value = 0;
    }
  }, [isUploadingAttachment, attachmentUploadPulse]);

  useEffect(() => {
    if (offerId) setResolvedOfferId(offerId);
  }, [offerId]);

  useFocusEffect(
    useCallback(() => {
      const d = Number(dealId || 0);
      const oid = Number(resolvedOfferId ?? offerId ?? 0);
      setActiveDealroomContext({
        dealId: Number.isFinite(d) && d > 0 ? d : null,
        offerId: Number.isFinite(oid) && oid > 0 ? oid : null,
      });
      return () => setActiveDealroomContext({ dealId: null, offerId: null });
    }, [dealId, offerId, resolvedOfferId])
  );

  const fetchDealSnapshot = useCallback(async () => {
    if (!dealId || !token || !user?.id) {
      setIsListingOwner(false);
      setListingOwnerUserId(null);
      setCounterpartyUserId(null);
      setDealStatusSnapshot(null);
      setAcceptedBidIdSnapshot(null);
      return null;
    }
    const res = await fetch(`${API_URL}/api/mobile/v1/deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const deals = Array.isArray(json)
      ? json
      : Array.isArray(json?.deals)
        ? json.deals
        : Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.data?.deals)
            ? json.data.deals
            : [];
    const current = deals.find((d: any) => String(d?.id) === String(dealId));
    if (!current) return null;

    const buyerId = toPositiveInt(firstDefined(current?.buyerId, current?.buyer?.id)) || 0;
    const sellerId = toPositiveInt(firstDefined(current?.sellerId, current?.seller?.id)) || 0;
    const buyerName = String(firstDefined(current?.buyer?.name, current?.buyerName, current?.buyer?.fullName) || '').trim();
    const sellerName = String(firstDefined(current?.seller?.name, current?.sellerName, current?.seller?.fullName) || '').trim();
    const meId = Number(user.id);
    const ownerCandidateIds = toUniquePositiveInts([
      current?.sellerId,
      current?.seller?.id,
      sellerId,
      current?.offer?.userId,
      current?.listing?.userId,
      current?.offer?.user?.id,
      current?.listing?.user?.id,
      current?.ownerId,
      current?.owner?.id,
    ]);
    const resolvedOwnerId = ownerCandidateIds[0] ?? null;
    setListingOwnerUserId(resolvedOwnerId);
    const counterpart =
      buyerId > 0 && buyerId !== meId
        ? buyerId
        : sellerId > 0 && sellerId !== meId
          ? sellerId
          : null;
    const counterpartLabel =
      buyerId > 0 && buyerId !== meId
        ? buyerName
        : sellerId > 0 && sellerId !== meId
          ? sellerName
          : '';
    setCounterpartyUserId(counterpart);
    setCounterpartyName(counterpartLabel || t('dealroom.chat.otherParty'));
    const myRoleRaw = String(
      firstDefined(current?.myRole, current?.viewerRole, current?.roleInDeal, current?.ownerRole, '')
    ).toUpperCase();
    const isOwnerByRole =
      myRoleRaw.includes('SELL') || myRoleRaw.includes('OWNER') || myRoleRaw.includes('SPRZED');
    const isOwnerByIds = meId > 0 && (
      (resolvedOwnerId != null && meId === resolvedOwnerId) ||
      (sellerId > 0 && meId === sellerId)
    );
    setIsListingOwner(Boolean(isOwnerByIds || isOwnerByRole));

    const nextOfferId = firstDefined(
      current?.offerId,
      current?.offer?.id,
      current?.offer?.offerId,
      current?.listingId,
      current?.propertyId
    );
    if (nextOfferId) setResolvedOfferId(nextOfferId);

    const rawDealStatus = String(firstDefined(current?.status, current?.dealStatus) || '').trim().toUpperCase();
    setDealStatusSnapshot(rawDealStatus || null);

    const acceptedBidRaw = firstDefined(current?.acceptedBidId, current?.acceptedBid?.id);
    const acceptedBid = Number(acceptedBidRaw || 0);
    setAcceptedBidIdSnapshot(Number.isFinite(acceptedBid) && acceptedBid > 0 ? acceptedBid : null);

    return current;
  }, [dealId, token, user?.id]);

  const openCounterpartyReviews = useCallback(async () => {
    if (!counterpartyUserId) return;
    setIsCounterpartyReviewsOpen(true);
    setCounterpartyProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${counterpartyUserId}/public`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data?.error) setCounterpartyPublicProfile(data);
    } catch {
      // noop
    } finally {
      setCounterpartyProfileLoading(false);
    }
  }, [counterpartyUserId, token]);

  const openPublicReviewsProfile = useCallback(async (userId: number | null, fallbackName?: string) => {
    if (!userId) return;
    setCounterpartyProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/public`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data?.error) {
        setCounterpartyPublicProfile(data);
        const nextName = String(
          firstDefined(data?.user?.name, data?.user?.fullName, data?.name, fallbackName || '')
        ).trim();
        if (nextName) setCounterpartyName(nextName);
      }
    } catch {
      // noop
    } finally {
      setCounterpartyProfileLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        await fetchDealSnapshot();
      } catch {
        if (!cancelled) {
          setIsListingOwner(false);
          setListingOwnerUserId(null);
          setCounterpartyUserId(null);
          setDealStatusSnapshot(null);
          setAcceptedBidIdSnapshot(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchDealSnapshot]);

  const resolveOfferIdForUpload = useCallback(async () => {
    if (resolvedOfferId) return resolvedOfferId;
    if (!dealId || !token) return null;
    try {
      const current = await fetchDealSnapshot();
      const nextOfferId = firstDefined(
        current?.offerId,
        current?.offer?.id,
        current?.offer?.offerId,
        current?.listingId,
        current?.propertyId
      );
      if (nextOfferId) {
        setResolvedOfferId(nextOfferId);
        return nextOfferId;
      }
      return null;
    } catch {
      return null;
    }
  }, [dealId, resolvedOfferId, token, fetchDealSnapshot]);

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  // --- Methods ---

  const getAttachmentKind = (attachment: any) => {
    const mime = String(attachment?.mimeType || '').toLowerCase();
    const name = String(attachment?.name || '').toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (mime.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg)$/i.test(name)) return 'audio';
    return 'file';
  };

  const handleToggleAudioPreview = async (url: string) => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (playingAudioUrl === url && soundRef.current) {
        const status: any = await soundRef.current.getStatusAsync();
        if (status?.isLoaded && status?.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlayingAudioUrl(null);
          return;
        }
      }
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: url }, { shouldPlay: false },
        (status: any) => { if (status?.didJustFinish) setPlayingAudioUrl(null); }
      );
      await sound.playAsync();
      soundRef.current = sound;
      setPlayingAudioUrl(url);
    } catch {
      Alert.alert(t('common.error'), t('dealroom.chat.errors.audioPlay'));
      setPlayingAudioUrl(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let u = 0;
    while (value >= 1024 && u < units.length - 1) { value /= 1024; u += 1; }
    return `${value.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
  };

  const fetchMessages = useCallback(async () => {
    if (!token || !dealId) return;
    try {
      const url = `${API_URL}/api/mobile/v1/deals/${dealId}/messages?t=${Date.now()}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      const text = await res.text();
      if (!text) return;
      
      const data = JSON.parse(text);
      if (data.messages) {
        setMessages(data.messages);
        setRoomAttachmentBytes(data.messages.reduce((sum: number, msg: any) => sum + (resolveAttachmentFromMessage(msg)?.size || 0), 0));
      }
      if (data.negotiation && typeof data.negotiation === 'object') {
        setBidNegotiationSnapshot(normalizeNegotiationSnapshot(data.negotiation));
      }
      if (data.isTyping !== undefined) setIsPartnerTyping(data.isTyping);
    } catch (e) {
      // Ciche ignorowanie w tle
    } finally {
      setLoading(false);
    }
  }, [dealId, token]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleTyping = (text: string) => {
    setMessage(text);
    const now = Date.now();
    if (text.length > 0 && now - lastTypingTime.current > 1500) {
      lastTypingTime.current = now;
      fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/typing`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !pendingAttachment) || !token || !user || isUploadingAttachment) return;
    const content = message.trim();
    const attachmentForSend = pendingAttachment;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setMessage('');
    if (!attachmentForSend) {
      setMessages(prev => [...prev, {
        id: Date.now(), senderId: user.id, content, createdAt: new Date().toISOString(), isRead: false, attachment: null,
      }]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }

    try {
      if (attachmentForSend) {
        setIsUploadingAttachment(true);
        const uploadOfferId = await resolveOfferIdForUpload();
        const uploadIdentifier = uploadOfferId || dealId;
        if (!uploadIdentifier) {
          Alert.alert(t('dealroom.chat.alerts.missingId'), t('dealroom.chat.errors.missingUploadId'));
          return;
        }

        const baseFile = {
          uri: attachmentForSend.uri,
          name: attachmentForSend.name || `zalacznik_${Date.now()}`,
          type: attachmentForSend.mimeType || 'application/octet-stream',
        } as any;

        const uploadAttempts = [
          { fileField: 'file', endpoint: `${API_URL}/api/upload/mobile` },
          { fileField: 'document', endpoint: `${API_URL}/api/upload/mobile` },
          { fileField: 'attachment', endpoint: `${API_URL}/api/upload/mobile` },
        ];

        let uploadedPath: string | null = null;
        let lastUploadError = '';
        for (const attempt of uploadAttempts) {
          const uploadData = new FormData();
          uploadData.append('offerId', String(uploadIdentifier));
          uploadData.append('dealId', String(dealId));
          uploadData.append('listingId', String(uploadIdentifier));
          uploadData.append('purpose', 'dealroomAttachment');
          uploadData.append(attempt.fileField, baseFile);
          const uploadRes = await fetch(attempt.endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: uploadData,
          });
          const uploadText = await uploadRes.text();
          const uploadJson = (() => {
            try { return uploadText ? JSON.parse(uploadText) : null; } catch { return null; }
          })();
          const candidatePath =
            uploadJson?.url ||
            uploadJson?.path ||
            uploadJson?.fileUrl ||
            uploadJson?.data?.url ||
            uploadJson?.data?.path ||
            null;
          if (uploadRes.ok && candidatePath) {
            uploadedPath = candidatePath;
            break;
          }
          lastUploadError = uploadText || `HTTP ${uploadRes.status}`;
        }

        if (!uploadedPath) {
          const directAttempts: Array<'file' | 'attachment' | 'document'> = ['file', 'attachment', 'document'];
          let directSuccess = false;
          let directErrText = '';
          for (const directField of directAttempts) {
            const msgForm = new FormData();
            msgForm.append('content', content || t('dealroom.chat.attachmentFallback', { name: baseFile.name }));
            msgForm.append('offerId', String(uploadIdentifier));
            msgForm.append('dealId', String(dealId));
            msgForm.append(directField, baseFile);
            const directRes = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: msgForm,
            });
            if (directRes.ok) {
              directSuccess = true;
              break;
            }
            directErrText = await directRes.text();
          }
          if (!directSuccess) {
            Alert.alert(t('dealroom.chat.alerts.uploadError'), directErrText || lastUploadError || t('dealroom.chat.errors.uploadFailed'));
            return;
          }
          setPendingAttachment(null);
          fetchMessages();
          return;
        }

        const payloadAttachment = {
          url: uploadedPath,
          name: baseFile.name,
          mimeType: baseFile.type,
          size: Number(attachmentForSend.size || 0),
        };
        const payloadContent =
          content
            ? `${content}\n${ATTACHMENT_PREFIX_LEGACY}${JSON.stringify(payloadAttachment)}`
            : `${ATTACHMENT_PREFIX_LEGACY}${JSON.stringify(payloadAttachment)}`;
        const sendRes = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: payloadContent }),
        });
        if (!sendRes.ok) {
          const errBody = await sendRes.text();
          Alert.alert(t('dealroom.chat.alerts.sendError'), errBody || t('dealroom.chat.errors.sendWithAttachment'));
          return;
        }
        setPendingAttachment(null);
      } else {
        const textRes = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (!textRes.ok) {
          const errBody = await textRes.text();
          Alert.alert(t('dealroom.chat.alerts.sendError'), errBody || t('dealroom.chat.errors.sendMessage'));
          setMessage(content);
          return;
        }
      }
      fetchMessages();
    } catch (e) {
      Alert.alert(t('common.error'), attachmentForSend ? t('dealroom.chat.errors.sendAttachment') : t('dealroom.chat.errors.sendMessage'));
      if (!attachmentForSend) setMessage(content);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handlePickAttachment = async () => {
    if (isUploadingAttachment) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      if (roomAttachmentBytes + (file.size || 0) > DEALROOM_ATTACHMENT_LIMIT_BYTES) {
        Alert.alert(t('dealroom.chat.alerts.limitTitle'), t('dealroom.chat.errors.fileLimit'));
        return;
      }

      setPendingAttachment({
        uri: file.uri,
        name: file.name || `zalacznik_${Date.now()}`,
        mimeType: file.mimeType || 'application/octet-stream',
        size: Number(file.size || 0),
      });
      Haptics.selectionAsync();
    } catch (e) {
      Alert.alert(t('common.error'), t('dealroom.chat.errors.pickFile'));
    }
  };

  // --- Derived State (Negotiations) ---
  const negotiationEvents = useMemo(() => {
    return messages
      .map((msg) => ({ msg, event: normalizeDealEvent(parseDealEvent(msg)) }))
      .filter((e) => e.event?.entity)
      .sort((a, b) => {
        const ta = new Date(a.msg?.createdAt || 0).getTime();
        const tb = new Date(b.msg?.createdAt || 0).getTime();
        return ta - tb;
      });
  }, [messages]);
  const bidEvents = useMemo(() => negotiationEvents.filter(e => e.event?.entity === 'BID'), [negotiationEvents]);
  const appointmentEvents = useMemo(() => negotiationEvents.filter(e => e.event?.entity === 'APPOINTMENT'), [negotiationEvents]);

  const latestBid = bidEvents[bidEvents.length - 1] || null;
  const latestAppointment = appointmentEvents[appointmentEvents.length - 1] || null;

  const latestActionableBidFromOther = useMemo(
    () => findLatestActionableBidEvent(bidEvents, user?.id),
    [bidEvents, user?.id]
  );

  const actionableBidFromServer = useMemo(() => {
    const fromSnapshot = buildBidEventFromSnapshot(bidNegotiationSnapshot);
    if (!fromSnapshot?.bidId) return null;
    return {
      event: fromSnapshot,
      msg: { senderId: fromSnapshot.senderId },
    };
  }, [bidNegotiationSnapshot]);

  const actionableBidContext = actionableBidFromServer || latestActionableBidFromOther;

  /**
   * ====================================================================
   *  Detektor „kupujący wysłał finalną akceptację — czeka się na ostatnie
   *  słowo właściciela".
   * ====================================================================
   *
   *  Wzorzec wytwarzany przez `BidActionModal` w bloku `isBuyerAcceptingOwnersPrice`:
   *    • mode = 'respond', decision = 'ACCEPT' (kupujący klika „Zgoda"),
   *    • payload leci jednak jako `COUNTER` z `counterAmount = initialAmount`,
   *      czyli z TĄ SAMĄ kwotą, którą zaproponował właściciel,
   *    • z notą „Akceptuję Twoją cenę. Proszę o ostateczne potwierdzenie sprzedaży."
   *
   *  Czyli sygnatura ostatniego bid w wątku to:
   *      action     = 'COUNTERED'
   *      senderId   = kupujący (czyli != listingOwner)
   *      amount     = previousBid.amount (poprzedni bid OD WŁAŚCICIELA)
   *      note       = zawiera „Akceptuję" / „ostateczne potwierdzenie" (soft check)
   *
   *  Wystarczają nam pierwsze 3 sygnały (action, senderId, amount-match);
   *  notę traktujemy jako dodatkowy potwierdzający „heurystyczny" sygnał.
   *  W razie gdyby backend dopisał kiedyś flagę semantyczną (np.
   *  `event.intent === 'FINAL_ACCEPTANCE'`) — od razu też ją honorujemy.
   */
  const finalAcceptanceContext = useMemo(() => {
    if (bidEvents.length < 2) return null;
    const last = bidEvents[bidEvents.length - 1];
    const prev = bidEvents[bidEvents.length - 2];
    if (!last || !prev) return null;

    const lastAction = String(last.event?.action || '').toUpperCase();
    const lastAmount = Number(last.event?.amount || last.event?.counterAmount || 0);
    const prevAmount = Number(prev.event?.amount || prev.event?.counterAmount || 0);
    const lastSenderId = String(last.msg?.senderId ?? '');
    const prevSenderId = String(prev.msg?.senderId ?? '');
    const lastNote = String(
      firstDefined(last.event?.note, last.event?.message, '') || '',
    ).toLowerCase();

    const isCountered = lastAction === 'COUNTERED';
    const isExplicitIntent =
      String(last.event?.intent || '').toUpperCase() === 'FINAL_ACCEPTANCE';
    const isSameAmount =
      lastAmount > 0 && prevAmount > 0 && Math.round(lastAmount) === Math.round(prevAmount);
    const notesAcceptance =
      lastNote.includes('akceptuję twoją cenę') ||
      lastNote.includes('akceptuje twoja cene') ||
      lastNote.includes('ostateczne potwierdzenie') ||
      lastNote.includes('ostateczne potw');

    const matchesAcceptancePattern = isExplicitIntent || (isCountered && isSameAmount && notesAcceptance);
    if (!matchesAcceptancePattern) return null;

    // Bid musi być OD INNEJ STRONY niż autor poprzedniego — to gwarantuje,
    // że to faktyczny „handshake" (kupujący → właściciel), a nie sam właściciel
    // wysyłający w kółko tę samą kwotę do siebie.
    if (lastSenderId === prevSenderId) return null;

    return {
      bidEvent: last,
      previousBidEvent: prev,
      amount: Math.round(lastAmount),
      // Kto wysłał finalną akceptację — to powinien być kupujący (nie-owner).
      // Sprawdzamy to po stronie konsumenta tej zmiennej (`isBuyerWaitingOnOwner`,
      // `ownerNeedsFinalDecision`), żeby ten memo był „neutralny semantycznie".
      buyerSenderId: lastSenderId,
      // ID bid-a, na który backend oczekuje BID_RESPOND od właściciela.
      bidId: Number(
        firstDefined(last.event?.bidId, last.event?.id, last.msg?.id) ?? 0,
      ),
    };
  }, [bidEvents]);

  /** Stan KUPUJĄCEGO: wysłałem finalną akceptację, czekam na właściciela. */
  const isBuyerWaitingOnOwnerDecision = useMemo(() => {
    if (!finalAcceptanceContext) return false;
    return String(user?.id ?? '') === finalAcceptanceContext.buyerSenderId;
  }, [finalAcceptanceContext, user?.id]);

  /** Stan WŁAŚCICIELA: kupujący wysłał finalną akceptację, ja muszę zdecydować. */
  const ownerNeedsFinalDecision = useMemo(() => {
    if (!finalAcceptanceContext) return false;
    if (!isListingOwner) return false;
    return String(user?.id ?? '') !== finalAcceptanceContext.buyerSenderId;
  }, [finalAcceptanceContext, isListingOwner, user?.id]);

  /** Modal `FinalConfirmationModal` jest osobnym instance'em — trzymamy stan tutaj. */
  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState(false);

  const latestActionableAppointmentFromOther = useMemo(
    () =>
      [...appointmentEvents]
        .reverse()
        .find(
          (e) =>
            String(e.msg?.senderId ?? '') !== String(user?.id ?? '') &&
            ['PROPOSED', 'COUNTERED'].includes(String(e.event?.action || '').toUpperCase()) &&
            !!e.event?.proposedDate
        ) || null,
    [appointmentEvents, user?.id]
  );

  const acceptedAppointment = useMemo(
    () =>
      [...appointmentEvents]
        .reverse()
        .find((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED' && !!e.event?.proposedDate) || null,
    [appointmentEvents]
  );

  const isAppointmentProposalLocked = useMemo(() => {
    const rawDate = acceptedAppointment?.event?.proposedDate;
    if (!rawDate) return false;
    const ts = new Date(rawDate).getTime();
    return Number.isFinite(ts) && ts > Date.now();
  }, [acceptedAppointment]);

  const acceptedPrice = useMemo(() => {
    const acceptedEvents = [...bidEvents]
      .reverse()
      .filter((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED' && Number(e.event?.amount || 0) > 0);
    if (acceptedEvents.length === 0) return 0;
    if (listingOwnerUserId) {
      const ownerAccepted = acceptedEvents.find(
        (e) => String(e.msg?.senderId ?? '') === String(listingOwnerUserId)
      );
      if (ownerAccepted) return Number(ownerAccepted.event?.amount || 0);
    }
    return Number(acceptedEvents[0]?.event?.amount || 0);
  }, [bidEvents, listingOwnerUserId]);

  const latestNegotiatedPrice = useMemo(
    () =>
      [...bidEvents].reverse().find((e) => Number(e.event?.amount || 0) > 0)?.event?.amount || 0,
    [bidEvents]
  );

  const isWaitingForOtherOnPrice = useMemo(() => {
    if (bidNegotiationSnapshot?.waitingOnOtherBid || bidNegotiationSnapshot?.waitingOnOther) return true;
    if (!latestBid) return false;
    const action = String(latestBid.event?.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED'].includes(action)) return false;
    return isMessageFromUser(latestBid.msg, user?.id);
  }, [latestBid, user?.id, bidNegotiationSnapshot?.waitingOnOther]);

  const appointmentStatus = useMemo<'IDLE' | 'PENDING' | 'ACCEPTED'>(() => {
    if (!latestAppointment) return 'IDLE';
    const action = String(latestAppointment.event?.action || '').toUpperCase();
    if (action === 'ACCEPTED' || acceptedAppointment) return 'ACCEPTED';
    if (['PROPOSED', 'COUNTERED'].includes(action)) return 'PENDING';
    return 'IDLE';
  }, [acceptedAppointment, latestAppointment]);

  /** Cena w wątku jest „ACCEPTED”, ale deal nie jest jeszcze AGREED+acceptedBidId — ostatnie słowo ma właściciel (jak w BidActionModal). */
  const awaitingOwnerPriceFinalize = useMemo(() => {
    if (!latestBid) return false;
    const action = String(latestBid.event?.action || '').toUpperCase();
    if (action !== 'ACCEPTED') return false;
    if (['FINALIZED', 'CLOSED', 'COMPLETED', 'DONE', 'SOLD'].includes(String(dealStatusSnapshot || '').toUpperCase())) {
      return false;
    }
    return !canFinalizeTransition({
      dealStatus: dealStatusSnapshot,
      acceptedBidId: acceptedBidIdSnapshot,
    });
  }, [latestBid, dealStatusSnapshot, acceptedBidIdSnapshot]);

  const priceStatus = useMemo<'IDLE' | 'PENDING' | 'ACCEPTED'>(() => {
    if (!latestBid) return 'IDLE';
    const action = String(latestBid.event?.action || '').toUpperCase();
    if (awaitingOwnerPriceFinalize) return 'PENDING';
    if (
      acceptedPrice > 0 ||
      canFinalizeTransition({ dealStatus: dealStatusSnapshot, acceptedBidId: acceptedBidIdSnapshot })
    ) {
      return 'ACCEPTED';
    }
    if (action === 'ACCEPTED') return 'PENDING';
    if (['PROPOSED', 'COUNTERED'].includes(action)) return 'PENDING';
    return 'IDLE';
  }, [acceptedPrice, awaitingOwnerPriceFinalize, latestBid, dealStatusSnapshot, acceptedBidIdSnapshot]);

  const appointmentStatusText = useMemo(() => {
    if (appointmentStatus === 'IDLE') return t('dealroom.chat.appointmentStatus.idle');
    if (appointmentStatus === 'ACCEPTED' && acceptedAppointment?.event?.proposedDate) {
      return t('dealroom.chat.appointmentStatus.set', { date: new Date(acceptedAppointment.event.proposedDate).toLocaleString('pl-PL') });
    }
    const source = latestActionableAppointmentFromOther || latestAppointment;
    if (source?.event?.proposedDate) {
      const who = formatActorLabel(source.msg, user?.id);
      return t('dealroom.chat.appointmentStatus.proposedBy', { who });
    }
    return t('dealroom.chat.appointmentStatus.negotiating');
  }, [acceptedAppointment, appointmentStatus, latestActionableAppointmentFromOther, latestAppointment, user?.id, t]);

  const transactionFinalized = useMemo(
    () =>
      isDealTransactionFinalized({
        dealStatus: dealStatusSnapshot,
        messages,
      }),
    [dealStatusSnapshot, messages],
  );

  const priceStatusText = useMemo(() => {
    if (priceStatus === 'IDLE') return t('dealroom.chat.priceStatus.idle');
    if (ownerNeedsFinalDecision && !transactionFinalized) {
      return t('dealroom.chat.priceStatus.ownerCta');
    }
    if (awaitingOwnerPriceFinalize) {
      return t('dealroom.chat.priceStatus.awaitingOwner');
    }
    if (priceStatus === 'ACCEPTED' && acceptedPrice > 0) {
      return t('dealroom.chat.priceStatus.agreed', { amount: acceptedPrice.toLocaleString('pl-PL') });
    }
    if (isWaitingForOtherOnPrice && Number(latestBid?.event?.amount || 0) > 0) {
      return t('dealroom.chat.priceStatus.waitingResponse', { amount: Number(latestBid?.event?.amount || 0).toLocaleString('pl-PL') });
    }
    const source = latestActionableBidFromOther || latestBid;
    if (source?.event?.amount) {
      const who = formatActorLabel(source.msg, user?.id);
      return t('dealroom.chat.priceStatus.proposedBy', { amount: Number(source.event.amount).toLocaleString('pl-PL'), who });
    }
    return t('dealroom.chat.priceStatus.negotiating');
  }, [
    acceptedPrice,
    awaitingOwnerPriceFinalize,
    latestActionableBidFromOther,
    latestBid,
    isWaitingForOtherOnPrice,
    priceStatus,
    user?.id,
    ownerNeedsFinalDecision,
    transactionFinalized,
    t,
  ]);

  useEffect(() => {
    if (ownerNeedsFinalDecision && !transactionFinalized) {
      setPriceSectionExpanded(true);
    }
  }, [ownerNeedsFinalDecision, transactionFinalized]);

  useEffect(() => {
    archiveAfterSaleAttemptedRef.current = false;
  }, [dealId]);

  /** Gdy modal finalizacji nie zarchiwizował oferty — ponów po wykryciu zamknięcia sprzedaży. */
  useEffect(() => {
    if (!transactionFinalized || !isListingOwner || !token || !resolvedOfferId) return;
    if (archiveAfterSaleAttemptedRef.current) return;
    archiveAfterSaleAttemptedRef.current = true;
    const oid = Number(resolvedOfferId);
    if (!Number.isFinite(oid) || oid <= 0) return;
    void archiveOwnOfferViaMobileAdmin(API_URL, token, oid);
  }, [transactionFinalized, isListingOwner, token, resolvedOfferId]);

  const presentationHappened = useMemo(() => {
    const raw = acceptedAppointment?.event?.proposedDate;
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts <= Date.now();
  }, [acceptedAppointment]);

  const showPostPresentationReserve = Boolean(
    isListingOwner &&
      resolvedOfferId &&
      user?.id &&
      acceptedAppointment?.event?.proposedDate &&
      presentationHappened &&
      !transactionFinalized
  );

  const finalReviews = useMemo(() => {
    return messages
      .map((m) => ({ msg: m, review: parseDealReviewPayload(String(m?.content || '')) }))
      .filter((x) => !!x.review)
      .map((x) => ({
        ...x.review!,
        senderId: Number(x.msg?.senderId ?? x.review?.senderId ?? 0) || null,
        senderName: formatActorLabel(x.msg, user?.id),
        createdAt: x.msg?.createdAt,
      }));
  }, [messages, user?.id]);

  const myFinalReviewEntry = useMemo(() => {
    const fromThread = finalReviews.find((r) => String(r.senderId ?? '') === String(user?.id ?? '')) || null;
    if (fromThread) return fromThread;
    if (!mySubmittedReview) return null;
    return {
      ...mySubmittedReview,
      senderName: t('dealroom.chat.actorYou'),
      createdAt: new Date().toISOString(),
    };
  }, [finalReviews, user?.id, mySubmittedReview]);
  const reviewSubmitted = Boolean(myFinalReviewEntry);

  const partnerFinalReviewEntry = useMemo(
    () => finalReviews.find((r) => String(r.senderId ?? '') !== String(user?.id ?? '')) || null,
    [finalReviews, user?.id]
  );

  const finalizationTimestamp = useMemo(() => {
    const finalizedMessage = messages.find((m) =>
      isDealSaleFinalizedMessage(String(m?.content || ''))
    );
    if (finalizedMessage?.createdAt) {
      const ts = new Date(finalizedMessage.createdAt).getTime();
      if (Number.isFinite(ts)) return ts;
    }
    const acceptedBidEvent = [...bidEvents]
      .reverse()
      .find((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED');
    if (acceptedBidEvent?.msg?.createdAt) {
      const ts = new Date(acceptedBidEvent.msg.createdAt).getTime();
      if (Number.isFinite(ts)) return ts;
    }
    return null;
  }, [messages, bidEvents]);

  const reviewRevealUnlocked = useMemo(() => {
    if (myFinalReviewEntry) return true;
    if (!finalizationTimestamp) return false;
    return Date.now() - finalizationTimestamp >= 14 * 24 * 60 * 60 * 1000;
  }, [myFinalReviewEntry, finalizationTimestamp]);

  useEffect(() => {
    if (!myFinalReviewEntry) return;
    setMyFinalRating(Number(myFinalReviewEntry.rating || 0));
    setMyFinalReview(String(myFinalReviewEntry.review || ''));
  }, [myFinalReviewEntry]);

  /** Po finalizacji transakcji wczytujemy lokalny cache mojej opinii — żeby po
   *  ponownym wejściu w deal nie pokazywać już formularza (i tym samym nie
   *  generować pop-upu „Ocena została już wcześniej zapisana" przy próbie
   *  ponownego kliknięcia „Wyślij"). */
  useEffect(() => {
    if (!transactionFinalized || mySubmittedReview) return;
    const key = dealReviewCacheKey(dealId, user?.id);
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as {
          rating?: number;
          review?: string;
          senderId?: number | null;
        };
        if (parsed && Number(parsed.rating) >= 1 && Number(parsed.rating) <= 5) {
          setMySubmittedReview({
            rating: Number(parsed.rating),
            review: String(parsed.review || ''),
            senderId: parsed.senderId ?? Number(user?.id || 0),
          });
        }
      } catch {
        // noop — brak cache jest OK, leci dalej oryginalny flow
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionFinalized, mySubmittedReview, dealId, user?.id]);

  useEffect(() => {
    if (!transactionFinalized || !partnerFinalReviewEntry || myFinalReviewEntry) return;
    const key = `${dealId}:${partnerFinalReviewEntry.senderId || 'partner'}:${partnerFinalReviewEntry.createdAt || ''}`;
    if (lastReviewNotificationKeyRef.current === key) return;
    lastReviewNotificationKeyRef.current = key;
    void Notifications.scheduleNotificationAsync({
      content: {
        title: t('dealroom.chat.review.ratingReceivedTitle'),
        body: t('dealroom.chat.review.ratingReceivedBody'),
        data: {
          target: 'dealroom',
          targetType: 'DEAL',
          notificationType: 'dealroom_review',
          dealId,
          offerId: resolvedOfferId || undefined,
          deeplink: `estateos://dealroom/${dealId}`,
        },
      } as Notifications.NotificationContentInput,
      trigger: null,
    });
  }, [transactionFinalized, partnerFinalReviewEntry, myFinalReviewEntry, dealId, resolvedOfferId]);

  const handlePostPresentationReserve = useCallback(async () => {
    if (!token || !dealId || !resolvedOfferId || !user?.id) return;
    Alert.alert(
      t('dealroom.chat.reserveWithdraw.alertTitle'),
      t('dealroom.chat.reserveWithdraw.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dealroom.chat.reserveWithdraw.confirmButton'),
          style: 'destructive',
          onPress: async () => {
            try {
              const msgOk = await postDealroomTextMessage({
                dealId: Number(dealId),
                token,
                content: t('dealroom.chat.reserveWithdraw.chatNote'),
              });
              if (!msgOk) {
                Alert.alert(t('dealroom.chat.alerts.warning'), t('dealroom.chat.reserveWithdraw.chatNoteFailed'));
              }
              const pendingRes = await setOfferStatusPending({
                offerId: Number(resolvedOfferId),
                userId: Number(user.id),
                token,
              });
              if (!pendingRes.ok) {
                Alert.alert(t('dealroom.chat.alerts.warning'), pendingRes.error || t('dealroom.chat.reserveWithdraw.statusFailed'));
              }
              await fetchMessages();
              await fetchDealSnapshot();
            } catch {
              Alert.alert(t('common.error'), t('dealroom.chat.reserveWithdraw.failed'));
            }
          },
        },
      ]
    );
  }, [token, dealId, resolvedOfferId, user?.id, fetchMessages, fetchDealSnapshot]);

  const submitFinalReviewRequest = useCallback(async () => {
    if (!token || !dealId || !user?.id) return;
    if (!transactionFinalized) return;
    if (!counterpartyUserId) {
      Alert.alert(t('dealroom.chat.alerts.missingData'), t('dealroom.chat.review.missingCounterparty'));
      return;
    }
    if (myFinalRating < 1 || myFinalRating > 5) {
      Alert.alert(t('dealroom.chat.alerts.rating'), t('dealroom.chat.review.pickStars'));
      return;
    }
    setIsSubmittingFinalReview(true);
    try {
      const reviewPayload = buildSharedDealReviewPayload({
        dealId: Number(dealId),
        targetId: Number(counterpartyUserId),
        rating: myFinalRating,
        review: myFinalReview.trim(),
        senderId: Number(user.id), // optional/meta, backend reviewer = auth session
      });
      if (!reviewPayload) {
        Alert.alert(t('common.error'), t('dealroom.chat.review.invalidPayload'));
        return;
      }
      let res = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewPayload),
      });
      if (!res.ok && [404, 405].includes(res.status)) {
        res = await fetch(`${API_URL}/api/reviews/submit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reviewPayload),
        });
      }
      // Wspólna logika: stempelka „już oceniłem" pokazujemy zawsze, gdy backend
      // potwierdził zapis ALBO zwrócił duplikat — formularz znika i nie pojawia
      // się żaden pop-up.
      const persistLocalReview = async () => {
        const cached = {
          rating: reviewPayload.rating,
          review: reviewPayload.review || '',
          senderId: reviewPayload.senderId ?? Number(user.id),
        };
        setMySubmittedReview(cached);
        const key = dealReviewCacheKey(dealId, user.id);
        if (key) {
          try {
            await AsyncStorage.setItem(key, JSON.stringify(cached));
          } catch {
            // cache best-effort — UI nadal pokaże stamp w tej sesji
          }
        }
      };

      if (!res.ok) {
        const errBody = await res.text();
        const normalized = String(errBody || '').toLowerCase();
        const isDuplicate =
          res.status === 409 ||
          normalized.includes('already') ||
          normalized.includes('już') ||
          normalized.includes('exists') ||
          normalized.includes('wystaw');
        if (isDuplicate) {
          await persistLocalReview();
          await fetchMessages();
          // brak alertu — formularz znika i tyle, zgodnie z UX
          return;
        }
        Alert.alert(t('common.error'), errBody || t('dealroom.chat.review.saveFailed'));
        return;
      }
      await persistLocalReview();
      try {
        await postDealroomTextMessage({
          dealId: Number(dealId),
          token,
          content: `${DEAL_REVIEW_PREFIX}${JSON.stringify(reviewPayload)}`,
        });
      } catch {
        // wpis w wątku ułatwia drugiej stronie zobaczenie formularza opinii
      }
      await fetchMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // brak alertu — UI od razu pokazuje stempel „Pomyślnie wystawiono opinię"
    } finally {
      setIsSubmittingFinalReview(false);
    }
  }, [token, dealId, user?.id, transactionFinalized, myFinalRating, myFinalReview, fetchMessages, counterpartyUserId]);

  const handleSubmitFinalReview = useCallback(() => {
    if (!token || !dealId || !user?.id) return;
    if (!transactionFinalized) return;
    if (!counterpartyUserId) {
      Alert.alert(t('dealroom.chat.alerts.missingData'), t('dealroom.chat.review.missingCounterparty'));
      return;
    }
    if (myFinalRating < 1 || myFinalRating > 5) {
      Alert.alert(t('dealroom.chat.alerts.rating'), t('dealroom.chat.review.pickStars'));
      return;
    }
    const trimmedReview = myFinalReview.trim();
    if (trimmedReview.length > 1000) {
      Alert.alert(t('common.error'), t('dealroom.chat.review.maxLength'));
      return;
    }
    Alert.alert(
      t('dealroom.chat.review.confirmTitle'),
      t('dealroom.chat.review.confirmBody', {
        rating: myFinalRating,
        comment: trimmedReview ? t('dealroom.chat.review.commentAdded') : t('dealroom.chat.review.commentNone'),
      }),
      [{ text: t('common.back'), style: 'cancel' },
        {
          text: t('dealroom.chat.review.confirmSend'),
          style: 'default',
          onPress: () => {
            void submitFinalReviewRequest();
          },
        },
      ]
    );
  }, [token, dealId, user?.id, transactionFinalized, counterpartyUserId, myFinalRating, myFinalReview, submitFinalReviewRequest]);

  useEffect(() => {
    if (appointmentStatus === 'PENDING') {
      appointmentAttentionPulse.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 520 }), withTiming(1, { duration: 520 })),
        -1,
        false
      );
    } else {
      appointmentAttentionPulse.value = withTiming(1, { duration: 220 });
    }
    if (appointmentStatus === 'ACCEPTED') {
      appointmentSuccessNudge.value = withSequence(
        withTiming(-12, { duration: 90 }),
        withTiming(12, { duration: 120 }),
        withTiming(-8, { duration: 100 }),
        withTiming(0, { duration: 120 })
      );
    }
  }, [appointmentStatus, appointmentAttentionPulse, appointmentSuccessNudge]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!dealId) return;

    if (appointmentStatus !== 'ACCEPTED' || !acceptedAppointment?.event?.proposedDate) {
      void cancelPresentationTwoHourReminder(dealId);
      return;
    }

    const raw = String(acceptedAppointment.event.proposedDate);
    const end = new Date(raw).getTime();
    if (!Number.isFinite(end)) return;

    if (end <= Date.now()) {
      void cancelPresentationTwoHourReminder(dealId);
      return;
    }

    void schedulePresentationTwoHourReminder({
      dealId,
      offerId: resolvedOfferId,
      presentationIso: raw,
      listingTitle: title,
    });
  }, [appointmentStatus, acceptedAppointment?.event?.proposedDate, dealId, resolvedOfferId, title]);

  useEffect(() => {
    if (priceStatus === 'PENDING') {
      priceAttentionPulse.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 520 }), withTiming(1, { duration: 520 })),
        -1,
        false
      );
    } else {
      priceAttentionPulse.value = withTiming(1, { duration: 220 });
    }
    if (priceStatus === 'ACCEPTED') {
      priceSuccessNudge.value = withSequence(
        withTiming(-12, { duration: 90 }),
        withTiming(12, { duration: 120 }),
        withTiming(-8, { duration: 100 }),
        withTiming(0, { duration: 120 })
      );
    }
  }, [priceStatus, priceAttentionPulse, priceSuccessNudge]);

  useEffect(() => {
    const entries = negotiationEvents.map((entry) => {
      const key = String(
        firstDefined(
          entry.msg?.id,
          `${entry.event?.entity}-${entry.event?.action}-${entry.msg?.createdAt}-${entry.msg?.senderId}-${entry.event?.amount}-${entry.event?.proposedDate}`
        )
      );
      return { key, entry };
    });

    if (!negotiationBootstrappedRef.current) {
      entries.forEach(({ key }) => seenNegotiationEventKeysRef.current.add(key));
      negotiationBootstrappedRef.current = true;
      return;
    }

    entries.forEach(({ key, entry }) => {
      if (seenNegotiationEventKeysRef.current.has(key)) return;
      seenNegotiationEventKeysRef.current.add(key);
      const action = String(entry.event?.action || '').toUpperCase();
      const entity = String(entry.event?.entity || '').toUpperCase();
      if (
        entity === 'APPOINTMENT' &&
        action === 'ACCEPTED' &&
        entry.event?.proposedDate &&
        token
      ) {
        void offerPresentationCalendarAfterAcceptance({
          token,
          dealId: dealId ?? '',
          offerId: resolvedOfferId,
          proposedDateIso: String(entry.event.proposedDate),
          fallbackTitle: title,
          viewerUserId: user?.id,
          viewerEmail: user?.email ?? null,
          viewerPhone:
            user?.phone && String(user.phone).trim() !== '' && user.phone !== 'Brak numeru'
              ? user.phone
              : null,
        });
      }

      const fromOther = String(entry.msg?.senderId ?? '') !== String(user?.id ?? '');
      if (!fromOther || !['PROPOSED', 'COUNTERED'].includes(action)) return;

      const who = formatActorLabel(entry.msg, user?.id);
      const isPrice = entry.event?.entity === 'BID';
      const body = isPrice
        ? t('dealroom.chat.eventProposedPriceBy', { who, amount: Number(entry.event?.amount || 0).toLocaleString('pl-PL') })
        : t('dealroom.chat.eventProposedAppointmentBy', { who });

      /** Jeden stos na iOS per klient (nadawca); fallback: jeden stos per dealroom. */
      const peerId = entry.msg?.senderId;
      const threadIdentifier =
        peerId != null && String(peerId).trim() !== ''
          ? `estateos-peer-${String(peerId)}`
          : `estateos-deal-${String(dealId ?? '')}`;

      void Notifications.scheduleNotificationAsync({
        content: {
          title: isPrice ? t('dealroom.chat.eventProposedPrice') : t('dealroom.chat.eventProposedAppointment'),
          body,
          subtitle: dealId ? `Transakcja #${dealId}` : undefined,
          threadIdentifier,
          data: {
            target: 'dealroom',
            dealId,
            offerId: resolvedOfferId || undefined,
            threadIdentifier,
            deeplink: `estateos://dealroom/${dealId}`,
          },
        } as Notifications.NotificationContentInput,
        trigger: null,
      });
    });
  }, [dealId, negotiationEvents, resolvedOfferId, user?.id, token, title]);

  const handleAcceptAppointment = async (event: any) => {
    const appointmentId = Number(
      event?.appointmentId ??
      event?.id ??
      event?.eventId ??
      event?.targetId ??
      event?.appointment?.id ??
      0
    );
    if (!token || !dealId) {
      Alert.alert(t('dealroom.chat.alerts.noSession'), t('dealroom.chat.errors.noSession'));
      return;
    }
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      Alert.alert(t('dealroom.chat.alerts.missingAppointmentId'), t('dealroom.chat.errors.missingAppointmentId'));
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/actions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'APPOINTMENT_RESPOND',
          appointmentId,
          decision: 'ACCEPT',
          message: t('dealroom.chat.acceptAppointmentMessage'),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        Alert.alert(t('common.error'), body || t('dealroom.chat.errors.acceptAppointment'));
        return;
      }
      await fetchMessages();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('dealroom.chat.errors.acceptAppointment'));
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <ChevronLeft size={28} color={COLORS.textBase} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>{t('dealroom.chat.transactionHeader', { id: dealId })}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
        {counterpartyUserId ? (
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setIsMoreMenuOpen(true); }}
            style={({ pressed }) => [styles.headerMenuBtn, pressed && { opacity: 0.6 }]}
            hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('dealroom.chat.moreOptionsA11y')}
          >
            <MoreHorizontal size={22} color={COLORS.textBase} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loaderCenter}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatScrollView}
            contentContainerStyle={styles.chatScrollContent}
            showsVerticalScrollIndicator
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            bounces
          >
          <View style={styles.negotiationPanel}>
            
            {/* Terminy */}
            <Pressable style={styles.negotiationRow} onPress={() => { Haptics.selectionAsync(); setAppointmentSectionExpanded(!appointmentSectionExpanded); }}>
              <Animated.View
                style={[
                  styles.negotiationIconWrap,
                  appointmentStatus === 'IDLE'
                    ? styles.negotiationIconIdle
                    : appointmentStatus === 'PENDING'
                      ? styles.negotiationIconPending
                      : styles.negotiationIconAccepted,
                  appointmentIconAnim,
                ]}
              >
                <CalendarClock
                  size={16}
                  color={
                    appointmentStatus === 'IDLE'
                      ? '#8E8E93'
                      : appointmentStatus === 'PENDING'
                        ? '#FFD60A'
                        : COLORS.primary
                  }
                />
              </Animated.View>
              <View style={styles.negotiationTextWrap}>
                <Text style={styles.negotiationTitle}>{t('dealroom.chat.appointmentSection')}</Text>
                <Text style={styles.negotiationState}>{appointmentStatusText}</Text>
                {appointmentStatus === 'ACCEPTED' &&
                  acceptedAppointment?.event?.proposedDate &&
                  !presentationHappened && (
                    <PresentationCountdown
                      presentationIso={String(acceptedAppointment.event.proposedDate)}
                      variant="panel"
                    />
                  )}
              </View>
              <Text style={styles.negotiationCaret}>{appointmentSectionExpanded ? '−' : '+'}</Text>
            </Pressable>
            
            {appointmentSectionExpanded && (
              <View style={styles.negotiationExpanded}>
                {appointmentEvents.length === 0 ? (
                  <Text style={styles.negotiationExpandedText}>{t('dealroom.chat.noAppointmentProposals')}</Text>
                ) : (
                  <View style={styles.timelineWrap}>
                    {appointmentEvents.map((entry, idx) => {
                      const isLast = idx === appointmentEvents.length - 1;
                      const actor = formatActorLabel(entry.msg, user?.id);
                      const action = String(entry.event?.action || '').toUpperCase();
                      const actionLabel =
                        action === 'ACCEPTED' ? t('dealroom.chat.appointmentActions.accepted') :
                        action === 'COUNTERED' ? t('dealroom.chat.appointmentActions.countered') :
                        action === 'REJECTED' ? t('dealroom.chat.appointmentActions.rejected') :
                        t('dealroom.chat.appointmentActions.proposed');
                      const dateText = entry.event?.proposedDate
                        ? new Date(entry.event.proposedDate).toLocaleString('pl-PL')
                        : t('dealroom.chat.noDate');
                      const noteText = String(firstDefined(entry.event?.note, entry.event?.message, '') || '').trim();
                      return (
                        <View key={`appt-${entry.msg?.id || idx}`} style={styles.timelineRow}>
                          <View style={styles.timelineRail}>
                            <View style={styles.timelineDot} />
                            {!isLast && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineMainText}>{actor} {actionLabel}: {dateText}</Text>
                            {noteText ? <Text style={styles.timelineNoteText}>„{noteText}”</Text> : null}
                            <Text style={styles.timelineMetaText}>
                              {new Date(entry.msg?.createdAt || Date.now()).toLocaleString('pl-PL')}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {appointmentStatus === 'ACCEPTED' && (
                  <View style={styles.royalSealWrap}>
                    <View style={styles.royalSealOuter}>
                      <Text style={styles.royalSealTop}>ESTATEOS™</Text>
                      <Text style={styles.royalSealMain}>{t('dealroom.chat.seals.appointmentAccepted')}</Text>
                      <Text style={styles.royalSealBottom}>{t('dealroom.chat.seals.appointmentAcceptedSub')}</Text>
                    </View>
                  </View>
                )}
                {latestActionableAppointmentFromOther && !isAppointmentProposalLocked && appointmentStatus !== 'ACCEPTED' && !transactionFinalized && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void handleAcceptAppointment(latestActionableAppointmentFromOther.event);
                      }}
                    >
                      <Text style={styles.actionPrimaryTxt}>{t('dealroom.chat.accept')}</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.actionBtn, styles.actionSecondary]} 
                      onPress={() => {
                        setSelectedAppointmentEvent(latestActionableAppointmentFromOther.event);
                        // Wzbogacamy historię o `senderId` z wiadomości — modal używa go do
                        // wykrycia, czy ostatnia propozycja terminu pochodzi od „mnie".
                        setSelectedAppointmentHistory(
                          appointmentEvents.map((e) => ({ ...e.event, senderId: e.msg?.senderId ?? null })),
                        );
                      }}
                    >
                      <Text style={styles.actionSecondaryTxt}>{t('dealroom.chat.change')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <View style={styles.negotiationDivider} />

            {/* Ceny */}
            <Pressable style={styles.negotiationRow} onPress={() => { Haptics.selectionAsync(); setPriceSectionExpanded(!priceSectionExpanded); }}>
              <Animated.View
                style={[
                  styles.negotiationIconWrap,
                  priceStatus === 'IDLE'
                    ? styles.negotiationIconIdle
                    : priceStatus === 'PENDING'
                      ? styles.negotiationIconPending
                      : styles.negotiationIconAccepted,
                  priceIconAnim,
                ]}
              >
                <HandCoins
                  size={16}
                  color={priceStatus === 'IDLE' ? '#8E8E93' : priceStatus === 'PENDING' ? '#FFD60A' : COLORS.primary}
                />
              </Animated.View>
              <View style={styles.negotiationTextWrap}>
                <Text style={styles.negotiationTitle}>{t('dealroom.chat.priceSection')}</Text>
                <Text style={styles.negotiationState}>{priceStatusText}</Text>
              </View>
              <Text style={styles.negotiationCaret}>{priceSectionExpanded ? '−' : '+'}</Text>
            </Pressable>

            {priceSectionExpanded && (
              <View style={styles.negotiationExpanded}>
                {bidEvents.length === 0 ? (
                  <Text style={styles.negotiationExpandedText}>{t('dealroom.chat.noPriceProposals')}</Text>
                ) : (
                  <View style={styles.timelineWrap}>
                    {bidEvents.map((entry, idx) => {
                      const isLast = idx === bidEvents.length - 1;
                      const actor = formatActorLabel(entry.msg, user?.id);
                      const action = String(entry.event?.action || '').toUpperCase();
                      const actionLabel =
                        action === 'ACCEPTED' ? t('dealroom.chat.bidActions.accepted') :
                        action === 'COUNTERED' ? t('dealroom.chat.bidActions.countered') :
                        action === 'REJECTED' ? t('dealroom.chat.bidActions.rejected') :
                        t('dealroom.chat.bidActions.proposed');
                      const amountText = Number(entry.event?.amount || 0) > 0
                        ? `${Number(entry.event.amount).toLocaleString('pl-PL')} PLN`
                        : 'brak kwoty';
                      const noteText = String(firstDefined(entry.event?.note, entry.event?.message, '') || '').trim();
                      return (
                        <View key={`bid-${entry.msg?.id || idx}`} style={styles.timelineRow}>
                          <View style={styles.timelineRail}>
                            <View style={styles.timelineDot} />
                            {!isLast && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineMainText}>{actor} {actionLabel}: {amountText}</Text>
                            {noteText ? <Text style={styles.timelineNoteText}>„{noteText}”</Text> : null}
                            <Text style={styles.timelineMetaText}>
                              {new Date(entry.msg?.createdAt || Date.now()).toLocaleString('pl-PL')}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {priceStatus === 'ACCEPTED' && (
                  <View style={styles.royalSealWrap}>
                    <View style={styles.royalSealOuter}>
                      <Text style={styles.royalSealTop}>ESTATEOS™</Text>
                      <Text style={styles.royalSealMain}>{transactionFinalized ? t('dealroom.chat.seals.priceFinalized') : t('dealroom.chat.seals.priceAccepted')}</Text>
                      <Text style={styles.royalSealBottom}>
                        CENA OSTATECZNA: {acceptedPrice.toLocaleString('pl-PL')} PLN
                      </Text>
                    </View>
                  </View>
                )}
                {/*
                  GAŁĄŹ 1 — kupujący wysłał finalną akceptację i czeka.
                  Zamiast Zgoda/Kontroferta (które byłyby semantycznie błędne —
                  nie da się akceptować swojej własnej akceptacji) pokazujemy
                  spokojny neon „bicie serca" potwierdzający, że piłeczka
                  jest po stronie właściciela.
                */}
                {isBuyerWaitingOnOwnerDecision && priceStatus !== 'ACCEPTED' && !transactionFinalized ? (
                  <HeartbeatWaitingPulse
                    amount={finalAcceptanceContext?.amount ?? null}
                    headline={t('dealroom.chat.heartbeat.headline')}
                    sublabel={t('dealroom.chat.heartbeat.sublabel')}
                  />
                ) : null}

                {/*
                  GAŁĄŹ 2 — właściciel ma do podjęcia finalną decyzję.
                  Pokazujemy uroczystą pigułkę „Ostateczna decyzja sprzedaży"
                  zamiast zwykłych przycisków negocjacji — kliknięcie otwiera
                  `FinalConfirmationModal` z dużą kwotą i pytaniem
                  POTWIERDZAM / NIE POTWIERDZAM.
                */}
                {ownerNeedsFinalDecision && priceStatus !== 'ACCEPTED' && !transactionFinalized ? (
                  <OwnerFinalDecisionCta
                    amount={Number(finalAcceptanceContext?.amount || 0)}
                    onPress={() => setIsFinalConfirmOpen(true)}
                  />
                ) : null}

                {/*
                  GAŁĄŹ 3 — standardowe Zgoda/Kontroferta. Pokazujemy je TYLKO
                  jeśli żaden ze stanów „finalnej akceptacji" nie jest aktywny.
                  Bez tego dodatkowego warunku przyciski czasem migały razem
                  z neonem (np. gdy `latestActionableBidFromOther` to wcześniejszy
                  bid, ale ostatnia akcja to już finalna akceptacja).
                */}
                {actionableBidContext && acceptedPrice === 0 && priceStatus !== 'ACCEPTED' && !transactionFinalized && !isWaitingForOtherOnPrice && !isBuyerWaitingOnOwnerDecision && !ownerNeedsFinalDecision && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => {
                        const bidId = resolveEventBidId(actionableBidContext.event) ?? bidNegotiationSnapshot?.respondToBidId;
                        setSelectedBidEvent({
                          ...actionableBidContext.event,
                          bidId,
                          amount: actionableBidContext.event?.amount ?? bidNegotiationSnapshot?.respondToBidAmount,
                          quickAccept: true,
                        });
                        setSelectedBidHistory(
                          bidEvents.map((e) => ({ ...e.event, senderId: e.msg?.senderId ?? null })),
                        );
                      }}
                    >
                      <Text style={styles.actionPrimaryTxt}>{t('dealroom.chat.agree')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionSecondary]}
                      onPress={() => {
                        const bidId = resolveEventBidId(actionableBidContext.event) ?? bidNegotiationSnapshot?.respondToBidId;
                        setSelectedBidEvent({
                          ...actionableBidContext.event,
                          bidId,
                          amount: actionableBidContext.event?.amount ?? bidNegotiationSnapshot?.respondToBidAmount,
                        });
                        setSelectedBidHistory(
                          bidEvents.map((e) => ({ ...e.event, senderId: e.msg?.senderId ?? null })),
                        );
                      }}
                    >
                      <Text style={styles.actionSecondaryTxt}>{t('dealroom.chat.counter')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {showPostPresentationReserve && !transactionFinalized ? (
            <View style={styles.reserveAfterPresentation}>
              <BlurView intensity={50} tint="dark" style={styles.reserveAfterPresentationInner}>
                <Text style={styles.reserveAfterPresentationTitle}>{t('dealroom.chat.postPresentation.title')}</Text>
                <Text style={styles.reserveAfterPresentationBody}>{t('dealroom.chat.postPresentation.body')}</Text>
                <Pressable
                  style={({ pressed }) => [styles.reserveAfterPresentationBtn, pressed && { opacity: 0.92 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    void handlePostPresentationReserve();
                  }}
                >
                  <Text style={styles.reserveAfterPresentationBtnTxt}>{t('dealroom.chat.postPresentation.cta')}</Text>
                </Pressable>
              </BlurView>
            </View>
          ) : null}

            {transactionFinalized ? (
              <View style={styles.finalizedWrap}>
                <BlurView intensity={72} tint="dark" style={styles.finalizedInner}>
                  <Text style={styles.finalizedTitle}>{t('dealroom.chat.finalized.title')}</Text>
                  <Text style={styles.finalizedSubtitle}>{t('dealroom.chat.finalized.subtitle')}</Text>
                  <Text style={styles.finalizedSectionLabel}>{t('dealroom.chat.finalized.reviewTargetLabel')}</Text>
                  <Pressable style={styles.reviewTargetRow} onPress={() => void openCounterpartyReviews()}>
                    <Text style={styles.reviewTargetName}>{counterpartyName}</Text>
                    <Text style={styles.reviewTargetHint}>{t('dealroom.chat.finalized.reviewTargetHint')}</Text>
                  </Pressable>
                  {reviewSubmitted ? (
                    <View style={styles.reviewSuccessStamp}>
                      <Text style={styles.reviewSuccessStampIcon}>✓</Text>
                      <Text style={styles.reviewSuccessStampText}>{t('dealroom.chat.finalized.reviewSuccess')}</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.ratingRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Pressable
                            key={`star-${star}`}
                            onPress={() => setMyFinalRating(star)}
                            style={({ pressed }) => [styles.starBtn, pressed && { opacity: 0.85 }]}
                          >
                            <Text style={[styles.starGlyph, myFinalRating >= star && styles.starGlyphOn]}>★</Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        value={myFinalReview}
                        onChangeText={setMyFinalReview}
                        placeholder={t('dealroom.chat.finalized.reviewPlaceholder')}
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.finalizedInput}
                        multiline
                        onFocus={() => {
                          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
                        }}
                      />
                      <Pressable
                        style={[styles.finalizedBtn, (isSubmittingFinalReview || myFinalRating < 1) && styles.finalizedBtnDisabled]}
                        onPress={handleSubmitFinalReview}
                        disabled={isSubmittingFinalReview || myFinalRating < 1}
                      >
                        {isSubmittingFinalReview ? (
                          <ActivityIndicator color="#041208" />
                        ) : (
                          <Text style={styles.finalizedBtnTxt}>{t('dealroom.chat.finalized.submitReview')}</Text>
                        )}
                      </Pressable>
                    </>
                  )}
                  {partnerFinalReviewEntry && reviewRevealUnlocked ? (
                    <View style={styles.partnerReviewCard}>
                      <Text style={styles.partnerReviewTitle}>{t('dealroom.chat.finalized.partnerReviewTitle')}</Text>
                      <Text style={styles.partnerReviewStars}>{'★'.repeat(partnerFinalReviewEntry.rating)}{'☆'.repeat(5 - partnerFinalReviewEntry.rating)}</Text>
                      {partnerFinalReviewEntry.review ? (
                        <Text style={styles.partnerReviewBody}>„{partnerFinalReviewEntry.review}”</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.partnerReviewPending}>
                      {partnerFinalReviewEntry
                        ? 'Ocena drugiej strony odblokuje się po Twojej opinii lub po 14 dniach od finalizacji.'
                        : 'Druga strona jeszcze nie dodała swojej opinii. Po 14 dniach uruchamia się domknięcie systemowe.'}
                    </Text>
                  )}
                </BlurView>
              </View>
            ) : null}

            {messages.map((msg, index) => {
              const isMe = String(msg.senderId ?? '') === String(user?.id ?? '');
              const dealEvent = parseDealEvent(msg);
              if (dealEvent?.entity === 'BID' || dealEvent?.entity === 'APPOINTMENT') return null;
              if (String(msg?.content || '').trim().startsWith(DEAL_REVIEW_PREFIX)) return null;
              
              const attachment = resolveAttachmentFromMessage(msg);
              const visibleText = stripChatAttachmentDecorations(msg.content, attachment);
              const kind = attachment ? getAttachmentKind(attachment) : null;

              return (
                <Animated.View key={msg.id} entering={FadeInDown.delay(index * 15).springify()} style={[styles.msgWrapper, isMe ? styles.msgMe : styles.msgThem]}>
                  <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                    {visibleText ? <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{visibleText}</Text> : null}
                    
                    {attachment && (
                      <Pressable
                        style={styles.attachmentBox}
                        onPress={async () => {
                          if (kind === 'audio') return;
                          await Linking.openURL(attachment.url).catch(() => Alert.alert(t('common.error'), t('dealroom.chat.errors.openFile')));
                        }}
                      >
                        <View style={[styles.attachmentIconBox, kind === 'pdf' ? styles.pdfBg : styles.fileBg]}>
                          {kind === 'pdf' ? <FileText size={16} color="#FFF" /> : kind === 'audio' ? <Paperclip size={16} color="#FFF" /> : <Paperclip size={16} color="#FFF" />}
                        </View>
                        <View style={styles.attachmentInfo}>
                          <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                          <Text style={styles.attachmentMeta}>{formatBytes(attachment.size)}</Text>
                        </View>
                        {kind === 'audio' && (
                          <Pressable onPress={(e) => { e.stopPropagation(); handleToggleAudioPreview(attachment.url); }} style={styles.audioBtn}>
                            {playingAudioUrl === attachment.url ? <Pause size={14} color="#fff" /> : <Play size={14} color="#fff" />}
                          </Pressable>
                        )}
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.msgFooter}>
                    <Text style={styles.msgTime}>{new Date(msg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</Text>
                    {isMe && <View style={{marginLeft: 4}}>{msg.isRead ? <CheckCheck size={14} color={COLORS.primary} /> : <Check size={14} color={COLORS.textMuted} />}</View>}
                  </View>
                </Animated.View>
              );
            })}

            {isPartnerTyping && (
              <Animated.View entering={FadeIn} style={[styles.msgWrapper, styles.msgThem]}>
                <View style={[styles.msgBubble, styles.msgBubbleThem, styles.typingBubble]}>
                  <TypingDot delay={0} /><TypingDot delay={150} /><TypingDot delay={300} />
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </>
      )}

      {/* Input Area */}
      <BlurView intensity={80} tint="dark" style={styles.inputArea}>
          
          {pendingAttachment && (
            <Animated.View style={[styles.pendingPill, isUploadingAttachment && uploadingPillAnim]}>
              <View style={styles.pendingInfo}>
                <Paperclip size={14} color={COLORS.primary} style={{marginRight: 6}} />
                <Text style={styles.pendingText} numberOfLines={1}>{pendingAttachment.name}</Text>
              </View>
              {isUploadingAttachment ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Pressable onPress={() => setPendingAttachment(null)} hitSlop={15} style={styles.pendingClose}>
                  <Text style={styles.pendingCloseTxt}>×</Text>
                </Pressable>
              )}
            </Animated.View>
          )}

          <View style={styles.inputRow}>
            <Pressable style={styles.attachBtn} onPress={handlePickAttachment} disabled={isUploadingAttachment}>
              <Paperclip size={22} color={pendingAttachment ? COLORS.primary : COLORS.textMuted} />
            </Pressable>
            
            <TextInput
              style={styles.textInput}
              placeholder={t('dealroom.chat.messagePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={handleTyping}
              multiline
              returnKeyType="send"
              blurOnSubmit={false}
              submitBehavior="submit"
              onSubmitEditing={() => {
                void handleSend();
              }}
              onFocus={() => {
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
              }}
            />
            
            <Pressable 
              style={[styles.sendBtn, (message.trim() || pendingAttachment) && styles.sendBtnActive]} 
              onPress={handleSend} 
              disabled={isUploadingAttachment}
            >
              {isUploadingAttachment ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color={(message.trim() || pendingAttachment) ? '#fff' : 'rgba(255,255,255,0.4)'} />}
            </Pressable>
          </View>
      </BlurView>

      {/* Modals */}
      <BidActionModal
        visible={!!selectedBidEvent}
        mode="respond"
        dealId={dealId ? Number(dealId) : null}
        token={token || null}
        bidId={
          resolveEventBidId(selectedBidEvent) ??
          bidNegotiationSnapshot?.respondToBidId ??
          null
        }
        initialAmount={
          selectedBidEvent?.amount ||
          selectedBidEvent?.counterAmount ||
          selectedBidEvent?.value ||
          bidNegotiationSnapshot?.respondToBidAmount ||
          null
        }
        eventAction={selectedBidEvent?.action || null}
        quickAccept={Boolean(selectedBidEvent?.quickAccept)}
        history={selectedBidHistory}
        myUserId={user?.id != null ? Number(user.id) : null}
        title="Ustalenia cenowe"
        offerId={resolvedOfferId != null ? Number(resolvedOfferId) : null}
        userId={user?.id != null ? Number(user.id) : null}
        isListingOwner={isListingOwner}
        listingOwnerUserId={listingOwnerUserId}
        onClose={() => setSelectedBidEvent(null)}
        onDone={async () => {
          await fetchMessages();
          await fetchDealSnapshot();
        }}
      />

      <AppointmentActionModal
        visible={!!selectedAppointmentEvent}
        mode="respond"
        dealId={dealId ? Number(dealId) : null}
        token={token || null}
        appointmentId={selectedAppointmentEvent?.appointmentId || null}
        eventAction={selectedAppointmentEvent?.action || null}
        proposedDate={selectedAppointmentEvent?.proposedDate || null}
        history={selectedAppointmentHistory}
        myUserId={user?.id != null ? Number(user.id) : null}
        title="Termin prezentacji"
        onClose={() => {
          setSelectedAppointmentEvent(null);
        }}
        onDone={async () => {
          await fetchMessages();
          await fetchDealSnapshot();
        }}
      />

      {/*
        Modal „Ostatecznej decyzji" — otwiera się WYŁĄCZNIE dla właściciela,
        gdy kupujący wysłał finalną akceptację (`ownerNeedsFinalDecision`).
        Zastępuje standardowy `BidActionModal` w tym jednym, finalnym kroku.
      */}
      <FinalConfirmationModal
        visible={isFinalConfirmOpen && ownerNeedsFinalDecision && !!finalAcceptanceContext}
        dealId={dealId ? Number(dealId) : null}
        bidId={finalAcceptanceContext?.bidId || null}
        amount={Number(finalAcceptanceContext?.amount || 0)}
        token={token || null}
        offerId={resolvedOfferId != null ? Number(resolvedOfferId) : null}
        buyerLabel={(() => {
          const last = finalAcceptanceContext?.bidEvent;
          if (!last) return null;
          return formatActorLabel(last.msg, user?.id);
        })()}
        onClose={() => setIsFinalConfirmOpen(false)}
        onDone={async () => {
          await fetchMessages();
          await fetchDealSnapshot();
        }}
      />
      <Modal
        visible={isCounterpartyReviewsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCounterpartyReviewsOpen(false)}
      >
        <View style={styles.reviewModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsCounterpartyReviewsOpen(false)} />
          <View style={styles.reviewModalCard}>
            <Text style={styles.reviewModalTitle}>{t('dealroom.chat.reviewModal.title')}</Text>
            <Text style={styles.reviewModalSubtitle}>{counterpartyName}</Text>
            {counterpartyProfileLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                {(Array.isArray(counterpartyPublicProfile?.reviews) ? counterpartyPublicProfile.reviews : []).slice(0, 8).map((r: any, idx: number) => (
                  <View key={`cp-rev-${r?.id || idx}`} style={styles.reviewItem}>
                    <Pressable
                      onPress={() => void openPublicReviewsProfile(Number(r?.reviewerId || 0), r?.reviewerName)}
                      style={({ pressed }) => [styles.reviewItemAuthorBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.reviewItemAuthorText}>
                        {r?.reviewerName || t('dealroom.user.numbered', { id: r?.reviewerId || '-' })}
                      </Text>
                    </Pressable>
                    <Text style={styles.reviewItemStars}>{'★'.repeat(Number(r?.rating || 0))}{'☆'.repeat(5 - Number(r?.rating || 0))}</Text>
                    <Text style={styles.reviewItemBody}>{r?.comment || r?.review || t('dealroom.chat.reviewModal.noComment')}</Text>
                  </View>
                ))}
                {(!Array.isArray(counterpartyPublicProfile?.reviews) || counterpartyPublicProfile.reviews.length === 0) ? (
                  <Text style={styles.reviewModalEmpty}>{t('dealroom.chat.reviewModal.empty')}</Text>
                ) : null}
              </ScrollView>
            )}
            <Pressable style={styles.reviewModalCloseBtn} onPress={() => setIsCounterpartyReviewsOpen(false)}>
              <Text style={styles.reviewModalCloseTxt}>{t('dealroom.chat.reviewModal.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Apple Guideline 1.2 — UGC: Report + Block. */}
      <Modal
        visible={isMoreMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMoreMenuOpen(false)}
      >
        <Pressable style={styles.moreOverlay} onPress={() => setIsMoreMenuOpen(false)}>
          <View style={styles.moreSheet}>
            <Pressable
              onPress={() => {
                setIsMoreMenuOpen(false);
                setTimeout(() => setIsReportOpen(true), 180);
              }}
              style={({ pressed }) => [styles.moreItem, pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }]}
              accessibilityRole="button"
            >
              <Flag color="#FF9F0A" size={18} />
              <Text style={styles.moreItemText}>{t('dealroom.chat.moreMenu.report')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setIsMoreMenuOpen(false);
                setTimeout(() => setIsBlockOpen(true), 180);
              }}
              style={({ pressed }) => [
                styles.moreItem,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
                pressed && { backgroundColor: 'rgba(255,255,255,0.05)' },
              ]}
              accessibilityRole="button"
            >
              <Ban color={COLORS.danger} size={18} />
              <Text style={styles.moreItemText}>{t('dealroom.chat.moreMenu.block')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsMoreMenuOpen(false)}
              style={({ pressed }) => [
                styles.moreCancel,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
                pressed && { backgroundColor: 'rgba(255,255,255,0.05)' },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.moreCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ReportSheet
        visible={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="user"
        targetId={Number(counterpartyUserId || 0)}
        targetLabel={counterpartyName ? t('dealroom.chat.targetLabel', { name: counterpartyName }) : undefined}
        token={token}
        isDark
      />

      <BlockUserSheet
        visible={isBlockOpen}
        onClose={() => setIsBlockOpen(false)}
        targetLabel={counterpartyName || undefined}
        affectsConversations
        isDark
        onConfirm={async () => {
          const targetId = Number(counterpartyUserId || 0);
          if (!targetId || !token || !user?.id) {
            return { ok: false, error: 'MISSING_CONTEXT' };
          }
          const result = await blockUser(targetId, token, user.id);
          if (result.ok) {
            setTimeout(() => navigation?.goBack?.(), 220);
          }
          return result;
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // Header
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingHorizontal: 16, paddingBottom: 16, 
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border 
  },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  backButtonPressed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTextContainer: { flex: 1, marginLeft: 8 },
  headerSubtitle: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { color: COLORS.textBase, fontSize: 18, fontWeight: '600', letterSpacing: 0.3 },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Sticky Panel (Premium Apple Look)
  negotiationPanel: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 16, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.surfaceElevated,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  reserveAfterPresentation: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.28)',
  },
  reserveAfterPresentationInner: {
    padding: 16,
    backgroundColor: 'rgba(28,28,30,0.92)',
  },
  reserveAfterPresentationTitle: {
    color: COLORS.textBase,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  reserveAfterPresentationBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
    fontWeight: '500',
  },
  reserveAfterPresentationBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reserveAfterPresentationBtnTxt: {
    color: '#081208',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  negotiationRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  negotiationDivider: { height: 1, backgroundColor: COLORS.surfaceElevated, marginHorizontal: 14 },
  negotiationIconWrap: { 
    width: 32, height: 32, borderRadius: 10, 
    backgroundColor: COLORS.primaryDimmed, 
    alignItems: 'center', justifyContent: 'center', marginRight: 12 
  },
  negotiationIconIdle: {
    backgroundColor: 'rgba(142,142,147,0.16)',
  },
  negotiationIconPending: {
    backgroundColor: 'rgba(255,214,10,0.16)',
    shadowColor: '#FFD60A',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  negotiationIconAccepted: {
    backgroundColor: COLORS.primaryDimmed,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.42,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  negotiationTextWrap: { flex: 1 },
  negotiationTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  negotiationState: { color: COLORS.textBase, fontSize: 14, fontWeight: '600', marginTop: 2 },
  negotiationCaret: { color: COLORS.textMuted, fontSize: 22, fontWeight: '300', paddingHorizontal: 8 },
  negotiationExpanded: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  negotiationExpandedText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  timelineWrap: { marginTop: 2, marginBottom: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 8 },
  timelineRail: { width: 14, alignItems: 'center', marginTop: 2 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  timelineLine: { width: 1.5, flex: 1, minHeight: 18, marginTop: 2, backgroundColor: 'rgba(255,255,255,0.16)' },
  timelineContent: { flex: 1, paddingLeft: 8 },
  timelineMainText: { color: COLORS.textBase, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  timelineNoteText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2, fontStyle: 'italic' },
  timelineMetaText: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  
  // Buttons in Panel
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionSecondary: { backgroundColor: COLORS.surfaceElevated },
  actionPrimaryTxt: { color: '#000', fontWeight: '700', fontSize: 13 },
  actionSecondaryTxt: { color: COLORS.textBase, fontWeight: '600', fontSize: 13 },

  royalSealWrap: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  royalSealOuter: {
    minWidth: 240,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.88)',
    backgroundColor: 'rgba(16,16,18,0.92)',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  royalSealTop: {
    color: 'rgba(212,175,55,0.94)',
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: '900',
  },
  royalSealMain: {
    color: '#F5E1A4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 1,
    marginBottom: 1,
  },
  royalSealBottom: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  finalizedWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.34)',
  },
  finalizedInner: {
    padding: 16,
    backgroundColor: 'rgba(14,22,16,0.92)',
  },
  finalizedTitle: { color: '#eaffef', fontSize: 17, fontWeight: '800', marginBottom: 6, letterSpacing: -0.2 },
  finalizedSubtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12, fontWeight: '500' },
  finalizedSectionLabel: { color: '#a8f1bf', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  reviewTargetRow: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  reviewTargetName: { color: COLORS.textBase, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  reviewTargetHint: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  reviewSuccessStamp: {
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.45)',
    backgroundColor: 'rgba(52,199,89,0.16)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewSuccessStampIcon: {
    color: '#B9F8CC',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  reviewSuccessStampText: {
    color: '#CFFCE0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  ratingRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  starBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  starGlyph: { color: 'rgba(255,255,255,0.38)', fontSize: 21, fontWeight: '900', lineHeight: 24 },
  starGlyphOn: { color: '#FFD60A' },
  finalizedInput: {
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: COLORS.textBase,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  finalizedBtn: {
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    marginBottom: 10,
  },
  finalizedBtnDisabled: { opacity: 0.45 },
  finalizedBtnTxt: { color: '#041208', fontSize: 13, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  partnerReviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  partnerReviewTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  partnerReviewStars: { color: '#FFD60A', fontSize: 15, fontWeight: '900', marginBottom: 4, letterSpacing: 0.4 },
  partnerReviewBody: { color: COLORS.textBase, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  partnerReviewPending: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  reviewModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#101214',
    padding: 16,
  },
  reviewModalTitle: { color: COLORS.textBase, fontSize: 16, fontWeight: '800' },
  reviewModalSubtitle: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12, marginTop: 2 },
  reviewItem: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    marginBottom: 8,
  },
  reviewItemAuthorBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  reviewItemAuthorText: { color: '#E5E7EB', fontSize: 12, fontWeight: '800' },
  reviewItemStars: { color: '#FFD60A', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  reviewItemBody: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  reviewModalEmpty: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', paddingVertical: 6 },
  reviewModalCloseBtn: {
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
  },
  reviewModalCloseTxt: { color: '#041208', fontSize: 13, fontWeight: '900' },

  // Chat Area
  chatScrollView: { flex: 1 },
  /** Panel negocjacji + czat w jednym scrollu — bez flexGrow (lepiej liczy się wysokość treści przy długich panelach). */
  chatScrollContent: { padding: 16, paddingBottom: 40 },
  msgWrapper: { marginBottom: 16, maxWidth: '82%' },
  msgMe: { alignSelf: 'flex-end' },
  msgThem: { alignSelf: 'flex-start' },
  msgBubble: { padding: 12, borderRadius: 20 },
  msgBubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: COLORS.surfaceElevated, borderBottomLeftRadius: 4 },
  msgText: { color: COLORS.textBase, fontSize: 16, lineHeight: 22 },
  msgTextMe: { color: '#000000', fontWeight: '500' }, // Ciemny tekst na zielonym dymku dla wyższego kontrastu
  msgFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end' },
  msgTime: { color: COLORS.textMuted, fontSize: 11, fontWeight: '500' },
  
  // Attachments in Chat
  attachmentBox: { 
    marginTop: 8, borderRadius: 12, padding: 8, 
    backgroundColor: 'rgba(0,0,0,0.15)', // Uniwersalny półprzezroczysty dla obu dymków
    flexDirection: 'row', alignItems: 'center', gap: 10 
  },
  attachmentIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pdfBg: { backgroundColor: COLORS.danger },
  fileBg: { backgroundColor: 'rgba(255,255,255,0.2)' },
  attachmentInfo: { flex: 1 },
  attachmentName: { color: COLORS.textBase, fontSize: 13, fontWeight: '600' },
  attachmentMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  audioBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  
  // Typing Indicator
  typingBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textMuted, marginHorizontal: 2 },
  
  // Input Area
  inputArea: { paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachBtn: { padding: 10, paddingBottom: 8 },
  textInput: { 
    flex: 1, minHeight: 40, maxHeight: 120, 
    backgroundColor: COLORS.surfaceElevated, 
    borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, 
    color: COLORS.textBase, fontSize: 16 
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  sendBtnActive: { backgroundColor: COLORS.primary },
  
  // Pending Attachment Pill
  pendingPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated, borderRadius: 12,
    padding: 10, marginBottom: 12, marginHorizontal: 8,
    borderWidth: 1, borderColor: COLORS.border
  },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  pendingText: { color: COLORS.textBase, fontSize: 13, fontWeight: '500' },
  pendingClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  pendingCloseTxt: { color: COLORS.textBase, fontSize: 16, fontWeight: '600', lineHeight: 18 },
  headerMenuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 26,
  },
  moreSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  moreItemText: { color: COLORS.textBase, fontSize: 16, fontWeight: '600' },
  moreCancel: { paddingVertical: 16, alignItems: 'center' },
  moreCancelText: { color: COLORS.textBase, fontSize: 16, fontWeight: '700' },
});