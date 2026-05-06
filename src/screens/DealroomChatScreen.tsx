import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  StyleSheet, View, Text, Pressable, TextInput, KeyboardAvoidingView, 
  Platform, ScrollView, ActivityIndicator, Alert, Linking 
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { 
  ChevronLeft, Send, Paperclip, Check, CheckCheck, 
  FileText, Play, Pause, CalendarClock, HandCoins 
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
import { useAuthStore } from '../store/useAuthStore';
import BidActionModal from '../components/dealroom/BidActionModal';
import AppointmentActionModal from '../components/dealroom/AppointmentActionModal';
import { API_URL } from '../config/network';
import { postDealroomTextMessage, setOfferStatusPending } from '../utils/dealroomOfferReserve';
import { setActiveDealroomContext } from '../utils/activeDealroomPush';
import { offerPresentationCalendarAfterAcceptance } from '../utils/presentationCalendar';
import {
  schedulePresentationTwoHourReminder,
  cancelPresentationTwoHourReminder,
} from '../utils/presentationReminderNotification';
import PresentationCountdown from '../components/dealroom/PresentationCountdown';
import {
  parseDealEvent,
  normalizeDealEvent,
  parseJsonMaybe,
} from '../utils/dealEventParse';
import {
  buildSharedDealReviewPayload,
  canFinalizeTransition,
  DEAL_REVIEW_PREFIX,
  isFinalizedOwnerAcceptanceMessage,
  validateSharedDealReviewPayload,
} from '../contracts/parityContracts';

// ==========================================
// CONSTANTS & HELPERS
// ==========================================

const ATTACHMENT_PREFIX = '[[DEAL_ATTACHMENT]]';
const ATTACHMENT_PREFIX_LEGACY = '[[deal_attachment]]';
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

function formatActorLabel(msg: any, myUserId: any) {
  if (String(msg?.senderId ?? '') === String(myUserId ?? '')) return 'Ty';
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
  return clean || 'Kontrahent';
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
  if (m.includes('pdf')) return `${name || 'dokument'}.pdf`;
  if (m.startsWith('audio/')) return `${name || 'audio'}.${m.split('/')[1] || 'm4a'}`;
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
  return { url, name: ensureAttachmentFileName(normalizedName || nameFallback || 'zalacznik', mimeType), mimeType, size };
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

function parseDealReviewPayload(content?: string): { rating: number; review: string; senderId?: number | null } | null {
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
  const navigation = useNavigation();
  const route = useRoute<any>();
  const dealId = route.params?.dealId || route.params?.params?.dealId;
  const offerId = route.params?.offerId || route.params?.params?.offerId;
  const title = route.params?.title || route.params?.params?.title || 'Transakcja';
  
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
  
  // Upload State
  const [pendingAttachment, setPendingAttachment] = useState<any>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [roomAttachmentBytes, setRoomAttachmentBytes] = useState(0);
  
  // UI Expand State
  const [appointmentSectionExpanded, setAppointmentSectionExpanded] = useState(false);
  const [priceSectionExpanded, setPriceSectionExpanded] = useState(false);
  
  const [resolvedOfferId, setResolvedOfferId] = useState<any>(offerId || null);
  const [isListingOwner, setIsListingOwner] = useState(false);
  const [counterpartyUserId, setCounterpartyUserId] = useState<number | null>(null);
  const [dealStatusSnapshot, setDealStatusSnapshot] = useState<string | null>(null);
  const [acceptedBidIdSnapshot, setAcceptedBidIdSnapshot] = useState<number | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [myFinalRating, setMyFinalRating] = useState(0);
  const [myFinalReview, setMyFinalReview] = useState('');
  const [isSubmittingFinalReview, setIsSubmittingFinalReview] = useState(false);
  const [mySubmittedReview, setMySubmittedReview] = useState<{ rating: number; review: string; senderId: number | null } | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const lastTypingTime = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const seenNegotiationEventKeysRef = useRef<Set<string>>(new Set());
  const negotiationBootstrappedRef = useRef(false);

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

    const buyerId = Number(firstDefined(current?.buyerId, current?.buyer?.id) || 0);
    const sellerId = Number(firstDefined(current?.sellerId, current?.seller?.id) || 0);
    const meId = Number(user.id);
    const ownerId = firstDefined(
      current?.offer?.userId,
      current?.listing?.userId,
      current?.offer?.user?.id,
      current?.userId
    );
    const counterpart =
      buyerId > 0 && buyerId !== meId
        ? buyerId
        : sellerId > 0 && sellerId !== meId
          ? sellerId
          : null;
    setCounterpartyUserId(counterpart);
    setIsListingOwner(ownerId != null && ownerId !== '' && Number(user.id) === Number(ownerId));

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        await fetchDealSnapshot();
      } catch {
        if (!cancelled) {
          setIsListingOwner(false);
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
      Alert.alert('Błąd', 'Nie udało się odtworzyć dźwięku.');
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
          Alert.alert('Brak identyfikatora', 'Nie udało się ustalić identyfikatora oferty/transakcji dla uploadu.');
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
            msgForm.append('content', content || `Załącznik: ${baseFile.name}`);
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
            Alert.alert('Błąd uploadu', directErrText || lastUploadError || 'Błąd serwera przy wysyłce załącznika.');
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
          Alert.alert('Błąd wysyłki', errBody || 'Nie udało się wysłać wiadomości z załącznikiem.');
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
          Alert.alert('Błąd wysyłki', errBody || 'Nie udało się wysłać wiadomości.');
          setMessage(content);
          return;
        }
      }
      fetchMessages();
    } catch (e) {
      Alert.alert('Błąd', attachmentForSend ? 'Nie udało się wysłać załącznika.' : 'Nie udało się wysłać wiadomości.');
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
        Alert.alert('Przekroczony limit', 'Ten dealroom osiągnął limit rozmiaru plików (50 MB).');
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
      Alert.alert('Błąd', 'Nie udało się wybrać pliku.');
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
    () =>
      [...bidEvents]
        .reverse()
        .find(
          (e) =>
            e.msg?.senderId !== user?.id &&
            ['PROPOSED', 'COUNTERED'].includes(String(e.event?.action || '').toUpperCase()) &&
            Number(e.event?.amount || 0) > 0
        ) || null,
    [bidEvents, user?.id]
  );

  const latestActionableAppointmentFromOther = useMemo(
    () =>
      [...appointmentEvents]
        .reverse()
        .find(
          (e) =>
            e.msg?.senderId !== user?.id &&
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

  const acceptedPrice = useMemo(
    () =>
      [...bidEvents]
        .reverse()
        .find((e) => String(e.event?.action || '').toUpperCase() === 'ACCEPTED' && Number(e.event?.amount || 0) > 0)
        ?.event?.amount || 0,
    [bidEvents]
  );

  const latestNegotiatedPrice = useMemo(
    () =>
      [...bidEvents].reverse().find((e) => Number(e.event?.amount || 0) > 0)?.event?.amount || 0,
    [bidEvents]
  );

  const appointmentStatus = useMemo<'IDLE' | 'PENDING' | 'ACCEPTED'>(() => {
    if (!latestAppointment) return 'IDLE';
    const action = String(latestAppointment.event?.action || '').toUpperCase();
    if (action === 'ACCEPTED' || acceptedAppointment) return 'ACCEPTED';
    if (['PROPOSED', 'COUNTERED'].includes(action)) return 'PENDING';
    return 'IDLE';
  }, [acceptedAppointment, latestAppointment]);

  const priceStatus = useMemo<'IDLE' | 'PENDING' | 'ACCEPTED'>(() => {
    if (!latestBid) return 'IDLE';
    const action = String(latestBid.event?.action || '').toUpperCase();
    if (action === 'ACCEPTED' || acceptedPrice > 0) return 'ACCEPTED';
    if (['PROPOSED', 'COUNTERED'].includes(action)) return 'PENDING';
    return 'IDLE';
  }, [acceptedPrice, latestBid]);

  const appointmentStatusText = useMemo(() => {
    if (appointmentStatus === 'IDLE') return 'Brak ustaleń';
    if (appointmentStatus === 'ACCEPTED' && acceptedAppointment?.event?.proposedDate) {
      return `Ustalono: ${new Date(acceptedAppointment.event.proposedDate).toLocaleString('pl-PL')}`;
    }
    const source = latestActionableAppointmentFromOther || latestAppointment;
    if (source?.event?.proposedDate) {
      const who = formatActorLabel(source.msg, user?.id);
      return `Zaproponowano termin przez ${who}`;
    }
    return 'W trakcie negocjacji';
  }, [acceptedAppointment, appointmentStatus, latestActionableAppointmentFromOther, latestAppointment, user?.id]);

  const priceStatusText = useMemo(() => {
    if (priceStatus === 'IDLE') return 'Brak ofert';
    if (priceStatus === 'ACCEPTED' && acceptedPrice > 0) {
      return `Ustalona cena: ${acceptedPrice.toLocaleString('pl-PL')} PLN`;
    }
    const source = latestActionableBidFromOther || latestBid;
    if (source?.event?.amount) {
      const who = formatActorLabel(source.msg, user?.id);
      return `Zaproponowano ${Number(source.event.amount).toLocaleString('pl-PL')} PLN przez ${who}`;
    }
    return 'W trakcie negocjacji';
  }, [acceptedPrice, latestActionableBidFromOther, latestBid, priceStatus, user?.id]);

  const transactionFinalized = useMemo(() => {
    const canonicalByDealState =
      canFinalizeTransition({
        dealStatus: dealStatusSnapshot,
        acceptedBidId: acceptedBidIdSnapshot,
      }) ||
      ['FINALIZED', 'CLOSED', 'COMPLETED', 'DONE', 'SOLD'].includes(String(dealStatusSnapshot || '').toUpperCase());
    if (canonicalByDealState) return true;

    // Legacy fallback dla starszych wiadomości.
    return messages.some((m) => isFinalizedOwnerAcceptanceMessage(String(m?.content || '')));
  }, [dealStatusSnapshot, acceptedBidIdSnapshot, messages]);

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
      senderName: 'Ty',
      createdAt: new Date().toISOString(),
    };
  }, [finalReviews, user?.id, mySubmittedReview]);

  const partnerFinalReviewEntry = useMemo(
    () => finalReviews.find((r) => String(r.senderId ?? '') !== String(user?.id ?? '')) || null,
    [finalReviews, user?.id]
  );

  useEffect(() => {
    if (!myFinalReviewEntry) return;
    setMyFinalRating(Number(myFinalReviewEntry.rating || 0));
    setMyFinalReview(String(myFinalReviewEntry.review || ''));
  }, [myFinalReviewEntry]);

  const handlePostPresentationReserve = useCallback(async () => {
    if (!token || !dealId || !resolvedOfferId || !user?.id) return;
    Alert.alert(
      'Rezerwacja po prezentacji',
      'Wycofać ofertę z publikacji i ustawić status na oczekujący (PENDING), tak jak przy rezerwacji ustalonej ceny?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wycofaj i zarezerwuj',
          style: 'destructive',
          onPress: async () => {
            try {
              const msgOk = await postDealroomTextMessage({
                dealId: Number(dealId),
                token,
                content:
                  'Decyzja właściciela: oferta została wycofana z publikacji (rezerwacja uzgodnionej ceny).',
              });
              if (!msgOk) {
                Alert.alert('Uwaga', 'Nie udało się dodać wpisu w czacie.');
              }
              const pendingRes = await setOfferStatusPending({
                offerId: Number(resolvedOfferId),
                userId: Number(user.id),
                token,
              });
              if (!pendingRes.ok) {
                Alert.alert('Uwaga', pendingRes.error || 'Nie udało się zmienić statusu oferty.');
              }
              await fetchMessages();
              await fetchDealSnapshot();
            } catch {
              Alert.alert('Błąd', 'Nie udało się dokończyć rezerwacji.');
            }
          },
        },
      ]
    );
  }, [token, dealId, resolvedOfferId, user?.id, fetchMessages, fetchDealSnapshot]);

  const handleSubmitFinalReview = useCallback(async () => {
    if (!token || !dealId || !user?.id) return;
    if (!transactionFinalized) return;
    if (!counterpartyUserId) {
      Alert.alert('Brak danych', 'Nie udało się ustalić kontrahenta do oceny. Odśwież czat i spróbuj ponownie.');
      return;
    }
    if (myFinalRating < 1 || myFinalRating > 5) {
      Alert.alert('Ocena', 'Wybierz liczbę gwiazdek od 1 do 5.');
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
        Alert.alert('Błąd', 'Nieprawidłowe dane opinii.');
        return;
      }
      const res = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewPayload),
      });
      if (!res.ok) {
        Alert.alert('Błąd', 'Nie udało się zapisać opinii. Spróbuj ponownie.');
        return;
      }
      setMySubmittedReview({
        rating: reviewPayload.rating,
        review: reviewPayload.review || '',
        senderId: reviewPayload.senderId ?? Number(user.id),
      });
      // backward compatibility: jeśli backend jeszcze emituje review w czacie, odśwież i pokaż partnera
      await fetchMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Dziękujemy', 'Twoja ocena została zapisana.');
    } finally {
      setIsSubmittingFinalReview(false);
    }
  }, [token, dealId, user?.id, transactionFinalized, myFinalRating, myFinalReview, fetchMessages, counterpartyUserId]);

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
        ? `${who} zaproponował(a) ${Number(entry.event?.amount || 0).toLocaleString('pl-PL')} PLN`
        : `${who} zaproponował(a) termin prezentacji`;

      /** Jeden stos na iOS per klient (nadawca); fallback: jeden stos per dealroom. */
      const peerId = entry.msg?.senderId;
      const threadIdentifier =
        peerId != null && String(peerId).trim() !== ''
          ? `estateos-peer-${String(peerId)}`
          : `estateos-deal-${String(dealId ?? '')}`;

      void Notifications.scheduleNotificationAsync({
        content: {
          title: isPrice ? 'Zaproponowano cenę' : 'Zaproponowano termin prezentacji',
          body,
          subtitle: dealId ? `Dealroom · TX-${dealId}` : undefined,
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
      Alert.alert('Brak sesji', 'Odśwież czat i spróbuj ponownie.');
      return;
    }
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      Alert.alert('Brak identyfikatora terminu', 'Nie można zaakceptować tej propozycji. Otwórz „Zmień” i wyślij termin ponownie.');
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
          message: 'Akceptuję termin',
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        Alert.alert('Błąd', body || 'Nie udało się zaakceptować terminu.');
        return;
      }
      await fetchMessages();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Błąd', 'Nie udało się zaakceptować terminu.');
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <View style={styles.container}>
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
          <Text style={styles.headerSubtitle}>DEALROOM #{dealId}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <>
          {/* Negotiation Sticky Panel */}
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
                <Text style={styles.negotiationTitle}>TERMIN PREZENTACJI</Text>
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
                  <Text style={styles.negotiationExpandedText}>Brak propozycji terminu.</Text>
                ) : (
                  <View style={styles.timelineWrap}>
                    {appointmentEvents.map((entry, idx) => {
                      const isLast = idx === appointmentEvents.length - 1;
                      const actor = formatActorLabel(entry.msg, user?.id);
                      const action = String(entry.event?.action || '').toUpperCase();
                      const actionLabel =
                        action === 'ACCEPTED' ? 'zaakceptował(a)' :
                        action === 'COUNTERED' ? 'zaproponował(a) zmianę terminu' :
                        action === 'REJECTED' ? 'odrzucił(a) termin' :
                        'zaproponował(a) termin';
                      const dateText = entry.event?.proposedDate
                        ? new Date(entry.event.proposedDate).toLocaleString('pl-PL')
                        : 'brak daty';
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
                      <Text style={styles.royalSealMain}>ODBYTE</Text>
                      <Text style={styles.royalSealBottom}>TERMIN ZAAKCEPTOWANY</Text>
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
                      <Text style={styles.actionPrimaryTxt}>Akceptuj</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.actionBtn, styles.actionSecondary]} 
                      onPress={() => { setSelectedAppointmentEvent(latestActionableAppointmentFromOther.event); setSelectedAppointmentHistory(appointmentEvents.map(e => e.event)); }}
                    >
                      <Text style={styles.actionSecondaryTxt}>Zmień</Text>
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
                <Text style={styles.negotiationTitle}>USTALENIA CENOWE</Text>
                <Text style={styles.negotiationState}>{priceStatusText}</Text>
              </View>
              <Text style={styles.negotiationCaret}>{priceSectionExpanded ? '−' : '+'}</Text>
            </Pressable>

            {priceSectionExpanded && (
              <View style={styles.negotiationExpanded}>
                {bidEvents.length === 0 ? (
                  <Text style={styles.negotiationExpandedText}>Brak propozycji cenowych.</Text>
                ) : (
                  <View style={styles.timelineWrap}>
                    {bidEvents.map((entry, idx) => {
                      const isLast = idx === bidEvents.length - 1;
                      const actor = formatActorLabel(entry.msg, user?.id);
                      const action = String(entry.event?.action || '').toUpperCase();
                      const actionLabel =
                        action === 'ACCEPTED' ? 'zaakceptował(a) cenę' :
                        action === 'COUNTERED' ? 'złożył(a) kontrofertę' :
                        action === 'REJECTED' ? 'odrzucił(a) ofertę' :
                        'zaproponował(a) cenę';
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
                      <Text style={styles.royalSealMain}>{transactionFinalized ? 'SFINALIZOWANO' : 'AKCEPTACJA CENY'}</Text>
                      <Text style={styles.royalSealBottom}>
                        CENA OSTATECZNA: {acceptedPrice.toLocaleString('pl-PL')} PLN
                      </Text>
                    </View>
                  </View>
                )}
                {latestActionableBidFromOther && acceptedPrice === 0 && priceStatus !== 'ACCEPTED' && !transactionFinalized && (
                  <View style={styles.actionRow}>
                    <Pressable 
                      style={[styles.actionBtn, styles.actionPrimary]} 
                      onPress={() => { setSelectedBidEvent({ ...latestActionableBidFromOther.event, quickAccept: true }); setSelectedBidHistory(bidEvents.map(e => e.event)); }}
                    >
                      <Text style={styles.actionPrimaryTxt}>Zgoda</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.actionBtn, styles.actionSecondary]} 
                      onPress={() => { setSelectedBidEvent(latestActionableBidFromOther.event); setSelectedBidHistory(bidEvents.map(e => e.event)); }}
                    >
                      <Text style={styles.actionSecondaryTxt}>Kontroferta</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {showPostPresentationReserve && !transactionFinalized ? (
            <View style={styles.reserveAfterPresentation}>
              <BlurView intensity={50} tint="dark" style={styles.reserveAfterPresentationInner}>
                <Text style={styles.reserveAfterPresentationTitle}>Po prezentacji</Text>
                <Text style={styles.reserveAfterPresentationBody}>
                  Termin prezentacji minął. Możesz wycofać ofertę ze sprzedaży i zarezerwować ustalenia — oferta trafi do oczekujących (PENDING).
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.reserveAfterPresentationBtn, pressed && { opacity: 0.92 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    void handlePostPresentationReserve();
                  }}
                >
                  <Text style={styles.reserveAfterPresentationBtnTxt}>Wycofaj ze sprzedaży i zarezerwuj</Text>
                </Pressable>
              </BlurView>
            </View>
          ) : null}

          {transactionFinalized ? (
            <View style={styles.finalizedWrap}>
              <BlurView intensity={72} tint="dark" style={styles.finalizedInner}>
                <Text style={styles.finalizedTitle}>Gratulacje! Transakcja została zamknięta.</Text>
                <Text style={styles.finalizedSubtitle}>
                  Oferta jest wycofana z rynku i przeniesiona do sekcji sfinalizowane / zarchiwizowane.
                </Text>
                <Text style={styles.finalizedSectionLabel}>Twoja ocena kontrahenta</Text>
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
                  placeholder="Krótka opinia o przebiegu transakcji (opcjonalnie)"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.finalizedInput}
                  multiline
                />
                <Pressable
                  style={[styles.finalizedBtn, (isSubmittingFinalReview || myFinalRating < 1) && styles.finalizedBtnDisabled]}
                  onPress={() => void handleSubmitFinalReview()}
                  disabled={isSubmittingFinalReview || myFinalRating < 1}
                >
                  {isSubmittingFinalReview ? (
                    <ActivityIndicator color="#041208" />
                  ) : (
                    <Text style={styles.finalizedBtnTxt}>{myFinalReviewEntry ? 'Zaktualizuj opinię' : 'Wyślij opinię'}</Text>
                  )}
                </Pressable>
                {partnerFinalReviewEntry ? (
                  <View style={styles.partnerReviewCard}>
                    <Text style={styles.partnerReviewTitle}>Ocena od drugiej strony</Text>
                    <Text style={styles.partnerReviewStars}>{'★'.repeat(partnerFinalReviewEntry.rating)}{'☆'.repeat(5 - partnerFinalReviewEntry.rating)}</Text>
                    {partnerFinalReviewEntry.review ? (
                      <Text style={styles.partnerReviewBody}>„{partnerFinalReviewEntry.review}”</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.partnerReviewPending}>Druga strona jeszcze nie dodała swojej opinii.</Text>
                )}
              </BlurView>
            </View>
          ) : null}

          {/* Chat Messages */}
          <ScrollView
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={styles.chatArea}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, index) => {
              const isMe = msg.senderId === user?.id;
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
                          await Linking.openURL(attachment.url).catch(() => Alert.alert('Błąd', 'Nie można otworzyć pliku.'));
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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
              placeholder="Napisz wiadomość..."
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={handleTyping}
              multiline
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
      </KeyboardAvoidingView>

      {/* Modals */}
      <BidActionModal
        visible={!!selectedBidEvent}
        mode="respond"
        dealId={dealId ? Number(dealId) : null}
        token={token || null}
        bidId={selectedBidEvent?.bidId || selectedBidEvent?.id || null}
        initialAmount={selectedBidEvent?.amount || selectedBidEvent?.counterAmount || selectedBidEvent?.value || null}
        eventAction={selectedBidEvent?.action || null}
        quickAccept={Boolean(selectedBidEvent?.quickAccept)}
        history={selectedBidHistory}
        title="Ustalenia cenowe"
        offerId={resolvedOfferId != null ? Number(resolvedOfferId) : null}
        userId={user?.id != null ? Number(user.id) : null}
        isListingOwner={isListingOwner}
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
        title="Termin prezentacji"
        onClose={() => {
          setSelectedAppointmentEvent(null);
        }}
        onDone={async () => {
          await fetchMessages();
          await fetchDealSnapshot();
        }}
      />
    </View>
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
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
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

  // Chat Area
  chatArea: { padding: 16, paddingBottom: 40 },
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
});