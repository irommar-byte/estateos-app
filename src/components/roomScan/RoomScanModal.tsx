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
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloorPlanScanArtboard from './FloorPlanScanArtboard';
import { parseRoomPlanJsonFile } from '../../lib/roomScan/parseRoomPlanJson';
import { measurementsFromScanMeta } from '../../lib/roomScan/roomScanMeasurements';
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

function getNativeRoomPlan(roomPlan: RoomPlanModule | null) {
  if (!roomPlan) return null;
  const nested = roomPlan as RoomPlanModule & { default?: RoomPlanModule };
  return nested.ExpoRoomplan ?? nested.default?.ExpoRoomplan ?? null;
}

export function isRoomScanSupportedOnDevice(): boolean {
  return Platform.OS === 'ios' && loadRoomPlanModule() !== null;
}

async function stopNativeScanner(roomPlan: RoomPlanModule | null): Promise<void> {
  try {
    await getNativeRoomPlan(roomPlan)?.stopCapture?.();
  } catch {
    // Native session may already be gone.
  }
}

type RoomScanModalProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (assets: RoomScanDraftAssets) => void;
  onMeasurements?: (meta: FloorPlanScanMeta) => void;
  scanMode?: 'room' | 'property';
  roomName?: string;
};

type Phase = 'launching' | 'scanning' | 'processing' | 'preview';

export default function RoomScanModal({
  visible,
  onClose,
  onComplete,
  onMeasurements,
  scanMode = 'property',
  roomName,
}: RoomScanModalProps) {
  const roomPlan = loadRoomPlanModule();
  if (!getNativeRoomPlan(roomPlan) || !roomPlan?.ExportType) return null;

  return (
    <RoomScanModalBody
      visible={visible}
      onClose={onClose}
      onComplete={onComplete}
      onMeasurements={onMeasurements}
      roomPlan={roomPlan}
      scanMode={scanMode}
      roomName={roomName}
    />
  );
}

type BodyProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (assets: RoomScanDraftAssets) => void;
  onMeasurements?: (meta: FloorPlanScanMeta) => void;
  roomPlan: RoomPlanModule;
  scanMode: 'room' | 'property';
  roomName?: string;
};

function RoomScanModalBody({
  visible,
  onClose,
  onComplete,
  onMeasurements,
  roomPlan,
  scanMode,
  roomName,
}: BodyProps) {
  const insets = useSafeAreaInsets();
  const { width, height: windowH } = useWindowDimensions();
  const previewRef = useRef<View>(null);
  const svgCaptureRef = useRef<Svg>(null);
  const scanStartedRef = useRef(false);
  const processedExportRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const headingRef = useRef<{
    northRotationDegrees: number | null;
    headingAccuracyDegrees: number | null;
    headingSource: 'true' | 'magnetic' | null;
  }>({
    northRotationDegrees: null,
    headingAccuracyDegrees: null,
    headingSource: null,
  });

  const [phase, setPhase] = useState<Phase>('launching');
  const [walls, setWalls] = useState<RoomScanWallSegment[]>([]);
  const [meta, setMeta] = useState<FloorPlanScanMeta | null>(null);
  const [usdzUri, setUsdzUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presenterReady, setPresenterReady] = useState(false);
  const [scanRequestToken, setScanRequestToken] = useState(0);

  const reset = useCallback(() => {
    setPhase('launching');
    setWalls([]);
    setMeta(null);
    setUsdzUri(null);
    setBusy(false);
    setError(null);
    scanStartedRef.current = false;
    processedExportRef.current = null;
    closingRef.current = false;
    setPresenterReady(false);
  }, []);

  const persistExport = useCallback(async (rawScanUrl?: string | null, rawJsonUrl?: string | null) => {
    if (!rawScanUrl || !rawJsonUrl) {
      throw new Error(t('addOffer.step5.roomScan.errors.exportMissing'));
    }

    const parsed = await parseRoomPlanJsonFile(rawJsonUrl, headingRef.current);
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
    await FileSystem.copyAsync({ from: rawScanUrl, to: usdzTarget });

    setWalls(parsed.walls);
    setMeta(parsed.meta);
    setUsdzUri(usdzTarget);
    onMeasurements?.(parsed.meta);
    return parsed.meta;
  }, [onMeasurements, roomName, scanMode]);

  const onCloseRef = useRef(onClose);
  const persistExportRef = useRef(persistExport);
  onCloseRef.current = onClose;
  persistExportRef.current = persistExport;

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    void stopNativeScanner(roomPlan);
    onCloseRef.current();
    reset();
  }, [reset, roomPlan]);

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

  useEffect(() => {
    const native = getNativeRoomPlan(roomPlan);
    if (!native?.addListener) return undefined;
    const sub = native.addListener('onDismissEvent', (event: {
      status?: string;
      scanUrl?: string;
      jsonUrl?: string;
      errorMessage?: string;
    }) => {
      const status = String(event?.status || '').toLowerCase();
      if (status === 'canceled' || status === 'cancelled') {
        scanStartedRef.current = false;
        void stopNativeScanner(roomPlan);
        onCloseRef.current();
        reset();
        return;
      }
      if (status === 'error') {
        setBusy(false);
        scanStartedRef.current = false;
        const message =
          /not supported|LiDAR/i.test(String(event?.errorMessage || ''))
            ? t('addOffer.step5.roomScan.errors.unsupportedDevice')
            : event?.errorMessage || t('addOffer.step5.roomScan.errors.scanFailed');
        setError(message);
        setPhase('launching');
        Alert.alert(t('addOffer.step5.roomScan.brand'), message);
        return;
      }
      if (status !== 'ok') return;
      const scanUrl = event?.scanUrl;
      const jsonUrl = event?.jsonUrl;
      if (!scanUrl || !jsonUrl) {
        scanStartedRef.current = false;
        setError(t('addOffer.step5.roomScan.errors.exportMissing'));
        void (async () => {
          await stopNativeScanner(roomPlan);
          setPhase('launching');
        })();
        return;
      }
      const exportKey = `${scanUrl}|${jsonUrl}`;
      if (processedExportRef.current === exportKey) return;
      processedExportRef.current = exportKey;
      void (async () => {
        try {
          setBusy(true);
          setError(null);
          await persistExportRef.current(scanUrl, jsonUrl);
          await stopNativeScanner(roomPlan);
          setPhase('preview');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (exportError) {
          const message =
            exportError instanceof Error
              ? exportError.message
              : t('addOffer.step5.roomScan.errors.scanFailed');
          setError(message);
          scanStartedRef.current = false;
          processedExportRef.current = null;
          await stopNativeScanner(roomPlan);
          setPhase('launching');
          Alert.alert(t('addOffer.step5.roomScan.brand'), message);
        } finally {
          setBusy(false);
        }
      })();
    });
    return () => {
      sub?.remove();
    };
  }, [reset, roomPlan]);

  useEffect(() => {
    if (!visible) {
      void stopNativeScanner(roomPlan);
      reset();
      return;
    }
    // React Native presents <Modal> asynchronously. Starting RoomPlan before
    // onShow means UIKit may attach it to a controller that is still moving
    // into the window, resulting in camera-only sessions with no RoomPlan scan.
    if (!presenterReady) return;
    if (scanStartedRef.current) return;

    scanStartedRef.current = true;
    processedExportRef.current = null;
    closingRef.current = false;
    setPhase('launching');
    setError(null);

    const scanName = `${scanMode === 'room' ? 'EOS-AUTO' : 'EOS-MULTI'}-${Date.now()}`;
    void (async () => {
      await stopNativeScanner(roomPlan);
      await captureHeading();
      try {
        await getNativeRoomPlan(roomPlan)?.startCapture(scanName, roomPlan.ExportType.Parametric, true);
        setPhase('scanning');
      } catch {
        scanStartedRef.current = false;
        setError(t('addOffer.step5.roomScan.errors.scanFailed'));
      }
    })();
  }, [captureHeading, presenterReady, reset, roomPlan, scanMode, scanRequestToken, visible]);

  useEffect(
    () => () => {
      void stopNativeScanner(roomPlan);
    },
    [roomPlan],
  );

  const confirmPreview = async () => {
    if (!meta || !usdzUri) return;
    try {
      setBusy(true);
      setError(null);
      const pngUri =
        (await captureArtboardToPng(svgCaptureRef, previewRef).catch(() => null)) ||
        (await (async () => {
          const uri = `${FileSystem.cacheDirectory}floorplan-${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(
            uri,
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            { encoding: FileSystem.EncodingType.Base64 },
          );
          return uri;
        })());
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

  const retryNativeScan = () => {
    void (async () => {
      await stopNativeScanner(roomPlan);
      setError(null);
      processedExportRef.current = null;
      scanStartedRef.current = false;
      // Preview and launcher use different native modal presenters. Wait for
      // the launcher onShow callback when switching back from preview.
      if (phase !== 'launching') setPresenterReady(false);
      setPhase('launching');
      setScanRequestToken((token) => token + 1);
    })();
  };

  const artboardW = Math.min(width - 32, 520);
  const artboardH = Math.min(Math.round(artboardW * 0.92), Math.round(windowH * 0.42));
  // RoomPlan is presented by the native view controller that backs this modal.
  // Keep that presenter mounted for the entire scan; removing it while RoomPlan
  // is on top leaves iOS with a broken presentation chain and a black screen
  // when the native scanner closes.
  const showLaunching = visible && (phase === 'launching' || phase === 'scanning');
  const showPreviewModal = visible && (phase === 'preview' || phase === 'processing');
  const detectedObjects = meta?.objects || [];
  const primarySection = meta?.sections?.[0];
  const measured = meta ? measurementsFromScanMeta(meta) : null;

  return (
    <>
      <Modal
        visible={showLaunching}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
        onShow={() => setPresenterReady(true)}
      >
        <View style={[styles.launchRoot, { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable onPress={handleClose} style={styles.launchClose} hitSlop={16}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <View style={styles.launchCopy}>
            <ActivityIndicator size="large" color="#7dd3fc" />
            <Text style={styles.launchEyebrow}>
              {scanMode === 'room' ? t('addOffer.step5.roomScan.launchRoom') : t('addOffer.step5.roomScan.launchProperty')}
            </Text>
            <Text style={styles.launchTitle}>{roomName || t('addOffer.step5.roomScan.brand')}</Text>
            <Text style={styles.launchHint}>{t('addOffer.step5.roomScan.launchHint')}</Text>
            {error ? <Text style={styles.launchError}>{error}</Text> : null}
          </View>
          <View style={styles.launchActions}>
            {error ? (
              <Pressable onPress={retryNativeScan} style={styles.launchRetry}>
                <Text style={styles.launchRetryText}>{t('addOffer.step5.roomScan.rescan')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={handleClose} style={styles.launchCancel}>
              <Text style={styles.launchCancelText}>{t('addOffer.step5.roomScan.cancel')}</Text>
            </Pressable>
          </View>
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
              {measured?.areaM2 ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.area')}</Text>
                  <Text style={styles.statValue}>{measured.areaM2} m²</Text>
                </View>
              ) : meta.totalAreaSqM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.area')}</Text>
                  <Text style={styles.statValue}>{meta.totalAreaSqM} m²</Text>
                </View>
              ) : null}
              {measured?.heightM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.ceiling')}</Text>
                  <Text style={styles.statValue}>{measured.heightM} m</Text>
                </View>
              ) : meta.ceilingHeightM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.ceiling')}</Text>
                  <Text style={styles.statValue}>{meta.ceilingHeightM.toFixed(2)} m</Text>
                </View>
              ) : null}
              {measured?.widthM && measured?.lengthM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.dimensions')}</Text>
                  <Text style={styles.statValue}>
                    {measured.widthM} × {measured.lengthM} m
                  </Text>
                </View>
              ) : primarySection?.widthM && primarySection?.lengthM ? (
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>{t('addOffer.step5.roomScan.dimensions')}</Text>
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
            <Pressable onPress={retryNativeScan} style={styles.rescanBtn}>
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
          <Text style={styles.processingHint}>{t('addOffer.step5.roomScan.processingHint')}</Text>
          {measured?.widthM && measured?.lengthM ? (
            <Text style={styles.processingDims}>
              {measured.widthM} × {measured.lengthM} m
              {measured.heightM ? ` · H ${measured.heightM} m` : ''}
              {measured.areaM2 ? ` · ${measured.areaM2} m²` : ''}
            </Text>
          ) : primarySection?.widthM && primarySection?.lengthM ? (
            <Text style={styles.processingDims}>
              {primarySection.widthM.toFixed(2)} × {primarySection.lengthM.toFixed(2)} m
              {meta?.ceilingHeightM ? ` · H ${meta.ceilingHeightM.toFixed(2)} m` : ''}
              {meta?.totalAreaSqM ? ` · ${meta.totalAreaSqM} m²` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  launchRoot: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 20,
  },
  launchClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
  },
  launchCopy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  launchEyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  launchTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  launchHint: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  launchError: {
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  launchActions: {
    gap: 10,
  },
  launchRetry: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7dd3fc',
  },
  launchRetryText: {
    color: '#06243a',
    fontSize: 15,
    fontWeight: '900',
  },
  launchCancel: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  launchCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
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
  processingText: { color: '#334155', fontWeight: '600', fontSize: 16 },
  processingHint: { color: '#64748b', fontWeight: '600', fontSize: 13, textAlign: 'center', paddingHorizontal: 28 },
  processingDims: { color: '#0284c7', fontWeight: '900', fontSize: 18, marginTop: 8 },
});
