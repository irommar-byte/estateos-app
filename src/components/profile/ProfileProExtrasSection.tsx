import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import {
  Gavel,
  DoorOpen,
  Sparkles,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../../i18n';
import InvestorProShimmerBadge from './InvestorProShimmerBadge';
import ProMembershipCountdownBar from './ProMembershipCountdownBar';
import { hasActiveInvestorProMembership } from '../../utils/investorProMembership';

type FeatureId = 'auction' | 'openHouse' | 'insider';

type Props = {
  user: Record<string, unknown> | null | undefined;
  isDark?: boolean;
  onFeaturePress?: (id: FeatureId) => void;
};

function FeatureRow({
  icon: Icon,
  title,
  subtitle,
  tag,
  isDark,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tag: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.featureRow,
        isDark ? styles.featureRowDark : styles.featureRowLight,
        pressed && { opacity: 0.88 },
      ]}
    >
      <View style={[styles.featureIcon, isDark ? styles.featureIconDark : styles.featureIconLight]}>
        <Icon size={20} color={isDark ? '#E8EDF5' : '#4B5563'} strokeWidth={2} />
      </View>
      <View style={styles.featureCopy}>
        <View style={styles.featureTitleRow}>
          <Text style={[styles.featureTitle, isDark && styles.featureTitleDark]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.featureTag, isDark ? styles.featureTagDark : styles.featureTagLight]}>
            <Text style={[styles.featureTagText, isDark && styles.featureTagTextDark]}>{tag}</Text>
          </View>
        </View>
        <Text style={[styles.featureSubtitle, isDark && styles.featureSubtitleDark]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={16} color={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)'} />
    </Pressable>
  );
}

export default function ProfileProExtrasSection({ user, isDark = true, onFeaturePress }: Props) {
  const { t } = useI18n();

  if (!hasActiveInvestorProMembership(user)) return null;

  const onFeature = (id: FeatureId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onFeaturePress) {
      onFeaturePress(id);
      return;
    }
    if (id === 'insider') {
      void Linking.openURL('https://estateos.pl/centrala').catch(() => {
        Alert.alert(t('common.error'), t(`profile.proExtras.features.${id}.alertBody`));
      });
      return;
    }
    Alert.alert(
      t(`profile.proExtras.features.${id}.alertTitle`),
      t(`profile.proExtras.features.${id}.alertBody`)
    );
  };

  const features: Array<{
    id: FeatureId;
    icon: LucideIcon;
    title: string;
    subtitle: string;
    tag: string;
  }> = [
    {
      id: 'auction',
      icon: Gavel,
      title: t('profile.proExtras.features.auction.title'),
      subtitle: t('profile.proExtras.features.auction.subtitle'),
      tag: t('profile.proExtras.features.auction.tag'),
    },
    {
      id: 'openHouse',
      icon: DoorOpen,
      title: t('profile.proExtras.features.openHouse.title'),
      subtitle: t('profile.proExtras.features.openHouse.subtitle'),
      tag: t('profile.proExtras.features.openHouse.tag'),
    },
    {
      id: 'insider',
      icon: Sparkles,
      title: t('profile.proExtras.features.insider.title'),
      subtitle: t('profile.proExtras.features.insider.subtitle'),
      tag: t('profile.proExtras.features.insider.tag'),
    },
  ];

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.sectionEyebrow, isDark && styles.sectionEyebrowDark]}>
            {t('profile.proExtras.eyebrow')}
          </Text>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t('profile.proExtras.title')}
          </Text>
          <Text style={[styles.sectionLead, isDark && styles.sectionLeadDark]}>
            {t('profile.proExtras.lead')}
          </Text>
        </View>
        <InvestorProShimmerBadge compact />
      </View>

      <ProMembershipCountdownBar proExpiresAt={user?.proExpiresAt} isDark={isDark} />

      <View style={styles.featureList}>
        {features.map((f, idx) => (
          <FeatureRow
            key={f.id}
            icon={f.icon}
            title={f.title}
            subtitle={f.subtitle}
            tag={f.tag}
            isDark={isDark}
            onPress={() => onFeature(f.id)}
          />
        ))}
      </View>

      <Text style={[styles.footer, isDark && styles.footerDark]}>{t('profile.proExtras.footer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 4,
  },
  sectionEyebrowDark: {
    color: 'rgba(255,255,255,0.42)',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#111827',
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  sectionLead: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.52)',
  },
  sectionLeadDark: {
    color: 'rgba(255,255,255,0.55)',
  },
  featureList: {
    marginTop: 16,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  featureRowDark: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureRowLight: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  featureIconLight: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  featureCopy: {
    flex: 1,
    minWidth: 0,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  featureTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  featureTitleDark: {
    color: '#F3F4F6',
  },
  featureTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featureTagDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  featureTagLight: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  featureTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.45)',
  },
  featureTagTextDark: {
    color: 'rgba(255,255,255,0.45)',
  },
  featureSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(0,0,0,0.5)',
  },
  featureSubtitleDark: {
    color: 'rgba(255,255,255,0.48)',
  },
  footer: {
    marginTop: 14,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.38)',
    textAlign: 'center',
  },
  footerDark: {
    color: 'rgba(255,255,255,0.35)',
  },
});
