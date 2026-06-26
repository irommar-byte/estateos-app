import React, { useState } from 'react';
import { Alert, Animated, Easing, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import {
  Gavel,
  DoorOpen,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../../i18n';
import ProMembershipCountdownBar from './ProMembershipCountdownBar';
import TitaniumHomeKeyBackdrop from './TitaniumHomeKeyBackdrop';
import { profilePremiumCardShellStyle } from './profileCardElevation';
import InsetMetalRecess, { InsetMetalIconWell } from './InsetMetalRecess';
import { hasActiveInvestorProMembership } from '../../utils/investorProMembership';

type FeatureId = 'auction' | 'openHouse' | 'insider';

function configureToolsLayoutAnimation(expanding: boolean) {
  const duration = expanding ? 360 : 280;
  LayoutAnimation.configureNext({
    duration,
    create: {
      type: LayoutAnimation.Types.easeIn,
      property: LayoutAnimation.Properties.opacity,
      duration: Math.round(duration * 0.85),
    },
    update: { type: LayoutAnimation.Types.keyboard },
    delete: {
      type: LayoutAnimation.Types.easeOut,
      property: LayoutAnimation.Properties.opacity,
      duration: Math.round(duration * 0.7),
    },
  });
}

type Props = {
  user: Record<string, unknown> | null | undefined;
  isDark?: boolean;
  onFeaturePress?: (id: FeatureId) => void;
};

function featureIconColor(isDark: boolean) {
  return isDark ? '#E8EDF5' : '#4B5563';
}

function ImportStarsIcon({ isDark }: { isDark: boolean }) {
  const spin = React.useRef(new Animated.Value(0)).current;
  const orbit = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const orbitLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbit, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orbit, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    spinLoop.start();
    orbitLoop.start();
    return () => {
      spinLoop.stop();
      orbitLoop.stop();
    };
  }, [orbit, spin]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitX = orbit.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const orbitY = orbit.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });
  const starColor = isDark ? '#F2F5FA' : '#3A4452';
  const starGlow = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(55,65,80,0.2)';

  return (
    <View style={styles.importStarsWrap}>
      <Animated.View style={[styles.importStarGlow, { transform: [{ rotate: rotation }] }]}>
        <Sparkles size={24} color={starGlow} strokeWidth={2.2} />
      </Animated.View>
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <Sparkles size={20} color={starColor} strokeWidth={2.9} />
      </Animated.View>
      <Animated.View style={[styles.importStarOrbitLeft, { transform: [{ translateX: orbitX }, { translateY: orbitY }] }]}>
        <Sparkles size={14} color={starColor} strokeWidth={2.8} />
      </Animated.View>
      <Animated.View style={[styles.importStarOrbitRight, { transform: [{ translateX: Animated.multiply(orbitX, -1) }, { translateY: Animated.multiply(orbitY, -1) }] }]}>
        <Sparkles size={12} color={starColor} strokeWidth={2.8} />
      </Animated.View>
    </View>
  );
}

function AuctionGavelIcon({ isDark }: { isDark: boolean }) {
  const strike = React.useRef(new Animated.Value(0)).current;
  const color = featureIconColor(isDark);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(850),
        Animated.timing(strike, {
          toValue: 1,
          duration: 95,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(strike, {
          toValue: 0.12,
          duration: 75,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(strike, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(650),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [strike]);

  const rotate = strike.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: ['-32deg', '6deg', '34deg'],
  });
  const translateY = strike.interpolate({
    inputRange: [0, 1],
    outputRange: [-1, 2],
  });
  const translateX = strike.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={[styles.gavelWrap, { transform: [{ translateX }, { translateY }, { rotate }] }]}>
      <Gavel size={20} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

function OpenHouseDoorIcon({ isDark }: { isDark: boolean }) {
  const open = React.useRef(new Animated.Value(0)).current;
  const color = featureIconColor(isDark);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(open, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(1100),
        Animated.timing(open, {
          toValue: 0,
          duration: 540,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [open]);

  const scaleX = open.interpolate({ inputRange: [0, 1], outputRange: [0.52, 1] });
  const rotate = open.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] });
  const translateX = open.interpolate({ inputRange: [0, 1], outputRange: [-7, 0] });
  const gapOpacity = open.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.15, 0.45, 0.65] });

  return (
    <View style={styles.doorWrap}>
      <Animated.View style={[styles.doorGap, { opacity: gapOpacity, backgroundColor: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(55,65,80,0.32)' }]} />
      <Animated.View style={{ transform: [{ translateX }, { scaleX }, { rotate }] }}>
        <DoorOpen size={20} color={color} strokeWidth={2.1} />
      </Animated.View>
    </View>
  );
}

function FeatureRowIcon({ featureId, isDark }: { featureId: FeatureId; isDark: boolean }) {
  if (featureId === 'insider') return <ImportStarsIcon isDark={isDark} />;
  if (featureId === 'auction') return <AuctionGavelIcon isDark={isDark} />;
  if (featureId === 'openHouse') return <OpenHouseDoorIcon isDark={isDark} />;
  return null;
}

function FeatureRow({
  featureId,
  title,
  subtitle,
  tag,
  isDark,
  onPress,
}: {
  featureId: FeatureId;
  title: string;
  subtitle: string;
  tag: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <InsetMetalRecess isDark={isDark} onPress={onPress} contentStyle={styles.featureRowContent}>
      <InsetMetalIconWell isDark={isDark}>
        <FeatureRowIcon featureId={featureId} isDark={isDark} />
      </InsetMetalIconWell>
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
    </InsetMetalRecess>
  );
}

export default function ProfileProExtrasSection({ user, isDark = true, onFeaturePress }: Props) {
  const { t } = useI18n();
  const isPro = hasActiveInvestorProMembership(user);
  const [toolsExpanded, setToolsExpanded] = useState(true);

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
    title: string;
    subtitle: string;
    tag: string;
  }> = [
    {
      id: 'insider',
      title: t('profile.proExtras.features.insider.title'),
      subtitle: t('profile.proExtras.features.insider.subtitle'),
      tag: t('profile.proExtras.features.insider.tag'),
    },
    {
      id: 'auction',
      title: t('profile.proExtras.features.auction.title'),
      subtitle: t('profile.proExtras.features.auction.subtitle'),
      tag: t('profile.proExtras.features.auction.tag'),
    },
    {
      id: 'openHouse',
      title: t('profile.proExtras.features.openHouse.title'),
      subtitle: t('profile.proExtras.features.openHouse.subtitle'),
      tag: t('profile.proExtras.features.openHouse.tag'),
    },
  ];

  const visibleFeatures = isPro ? features : features.filter((feature) => feature.id === 'openHouse');
  if (visibleFeatures.length === 0) return null;

  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(90, 100, 120, 0.18)';

  return (
    <View style={profilePremiumCardShellStyle(isDark, 20)}>
    <View style={[styles.card, { borderColor: cardBorder }]}>
      <TitaniumHomeKeyBackdrop isDark={isDark} />

      <View style={styles.cardContent}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          configureToolsLayoutAnimation(!toolsExpanded);
          setToolsExpanded((v) => !v);
        }}
        style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: toolsExpanded }}
        accessibilityLabel={
          toolsExpanded ? t('profile.proExtras.collapseTools') : t('profile.proExtras.expandTools')
        }
      >
        <View style={styles.headerCopy}>
          <Text style={[styles.sectionEyebrow, isDark && styles.sectionEyebrowDark]}>
            {t('profile.proExtras.eyebrow')}
          </Text>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t('profile.proExtras.title')}
          </Text>
        </View>
        <Ionicons
          name={toolsExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
        />
      </Pressable>

      {isPro ? <ProMembershipCountdownBar proExpiresAt={user?.proExpiresAt} isDark={isDark} /> : null}

      {toolsExpanded ? (
        <>
        {isPro ? (
          <Text style={[styles.sectionLead, isDark && styles.sectionLeadDark]}>
            {t('profile.proExtras.lead')}
          </Text>
        ) : null}

        <View style={styles.featureList}>
          {visibleFeatures.map((f) => (
            <FeatureRow
              key={f.id}
              featureId={f.id}
              title={f.title}
              subtitle={f.subtitle}
              tag={f.tag}
              isDark={isDark}
              onPress={() => onFeature(f.id)}
            />
          ))}
        </View>

        {isPro ? (
          <Text style={[styles.footer, isDark && styles.footerDark]}>
            {t('profile.proExtras.footer')}
          </Text>
        ) : null}
        </>
      ) : null}
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  cardContent: {
    position: 'relative',
    zIndex: 1,
    padding: 16,
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
    marginTop: 12,
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
    gap: 10,
  },
  featureRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  importStarsWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importStarGlow: {
    position: 'absolute',
  },
  importStarOrbitLeft: {
    position: 'absolute',
    top: -1,
    left: -2,
  },
  importStarOrbitRight: {
    position: 'absolute',
    bottom: -1,
    right: -2,
  },
  gavelWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorWrap: {
    width: 22,
    height: 22,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  doorGap: {
    position: 'absolute',
    left: 1,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 1,
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.32)',
    borderLeftColor: 'rgba(0,0,0,0.24)',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  featureTagLight: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.22)',
    borderLeftColor: 'rgba(0,0,0,0.16)',
    borderBottomColor: 'rgba(255,255,255,0.35)',
    borderRightColor: 'rgba(255,255,255,0.28)',
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
