import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';
import BonusCouponsSection from './BonusCouponsSection';
import PlusPackageShopPanel from './PlusPackageShopPanel';
import InvestorProShopPanel from './InvestorProShopPanel';
import ProfileCardShell from './ProfileCardShell';
import ProfileInvestorProVipBadge from './ProfileInvestorProVipBadge';
import ProfileGoldCrown from './ProfileGoldCrown';
import {
  profileMembershipHubFaceStyle,
  profileMembershipHubShellStyle,
  profileShopLeatherPressedBg,
} from './profileCardElevation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function configureHubLayoutAnimation(expanding: boolean) {
  LayoutAnimation.configureNext({
    duration: expanding ? 320 : 260,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

type StatChipProps = {
  isDark: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  glow?: boolean;
};

function StatChip({ isDark, icon, iconColor, value, label, glow }: StatChipProps) {
  const chipBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.82)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';

  return (
    <View
      style={[
        styles.statChip,
        { backgroundColor: chipBg, borderColor: chipBorder },
        glow && styles.statChipGlow,
      ]}
    >
      <View style={styles.statChipTop}>
        <View style={[styles.statChipIcon, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={icon} size={13} color={iconColor} />
        </View>
        <Text
          style={[styles.statChipValue, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {value}
        </Text>
      </View>
      <Text
        style={[styles.statChipLabel, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

type Props = {
  isDark: boolean;
  hubTitle: string;
  hubSubtitle: string;
  proActiveShort: string;
  proInactiveShort: string;
  creditsShort: string;
  couponsShort: string;
  proShort: string;
  publicationCredits: number;
  couponCount: number;
  hasInvestorProActive: boolean;
  defaultExpanded?: boolean;
  expandRequestId?: number;
  bonusCoupons: {
    cards: ProfilePromoCardRecord[];
    title: string;
    subtitle: string;
    swipeHint: string;
    dismissHint: string;
    emptyHint: string;
    onRequestDismiss?: (card: ProfilePromoCardRecord) => void;
  };
  plus: {
    title: string;
    plusSlots: number;
    hasPlusAvailable: boolean;
    counterLabel: string;
    expiryLabel: string | null;
    daysLabel: string;
    buyLabel: string;
    buySubtitle: string;
    footer: React.ReactNode;
    buying: boolean;
    onBuy: () => void;
  };
  investorPro: {
    title: string;
    statusLabel: string;
    metaLabel: string;
    expiryLabel: string | null;
    trialBadge: string | null;
    priceLine: string | null;
    buyLabel: string;
    buySubtitle: string;
    footer: React.ReactNode;
    buying: boolean;
    isActive: boolean;
    onBuy: () => void;
  };
  restore: {
    label: string;
    subtitle: string;
    restoring: boolean;
    onRestore: () => void;
  };
};

export default function ProfileMembershipHub({
  isDark,
  hubTitle,
  hubSubtitle,
  proActiveShort,
  proInactiveShort,
  creditsShort,
  couponsShort,
  proShort,
  publicationCredits,
  couponCount,
  hasInvestorProActive,
  defaultExpanded = false,
  expandRequestId = 0,
  bonusCoupons,
  plus,
  investorPro,
  restore,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const pressedBg = profileShopLeatherPressedBg(isDark);
  const divider = isDark ? 'rgba(210,180,140,0.16)' : 'rgba(139,115,85,0.12)';
  const proAccent = hasInvestorProActive ? (isDark ? '#FBBF24' : '#B45309') : isDark ? '#64748B' : '#78716C';

  useEffect(() => {
    if (!expandRequestId) return;
    configureHubLayoutAnimation(true);
    setExpanded(true);
  }, [expandRequestId]);

  const toggleExpanded = () => {
    configureHubLayoutAnimation(!expanded);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((v) => !v);
  };

  return (
    <ProfileCardShell
      isDark={isDark}
      style={profileMembershipHubShellStyle(isDark, hasInvestorProActive)}
      faceStyle={profileMembershipHubFaceStyle(isDark, hasInvestorProActive)}
    >
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [styles.hubHeader, pressed && { backgroundColor: pressedBg }]}
      >
        <View
          style={[
            styles.hubCrownWell,
            {
              backgroundColor: hasInvestorProActive
                ? isDark
                  ? 'rgba(245,158,11,0.22)'
                  : 'rgba(254,243,199,0.95)'
                : isDark
                  ? 'rgba(28,24,18,0.55)'
                  : 'rgba(255,251,235,0.98)',
              borderColor: hasInvestorProActive
                ? isDark
                  ? 'rgba(251,191,36,0.62)'
                  : 'rgba(180,83,9,0.38)'
                : isDark
                  ? 'rgba(212,160,23,0.28)'
                  : 'rgba(180,83,9,0.2)',
            },
            hasInvestorProActive && styles.hubCrownWellActive,
          ]}
        >
          {hasInvestorProActive ? (
            <ProfileInvestorProVipBadge size={38} />
          ) : (
            <ProfileGoldCrown size={34} />
          )}
        </View>

        <View style={styles.hubHeaderCopy}>
          <Text style={[styles.hubTitle, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]} numberOfLines={1}>
            {hubTitle}
          </Text>

          {!expanded ? (
            <View style={styles.statRow}>
              <StatChip
                isDark={isDark}
                icon={hasInvestorProActive ? 'diamond' : 'ribbon'}
                iconColor={proAccent}
                value={hasInvestorProActive ? proActiveShort : proInactiveShort}
                label={proShort}
                glow={hasInvestorProActive}
              />
              <StatChip
                isDark={isDark}
                icon="flash"
                iconColor="#0A84FF"
                value={String(publicationCredits)}
                label={creditsShort}
              />
              <StatChip
                isDark={isDark}
                icon="ticket"
                iconColor="#FF9F0A"
                value={String(couponCount)}
                label={couponsShort}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.hubChevronWrap}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={isDark ? '#8E8E93' : '#C7C7CC'}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.hubBody}>
          <View style={[styles.sectionDivider, { backgroundColor: divider }]} />

          <BonusCouponsSection
            embedded
            compact
            cards={bonusCoupons.cards}
            isDark={isDark}
            title={bonusCoupons.title}
            subtitle={bonusCoupons.subtitle}
            swipeHint={bonusCoupons.swipeHint}
            dismissHint={bonusCoupons.dismissHint}
            emptyHint={bonusCoupons.emptyHint}
            onRequestDismiss={bonusCoupons.onRequestDismiss}
          />

          <View style={[styles.sectionDivider, { backgroundColor: divider }]} />

          <PlusPackageShopPanel
            embedded
            compactEmbedded
            leatherSurface
            collapsible
            defaultExpanded={!plus.hasPlusAvailable}
            isDark={isDark}
            showRestore={false}
            title={plus.title}
            plusSlots={plus.plusSlots}
            hasPlusAvailable={plus.hasPlusAvailable}
            counterLabel={plus.counterLabel}
            expiryLabel={plus.expiryLabel}
            daysLabel={plus.daysLabel}
            buyLabel={plus.buyLabel}
            buySubtitle={plus.buySubtitle}
            restoreLabel={restore.label}
            restoreSubtitle={restore.subtitle}
            restoring={restore.restoring}
            buying={plus.buying}
            footer={plus.footer}
            onBuy={plus.onBuy}
            onRestore={restore.onRestore}
          />

          <View style={[styles.sectionDivider, { backgroundColor: divider }]} />

          <InvestorProShopPanel
            embedded
            compactEmbedded
            leatherSurface
            collapsible
            defaultExpanded={!investorPro.isActive}
            isDark={isDark}
            showRestore={false}
            title={investorPro.title}
            statusLabel={investorPro.statusLabel}
            metaLabel={investorPro.metaLabel}
            expiryLabel={investorPro.expiryLabel}
            trialBadge={investorPro.trialBadge}
            priceLine={investorPro.priceLine}
            buyLabel={investorPro.buyLabel}
            buySubtitle={investorPro.buySubtitle}
            restoreLabel={restore.label}
            restoreSubtitle={restore.subtitle}
            restoring={restore.restoring}
            buying={investorPro.buying}
            isActive={investorPro.isActive}
            footer={investorPro.footer}
            onBuy={investorPro.onBuy}
            onRestore={restore.onRestore}
          />

          <View style={[styles.sectionDivider, { backgroundColor: divider }]} />

          <Pressable
            onPress={restore.onRestore}
            disabled={restore.restoring}
            style={({ pressed }) => [
              styles.restoreRow,
              pressed && { backgroundColor: pressedBg },
              restore.restoring && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.restoreIcon, { backgroundColor: '#0A84FF' }]}>
              {restore.restoring ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="refresh-circle" size={22} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.restoreBody}>
              <Text style={[styles.restoreTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{restore.label}</Text>
              <Text style={styles.restoreSubtitle}>{restore.subtitle}</Text>
            </View>
            {!restore.restoring && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          </Pressable>
        </View>
      ) : null}
    </ProfileCardShell>
  );
}

const styles = StyleSheet.create({
  hubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  hubCrownWell: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 3,
  },
  hubCrownWellActive: {
    shadowColor: '#D97706',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  hubHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  hubTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  hubSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    marginTop: 8,
  },
  statChip: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statChipGlow: {
    shadowColor: '#F59E0B',
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  statChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statChipValue: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  hubChevronWrap: {
    paddingTop: 0,
  },
  hubBody: {
    paddingBottom: 2,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  restoreIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBody: { flex: 1, paddingRight: 4 },
  restoreTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  restoreSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
    lineHeight: 14,
  },
});
