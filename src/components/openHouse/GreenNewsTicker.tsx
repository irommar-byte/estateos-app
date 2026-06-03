import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

const GAP = '   ◆   ';
const PX_PER_SEC = 48;

type Props = {
  text: string;
};

/**
 * Zielony pasek TV-news — treść jedzie w kółko, nawet gdy krótka.
 */
export default function GreenNewsTicker({ text }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [laneWidth, setLaneWidth] = useState(0);
  const [segmentWidth, setSegmentWidth] = useState(0);

  const loopDistance = Math.max(segmentWidth, 1);

  useEffect(() => {
    scrollX.setValue(0);
    if (laneWidth <= 0 || segmentWidth <= 0) return;

    const duration = Math.max(5000, Math.round((loopDistance / PX_PER_SEC) * 1000));
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
  }, [text, laneWidth, segmentWidth, loopDistance, scrollX]);

  const segment = `${text}${GAP}`;

  return (
    <View style={styles.lane} onLayout={(e) => setLaneWidth(e.nativeEvent.layout.width)}>
      <View style={styles.measureWrap} pointerEvents="none">
        <Text style={styles.text} onLayout={(e: LayoutChangeEvent) => setSegmentWidth(e.nativeEvent.layout.width)}>
          {segment}
        </Text>
      </View>
      <Animated.View style={[styles.track, { transform: [{ translateX: scrollX }] }]}>
        <Text style={styles.text}>{segment}</Text>
        <Text style={styles.text}>{segment}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    height: 30,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  measureWrap: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    flexDirection: 'row',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
    letterSpacing: 0.2,
  },
});
