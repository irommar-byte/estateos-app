import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

type Props = {
  text: string;
  textStyle?: object;
  pxPerSec?: number;
  height?: number;
  backgroundColor?: string;
  borderBottomRadius?: number;
  /** restart = wjeżdża z prawej, przejeżdża, znika po lewej, pauza, znów z prawej; once = jeden przejazd */
  repeat?: 'loop' | 'restart' | 'once';
  pauseMs?: number;
  onPassComplete?: () => void;
};

export default function ScrollingNewsLine({
  text,
  textStyle,
  pxPerSec = 48,
  height = 32,
  backgroundColor,
  borderBottomRadius,
  repeat = 'restart',
  pauseMs = 1200,
  onPassComplete,
}: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [laneWidth, setLaneWidth] = useState(0);

  const onLaneLayout = (e: LayoutChangeEvent) => {
    setLaneWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (repeat === 'loop') {
      if (textWidth <= 0) return;
      const GAP = '   ◆   ';
      const loopDistance = Math.max(textWidth, 120);
      scrollX.setValue(0);
      const duration = Math.max(6000, Math.round((loopDistance / pxPerSec) * 1000));
      const loop = Animated.loop(
        Animated.timing(scrollX, {
          toValue: -loopDistance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }

    if (textWidth <= 0 || laneWidth <= 0) return;

    const startX = laneWidth;
    const endX = -textWidth;
    const distance = startX - endX;
    const duration = Math.max(repeat === 'once' ? 5500 : 3500, Math.round((distance / pxPerSec) * 1000));

    let cancelled = false;
    const runPass = () => {
      if (cancelled) return;
      scrollX.setValue(startX);
      if (repeat === 'once') {
        Animated.timing(scrollX, {
          toValue: endX,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || cancelled) return;
          onPassComplete?.();
        });
        return;
      }
      Animated.sequence([
        Animated.timing(scrollX, {
          toValue: endX,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(pauseMs),
      ]).start(({ finished }) => {
        if (!finished || cancelled) return;
        runPass();
      });
    };

    runPass();
    return () => {
      cancelled = true;
      scrollX.stopAnimation();
    };
  }, [text, textWidth, laneWidth, pxPerSec, pauseMs, repeat, scrollX, onPassComplete]);

  const segment = repeat === 'loop' ? `${text}   ◆   ` : text;

  return (
    <View
      onLayout={onLaneLayout}
      style={[
        styles.lane,
        {
          height,
          backgroundColor,
          borderBottomLeftRadius: borderBottomRadius,
          borderBottomRightRadius: borderBottomRadius,
        },
      ]}
    >
      <View style={styles.measureOffscreen} pointerEvents="none">
        <Text
          style={[styles.text, textStyle]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </View>
      <Animated.View style={[styles.track, { transform: [{ translateX: scrollX }] }]}>
        <Text style={[styles.text, textStyle]}>{segment}</Text>
        {repeat === 'loop' ? <Text style={[styles.text, textStyle]}>{segment}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  measureOffscreen: {
    position: 'absolute',
    left: -8000,
    top: 0,
    opacity: 0,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flexShrink: 0,
    includeFontPadding: false,
  },
});
