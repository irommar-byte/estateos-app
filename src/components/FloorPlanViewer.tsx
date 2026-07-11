import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { exportFloorPlanPdfFromMeta, shareFloorPlanPdf } from '../lib/roomScan/exportFloorPlanPdf';
import { useI18n } from '../i18n';
import { getSafeQuickLook } from '../utils/safeQuickLook';
import FloorPlanScanArtboard from './roomScan/FloorPlanScanArtboard';
import type { FloorPlanScanMeta } from '../types/roomScan';

export default function FloorPlanViewer({
  imageUrl,
  model3dUrl,
  scanMeta,
  theme,
}: {
  imageUrl?: string | null;
  model3dUrl?: string | null;
  scanMeta?: FloorPlanScanMeta | null;
  theme?: { glass?: string; dark?: boolean };
}) {
  const { t } = useI18n();
  const { width: screenW } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const animValue = React.useRef(new Animated.Value(0)).current;

  const isDark = theme?.glass === 'dark' || theme?.dark;
  const hasVectorPlan = Boolean(scanMeta?.walls?.length);
  const hasPlan = Boolean(imageUrl?.trim()) || hasVectorPlan;
  const has3d = Boolean(model3dUrl?.trim());
  const roomCount = scanMeta?.roomCount;

  const openModal = () => {
    if (!hasPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
    Animated.spring(animValue, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(animValue, {
      toValue: 0,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  const openWalkthrough = async () => {
    if (!model3dUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const quickLook = getSafeQuickLook();
    if (!quickLook) {
      Alert.alert(t('offer.detail.floorPlan.walkthrough3d'), t('offer.detail.floorPlan.walkthrough3dHint'));
      return;
    }
    try {
      const uri = model3dUrl.startsWith('file://') || model3dUrl.startsWith('http')
        ? model3dUrl
        : `file://${model3dUrl}`;
      await quickLook.previewFile({ uri });
    } catch {
      Alert.alert(t('offer.detail.floorPlan.walkthrough3d'), t('offer.detail.floorPlan.walkthrough3dHint'));
    }
  };

  const sharePdf = async () => {
    if (!scanMeta?.walls?.length) return;
    try {
      setExportingPdf(true);
      const pdfUri = await exportFloorPlanPdfFromMeta(
        scanMeta.walls,
        scanMeta,
        t('offer.detail.floorPlan.sectionTitle'),
      );
      if (pdfUri) await shareFloorPlanPdf(pdfUri);
    } catch {
      Alert.alert(t('offer.detail.floorPlan.exportPdf'), t('offer.detail.floorPlan.exportPdfFailed'));
    } finally {
      setExportingPdf(false);
    }
  };

  const subtitle = useMemo(() => {
    if (roomCount && roomCount > 0) {
      return t('offer.detail.floorPlan.roomsCount', { count: roomCount });
    }
    if (has3d) return t('offer.detail.floorPlan.scannedPlan');
    return null;
  }, [has3d, roomCount, t]);

  const modalArtboardW = Math.min(screenW - 48, 520);
  const modalArtboardH = Math.round(modalArtboardW * 1.1);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: '#8E8E93' }]}>
        {t('offer.detail.floorPlan.sectionTitle')}
      </Text>

      {hasPlan ? (
        <>
          <Pressable
            onPress={openModal}
            style={[
              styles.thumbnailWrapper,
              { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            {hasVectorPlan && scanMeta && !imageUrl ? (
              <FloorPlanScanArtboard
                walls={scanMeta.walls}
                meta={scanMeta}
                width={Math.min(screenW - 40, 360)}
                height={180}
              />
            ) : imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
            ) : null}
            <View style={[styles.thumbnailOverlay, (has3d || hasVectorPlan) && { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              {!has3d && !hasVectorPlan ? (
                <>
                  <View style={styles.iconGlass}>
                    <Ionicons name="expand-outline" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.thumbnailText}>{t('offer.detail.floorPlan.enlarge')}</Text>
                </>
              ) : (
                <View style={styles.lidarBadge}>
                  <Ionicons name="scan-outline" size={14} color="#7dd3fc" />
                  <Text style={styles.lidarBadgeText}>{t('offer.detail.floorPlan.scannedPlan')}</Text>
                </View>
              )}
            </View>
          </Pressable>

          {subtitle ? <Text style={[styles.subtitle, isDark && { color: '#9ca3af' }]}>{subtitle}</Text> : null}

          <View style={styles.actionRow}>
            {has3d && Platform.OS === 'ios' ? (
              <Pressable onPress={openWalkthrough} style={[styles.walkthroughBtn, isDark && styles.walkthroughBtnDark]}>
                <View style={styles.walkthroughIcon}>
                  <Ionicons name="cube-outline" size={18} color="#0ea5e9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.walkthroughTitle, isDark && { color: '#f8fafc' }]}>
                    {t('offer.detail.floorPlan.walkthrough3d')}
                  </Text>
                  <Text style={[styles.walkthroughHint, isDark && { color: '#94a3b8' }]}>
                    {t('offer.detail.floorPlan.walkthrough3dHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </Pressable>
            ) : null}

            {hasVectorPlan && scanMeta ? (
              <Pressable
                onPress={sharePdf}
                disabled={exportingPdf}
                style={[styles.pdfBtn, isDark && styles.pdfBtnDark]}
              >
                {exportingPdf ? (
                  <ActivityIndicator color="#38bdf8" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={18} color="#38bdf8" />
                    <Text style={[styles.pdfBtnText, isDark && { color: '#e2e8f0' }]}>
                      {t('offer.detail.floorPlan.exportPdf')}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark ? 'rgba(28,28,30,0.72)' : '#F5F5F7',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            ]}
          >
            <Ionicons name="map-outline" size={22} color={isDark ? '#9ca3af' : '#86868b'} />
          </View>
          <Text style={[styles.emptyTitle, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]}>
            {t('offer.detail.floorPlan.emptyTitle')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDark ? '#9ca3af' : '#86868b' }]}>
            {t('offer.detail.floorPlan.emptySubtitle')}
          </Text>
        </View>
      )}

      {hasPlan && isOpen && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />

            <Animated.View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                  opacity: animValue,
                  transform: [
                    { scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                    { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.macOsHeader,
                  {
                    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <View style={styles.macOsDots}>
                  <Pressable
                    onPress={closeModal}
                    style={[styles.macDot, { backgroundColor: '#FF5F56' }]}
                    hitSlop={10}
                  />
                  <View style={[styles.macDot, { backgroundColor: '#FFBD2E' }]} />
                  <View style={[styles.macDot, { backgroundColor: '#27C93F' }]} />
                </View>
                <Text style={[styles.macOsTitle, { color: isDark ? '#8E8E93' : '#333' }]}>
                  {has3d || hasVectorPlan ? t('offer.detail.floorPlan.scannedPlan') : 'Plan_Wnetrza.pdf'}
                </Text>
              </View>

              <View style={[styles.imageContainer, { backgroundColor: isDark ? '#000' : '#0b1220' }]}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.fullImage} resizeMode="contain" />
                ) : hasVectorPlan && scanMeta ? (
                  <FloorPlanScanArtboard
                    walls={scanMeta.walls}
                    meta={scanMeta}
                    width={modalArtboardW}
                    height={modalArtboardH}
                  />
                ) : null}
              </View>

              <View style={styles.modalActions}>
                {hasVectorPlan && scanMeta ? (
                  <Pressable onPress={sharePdf} style={styles.modalPdfBtn} disabled={exportingPdf}>
                    {exportingPdf ? (
                      <ActivityIndicator color="#0f172a" />
                    ) : (
                      <>
                        <Ionicons name="document-text-outline" size={16} color="#0f172a" />
                        <Text style={styles.modalWalkthroughText}>{t('offer.detail.floorPlan.exportPdf')}</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
                {has3d && Platform.OS === 'ios' ? (
                  <Pressable onPress={openWalkthrough} style={styles.modalWalkthroughBtn}>
                    <Ionicons name="cube-outline" size={16} color="#0f172a" />
                    <Text style={styles.modalWalkthroughText}>{t('offer.detail.floorPlan.walkthrough3d')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          </BlurView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 4,
  },
  subtitle: {
    marginTop: 8,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  thumbnailWrapper: { height: 180, borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGlass: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  thumbnailText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  lidarBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lidarBadgeText: { color: '#e0f2fe', fontSize: 11, fontWeight: '800' },
  actionRow: { marginTop: 12, gap: 10 },
  walkthroughBtn: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.25)',
    backgroundColor: 'rgba(240,249,255,0.95)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walkthroughBtnDark: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderColor: 'rgba(56,189,248,0.25)',
  },
  walkthroughIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  walkthroughHint: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2, lineHeight: 16 },
  pdfBtn: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    backgroundColor: 'rgba(240,249,255,0.9)',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  pdfBtnDark: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderColor: 'rgba(56,189,248,0.25)',
  },
  pdfBtnText: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  modalContent: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 80,
    marginBottom: 80,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.5,
    shadowRadius: 35,
    elevation: 20,
    borderWidth: 1,
  },
  macOsHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  macOsDots: { flexDirection: 'row', gap: 8, position: 'absolute', left: 16 },
  macDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  macOsTitle: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  imageContainer: { flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%', borderRadius: 12 },
  modalActions: { padding: 12, gap: 8 },
  modalWalkthroughBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 14,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalPdfBtn: {
    backgroundColor: 'rgba(148,163,184,0.25)',
    borderRadius: 14,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalWalkthroughText: { color: '#0f172a', fontWeight: '900', fontSize: 13 },
});
