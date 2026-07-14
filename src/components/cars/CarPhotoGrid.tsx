import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import {
  OFFER_MEDIA_MAX_IMAGES,
  OFFER_MEDIA_UPLOAD_CAP_BYTES,
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

export default function CarPhotoGrid({ images, imageByteSizes, onChange, labels }: CarPhotoGridProps) {
  const colors = useCarScreenColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = {
    title: labels?.title ?? 'Zdjęcia auta',
    lead: labels?.lead ?? 'Pierwsze zdjęcie to miniatura ogłoszenia. Przeciągnij strzałkami, aby zmienić kolejność.',
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
  const squareSize = (width - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const totalMb = sumEstimatedUploadBytes(images, imageByteSizes) / (1024 * 1024);

  const slotsLeft = useMemo(() => Math.max(0, OFFER_MEDIA_MAX_IMAGES - images.length), [images.length]);

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
    const next = images.filter((_, i) => i !== index);
    onChange(next, pruneImageByteSizes(next, imageByteSizes));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next, pruneImageByteSizes(next, imageByteSizes));
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.lead}>{copy.lead}</Text>

      <CapacityBar label={copy.photosLabel} current={images.length} max={OFFER_MEDIA_MAX_IMAGES} suffix={copy.photosSuffix} styles={styles} />
      <CapacityBar label={copy.sizeLabel} current={totalMb} max={OFFER_MEDIA_UPLOAD_CAP_MB} suffix={copy.sizeSuffix} styles={styles} />

      <View style={[styles.grid, { minHeight: Math.ceil(Math.max(images.length + 1, 1) / COLUMNS) * (squareSize + GRID_GAP) }]}>
        {images.map((uri, index) => (
          <View key={uri} style={[styles.tile, { width: squareSize, height: squareSize }]}>
            <Image source={{ uri }} style={styles.tileImage} />
            {index === 0 ? (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>{copy.coverBadge}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => removeImage(index)} style={styles.removeBtn} hitSlop={8}>
              <X color="#FFF" size={14} />
            </Pressable>
            <View style={styles.moveRow}>
              <Pressable onPress={() => moveImage(index, -1)} disabled={index === 0} style={styles.moveBtn}>
                <ChevronLeft color="#E2E8F0" size={16} />
              </Pressable>
              <Pressable onPress={() => moveImage(index, 1)} disabled={index === images.length - 1} style={styles.moveBtn}>
                <ChevronRight color="#E2E8F0" size={16} />
              </Pressable>
            </View>
          </View>
        ))}
        {slotsLeft > 0 ? (
          <Pressable
            onPress={pickImages}
            disabled={sizing}
            style={[styles.addTile, { width: squareSize, height: squareSize }]}
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: 4 },
    tile: { borderRadius: 14, overflow: 'hidden', backgroundColor: colors.inputBg, position: 'relative' },
    tileImage: { width: '100%', height: '100%' },
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
    moveRow: {
      position: 'absolute',
      bottom: 6,
      left: 6,
      right: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    moveBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
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
    addLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  });
}
