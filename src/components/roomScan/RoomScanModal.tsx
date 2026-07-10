import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
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
  const { width } = useWindowDimensions();
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
  const artboardH = Math.round(artboardW * 1.15);
  const showPreviewModal = visible && (phase === 'preview' || phase === 'processing');

  return (
    <Modal
      visible={showPreviewModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      {phase === 'preview' && meta ? (
        <View style={[styles.previewRoot, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.previewClose}>
            <Ionicons name="close" size={22} color="#94a3b8" />
          </Pressable>

          <Text style={styles.previewTitle}>{t('addOffer.step5.roomScan.previewTitle')}</Text>
          <Text style={styles.previewSubtitle}>{t('addOffer.step5.roomScan.previewSubtitle')}</Text>

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
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>3D</Text>
              <Text style={styles.statValue}>{t('addOffer.step5.roomScan.ready')}</Text>
            </View>
          </View>

          {error ? <Text style={styles.previewError}>{error}</Text> : null}

          <View style={styles.previewActions}>
            {usdzUri ? (
              <Pressable onPress={openWalkthrough3d} style={styles.walkthroughBtnWide} disabled={busy}>
                <Ionicons name="cube-outline" size={18} color="#38bdf8" />
                <Text style={styles.walkthroughBtnText}>{t('addOffer.step5.roomScan.open3d')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={sharePreviewPdf} style={styles.pdfBtnWide} disabled={busy}>
              <Ionicons name="document-text-outline" size={16} color="#e2e8f0" />
              <Text style={styles.secondaryBtnText}>{t('addOffer.step5.roomScan.exportPdf')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError(null);
                processedExportRef.current = null;
                scanStartedRef.current = false;
                setPhase('scan');
              }}
              style={styles.secondaryBtnWide}
            >
              <Text style={styles.secondaryBtnText}>{t('addOffer.step5.roomScan.rescan')}</Text>
            </Pressable>
            <Pressable onPress={confirmPreview} style={styles.primaryBtnWide} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.primaryBtnText}>{t('addOffer.step5.roomScan.usePlan')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === 'processing' ? (
        <View style={styles.processing}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.processingText}>{t('addOffer.step5.roomScan.processing')}</Text>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '900', fontSize: 14 },
  secondaryBtnText: { color: '#e2e8f0', fontWeight: '800', fontSize: 13 },
  previewRoot: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
  },
  previewTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  previewSubtitle: { color: '#94a3b8', fontSize: 14, marginTop: 6, marginBottom: 18, lineHeight: 20 },
  previewCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    backgroundColor: '#0b1220',
    alignSelf: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  statPill: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderColor: 'rgba(148,163,184,0.2)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  statLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginTop: 2 },
  previewActions: { marginTop: 'auto', gap: 10 },
  primaryBtnWide: {
    backgroundColor: '#38bdf8',
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnWide: {
    borderRadius: 18,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  pdfBtnWide: {
    borderRadius: 18,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  walkthroughBtnWide: {
    borderRadius: 18,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.45)',
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  walkthroughBtnText: { color: '#e0f2fe', fontWeight: '800', fontSize: 13 },
  previewError: { color: '#fca5a5', textAlign: 'center', marginTop: 10 },
  processing: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText: { color: '#cbd5e1', fontWeight: '600' },
});
