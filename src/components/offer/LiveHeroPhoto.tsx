import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  uri?: string;
  uris?: string[];
  style?: StyleProp<ViewStyle>;
  motionSeed?: number | string;
  recyclingKey?: string;
};

const CYCLE_MS = 22000;

/**
 * Wolny pan w lewo + miks z następnym zdjęciem (bez twardego cięcia).
 * Cover + nadmiar kadru — pionowe bez pustych pasków po bokach.
 */
export default function LiveHeroPhoto({ uri, uris, style, recyclingKey }: Props) {
  const list = useMemo(() => {
    const fromArr = (uris || []).map((u) => String(u || '').trim()).filter(Boolean);
    if (fromArr.length) return fromArr;
    const single = String(uri || '').trim();
    return single ? [single] : [];
  }, [uri, uris]);

  const listKey = list.join('|');
  const multi = list.length > 1;

  const [slotA, setSlotA] = useState(list[0] || '');
  const [slotB, setSlotB] = useState(list[1] || list[0] || '');
  const cursorRef = useRef(0);
  /** 1 = A wyjeżdża (B wjeżdża); 0 = B wyjeżdża (A wjeżdża). */
  const aIsOutgoing = useSharedValue(1);
  const multiSV = useSharedValue(multi ? 1 : 0);
  multiSV.value = multi ? 1 : 0;

  const [motionOk, setMotionOk] = useState(true);
  const progress = useSharedValue(0);

  const listRef = useRef(list);
  listRef.current = list;
  const aOutgoingRef = useRef(true);

  const prepareNextHiddenSlot = useCallback(() => {
    const L = listRef.current;
    if (L.length < 2) return;
    const nextCursor = (cursorRef.current + 1) % L.length;
    cursorRef.current = nextCursor;
    const upcoming = L[(nextCursor + 1) % L.length]!;
    if (aOutgoingRef.current) {
      setSlotA(upcoming);
      aOutgoingRef.current = false;
    } else {
      setSlotB(upcoming);
      aOutgoingRef.current = true;
    }
  }, []);

  const startCycleRef = useRef<() => void>(() => {});

  const restartCycleJS = useCallback(() => {
    startCycleRef.current();
  }, []);

  startCycleRef.current = () => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: CYCLE_MS, easing: Easing.inOut(Easing.sin) },
      (finished) => {
        if (!finished) return;
        if (multiSV.value) {
          // Flip + p=0 w tym samym ticku: nowa „outgoing” = dotychczas widoczna (bez flasha).
          aIsOutgoing.value = aIsOutgoing.value ? 0 : 1;
          progress.value = 0;
          runOnJS(prepareNextHiddenSlot)();
        } else {
          progress.value = 0;
        }
        runOnJS(restartCycleJS)();
      },
    );
  };

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      setMotionOk(!reduce);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    cursorRef.current = 0;
    aOutgoingRef.current = true;
    aIsOutgoing.value = 1;
    setSlotA(list[0] || '');
    setSlotB(list[1] || list[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  useEffect(() => {
    cancelAnimation(progress);
    if (!motionOk || !list.length) {
      progress.value = 0;
      return;
    }
    startCycleRef.current();
    return () => {
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, motionOk]);

  const layerAStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const m = multiSV.value;
    const outgoing = aIsOutgoing.value === 1;
    if (!m) {
      const scale = interpolate(p, [0, 0.45, 1], [1.22, 1.3, 1.24], Extrapolation.CLAMP);
      const tx = interpolate(p, [0, 1], [0, -36], Extrapolation.CLAMP);
      const ty = interpolate(p, [0, 0.5, 1], [0, -4, 2], Extrapolation.CLAMP);
      return { opacity: 1, transform: [{ scale }, { translateX: tx }, { translateY: ty }] };
    }
    if (outgoing) {
      const scale = interpolate(p, [0, 0.45, 1], [1.22, 1.3, 1.24], Extrapolation.CLAMP);
      const tx = interpolate(p, [0, 1], [0, -78], Extrapolation.CLAMP);
      const ty = interpolate(p, [0, 0.5, 1], [0, -4, 2], Extrapolation.CLAMP);
      const opacity = interpolate(p, [0, 0.55, 0.8, 1], [1, 1, 0.38, 0], Extrapolation.CLAMP);
      return { opacity, transform: [{ scale }, { translateX: tx }, { translateY: ty }] };
    }
    const scale = interpolate(p, [0, 0.55, 1], [1.28, 1.26, 1.22], Extrapolation.CLAMP);
    const tx = interpolate(p, [0, 1], [82, 0], Extrapolation.CLAMP);
    const ty = interpolate(p, [0, 1], [2, 0], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0, 0.48, 0.72, 1], [0, 0.18, 0.88, 1], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }, { translateX: tx }, { translateY: ty }] };
  });

  const layerBStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const m = multiSV.value;
    const outgoing = aIsOutgoing.value === 0;
    if (!m) return { opacity: 0 };
    if (outgoing) {
      const scale = interpolate(p, [0, 0.45, 1], [1.22, 1.3, 1.24], Extrapolation.CLAMP);
      const tx = interpolate(p, [0, 1], [0, -78], Extrapolation.CLAMP);
      const ty = interpolate(p, [0, 0.5, 1], [0, -4, 2], Extrapolation.CLAMP);
      const opacity = interpolate(p, [0, 0.55, 0.8, 1], [1, 1, 0.38, 0], Extrapolation.CLAMP);
      return { opacity, transform: [{ scale }, { translateX: tx }, { translateY: ty }] };
    }
    const scale = interpolate(p, [0, 0.55, 1], [1.28, 1.26, 1.22], Extrapolation.CLAMP);
    const tx = interpolate(p, [0, 1], [82, 0], Extrapolation.CLAMP);
    const ty = interpolate(p, [0, 1], [2, 0], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0, 0.48, 0.72, 1], [0, 0.18, 0.88, 1], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }, { translateX: tx }, { translateY: ty }] };
  });

  if (!slotA) {
    return <View style={[styles.clip, style, { backgroundColor: '#111' }]} />;
  }

  return (
    <View style={[styles.clip, style]}>
      <Animated.View style={[styles.layer, layerAStyle]} pointerEvents="none">
        <Image
          source={{ uri: slotA }}
          style={styles.image}
          contentFit="cover"
          contentPosition="center"
          transition={0}
          recyclingKey={`${recyclingKey || 'hero'}-a`}
        />
      </Animated.View>
      {multi ? (
        <Animated.View style={[styles.layer, layerBStyle]} pointerEvents="none">
          <Image
            source={{ uri: slotB }}
            style={styles.image}
            contentFit="cover"
            contentPosition="center"
            transition={0}
            recyclingKey={`${recyclingKey || 'hero'}-b`}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '122%',
    height: '122%',
    marginLeft: '-11%',
    marginTop: '-11%',
  },
});
