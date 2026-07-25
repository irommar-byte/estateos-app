import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { DISCOVERY_COLORS, DISCOVERY_MOTION } from './discoveryMotion';

type Props = {
  visible: boolean;
  images: string[];
  index: number;
  onChangeIndex: (index: number) => void;
  onClose: (dwellMs: number) => void;
};

export default function DiscoverySmartGallery({ visible, images, index, onChangeIndex, onClose }: Props) {
  const openedAt = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    openedAt.current = Date.now();
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: DISCOVERY_MOTION.spatialPush, useNativeDriver: true }).start();
  }, [opacity, visible]);
  if (!visible || !images.length) return null;
  const safeIndex = Math.max(0, Math.min(images.length - 1, index));
  const close = () => {
    Animated.timing(opacity, { toValue: 0, duration: DISCOVERY_MOTION.glassSettle, useNativeDriver: true }).start(() => {
      onClose(Math.max(0, Date.now() - openedAt.current));
    });
  };
  const previous = () => onChangeIndex((safeIndex - 1 + images.length) % images.length);
  const next = () => onChangeIndex((safeIndex + 1) % images.length);
  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <Image source={{ uri: images[safeIndex] }} style={StyleSheet.absoluteFill} contentFit="contain" transition={220} />
      <View style={styles.top}>
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Zamknij galerię">
          <BlurView intensity={65} tint="dark" style={styles.iconBlur}>
            <Ionicons name="chevron-down" size={21} color="#FFF" />
          </BlurView>
        </Pressable>
        <BlurView intensity={65} tint="dark" style={styles.counter}>
          <Text style={styles.counterText}>{safeIndex + 1} / {images.length}</Text>
        </BlurView>
      </View>
      {images.length > 1 ? (
        <View style={styles.controls}>
          <Pressable onPress={previous} style={styles.nav} accessibilityRole="button" accessibilityLabel="Poprzednie zdjęcie">
            <BlurView intensity={60} tint="dark" style={styles.iconBlur}><Ionicons name="chevron-back" size={24} color="#FFF" /></BlurView>
          </Pressable>
          <Pressable onPress={next} style={styles.nav} accessibilityRole="button" accessibilityLabel="Następne zdjęcie">
            <BlurView intensity={60} tint="dark" style={styles.iconBlur}><Ionicons name="chevron-forward" size={24} color="#FFF" /></BlurView>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: '#000' },
  top: { position: 'absolute', top: 52, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between' },
  close: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
  counter: { borderRadius: 18, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 13 },
  counterText: { color: DISCOVERY_COLORS.ivory, fontSize: 13, fontWeight: '800' },
  iconBlur: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,9,0.56)' },
  controls: { position: 'absolute', bottom: 50, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between' },
  nav: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: DISCOVERY_COLORS.glassBorder },
});
