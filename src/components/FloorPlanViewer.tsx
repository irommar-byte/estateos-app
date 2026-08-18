import React, { useMemo, useState } from 'react';
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
import { API_URL } from '../config/network';

function absolutePlanAssetUrl(uri?: string | null): string | undefined {
  const value = String(uri || '').trim();
  if (!value) return undefined;
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://')) return value;
  return `${API_URL.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
}

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
  const roomScans = Array.isArray(scanMeta?.roomScans) ? scanMeta.roomScans : [];
  const [planKey, setPlanKey] = useState<'whole' | string>('whole');
  const selectedRoom = planKey === 'whole' ? null : roomScans.find((room) => room.id === planKey) || null;
  const activeMeta = selectedRoom?.scanMeta || scanMeta;
  const displayImageUrl =
    absolutePlanAssetUrl(selectedRoom?.floorPlanPngUri) ||
    absolutePlanAssetUrl(imageUrl) ||
    absolutePlanAssetUrl(roomScans.find((room) => room.floorPlanPngUri)?.floorPlanPngUri);
  const hasVectorPlan = Boolean(activeMeta?.walls?.length);
  const hasPlan = Boolean(displayImageUrl) || hasVectorPlan || roomScans.length > 0;
  const active3dUrl = selectedRoom?.floorPlan3dUri || model3dUrl;
  const has3d = Boolean(absolutePlanAssetUrl(active3dUrl)?.trim());
  const roomCount = scanMeta?.roomCount || roomScans.length;
  const furniture = activeMeta?.objects || [];

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

  const openWalkthrough = async (modelUri?: string | null) => {
    if (!modelUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const quickLook = getSafeQuickLook();
    if (!quickLook) {
      Alert.alert(t('offer.detail.floorPlan.walkthrough3d'), t('offer.detail.floorPlan.walkthrough3dHint'));
      return;
    }
    try {
      const uri = modelUri.startsWith('file://') || modelUri.startsWith('http')
        ? modelUri
        : `file://${modelUri}`;
      await quickLook.previewFile({ uri });
    } catch {
      Alert.alert(t('offer.detail.floorPlan.walkthrough3d'), t('offer.detail.floorPlan.walkthrough3dHint'));
    }
  };

  const sharePdf = async () => {
    if (!activeMeta?.walls?.length) return;
    try {
      setExportingPdf(true);
      const pdfUri = await exportFloorPlanPdfFromMeta(
        activeMeta.walls,
        activeMeta,
        selectedRoom?.name || t('offer.detail.floorPlan.sectionTitle'),
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
            {hasVectorPlan && activeMeta ? (
              <FloorPlanScanArtboard
                walls={activeMeta.walls}
                meta={activeMeta}
                width={Math.min(screenW - 40, 360)}
                height={180}
              />
            ) : displayImageUrl ? (
              <Image source={{ uri: displayImageUrl }} style={styles.thumbnail} resizeMode="cover" />
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

          {roomScans.length > 0 ? (
            <View style={styles.planChips}>
              <Pressable
                onPress={() => setPlanKey('whole')}
                style={[
                  styles.planChip,
                  planKey === 'whole' && styles.planChipActive,
                  isDark && { borderColor: 'rgba(255,255,255,0.12)' },
                ]}
              >
                <Text style={[styles.planChipText, planKey === 'whole' && styles.planChipTextActive]}>
                  {t('offer.detail.floorPlan.wholeHome')}
                </Text>
              </Pressable>
              {roomScans.map((room) => (
                <Pressable
                  key={room.id || room.name}
                  onPress={() => setPlanKey(room.id)}
                  style={[
                    styles.planChip,
                    planKey === room.id && styles.planChipActive,
                    isDark && { borderColor: 'rgba(255,255,255,0.12)' },
                  ]}
                >
                  <Text style={[styles.planChipText, planKey === room.id && styles.planChipTextActive]}>
                    {room.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {furniture.length > 0 ? (
            <View style={styles.furnitureBlock}>
              <Text style={[styles.furnitureTitle, isDark && { color: '#cbd5e1' }]}>
                {t('offer.detail.floorPlan.furniture')}
              </Text>
              <View style={styles.furnitureWrap}>
                {furniture.map((obj) => (
                  <View key={obj.id} style={[styles.furnitureChip, isDark && { backgroundColor: '#242427' }]}>
                    <Text style={[styles.furnitureChipText, isDark && { color: '#e2e8f0' }]}>{obj.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {roomScans.length > 0 ? (
            <View style={styles.roomScansBlock}>
              <Text style={[styles.roomScansTitle, isDark && { color: '#e2e8f0' }]}>
                {t('offer.detail.floorPlan.roomsTitle')}
              </Text>
              {roomScans.map((room, index) => (
                <Pressable
                  key={room.id || `${room.name}-${index}`}
                  onPress={() => setPlanKey(room.id)}
                  style={[
                    styles.roomScanRow,
                    planKey === room.id && styles.roomScanRowActive,
                    isDark && { backgroundColor: '#242427', borderColor: 'rgba(255,255,255,0.1)' },
                  ]}
                >
                  {room.floorPlanPngUri ? (
                    <Image source={{ uri: absolutePlanAssetUrl(room.floorPlanPngUri) }} style={styles.roomScanImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.roomScanImage, styles.roomScanPlaceholder]}>
                      <Ionicons name="map-outline" size={20} color="#64748b" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roomScanName, isDark && { color: '#f8fafc' }]}>{room.name}</Text>
                    <Text style={[styles.roomScanMeta, isDark && { color: '#94a3b8' }]}>
                      {[room.widthM && room.lengthM ? `${room.widthM} × ${room.lengthM} m` : null, room.areaM2 ? `${room.areaM2} m²` : null, room.heightM ? `H ${room.heightM} m` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {room.floorPlan3dUri && Platform.OS === 'ios' ? (
                      <Pressable onPress={() => void openWalkthrough(absolutePlanAssetUrl(room.floorPlan3dUri))} style={styles.roomScan3dBtn}>
                        <Ionicons name="cube-outline" size={15} color="#0ea5e9" />
                        <Text style={styles.roomScan3dText}>{t('offer.detail.floorPlan.walkthrough3d')}</Text>
                      </Pressable>
                    ) : null}
                    {(room.scanMeta?.objects || []).length > 0 ? (
                      <Text style={[styles.roomScanMeta, isDark && { color: '#94a3b8' }]} numberOfLines={2}>
                        {(room.scanMeta?.objects || []).map((obj) => obj.label).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {has3d && Platform.OS === 'ios' ? (
              <Pressable onPress={() => void openWalkthrough(absolutePlanAssetUrl(active3dUrl))} style={[styles.walkthroughBtn, isDark && styles.walkthroughBtnDark]}>
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

            {hasVectorPlan && activeMeta ? (
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
                {hasVectorPlan && activeMeta ? (
                  <FloorPlanScanArtboard
                    walls={activeMeta.walls}
                    meta={activeMeta}
                    width={modalArtboardW}
                    height={modalArtboardH}
                  />
                ) : displayImageUrl ? (
                  <Image source={{ uri: displayImageUrl }} style={styles.fullImage} resizeMode="contain" />
                ) : null}
              </View>

              <View style={styles.modalActions}>
                {hasVectorPlan && activeMeta ? (
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
                  <Pressable onPress={() => void openWalkthrough(absolutePlanAssetUrl(active3dUrl))} style={styles.modalWalkthroughBtn}>
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
  planChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  planChip: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  planChipActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  planChipText: { color: '#334155', fontSize: 12, fontWeight: '800' },
  planChipTextActive: { color: '#fff' },
  furnitureBlock: { marginTop: 12, gap: 6 },
  furnitureTitle: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  furnitureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  furnitureChip: {
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  furnitureChipText: { color: '#0f172a', fontSize: 11, fontWeight: '700' },
  roomScansBlock: { marginTop: 14, gap: 8 },
  roomScansTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', marginLeft: 2 },
  roomScanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#f8fafc',
  },
  roomScanRowActive: {
    borderColor: 'rgba(14,165,233,0.55)',
    backgroundColor: 'rgba(224,242,254,0.7)',
  },
  roomScanImage: { width: 72, height: 60, borderRadius: 10, backgroundColor: '#e2e8f0' },
  roomScanPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  roomScanName: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  roomScanMeta: { color: '#64748b', fontSize: 10.5, fontWeight: '600', marginTop: 3 },
  roomScan3dBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, alignSelf: 'flex-start' },
  roomScan3dText: { color: '#0ea5e9', fontSize: 11, fontWeight: '900' },
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
