import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Jednolinijkowy tekst, który mieści się — stoi. Gdy się nie mieści: po chwili rusza,
 * rozpędza się, przy końcu hamuje sprężyną (lekki odskok), czeka i spokojnie wraca.
 */
export default function SpringMarqueeText({ text, style, containerStyle }: Props) {
  const reduceMotion = useReducedMotion();
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useSharedValue(0);
  const overflow = boxW > 0 && textW > boxW + 1 ? Math.ceil(textW - boxW) : 0;

  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (!overflow || reduceMotion) return;
    const run = Math.min(2400, Math.max(650, overflow * 15));
    const handoff = -overflow * 0.88;
    // Prędkość na końcu rozpędzania (ease-in quad) przekazana sprężynie, żeby hamowanie było płynne.
    const velocity = ((2 * handoff) / run) * 1000;
    x.value = withRepeat(
      withSequence(
        withDelay(1400, withTiming(handoff, { duration: run, easing: Easing.in(Easing.quad) })),
        withSpring(-overflow, { velocity, damping: 10, stiffness: 150, mass: 0.7 }),
        withDelay(1700, withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [overflow, reduceMotion, text, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (reduceMotion) {
    return (
      <Text style={[style, containerStyle as StyleProp<TextStyle>]} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  return (
    <View style={[styles.clip, containerStyle]} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} accessible accessibilityLabel={text}>
      <Animated.View style={[styles.track, slide]}>
        <Text style={style} numberOfLines={1} onLayout={(e) => setTextW(e.nativeEvent.layout.width)}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', alignSelf: 'stretch' },
  // Szeroki tor, żeby tekst miał naturalną szerokość (pomiar), a klip ucina widok.
  track: { flexDirection: 'row', width: 4000 },
});
