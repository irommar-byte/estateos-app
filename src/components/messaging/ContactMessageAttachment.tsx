import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Download, FileText, Music, Pause, Play, X } from 'lucide-react-native';
import { getSafeWebView } from './safeWebView';
import ContactPdfThumbnail from './ContactPdfThumbnail';
import { resolveContactPdfPreviewUri } from '../../utils/contactPdfThumbnail';
import { downloadContactAttachment } from '../../utils/contactAttachmentDownload';
import {
  ContactAttachmentMeta,
  contactAttachmentKind,
  formatContactBytes,
} from '../../utils/contactAttachment';
import { getChatTheme } from './chatTheme';

type Props = {
  attachment: ContactAttachmentMeta;
  isMe: boolean;
  isDark?: boolean;
  compact?: boolean;
  downloadLabels?: {
    button?: string;
    failedTitle?: string;
    failedMessage?: string;
    unavailable?: string;
  };
};

function pdfBoxSize(compact: boolean) {
  const width = compact ? 140 : 188;
  const height = Math.round(width * 1.22);
  return { width, height };
}

export default function ContactMessageAttachment({
  attachment,
  isMe,
  isDark = true,
  compact = false,
  downloadLabels,
}: Props) {
  const { colors } = getChatTheme(isDark);
  const kind = contactAttachmentKind(attachment);
  const [playing, setPlaying] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfModalUri, setPdfModalUri] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const openExternal = async () => {
    try {
      await Linking.openURL(attachment.url);
    } catch {
      Alert.alert('Błąd', 'Nie udało się otworzyć pliku.');
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadContactAttachment({
        url: attachment.url,
        name: attachment.name,
        mimeType: attachment.mimeType,
        labels: {
          failedTitle: downloadLabels?.failedTitle,
          failedMessage: downloadLabels?.failedMessage,
          unavailable: downloadLabels?.unavailable,
        },
      });
    } finally {
      setDownloading(false);
    }
  };

  const toggleAudio = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: attachment.url },
        { shouldPlay: true },
        (status) => {
          if ('didJustFinish' in status && status.didJustFinish) setPlaying(false);
        },
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch {
      Alert.alert('Błąd', 'Nie udało się odtworzyć pliku audio.');
      setPlaying(false);
    }
  };

  const metaColor = isMe ? 'rgba(0,0,0,0.55)' : colors.textMuted;
  const titleColor = isMe ? '#000' : colors.textBase;
  const imageWidth = compact ? 128 : 248;
  const imageHeight = compact ? 96 : 186;
  const downloadBtnLabel = downloadLabels?.button || 'Pobierz';

  const DownloadChip = ({ light = false }: { light?: boolean }) => (
    <Pressable
      onPress={() => void handleDownload()}
      disabled={downloading}
      hitSlop={8}
      style={({ pressed }) => [
        styles.downloadChip,
        light
          ? styles.downloadChipLight
          : { backgroundColor: pressed ? 'rgba(52,199,89,0.28)' : 'rgba(52,199,89,0.16)' },
        downloading && { opacity: 0.7 },
      ]}
    >
      {downloading ? (
        <ActivityIndicator size="small" color={light ? '#fff' : colors.primary} />
      ) : (
        <Download size={16} color={light ? '#fff' : colors.primary} strokeWidth={2.4} />
      )}
      <Text style={[styles.downloadChipText, { color: light ? '#fff' : colors.primary }]}>
        {downloadBtnLabel}
      </Text>
    </Pressable>
  );

  if (kind === 'image') {
    return (
      <>
        <Pressable onPress={() => setPreviewOpen(true)} style={[styles.imageWrap, { width: imageWidth }]}>
          <Image
            source={{ uri: attachment.url }}
            style={{ width: imageWidth, height: imageHeight, backgroundColor: 'rgba(0,0,0,0.08)' }}
            contentFit="cover"
            transition={160}
            recyclingKey={attachment.url}
            autoplay
          />
          {!compact ? (
            <Text style={[styles.imageCaption, { color: metaColor }]} numberOfLines={1}>
              {attachment.name}
              {attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
            </Text>
          ) : null}
        </Pressable>
        <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalTopBar}>
              <DownloadChip light />
              <Pressable style={styles.modalClose} onPress={() => setPreviewOpen(false)} hitSlop={8}>
                <X size={22} color="#fff" />
              </Pressable>
            </View>
            <Image source={{ uri: attachment.url }} style={styles.modalImage} contentFit="contain" autoplay />
          </View>
        </Modal>
      </>
    );
  }

  if (kind === 'pdf') {
    const { width: pdfW, height: pdfH } = pdfBoxSize(compact);
    const WebView = getSafeWebView();
    const pdfCard = (
      <View style={[styles.pdfFooter, isMe ? styles.fileCardMe : styles.fileCardThem]}>
        <FileText size={14} color={isMe ? '#000' : '#FF3B30'} />
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: titleColor }]} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text style={[styles.fileMeta, { color: metaColor }]}>
            PDF{attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
          </Text>
        </View>
      </View>
    );

    const openPdf = () => {
      setPreviewOpen(true);
      void resolveContactPdfPreviewUri(attachment.url).then(setPdfModalUri);
    };

    return (
      <>
        <Pressable onPress={openPdf} style={[styles.pdfWrap, { width: pdfW }]}>
          <ContactPdfThumbnail
            url={attachment.url}
            width={pdfW}
            height={pdfH}
            fileName={attachment.name}
          />
          {pdfCard}
        </Pressable>
        <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
          <View style={[styles.fullPdfModal, { backgroundColor: colors.background }]}>
            <View style={styles.fullPdfHeader}>
              <Text style={[styles.fileName, { color: colors.textBase, flex: 1 }]} numberOfLines={1}>
                {attachment.name}
              </Text>
              <DownloadChip />
              <Pressable onPress={() => setPreviewOpen(false)} hitSlop={8} style={{ marginLeft: 4 }}>
                <X size={22} color={colors.textBase} />
              </Pressable>
            </View>
            {WebView && pdfModalUri ? (
              <WebView
                source={{ uri: pdfModalUri }}
                style={styles.fullPdfWebView}
                originWhitelist={['*']}
                startInLoadingState
                allowFileAccess
                allowingReadAccessToURL={pdfModalUri.startsWith('file://') ? pdfModalUri : undefined}
              />
            ) : (
              <View style={styles.pdfFallbackBody}>
                <ActivityIndicator color={colors.primary} />
                <Pressable onPress={() => void openExternal()} style={{ marginTop: 16 }}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Otwórz zewnętrznie</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Modal>
      </>
    );
  }

  if (kind === 'video') {
    const w = compact ? 168 : 248;
    const h = compact ? 112 : 168;
    return (
      <View style={[styles.videoWrap, { width: w }]}>
        <Video
          source={{ uri: attachment.url }}
          style={{ width: w, height: h, backgroundColor: '#000' }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
        />
        <View style={styles.videoFooter}>
          {!compact ? (
            <Text style={[styles.imageCaption, { color: metaColor, flex: 1 }]} numberOfLines={1}>
              {attachment.name}
              {attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
            </Text>
          ) : <View style={{ flex: 1 }} />}
          <Pressable
            onPress={() => void handleDownload()}
            disabled={downloading}
            hitSlop={8}
            style={({ pressed }) => [
              styles.downloadChip,
              { backgroundColor: pressed ? 'rgba(52,199,89,0.28)' : 'rgba(52,199,89,0.16)', paddingVertical: 6 },
            ]}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Download size={14} color={colors.primary} strokeWidth={2.4} />
            )}
            <Text style={[styles.downloadChipText, { color: colors.primary, fontSize: 12 }]}>
              {downloadBtnLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (kind === 'audio') {
    return (
      <View style={[styles.fileCard, isMe ? styles.fileCardMe : styles.fileCardThem, compact && styles.fileCardCompact]}>
        <View style={[styles.iconBox, { backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : 'rgba(52,199,89,0.18)' }]}>
          <Music size={16} color={isMe ? '#000' : colors.primary} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: titleColor }]} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text style={[styles.fileMeta, { color: metaColor }]}>
            Audio{attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => void handleDownload()}
          disabled={downloading}
          style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : 'rgba(52,199,89,0.2)', marginRight: 6 }]}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={isMe ? '#000' : colors.primary} />
          ) : (
            <Download size={14} color={isMe ? '#000' : colors.primary} />
          )}
        </Pressable>
        <Pressable
          onPress={() => void toggleAudio()}
          style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : colors.primary }]}
        >
          {playing ? <Pause size={14} color={isMe ? '#000' : '#fff'} /> : <Play size={14} color={isMe ? '#000' : '#fff'} />}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.fileCard, isMe ? styles.fileCardMe : styles.fileCardThem, compact && styles.fileCardCompact]}>
      <Pressable onPress={() => void openExternal()} style={styles.fileMainPress}>
        <View style={[styles.iconBox, { backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)' }]}>
          <FileText size={16} color={isMe ? '#000' : colors.textBase} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: titleColor }]} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text style={[styles.fileMeta, { color: metaColor }]}>
            Plik{attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => void handleDownload()}
        disabled={downloading}
        style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : 'rgba(52,199,89,0.2)' }]}
      >
        {downloading ? (
          <ActivityIndicator size="small" color={isMe ? '#000' : colors.primary} />
        ) : (
          <Download size={14} color={isMe ? '#000' : colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    marginTop: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageCaption: {
    fontSize: 11,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 2,
  },
  pdfWrap: {
    marginTop: 6,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  pdfFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    borderRadius: 12,
  },
  videoWrap: {
    marginTop: 6,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  videoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  fileCard: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 220,
    maxWidth: 280,
  },
  fileCardCompact: {
    minWidth: 0,
    maxWidth: 220,
  },
  fileCardMe: {
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  fileCardThem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  fileMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalTopBar: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalClose: {
    padding: 8,
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  fullPdfModal: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
  },
  fullPdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  fullPdfWebView: {
    flex: 1,
    backgroundColor: '#111',
  },
  pdfFallbackBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  downloadChipLight: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  downloadChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
