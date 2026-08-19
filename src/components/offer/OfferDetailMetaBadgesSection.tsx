import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Eye, Star } from 'lucide-react-native';
import LegalVerifiedShieldBadge from '../LegalVerifiedShieldBadge';
import OpenHouseMetaMark from './OpenHouseMetaMark';
import { useI18n } from '../../i18n';

type Props = {
  isDark: boolean;
  viewsCountLabel: string;
  isFeatured: boolean;
  showFeatureCta: boolean;
  featureCtaBusy?: boolean;
  isNewListing: boolean;
  newOfferBadgeAnimatedStyle?: object;
  shieldVerified: boolean;
  showShieldTapHint: boolean;
  onShieldPress?: () => void;
  onFeaturePress?: () => void;
  openHouseDateLabel?: string | null;
  onOpenHousePress?: () => void;
};

/**
 * Wspólna sekcja meta oferty — identyczna dla właściciela i kupującego:
 * lewo: Wyróżnione / Wyróżnij | środek: tarcza | prawo: wyświetlenia + NOWA.
 */
export default function OfferDetailMetaBadgesSection({
  isDark,
  viewsCountLabel,
  isFeatured,
  showFeatureCta,
  featureCtaBusy = false,
  isNewListing,
  newOfferBadgeAnimatedStyle,
  shieldVerified,
  showShieldTapHint,
  onShieldPress,
  onFeaturePress,
  openHouseDateLabel,
  onOpenHousePress,
}: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <View style={[styles.side, styles.sideStart]}>
          {isFeatured ? (
            <View style={styles.featuredBadge}>
              <Star size={9} color="#000000" fill="#000000" strokeWidth={0} />
              <Text style={styles.featuredBadgeText} numberOfLines={1}>
                {t('offer.detail.views.featuredBadge')}
              </Text>
              <Star size={9} color="#000000" fill="#000000" strokeWidth={0} />
            </View>
          ) : showFeatureCta ? (
            <Pressable
              onPress={onFeaturePress}
              disabled={featureCtaBusy}
              style={({ pressed }) => [
                styles.featuredBadge,
                styles.featuredBadgeInactive,
                isDark && {
                  backgroundColor: 'rgba(142,142,147,0.18)',
                  borderColor: 'rgba(235,235,245,0.18)',
                },
                (pressed || featureCtaBusy) && { opacity: 0.72 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('offer.detail.views.featureCta')}
            >
              <Star
                size={9}
                color={isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93'}
                fill="transparent"
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.featuredBadgeText,
                  styles.featuredBadgeTextInactive,
                  isDark && { color: 'rgba(235,235,245,0.45)' },
                ]}
                numberOfLines={1}
              >
                {featureCtaBusy
                  ? t('profile.myOffers.promote.working')
                  : t('offer.detail.views.featureCta')}
              </Text>
              <Star
                size={9}
                color={isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93'}
                fill="transparent"
                strokeWidth={2}
              />
            </Pressable>
          ) : (
            <View style={styles.sidePlaceholder} />
          )}
        </View>

        <View style={[styles.center, openHouseDateLabel ? styles.centerWide : null]} pointerEvents="box-none">
          <View style={styles.centerCluster}>
            <LegalVerifiedShieldBadge
              isDark={isDark}
              verified={shieldVerified}
              showTapHint={showShieldTapHint}
              onPress={onShieldPress}
            />
            {openHouseDateLabel ? (
              <OpenHouseMetaMark
                isDark={isDark}
                dateLabel={openHouseDateLabel}
                onPress={onOpenHousePress}
              />
            ) : null}
          </View>
        </View>

        <View style={[styles.side, styles.sideEnd]}>
          <View
            style={[
              styles.viewsBadge,
              {
                backgroundColor: isDark ? '#1c1c1e' : '#f3f4f6',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)',
              },
            ]}
          >
            <Eye color={isDark ? '#9ca3af' : '#374151'} size={12} />
            <Text style={[styles.viewsBadgeText, { color: isDark ? '#d1d5db' : '#374151' }]} numberOfLines={1}>
              {viewsCountLabel}
            </Text>
          </View>
          {isNewListing ? (
            <Animated.View
              style={[
                styles.newOfferBadge,
                {
                  backgroundColor: isDark ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.14)',
                  borderColor: isDark ? 'rgba(96,165,250,0.65)' : 'rgba(37,99,235,0.45)',
                },
                newOfferBadgeAnimatedStyle,
              ]}
            >
              <Text style={[styles.newOfferBadgeText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]} numberOfLines={1}>
                {t('offer.detail.views.newOfferBadgeShort')}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    gap: 6,
    minHeight: 78,
  },
  side: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  sideStart: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  sideEnd: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 5,
  },
  sidePlaceholder: {
    width: 1,
    height: 28,
  },
  center: {
    flexShrink: 0,
    width: 118,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  centerWide: {
    width: 198,
  },
  centerCluster: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
  },
  viewsBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  viewsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  featuredBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.28)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  featuredBadgeInactive: {
    backgroundColor: 'rgba(142,142,147,0.14)',
    borderColor: 'rgba(60,60,67,0.18)',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  featuredBadgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  featuredBadgeTextInactive: {
    color: '#8E8E93',
  },
  newOfferBadge: {
    flexShrink: 0,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  newOfferBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
});
