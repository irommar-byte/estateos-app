import React, { useEffect, useRef, useState } from 'react';
import {
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
import { FileText, Music, Pause, Play, X } from 'lucide-react-native';
import { getSafeWebView } from './safeWebView';
import ContactPdfThumbnail from './ContactPdfThumbnail';
import { openContactPdfPreview } from '../../utils/contactPdfThumbnail';
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
};

function pdfPreviewUri(url: string) {
  if (url.startsWith('file://') || url.startsWith('content://')) return url;
  if (Platform.OS === 'ios') return url;
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
}

export default function ContactMessageAttachment({ attachment, isMe, isDark = true, compact = false }: Props) {
  const { colors } = getChatTheme(isDark);
  const kind = contactAttachmentKind(attachment);
  const [playing, setPlaying] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const imageWidth = compact ? 120 : 240;
  const imageHeight = compact ? 90 : 180;
  const pdfHeight = compact ? 120 : 220;

  if (kind === 'image') {
    return (
      <>
        <Pressable onPress={() => setPreviewOpen(true)} style={[styles.imageWrap, { maxWidth: imageWidth }]}>
          <Image
            source={{ uri: attachment.url }}
            style={{ width: imageWidth, height: imageHeight, backgroundColor: 'rgba(0,0,0,0.08)' }}
            contentFit="cover"
            transition={200}
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
            <Pressable style={styles.modalClose} onPress={() => setPreviewOpen(false)}>
              <X size={22} color="#fff" />
            </Pressable>
            <Image source={{ uri: attachment.url }} style={styles.modalImage} contentFit="contain" autoplay />
          </View>
        </Modal>
      </>
    );
  }

  const openPdf = async () => {
    const opened = await openContactPdfPreview(attachment.url);
    if (!opened) await openExternal();
  };

  if (kind === 'pdf') {
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

    if (WebView) {
      return (
        <>
          <Pressable onPress={() => setPreviewOpen(true)} style={[styles.pdfWrap, { maxWidth: compact ? 160 : 260 }]}>
            <View style={[styles.pdfPreviewBox, { height: pdfHeight }]}>
              <WebView
                source={{ uri: pdfPreviewUri(attachment.url) }}
                style={styles.pdfWebView}
                scrollEnabled={false}
                originWhitelist={['*']}
                startInLoadingState
                scalesPageToFit
              />
            </View>
            {pdfCard}
          </Pressable>
          <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
            <View style={[styles.fullPdfModal, { backgroundColor: colors.background }]}>
              <View style={styles.fullPdfHeader}>
                <Text style={[styles.fileName, { color: colors.textBase, flex: 1 }]} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Pressable onPress={() => setPreviewOpen(false)} hitSlop={8}>
                  <X size={22} color={colors.textBase} />
                </Pressable>
              </View>
              <WebView source={{ uri: pdfPreviewUri(attachment.url) }} style={styles.fullPdfWebView} originWhitelist={['*']} />
            </View>
          </Modal>
        </>
      );
    }

    return (
      <Pressable
        onPress={() => void openPdf()}
        style={[styles.pdfWrap, { maxWidth: compact ? 160 : 260 }]}
      >
        <ContactPdfThumbnail
          url={attachment.url}
          width={compact ? 160 : 240}
          height={pdfHeight}
        />
        {pdfCard}
      </Pressable>
    );
  }

  if (kind === 'video') {
    return (
      <View style={[styles.videoWrap, { maxWidth: compact ? 180 : 260 }]}>
        <Video
          source={{ uri: attachment.url }}
          style={{ width: compact ? 180 : 260, height: compact ? 120 : 180, backgroundColor: '#000' }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
        />
        {!compact ? (
          <Text style={[styles.imageCaption, { color: metaColor }]} numberOfLines={1}>
            {attachment.name}
          </Text>
        ) : null}
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
          onPress={() => void toggleAudio()}
          style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : colors.primary }]}
        >
          {playing ? <Pause size={14} color={isMe ? '#000' : '#fff'} /> : <Play size={14} color={isMe ? '#000' : '#fff'} />}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void openExternal()}
      style={[styles.fileCard, isMe ? styles.fileCardMe : styles.fileCardThem, compact && styles.fileCardCompact]}
    >
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
  },
  pdfPreviewBox: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  pdfWebView: {
    flex: 1,
    backgroundColor: 'transparent',
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
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  fullPdfModal: {
    flex: 1,
    paddingTop: 56,
  },
  fullPdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  fullPdfWebView: {
    flex: 1,
  },
});
