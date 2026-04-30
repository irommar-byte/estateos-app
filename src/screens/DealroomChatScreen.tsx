import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Send, Paperclip, Check, CheckCheck, FileText, Play, Pause } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useAuthStore } from '../store/useAuthStore';
import BidActionModal from '../components/dealroom/BidActionModal';
import AppointmentActionModal from '../components/dealroom/AppointmentActionModal';
import { API_URL } from '../config/network';

const EVENT_PREFIX = '[[DEAL_EVENT]]';
const ATTACHMENT_PREFIX = '[[DEAL_ATTACHMENT]]';
const DEALROOM_ATTACHMENT_LIMIT_BYTES = 50 * 1024 * 1024;

function parseDealEvent(content?: string) {
  if (!content) return null;
  if (content.startsWith(EVENT_PREFIX)) {
    try {
      return JSON.parse(content.slice(EVENT_PREFIX.length));
    } catch {
      return null;
    }
  }
  const legacyMatch = content.match(/Zaproponowano termin spotkania:\s*(.+)$/i);
  if (legacyMatch) {
    const raw = legacyMatch[1]?.trim();
    const normalized = raw?.replace(' o ', ' ');
    const parsed = normalized ? new Date(normalized.replace(/\./g, '-')) : null;
    return {
      entity: 'APPOINTMENT',
      action: 'PROPOSED',
      proposedDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      note: 'Wiadomość z wcześniejszego formatu',
      status: 'PENDING',
      legacy: true,
    };
  }
  return null;
}

function parseDealAttachment(content?: string) {
  if (!content || !content.startsWith(ATTACHMENT_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(ATTACHMENT_PREFIX.length));
  } catch {
    return null;
  }
}

const TypingDot = ({ delay }: { delay: number }) => {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(withDelay(delay, withSequence(withTiming(-5, { duration: 300 }), withTiming(0, { duration: 300 }), withTiming(0, { duration: 600 }))), -1, true);
  }, []);
  return <Animated.View style={[styles.typingDot, useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] } ))]} />;
};

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
  const [selectedBidEvent, setSelectedBidEvent] = useState<any>(null);
  const [selectedBidHistory, setSelectedBidHistory] = useState<any[]>([]);
  const [selectedAppointmentEvent, setSelectedAppointmentEvent] = useState<any>(null);
  const [selectedAppointmentHistory, setSelectedAppointmentHistory] = useState<any[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<any>(null);
  const [roomAttachmentBytes, setRoomAttachmentBytes] = useState(0);
  const [resolvedOfferId, setResolvedOfferId] = useState<any>(offerId || null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const lastTypingTime = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (offerId) setResolvedOfferId(offerId);
  }, [offerId]);

  const resolveAttachmentFromMessage = (msg: any) => {
    const rawBlob =
      msg?.attachment ??
      msg?.file ??
      msg?.document ??
      (Array.isArray(msg?.attachments) ? msg.attachments[0] : null);

    const parsedFromContent = parseDealAttachment(msg?.content);

    let rawUrl: string | null = null;
    const meta: Record<string, any> =
      parsedFromContent && typeof parsedFromContent === 'object' ? { ...parsedFromContent } : {};

    const fromParsed =
      parsedFromContent && typeof parsedFromContent === 'object'
        ? String(
            parsedFromContent.url ||
              parsedFromContent.uri ||
              parsedFromContent.path ||
              parsedFromContent.fileUrl ||
              parsedFromContent.filePath ||
              '',
          ).trim()
        : '';

    if (fromParsed) {
      rawUrl = fromParsed;
    }

    if (typeof rawBlob === 'string' && rawBlob.trim()) {
      rawUrl = rawBlob.trim();
    } else if (rawBlob && typeof rawBlob === 'object' && !Array.isArray(rawBlob)) {
      const u = String(
        rawBlob.url ||
          rawBlob.uri ||
          rawBlob.path ||
          rawBlob.fileUrl ||
          rawBlob.filePath ||
          '',
      ).trim();
      if (u) rawUrl = u;
      Object.assign(meta, rawBlob);
    }

    if (!rawUrl) return null;

    const absoluteUrl =
      rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `${API_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

    const nameFromUrl = (() => {
      try {
        const pathOnly = absoluteUrl.split('?')[0];
        const last = pathOnly.substring(pathOnly.lastIndexOf('/') + 1);
        return decodeURIComponent(last);
      } catch {
        return null;
      }
    })();

    const emojiTitle = /^📎\s*(.+)$/u.exec(String(msg?.content || '').trim())?.[1]?.trim();

    const normalizedBase = String(
      meta?.name || meta?.fileName || emojiTitle || nameFromUrl || '',
    ).trim();

    let mimeFromExt = '';
    const lowerGuess = normalizedBase.toLowerCase();
    if (lowerGuess.endsWith('.pdf')) mimeFromExt = 'application/pdf';
    else if (/\.(jpe?g)$/i.test(lowerGuess)) mimeFromExt = 'image/jpeg';
    else if (lowerGuess.endsWith('.png')) mimeFromExt = 'image/png';
    else if (lowerGuess.endsWith('.webp')) mimeFromExt = 'image/webp';
    else if (lowerGuess.endsWith('.gif')) mimeFromExt = 'image/gif';
    else if (/\.(m4a|mp3|aac|wav|ogg)$/i.test(lowerGuess)) mimeFromExt = 'audio/mpeg';

    let mimeType = String(meta?.mimeType || meta?.type || mimeFromExt || '').trim();

    const ensureExt = (name: string, mime: string) => {
      const lower = name.toLowerCase();
      if (!name) return 'zalacznik';
      if (lower.includes('.')) return name;
      if (mime.includes('pdf')) return `${name}.pdf`;
      if (mime.startsWith('image/')) {
        const hit = /\.(jpg|jpeg|png|webp|gif)$/i.exec(absoluteUrl) || /\.(jpg|jpeg|png|webp|gif)$/i.exec(rawUrl || '');
        return hit ? `${name}${hit[0]}` : `${name}.jpg`;
      }
      if (mime.startsWith('audio/')) {
        const ext = mime.split('/')[1]?.split(';')[0] || 'm4a';
        return `${name}.${ext}`;
      }
      return `${name}`;
    };

    const displayName = ensureExt(normalizedBase, mimeType || 'application/octet-stream');
    const finalMime =
      mimeType && mimeType !== 'application/octet-stream'
        ? mimeType
        : mimeFromExt || 'application/octet-stream';

    return {
      url: absoluteUrl,
      name: displayName,
      mimeType: finalMime,
      size: Number(meta?.size ?? meta?.sizeBytes ?? meta?.fileSize ?? 0) || 0,
    };
  };

  const getAttachmentKind = (attachment: any) => {
    const mime = String(attachment?.mimeType || '').toLowerCase();
    const name = String(attachment?.name || '').toLowerCase();
    const url = String(attachment?.url || '').toLowerCase();
    if (
      mime.startsWith('image/') ||
      /\.(jpe?g|png|gif|webp|heic)$/i.test(name) ||
      /\.(jpe?g|png|gif|webp|heic)(?:\?|$)/i.test(url)
    ) {
      return 'image';
    }
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (mime.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg)$/i.test(name)) return 'audio';
    return 'file';
  };

  const openDealAttachmentUrl = async (href: string) => {
    try {
      await Linking.openURL(href);
    } catch {
      Alert.alert(
        'Błąd',
        `Nie udało się otworzyć pliku. Jeśli używasz emulatora lub sieci LTE, sprawdź czy adres jest dostępny.`,
      );
    }
  };

  const handleToggleAudioPreview = async (url: string) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

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
        { uri: url },
        { shouldPlay: false, progressUpdateIntervalMillis: 200 },
        (status: any) => {
          if (status?.didJustFinish) {
            setPlayingAudioUrl(null);
          }
        }
      );
      await sound.playAsync();
      soundRef.current = sound;
      setPlayingAudioUrl(url);
    } catch {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // noop
      }
      Alert.alert('Błąd', 'Nie udało się odtworzyć ani otworzyć pliku audio.');
      setPlayingAudioUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  // KULOODPORNE POBIERANIE (GET + ANTI-CACHE)
  const fetchMessages = useCallback(async () => {
    if (!token || !dealId) return;
    try {
      const url = `https://estateos.pl/api/mobile/v1/deals/${dealId}/messages?t=${Date.now()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
      
      const text = await res.text();
      if (!text) return; // Chroni przed "Unexpected end of input"
      
      const data = JSON.parse(text);
      if (data.messages) {
        setMessages(data.messages);
        const usedBytes = data.messages.reduce((sum: number, msg: any) => {
          const attachment = resolveAttachmentFromMessage(msg);
          return sum + (attachment?.size || 0);
        }, 0);
        setRoomAttachmentBytes(usedBytes);
      }
      if (data.isTyping !== undefined) {
        setIsPartnerTyping(data.isTyping);
      }
    } catch (e) {
      console.log('Ciche zignorowanie błędu odświeżania:', e);
    } finally {
      setLoading(false);
    }
  }, [dealId, token]);

  // POLLING CO 2.5 SEKUNDY
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const resolveOfferIdForUpload = async () => {
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
      const nextOfferId =
        current?.offerId ||
        current?.offer?.id ||
        current?.offer?.offerId ||
        current?.listingId ||
        current?.propertyId ||
        null;
      if (nextOfferId) {
        setResolvedOfferId(nextOfferId);
        return nextOfferId;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleTyping = (text: string) => {
    setMessage(text);
    const now = Date.now();
    if (text.length > 0 && now - lastTypingTime.current > 1500) {
      lastTypingTime.current = now;
      fetch(`https://estateos.pl/api/mobile/v1/deals/${dealId}/typing`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !pendingAttachment) || !token || !user) return;
    const content = message.trim();
    const attachmentForSend = pendingAttachment;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const tempId = Date.now();
    setMessage('');
    if (!attachmentForSend) {
      setMessages(prev => [...prev, {
        id: tempId,
        senderId: user.id,
        content,
        createdAt: new Date().toISOString(),
        isRead: false,
        attachment: null,
      }]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }

    try {
      let res;
      if (attachmentForSend) {
        const uploadOfferId = await resolveOfferIdForUpload();
        const uploadIdentifier = uploadOfferId || dealId;
        if (!uploadIdentifier) {
          Alert.alert('Brak identyfikatora', 'Nie udało się ustalić identyfikatora transakcji/oferty dla uploadu.');
          return;
        }

        const baseFile = {
          uri: attachmentForSend.uri,
          name: attachmentForSend.name,
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
            headers: { 'Authorization': `Bearer ${token}` },
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
          const msgForm = new FormData();
          msgForm.append('content', content || `Załącznik: ${attachmentForSend.name}`);
          msgForm.append('offerId', String(uploadIdentifier));
          msgForm.append('dealId', String(dealId));
          msgForm.append('file', baseFile);

          const directRes = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: msgForm,
          });

          if (!directRes.ok) {
            const directErr = await directRes.text();
            Alert.alert('Błąd uploadu', directErr || lastUploadError || 'Błąd serwera przy wysyłce załącznika.');
            return;
          }

          setPendingAttachment(null);
          fetchMessages();
          return;
        }

        const payloadAttachment = {
          url: uploadedPath,
          name: attachmentForSend.name,
          mimeType: attachmentForSend.mimeType || 'application/octet-stream',
          size: attachmentForSend.size,
        };
        const payloadContent = content?.trim()
          ? `${content.trim()}\n${ATTACHMENT_PREFIX}${JSON.stringify(payloadAttachment)}`
          : `${ATTACHMENT_PREFIX}${JSON.stringify(payloadAttachment)}`;

        res = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: payloadContent }),
        });
      } else {
        res = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      }

      if (!res.ok) {
        const errorBody = await res.text();
        const fallbackMsg = attachmentForSend
          ? 'Nie udało się wysłać załącznika. Plik został zachowany, możesz spróbować ponownie.'
          : 'Nie udało się wysłać wiadomości.';
        Alert.alert('Błąd wysyłki', errorBody || fallbackMsg);
        if (!attachmentForSend) {
          setMessage(content);
        }
        return;
      }

      if (attachmentForSend) {
        setPendingAttachment(null);
      }
      fetchMessages();
    } catch (e) {
      console.log('Błąd wysyłania:', e);
      Alert.alert(
        'Błąd połączenia',
        attachmentForSend
          ? 'Nie udało się wysłać załącznika. Plik został zachowany, spróbuj ponownie.'
          : 'Nie udało się wysłać wiadomości.'
      );
      if (!attachmentForSend) {
        setMessage(content);
      }
    }
  };

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const fileSize = Number(file.size || 0);
      if (!fileSize) {
        Alert.alert('Brak rozmiaru pliku', 'Nie udało się odczytać rozmiaru załącznika.');
        return;
      }
      if (roomAttachmentBytes + fileSize > DEALROOM_ATTACHMENT_LIMIT_BYTES) {
        Alert.alert(
          'Przekroczony limit dealroomu',
          `Ten dealroom ma limit 50 MB załączników. Wykorzystane: ${formatBytes(roomAttachmentBytes)}.`
        );
        return;
      }

      setPendingAttachment({
        uri: file.uri,
        name: file.name || `zalacznik_${Date.now()}`,
        mimeType: file.mimeType || 'application/octet-stream',
        size: fileSize,
      });
      Haptics.selectionAsync();
      Alert.alert('Załącznik dodany', 'Plik został dodany do wiadomości. Kliknij wyślij.');
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się wybrać pliku.');
    }
  };

  const handleAcceptAppointment = async (event: any) => {
    if (!token || !dealId || !event?.appointmentId) return;
    try {
      await fetch(`https://estateos.pl/api/mobile/v1/deals/${dealId}/actions`, {
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
      fetchMessages();
    } catch {
      // noop
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
        >
          <ChevronLeft size={28} color="#ffffff" />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>DEALROOM #{dealId}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}><ActivityIndicator color="#10b981" /></View>
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.chatArea} 
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isMe = msg.senderId === user?.id;
            const dealEvent = parseDealEvent(msg.content);

            if (dealEvent?.entity === 'BID') {
              const isAccepted = dealEvent.action === 'ACCEPTED';
              const isNegotiable = dealEvent.action === 'PROPOSED' || dealEvent.action === 'COUNTERED';
              const bidHistory = messages
                .map((m) => parseDealEvent(m.content))
                .filter((e) => e?.entity === 'BID');
              return (
                <Animated.View key={msg.id} entering={FadeInDown.delay(index * 15).springify()} style={styles.eventCard}>
                  <Text style={styles.eventLabel}>NEGOCJACJA CENY</Text>
                  <Text style={styles.eventTitle}>
                    {dealEvent.action === 'ACCEPTED'
                      ? 'Oferta zaakceptowana'
                      : dealEvent.action === 'REJECTED'
                        ? 'Oferta odrzucona'
                        : dealEvent.action === 'COUNTERED'
                          ? 'Kontroferta'
                          : 'Nowa propozycja'}
                  </Text>
                  <Text style={styles.eventValue}>
                    {Number(dealEvent.amount || 0).toLocaleString('pl-PL')} PLN
                  </Text>
                  {isAccepted && (
                    <View style={styles.acceptedBadge}>
                      <Text style={styles.acceptedBadgeIcon}>🔒</Text>
                      <Text style={styles.acceptedBadgeText}>ZAAKCEPTOWANA CENA</Text>
                    </View>
                  )}
                  {!!dealEvent.note && <Text style={styles.eventNote}>{dealEvent.note}</Text>}
                  {isNegotiable && isMe && (
                    <Text style={styles.pendingOwnerText}>Oczekuję na odpowiedź drugiej strony</Text>
                  )}
                  {isNegotiable && !isMe && (
                    <View style={styles.eventActionsRow}>
                      <Pressable
                        style={[styles.eventActionBtn, styles.eventPrimary]}
                        onPress={() => {
                          setSelectedBidEvent({ ...dealEvent, quickAccept: true });
                          setSelectedBidHistory(bidHistory);
                        }}
                      >
                        <Text style={[styles.eventActionTxt, styles.eventPrimaryTxt]}>Akceptuj cenę</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.eventActionBtn, styles.eventSecondary]}
                        onPress={() => {
                          setSelectedBidEvent(dealEvent);
                          setSelectedBidHistory(bidHistory);
                        }}
                      >
                        <Text style={[styles.eventActionTxt, styles.eventSecondaryTxt]}>Zaproponuj swoją cenę</Text>
                      </Pressable>
                    </View>
                  )}
                </Animated.View>
              );
            }

            if (dealEvent?.entity === 'APPOINTMENT') {
              const dateTxt = dealEvent.proposedDate ? new Date(dealEvent.proposedDate).toLocaleString('pl-PL') : '';
              const isAccepted = dealEvent.action === 'ACCEPTED';
              const isNegotiable = dealEvent.action === 'PROPOSED' || dealEvent.action === 'COUNTERED';
              const appointmentHistory = messages
                .map((m) => parseDealEvent(m.content))
                .filter((e) => e?.entity === 'APPOINTMENT');
              return (
                <Animated.View key={msg.id} entering={FadeInDown.delay(index * 15).springify()} style={styles.eventCard}>
                  <Text style={styles.eventLabel}>NEGOCJACJA TERMINU</Text>
                  <Text style={styles.eventTitle}>
                    {dealEvent.action === 'ACCEPTED'
                      ? 'Termin zaakceptowany'
                      : dealEvent.action === 'DECLINED'
                        ? 'Termin odrzucony'
                        : dealEvent.action === 'COUNTERED'
                          ? 'Kontroferta terminu'
                          : 'Nowa propozycja terminu'}
                  </Text>
                  <Text style={styles.eventValueSmall}>{dateTxt}</Text>
                  {isAccepted && (
                    <View style={styles.acceptedBadge}>
                      <Text style={styles.acceptedBadgeIcon}>🔒</Text>
                      <Text style={styles.acceptedBadgeText}>ZAAKCEPTOWANY TERMIN</Text>
                    </View>
                  )}
                  {!!dealEvent.note && <Text style={styles.eventNote}>{dealEvent.note}</Text>}
                  {isNegotiable && isMe && (
                    <Text style={styles.pendingOwnerText}>Oczekuję na odpowiedź właściciela</Text>
                  )}
                  {isNegotiable && !isMe && !dealEvent.legacy && (
                    <View style={styles.eventActionsRow}>
                      <Pressable style={[styles.eventActionBtn, styles.eventPrimary]} onPress={() => handleAcceptAppointment(dealEvent)}>
                        <Text style={[styles.eventActionTxt, styles.eventPrimaryTxt]}>Akceptuj termin</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.eventActionBtn, styles.eventSecondary]}
                        onPress={() => {
                          setSelectedAppointmentEvent(dealEvent);
                          setSelectedAppointmentHistory(appointmentHistory);
                        }}
                      >
                        <Text style={[styles.eventActionTxt, styles.eventSecondaryTxt]}>Zaproponuj swój termin</Text>
                      </Pressable>
                    </View>
                  )}
                </Animated.View>
              );
            }

            return (
              <Animated.View key={msg.id} entering={FadeInDown.delay(index * 15).springify()} style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
                <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
                  {(() => {
                    const dealAttachment = parseDealAttachment(msg.content);
                    const visibleText = dealAttachment
                      ? String(msg.content || '').split(ATTACHMENT_PREFIX)[0].trim()
                      : msg.content;
                    return visibleText ? <Text style={styles.messageText}>{visibleText}</Text> : null;
                  })()}
                  {(() => {
                    const attachment = resolveAttachmentFromMessage(msg);
                    if (!attachment) return null;
                    const kind = getAttachmentKind(attachment);
                    const typeLabel =
                      kind === 'audio' ? 'Audio' : kind === 'pdf' ? 'Dokument PDF' : kind === 'image' ? 'Obraz' : 'Załącznik';
                    const sizePart = attachment.size ? ` • ${formatBytes(attachment.size)}` : '';
                    return (
                      <Pressable
                        style={[
                          styles.attachmentBubble,
                          kind === 'pdf' && styles.attachmentBubblePdf,
                          kind === 'audio' && styles.attachmentBubbleAudio,
                          kind === 'image' && styles.attachmentBubbleImage,
                        ]}
                        onPress={async () => {
                          if (kind === 'audio') return;
                          await openDealAttachmentUrl(attachment.url);
                        }}
                      >
                        {kind === 'image' ? (
                          <Image
                            source={{ uri: attachment.url }}
                            style={styles.imageThumb}
                            contentFit="cover"
                            accessibilityLabel={attachment.name}
                          />
                        ) : kind === 'pdf' ? (
                          <View style={styles.pdfThumb}>
                            <FileText size={18} color="#fff" />
                            <Text style={styles.pdfThumbLabel}>PDF</Text>
                          </View>
                        ) : kind === 'audio' ? (
                          <View style={styles.audioThumb}>
                            <Paperclip size={14} color="#fff" />
                          </View>
                        ) : (
                          <Paperclip size={14} color="#fff" />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.attachmentName} numberOfLines={1}>
                            {kind === 'pdf' ? `PDF: ${attachment.name}` : attachment.name}
                          </Text>
                          <Text style={styles.attachmentMeta}>
                            {typeLabel}
                            {sizePart}
                          </Text>
                        </View>
                        {kind === 'audio' && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleToggleAudioPreview(attachment.url);
                            }}
                            style={styles.audioPreviewBtn}
                          >
                            {playingAudioUrl === attachment.url ? <Pause size={14} color="#fff" /> : <Play size={14} color="#fff" />}
                          </Pressable>
                        )}
                        {kind === 'pdf' && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              void openDealAttachmentUrl(attachment.url);
                            }}
                            style={styles.pdfOpenBtn}
                          >
                            <Text style={styles.pdfOpenBtnTxt}>Podgląd</Text>
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })()}
                </View>
                <View style={[styles.messageFooter, isMe ? styles.messageFooterMe : styles.messageFooterThem]}>
                  <Text style={styles.timeText}>{new Date(msg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</Text>
                  {isMe && (
                    <View style={styles.readReceipt}>
                      {msg.isRead ? <CheckCheck size={15} color="#10b981" /> : <Check size={15} color="#86868b" />}
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })}
          
          {isPartnerTyping && (
            <Animated.View entering={FadeIn} style={styles.typingContainer}>
              <View style={styles.typingBubble}>
                <TypingDot delay={0} /><TypingDot delay={150} /><TypingDot delay={300} />
              </View>
            </Animated.View>
          )}
        </ScrollView>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <BlurView intensity={90} tint="dark" style={styles.inputContainer}>
          <Pressable
            style={({ pressed }) => [styles.attachButton, pressed && styles.attachButtonPressed]}
            onPress={handlePickAttachment}
          >
            <Paperclip
              size={22}
              color={pendingAttachment ? '#10b981' : '#86868b'}
            />
          </Pressable>
          {pendingAttachment && (
            <View style={styles.pendingAttachmentPill}>
              <Text style={styles.pendingAttachmentText} numberOfLines={1}>
                {pendingAttachment.name} ({formatBytes(pendingAttachment.size)})
              </Text>
              <Pressable onPress={() => setPendingAttachment(null)} hitSlop={10}>
                <Text style={styles.pendingAttachmentRemove}>x</Text>
              </Pressable>
            </View>
          )}
          <TextInput
            style={styles.textInput}
            placeholder="Napisz wiadomość..."
            placeholderTextColor="#666666"
            value={message}
            onChangeText={handleTyping}
            multiline
          />
          <Pressable style={[styles.sendButton, (message.trim() || pendingAttachment) && styles.sendButtonActive]} onPress={handleSend}>
            <Send size={18} color={(message.trim() || pendingAttachment) ? '#fff' : '#444'} />
          </Pressable>
        </BlurView>
      </KeyboardAvoidingView>

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
        title="Odpowiedz na ofertę ceny"
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
        title="Odpowiedz na termin prezentacji"
        onClose={() => setSelectedAppointmentEvent(null)}
        onDone={fetchMessages}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
    zIndex: 20,
  },
  backButtonPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  headerTextContainer: { flex: 1, marginLeft: 8 },
  headerSubtitle: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  loaderCenter: { flex: 1, justifyContent: 'center' },
  chatArea: { padding: 16, paddingBottom: 30 },
  messageWrapper: { marginBottom: 16, maxWidth: '85%' },
  messageWrapperMe: { alignSelf: 'flex-end' },
  messageWrapperThem: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 18 },
  messageBubbleMe: { backgroundColor: '#10b981', borderBottomRightRadius: 2 },
  messageBubbleThem: { backgroundColor: '#1C1C1E', borderBottomLeftRadius: 2 },
  messageText: { color: '#fff', fontSize: 16, lineHeight: 21 },
  attachmentBubble: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentBubblePdf: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  attachmentBubbleAudio: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  attachmentBubbleImage: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  imageThumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pdfThumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfThumbLabel: {
    position: 'absolute',
    bottom: 3,
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  audioThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1 },
  attachmentSize: { color: '#d1d5db', fontSize: 11, fontWeight: '600' },
  attachmentMeta: { color: '#d1d5db', fontSize: 10, fontWeight: '600', marginTop: 2 },
  audioPreviewBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfOpenBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pdfOpenBtnTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  messageFooterMe: { justifyContent: 'flex-end' },
  messageFooterThem: { justifyContent: 'flex-start' },
  timeText: { color: '#666', fontSize: 10, fontWeight: '600' },
  readReceipt: { marginLeft: 4 },
  typingContainer: { alignSelf: 'flex-start', marginBottom: 16 },
  typingBubble: { backgroundColor: '#1C1C1E', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18, borderBottomLeftRadius: 2, flexDirection: 'row', alignItems: 'center' },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#86868b', marginHorizontal: 2 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 35 : 15, flexWrap: 'wrap' },
  attachButton: { padding: 10 },
  attachButtonPressed: { opacity: 0.7 },
  pendingAttachmentPill: {
    width: '100%',
    marginBottom: 8,
    marginHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingAttachmentText: { color: '#d1fae5', fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8 },
  pendingAttachmentRemove: { color: '#10b981', fontWeight: '900', fontSize: 15, lineHeight: 16 },
  textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, color: '#fff', fontSize: 16, marginHorizontal: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: '#10b981' },
  eventCard: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)', borderRadius: 18, padding: 14, marginBottom: 14 },
  eventLabel: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  eventTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  eventValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  eventValueSmall: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  eventNote: { color: '#bfbfbf', marginTop: 6, fontSize: 13, lineHeight: 18 },
  eventActionsRow: { flexDirection: 'row', marginTop: 10 },
  eventActionBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  eventPrimary: { backgroundColor: '#10b981' },
  eventSecondary: { backgroundColor: '#1f2937', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginLeft: 8 },
  eventActionTxt: { fontWeight: '800', textTransform: 'uppercase', fontSize: 12 },
  eventPrimaryTxt: { color: '#000' },
  eventSecondaryTxt: { color: '#d1d5db' },
  pendingOwnerText: { marginTop: 8, color: '#facc15', fontWeight: '700', fontSize: 12 },
  acceptedBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.55)',
    backgroundColor: 'rgba(16,185,129,0.14)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  acceptedBadgeIcon: { fontSize: 12 },
  acceptedBadgeText: { color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
});
