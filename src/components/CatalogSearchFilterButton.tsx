import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from './ApplePressable';

type Props = {
  isDark: boolean;
  accent: string;
  label: string;
  hint?: string;
  active?: boolean;
  lightChrome?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * Kompaktowy CTA wyszukiwania — wygląda jak pole „Szukaj”,
 * żeby od razu było wiadomo, że tu ustawia się kupno/wynajem i parametry.
 */
export default function CatalogSearchFilterButton({
  isDark,
  accent,
  label,
  hint,
  active = false,
  lightChrome = false,
  onPress,
  accessibilityLabel,
}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(11000),
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const a11y = accessibilityLabel || (hint ? `${label}. ${hint}` : label);

  return (
    <Animated.View style={[styles.wrap, lightChrome && styles.wrapLight, { transform: [{ scale: pulse }] }]}>
    <ApplePressable
      onPress={onPress}
      haptic="medium"
      pressScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={StyleSheet.absoluteFill}
    >
      <BlurView
        intensity={lightChrome ? 96 : isDark ? 82 : 92}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.glass,
          lightChrome && styles.glassLight,
          active && { borderColor: `${accent}AA`, backgroundColor: `${accent}1F` },
        ]}
      >
        <View style={[styles.iconBubble, { backgroundColor: `${accent}30` }]}>
          <Ionicons name="search" size={16} color={accent} />
        </View>
        <View style={styles.copy}>
          <Text
            style={[styles.label, { color: isDark ? '#FFF' : '#0F172A' }]}
            numberOfLines={1}
            allowFontScaling={false}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {label}
          </Text>
          {hint ? (
            <Text
              style={[styles.hint, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}
              numberOfLines={1}
              allowFontScaling={false}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {hint}
            </Text>
          ) : null}
        </View>
        {active ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
      </BlurView>
    </ApplePressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 112,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  wrapLight: {
    borderColor: 'rgba(15,23,42,0.1)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
  },
  glass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
    borderRadius: 25,
  },
  glassLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  hint: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 1,
    flexShrink: 0,
  },
});
