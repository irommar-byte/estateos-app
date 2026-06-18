import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { resolveContactPdfThumbnail } from '../../utils/contactPdfThumbnail';

type Props = {
  url: string;
  width: number;
  height: number;
  onPress?: () => void;
};

export default function ContactPdfThumbnail({ url, width, height, onPress }: Props) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void resolveContactPdfThumbnail(url, width, height).then((uri) => {
      if (cancelled) return;
      setThumbUri(uri);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [url, width, height]);

  const body = (
    <View style={[styles.box, { width, height }]}>
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={{ width, height }} contentFit="cover" transition={180} />
      ) : loading ? (
        <ActivityIndicator size="small" color="#8E8E93" />
      ) : (
        <View style={styles.fallback}>
          <View style={styles.fallbackLine} />
          <View style={[styles.fallbackLine, styles.fallbackLineShort]} />
          <View style={styles.fallbackLine} />
          <View style={[styles.fallbackLine, styles.fallbackLineMid]} />
        </View>
      )}
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 8,
  },
  fallbackLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  fallbackLineShort: { width: '62%' },
  fallbackLineMid: { width: '78%' },
});
