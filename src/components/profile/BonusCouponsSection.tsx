import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';
import PromoCardStack from './PromoCardStack';

type Props = {
  cards: ProfilePromoCardRecord[];
  isDark: boolean;
  title: string;
  subtitle: string;
  swipeHint?: string;
  dismissHint?: string;
  emptyHint?: string;
  embedded?: boolean;
  onRequestDismiss?: (card: ProfilePromoCardRecord) => void;
};

export default function BonusCouponsSection({
  cards,
  isDark,
  title,
  subtitle,
  swipeHint,
  dismissHint,
  emptyHint,
  embedded = false,
  onRequestDismiss,
}: Props) {
  const wellBg = isDark ? 'rgba(28,28,30,0.95)' : '#FFFFFF';
  const wellBorder = isDark ? 'rgba(255,159,10,0.22)' : 'rgba(255,159,10,0.28)';
  const accent = '#FF9F0A';

  const content = (
    <>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
          <Ionicons name="ticket" size={20} color={accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93' }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.well,
          embedded && styles.wellEmbedded,
          { backgroundColor: wellBg, borderColor: wellBorder },
        ]}
      >
        {cards.length > 0 ? (
          <PromoCardStack
            cards={cards}
            isDark={isDark}
            swipeHint={swipeHint}
            dismissHint={dismissHint}
            onRequestDismiss={onRequestDismiss}
          />
        ) : (
          <Text style={[styles.empty, { color: isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93' }]}>
            {emptyHint}
          </Text>
        )}
      </View>
    </>
  );

  if (embedded) {
    return (
      <View style={[styles.section, styles.sectionEmbedded]}>
        {content}
      </View>
    );
  }

  return <View style={styles.section}>{content}</View>;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 14,
  },
  sectionEmbedded: {
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '500',
  },
  well: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'visible',
    shadowColor: '#FF9F0A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  wellEmbedded: {
    shadowOpacity: 0,
    elevation: 0,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 24,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
});
