import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

type Props = {
  visible: boolean;
  images: string[];
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
  counterLabel: (current: number, total: number) => string;
  closeLabel: string;
};

const THUMB = 58;
const THUMB_GAP = 8;

export default function OfferGlassGallery({
  visible,
  images,
  currentIndex,
  onChangeIndex,
  onClose,
  counterLabel,
  closeLabel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const stripRef = useRef<FlatList<string>>(null);
  const opacity = useSharedValue(0);
  const dragY = useSharedValue(0);

  const safeIndex = Math.max(0, Math.min(Math.max(images.length - 1, 0), currentIndex));
  const activeUri = images[safeIndex] || images[0];

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      dragY.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: 220 });
    dragY.value = 0;
  }, [visible, opacity, dragY]);

  useEffect(() => {
    if (!visible || images.length <= 1) return;
    const timer = setTimeout(() => {
      try {
        stripRef.current?.scrollToIndex({
          index: safeIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        /* ignore out-of-range */
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [safeIndex, visible, images.length]);

  const finishClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const closeAnimated = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    opacity.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [finishClose, opacity]);

  const selectIndex = useCallback(
    (index: number) => {
      if (index === safeIndex) return;
      Haptics.selectionAsync();
      onChangeIndex(index);
    },
    [onChangeIndex, safeIndex],
  );

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    selectIndex((safeIndex - 1 + images.length) % images.length);
  }, [images.length, safeIndex, selectIndex]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    selectIndex((safeIndex + 1) % images.length);
  }, [images.length, safeIndex, selectIndex]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-28, 28])
        .onUpdate((e) => {
          if (e.translationY > 0) dragY.value = e.translationY;
        })
        .onEnd((e) => {
          if (e.translationY > 120 || e.velocityY > 1100) {
            runOnJS(closeAnimated)();
            return;
          }
          dragY.value = withTiming(0, { duration: 200 });
        }),
    [closeAnimated, dragY],
  );

  const swipeX = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .onEnd((e) => {
          if (e.translationX < -48 || e.velocityX < -600) {
            runOnJS(goNext)();
            return;
          }
          if (e.translationX > 48 || e.velocityX > 600) {
            runOnJS(goPrev)();
          }
        }),
    [goNext, goPrev],
  );

  const composed = useMemo(() => Gesture.Simultaneous(pan, swipeX), [pan, swipeX]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: dragY.value },
      {
        scale: interpolate(dragY.value, [0, height * 0.35], [1, 0.94], Extrapolation.CLAMP),
      },
    ],
  }));

  const renderThumb = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => {
      const active = index === safeIndex;
      return (
        <Pressable
          onPress={() => selectIndex(index)}
          style={[styles.thumbWrap, active && styles.thumbWrapActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <Image source={{ uri: item }} style={styles.thumbImage} contentFit="cover" />
          {active ? <View style={styles.thumbActiveRing} pointerEvents="none" /> : null}
        </Pressable>
      );
    },
    [safeIndex, selectIndex],
  );

  if (!visible || !images.length) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={closeAnimated}
      statusBarTranslucent
    >
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.root, rootStyle]}>
          {/* Zamglone odbicie bieżącego zdjęcia w tle */}
          <Image
            source={{ uri: activeUri }}
            style={styles.bgImage}
            contentFit="cover"
            blurRadius={Platform.OS === 'ios' ? 28 : 18}
          />
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.bgDim} pointerEvents="none" />

          <View style={[styles.stage, { height: height * 0.62, marginTop: insets.top + 56 }]}>
            <Image
              source={{ uri: activeUri }}
              style={styles.mainImage}
              contentFit="contain"
              transition={160}
            />
            {images.length > 1 ? (
              <>
                <Pressable
                  onPress={goPrev}
                  style={[styles.edgeHit, styles.edgeHitLeft]}
                  accessibilityRole="button"
                />
                <Pressable
                  onPress={goNext}
                  style={[styles.edgeHit, styles.edgeHitRight]}
                  accessibilityRole="button"
                />
              </>
            ) : null}
          </View>

          <View
            style={[styles.header, { paddingTop: Math.max(insets.top + 6, Platform.OS === 'ios' ? 54 : 36) }]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={closeAnimated}
              style={styles.headerBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
            >
              <BlurView intensity={70} tint="dark" style={styles.headerBtnGlass}>
                <X color="#FFFFFF" size={18} strokeWidth={2.4} />
              </BlurView>
            </Pressable>
            <BlurView intensity={70} tint="dark" style={styles.counterGlass}>
              <Text style={styles.counterText}>{counterLabel(safeIndex + 1, images.length)}</Text>
            </BlurView>
            <View style={styles.headerBtnSpacer} />
          </View>

          <View style={[styles.filmWrap, { paddingBottom: Math.max(insets.bottom + 10, 22) }]}>
            <BlurView intensity={80} tint="dark" style={styles.filmGlass}>
              <View style={styles.filmSheen} pointerEvents="none" />
              <FlatList
                ref={stripRef}
                data={images}
                keyExtractor={(uri, idx) => `${idx}-${uri.slice(-24)}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filmContent}
                ItemSeparatorComponent={() => <View style={{ width: THUMB_GAP }} />}
                renderItem={renderThumb}
                getItemLayout={(_, index) => ({
                  length: THUMB + THUMB_GAP,
                  offset: (THUMB + THUMB_GAP) * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  stripRef.current?.scrollToOffset({
                    offset: Math.max(0, info.averageItemLength * info.index - width / 2),
                    animated: true,
                  });
                }}
              />
            </BlurView>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.12 }],
  },
  bgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  stage: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  edgeHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '28%',
  },
  edgeHitLeft: { left: 0 },
  edgeHitRight: { right: 0 },
  header: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  headerBtnGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,9,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  headerBtnSpacer: { width: 36 },
  counterGlass: {
    minHeight: 34,
    borderRadius: 17,
    overflow: 'hidden',
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,9,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  counterText: {
    color: '#F5F5F7',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filmWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
  },
  filmGlass: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(12,12,14,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 12,
  },
  filmSheen: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filmContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbWrapActive: {
    borderColor: 'rgba(255,255,255,0.92)',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbActiveRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.85)',
  },
});
