import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import RoomScanModal, { isRoomScanSupportedOnDevice } from '../roomScan/RoomScanModal';
import type { RoomScanDraftAssets } from '../../types/roomScan';

export type RoomItem = {
  id: string;
  name: string;
  widthM: string;
  lengthM: string;
  areaM2: string;
};

export default function AcquisitionRoomScanner({
  rooms,
  planImages,
  onChangeRooms,
  onChangePlanImages,
  isDark,
  disabled,
}: {
  rooms: RoomItem[];
  planImages: string[];
  onChangeRooms: (rooms: RoomItem[]) => void;
  onChangePlanImages: (images: string[]) => void;
  isDark?: boolean;
  disabled?: boolean;
}) {
  const [newRoomName, setNewRoomName] = useState('Salon');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [roomScanOpen, setRoomScanOpen] = useState(false);
  const roomScanAvailable = isRoomScanSupportedOnDevice();

  const colors = {
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
  };

  const roomPresetNames = ['Salon', 'Sypialnia', 'Kuchnia', 'Łazienka', 'Przedpokój', 'Garderoba', 'Balkon / Taras', 'Inne'];

  const addRoom = () => {
    if (!newRoomName.trim()) return;
    const w = Number(width.replace(',', '.')) || 0;
    const l = Number(length.replace(',', '.')) || 0;
    const computedArea = w > 0 && l > 0 ? (w * l).toFixed(1) : '';

    const newRoom: RoomItem = {
      id: String(Date.now()),
      name: newRoomName.trim(),
      widthM: width.trim(),
      lengthM: length.trim(),
      areaM2: computedArea,
    };

    onChangeRooms([...rooms, newRoom]);
    setWidth('');
    setLength('');
  };

  const removeRoom = (id: string) => {
    onChangeRooms(rooms.filter((r) => r.id !== id));
  };

  const totalArea = rooms.reduce((acc, room) => {
    const area = Number(room.areaM2.replace(',', '.')) || 0;
    return acc + area;
  }, 0);

  const takeCameraPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Aparat', 'Brak uprawnień do aparatu.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      onChangePlanImages([...planImages, res.assets[0].uri]);
    }
  };

  const applyRoomScan = (assets: RoomScanDraftAssets) => {
    onChangePlanImages([...planImages, assets.floorPlanPngUri]);
    const scannedRooms: RoomItem[] = (assets.scanMeta.sections || []).map((section, index) => ({
      id: section.key || `scan-${index}`,
      name: section.label || `Pomieszczenie ${index + 1}`,
      widthM: '',
      lengthM: '',
      areaM2: section.areaSqM ? String(section.areaSqM) : '',
    }));
    if (scannedRooms.length) {
      onChangeRooms([...rooms, ...scannedRooms]);
    }
    setRoomScanOpen(false);
  };

  const pickGalleryPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
    });
    if (!res.canceled && res.assets?.length) {
      const uris = res.assets.map((a) => a.uri);
      onChangePlanImages([...planImages, ...uris]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.input, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="scan-outline" size={20} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>Wymiary i rzut pomieszczeń</Text>
      </View>

      {/* Room Preset Chips */}
      <Text style={[styles.label, { color: colors.secondary }]}>NAZWA POMIESZCZENIA</Text>
      <View style={styles.presetRow}>
        {roomPresetNames.map((name) => {
          const active = newRoomName === name;
          return (
            <Pressable
              key={name}
              onPress={() => setNewRoomName(name)}
              style={[
                styles.presetChip,
                {
                  backgroundColor: active ? colors.accent : colors.card,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? '#000' : colors.text, fontSize: 11, fontWeight: active ? '800' : '600' }}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Width x Length Inputs */}
      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.secondary }]}>SZEROKOŚĆ (m)</Text>
          <TextInput
            value={width}
            onChangeText={setWidth}
            keyboardType="numeric"
            placeholder="np. 4.2"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          />
        </View>
        <Text style={[styles.timesText, { color: colors.secondary }]}>×</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.secondary }]}>DŁUGOŚĆ (m)</Text>
          <TextInput
            value={length}
            onChangeText={setLength}
            keyboardType="numeric"
            placeholder="np. 5.5"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          />
        </View>
        <Pressable onPress={addRoom} style={[styles.addBtn, { backgroundColor: colors.accent }]}>
          <Ionicons name="add" size={22} color="#000" />
        </Pressable>
      </View>

      {/* Added Rooms Table */}
      {rooms.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.label, { color: colors.secondary }]}>LISTA POMIESZCZEŃ (SUMA: {totalArea.toFixed(1)} m²)</Text>
          {rooms.map((item) => (
            <View key={item.id} style={[styles.roomRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{item.name}</Text>
                <Text style={{ color: colors.secondary, fontSize: 11 }}>
                  {item.widthM && item.lengthM ? `${item.widthM} m × ${item.lengthM} m` : 'Rozmiar własny'}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 13, marginRight: 12 }}>
                {item.areaM2 ? `${item.areaM2} m²` : '—'}
              </Text>
              {!disabled && (
                <Pressable onPress={() => removeRoom(item.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {/* Plan Photos & Camera Scan */}
      <View style={{ marginTop: 16 }}>
        <Text style={[styles.label, { color: colors.secondary }]}>SKAN LIDAR / RZUT / DOKUMENTY</Text>
        {roomScanAvailable && !disabled ? (
          <Pressable
            onPress={() => setRoomScanOpen(true)}
            style={[styles.lidarCta, { backgroundColor: isDark ? 'rgba(14,165,233,0.12)' : 'rgba(224,242,254,0.95)', borderColor: isDark ? 'rgba(56,189,248,0.45)' : 'rgba(14,165,233,0.4)' }]}
          >
            <Ionicons name="scan-outline" size={22} color="#0284c7" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Skanuj pomieszczenie (LiDAR / RoomPlan)</Text>
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                Natywny skan Apple — wymiary, plan 2D i spacer 3D.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0284c7" />
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Pressable onPress={takeCameraPhoto} style={[styles.scanBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="camera-outline" size={20} color={colors.accent} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>Aparat / Skan</Text>
          </Pressable>
          <Pressable onPress={pickGalleryPhoto} style={[styles.scanBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="images-outline" size={20} color="#007AFF" />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>Galeria</Text>
          </Pressable>
        </View>

        {planImages.length > 0 ? (
          <View style={styles.photoGrid}>
            {planImages.map((uri, idx) => (
              <View key={idx} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                {!disabled && (
                  <Pressable
                    onPress={() => onChangePlanImages(planImages.filter((_, i) => i !== idx))}
                    style={styles.thumbDelete}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <RoomScanModal
        visible={roomScanOpen}
        onClose={() => setRoomScanOpen(false)}
        onComplete={applyRoomScan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  timesText: {
    fontSize: 18,
    fontWeight: '800',
    paddingBottom: 10,
  },
  input: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lidarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  thumbWrap: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbDelete: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
