import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const GAP = '   ◆   ';
const PX_PER_SEC = 48;

type Props = {
  text: string;
};

/**
 * Zielony pasek TV-news — jedna linia, treść w kółko.
 */
export default function GreenNewsTicker({ text }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [laneWidth, setLaneWidth] = useState(0);
  const [segmentWidth, setSegmentWidth] = useState(0);

  const segment = `${text}${GAP}`;
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

  return (
    <View style={styles.root}>
      {/* Pomiar poza szerokością karty — inaczej tekst łamie się na 2 linie */}
      <View style={styles.measureShell} pointerEvents="none">
        <View
          style={styles.measureSegment}
          onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
        >
          <Text style={styles.text} numberOfLines={1}>
            {segment}
          </Text>
        </View>
      </View>

      <View style={styles.lane} onLayout={(e) => setLaneWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: scrollX }] }]}
          collapsable={false}
        >
          <View style={styles.segment}>
            <Text style={styles.text} numberOfLines={1}>
              {segment}
            </Text>
          </View>
          <View style={styles.segment}>
            <Text style={styles.text} numberOfLines={1}>
              {segment}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  measureShell: {
    position: 'absolute',
    top: -200,
    left: 0,
    opacity: 0,
    height: 0,
    overflow: 'visible',
  },
  measureSegment: {
    flexDirection: 'row',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  lane: {
    height: 32,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  segment: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
});
