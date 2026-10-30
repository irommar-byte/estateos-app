import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RoomScanModal, { isRoomScanSupportedOnDevice } from './RoomScanModal';
import FloorPlanFurnitureEditor from './FloorPlanFurnitureEditor';
import FloorPlanScanArtboard from './FloorPlanScanArtboard';
import RoomPlanPreviewModal, { type RoomPlanPreviewData } from './RoomPlanPreviewModal';
import { captureArtboardToPng } from '../../lib/roomScan/captureArtboard';
import { measurementsFromScanMeta } from '../../lib/roomScan/roomScanMeasurements';
import { getSafeQuickLook } from '../../utils/safeQuickLook';
import type {
  FloorPlanScanMeta,
  PropertyRoomScan,
  RoomScanDraftAssets,
  RoomScanWallSegment,
  WholePropertyScan,
} from '../../types/roomScan';
import {
  applyRoomDraftToScanMeta,
  applyRoomIdentityToScanMeta,
  cropScanMetaToRoom,
  listingRoomCountFromRooms,
  livableAreaFromRooms,
  ROOM_PRESET_DEFS,
  roomsFromScanMeta,
  roomTypeKeyFromName,
} from '../../lib/roomScan/refineScanSections';

function numberValue(raw: string): number {
  const value = Number(String(raw || '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

type PlanRelabelJob = {
  id: number;
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  hideDimensions?: boolean;
  onCaptured: (uri: string) => void;
};

function HiddenPlanRelabelCapture({ job }: { job: PlanRelabelJob | null }) {
  const svgRef = useRef(null);
  const viewRef = useRef<View>(null);
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    const current = jobRef.current;
    if (!current) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const uri = await captureArtboardToPng(svgRef, viewRef);
          if (!cancelled && uri) current.onCaptured(uri);
        } catch {
          /* zostaw poprzedni PNG */
        }
      })();
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job?.id]);

  if (!job) return null;
  return (
    <View
      style={{ position: 'absolute', left: -4200, top: 0, width: 720, height: 720 }}
      pointerEvents="none"
      collapsable={false}
    >
      <View ref={viewRef} collapsable={false} style={{ width: 720, height: 720, backgroundColor: '#ffffff' }}>
        <FloorPlanScanArtboard
          ref={svgRef}
          walls={job.walls.length ? job.walls : job.meta.walls}
          meta={job.meta}
          width={720}
          height={720}
          forExport
          hideDimensions={Boolean(job.hideDimensions)}
        />
      </View>
    </View>
  );
}

type Props = {
  rooms: PropertyRoomScan[];
  onChangeRooms: (rooms: PropertyRoomScan[]) => void;
  wholeScan?: WholePropertyScan | null;
  onChangeWholeScan?: (scan: WholePropertyScan | null) => void;
  planImages?: string[];
  onChangePlanImages?: (images: string[]) => void;
  isDark?: boolean;
  disabled?: boolean;
  autoOpen?: boolean;
};

type ActiveScan = { mode: 'room'; roomId: string } | { mode: 'property' };

/** Ikony kafelków typów pomieszczeń. */
const ROOM_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  livingRoom: 'tv-outline',
  livingRoomKitchenette: 'restaurant-outline',
  room: 'square-outline',
  bedroom: 'bed-outline',
  kitchen: 'flame-outline',
  diningRoom: 'cafe-outline',
  bathroom: 'water-outline',
  wc: 'water-outline',
  hallway: 'walk-outline',
  office: 'desktop-outline',
  closet: 'shirt-outline',
  storageUnit: 'cube-outline',
  balcony: 'sunny-outline',
  garage: 'car-outline',
  laundry: 'sync-outline',
  unspecified: 'ellipsis-horizontal',
};

export default function PropertyRoomScanWorkspace({
  rooms,
  onChangeRooms,
  wholeScan,
  onChangeWholeScan,
  planImages = [],
  onChangePlanImages,
  isDark,
  disabled,
  autoOpen,
}: Props) {
  const [newRoomName, setNewRoomName] = useState('Salon');
  const [wholePreviewW, setWholePreviewW] = useState(0);
  const [customRoomName, setCustomRoomName] = useState('');
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [showCoachmark, setShowCoachmark] = useState(Boolean(autoOpen));
  /** Okienko wyboru typu: nowe pomieszczenie (null) albo zmiana typu istniejącego (id). */
  const [typePicker, setTypePicker] = useState<{ roomId: string | null; scan: boolean } | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const coachmarkHandled = useRef(false);
  const scanAvailable = isRoomScanSupportedOnDevice();
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const wholeScanRef = useRef(wholeScan);
  wholeScanRef.current = wholeScan;
  const [relabelJob, setRelabelJob] = useState<PlanRelabelJob | null>(null);
  const [roomPlanPreview, setRoomPlanPreview] = useState<RoomPlanPreviewData | null>(null);
  const relabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relabelSeqRef = useRef(0);

  const queuePlanPngRelabel = (
    meta: FloorPlanScanMeta | undefined,
    onCaptured: (uri: string) => void,
    delayMs = 380,
    hideDimensions = false,
  ) => {
    if (!meta?.walls?.length) return;
    if (relabelTimerRef.current) clearTimeout(relabelTimerRef.current);
    relabelTimerRef.current = setTimeout(() => {
      relabelSeqRef.current += 1;
      setRelabelJob({
        id: relabelSeqRef.current,
        walls: meta.walls,
        meta,
        hideDimensions,
        onCaptured,
      });
    }, delayMs);
  };

  useEffect(() => {
    if (!autoOpen || coachmarkHandled.current) return;
    coachmarkHandled.current = true;
    setShowCoachmark(true);
  }, [autoOpen]);

  useEffect(
    () => () => {
      if (relabelTimerRef.current) clearTimeout(relabelTimerRef.current);
    },
    [],
  );

  const palette = {
    card: isDark ? '#1c1c1e' : '#ffffff',
    elevated: isDark ? '#242427' : '#f8fafc',
    input: isDark ? '#2c2c2e' : '#f1f5f9',
    text: isDark ? '#ffffff' : '#0f172a',
    secondary: isDark ? '#a1a1aa' : '#64748b',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
    accent: '#0ea5e9',
    success: '#22c55e',
  };

  const listingRooms = listingRoomCountFromRooms(rooms);
  const totalArea = useMemo(
    () => livableAreaFromRooms(rooms),
    [rooms],
  );
  const scannedRooms = rooms.filter((room) => room.scanMeta).length;

  const addRoom = (scanImmediately = false, presetName?: string) => {
    const name = (presetName || (newRoomName === 'Inne' ? customRoomName : newRoomName)).trim();
    if (!name) return;
    const room: PropertyRoomScan = {
      id: `room-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      name,
      typeKey: roomTypeKeyFromName(name),
      widthM: '',
      lengthM: '',
      heightM: '',
      areaM2: '',
    };
    onChangeRooms([...rooms, room]);
    setShowCoachmark(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (scanImmediately && scanAvailable) {
      setActiveScan({ mode: 'room', roomId: room.id });
    }
  };

  const updateRoom = (id: string, patch: Partial<PropertyRoomScan>, recalculate = false) => {
    const identityChanged = patch.name !== undefined || patch.typeKey !== undefined;
    const nextRooms = rooms.map((room) => {
      if (room.id !== id) return room;
      const next = { ...room, ...patch };
      if (recalculate) {
        const width = numberValue(next.widthM);
        const length = numberValue(next.lengthM);
        next.areaM2 = width && length ? (width * length).toFixed(1) : next.areaM2;
      }
      if (patch.name && !patch.typeKey) {
        next.typeKey = roomTypeKeyFromName(next.name);
      }
      if (identityChanged && next.scanMeta) {
        const patched = applyRoomIdentityToScanMeta(next.scanMeta, {
          sectionIndex: next.scanMeta.sections?.length === 1 ? 0 : next.sourceSectionIndex ?? 0,
          name: next.name,
          typeKey: next.typeKey,
        });
        if (patched) next.scanMeta = patched;
      }
      return next;
    });
    onChangeRooms(nextRooms);

    const changed = nextRooms.find((room) => room.id === id);
    if (changed && wholeScan && onChangeWholeScan && !disabled && !identityChanged) {
      onChangeWholeScan({
        ...wholeScan,
        scanMeta: applyRoomDraftToScanMeta(wholeScan.scanMeta, changed),
      });
    }

    if (!identityChanged || disabled) return;
    if (!changed) return;

    let nextWhole = wholeScan || null;
    if (nextWhole && onChangeWholeScan) {
      const sectionIndex =
        typeof changed.sourceSectionIndex === 'number'
          ? changed.sourceSectionIndex
          : nextWhole.scanMeta.sections?.length === nextRooms.length
            ? nextRooms.findIndex((room) => room.id === id)
            : nextWhole.scanMeta.sections?.length === 1
              ? 0
              : null;
      const patchedMeta = applyRoomIdentityToScanMeta(nextWhole.scanMeta, {
        sectionIndex,
        name: changed.name,
        typeKey: changed.typeKey,
      });
      if (patchedMeta) {
        nextWhole = { ...nextWhole, scanMeta: { ...patchedMeta, roomScans: nextRooms } };
        onChangeWholeScan(nextWhole);
      }
    }

    if (nextWhole?.scanMeta) {
      queuePlanPngRelabel(
        nextWhole.scanMeta,
        (uri) => {
        const latest = wholeScanRef.current;
        if (!latest || !onChangeWholeScan) return;
        onChangeWholeScan({
          ...latest,
          floorPlanPngUri: uri,
          scanMeta: { ...latest.scanMeta, roomScans: roomsRef.current },
        });
        const roomNow = roomsRef.current.find((item) => item.id === id);
        if (roomNow?.scanMeta?.walls?.length) {
          queuePlanPngRelabel(
            roomNow.scanMeta,
            (roomUri) => {
              onChangeRooms(
                roomsRef.current.map((item) =>
                  item.id === id ? { ...item, floorPlanPngUri: roomUri } : item,
                ),
              );
            },
            80,
          );
        }
      },
        380,
        true,
      );
    } else if (changed.scanMeta) {
      queuePlanPngRelabel(changed.scanMeta, (uri) => {
        onChangeRooms(
          roomsRef.current.map((room) =>
            room.id === id ? { ...room, floorPlanPngUri: uri } : room,
          ),
        );
      });
    }
  };

  const openRoomMenu = (room: PropertyRoomScan) => {
    const actions: Array<{ label: string; run: () => void; destructive?: boolean }> = [
      { label: 'Zmień typ', run: () => setTypePicker({ roomId: room.id, scan: false }) },
      { label: 'Popraw wymiary', run: () => setEditingRoomId(editingRoomId === room.id ? null : room.id) },
      ...(scanAvailable ? [{ label: room.scanMeta ? 'Skanuj ponownie' : 'Skanuj', run: () => setActiveScan({ mode: 'room', roomId: room.id }) }] : []),
      {
        label: 'Usuń',
        destructive: true,
        run: () =>
          Alert.alert(`Usunąć: ${room.name}?`, 'Skan i wymiary tego pomieszczenia znikną z oferty.', [
            { text: 'Anuluj', style: 'cancel' },
            { text: 'Usuń', style: 'destructive', onPress: () => removeRoom(room) },
          ]),
      },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: room.name, options: [...actions.map((a) => a.label), 'Anuluj'], cancelButtonIndex: actions.length, destructiveButtonIndex: actions.findIndex((a) => a.destructive) },
        (index) => actions[index]?.run(),
      );
    } else {
      Alert.alert(room.name, undefined, [...actions.map((a) => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: a.run })), { text: 'Anuluj', style: 'cancel' as const }]);
    }
  };

  const removeRoom = (room: PropertyRoomScan) => {
    onChangeRooms(rooms.filter((item) => item.id !== room.id));
  };

  const replacePlanImage = (previous: string | undefined, next: string) => {
    if (!onChangePlanImages) return;
    const withoutPrevious = previous ? planImages.filter((uri) => uri !== previous) : planImages;
    if (!withoutPrevious.includes(next)) onChangePlanImages([...withoutPrevious, next]);
  };

  /** Po skanie całej nieruchomości odtwarzamy karty pomieszczeń z sekcji RoomPlan. */
  const materializeRoomsFromWholeScan = (meta: FloorPlanScanMeta): PropertyRoomScan[] => {
    const stamp = Date.now();
    return roomsFromScanMeta(meta).map((room, index) => ({
      ...room,
      id: `room-${stamp}-${index}-${Math.round(Math.random() * 1000)}`,
      scannedAt: meta.scannedAt || room.scannedAt,
    }));
  };

  // Jeśli plan całości ma sekcje, a lista kart jest pusta (regresja / stary draft) — uzupełnij raz.
  useEffect(() => {
    if (disabled) return;
    if (!wholeScan?.scanMeta?.sections?.length) return;
    if (rooms.length > 0) return;
    const detected = materializeRoomsFromWholeScan(wholeScan.scanMeta);
    if (!detected.length) return;
    onChangeRooms(detected);
    if (!Array.isArray(wholeScan.scanMeta.roomScans) || wholeScan.scanMeta.roomScans.length === 0) {
      onChangeWholeScan?.({
        ...wholeScan,
        scanMeta: {
          ...wholeScan.scanMeta,
          roomScans: detected,
          roomCount: listingRoomCountFromRooms(detected) || wholeScan.scanMeta.roomCount,
          roomAreaTotalSqM: livableAreaFromRooms(detected) || wholeScan.scanMeta.roomAreaTotalSqM,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate when rooms empty
  }, [disabled, wholeScan?.scanMeta?.sections?.length, rooms.length]);

  const applyScan = (assets: RoomScanDraftAssets) => {
    if (!activeScan) return;
    if (activeScan.mode === 'property') {
      const detected = materializeRoomsFromWholeScan(assets.scanMeta);
      const nextMeta: FloorPlanScanMeta = {
        ...assets.scanMeta,
        roomScans: detected.length ? detected : assets.scanMeta.roomScans,
        roomCount: listingRoomCountFromRooms(detected) || assets.scanMeta.roomCount,
        roomAreaTotalSqM: livableAreaFromRooms(detected) || assets.scanMeta.roomAreaTotalSqM,
      };
      replacePlanImage(wholeScan?.floorPlanPngUri, assets.floorPlanPngUri);
      onChangeWholeScan?.({
        ...assets,
        scanMeta: nextMeta,
        scannedAt: assets.scanMeta.scannedAt,
      });
      if (detected.length) {
        onChangeRooms(detected);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setActiveScan(null);
      queuePlanPngRelabel(
        nextMeta,
        (uri) => {
          const latest = wholeScanRef.current;
          if (!latest || !onChangeWholeScan) return;
          onChangeWholeScan({ ...latest, floorPlanPngUri: uri });
        },
        80,
        true,
      );
      return;
    }

    const room = rooms.find((item) => item.id === activeScan.roomId);
    if (!room) {
      setActiveScan(null);
      return;
    }
    const measured = measurementsFromScanMeta(assets.scanMeta);
    updateRoom(room.id, {
      widthM: measured.widthM || room.widthM,
      lengthM: measured.lengthM || room.lengthM,
      heightM: measured.heightM || room.heightM,
      areaM2: measured.areaM2 || room.areaM2,
      floorPlanPngUri: assets.floorPlanPngUri,
      floorPlan3dUri: assets.floorPlan3dUri,
      scanMeta: assets.scanMeta,
      scannedAt: assets.scanMeta.scannedAt,
    });
    setActiveScan(null);
  };

  const applyMeasurements = (meta: RoomScanDraftAssets['scanMeta']) => {
    if (!activeScan || activeScan.mode !== 'room') return;
    const room = rooms.find((item) => item.id === activeScan.roomId);
    if (!room) return;
    const measured = measurementsFromScanMeta(meta);
    updateRoom(room.id, {
      widthM: measured.widthM || room.widthM,
      lengthM: measured.lengthM || room.lengthM,
      heightM: measured.heightM || room.heightM,
      areaM2: measured.areaM2 || room.areaM2,
      scanMeta: meta,
      scannedAt: meta.scannedAt,
    });
  };

  const open3d = async (uri?: string) => {
    if (!uri) return;
    const quickLook = getSafeQuickLook();
    if (!quickLook) {
      Alert.alert('Podgląd 3D', 'Podgląd modelu 3D jest dostępny na obsługiwanym urządzeniu Apple.');
      return;
    }
    try {
      await quickLook.previewFile({ uri: uri.startsWith('file://') || uri.startsWith('http') ? uri : `file://${uri}` });
    } catch {
      Alert.alert('Podgląd 3D', 'Nie udało się otworzyć zapisanego modelu pomieszczenia.');
    }
  };

  const activeRoom =
    activeScan?.mode === 'room' ? rooms.find((room) => room.id === activeScan.roomId) : null;

  return (
    <View style={[styles.root, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: isDark ? '#082f49' : '#e0f2fe' }]}>
          <Ionicons name="scan-outline" size={22} color={palette.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Studio pomiarowe LiDAR</Text>
          <Text style={[styles.subtitle, { color: palette.secondary }]}>
            Plan 2D i model 3D każdego pomieszczenia.
          </Text>
        </View>
      </View>

      {showCoachmark && !disabled ? (
        <View style={[styles.coachmark, { borderColor: `${palette.accent}55` }]}>
          <Ionicons name="information-circle-outline" size={21} color={palette.accent} />
          <Text style={[styles.coachmarkText, { color: palette.text }]}>
            Dotknij „Skanuj pomieszczenie”, wybierz typ i obejdź pokój z telefonem. Wymiary wpiszą się same.
          </Text>
          <Pressable onPress={() => setShowCoachmark(false)} hitSlop={10}>
            <Ionicons name="close" size={18} color={palette.secondary} />
          </Pressable>
        </View>
      ) : null}

      {!disabled ? (
        <View style={styles.addActions}>
          <Pressable onPress={() => setTypePicker({ roomId: null, scan: scanAvailable })} style={[styles.addPrimary, { backgroundColor: palette.accent }]}>
            <Ionicons name={scanAvailable ? 'scan' : 'add'} size={19} color="#fff" />
            <Text style={styles.addPrimaryText}>{scanAvailable ? 'Skanuj pomieszczenie' : 'Dodaj pomieszczenie'}</Text>
          </Pressable>
          {scanAvailable ? (
            <Pressable onPress={() => setTypePicker({ roomId: null, scan: false })} style={[styles.addSecondary, { borderColor: palette.border }]}>
              <Ionicons name="add" size={19} color={palette.text} />
              <Text style={{ color: palette.text, fontWeight: '700' }}>Bez skanu</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {rooms.length ? (
        <Text style={[styles.countHint, { color: palette.secondary }]}>
          {[
            listingRooms ? `${listingRooms} ${listingRooms === 1 ? 'pokój' : listingRooms < 5 ? 'pokoje' : 'pokoi'}` : null,
            `${rooms.length} ${rooms.length === 1 ? 'pomieszczenie' : rooms.length < 5 ? 'pomieszczenia' : 'pomieszczeń'}`,
            totalArea ? `${totalArea.toFixed(1).replace('.', ',')} m²` : null,
            `zeskanowane ${scannedRooms}/${rooms.length}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}

      <Modal visible={Boolean(typePicker)} transparent animationType="slide" onRequestClose={() => setTypePicker(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTypePicker(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: palette.card }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: palette.border }]} />
            <Text style={[styles.title, { color: palette.text, marginBottom: 12 }]}>{typePicker?.roomId ? 'Zmień typ' : 'Jakie to pomieszczenie?'}</Text>
            <View style={styles.tileGrid}>
              {ROOM_PRESET_DEFS.map((preset) => (
                <Pressable
                  key={preset.key}
                  onPress={() => {
                    const picker = typePicker;
                    setTypePicker(null);
                    if (!picker) return;
                    if (picker.roomId) updateRoom(picker.roomId, { name: preset.label, typeKey: preset.key });
                    else addRoom(picker.scan, preset.label);
                  }}
                  style={({ pressed }) => [styles.tile, { backgroundColor: palette.elevated, borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name={ROOM_ICON[preset.key] || 'square-outline'} size={22} color={palette.accent} />
                  <Text style={[styles.tileText, { color: palette.text }]} numberOfLines={2}>
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {rooms.map((room, index) => (
        <View key={room.id} style={[styles.roomCard, { backgroundColor: palette.elevated, borderColor: room.scanMeta ? `${palette.success}66` : palette.border }]}>
          <View style={styles.roomHeading}>
            <View style={[styles.roomNumber, { backgroundColor: room.scanMeta ? palette.success : palette.accent }]}>
              <Text style={styles.roomNumberText}>{index + 1}</Text>
            </View>
            <Text style={[styles.roomName, { color: palette.text }]} numberOfLines={1}>
              {room.name}
            </Text>
            {room.scanMeta ? (
              <View style={styles.readyBadge}>
                <Ionicons name="checkmark-circle" size={14} color={palette.success} />
                <Text style={[styles.readyText, { color: palette.success }]}>GOTOWE</Text>
              </View>
            ) : null}
            {!disabled ? (
              <Pressable onPress={() => openRoomMenu(room)} hitSlop={10}>
                <Ionicons name="ellipsis-horizontal-circle" size={22} color={palette.secondary} />
              </Pressable>
            ) : null}
          </View>
          {editingRoomId === room.id ? (
          <View style={styles.measureGrid}>
            {([
              ['widthM', 'SZEROKOŚĆ', 'm'],
              ['lengthM', 'DŁUGOŚĆ', 'm'],
              ['heightM', 'WYSOKOŚĆ', 'm'],
              ['areaM2', 'POWIERZCHNIA', 'm²'],
            ] as const).map(([key, label, unit]) => (
              <View key={key} style={styles.measureField}>
                <Text style={[styles.measureLabel, { color: palette.secondary }]}>{label}</Text>
                <View style={[styles.measureInputWrap, { backgroundColor: palette.input, borderColor: palette.border }]}>
                  <TextInput
                    value={room[key]}
                    editable={!disabled}
                    onChangeText={(value) => updateRoom(room.id, { [key]: value }, key === 'widthM' || key === 'lengthM')}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={palette.secondary}
                    style={[styles.measureInput, { color: palette.text }]}
                  />
                  <Text style={[styles.measureUnit, { color: palette.secondary }]}>{unit}</Text>
                </View>
              </View>
            ))}
          </View>
          ) : (
            <Pressable disabled={disabled} onPress={() => setEditingRoomId(room.id)}>
              <Text style={[styles.planSubtitle, { color: room.areaM2 ? palette.text : palette.secondary, fontSize: 14 }]}>
                {room.areaM2
                  ? [room.widthM && room.lengthM ? `${room.widthM} × ${room.lengthM} m` : null, `${room.areaM2} m²`, room.heightM ? `wys. ${room.heightM} m` : null].filter(Boolean).join(' · ')
                  : 'Wymiary uzupełnią się po skanie — albo dotknij, żeby wpisać'}
              </Text>
            </Pressable>
          )}

          {(() => {
            const cropped = cropScanMetaToRoom(wholeScan?.scanMeta, room);
            const previewMeta = cropped || (room.scanMeta?.walls?.length ? room.scanMeta : null);
            if (!previewMeta?.walls?.length && !room.floorPlanPngUri) return null;
            const openPreview = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setRoomPlanPreview({
                title: room.name,
                subtitle: `${(previewMeta?.openings || room.scanMeta?.openings)?.length || 0} przejść, drzwi lub okien · ${(previewMeta?.objects || room.scanMeta?.objects)?.length || 0} mebli / AGD`,
                meta: previewMeta,
                imageUri: room.floorPlanPngUri,
                model3dUri: room.floorPlan3dUri,
                widthM: room.widthM,
                lengthM: room.lengthM,
                heightM: room.heightM,
                areaM2: room.areaM2,
              });
            };
            return (
          <View style={styles.roomPlanRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Otwórz podgląd skanu: ${room.name}`}
              onPress={openPreview}
              style={({ pressed }) => [
                styles.roomPlanThumbButton,
                { borderColor: palette.border, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              {room.floorPlanPngUri ? (
                <Image source={{ uri: room.floorPlanPngUri }} style={styles.roomPlanThumb} contentFit="contain" />
              ) : previewMeta?.walls?.length ? (
                <FloorPlanScanArtboard
                  walls={previewMeta.walls}
                  meta={previewMeta}
                  width={118}
                  height={94}
                  compact
                />
              ) : null}
              <View style={styles.expandBadge}>
                <Ionicons name="expand-outline" size={12} color="#0f172a" />
              </View>
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.planSubtitle, { color: palette.secondary }]}>
                {(previewMeta?.openings || room.scanMeta?.openings)?.length || 0} przejść, drzwi lub okien · wysokość {room.heightM || '—'} m
                {(previewMeta?.objects || room.scanMeta?.objects)?.length
                  ? ` · ${(previewMeta?.objects || room.scanMeta?.objects || []).length} mebli / AGD`
                  : ''}
              </Text>
              {(room.scanMeta?.objects || []).length > 0 || room.scanMeta ? (
                room.scanMeta ? (
                  <FloorPlanFurnitureEditor
                    meta={room.scanMeta}
                    onChange={(next) => updateRoom(room.id, { scanMeta: next })}
                    textColor={palette.text}
                    secondaryColor={palette.secondary}
                    borderColor={palette.border}
                    accent={palette.accent}
                    disabled={disabled}
                  />
                ) : null
              ) : null}
              {room.floorPlan3dUri ? (
                <Pressable onPress={() => void open3d(room.floorPlan3dUri)} style={styles.inline3d}>
                  <Ionicons name="cube-outline" size={16} color={palette.accent} />
                  <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '800' }}>Otwórz model 3D</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
            );
          })()}

          {scanAvailable && !disabled && !room.scanMeta ? (
            <Pressable
              onPress={() => setActiveScan({ mode: 'room', roomId: room.id })}
              style={[styles.scanRoomBtn, { borderColor: `${palette.accent}66`, backgroundColor: isDark ? '#082f49' : '#e0f2fe' }]}
            >
              <Ionicons name={room.scanMeta ? 'refresh' : 'scan'} size={19} color={palette.accent} />
              <Text style={{ color: palette.accent, fontWeight: '900' }}>
                {room.scanMeta ? `Skanuj ponownie: ${room.name}` : `Skanuj: ${room.name}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={[styles.wholeCard, { backgroundColor: isDark ? '#061a2b' : '#eff6ff', borderColor: `${palette.accent}55` }]}>
        <View style={styles.wholeHeader}>
          <View style={[styles.wholeIcon, { backgroundColor: palette.accent }]}>
            <Ionicons name="map-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.wholeTitle, { color: palette.text }]}>Plan całej nieruchomości</Text>
            <Text style={[styles.wholeSubtitle, { color: palette.secondary }]}>
              Przejdź kolejno przez wszystkie pomieszczenia. Zapisz każde przyciskiem „następny”, a na końcu zakończ skan.
            </Text>
          </View>
        </View>

        {wholeScan ? (
          <View style={styles.wholePreview}>
            <Pressable
              onLayout={(e) => setWholePreviewW(Math.round(e.nativeEvent.layout.width))}
              accessibilityRole="button"
              accessibilityLabel="Otwórz podgląd planu całej nieruchomości"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRoomPlanPreview({
                  title: 'Plan całej nieruchomości',
                  subtitle: 'Ogólny rzut LiDAR bez wymiarów — pomieszczenia dodajesz osobno.',
                  meta: wholeScan.scanMeta,
                  imageUri: wholeScan.floorPlanPngUri,
                  model3dUri: wholeScan.floorPlan3dUri,
                  hideDimensions: true,
                });
              }}
              style={({ pressed }) => [styles.wholeImageButton, { opacity: pressed ? 0.78 : 1 }]}
            >
              {wholeScan.scanMeta?.walls?.length ? (
                <FloorPlanScanArtboard
                  walls={wholeScan.scanMeta.walls}
                  meta={wholeScan.scanMeta}
                  width={wholePreviewW || 280}
                  height={260}
                  hideDimensions
                />
              ) : (
                <Image source={{ uri: wholeScan.floorPlanPngUri }} style={styles.wholeImage} contentFit="contain" />
              )}
              <View style={styles.wholeExpandBadge}>
                <Ionicons name="expand-outline" size={15} color="#0f172a" />
                <Text style={styles.wholeExpandText}>Podgląd</Text>
              </View>
            </Pressable>
            <View style={styles.wholeStats}>
              <Pressable onPress={() => void open3d(wholeScan.floorPlan3dUri)} style={styles.inline3d}>
                <Ionicons name="cube-outline" size={16} color={palette.accent} />
                <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '800' }}>Całość 3D</Text>
              </Pressable>
            </View>
            <FloorPlanFurnitureEditor
              meta={wholeScan.scanMeta}
              onChange={(next) => {
                const updated = { ...wholeScan, scanMeta: next };
                onChangeWholeScan?.(updated);
                queuePlanPngRelabel(next, (uri) => {
                  const latest = wholeScanRef.current;
                  if (!latest || !onChangeWholeScan) return;
                  onChangeWholeScan({
                    ...latest,
                    floorPlanPngUri: uri,
                    scanMeta: { ...next, roomScans: roomsRef.current },
                  });
                }, 220, true);
              }}
              textColor={palette.text}
              secondaryColor={palette.secondary}
              borderColor={palette.border}
              accent={palette.accent}
              disabled={disabled}
            />
          </View>
        ) : null}

        {scanAvailable && !disabled ? (
          <Pressable onPress={() => setActiveScan({ mode: 'property' })} style={[styles.scanWholeBtn, { backgroundColor: palette.accent }]}>
            <Ionicons name={wholeScan ? 'refresh' : 'scan'} size={21} color="#fff" />
            <Text style={styles.scanWholeText}>{wholeScan ? 'Skanuj całość ponownie' : 'Skanuj całą nieruchomość'}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.unsupported, { color: palette.secondary }]}>
            Skan LiDAR wymaga zgodnego iPhone’a lub iPada Pro. Wymiary możesz wpisać ręcznie.
          </Text>
        )}
      </View>

      <RoomScanModal
        key={
          activeScan
            ? `${activeScan.mode}-${activeScan.mode === 'room' ? activeScan.roomId : 'property'}`
            : 'idle'
        }
        visible={Boolean(activeScan)}
        scanMode={activeScan?.mode || 'room'}
        roomName={activeRoom?.name}
        onClose={() => setActiveScan(null)}
        onComplete={applyScan}
        onMeasurements={applyMeasurements}
      />
      <RoomPlanPreviewModal
        preview={roomPlanPreview}
        isDark={isDark}
        onClose={() => setRoomPlanPreview(null)}
        onOpen3d={(uri) => void open3d(uri)}
      />
      <HiddenPlanRelabelCapture job={relabelJob} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: 20, borderWidth: 1, padding: 14, marginVertical: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  coachmark: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  coachmarkText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  addCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 12 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9, marginBottom: 8 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1 },
  nameInput: { height: 42, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, marginTop: 9, fontWeight: '700' },
  addActions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  addSecondary: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  addPrimary: { flex: 1.25, minHeight: 44, borderRadius: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  addPrimaryText: { color: '#fff', fontWeight: '900' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 14 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', minHeight: 78, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
  tileText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  countHint: { fontSize: 10, lineHeight: 14, fontWeight: '600', marginBottom: 10 },
  summaryPill: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 9, alignItems: 'center' },
  summaryLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  summaryValue: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  roomCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  roomHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  roomNumber: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  roomNumberText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  roomName: { flex: 1, fontSize: 14, fontWeight: '900', paddingVertical: 5 },
  readyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  readyText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  measureField: { width: '48%', flexGrow: 1 },
  measureLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  measureInputWrap: { height: 40, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 },
  measureInput: { flex: 1, fontSize: 13, fontWeight: '800', paddingVertical: 0 },
  measureUnit: { fontSize: 10, fontWeight: '800' },
  roomPlanRow: { flexDirection: 'row', gap: 10, marginTop: 11, alignItems: 'center' },
  roomPlanThumbButton: {
    width: 118,
    height: 94,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  roomPlanThumb: { width: '100%', height: '100%', backgroundColor: '#ffffff' },
  expandBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
  },
  planTitle: { fontSize: 11, fontWeight: '900' },
  planSubtitle: { fontSize: 10, lineHeight: 14 },
  furnitureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  furnitureChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  furnitureChipText: { fontSize: 10, fontWeight: '700' },
  inline3d: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 3 },
  scanRoomBtn: { minHeight: 43, borderRadius: 12, borderWidth: 1, marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wholeCard: { borderRadius: 18, borderWidth: 1, padding: 13, marginTop: 3 },
  wholeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wholeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  wholeTitle: { fontSize: 15, fontWeight: '900' },
  wholeSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  wholePreview: { marginTop: 12 },
  wholeImageButton: { width: '100%', height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  wholeImage: { width: '100%', height: '100%', backgroundColor: '#fff' },
  wholeExpandBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  wholeExpandText: { color: '#0f172a', fontSize: 10, fontWeight: '900' },
  wholeStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  wholeMetric: { fontSize: 12, fontWeight: '900' },
  scanWholeBtn: { minHeight: 50, borderRadius: 15, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  scanWholeText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  unsupported: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12 },
});
