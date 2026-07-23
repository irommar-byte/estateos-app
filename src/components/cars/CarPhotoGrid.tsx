import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
  Animated,
  PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import {
  OFFER_MEDIA_MAX_IMAGES,
  OFFER_MEDIA_UPLOAD_CAP_MB,
  canAcceptDraftImage,
  estimateBytesForDraftImage,
  formatMediaCapacityAlert,
  pruneImageByteSizes,
  sumEstimatedUploadBytes,
} from '../../utils/offerMediaCapacity';
import { useCarScreenColors, type CarScreenColors } from '../../theme/carScreenTheme';

const COLUMNS = 3;
const GRID_GAP = 10;

type CarPhotoGridProps = {
  images: string[];
  imageByteSizes: Record<string, number>;
  onChange: (images: string[], imageByteSizes: Record<string, number>) => void;
  onDraggingChange?: (dragging: boolean) => void;
  labels?: {
    title?: string;
    lead?: string;
    photosLabel?: string;
    photosSuffix?: string;
    sizeLabel?: string;
    sizeSuffix?: string;
    coverBadge?: string;
    addLabel?: string;
    limitTitle?: string;
    limitBody?: string;
    permissionTitle?: string;
    permissionBody?: string;
    permissionCancel?: string;
    permissionSettings?: string;
    storageTitle?: string;
  };
};

async function ensureMediaLibraryPermission(copy: {
  permissionTitle: string;
  permissionBody: string;
  permissionCancel: string;
  permissionSettings: string;
}): Promise<boolean> {
  const read = await ImagePicker.getMediaLibraryPermissionsAsync();
  const hasAccess =
    read.granted || read.accessPrivileges === 'all' || read.accessPrivileges === 'limited';
  if (hasAccess) return true;
  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const ok =
    requested.granted ||
    requested.accessPrivileges === 'all' ||
    requested.accessPrivileges === 'limited';
  if (!ok) {
    Alert.alert(copy.permissionTitle, copy.permissionBody, [
      { text: copy.permissionCancel, style: 'cancel' },
      { text: copy.permissionSettings, onPress: () => Linking.openSettings() },
    ]);
  }
  return ok;
}

function CapacityBar({
  label,
  current,
  max,
  suffix,
  styles,
}: {
  label: string;
  current: number;
  max: number;
  suffix: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const progress = Math.min(current / max, 1);
  const danger = progress > 0.9;
  return (
    <View style={styles.capacity}>
      <View style={styles.capacityHeader}>
        <Text style={styles.capacityLabel}>{label}</Text>
        <Text style={[styles.capacityValue, danger && styles.capacityDanger]}>
          {current.toFixed(suffix === 'MB' ? 1 : 0)} / {max} {suffix}
        </Text>
      </View>
      <View style={styles.capacityTrack}>
        <View style={[styles.capacityFill, { width: `${progress * 100}%`, backgroundColor: danger ? '#F87171' : '#38BDF8' }]} />
      </View>
    </View>
  );
}

function getPositionForSize(index: number, squareSize: number) {
  return {
    x: (index % COLUMNS) * (squareSize + GRID_GAP),
    y: Math.floor(index / COLUMNS) * (squareSize + GRID_GAP),
  };
}

function DraggableTile({
  uri,
  index,
  total,
  squareSize,
  coverBadge,
  styles,
  onDragStart,
  onDragEnd,
  onHoverSwap,
  onRemove,
}: {
  uri: string;
  index: number;
  total: number;
  squareSize: number;
  coverBadge: string;
  styles: ReturnType<typeof createStyles>;
  onDragStart: () => void;
  onDragEnd: () => void;
  onHoverSwap: (uri: string, targetIndex: number) => void;
  onRemove: (index: number) => void;
}) {
  const pos = useRef(new Animated.ValueXY(getPositionForSize(index, squareSize))).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isActive, setIsActive] = useState(false);
  const isDragging = useRef(false);
  const initialIndex = useRef(index);
  const lastHoveredIndex = useRef(index);

  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onHoverSwapRef = useRef(onHoverSwap);
  const indexRef = useRef(index);
  const totalRef = useRef(total);
  const uriRef = useRef(uri);
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;
  onHoverSwapRef.current = onHoverSwap;
  indexRef.current = index;
  totalRef.current = total;
  uriRef.current = uri;

  useEffect(() => {
    if (!isDragging.current) {
      Animated.spring(pos, {
        toValue: getPositionForSize(index, squareSize),
        useNativeDriver: true,
        friction: 9,
        tension: 68,
      }).start();
    }
  }, [index, pos, squareSize]);

  const finishDrag = useCallback(() => {
    setIsActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(pos, {
        toValue: getPositionForSize(indexRef.current, squareSize),
        useNativeDriver: true,
        friction: 9,
        tension: 85,
      }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start(() => {
      onDragEndRef.current();
    });
    isDragging.current = false;
  }, [pos, scaleAnim, squareSize]);

  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          isDragging.current = true;
          setIsActive(true);
          initialIndex.current = indexRef.current;
          lastHoveredIndex.current = indexRef.current;
          onDragStartRef.current();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.spring(scaleAnim, { toValue: 1.08, friction: 6, useNativeDriver: true }).start();
        },
        onPanResponderMove: (_e, gestureState) => {
          const startPos = getPositionForSize(initialIndex.current, squareSize);
          const currentX = startPos.x + gestureState.dx;
          const currentY = startPos.y + gestureState.dy;
          pos.setValue({ x: currentX, y: currentY });

          const cellStride = squareSize + GRID_GAP;
          const centerX = currentX + squareSize / 2;
          const centerY = currentY + squareSize / 2;
          const n = totalRef.current;
          const targetCol = Math.max(0, Math.min(COLUMNS - 1, Math.floor(centerX / cellStride)));
          const rowCount = Math.max(1, Math.ceil(n / COLUMNS));
          const maxRow = Math.max(0, rowCount - 1);
          const targetRow = Math.max(0, Math.min(maxRow, Math.floor(centerY / cellStride)));
          let targetIndex = targetRow * COLUMNS + targetCol;
          targetIndex = Math.min(Math.max(0, targetIndex), Math.max(0, n - 1));

          if (targetIndex !== lastHoveredIndex.current) {
            lastHoveredIndex.current = targetIndex;
            Haptics.selectionAsync();
            onHoverSwapRef.current(uriRef.current, targetIndex);
          }
        },
        onPanResponderRelease: () => finishDragRef.current(),
        onPanResponderTerminate: () => finishDragRef.current(),
      }),
    [pos, scaleAnim, squareSize],
  );

  const stackOrder = isActive ? 1000 : 10 + index;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.tileAbsolute,
        {
          width: squareSize,
          height: squareSize,
          transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: scaleAnim }],
          zIndex: stackOrder,
          shadowColor: isActive ? '#38BDF8' : '#000',
          shadowOpacity: isActive ? 0.45 : 0,
          shadowOffset: isActive ? { width: 0, height: 8 } : { width: 0, height: 0 },
          shadowRadius: isActive ? 12 : 0,
          elevation: isActive ? 24 : Math.min(2 + index, 20),
        },
      ]}
    >
      <Image source={{ uri }} style={styles.tileImage} />
      <View style={[styles.matrixOverlay, { opacity: isActive ? 0.35 : 1 }]}>
        <View style={styles.dotMatrix}>
          {[...Array(9)].map((_, i) => (
            <View key={i} style={styles.matrixDot} />
          ))}
        </View>
      </View>
      {index === 0 ? (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>{coverBadge}</Text>
        </View>
      ) : null}
      <Pressable onPress={() => onRemove(index)} style={styles.removeBtn} hitSlop={8}>
        <X color="#FFF" size={14} />
      </Pressable>
    </Animated.View>
  );
}

export default function CarPhotoGrid({
  images,
  imageByteSizes,
  onChange,
  onDraggingChange,
  labels,
}: CarPhotoGridProps) {
  const colors = useCarScreenColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = {
    title: labels?.title ?? 'Zdjęcia auta',
    lead: labels?.lead ?? 'Przeciągnij za kropki, aby zmienić kolejność. Pierwsze zdjęcie to okładka.',
    photosLabel: labels?.photosLabel ?? 'Liczba zdjęć',
    photosSuffix: labels?.photosSuffix ?? 'szt.',
    sizeLabel: labels?.sizeLabel ?? 'Rozmiar wysyłki',
    sizeSuffix: labels?.sizeSuffix ?? 'MB',
    coverBadge: labels?.coverBadge ?? 'Okładka',
    addLabel: labels?.addLabel ?? 'Dodaj',
    limitTitle: labels?.limitTitle ?? 'Limit zdjęć',
    limitBody: labels?.limitBody ?? `Możesz dodać maksymalnie ${OFFER_MEDIA_MAX_IMAGES} zdjęć.`,
    permissionTitle: labels?.permissionTitle ?? 'Brak dostępu',
    permissionBody: labels?.permissionBody ?? 'Zezwól na dostęp do galerii, aby dodać zdjęcia auta.',
    permissionCancel: labels?.permissionCancel ?? 'Anuluj',
    permissionSettings: labels?.permissionSettings ?? 'Ustawienia',
    storageTitle: labels?.storageTitle ?? 'Limit miejsca',
  };
  const { width } = useWindowDimensions();
  const [sizing, setSizing] = useState(false);
  const [dragSnapshot, setDragSnapshot] = useState<string[] | null>(null);
  const dragSnapshotRef = useRef<string[] | null>(null);
  const squareSize = (width - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const displayImages = dragSnapshot ?? images;
  const totalMb = sumEstimatedUploadBytes(displayImages, imageByteSizes) / (1024 * 1024);
  const slotsLeft = useMemo(
    () => Math.max(0, OFFER_MEDIA_MAX_IMAGES - images.length),
    [images.length],
  );
  const gridHeight =
    Math.ceil(Math.max(displayImages.length + (slotsLeft > 0 ? 1 : 0), 1) / COLUMNS) *
    (squareSize + GRID_GAP);

  const pickImages = async () => {
    if (slotsLeft <= 0) {
      Alert.alert(copy.limitTitle, copy.limitBody);
      return;
    }
    const permitted = await ensureMediaLibraryPermission(copy);
    if (!permitted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    setSizing(true);
    try {
      let nextImages = [...images];
      let nextSizes = { ...imageByteSizes };

      for (const asset of result.assets) {
        if (nextImages.length >= OFFER_MEDIA_MAX_IMAGES) break;
        const measured = await estimateBytesForDraftImage(asset.uri, asset.fileSize ?? null);
        const accept = canAcceptDraftImage({
          currentUris: nextImages,
          sizes: nextSizes,
          newEstimatedBytes: measured,
          pickerReportedBytes: asset.fileSize ?? null,
          newUri: asset.uri,
        });
        if (!accept.ok) {
          Alert.alert(copy.storageTitle, formatMediaCapacityAlert(accept.reason));
          break;
        }
        if (!nextImages.includes(asset.uri)) {
          nextImages.push(asset.uri);
          nextSizes[asset.uri] = measured;
          nextSizes = pruneImageByteSizes(nextImages, nextSizes);
        }
      }
      onChange(nextImages, nextSizes);
    } finally {
      setSizing(false);
    }
  };

  const removeImage = (index: number) => {
    const source = dragSnapshot ?? images;
    const next = source.filter((_, i) => i !== index);
    setDragSnapshot(null);
    dragSnapshotRef.current = null;
    onChange(next, pruneImageByteSizes(next, imageByteSizes));
  };

  const handleDragStart = useCallback(() => {
    const next = [...images];
    dragSnapshotRef.current = next;
    setDragSnapshot(next);
    onDraggingChange?.(true);
  }, [images, onDraggingChange]);

  const handleDragEnd = useCallback(() => {
    onDraggingChange?.(false);
    const snap = dragSnapshotRef.current;
    if (snap) {
      onChange(snap, pruneImageByteSizes(snap, imageByteSizes));
    }
    dragSnapshotRef.current = null;
    setDragSnapshot(null);
  }, [imageByteSizes, onChange, onDraggingChange]);

  const handleHoverSwap = useCallback(
    (uri: string, targetIndex: number) => {
      setDragSnapshot((prev) => {
        const arr = [...(prev ?? images)];
        const currentIndex = arr.indexOf(uri);
        if (currentIndex === targetIndex || currentIndex === -1) return prev;
        const next = [...arr];
        const [item] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, item);
        dragSnapshotRef.current = next;
        return next;
      });
    },
    [images],
  );

  const addTileIndex = displayImages.length;
  const addPos = getPositionForSize(addTileIndex, squareSize);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.lead}>{copy.lead}</Text>

      <CapacityBar
        label={copy.photosLabel}
        current={displayImages.length}
        max={OFFER_MEDIA_MAX_IMAGES}
        suffix={copy.photosSuffix}
        styles={styles}
      />
      <CapacityBar
        label={copy.sizeLabel}
        current={totalMb}
        max={OFFER_MEDIA_UPLOAD_CAP_MB}
        suffix={copy.sizeSuffix}
        styles={styles}
      />

      <View style={[styles.gridAbsolute, { height: gridHeight }]}>
        {displayImages.map((uri, index) => (
          <DraggableTile
            key={uri}
            uri={uri}
            index={index}
            total={displayImages.length}
            squareSize={squareSize}
            coverBadge={copy.coverBadge}
            styles={styles}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onHoverSwap={handleHoverSwap}
            onRemove={removeImage}
          />
        ))}
        {slotsLeft > 0 ? (
          <Pressable
            onPress={pickImages}
            disabled={sizing}
            style={[
              styles.addTile,
              {
                width: squareSize,
                height: squareSize,
                left: addPos.x,
                top: addPos.y,
              },
            ]}
          >
            {sizing ? (
              <ActivityIndicator color={colors.accentSoft} />
            ) : (
              <>
                <Text style={styles.addPlus}>+</Text>
                <Text style={styles.addLabel}>{copy.addLabel}</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: { gap: 10 },
    title: { color: colors.text, fontSize: 15, fontWeight: '700' },
    lead: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    capacity: { gap: 6 },
    capacityHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    capacityLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    capacityValue: { color: colors.text, fontSize: 11, fontWeight: '700' },
    capacityDanger: { color: '#FCA5A5' },
    capacityTrack: { height: 4, borderRadius: 999, backgroundColor: colors.inputBorder, overflow: 'hidden' },
    capacityFill: { height: '100%', borderRadius: 999 },
    gridAbsolute: { position: 'relative', width: '100%', marginTop: 4 },
    tileAbsolute: {
      position: 'absolute',
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.inputBg,
    },
    tileImage: { width: '100%', height: '100%' },
    matrixOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    dotMatrix: {
      width: 24,
      height: 24,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignContent: 'space-between',
    },
    matrixDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    coverBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      borderRadius: 999,
      backgroundColor: colors.buttonBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.buttonBorder,
    },
    coverBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
    removeBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
      position: 'absolute',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.buttonBorder,
      borderStyle: 'dashed',
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    addPlus: { color: colors.accent, fontSize: 28, fontWeight: '300', lineHeight: 30 },
    addLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  });
}
