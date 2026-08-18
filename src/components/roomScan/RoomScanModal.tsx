import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
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
  scanMode?: 'room' | 'property';
  roomName?: string;
};

type Phase = 'scan' | 'preview' | 'processing';

export default function RoomScanModal({
  visible,
  onClose,
  onComplete,
  scanMode = 'property',
  roomName,
}: RoomScanModalProps) {
  const roomPlan = loadRoomPlanModule();
  if (!roomPlan) return null;

  const { RoomPlanView, useRoomPlanView, ExportType } = roomPlan;
  if (!RoomPlanView || !useRoomPlanView) return null;

  return (
    <RoomScanModalBody
      visible={visible}
      onClose={onClose}
      onComplete={onComplete}
      RoomPlanView={RoomPlanView}
      useRoomPlanView={useRoomPlanView}
      ExportType={ExportType}
      scanMode={scanMode}
      roomName={roomName}
    />
  );
}

type BodyProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (assets: RoomScanDraftAssets) => void;
  RoomPlanView: RoomPlanModule['RoomPlanView'];
  useRoomPlanView: RoomPlanModule['useRoomPlanView'];
  ExportType: RoomPlanModule['ExportType'];
  scanMode: 'room' | 'property';
  roomName?: string;
};

function RoomScanModalBody({
  visible,
  onClose,
  onComplete,
  RoomPlanView,
  useRoomPlanView,
  ExportType,
  scanMode,
  roomName,
}: BodyProps) {
  const insets = useSafeAreaInsets();
  const { width, height: windowH } = useWindowDimensions();
  const previewRef = useRef<View>(null);
  const svgCaptureRef = useRef<Svg>(null);
  const scanStartedRef = useRef(false);
  const processedExportRef = useRef<string | null>(null);
  const headingRef = useRef<{
    northRotationDegrees: number | null;
    headingAccuracyDegrees: number | null;
    headingSource: 'true' | 'magnetic' | null;
  }>({
    northRotationDegrees: null,
    headingAccuracyDegrees: null,
    headingSource: null,
  });

  const [phase, setPhase] = useState<Phase>('scan');
  const [walls, setWalls] = useState<RoomScanWallSegment[]>([]);
  const [meta, setMeta] = useState<FloorPlanScanMeta | null>(null);
  const [usdzUri, setUsdzUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedRoomCount, setCapturedRoomCount] = useState(1);

  const reset = useCallback(() => {
    setPhase('scan');
    setWalls([]);
    setMeta(null);
    setUsdzUri(null);
    setBusy(false);
    setError(null);
    setCapturedRoomCount(1);
    scanStartedRef.current = false;
    processedExportRef.current = null;
  }, []);

  const persistExport = useCallback(async (rawScanUrl?: string | null, rawJsonUrl?: string | null) => {
    if (!rawScanUrl || !rawJsonUrl) {
      throw new Error(t('addOffer.step5.roomScan.errors.exportMissing'));
    }

    const scanUrlLocal = rawScanUrl.startsWith('file://') ? rawScanUrl : rawScanUrl;
    const jsonUrlLocal = rawJsonUrl.startsWith('file://') ? rawJsonUrl : rawJsonUrl;

    const parsed = await parseRoomPlanJsonFile(jsonUrlLocal, headingRef.current);
    if (!parsed.walls.length) {
      throw new Error(t('addOffer.step5.roomScan.errors.noWalls'));
    }

    const scansDir = `${FileSystem.documentDirectory}room-scans`;
    await FileSystem.makeDirectoryAsync(scansDir, { intermediates: true });
    const stamp = Date.now();
    const safeRoomName = String(roomName || (scanMode === 'property' ? 'nieruchomosc' : 'pomieszczenie'))
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    const usdzTarget = `${scansDir}/${safeRoomName || 'scan'}-${stamp}.usdz`;
    await FileSystem.copyAsync({ from: scanUrlLocal, to: usdzTarget });

    setWalls(parsed.walls);
    setMeta(parsed.meta);
    setUsdzUri(usdzTarget);
    setPhase('preview');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [roomName, scanMode]);

  const handleNativeExport = useCallback((event: {
    nativeEvent?: { scanUrl?: string | null; jsonUrl?: string | null };
  }) => {
    const scanUrl = event?.nativeEvent?.scanUrl;
    const jsonUrl = event?.nativeEvent?.jsonUrl;
    if (!scanUrl || !jsonUrl) return;
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
  }, [persistExport]);

  const handleNativeStatus = useCallback((event: {
    nativeEvent?: { status?: string; errorMessage?: string };
  }) => {
    const status = String(event?.nativeEvent?.status || '').toLowerCase();
    if (status === 'error') {
      setError(event?.nativeEvent?.errorMessage || t('addOffer.step5.roomScan.errors.scanFailed'));
      setBusy(false);
      scanStartedRef.current = false;
    }
    if (status === 'canceled' || status === 'cancelled') {
      setBusy(false);
      scanStartedRef.current = false;
    }
  }, []);

  const { viewProps, controls, state: nativeState } = useRoomPlanView({
    scanName: `EstateOS-${scanMode}-${Date.now()}`,
    exportType: ExportType.Parametric,
    exportOnFinish: true,
    sendFileLoc: true,
    autoCloseOnTerminalStatus: true,
    onStatus: handleNativeStatus,
    onExported: handleNativeExport,
  });

  const captureHeading = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const heading = await Location.getHeadingAsync();
      const hasTrueHeading = Number.isFinite(heading.trueHeading) && heading.trueHeading >= 0;
      const degrees = hasTrueHeading ? heading.trueHeading : heading.magHeading;
      if (!Number.isFinite(degrees) || degrees < 0) return;
      headingRef.current = {
        northRotationDegrees: Number((-degrees).toFixed(1)),
        headingAccuracyDegrees: Number.isFinite(heading.accuracy) ? heading.accuracy : null,
        headingSource: hasTrueHeading ? 'true' : 'magnetic',
      };
    } catch {
      headingRef.current = {
        northRotationDegrees: null,
        headingAccuracyDegrees: null,
        headingSource: null,
      };
    }
  }, []);

  const handleClose = useCallback(() => {
    controls.cancel();
    controls.reset();
    reset();
    onClose();
  }, [controls, onClose, reset]);

  useEffect(() => {
    if (!visible) {
      if (nativeState.isRunning) controls.cancel();
      reset();
      return;
    }
    if (phase !== 'scan' || scanStartedRef.current) return;

    scanStartedRef.current = true;
    processedExportRef.current = null;
    setError(null);
    controls.reset();
    void captureHeading().finally(() => controls.start());
  }, [captureHeading, controls, nativeState.isRunning, phase, reset, visible]);

  useEffect(
    () => () => {
      controls.cancel();
      controls.reset();
    },
    [controls],
  );

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
  const primarySection = meta?.sections?.[0];

  return (
    <>
      <Modal
        visible={visible && phase === 'scan'}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <View style={styles.scannerRoot}>
          <RoomPlanView {...viewProps} style={StyleSheet.absoluteFill} />
          <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View style={styles.scannerTopBar}>
              <Pressable onPress={handleClose} style={styles.scannerCircleBtn} hitSlop={12}>
                <Ionicons name="close" size={23} color="#fff" />
              </Pressable>
              <View style={styles.scannerTitlePill}>
                <Text style={styles.scannerEyebrow}>
                  {scanMode === 'room' ? 'SKAN POMIESZCZENIA' : 'SKAN CAŁEJ NIERUCHOMOŚCI'}
                </Text>
                <Text numberOfLines={1} style={styles.scannerTitle}>
                  {scanMode === 'room' ? roomName || 'Pomieszczenie' : `${capturedRoomCount} pomieszczenie`}
                </Text>
              </View>
              <View style={[styles.scannerCircleBtn, styles.scannerStatus]}>
                <View style={[styles.liveDot, nativeState.isRunning && styles.liveDotActive]} />
              </View>
            </View>

            <View style={styles.scannerGuide}>
              <Ionicons name="scan-outline" size={18} color="#7dd3fc" />
              <Text style={styles.scannerGuideText}>
                Prowadź iPhone’a lub iPada powoli wzdłuż ścian. Obejmij podłogę, sufit, drzwi i okna.
              </Text>
            </View>

            <View style={styles.scannerBottomBar}>
              {error ? <Text style={styles.scannerError}>{error}</Text> : null}
              {scanMode === 'property' ? (
                <Pressable
                  onPress={() => {
                    controls.addRoom();
                    setCapturedRoomCount((count) => count + 1);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  disabled={busy || !nativeState.isRunning}
                  style={[styles.scannerSecondaryBtn, (busy || !nativeState.isRunning) && styles.disabledBtn]}
                >
                  <Ionicons name="add-circle-outline" size={21} color="#fff" />
                  <Text style={styles.scannerSecondaryText}>Zapisz pokój i skanuj następny</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  setBusy(true);
                  controls.finishScan();
                }}
                disabled={busy || !nativeState.isRunning}
                style={[styles.scannerFinishBtn, (busy || !nativeState.isRunning) && styles.disabledBtn]}
              >
                {busy ? <ActivityIndicator color="#06243a" /> : <Ionicons name="checkmark-circle" size={22} color="#06243a" />}
                <Text style={styles.scannerFinishText}>
                  {nativeState.isPreviewVisible ? 'Zatwierdź plan Apple' : 'Zakończ, zsumuj i zapisz'}
                </Text>
              </Pressable>
              <Text style={styles.scannerFootnote}>
                Zamknięcie skanera zawsze zatrzymuje sesję LiDAR i aparat.
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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
              {primarySection?.widthM && primarySection?.lengthM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>WYMIARY</Text>
                  <Text style={styles.statValue}>
                    {primarySection.widthM.toFixed(2)} × {primarySection.lengthM.toFixed(2)} m
                  </Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  scannerRoot: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scannerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  scannerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  scannerStatus: {
    backgroundColor: 'rgba(2,6,23,0.62)',
  },
  liveDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#64748b',
  },
  liveDotActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  scannerTitlePill: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  scannerEyebrow: {
    color: '#7dd3fc',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  scannerGuide: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(2,6,23,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.28)',
  },
  scannerGuideText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  scannerBottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    gap: 8,
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(2,6,23,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  scannerSecondaryBtn: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  scannerSecondaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  scannerFinishBtn: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#7dd3fc',
  },
  scannerFinishText: {
    color: '#06243a',
    fontSize: 14,
    fontWeight: '900',
  },
  scannerFootnote: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  scannerError: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledBtn: {
    opacity: 0.48,
  },
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
