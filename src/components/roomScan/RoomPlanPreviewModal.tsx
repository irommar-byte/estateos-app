import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import FloorPlanScanArtboard from './FloorPlanScanArtboard';
import type { FloorPlanScanMeta } from '../../types/roomScan';

export type RoomPlanPreviewData = {
  title: string;
  subtitle?: string;
  meta?: FloorPlanScanMeta | null;
  imageUri?: string | null;
  model3dUri?: string | null;
  widthM?: string | number | null;
  lengthM?: string | number | null;
  heightM?: string | number | null;
  hideDimensions?: boolean;
};

type Props = {
  preview: RoomPlanPreviewData | null;
  isDark?: boolean;
  onClose: () => void;
  onOpen3d?: (uri: string) => void;
};

function formatMetric(value: string | number | null | undefined, suffix: string) {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(2).replace(/\.?0+$/, '')
      : String(value ?? '').trim();
  return text ? `${text} ${suffix}` : '—';
}

export default function RoomPlanPreviewModal({
  preview,
  isDark,
  onClose,
  onOpen3d,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth - 24, 760);
  const artboardWidth = Math.max(240, cardWidth - 28);
  const artboardHeight = Math.min(
    Math.max(220, artboardWidth * 0.72),
    windowHeight * 0.57,
  );
  const meta = preview?.meta;
  const canRenderVector = Boolean(meta?.walls?.length);
  const boundsWidth = meta ? Math.abs(meta.bounds.maxX - meta.bounds.minX) : null;
  const boundsLength = meta ? Math.abs(meta.bounds.maxZ - meta.bounds.minZ) : null;
  const metrics = useMemo(
    () => [
      { label: 'Powierzchnia', value: formatMetric(preview?.areaM2 ?? meta?.totalAreaSqM, 'm²') },
      { label: 'Szerokość', value: formatMetric(preview?.widthM || boundsWidth, 'm') },
      { label: 'Długość', value: formatMetric(preview?.lengthM || boundsLength, 'm') },
      { label: 'Wysokość', value: formatMetric(preview?.heightM ?? meta?.ceilingHeightM, 'm') },
    ],
    [boundsLength, boundsWidth, meta?.totalAreaSqM, meta?.ceilingHeightM, preview],
  );

  return (
    <Modal
      visible={Boolean(preview)}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij podgląd planu"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              maxHeight: windowHeight - 30,
              backgroundColor: isDark ? '#161618' : '#f8fafc',
              borderColor: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(15,23,42,0.11)',
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: isDark ? '#48484a' : '#cbd5e1' }]} />

          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="scan-outline" size={20} color="#0f9f78" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]} numberOfLines={1}>
                {preview?.title || 'Podgląd pomieszczenia'}
              </Text>
              <Text style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#64748b' }]} numberOfLines={2}>
                {preview?.subtitle || 'Zeskanowany rzut LiDAR'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zamknij"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: isDark ? '#2c2c2e' : '#e2e8f0', opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Ionicons name="close" size={20} color={isDark ? '#f8fafc' : '#0f172a'} />
            </Pressable>
          </View>

          <View
            style={[
              styles.planFrame,
              {
                width: artboardWidth,
                height: artboardHeight,
                backgroundColor: '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
              },
            ]}
          >
            {canRenderVector && meta ? (
              <FloorPlanScanArtboard
                walls={meta.walls}
                meta={meta}
                width={artboardWidth}
                height={artboardHeight}
                hideDimensions={Boolean(preview?.hideDimensions)}
              />
            ) : preview?.imageUri ? (
              <Image
                source={{ uri: preview.imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            ) : (
              <View style={styles.emptyPlan}>
                <Ionicons name="map-outline" size={42} color="#94a3b8" />
                <Text style={styles.emptyPlanText}>Brak zapisanego podglądu</Text>
              </View>
            )}
            <View style={styles.lidarBadge}>
              <Ionicons name="scan" size={12} color="#047857" />
              <Text style={styles.lidarBadgeText}>RZUT LiDAR</Text>
            </View>
          </View>

          {!preview?.hideDimensions ? (
          <View style={styles.metrics}>
            {metrics.map((metric) => (
              <View
                key={metric.label}
                style={[
                  styles.metric,
                  { backgroundColor: isDark ? '#242426' : '#ffffff', borderColor: isDark ? '#343438' : '#e2e8f0' },
                ]}
              >
                <Text style={[styles.metricLabel, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                  {metric.label}
                </Text>
                <Text style={[styles.metricValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  {metric.value}
                </Text>
              </View>
            ))}
          </View>
          ) : null}

          {preview?.model3dUri && onOpen3d ? (
            <Pressable
              onPress={() => onOpen3d(preview.model3dUri!)}
              style={({ pressed }) => [styles.modelButton, { opacity: pressed ? 0.78 : 1 }]}
            >
              <Ionicons name="cube-outline" size={18} color="#ffffff" />
              <Text style={styles.modelButtonText}>Otwórz model 3D</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    elevation: 20,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.35 },
  subtitle: { fontSize: 11, fontWeight: '600', lineHeight: 15, marginTop: 2 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planFrame: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
  },
  lidarBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(236,253,245,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.24)',
  },
  lidarBadgeText: { color: '#047857', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  emptyPlan: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyPlanText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metric: {
    width: '48%',
    flexGrow: 1,
    minHeight: 55,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  metricLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.65, textTransform: 'uppercase' },
  metricValue: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  modelButton: {
    height: 46,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modelButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
});
