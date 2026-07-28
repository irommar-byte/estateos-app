import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { fetchEstateOsGuideContext, type EstateOsGuideContext } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';
import { subscribeGuideOpen } from '../../lib/discovery/clientEvents';
import { useI18n } from '../../i18n';
import { useIsDarkTheme } from '../../store/useThemeStore';

type Props = { navigation: any };

/**
 * EstateOS Guide — panel otwierany z okrągłej ikony gwiazdek w chrome mapy
 * (bez rozciągniętego pilla „Poznaj kierunek”, który blokował mapę).
 */
export default function EstateOsGuideOverlay({ navigation }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const isDark = useIsDarkTheme();
  const profile = useDiscoveryStore((state) => state.profile);
  const firstEntrySeen = useDiscoveryStore((state) => state.firstEntrySeen);
  const token = useAuthStore((state) => state.token);
  const [guide, setGuide] = useState<EstateOsGuideContext | null>(null);
  const compact = width < 420;

  useEffect(() => {
    void fetchEstateOsGuideContext(token).then(setGuide);
  }, [token]);

  useEffect(() => subscribeGuideOpen(() => setOpen(true)), []);

  const lead =
    guide?.nextStep?.title ||
    (profile?.confidence && profile.confidence > 0.35
      ? t('discovery.guide.leadConfident')
      : t('discovery.guide.leadCold'));

  const sheetBg = isDark ? 'rgba(11,12,14,0.92)' : 'rgba(255,255,255,0.96)';
  const textMain = isDark ? DISCOVERY_COLORS.ivory : '#111827';
  const textMuted = isDark ? DISCOVERY_COLORS.textMuted : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.1)';
  const actionBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.04)';

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View
        style={[
          styles.modalRoot,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 48 : 28) + 12 },
        ]}
      >
        <ApplePressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} haptic="none" />
        <BlurView
          intensity={isDark ? 72 : 88}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.panel, compact && styles.panelCompact, { backgroundColor: sheetBg, borderColor: border }]}
        >
          <View style={styles.panelHead}>
            <View style={styles.guideMark}>
              <Ionicons name="sparkles" size={16} color={DISCOVERY_COLORS.gold} />
            </View>
            <View style={styles.headCopy}>
              <Text style={[styles.name, { color: textMain }]}>{t('discovery.guideBrand')}</Text>
              <Text style={[styles.sub, { color: textMuted }]}>{t('discovery.guide.supportSub')}</Text>
            </View>
            <ApplePressable onPress={() => setOpen(false)} haptic="none" style={styles.close}>
              <Ionicons name="close" size={18} color={textMain} />
            </ApplePressable>
          </View>
          <Text style={[styles.lead, compact && styles.leadCompact, { color: textMain }]}>{lead}</Text>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate(firstEntrySeen ? 'EstateDiscovery' : 'DiscoveryEntry');
            }}
            style={[styles.action, { backgroundColor: actionBg, borderColor: border }]}
          >
            <Ionicons name="compass-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={[styles.actionText, { color: textMain }]}>{t('discovery.guide.findSpace')}</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate('DiscoveryTropes');
            }}
            style={[styles.action, { backgroundColor: actionBg, borderColor: border }]}
          >
            <Ionicons name="bookmark-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={[styles.actionText, { color: textMain }]}>{t('discovery.guide.showTropes')}</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate('DiscoveryDirection');
            }}
            style={[styles.action, { backgroundColor: actionBg, borderColor: border }]}
          >
            <Ionicons name="navigate-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={[styles.actionText, { color: textMain }]}>{t('discovery.guide.nextStep')}</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate('DiscoveryLustro');
            }}
            style={[styles.action, { backgroundColor: actionBg, borderColor: border }]}
          >
            <Ionicons name="sparkles-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={[styles.actionText, { color: textMain }]}>{t('discovery.guide.lustro')}</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    padding: 15,
  },
  panelCompact: {
    padding: 12,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center' },
  guideMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  headCopy: { flex: 1, marginLeft: 9 },
  name: { fontSize: 12, fontWeight: '900' },
  sub: { fontSize: 10, marginTop: 1 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  lead: { fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 14, marginBottom: 12 },
  leadCompact: { fontSize: 15, lineHeight: 21 },
  action: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    marginTop: 8,
  },
  actionText: { flex: 1, fontSize: 12, fontWeight: '700' },
});
