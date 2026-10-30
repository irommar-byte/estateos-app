import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { FloorPlanScanMeta, RoomScanDetectedObject, RoomScanObjectCategory } from '../../types/roomScan';
import { getRoomScanObjectLabel } from '../../lib/roomScan/roomScanLabels';
import { dedupeDetectedObjects } from '../../lib/roomScan/floorPlanGeometry';

const CATEGORIES: RoomScanObjectCategory[] = [
  'storage',
  'table',
  'chair',
  'sofa',
  'bed',
  'refrigerator',
  'stove',
  'oven',
  'sink',
  'dishwasher',
  'washerDryer',
  'television',
  'toilet',
  'bathtub',
  'fireplace',
  'stairs',
  'unknown',
];

type Props = {
  meta: FloorPlanScanMeta;
  onChange: (meta: FloorPlanScanMeta) => void;
  textColor: string;
  secondaryColor: string;
  borderColor: string;
  accent: string;
  disabled?: boolean;
};

export default function FloorPlanFurnitureEditor({
  meta,
  onChange,
  textColor,
  secondaryColor,
  borderColor,
  accent,
  disabled,
}: Props) {
  const [adding, setAdding] = useState(false);
  // Domyślnie zwinięte: jedna linia podsumowania zamiast długiej listy — edycja po rozwinięciu.
  const [expanded, setExpanded] = useState(false);
  const objects = useMemo(() => dedupeDetectedObjects(meta.objects || []), [meta.objects]);

  const commit = (nextObjects: RoomScanDetectedObject[]) => {
    onChange({
      ...meta,
      objects: dedupeDetectedObjects(nextObjects),
    });
  };

  const addObject = (category: RoomScanObjectCategory) => {
    const cx = (meta.bounds.minX + meta.bounds.maxX) / 2;
    const cz = (meta.bounds.minZ + meta.bounds.maxZ) / 2;
    const jitter = objects.length * 0.18;
    commit([
      ...objects,
      {
        id: `obj-manual-${Date.now()}`,
        category,
        label: getRoomScanObjectLabel(category),
        centerX: cx + (jitter % 0.6),
        centerZ: cz + (jitter % 0.4),
        widthM: category === 'table' ? 1.2 : category === 'sofa' || category === 'bed' ? 1.8 : 0.6,
        depthM: category === 'storage' ? 0.4 : 0.55,
      },
    ]);
    setAdding(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setExpanded((v) => !v);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
          hitSlop={6}
        >
          <Text style={[styles.title, { color: secondaryColor }]}>WYPOSAŻENIE · {objects.length}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={secondaryColor} />
        </Pressable>
        {disabled || !expanded ? null : (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setAdding((v) => !v);
            }}
            style={[styles.addBtn, { borderColor: accent }]}
          >
            <Ionicons name={adding ? 'close' : 'add'} size={14} color={accent} />
            <Text style={{ color: accent, fontSize: 11, fontWeight: '800' }}>{adding ? 'Anuluj' : 'Dodaj'}</Text>
          </Pressable>
        )}
      </View>

      {adding ? (
        <View style={styles.palette}>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category}
              onPress={() => {
                void Haptics.selectionAsync();
                addObject(category);
              }}
              style={[styles.paletteChip, { borderColor }]}
            >
              <Text style={[styles.chipText, { color: textColor }]}>{getRoomScanObjectLabel(category)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!expanded ? (
        objects.length ? (
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={{ color: textColor, fontSize: 13, lineHeight: 19, fontWeight: '500' }}>
              {(() => {
                const counts = new Map<string, number>();
                for (const o of objects) {
                  const name = getRoomScanObjectLabel(o.category);
                  counts.set(name, (counts.get(name) || 0) + 1);
                }
                return Array.from(counts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
                  .join(' · ');
              })()}
            </Text>
            <Text style={{ color: accent, fontSize: 12, fontWeight: '700', marginTop: 4 }}>Edytuj wyposażenie</Text>
          </Pressable>
        ) : (
          <Text style={[styles.empty, { color: secondaryColor }]}>Brak wykrytych mebli.</Text>
        )
      ) : objects.length === 0 ? (
        <Text style={[styles.empty, { color: secondaryColor }]}>Brak mebli — dodaj albo zeskanuj ponownie.</Text>
      ) : (
        objects.map((obj) => (
          <View key={obj.id} style={[styles.row, { borderColor }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.chipText, { color: textColor }]}>{getRoomScanObjectLabel(obj.category)}</Text>
              <View style={styles.cats}>
                {CATEGORIES.slice(0, 8).map((category) => {
                  const active = obj.category === category;
                  return (
                    <Pressable
                      key={category}
                      disabled={disabled}
                      onPress={() => {
                        if (disabled) return;
                        void Haptics.selectionAsync();
                        commit(
                          objects.map((item) =>
                            item.id === obj.id
                              ? { ...item, category, label: getRoomScanObjectLabel(category) }
                              : item,
                          ),
                        );
                      }}
                      style={[styles.mini, active && { backgroundColor: `${accent}22`, borderColor: accent }]}
                    >
                      <Text style={{ color: active ? accent : secondaryColor, fontSize: 9, fontWeight: '700' }}>
                        {getRoomScanObjectLabel(category)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {disabled ? null : (
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  commit(objects.filter((item) => item.id !== obj.id));
                }}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  paletteChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  empty: { fontSize: 12 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  mini: { borderWidth: 1, borderColor: 'transparent', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: '700' },
});
