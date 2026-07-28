import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DISCOVERY_COLORS, DISCOVERY_MOTION } from './discoveryMotion';

type Props = {
  visible: boolean;
  images: string[];
  index: number;
  onChangeIndex: (index: number) => void;
  onClose: (dwellMs: number) => void;
  onOpenDetail?: () => void;
};

export default function DiscoverySmartGallery({
  visible,
  images,
  index,
  onChangeIndex,
  onClose,
  onOpenDetail,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const openedAt = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    openedAt.current = Date.now();
    dragY.setValue(0);
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: DISCOVERY_MOTION.spatialPush,
      useNativeDriver: true,
    }).start();
  }, [dragY, opacity, visible]);

  const closeAnimated = useRef(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const dwell = Math.max(0, Date.now() - openedAt.current);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: DISCOVERY_MOTION.glassSettle,
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 140,
        duration: DISCOVERY_MOTION.glassSettle,
        useNativeDriver: true,
      }),
    ]).start(() => onCloseRef.current(dwell));
  }).current;

  const safeIndex = Math.max(0, Math.min(Math.max(images.length - 1, 0), index));
  const previous = () => {
    if (images.length <= 1) return;
    onChangeIndex((safeIndex - 1 + images.length) % images.length);
  };
  const next = () => {
    if (images.length <= 1) return;
    onChangeIndex((safeIndex + 1) % images.length);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 1.15) {
            closeAnimated();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            friction: 8,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            friction: 8,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
      }),
    [closeAnimated, dragY],
  );

  if (!visible || !images.length) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity,
          transform: [
            { translateY: dragY },
            {
              scale: dragY.interpolate({
                inputRange: [0, height * 0.4],
                outputRange: [1, 0.92],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Image
        source={{ uri: images[safeIndex] }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={180}
      />

      <View style={[styles.top, { paddingTop: Math.max(12, insets.top + 6) }]} pointerEvents="box-none">
        <Pressable
          onPress={closeAnimated}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Zamknij galerię"
        >
          <BlurView intensity={70} tint="dark" style={styles.iconBlur}>
            <Ionicons name="chevron-down" size={22} color="#FFF" />
          </BlurView>
        </Pressable>
        <BlurView intensity={70} tint="dark" style={styles.counter}>
          <Text style={styles.counterText}>
            {safeIndex + 1} / {images.length}
          </Text>
        </BlurView>
        {onOpenDetail ? (
          <Pressable
            onPress={onOpenDetail}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Otwórz ofertę"
          >
            <BlurView intensity={70} tint="dark" style={styles.iconBlur}>
              <Ionicons name="open-outline" size={18} color="#FFF" />
            </BlurView>
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {images.length > 1 ? (
        <>
          <Pressable
            onPress={previous}
            style={[styles.sideArrow, styles.sideArrowLeft, { top: height * 0.42 }]}
            accessibilityRole="button"
            accessibilityLabel="Poprzednie zdjęcie"
            hitSlop={12}
          >
            <BlurView intensity={55} tint="dark" style={styles.sideArrowGlass}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </BlurView>
          </Pressable>
          <Pressable
            onPress={next}
            style={[styles.sideArrow, styles.sideArrowRight, { top: height * 0.42 }]}
            accessibilityRole="button"
            accessibilityLabel="Następne zdjęcie"
            hitSlop={12}
          >
            <BlurView intensity={55} tint="dark" style={styles.sideArrowGlass}>
              <Ionicons name="chevron-forward" size={22} color="#FFF" />
            </BlurView>
          </Pressable>
        </>
      ) : null}

      <View style={[styles.hintWrap, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
        <Text style={styles.hint}>Przesuń w dół, aby wrócić</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  iconBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,9,0.56)',
  },
  counter: {
    minHeight: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(8,8,9,0.45)',
  },
  counterText: {
    color: DISCOVERY_COLORS.ivory,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sideArrow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sideArrowLeft: { left: 14 },
  sideArrowRight: { right: 14 },
  sideArrowGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,9,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 22,
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  hint: {
    color: 'rgba(235,235,245,0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
