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
  startIndex?: number;
  preferredNextIndex?: number | null;
  preferredNextNonce?: number;
  style?: StyleProp<ViewStyle>;
  motionSeed?: number | string;
  recyclingKey?: string;
};

/** Jedno pełne okrążenie kamery po kółku. */
const CYCLE_MS = 18000;
/** Morph dopiero pod koniec okrążenia — wcześniej można kolejkować miniaturę. */
const HOLD_END = 0.72;

/**
 * Kamera stoi w środku pokoju i spokojnie kręci się po kółku.
 * Bez skoków / trybów: tylko ciągły orbit + miękka zmiana zdjęcia.
 */
export default function LiveHeroPhoto({
  uri,
  uris,
  startIndex = 0,
  preferredNextIndex = null,
  preferredNextNonce = 0,
  style,
  recyclingKey,
}: Props) {
  const list = useMemo(() => {
    const fromArr = (uris || []).map((u) => String(u || '').trim()).filter(Boolean);
    if (fromArr.length) return fromArr;
    const single = String(uri || '').trim();
    return single ? [single] : [];
  }, [uri, uris]);

  const listKey = list.join('|');
  const multi = list.length > 1;
  const safeStart = list.length
    ? Math.max(0, Math.min(Math.floor(startIndex) || 0, list.length - 1))
    : 0;

  const [slotA, setSlotA] = useState(list[safeStart] || '');
  const [slotB, setSlotB] = useState(
    list[(safeStart + 1) % Math.max(list.length, 1)] || list[safeStart] || '',
  );

  const cursorRef = useRef(safeStart);
  const aOutgoingRef = useRef(true);
  const queuedNextRef = useRef<number | null>(null);
  const delayedQueueRef = useRef<number | null>(null);
  const listRef = useRef(list);
  listRef.current = list;

  const aIsOutgoing = useSharedValue(1);
  const multiSV = useSharedValue(multi ? 1 : 0);
  const progress = useSharedValue(0);
  multiSV.value = multi ? 1 : 0;

  const [motionOk, setMotionOk] = useState(true);

  const applyStartIndex = useCallback(
    (index: number) => {
      const L = listRef.current;
      if (!L.length) return;
      const i = Math.max(0, Math.min(index, L.length - 1));
      cursorRef.current = i;
      queuedNextRef.current = null;
      delayedQueueRef.current = null;
      aOutgoingRef.current = true;
      aIsOutgoing.value = 1;
      setSlotA(L[i] || '');
      setSlotB(L[(i + 1) % L.length] || L[i] || '');
    },
    [aIsOutgoing],
  );

  const queueNextIndex = useCallback(
    (index: number) => {
      const L = listRef.current;
      if (L.length < 2) return;
      const i = Math.max(0, Math.min(Math.floor(index), L.length - 1));
      if (i === cursorRef.current) {
        queuedNextRef.current = null;
        delayedQueueRef.current = null;
        return;
      }
      if (progress.value < HOLD_END) {
        queuedNextRef.current = i;
        delayedQueueRef.current = null;
        if (aOutgoingRef.current) setSlotB(L[i]!);
        else setSlotA(L[i]!);
      } else {
        delayedQueueRef.current = i;
        queuedNextRef.current = null;
      }
    },
    [progress],
  );

  const prepareNextHiddenSlot = useCallback(() => {
    const L = listRef.current;
    if (L.length < 2) return;

    const justShown =
      queuedNextRef.current != null ? queuedNextRef.current : (cursorRef.current + 1) % L.length;
    queuedNextRef.current = null;
    cursorRef.current = justShown;

    const wasDelayed = delayedQueueRef.current != null;
    const upcomingIndex = wasDelayed
      ? delayedQueueRef.current!
      : (justShown + 1) % L.length;
    delayedQueueRef.current = null;
    const upcoming = L[upcomingIndex]!;
    if (wasDelayed) queuedNextRef.current = upcomingIndex;

    if (aOutgoingRef.current) {
      setSlotA(upcoming);
      aOutgoingRef.current = false;
    } else {
      setSlotB(upcoming);
      aOutgoingRef.current = true;
    }
  }, []);

  const startCycleRef = useRef<() => void>(() => {});

  const beginNextCycle = useCallback(() => {
    startCycleRef.current();
  }, []);

  startCycleRef.current = () => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: CYCLE_MS,
        easing: Easing.linear,
      },
      (finished) => {
        if (!finished) return;
        if (multiSV.value) {
          aIsOutgoing.value = aIsOutgoing.value ? 0 : 1;
          progress.value = 0;
          runOnJS(prepareNextHiddenSlot)();
        } else {
          progress.value = 0;
        }
        runOnJS(beginNextCycle)();
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
    applyStartIndex(safeStart);
    if (!motionOk || !list.length) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    startCycleRef.current();
    return () => {
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, safeStart, motionOk]);

  useEffect(() => {
    if (preferredNextNonce < 1) return;
    if (preferredNextIndex == null || !list.length) return;
    queueNextIndex(preferredNextIndex);
  }, [preferredNextIndex, preferredNextNonce, list.length, queueNextIndex]);

  const cameraStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    // Jedno pełne kółko — stała prędkość kątowa, zero skoków.
    const angle = p * Math.PI * 2;

    const radiusX = 26;
    const radiusY = 9;

    const tx = Math.cos(angle) * radiusX;
    const ty = Math.sin(angle) * radiusY;
    // Lekki „oddech”, ciągły — nie osobne tryby zoomu.
    const scale = 1.08 + Math.sin(angle) * 0.04;
    const rotY = Math.sin(angle) * 1.8;
    const rotZ = Math.cos(angle) * 0.35;

    return {
      transform: [
        { perspective: 1200 },
        { translateX: tx },
        { translateY: ty },
        { rotateY: `${rotY}deg` },
        { rotateZ: `${rotZ}deg` },
        { scale },
      ],
    };
  });

  // Płynne wyjechanie kolejnego zdjęcia pod koniec okrążenia (orbit się nie zatrzymuje).
  const layerAStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const m = multiSV.value;
    const outgoing = aIsOutgoing.value === 1;
    if (!m) return { opacity: 1 };

    if (outgoing) {
      return {
        opacity: interpolate(
          p,
          [0, 0.78, 0.88, 0.96, 1],
          [1, 1, 0.55, 0.12, 0],
          Extrapolation.CLAMP,
        ),
      };
    }
    return {
      opacity: interpolate(
        p,
        [0, 0.78, 0.88, 0.96, 1],
        [0, 0, 0.45, 0.9, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const layerBStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const m = multiSV.value;
    const outgoing = aIsOutgoing.value === 0;
    if (!m) return { opacity: 0 };

    if (outgoing) {
      return {
        opacity: interpolate(
          p,
          [0, 0.78, 0.88, 0.96, 1],
          [1, 1, 0.55, 0.12, 0],
          Extrapolation.CLAMP,
        ),
      };
    }
    return {
      opacity: interpolate(
        p,
        [0, 0.78, 0.88, 0.96, 1],
        [0, 0, 0.45, 0.9, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  if (!slotA) {
    return <View style={[styles.clip, style, { backgroundColor: '#111' }]} />;
  }

  return (
    <View style={[styles.clip, style]}>
      <Animated.View style={[styles.camera, cameraStyle]} pointerEvents="none">
        <Animated.View style={[styles.layer, layerAStyle]}>
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
          <Animated.View style={[styles.layer, layerBStyle]}>
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '130%',
    height: '130%',
    marginLeft: '-15%',
    marginTop: '-15%',
  },
});
