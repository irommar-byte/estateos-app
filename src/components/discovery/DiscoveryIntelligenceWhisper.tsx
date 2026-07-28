import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { navigateDiscoveryHref } from '../../lib/discovery/navigateDiscoveryHref';

type Variant = 'nav' | 'inline' | 'map' | 'drawer';

type Props = {
  navigation?: any;
  title?: string;
  body: string;
  href?: string;
  variant?: Variant;
  style?: object;
  isDark?: boolean;
};

/**
 * EstateOS™ Intelligence — quiet frosted whisper. One thought, no badge circus.
 */
export default function DiscoveryIntelligenceWhisper({
  navigation,
  title = 'EstateOS™ Intelligence',
  body,
  href = '/moj-kierunek',
  variant = 'inline',
  style,
  isDark: isDarkProp,
}: Props) {
  const schemeDark = useColorScheme() === 'dark';
  const isDark = isDarkProp ?? schemeDark;
  const line = String(body || '').trim();
  if (!line) return null;

  const go = () => navigateDiscoveryHref(navigation, href);

  if (variant === 'nav') {
    return (
      <Pressable onPress={go} style={[styles.nav, style]} accessibilityLabel={line}>
        <View style={styles.navDotOuter}>
          <View style={[styles.navDot, isDark && styles.navDotDark]} />
        </View>
        <Text style={[styles.navText, !isDark && styles.navTextLight]} numberOfLines={1}>
          {line}
        </Text>
      </Pressable>
    );
  }

  const shell =
    variant === 'map'
      ? styles.mapShell
      : variant === 'drawer'
        ? styles.drawerShell
        : isDark
          ? styles.inlineShellDark
          : styles.inlineShellLight;

  return (
    <View style={[shell, style]}>
      <View style={styles.eyebrowRow}>
        <Sparkles size={11} color={isDark ? 'rgba(245,245,247,0.55)' : 'rgba(2,132,199,0.85)'} />
        <Text style={[styles.eyebrow, !isDark && styles.eyebrowLight]}>{title}</Text>
      </View>
      <Text style={[styles.body, !isDark && styles.bodyLight]}>{line}</Text>
      {href ? (
        <Pressable onPress={go} hitSlop={8}>
          <Text style={[styles.link, !isDark && styles.linkLight]}>Mój kierunek →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navDotOuter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(2,132,199,0.85)',
  },
  navDotDark: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  navText: {
    flex: 1,
    color: 'rgba(245,245,247,0.55)',
    fontSize: 10,
    fontWeight: '600',
  },
  navTextLight: {
    color: 'rgba(17,24,39,0.55)',
  },
  inlineShellDark: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(22,24,28,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 7,
  },
  inlineShellLight: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  mapShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,18,22,0.78)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  drawerShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(20,20,24,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: 'rgba(245,245,247,0.5)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  eyebrowLight: {
    color: 'rgba(2,132,199,0.85)',
  },
  body: {
    marginTop: 6,
    color: 'rgba(245,245,247,0.78)',
    fontSize: 13,
    lineHeight: 19,
  },
  bodyLight: {
    color: 'rgba(29,42,36,0.88)',
  },
  link: {
    marginTop: 10,
    color: 'rgba(245,245,247,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkLight: {
    color: 'rgba(2,132,199,0.9)',
  },
});
