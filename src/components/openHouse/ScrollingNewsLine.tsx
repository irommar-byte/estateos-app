import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const GAP = '   ◆   ';

type Props = {
  text: string;
  textStyle?: object;
  pxPerSec?: number;
  height?: number;
  backgroundColor?: string;
  borderBottomRadius?: number;
};

/** Jedna linia, zawsze przewija w kółko (bez statycznego skrótu …). */
export default function ScrollingNewsLine({
  text,
  textStyle,
  pxPerSec = 48,
  height = 32,
  backgroundColor,
  borderBottomRadius,
}: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);
  const segment = `${text}${GAP}`;
  const loopDistance = Math.max(segmentWidth, 120);

  useEffect(() => {
    scrollX.setValue(0);
    if (segmentWidth <= 0) return;
    const duration = Math.max(6000, Math.round((loopDistance / pxPerSec) * 1000));
    const loop = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -loopDistance,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [text, segmentWidth, loopDistance, pxPerSec, scrollX]);

  return (
    <View
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
          onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
        >
          {segment}
        </Text>
      </View>
      <Animated.View style={[styles.track, { transform: [{ translateX: scrollX }] }]}>
        <Text style={[styles.text, textStyle]}>{segment}</Text>
        <Text style={[styles.text, textStyle]}>{segment}</Text>
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
