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
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';
import BonusCouponsSection from './BonusCouponsSection';
import PlusPackageShopPanel from './PlusPackageShopPanel';
import InvestorProShopPanel from './InvestorProShopPanel';
import ProfileCardShell from './ProfileCardShell';
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
    billedHeadline: string | null;
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

/**
 * Hub sklepu Profilu — bez nagłówka „Pakiety…”, od razu sekcje:
 * kupony → kredyty Plus → Investor Pro → przywróć.
 */
export default function ProfileMembershipHub({
  isDark,
  hasInvestorProActive,
  defaultExpanded = true,
  expandRequestId = 0,
  bonusCoupons,
  plus,
  investorPro,
  restore,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const pressedBg = profileShopLeatherPressedBg(isDark);
  const divider = isDark ? 'rgba(210,180,140,0.16)' : 'rgba(139,115,85,0.12)';
  const anyActive = hasInvestorProActive || plus.hasPlusAvailable;

  useEffect(() => {
    if (!expandRequestId) return;
    configureHubLayoutAnimation(true);
    setExpanded(true);
  }, [expandRequestId]);

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  return (
    <ProfileCardShell
      isDark={isDark}
      style={profileMembershipHubShellStyle(isDark, anyActive)}
      faceStyle={profileMembershipHubFaceStyle(isDark, anyActive)}
    >
      {expanded ? (
        <View style={styles.hubBody}>
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
            collapsible={false}
            defaultExpanded
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
            collapsible={false}
            defaultExpanded
            isDark={isDark}
            showRestore={false}
            title={investorPro.title}
            statusLabel={investorPro.statusLabel}
            metaLabel={investorPro.metaLabel}
            expiryLabel={investorPro.expiryLabel}
            trialBadge={investorPro.trialBadge}
            priceLine={investorPro.priceLine}
            billedHeadline={investorPro.billedHeadline}
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
  hubBody: {
    paddingBottom: 4,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  restoreIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
