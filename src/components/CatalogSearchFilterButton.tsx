import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const a11y = accessibilityLabel || (hint ? `${label}. ${hint}` : label);

  return (
    <ApplePressable
      onPress={onPress}
      haptic="medium"
      pressScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={[styles.wrap, lightChrome && styles.wrapLight]}
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
