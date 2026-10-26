import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
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
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { getScreenOrientationApi } from '../../utils/screenOrientationSafe';

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
const MIN_SCALE = 1;
const MAX_SCALE = 4;

function ZoomablePhoto({
  uri,
  width,
  height,
  enabled,
  zoomed,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  enabled: boolean;
  zoomed: SharedValue<number>;
  onZoomChange?: (isZoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTX.value = 0;
    savedTY.value = 0;
    zoomed.value = 0;
    onZoomChange?.(false);
  }, [uri, scale, savedScale, translateX, translateY, savedTX, savedTY, zoomed, onZoomChange]);

  const clampTranslate = (sx: number, sy: number, nextScale: number) => {
    'worklet';
    const maxX = ((nextScale - 1) * width) / 2;
    const maxY = ((nextScale - 1) * height) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, sx)),
      y: Math.max(-maxY, Math.min(maxY, sy)),
    };
  };

  const syncZoomed = (next: number) => {
    'worklet';
    const isZoomed = next > 1.05;
    zoomed.value = isZoomed ? 1 : 0;
    if (onZoomChange) runOnJS(onZoomChange)(isZoomed);
  };

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(enabled)
        .onStart(() => {
          savedScale.value = scale.value;
        })
        .onUpdate((e) => {
          const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
          scale.value = next;
          syncZoomed(next);
          const clamped = clampTranslate(translateX.value, translateY.value, next);
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        })
        .onEnd(() => {
          if (scale.value < 1.05) {
            scale.value = withSpring(1, { damping: 18, stiffness: 220 });
            translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
            translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
            savedScale.value = 1;
            savedTX.value = 0;
            savedTY.value = 0;
            zoomed.value = 0;
            if (onZoomChange) runOnJS(onZoomChange)(false);
            return;
          }
          savedScale.value = scale.value;
          syncZoomed(scale.value);
          const clamped = clampTranslate(translateX.value, translateY.value, scale.value);
          translateX.value = withTiming(clamped.x, { duration: 120 });
          translateY.value = withTiming(clamped.y, { duration: 120 });
          savedTX.value = clamped.x;
          savedTY.value = clamped.y;
        }),
    [enabled, height, onZoomChange, savedScale, savedTX, savedTY, scale, translateX, translateY, width, zoomed],
  );

  // Pan only claims the gesture when already zoomed — otherwise FlatList owns horizontal swipe.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .averageTouches(true)
        .minPointers(1)
        .maxPointers(2)
        .manualActivation(true)
        .onTouchesMove((_e, state) => {
          if (scale.value > 1.05) {
            state.activate();
          } else {
            state.fail();
          }
        })
        .onStart(() => {
          savedTX.value = translateX.value;
          savedTY.value = translateY.value;
        })
        .onUpdate((e) => {
          const clamped = clampTranslate(
            savedTX.value + e.translationX,
            savedTY.value + e.translationY,
            scale.value,
          );
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        })
        .onEnd(() => {
          savedTX.value = translateX.value;
          savedTY.value = translateY.value;
        }),
    [enabled, savedTX, savedTY, scale, translateX, translateY],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(enabled)
        .numberOfTaps(2)
        .onEnd(() => {
          if (scale.value > 1.2) {
            scale.value = withSpring(1, { damping: 16, stiffness: 200 });
            translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
            translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
            savedScale.value = 1;
            savedTX.value = 0;
            savedTY.value = 0;
            zoomed.value = 0;
            if (onZoomChange) runOnJS(onZoomChange)(false);
          } else {
            scale.value = withSpring(2.2, { damping: 16, stiffness: 200 });
            savedScale.value = 2.2;
            zoomed.value = 1;
            if (onZoomChange) runOnJS(onZoomChange)(true);
          }
        }),
    [enabled, onZoomChange, savedScale, savedTX, savedTY, scale, translateX, translateY, zoomed],
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pinch, pan, doubleTap),
    [doubleTap, pan, pinch],
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={{ width, height, overflow: 'hidden' }}>
        <Animated.View style={[{ width, height }, imageStyle]}>
          <Image source={{ uri }} style={{ width, height }} contentFit="contain" transition={120} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

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
  const pagerRef = useRef<FlatList<string>>(null);
  const opacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const immersive = useSharedValue(0);
  const zoomed = useSharedValue(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const scrollingRef = useRef(false);

  const safeIndex = Math.max(0, Math.min(Math.max(images.length - 1, 0), currentIndex));
  const activeUri = images[safeIndex] || images[0];
  const landscape = width > height;
  const chromeBottom = isImmersive || landscape ? 0 : Math.max(insets.bottom + 10, 22) + 86;
  const stageTop = isImmersive || landscape ? insets.top + 8 : insets.top + 56;
  const stageHeight = Math.max(220, height - stageTop - chromeBottom);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      dragY.value = 0;
      zoomed.value = 0;
      immersive.value = 0;
      setIsZoomed(false);
      setIsImmersive(false);
      getScreenOrientationApi().lockPortrait();
      return;
    }
    opacity.value = withTiming(1, { duration: 220 });
    dragY.value = 0;
    zoomed.value = 0;
    immersive.value = 0;
    setIsZoomed(false);
    setIsImmersive(false);
  }, [visible, opacity, dragY, zoomed, immersive]);

  useEffect(() => {
    zoomed.value = 0;
    setIsZoomed(false);
  }, [safeIndex, zoomed]);

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
        /* ignore */
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [safeIndex, visible, images.length]);

  // Keep pager in sync when index changes from thumbs / external.
  useEffect(() => {
    if (!visible || scrollingRef.current) return;
    try {
      pagerRef.current?.scrollToIndex({ index: safeIndex, animated: true });
    } catch {
      pagerRef.current?.scrollToOffset({ offset: safeIndex * width, animated: true });
    }
  }, [safeIndex, visible, width]);

  const finishClose = useCallback(() => {
    getScreenOrientationApi().lockPortrait();
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
      const next = Math.max(0, Math.min(images.length - 1, index));
      if (next === safeIndex) return;
      Haptics.selectionAsync();
      onChangeIndex(next);
    },
    [images.length, onChangeIndex, safeIndex],
  );

  const enterImmersive = useCallback(() => {
    if (isImmersive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsImmersive(true);
    immersive.value = withTiming(1, { duration: 260 });
    getScreenOrientationApi().unlockAll();
  }, [immersive, isImmersive]);

  const exitImmersive = useCallback(() => {
    if (!isImmersive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsImmersive(false);
    immersive.value = withTiming(0, { duration: 220 });
    getScreenOrientationApi().lockPortrait();
  }, [immersive, isImmersive]);

  const onPagerScrollBegin = useCallback(() => {
    scrollingRef.current = true;
  }, []);

  const onPagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(width, 1));
      scrollingRef.current = false;
      if (next >= 0 && next < images.length && next !== safeIndex) {
        Haptics.selectionAsync();
        onChangeIndex(next);
      }
    },
    [images.length, onChangeIndex, safeIndex, width],
  );

  const pagerNative = useMemo(() => Gesture.Native(), []);

  const verticalNav = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isZoomed)
        .activeOffsetY([-16, 16])
        .failOffsetX([-28, 28])
        .simultaneousWithExternalGesture(pagerNative)
        .onUpdate((e) => {
          if (zoomed.value > 0.5) return;
          // Pull-down rubber band; subtle lift when swiping up toward immersive.
          if (e.translationY > 0) dragY.value = e.translationY;
          else dragY.value = e.translationY * 0.28;
        })
        .onEnd((e) => {
          if (zoomed.value > 0.5) {
            dragY.value = withTiming(0, { duration: 160 });
            return;
          }
          const down = e.translationY > 110 || e.velocityY > 900;
          const up = e.translationY < -90 || e.velocityY < -900;

          if (immersive.value > 0.5) {
            if (down) {
              dragY.value = withTiming(0, { duration: 160 });
              runOnJS(exitImmersive)();
              return;
            }
            dragY.value = withTiming(0, { duration: 200 });
            return;
          }

          if (down) {
            runOnJS(closeAnimated)();
            return;
          }
          if (up) {
            dragY.value = withTiming(0, { duration: 160 });
            runOnJS(enterImmersive)();
            return;
          }
          dragY.value = withTiming(0, { duration: 200 });
        }),
    [closeAnimated, dragY, enterImmersive, exitImmersive, immersive, isZoomed, pagerNative, zoomed],
  );

  const rootStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: Math.max(0, dragY.value) },
      {
        scale: interpolate(Math.max(0, dragY.value), [0, height * 0.35], [1, 0.94], Extrapolation.CLAMP),
      },
    ],
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(immersive.value, [0, 1], [1, landscape ? 0.55 : 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(immersive.value, [0, 1], [0, 24], Extrapolation.CLAMP),
      },
    ],
  }));

  const filmStyle = useAnimatedStyle(() => ({
    opacity: interpolate(immersive.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(immersive.value, [0, 1], [0, 56], Extrapolation.CLAMP),
      },
    ],
  }));

  const renderPage = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => (
      <View style={{ width, height: stageHeight, justifyContent: 'center', alignItems: 'center' }}>
        <ZoomablePhoto
          uri={item}
          width={width}
          height={stageHeight}
          enabled={index === safeIndex}
          zoomed={zoomed}
          onZoomChange={index === safeIndex ? setIsZoomed : undefined}
        />
      </View>
    ),
    [safeIndex, stageHeight, width, zoomed],
  );

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
      onRequestClose={() => {
        if (isImmersive) exitImmersive();
        else closeAnimated();
      }}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <GestureHandlerRootView style={styles.flex}>
        <GestureDetector gesture={verticalNav}>
          <Animated.View style={[styles.root, rootStyle]}>
            <Image
              source={{ uri: activeUri }}
              style={styles.bgImage}
              contentFit="cover"
              blurRadius={Platform.OS === 'ios' ? 28 : 18}
            />
            <BlurView intensity={isImmersive || landscape ? 28 : 55} tint="dark" style={StyleSheet.absoluteFill} />
            <View
              style={[styles.bgDim, (isImmersive || landscape) && styles.bgDimImmersive]}
              pointerEvents="none"
            />

            <View style={[styles.stage, { height: stageHeight, marginTop: stageTop }]}>
              <GestureDetector gesture={pagerNative}>
                <FlatList
                  ref={pagerRef}
                  data={images}
                  keyExtractor={(uri, idx) => `page-${idx}-${uri.slice(-24)}`}
                  horizontal
                  pagingEnabled
                  bounces={!isZoomed}
                  scrollEnabled={!isZoomed}
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  disableIntervalMomentum
                  initialScrollIndex={safeIndex}
                  getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                  })}
                  onScrollBeginDrag={onPagerScrollBegin}
                  onMomentumScrollEnd={onPagerMomentumEnd}
                  onScrollToIndexFailed={(info) => {
                    pagerRef.current?.scrollToOffset({
                      offset: info.index * width,
                      animated: false,
                    });
                  }}
                  renderItem={renderPage}
                  windowSize={3}
                  maxToRenderPerBatch={3}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              </GestureDetector>
            </View>

            <Animated.View
              style={[
                styles.header,
                {
                  paddingTop: Math.max(insets.top + 6, Platform.OS === 'ios' ? 54 : 36),
                },
                chromeStyle,
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                onPress={() => {
                  if (isImmersive) exitImmersive();
                  else closeAnimated();
                }}
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
            </Animated.View>

            {!landscape ? (
              <Animated.View
                style={[styles.filmWrap, { paddingBottom: Math.max(insets.bottom + 10, 22) }, filmStyle]}
                pointerEvents={isImmersive ? 'none' : 'box-none'}
              >
                <BlurView intensity={80} tint="dark" style={styles.filmGlass}>
                  <View style={styles.filmSheen} pointerEvents="none" />
                  <FlatList
                    ref={stripRef}
                    data={images}
                    keyExtractor={(uri, idx) => `thumb-${idx}-${uri.slice(-24)}`}
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
              </Animated.View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  bgDimImmersive: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  stage: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
