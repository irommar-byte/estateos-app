import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { PhotoSessionEventItem, PhotoSessionRequestItem } from '../../services/photoSessionService';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBadgeDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export type PhotoSessionHistoryLabels = {
  timelineTitle: string;
  timelineExpand: string;
  timelineCollapse: string;
  formatBadgeConfirmed: (date: string) => string;
  formatBadgeNegotiating: (date: string) => string;
};

type Props = {
  item: PhotoSessionRequestItem;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  labels: PhotoSessionHistoryLabels;
  formatEventLabel: (action: string) => string;
};

export default function CollapsiblePhotoSessionHistory({
  item,
  isDark,
  textColor,
  mutedColor,
  labels,
  formatEventLabel,
}: Props) {
  const events = item.events || [];
  const [expanded, setExpanded] = useState(false);
  const badgeDate = formatBadgeDateTime(item.proposedAt);
  const isConfirmed = item.status === 'ACCEPTED';
  const isNegotiating = item.status === 'PENDING';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  useEffect(() => {
    setExpanded(false);
  }, [item.id]);

  const toggle = useCallback(() => {
    void Haptics.selectionAsync();
    setExpanded((v) => !v);
  }, []);

  if (!events.length && !isNegotiating && !isConfirmed) return null;

  const badgeConfirmedText = labels.formatBadgeConfirmed(badgeDate);
  const badgeNegotiatingText = labels.formatBadgeNegotiating(badgeDate);

  return (
    <View style={styles.timelineWrap}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={[styles.timelineToggleRow, { borderColor: cardBorder }]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? labels.timelineCollapse : labels.timelineExpand}
      >
        {isConfirmed ? (
          <View style={styles.badgeConfirmed} pointerEvents="none">
            <Text style={styles.badgeConfirmedText}>{badgeConfirmedText}</Text>
          </View>
        ) : isNegotiating ? (
          <View style={styles.badgeNegotiating} pointerEvents="none">
            <Text style={styles.badgeNegotiatingText}>{badgeNegotiatingText}</Text>
          </View>
        ) : (
          <Text style={[styles.timelineTitle, { color: mutedColor, flex: 1 }]} pointerEvents="none">
            {labels.timelineTitle}
          </Text>
        )}
        <View style={styles.chevronWrap} pointerEvents="none">
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={mutedColor} />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <>
          {events.length > 0 ? (
            <Text style={[styles.timelineTitle, { color: mutedColor, marginTop: 4 }]}>
              {labels.timelineTitle}
            </Text>
          ) : null}
          {events.map((ev: PhotoSessionEventItem) => (
            <View
              key={ev.id}
              style={[
                styles.timelineItem,
                { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
              ]}
            >
              <Text style={[styles.timelineLabel, { color: textColor }]}>{formatEventLabel(ev.action)}</Text>
              {ev.proposedAt ? (
                <Text style={[styles.timelineDate, { color: mutedColor }]}>{formatDateTime(ev.proposedAt)}</Text>
              ) : null}
              {ev.note ? <Text style={[styles.timelineNote, { color: mutedColor }]}>{ev.note}</Text> : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  timelineWrap: { gap: 8 },
  timelineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chevronWrap: { flexShrink: 0, width: 20, alignItems: 'center' },
  badgeNegotiating: {
    flex: 1,
    backgroundColor: 'rgba(255,159,10,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.35)',
  },
  badgeNegotiatingText: { color: '#B45309', fontSize: 11, fontWeight: '800' },
  badgeConfirmed: {
    flex: 1,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  badgeConfirmedText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  timelineTitle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  timelineItem: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
  timelineLabel: { fontSize: 12, fontWeight: '800' },
  timelineDate: { fontSize: 12, fontWeight: '600' },
  timelineNote: { fontSize: 11, fontWeight: '500', marginTop: 2 },
});
