import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloorPlanScanArtboard from './FloorPlanScanArtboard';
import { parseRoomPlanJsonFile } from '../../lib/roomScan/parseRoomPlanJson';
import { exportFloorPlanPdfFromMeta, shareFloorPlanPdf } from '../../lib/roomScan/exportFloorPlanPdf';
import { captureArtboardToPng } from '../../lib/roomScan/captureArtboard';
import type Svg from 'react-native-svg';
import { getSafeQuickLook } from '../../utils/safeQuickLook';
import type { RoomScanDraftAssets, RoomScanWallSegment, FloorPlanScanMeta } from '../../types/roomScan';
import { t } from '../../i18n';

type RoomPlanModule = typeof import('expo-roomplan');

function loadRoomPlanModule(): RoomPlanModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('expo-roomplan') as RoomPlanModule;
  } catch {
    return null;
  }
}

export function isRoomScanSupportedOnDevice(): boolean {
  return Platform.OS === 'ios' && loadRoomPlanModule() !== null;
}

type RoomScanModalProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (assets: RoomScanDraftAssets) => void;
};

type Phase = 'scan' | 'preview' | 'processing';

export default function RoomScanModal({ visible, onClose, onComplete }: RoomScanModalProps) {
  const roomPlan = loadRoomPlanModule();
  if (!roomPlan) return null;

  const { useRoomPlan, ExportType, ScanStatus } = roomPlan;

  return (
    <RoomScanModalBody
      visible={visible}
      onClose={onClose}
      onComplete={onComplete}
      useRoomPlan={useRoomPlan}
      ExportType={ExportType}
      ScanStatus={ScanStatus}
    />
  );
}

type BodyProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (assets: RoomScanDraftAssets) => void;
  useRoomPlan: RoomPlanModule['useRoomPlan'];
  ExportType: RoomPlanModule['ExportType'];
  ScanStatus: RoomPlanModule['ScanStatus'];
};

function RoomScanModalBody({
  visible,
  onClose,
  onComplete,
  useRoomPlan,
  ExportType,
  ScanStatus,
}: BodyProps) {
  const insets = useSafeAreaInsets();
  const { width, height: windowH } = useWindowDimensions();
  const previewRef = useRef<View>(null);
  const svgCaptureRef = useRef<Svg>(null);
  const scanStartedRef = useRef(false);
  const processedExportRef = useRef<string | null>(null);

  const { startRoomPlan, roomScanStatus, scanUrl, jsonUrl } = useRoomPlan({
    exportType: ExportType.Parametric,
    sendFileLoc: true,
  });

  const [phase, setPhase] = useState<Phase>('scan');
  const [walls, setWalls] = useState<RoomScanWallSegment[]>([]);
  const [meta, setMeta] = useState<FloorPlanScanMeta | null>(null);
  const [usdzUri, setUsdzUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('scan');
    setWalls([]);
    setMeta(null);
    setUsdzUri(null);
    setBusy(false);
    setError(null);
    scanStartedRef.current = false;
    processedExportRef.current = null;
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const persistExport = useCallback(async (rawScanUrl?: string | null, rawJsonUrl?: string | null) => {
    if (!rawScanUrl || !rawJsonUrl) {
      throw new Error(t('addOffer.step5.roomScan.errors.exportMissing'));
    }

    const scanUrlLocal = rawScanUrl.startsWith('file://') ? rawScanUrl : rawScanUrl;
    const jsonUrlLocal = rawJsonUrl.startsWith('file://') ? rawJsonUrl : rawJsonUrl;

    const parsed = await parseRoomPlanJsonFile(jsonUrlLocal);
    if (!parsed.walls.length) {
      throw new Error(t('addOffer.step5.roomScan.errors.noWalls'));
    }

    const cacheDir = `${FileSystem.cacheDirectory}room-scans`;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    const stamp = Date.now();
    const usdzTarget = `${cacheDir}/scan-${stamp}.usdz`;
    await FileSystem.copyAsync({ from: scanUrlLocal, to: usdzTarget });

    setWalls(parsed.walls);
    setMeta(parsed.meta);
    setUsdzUri(usdzTarget);
    setPhase('preview');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const launchNativeScan = useCallback(async () => {
    try {
      setError(null);
      await startRoomPlan(`EstateOS-${Date.now()}`);
    } catch {
      setError(t('addOffer.step5.roomScan.errors.scanFailed'));
      handleClose();
    }
  }, [handleClose, startRoomPlan]);

  useEffect(() => {
    if (!visible || phase !== 'scan') return;
    if (scanStartedRef.current) return;
    scanStartedRef.current = true;
    launchNativeScan();
  }, [visible, phase, launchNativeScan]);

  useEffect(() => {
    if (!visible || !scanStartedRef.current || phase !== 'scan') return;

    if (roomScanStatus === ScanStatus.Canceled) {
      scanStartedRef.current = false;
      handleClose();
      return;
    }

    if (roomScanStatus === ScanStatus.Error) {
      const message = t('addOffer.step5.roomScan.errors.scanFailed');
      setError(message);
      scanStartedRef.current = false;
      Alert.alert(t('addOffer.step5.roomScan.brand'), message);
      return;
    }

    if (roomScanStatus !== ScanStatus.OK || !scanUrl || !jsonUrl) return;

    const exportKey = `${scanUrl}|${jsonUrl}`;
    if (processedExportRef.current === exportKey) return;
    processedExportRef.current = exportKey;

    (async () => {
      try {
        setBusy(true);
        setError(null);
        await persistExport(scanUrl, jsonUrl);
      } catch (exportError) {
        const message =
          exportError instanceof Error
            ? exportError.message
            : t('addOffer.step5.roomScan.errors.scanFailed');
        setError(message);
        setPhase('scan');
        scanStartedRef.current = false;
        processedExportRef.current = null;
        Alert.alert(t('addOffer.step5.roomScan.brand'), message);
      } finally {
        setBusy(false);
      }
    })();
  }, [
    ScanStatus.Canceled,
    ScanStatus.Error,
    ScanStatus.OK,
    handleClose,
    jsonUrl,
    persistExport,
    phase,
    roomScanStatus,
    scanUrl,
    visible,
  ]);

  const confirmPreview = async () => {
    if (!meta || !usdzUri) return;
    try {
      setBusy(true);
      setError(null);
      const pngUri = await captureArtboardToPng(svgCaptureRef, previewRef);
      if (!pngUri) throw new Error('capture failed');
      setPhase('processing');
      onComplete({
        floorPlanPngUri: pngUri,
        floorPlan3dUri: usdzUri,
        scanMeta: meta,
      });
      reset();
    } catch {
      setError(t('addOffer.step5.roomScan.errors.previewFailed'));
      setPhase('preview');
    } finally {
      setBusy(false);
    }
  };

  const sharePreviewPdf = async () => {
    if (!meta) return;
    try {
      setBusy(true);
      setError(null);
      const pdfUri = await exportFloorPlanPdfFromMeta(walls, meta, t('addOffer.step5.roomScan.previewTitle'));
      if (pdfUri) await shareFloorPlanPdf(pdfUri);
    } catch {
      setError(t('addOffer.step5.roomScan.errors.pdfFailed'));
    } finally {
      setBusy(false);
    }
  };

  const openWalkthrough3d = async () => {
    if (!usdzUri) return;
    const quickLook = getSafeQuickLook();
    if (!quickLook) {
      setError(t('addOffer.step5.roomScan.errors.walkthroughUnavailable'));
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const info = await FileSystem.getInfoAsync(usdzUri);
      if (!info.exists) throw new Error('missing usdz');
      const uri = usdzUri.startsWith('file://') ? usdzUri : `file://${usdzUri}`;
      await quickLook.previewFile({ uri });
    } catch {
      setError(t('addOffer.step5.roomScan.errors.walkthroughUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const artboardW = Math.min(width - 32, 520);
  const artboardH = Math.min(Math.round(artboardW * 0.92), Math.round(windowH * 0.42));
  const showPreviewModal = visible && (phase === 'preview' || phase === 'processing');
  const detectedObjects = meta?.objects || [];

  return (
    <Modal
      visible={showPreviewModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      {phase === 'preview' && meta ? (
        <View style={[styles.previewRoot, { paddingTop: insets.top + 8 }]}>
          <View style={styles.previewHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.previewTitle}>{t('addOffer.step5.roomScan.previewTitle')}</Text>
              <Text style={styles.previewSubtitle}>{t('addOffer.step5.roomScan.previewSubtitle')}</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.previewClose}>
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.previewCard} ref={previewRef} collapsable={false}>
              <FloorPlanScanArtboard
                ref={svgCaptureRef}
                walls={walls}
                meta={meta}
                width={artboardW}
                height={artboardH}
              />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.rooms')}</Text>
                <Text style={styles.statValue}>{meta.roomCount}</Text>
              </View>
              {meta.totalAreaSqM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.area')}</Text>
                  <Text style={styles.statValue}>{meta.totalAreaSqM} m²</Text>
                </View>
              ) : null}
              {meta.ceilingHeightM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.ceiling')}</Text>
                  <Text style={styles.statValue}>{meta.ceilingHeightM.toFixed(2)} m</Text>
                </View>
              ) : null}
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>3D</Text>
                <Text style={styles.statValue}>{t('addOffer.step5.roomScan.ready')}</Text>
              </View>
            </View>

            {detectedObjects.length > 0 ? (
              <View style={styles.objectsBlock}>
                <Text style={styles.objectsTitle}>{t('addOffer.step5.roomScan.detectedObjects')}</Text>
                <View style={styles.objectsWrap}>
                  {detectedObjects.map((obj) => (
                    <View key={obj.id} style={styles.objectChip}>
                      <Text style={styles.objectChipText}>{obj.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.previewError}>{error}</Text> : null}
            <View style={{ height: 12 }} />
          </ScrollView>

          <View style={[styles.previewActions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.actionsRow}>
              {usdzUri ? (
                <Pressable onPress={openWalkthrough3d} style={[styles.secondaryHalf, styles.walkthroughBtn]} disabled={busy}>
                  <Ionicons name="cube-outline" size={17} color="#0284c7" />
                  <Text style={styles.walkthroughBtnText}>{t('addOffer.step5.roomScan.open3d')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={sharePreviewPdf} style={styles.secondaryHalf} disabled={busy}>
                <Ionicons name="document-text-outline" size={16} color="#334155" />
                <Text style={styles.secondaryBtnText}>{t('addOffer.step5.roomScan.exportPdf')}</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                setError(null);
                processedExportRef.current = null;
                scanStartedRef.current = false;
                setPhase('scan');
              }}
              style={styles.rescanBtn}
            >
              <Text style={styles.rescanBtnText}>{t('addOffer.step5.roomScan.rescan')}</Text>
            </Pressable>
            <Pressable onPress={confirmPreview} style={styles.primaryBtnWide} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t('addOffer.step5.roomScan.usePlan')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === 'processing' ? (
        <View style={styles.processing}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.processingText}>{t('addOffer.step5.roomScan.processing')}</Text>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewRoot: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  previewClose: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  previewTitle: { color: '#0f172a', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  previewSubtitle: { color: '#64748b', fontSize: 14, marginTop: 6, lineHeight: 20 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  previewCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#f8fafc',
    alignSelf: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  statPill: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(148,163,184,0.35)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginTop: 2 },
  objectsBlock: { width: '100%', marginTop: 14 },
  objectsTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  objectsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  objectChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  objectChipText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  previewActions: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.45)',
    backgroundColor: '#f8fafc',
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  secondaryHalf: {
    flex: 1,
    borderRadius: 16,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    backgroundColor: '#ffffff',
  },
  walkthroughBtn: {
    borderColor: 'rgba(14,165,233,0.4)',
    backgroundColor: 'rgba(224,242,254,0.9)',
  },
  primaryBtnWide: {
    backgroundColor: '#0284c7',
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanBtn: {
    borderRadius: 16,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanBtnText: { color: '#64748b', fontWeight: '700', fontSize: 14 },
  primaryBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  secondaryBtnText: { color: '#334155', fontWeight: '800', fontSize: 13 },
  walkthroughBtnText: { color: '#0369a1', fontWeight: '800', fontSize: 13 },
  previewError: { color: '#b91c1c', textAlign: 'center', marginTop: 10, width: '100%' },
  processing: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: { color: '#334155', fontWeight: '600' },
});
