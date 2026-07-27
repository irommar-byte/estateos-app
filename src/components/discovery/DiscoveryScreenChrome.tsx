import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import ApplePressable from '../ApplePressable';
import type { DiscoveryTheme } from './discoveryTheme';

type Props = {
  theme: DiscoveryTheme;
  title?: string;
  onBack: () => void;
  right?: React.ReactNode;
};

/** Sticky top chrome — always offers a way out of Discovery sheets. */
export default function DiscoveryScreenChrome({ theme, title, onBack, right }: Props) {
  return (
    <View style={styles.row}>
      <ApplePressable
        onPress={onBack}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Wróć"
        style={[
          styles.backBtn,
          {
            backgroundColor: theme.navBtnBg,
            borderColor: theme.navBtnBorder,
          },
        ]}
      >
        <ChevronLeft size={22} color={theme.navBtnIcon} strokeWidth={2.4} />
        <Text style={[styles.backText, { color: theme.navBtnIcon }]}>Wróć</Text>
      </ApplePressable>
      {title ? (
        <Text style={[styles.title, { color: theme.textMuted }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      {right ? <View style={styles.right}>{right}</View> : <View style={styles.rightSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
    paddingRight: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  flex: { flex: 1 },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  right: { minWidth: 72, alignItems: 'flex-end' },
  rightSpacer: { width: 72 },
});
