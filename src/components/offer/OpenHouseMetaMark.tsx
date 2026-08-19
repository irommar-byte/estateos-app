import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DoorOpen } from 'lucide-react-native';
import { useI18n } from '../../i18n';

type Props = {
  isDark: boolean;
  dateLabel: string;
  onPress?: () => void;
};

/**
 * Quiet bronze mark next to the legal shield — scheduled open house,
 * visible immediately, not a loud CTA (the banner below still books).
 */
export default function OpenHouseMetaMark({ isDark, dateLabel, onPress }: Props) {
  const { t } = useI18n();
  const bronze = isDark ? '#E8C9A8' : '#8A5A2B';
  const bronzeSoft = isDark ? 'rgba(232,201,168,0.14)' : 'rgba(138,90,43,0.08)';
  const bronzeLine = isDark ? 'rgba(232,201,168,0.38)' : 'rgba(138,90,43,0.28)';

  const inner = (
    <View
      style={[styles.wrap, { backgroundColor: bronzeSoft, borderColor: bronzeLine }]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={t('offer.detail.openHouseMark.a11y', { date: dateLabel })}
    >
      <View style={[styles.glyph, { borderColor: bronzeLine }]}>
        <DoorOpen size={13} color={bronze} strokeWidth={2.1} />
      </View>
      <Text style={[styles.title, { color: bronze }]} numberOfLines={1}>
        {t('offer.detail.openHouseMark.label')}
      </Text>
      <Text style={[styles.date, { color: isDark ? 'rgba(232,201,168,0.78)' : '#6B4A2A' }]} numberOfLines={1}>
        {dateLabel}
      </Text>
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.82 }]}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    maxWidth: 92,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  glyph: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 9,
  },
  date: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: -0.1,
    textAlign: 'center',
    lineHeight: 10,
  },
});
