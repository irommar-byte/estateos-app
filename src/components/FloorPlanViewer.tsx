import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { exportFloorPlanPdfFromMeta, shareFloorPlanPdf } from '../lib/roomScan/exportFloorPlanPdf';
import { useI18n } from '../i18n';
import { getSafeQuickLook } from '../utils/safeQuickLook';
import FloorPlanScanArtboard from './roomScan/FloorPlanScanArtboard';
import RoomScanParamsSheet from './roomScan/RoomScanParamsSheet';
import RoomScanModal, { isRoomScanSupportedOnDevice } from './roomScan/RoomScanModal';
import type { FloorPlanScanMeta, PropertyRoomScan, RoomScanDraftAssets } from '../types/roomScan';
import {
  applyRoomDraftToScanMeta,
  cropScanMetaToRoom,
  listingRoomCountFromRooms,
  listingRoomCountFromSections,
  roomsFromScanMeta,
} from '../lib/roomScan/refineScanSections';
import { dedupeDetectedObjects } from '../lib/roomScan/floorPlanGeometry';
import { planSpecs, type PlanSpec } from '../lib/roomScan/planSpecs';
import { resolveWholePlanMeta } from '../lib/roomScan/wholePlan';
import { API_URL } from '../config/network';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function absolutePlanAssetUrl(uri?: string | null): string | undefined {
  const value = String(uri || '').trim();
  if (!value) return undefined;
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://')) return value;
  return `${API_URL.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
}

/** Pomiary z LiDAR-u w kafelkach: szerokość, długość, wysokość, metraż, kubatura, okna, drzwi. */
function PlanSpecGrid({ specs, isDark }: { specs: PlanSpec[]; isDark?: boolean }) {
  if (!specs.length) return null;
  return (
    <View style={styles.specGrid}>
      {specs.map((spec) => (
        <View
          key={spec.label}
          style={[
            styles.specCell,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f4f2ee',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <Text style={[styles.specLabel, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8a857c' }]}>{spec.label}</Text>
          <Text style={[styles.specValue, { color: isDark ? '#f5f5f7' : '#15171a' }]}>{spec.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Zestawienie rysunków pomieszczeń jako „Całe mieszkanie”, gdy oferta nie ma skanu całości. */
function RoomPlanMosaic({
  rooms,
  isDark,
  onPick,
}: {
  rooms: PropertyRoomScan[];
  isDark?: boolean;
  onPick?: (room: PropertyRoomScan) => void;
}) {
  const cols = rooms.length <= 2 ? rooms.length : rooms.length <= 4 ? 2 : 3;
  const rows: PropertyRoomScan[][] = [];
  for (let i = 0; i < rooms.length; i += cols) rows.push(rooms.slice(i, i + cols));
  return (
    <View style={[styles.mosaic, { backgroundColor: isDark ? '#111214' : '#e9edf2' }]}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.mosaicRow}>
          {row.map((room) => {
            const area = room.areaM2 ? `${String(room.areaM2).replace('.', ',')} m²` : '';
            const tile = (
              <>
                <Image source={{ uri: absolutePlanAssetUrl(room.floorPlanPngUri) }} style={styles.mosaicImage} resizeMode="contain" />
                <View style={styles.mosaicLabel}>
                  <Text style={styles.mosaicName} numberOfLines={1}>
                    {room.name}
                  </Text>
                  {area ? <Text style={styles.mosaicArea}>{area}</Text> : null}
                </View>
              </>
            );
            return onPick ? (
              <Pressable key={room.id} style={({ pressed }) => [styles.mosaicTile, pressed && { opacity: 0.8 }]} onPress={() => onPick(room)}>
                {tile}
              </Pressable>
            ) : (
              <View key={room.id} style={styles.mosaicTile}>
                {tile}
              </View>
            );
          })}
          {row.length < cols ? Array.from({ length: cols - row.length }).map((_, k) => <View key={`gap-${k}`} style={{ flex: 1, margin: 3 }} />) : null}
        </View>
      ))}
    </View>
  );
}

export default function FloorPlanViewer({
  imageUrl,
  model3dUrl,
  scanMeta,
  theme,
  editable,
  onChangeMeta,
}: {
  imageUrl?: string | null;
  model3dUrl?: string | null;
  scanMeta?: FloorPlanScanMeta | null;
  theme?: { glass?: string; dark?: boolean };
  editable?: boolean;
  onChangeMeta?: (meta: FloorPlanScanMeta) => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const isDark = theme?.glass === 'dark' || theme?.dark;
  const displayRooms = useMemo(() => roomsFromScanMeta(scanMeta || null), [scanMeta]);
  const roomScans = displayRooms;
  const [planKey, setPlanKey] = useState<'whole' | string>('whole');
  const [editingRoom, setEditingRoom] = useState<PropertyRoomScan | null>(null);
  const [rescanRoom, setRescanRoom] = useState<PropertyRoomScan | null>(null);
  const canScan = isRoomScanSupportedOnDevice();
  const selectedRoom = planKey === 'whole' ? null : roomScans.find((room) => room.id === planKey) || null;
  const croppedSelected = selectedRoom ? cropScanMetaToRoom(scanMeta, selectedRoom) : null;
  // Bez skanu całości: plan złożony ze skanów pokoi (dopasowanie po drzwiach), gdy jest pewny.
  const wholePlan = useMemo(() => resolveWholePlanMeta(scanMeta || null), [scanMeta]);
  const activeMeta = croppedSelected || selectedRoom?.scanMeta || wholePlan.meta;
  // „Całe mieszkanie” nigdy nie pokazuje rysunku jednego pokoju — bez planu całości jest zestawienie pomieszczeń.
  const roomPngUrls = new Set(roomScans.map((room) => absolutePlanAssetUrl(room.floorPlanPngUri)).filter(Boolean));
  const wholeImageUrl = absolutePlanAssetUrl(imageUrl);
  const displayImageUrl = selectedRoom
    ? absolutePlanAssetUrl(selectedRoom.floorPlanPngUri) || undefined
    : wholeImageUrl && !roomPngUrls.has(wholeImageUrl)
      ? wholeImageUrl
      : undefined;
  const hasVectorPlan = Boolean(activeMeta?.walls?.length);
  const mosaicRooms = roomScans.filter((room) => absolutePlanAssetUrl(room.floorPlanPngUri));
  const showMosaic = !selectedRoom && !hasVectorPlan && !displayImageUrl && mosaicRooms.length > 0;
  const hasPlan = Boolean(displayImageUrl) || hasVectorPlan || roomScans.length > 0;
  const active3dUrl = selectedRoom?.floorPlan3dUri || model3dUrl;
  const has3d = Boolean(absolutePlanAssetUrl(active3dUrl)?.trim());
  const listingCount =
    listingRoomCountFromRooms(roomScans) || listingRoomCountFromSections(scanMeta?.sections || []);
  const roomCount = listingCount || scanMeta?.roomCount || roomScans.length;
  // Pomiary z LiDAR-u pod każdym rzutem (pokój albo całe mieszkanie).
  const specs = useMemo(
    () => (scanMeta || roomScans.length ? planSpecs(selectedRoom, selectedRoom?.scanMeta || scanMeta || null, roomScans) : []),
    [selectedRoom, scanMeta, roomScans],
  );
  const furniture = useMemo(
    () => dedupeDetectedObjects(activeMeta?.objects || []),
    [activeMeta],
  );

  const openModal = () => {
    if (!hasPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
  };

  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(false);
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

  const commitRoomDraft = (room: PropertyRoomScan) => {
    if (!scanMeta || !onChangeMeta) return;
    onChangeMeta(applyRoomDraftToScanMeta(scanMeta, room));
    setEditingRoom(null);
  };

  const applyRoomRescan = (assets: RoomScanDraftAssets) => {
    if (!rescanRoom || !scanMeta || !onChangeMeta) return;
    const nextRoom: PropertyRoomScan = {
      ...rescanRoom,
      widthM: assets.scanMeta.sections?.[0]?.widthM
        ? String(assets.scanMeta.sections[0].widthM)
        : rescanRoom.widthM,
      lengthM: assets.scanMeta.sections?.[0]?.lengthM
        ? String(assets.scanMeta.sections[0].lengthM)
        : rescanRoom.lengthM,
      heightM: assets.scanMeta.ceilingHeightM
        ? String(assets.scanMeta.ceilingHeightM)
        : rescanRoom.heightM,
      areaM2: assets.scanMeta.sections?.[0]?.areaSqM
        ? String(assets.scanMeta.sections[0].areaSqM)
        : rescanRoom.areaM2,
      floorPlanPngUri: assets.floorPlanPngUri,
      floorPlan3dUri: assets.floorPlan3dUri,
      scanMeta: assets.scanMeta,
      scannedAt: assets.scanMeta.scannedAt,
    };
    onChangeMeta(applyRoomDraftToScanMeta(scanMeta, nextRoom));
    setRescanRoom(null);
    setEditingRoom(null);
  };

  const roomForSection = (index: number) =>
    roomScans.find((room) => room.sourceSectionIndex === index) || roomScans[index] || null;

  const beginEditSection = (index: number) => {
    const room = roomForSection(index);
    if (room) setEditingRoom(room);
  };

  const renderRoomThumb = (room: PropertyRoomScan) => {
    const cropped = cropScanMetaToRoom(scanMeta, room);
    if (cropped?.walls?.length) {
      return (
        <View style={styles.roomScanImage}>
          <FloorPlanScanArtboard walls={cropped.walls} meta={cropped} width={88} height={72} compact />
        </View>
      );
    }
    if (room.floorPlanPngUri) {
      return (
        <Image source={{ uri: absolutePlanAssetUrl(room.floorPlanPngUri) }} style={styles.roomScanImage} resizeMode="cover" />
      );
    }
    return (
      <View style={[styles.roomScanImage, styles.roomScanPlaceholder]}>
        <Ionicons name="map-outline" size={20} color="#64748b" />
      </View>
    );
  };

  const subtitle = useMemo(() => {
    if (roomCount && roomCount > 0) {
      return t('offer.detail.floorPlan.roomsCount', { count: roomCount });
    }
    if (has3d) return t('offer.detail.floorPlan.scannedPlan');
    return null;
  }, [has3d, roomCount, t]);

  const modalArtboardW = Math.min(screenW - 32, 640);
  const modalArtboardH = Math.round(Math.min(screenH * 0.52, modalArtboardW * 1.05));

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: '#8E8E93' }]}>
        {t('offer.detail.floorPlan.sectionTitle')}
      </Text>

      {hasPlan ? (
        <>
          <View
            style={[
              styles.thumbnailWrapper,
              { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            <Pressable onPress={openModal} style={StyleSheet.absoluteFill} pointerEvents={editable ? 'box-none' : 'auto'}>
              {hasVectorPlan && activeMeta ? (
                <FloorPlanScanArtboard
                  walls={activeMeta.walls}
                  meta={activeMeta}
                  width={Math.min(screenW - 40, 360)}
                  height={180}
                  onSectionPress={
                    editable
                      ? (index) => {
                          if (planKey === 'whole') beginEditSection(index);
                          else if (selectedRoom) setEditingRoom(selectedRoom);
                        }
                      : undefined
                  }
                />
              ) : showMosaic ? (
                <RoomPlanMosaic rooms={mosaicRooms} isDark={isDark} />
              ) : displayImageUrl ? (
                <Image source={{ uri: displayImageUrl }} style={styles.thumbnail} resizeMode="cover" />
              ) : null}
              <View
                style={[styles.thumbnailOverlay, (has3d || hasVectorPlan || showMosaic) && { backgroundColor: 'transparent' }]}
                pointerEvents="none"
              >
                {!has3d && !hasVectorPlan && !showMosaic ? (
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
            {editable && hasVectorPlan ? (
              <Pressable onPress={openModal} style={styles.expandFab} hitSlop={8}>
                <Ionicons name="expand-outline" size={16} color="#e0f2fe" />
              </Pressable>
            ) : null}
          </View>

          {subtitle ? <Text style={[styles.subtitle, isDark && { color: '#9ca3af' }]}>{subtitle}</Text> : null}
          <PlanSpecGrid specs={specs} isDark={isDark} />

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
                  onPress={() => {
                    setPlanKey(room.id);
                    openModal();
                  }}
                  style={[
                    styles.roomScanRow,
                    planKey === room.id && styles.roomScanRowActive,
                    isDark && { backgroundColor: '#242427', borderColor: 'rgba(255,255,255,0.1)' },
                  ]}
                >
                  {renderRoomThumb(room)}
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
                    {(room.scanMeta?.objects || cropScanMetaToRoom(scanMeta, room)?.objects || []).length > 0 ? (
                      <Text style={[styles.roomScanMeta, isDark && { color: '#94a3b8' }]} numberOfLines={2}>
                        {(room.scanMeta?.objects || cropScanMetaToRoom(scanMeta, room)?.objects || [])
                          .map((obj) => obj.label)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  {editable ? (
                    <Pressable
                      onPress={() => setEditingRoom(room)}
                      hitSlop={8}
                      style={styles.roomEditBtn}
                    >
                      <Ionicons name="create-outline" size={18} color="#0ea5e9" />
                    </Pressable>
                  ) : null}
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

      {hasPlan ? (
        <Modal
          visible={isOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#111214' : '#F2F2F7',
                paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8,
                paddingBottom: insets.bottom + 10,
              },
            ]}
          >
            <View style={styles.sheetGrabberWrap}>
              <View style={[styles.sheetGrabber, { backgroundColor: isDark ? '#3A3A3C' : '#C7C7CC' }]} />
            </View>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: isDark ? '#F5F5F7' : '#111827' }]} numberOfLines={1}>
                {selectedRoom?.name || t('offer.detail.floorPlan.studioTitle')}
              </Text>
              <Pressable
                onPress={closeModal}
                hitSlop={12}
                style={[styles.sheetClose, { backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}
              >
                <Ionicons name="close" size={18} color={isDark ? '#F5F5F7' : '#111827'} />
              </Pressable>
            </View>

              {roomScans.length > 0 ? (
                <View style={styles.modalChipRow}>
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

              <View style={styles.imageContainer}>
                <View
                  style={[
                    styles.planCard,
                    { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
                  ]}
                >
                  {hasVectorPlan && activeMeta ? (
                    <FloorPlanScanArtboard
                      walls={activeMeta.walls}
                      meta={activeMeta}
                      width={modalArtboardW}
                      height={modalArtboardH}
                      onSectionPress={
                        editable
                          ? (index) => {
                              if (planKey === 'whole') beginEditSection(index);
                              else if (selectedRoom) setEditingRoom(selectedRoom);
                            }
                          : undefined
                      }
                    />
                  ) : showMosaic ? (
                    <View style={{ width: modalArtboardW, height: modalArtboardH }}>
                      <RoomPlanMosaic rooms={mosaicRooms} isDark={isDark} onPick={(room) => setPlanKey(room.id)} />
                    </View>
                  ) : displayImageUrl ? (
                    <Image source={{ uri: displayImageUrl }} style={styles.fullImage} resizeMode="contain" />
                  ) : null}
                </View>
              </View>

              <View style={{ paddingHorizontal: 16 }}>
                <PlanSpecGrid specs={specs} isDark={isDark} />
              </View>

              {furniture.length > 0 ? (
                <View style={styles.modalFurniture}>
                  {furniture.map((obj) => (
                    <View key={obj.id} style={[styles.furnitureChip, isDark && { backgroundColor: '#1f2937' }]}>
                      <Text style={[styles.furnitureChipText, isDark && { color: '#e2e8f0' }]}>{obj.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

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
          </View>
        </Modal>
      ) : null}

      <RoomScanParamsSheet
        visible={Boolean(editingRoom)}
        room={editingRoom}
        isDark={isDark}
        canScan={canScan && Boolean(onChangeMeta)}
        onClose={() => setEditingRoom(null)}
        onSave={commitRoomDraft}
        onRescan={
          editingRoom && onChangeMeta
            ? () => {
                const room = editingRoom;
                setEditingRoom(null);
                setRescanRoom(room);
              }
            : undefined
        }
      />
      <RoomScanModal
        visible={Boolean(rescanRoom)}
        scanMode="room"
        roomName={rescanRoom?.name}
        onClose={() => setRescanRoom(null)}
        onComplete={applyRoomRescan}
      />
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
  mosaic: { flex: 1, padding: 3 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 4 },
  specCell: { minWidth: '30%', flexGrow: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  specLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  specValue: { fontSize: 15, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  mosaicRow: { flex: 1, flexDirection: 'row' },
  mosaicTile: { flex: 1, margin: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ffffff' },
  mosaicImage: { width: '100%', height: '100%' },
  mosaicLabel: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(21,23,26,0.82)',
  },
  mosaicName: { color: '#fff', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  mosaicArea: { color: '#c9a96e', fontSize: 10.5, fontWeight: '700' },
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
  roomScanImage: { width: 88, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  roomScanPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  roomScanName: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  roomScanMeta: { color: '#64748b', fontSize: 10.5, fontWeight: '600', marginTop: 3 },
  roomScan3dBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, alignSelf: 'flex-start' },
  roomScan3dText: { color: '#0ea5e9', fontSize: 11, fontWeight: '900' },
  roomEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  expandFab: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
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
  },
  sheetGrabberWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 8 },
  sheetGrabber: { width: 36, height: 5, borderRadius: 3 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetTitle: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginRight: 12 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: { flex: 1, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  planCard: {
    borderRadius: 22,
    overflow: 'hidden',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalFurniture: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
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
