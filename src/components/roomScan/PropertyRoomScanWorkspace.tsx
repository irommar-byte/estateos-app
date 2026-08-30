import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RoomScanModal, { isRoomScanSupportedOnDevice } from './RoomScanModal';
import FloorPlanFurnitureEditor from './FloorPlanFurnitureEditor';
import FloorPlanScanArtboard from './FloorPlanScanArtboard';
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
  applyRoomIdentityToScanMeta,
  listingRoomCountFromRooms,
  livableAreaFromRooms,
  ROOM_PRESET_DEFS,
  roomTypeKeyFromName,
} from '../../lib/roomScan/refineScanSections';
import { getRoomScanSectionLabel } from '../../lib/roomScan/roomScanLabels';

function numberValue(raw: string): number {
  const value = Number(String(raw || '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

type PlanRelabelJob = {
  id: number;
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
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
      <View ref={viewRef} collapsable={false} style={{ width: 720, height: 720, backgroundColor: '#f8fafc' }}>
        <FloorPlanScanArtboard
          ref={svgRef}
          walls={job.walls.length ? job.walls : job.meta.walls}
          meta={job.meta}
          width={720}
          height={720}
          forExport
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
  const [customRoomName, setCustomRoomName] = useState('');
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [showCoachmark, setShowCoachmark] = useState(Boolean(autoOpen));
  const coachmarkHandled = useRef(false);
  const scanAvailable = isRoomScanSupportedOnDevice();
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const wholeScanRef = useRef(wholeScan);
  wholeScanRef.current = wholeScan;
  const [relabelJob, setRelabelJob] = useState<PlanRelabelJob | null>(null);
  const relabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relabelSeqRef = useRef(0);

  const queuePlanPngRelabel = (
    meta: FloorPlanScanMeta | undefined,
    onCaptured: (uri: string) => void,
    delayMs = 380,
  ) => {
    if (!meta?.walls?.length) return;
    if (relabelTimerRef.current) clearTimeout(relabelTimerRef.current);
    relabelTimerRef.current = setTimeout(() => {
      relabelSeqRef.current += 1;
      setRelabelJob({
        id: relabelSeqRef.current,
        walls: meta.walls,
        meta,
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

  const addRoom = (scanImmediately = false) => {
    const name = (newRoomName === 'Inne' ? customRoomName : newRoomName).trim();
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

    if (!identityChanged || disabled) return;
    const changed = nextRooms.find((room) => room.id === id);
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
      queuePlanPngRelabel(nextWhole.scanMeta, (uri) => {
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
      });
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

  const removeRoom = (room: PropertyRoomScan) => {
    onChangeRooms(rooms.filter((item) => item.id !== room.id));
  };

  const replacePlanImage = (previous: string | undefined, next: string) => {
    if (!onChangePlanImages) return;
    const withoutPrevious = previous ? planImages.filter((uri) => uri !== previous) : planImages;
    if (!withoutPrevious.includes(next)) onChangePlanImages([...withoutPrevious, next]);
  };

  const roomsFromScanSections = (meta: RoomScanDraftAssets['scanMeta']): PropertyRoomScan[] => {
    const stamp = Date.now();
    const fmt = (value?: number | null, digits = 2) => (value && value > 0 ? value.toFixed(digits) : '');
    return (meta.sections || []).map((section, index) => {
      const area =
        section.areaSqM ??
        (section.widthM && section.lengthM ? section.widthM * section.lengthM : undefined);
      const typeKey = section.key || roomTypeKeyFromName(section.label);
      return {
        id: `room-${stamp}-${index}-${Math.round(Math.random() * 1000)}`,
        name: section.label || getRoomScanSectionLabel(typeKey) || `Pomieszczenie ${index + 1}`,
        typeKey,
        sourceSectionIndex: index,
        widthM: fmt(section.widthM),
        lengthM: fmt(section.lengthM),
        heightM: fmt(section.ceilingHeightM ?? meta.ceilingHeightM),
        areaM2: fmt(area, 1),
        scannedAt: meta.scannedAt,
      };
    });
  };

  const offerDetectedRooms = (meta: RoomScanDraftAssets['scanMeta']) => {
    const detected = roomsFromScanSections(meta);
    if (!detected.length) return;
    onChangeRooms(detected);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const applyScan = (assets: RoomScanDraftAssets) => {
    if (!activeScan) return;
    if (activeScan.mode === 'property') {
      replacePlanImage(wholeScan?.floorPlanPngUri, assets.floorPlanPngUri);
      onChangeWholeScan?.({
        ...assets,
        scannedAt: assets.scanMeta.scannedAt,
      });
      setActiveScan(null);
      offerDetectedRooms(assets.scanMeta);
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
            Osobny rzut 2D i model 3D każdego pomieszczenia oraz plan całej nieruchomości.
          </Text>
        </View>
      </View>

      {showCoachmark && !disabled ? (
        <View style={[styles.coachmark, { borderColor: `${palette.accent}55` }]}>
          <Ionicons name="information-circle-outline" size={21} color={palette.accent} />
          <Text style={[styles.coachmarkText, { color: palette.text }]}>
            Wybierz nazwę, dodaj pomieszczenie i uruchom skan z jego karty. Wymiary wpiszą się automatycznie.
          </Text>
          <Pressable onPress={() => setShowCoachmark(false)} hitSlop={10}>
            <Ionicons name="close" size={18} color={palette.secondary} />
          </Pressable>
        </View>
      ) : null}

      {!disabled ? (
        <View style={[styles.addCard, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Text style={[styles.label, { color: palette.secondary }]}>1. WYBIERZ POMIESZCZENIE</Text>
          <View style={styles.presets}>
            {ROOM_PRESET_DEFS.map((preset) => {
              const selected = newRoomName === preset.label;
              return (
                <Pressable
                  key={preset.key}
                  onPress={() => setNewRoomName(preset.label)}
                  style={[
                    styles.preset,
                    {
                      backgroundColor: selected ? palette.accent : palette.card,
                      borderColor: selected ? palette.accent : palette.border,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? '#fff' : palette.text, fontSize: 11, fontWeight: '800' }}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {newRoomName === 'Inne' ? (
            <TextInput
              value={customRoomName}
              onChangeText={setCustomRoomName}
              placeholder="Wpisz nazwę pomieszczenia"
              placeholderTextColor={palette.secondary}
              style={[styles.nameInput, { color: palette.text, backgroundColor: palette.input, borderColor: palette.border }]}
            />
          ) : null}
          <View style={styles.addActions}>
            <Pressable onPress={() => addRoom(false)} style={[styles.addSecondary, { borderColor: palette.border }]}>
              <Ionicons name="add" size={19} color={palette.text} />
              <Text style={{ color: palette.text, fontWeight: '800' }}>Dodaj do listy</Text>
            </Pressable>
            {scanAvailable ? (
              <Pressable onPress={() => addRoom(true)} style={[styles.addPrimary, { backgroundColor: palette.accent }]}>
                <Ionicons name="scan" size={19} color="#fff" />
                <Text style={styles.addPrimaryText}>Dodaj i skanuj</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={[styles.summaryPill, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Text style={[styles.summaryLabel, { color: palette.secondary }]}>POKOJE</Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>{listingRooms}</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Text style={[styles.summaryLabel, { color: palette.secondary }]}>POMIESZCZENIA</Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>{rooms.length}</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Text style={[styles.summaryLabel, { color: palette.secondary }]}>ZESKANOWANE</Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>{scannedRooms}/{rooms.length}</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Text style={[styles.summaryLabel, { color: palette.secondary }]}>SUMA</Text>
          <Text style={[styles.summaryValue, { color: palette.success }]}>{totalArea.toFixed(1)} m²</Text>
        </View>
      </View>

      <Text style={[styles.countHint, { color: palette.secondary }]}>
        Do liczby pokoi w ofercie liczą się salon, pokój, sypialnia, gabinet i jadalnia. Łazienka, WC, kuchnia, komórka i przedpokój pozostają na planie, ale nie jako pokoje.
      </Text>

      {rooms.map((room, index) => (
        <View key={room.id} style={[styles.roomCard, { backgroundColor: palette.elevated, borderColor: room.scanMeta ? `${palette.success}66` : palette.border }]}>
          <View style={styles.roomHeading}>
            <View style={[styles.roomNumber, { backgroundColor: room.scanMeta ? palette.success : palette.accent }]}>
              <Text style={styles.roomNumberText}>{index + 1}</Text>
            </View>
            <TextInput
              value={room.name}
              editable={!disabled}
              onChangeText={(name) => updateRoom(room.id, { name })}
              style={[styles.roomName, { color: palette.text }]}
            />
            {room.scanMeta ? (
              <View style={styles.readyBadge}>
                <Ionicons name="checkmark-circle" size={14} color={palette.success} />
                <Text style={[styles.readyText, { color: palette.success }]}>GOTOWE</Text>
              </View>
            ) : null}
            {!disabled ? (
              <Pressable onPress={() => removeRoom(room)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </Pressable>
            ) : null}
          </View>
          {!disabled ? (
            <View style={styles.presets}>
              {ROOM_PRESET_DEFS.map((preset) => {
                const selected = (room.typeKey || roomTypeKeyFromName(room.name)) === preset.key;
                return (
                  <Pressable
                    key={`${room.id}-${preset.key}`}
                    onPress={() => updateRoom(room.id, { name: preset.label, typeKey: preset.key })}
                    style={[
                      styles.preset,
                      {
                        backgroundColor: selected ? palette.accent : palette.card,
                        borderColor: selected ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? '#fff' : palette.text, fontSize: 10, fontWeight: '800' }}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

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

          {room.floorPlanPngUri ? (
            <View style={styles.roomPlanRow}>
              <Image source={{ uri: room.floorPlanPngUri }} style={styles.roomPlanThumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.planTitle, { color: palette.text }]}>Plan przypisany do: {room.name}</Text>
                <Text style={[styles.planSubtitle, { color: palette.secondary }]}>
                  {room.scanMeta?.openings?.length || 0} przejść, drzwi lub okien · wysokość {room.heightM || '—'} m
                  {room.scanMeta?.objects?.length ? ` · ${room.scanMeta.objects.length} mebli / AGD` : ''}
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
          ) : null}

          {scanAvailable && !disabled ? (
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
            <Image source={{ uri: wholeScan.floorPlanPngUri }} style={styles.wholeImage} contentFit="contain" />
            <View style={styles.wholeStats}>
              <Text style={[styles.wholeMetric, { color: palette.text }]}>{wholeScan.scanMeta.roomCount} pom.</Text>
              <Text style={[styles.wholeMetric, { color: palette.success }]}>
                {wholeScan.scanMeta.totalAreaSqM?.toFixed(1) || '—'} m²
              </Text>
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
                }, 220);
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
  roomPlanThumb: { width: 82, height: 68, borderRadius: 10, backgroundColor: '#e2e8f0' },
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
  wholeImage: { width: '100%', height: 190, borderRadius: 14, backgroundColor: '#fff' },
  wholeStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  wholeMetric: { fontSize: 12, fontWeight: '900' },
  scanWholeBtn: { minHeight: 50, borderRadius: 15, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  scanWholeText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  unsupported: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12 },
});
