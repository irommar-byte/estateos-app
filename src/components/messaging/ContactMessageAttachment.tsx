import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { FileText, Music, Pause, Play } from 'lucide-react-native';
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
};

export default function ContactMessageAttachment({ attachment, isMe, isDark = true }: Props) {
  const { colors } = getChatTheme(isDark);
  const kind = contactAttachmentKind(attachment);
  const [playing, setPlaying] = useState(false);
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
        }
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

  if (kind === 'image') {
    return (
      <Pressable onPress={() => void openExternal()} style={styles.imageWrap}>
        <Image source={{ uri: attachment.url }} style={styles.image} resizeMode="cover" />
        <Text style={[styles.imageCaption, { color: metaColor }]} numberOfLines={1}>
          {attachment.name}
          {attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
        </Text>
      </Pressable>
    );
  }

  if (kind === 'video') {
    return (
      <View style={styles.videoWrap}>
        <Video
          source={{ uri: attachment.url }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
        />
        <Text style={[styles.imageCaption, { color: metaColor }]} numberOfLines={1}>
          {attachment.name}
        </Text>
      </View>
    );
  }

  if (kind === 'audio') {
    return (
      <View style={[styles.fileCard, isMe ? styles.fileCardMe : styles.fileCardThem]}>
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
        <Pressable onPress={() => void toggleAudio()} style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : colors.primary }]}>
          {playing ? <Pause size={14} color={isMe ? '#000' : '#fff'} /> : <Play size={14} color={isMe ? '#000' : '#fff'} />}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void openExternal()}
      style={[styles.fileCard, isMe ? styles.fileCardMe : styles.fileCardThem]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor:
              kind === 'pdf'
                ? isMe
                  ? 'rgba(0,0,0,0.12)'
                  : 'rgba(255,59,48,0.18)'
                : isMe
                  ? 'rgba(0,0,0,0.12)'
                  : 'rgba(255,255,255,0.08)',
          },
        ]}
      >
        <FileText size={16} color={kind === 'pdf' && !isMe ? '#FF3B30' : isMe ? '#000' : colors.textBase} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: titleColor }]} numberOfLines={1}>
          {attachment.name}
        </Text>
        <Text style={[styles.fileMeta, { color: metaColor }]}>
          {kind === 'pdf' ? 'PDF' : 'Plik'}
          {attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ''}
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
    maxWidth: 240,
  },
  image: {
    width: 240,
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  imageCaption: {
    fontSize: 11,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 2,
  },
  videoWrap: {
    marginTop: 6,
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: 260,
  },
  video: {
    width: 260,
    height: 180,
    backgroundColor: '#000',
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
});
