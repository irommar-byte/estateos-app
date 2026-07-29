import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText } from 'lucide-react-native';
import { getSafeWebView } from './safeWebView';
import {
  resolveContactPdfPreviewUri,
  resolveContactPdfThumbnail,
} from '../../utils/contactPdfThumbnail';

type Props = {
  url: string;
  width: number;
  height: number;
  onPress?: () => void;
  fileName?: string;
};

/**
 * Podgląd pierwszej strony PDF w sztywnej ramce (bez rozciągania).
 * 1) QuickLook thumbnail (iOS)
 * 2) WebView z lokalnym PDF / Google Viewer
 * 3) Karta dokumentowa (nigdy pusta biała kartka)
 */
export default function ContactPdfThumbnail({ url, width, height, onPress, fileName }: Props) {
  const WebView = useMemo(() => getSafeWebView(), []);
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [webUri, setWebUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'thumb' | 'web' | 'card'>('loading');

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setThumbUri(null);
    setWebUri(null);

    void (async () => {
      const thumb = await resolveContactPdfThumbnail(url, width, height);
      if (cancelled) return;
      if (thumb) {
        setThumbUri(thumb);
        setPhase('thumb');
        return;
      }

      if (WebView) {
        try {
          const preview = await resolveContactPdfPreviewUri(url);
          if (cancelled) return;
          setWebUri(preview);
          setPhase('web');
          return;
        } catch {
          // fall through to card
        }
      }

      if (!cancelled) setPhase('card');
    })();

    return () => {
      cancelled = true;
    };
  }, [url, width, height, WebView]);

  const body = (
    <View style={[styles.box, { width, height }]}>
      {phase === 'loading' ? (
        <ActivityIndicator size="small" color="#8E8E93" />
      ) : null}

      {phase === 'thumb' && thumbUri ? (
        <Image
          source={{ uri: thumbUri }}
          style={{ width, height }}
          contentFit="contain"
          transition={160}
          recyclingKey={thumbUri}
        />
      ) : null}

      {phase === 'web' && webUri && WebView ? (
        <View style={[styles.webClip, { width, height }]} pointerEvents="none">
          <WebView
            source={{ uri: webUri }}
            style={{
              width,
              // Lekko wyżej niż clip — widać górę pierwszej strony, bez scalesPageToFit.
              height: Math.round(height * (Platform.OS === 'ios' ? 1.15 : 1.05)),
              backgroundColor: '#FFFFFF',
            }}
            scrollEnabled={false}
            originWhitelist={['*']}
            startInLoadingState
            // NIE używamy scalesPageToFit — to rozciągało stronę.
          />
        </View>
      ) : null}

      {phase === 'card' ? (
        <View style={styles.card}>
          <View style={styles.badge}>
            <FileText size={22} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={styles.cardLabel}>PDF</Text>
          {fileName ? (
            <Text style={styles.cardName} numberOfLines={2}>
              {fileName}
            </Text>
          ) : (
            <Text style={styles.cardHint}>Dotknij, by otworzyć</Text>
          )}
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{body}</Pressable>;
  }
  return body;
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ECECEF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  webClip: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  card: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: '#F2F2F7',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FF3B30',
  },
  cardName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  cardHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
});
