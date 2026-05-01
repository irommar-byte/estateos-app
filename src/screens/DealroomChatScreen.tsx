import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  StyleSheet, View, Text, Pressable, TextInput, KeyboardAvoidingView, 
  Platform, ScrollView, ActivityIndicator, Alert, Linking 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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

// ==========================================
// CONSTANTS & HELPERS
// ==========================================

const EVENT_PREFIX = '[[DEAL_EVENT]]';
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

const parseJsonMaybe = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const parseIntMaybe = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const parseCurrencyMaybe = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const n = Number(normalized);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const intOnly = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(intOnly) && intOnly > 0 ? intOnly : null;
};

const parseLegacyPolishDate = (rawDate: string) => {
  const trimmed = rawDate.trim();
  const dotMatch = trimmed.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s*(?:o|godz\.?)?\s*(\d{1,2})[:.](\d{2}))?/i);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const yearRaw = Number(dotMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const hour = Number(dotMatch[4] ?? 0);
    const minute = Number(dotMatch[5] ?? 0);
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  const fallback = new Date(trimmed.replace(' o ', ' ').replace(/\./g, '-'));
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

function parseDealEvent(input?: string | any) {
  const rawMessage = typeof input === 'string' ? null : input;
  const content = typeof input === 'string' ? input : String(input?.content || '');
  if (!content && !rawMessage) return null;

  const payloadFromMessage = {
    ...parseJsonMaybe(rawMessage?.payload),
    ...parseJsonMaybe(rawMessage?.eventPayload),
    ...parseJsonMaybe(rawMessage?.meta),
    ...parseJsonMaybe(rawMessage?.metadata),
    ...parseJsonMaybe(rawMessage?.data),
    ...(rawMessage?.event && typeof rawMessage.event === 'object' ? rawMessage.event : {}),
    ...(rawMessage?.dealEvent && typeof rawMessage.dealEvent === 'object' ? rawMessage.dealEvent : {}),
  };

  const messageRefs = {
    bidId: parseIntMaybe(firstDefined(rawMessage?.bidId, rawMessage?.bid?.id, payloadFromMessage.bidId, payloadFromMessage.bid?.id, payloadFromMessage.id)),
    appointmentId: parseIntMaybe(firstDefined(rawMessage?.appointmentId, rawMessage?.appointment?.id, payloadFromMessage.appointmentId, payloadFromMessage.appointment?.id, payloadFromMessage.id)),
    note: String(firstDefined(rawMessage?.note, payloadFromMessage.note, payloadFromMessage.message) || '').trim(),
  };

  if (!content) return null;
  if (content.startsWith(EVENT_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(EVENT_PREFIX.length));
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          bidId: parsed.bidId ?? messageRefs.bidId ?? null,
          appointmentId: parsed.appointmentId ?? messageRefs.appointmentId ?? null,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  const appointmentLegacyMatch = content.match(/(?:zaproponowano|nowy)\s+termin(?:\s+spotkania)?[:\s-]*(.+)$/i) || content.match(/termin(?:\s+spotkania)?[:\s-]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}(?:\s*(?:o|godz\.?)?\s*\d{1,2}[:.]\d{2})?)/i);
  if (appointmentLegacyMatch) {
    const raw = String(appointmentLegacyMatch[1] || '').trim();
    const proposedDate = raw ? parseLegacyPolishDate(raw) : null;
    return {
      entity: 'APPOINTMENT', action: 'PROPOSED', appointmentId: messageRefs.appointmentId,
      proposedDate, note: messageRefs.note || 'Wiadomość z wcześniejszego formatu', status: 'PENDING', legacy: true,
    };
  }

  const upper = content.toUpperCase();
  const isBidMessage = /(?:cena|oferta cenowa|propozycja cenowa|kontroferta|counteroffer)/i.test(content) || (upper.includes('BID') && /\d/.test(content));

  if (isBidMessage) {
    const amountFromText = parseCurrencyMaybe(content.match(/(?:za|na|:)\s*([\d\s.,]+)\s*(?:PLN|ZŁ)?/i)?.[1]) || parseCurrencyMaybe(content.match(/([\d\s.,]+)\s*(?:PLN|ZŁ)\b/i)?.[1]);
    const amount = amountFromText ?? parseIntMaybe(firstDefined(rawMessage?.amount, payloadFromMessage.amount));
    let action: 'PROPOSED' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' = 'PROPOSED';
    if (/kontrofert|counter/i.test(content)) action = 'COUNTERED';
    if (/zaakceptowan|accepted/i.test(content)) action = 'ACCEPTED';
    if (/odrzucon|reject|declin/i.test(content)) action = 'REJECTED';

    return {
      entity: 'BID', action, bidId: messageRefs.bidId, amount: amount || 0,
      note: messageRefs.note || 'Wiadomość z wcześniejszego formatu',
      status: action === 'ACCEPTED' ? 'ACCEPTED' : action === 'REJECTED' ? 'REJECTED' : 'PENDING', legacy: true,
    };
  }

  return null;
}

function normalizeDealEvent(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const entity = String(raw.entity || '').toUpperCase();
  const action = String(raw.action || '').toUpperCase();
  const status = String(raw.status || '').toUpperCase();
  const amount = parseCurrencyMaybe(raw.amount) || 0;
  const appointmentId = parseIntMaybe(raw.appointmentId);
  const bidId = parseIntMaybe(raw.bidId);

  let proposedDate: string | null = null;
  if (raw.proposedDate) {
    const parsed = new Date(raw.proposedDate);
    if (!Number.isNaN(parsed.getTime())) proposedDate = parsed.toISOString();
  } else if (raw.date) {
    const parsed = new Date(raw.date);
    if (!Number.isNaN(parsed.getTime())) proposedDate = parsed.toISOString();
  }

  return {
    ...raw,
    entity,
    action,
    status,
    amount,
    appointmentId,
    bidId,
    proposedDate,
  };
}

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
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  
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

  const resolveOfferIdForUpload = useCallback(async () => {
    if (resolvedOfferId) return resolvedOfferId;
    if (!dealId || !token) return null;
    try {
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
              : Array.isArray(json?.data?.items)
                ? json.data.items
                : [];
      const current = deals.find((d: any) => String(d?.id) === String(dealId));
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
  }, [dealId, resolvedOfferId, token]);

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
      const fromOther = String(entry.msg?.senderId ?? '') !== String(user?.id ?? '');
      if (!fromOther || !['PROPOSED', 'COUNTERED'].includes(action)) return;

      const who = formatActorLabel(entry.msg, user?.id);
      const isPrice = entry.event?.entity === 'BID';
      const body = isPrice
        ? `${who} zaproponował(a) ${Number(entry.event?.amount || 0).toLocaleString('pl-PL')} PLN`
        : `${who} zaproponował(a) termin prezentacji`;

      void Notifications.scheduleNotificationAsync({
        content: {
          title: isPrice ? 'Zaproponowano cenę' : 'Zaproponowano termin prezentacji',
          body,
          data: {
            target: 'dealroom',
            dealId,
            offerId: resolvedOfferId || undefined,
            deeplink: `estateos://dealroom/${dealId}`,
          },
        },
        trigger: null,
      });
    });
  }, [dealId, negotiationEvents, resolvedOfferId, user?.id]);

  const handleAcceptAppointment = async (event: any) => {
    if (!token || !dealId || !event?.appointmentId) return;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/actions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'APPOINTMENT_RESPOND',
          appointmentId: event.appointmentId,
          decision: 'ACCEPT',
          message: 'Akceptuję termin',
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        Alert.alert('Błąd', body || 'Nie udało się zaakceptować terminu.');
        return;
      }
      fetchMessages();
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
                      return (
                        <View key={`appt-${entry.msg?.id || idx}`} style={styles.timelineRow}>
                          <View style={styles.timelineRail}>
                            <View style={styles.timelineDot} />
                            {!isLast && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineMainText}>{actor} {actionLabel}: {dateText}</Text>
                            <Text style={styles.timelineMetaText}>
                              {new Date(entry.msg?.createdAt || Date.now()).toLocaleString('pl-PL')}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {latestActionableAppointmentFromOther && !isAppointmentProposalLocked && (
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
                      return (
                        <View key={`bid-${entry.msg?.id || idx}`} style={styles.timelineRow}>
                          <View style={styles.timelineRail}>
                            <View style={styles.timelineDot} />
                            {!isLast && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineMainText}>{actor} {actionLabel}: {amountText}</Text>
                            <Text style={styles.timelineMetaText}>
                              {new Date(entry.msg?.createdAt || Date.now()).toLocaleString('pl-PL')}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {latestActionableBidFromOther && acceptedPrice === 0 && (
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
        onClose={() => setSelectedBidEvent(null)}
        onDone={fetchMessages}
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
        onClose={() => setSelectedAppointmentEvent(null)}
        onDone={fetchMessages}
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
  timelineMetaText: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  
  // Buttons in Panel
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionSecondary: { backgroundColor: COLORS.surfaceElevated },
  actionPrimaryTxt: { color: '#000', fontWeight: '700', fontSize: 13 },
  actionSecondaryTxt: { color: COLORS.textBase, fontWeight: '600', fontSize: 13 },

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