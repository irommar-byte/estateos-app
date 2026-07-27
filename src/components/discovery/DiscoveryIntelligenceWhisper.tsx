import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
}: Props) {
  const line = String(body || '').trim();
  if (!line) return null;

  const go = () => navigateDiscoveryHref(navigation, href);

  if (variant === 'nav') {
    return (
      <Pressable onPress={go} style={[styles.nav, style]} accessibilityLabel={line}>
        <View style={styles.navDotOuter}>
          <View style={styles.navDot} />
        </View>
        <Text style={styles.navText} numberOfLines={1}>
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
        : styles.inlineShell;

  return (
    <View style={[shell, style]}>
      <View style={styles.eyebrowRow}>
        <Sparkles size={11} color="rgba(245,245,247,0.55)" />
        <Text style={styles.eyebrow}>{title}</Text>
      </View>
      <Text style={styles.body}>{line}</Text>
      {href ? (
        <Pressable onPress={go} hitSlop={8}>
          <Text style={styles.link}>Mój kierunek →</Text>
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
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  navText: {
    flex: 1,
    color: 'rgba(245,245,247,0.55)',
    fontSize: 10,
    fontWeight: '600',
  },
  inlineShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mapShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,18,22,0.78)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  drawerShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(20,20,24,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  body: {
    marginTop: 6,
    color: 'rgba(245,245,247,0.78)',
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    marginTop: 10,
    color: 'rgba(245,245,247,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
