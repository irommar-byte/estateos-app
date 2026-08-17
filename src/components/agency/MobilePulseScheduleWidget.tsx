import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/network';
import { useAuthStore } from '../../store/useAuthStore';

type ScheduleEvent = {
  id: string;
  kind: 'presentation' | 'open_house_host' | 'open_house_guest' | 'acquisition';
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
};

function kindColor(kind: ScheduleEvent['kind']) {
  if (kind === 'acquisition') return '#007AFF'; // Sky blue
  if (kind === 'presentation') return '#AF52DE'; // Purple
  return '#34C759'; // Emerald green
}

function kindLabel(kind: ScheduleEvent['kind']) {
  if (kind === 'acquisition') return 'POZYSKANIE KLIENTA';
  if (kind === 'presentation') return 'PREZENTACJA';
  return 'DZIEŃ OTWARTY';
}

function CountdownDigit({ value, label, isDark }: { value: number; label: string; isDark: boolean }) {
  return (
    <View style={styles.digitWrap}>
      <View
        style={[
          styles.digitBox,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      >
        <Text
          style={[
            styles.digitNum,
            { color: isDark ? '#FFFFFF' : '#1C1C1E' },
          ]}
        >
          {String(value).padStart(2, '0')}
        </Text>
      </View>
      <Text style={[styles.digitLabel, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8E8E93' }]}>
        {label}
      </Text>
    </View>
  );
}

export default function MobilePulseScheduleWidget({ isDark = true }: { isDark?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/pro-widget/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.events)) {
        setEvents(data.events);
      }
    } catch {
      /* keep silent */
    }
  }, [token]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const visibleEvents = events.filter((ev) => {
    const target = new Date(ev.startsAt).getTime();
    return !Number.isNaN(target) && target - now > -3600 * 2 * 1000;
  });

  const active = visibleEvents[index] ?? null;

  const targetTime = active ? new Date(active.startsAt).getTime() : 0;
  const diffSec = Math.max(0, Math.floor((targetTime - now) / 1000));
  const isLive = active && targetTime <= now;

  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = Math.floor(diffSec % 60);

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)';

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="time" size={15} color={active ? kindColor(active.kind) : '#34C759'} />
          </View>
          <Text style={[styles.widgetTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            TERMINARZ SPOTKAŃ
          </Text>
        </View>
        {visibleEvents.length > 1 ? (
          <View style={styles.navRow}>
            <Pressable
              onPress={() => setIndex((prev) => (prev > 0 ? prev - 1 : visibleEvents.length - 1))}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
            </Pressable>
            <Text style={{ color: isDark ? '#8E8E93' : '#6C6C70', fontSize: 12, fontWeight: '800' }}>
              {index + 1}/{visibleEvents.length}
            </Text>
            <Pressable
              onPress={() => setIndex((prev) => (prev + 1) % visibleEvents.length)}
              hitSlop={12}
            >
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {active ? (
        <View style={styles.content}>
          {/* Kind Badge & Date */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.kindPill,
                { backgroundColor: `${kindColor(active.kind)}1A`, borderColor: kindColor(active.kind) },
              ]}
            >
              <Text style={[styles.kindText, { color: kindColor(active.kind) }]}>
                {kindLabel(active.kind)}
              </Text>
            </View>
            <Text style={[styles.eventDateText, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
              {new Date(active.startsAt).toLocaleString('pl-PL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Clock Countdown Grid or Live Status */}
          {isLive ? (
            <View style={styles.liveBox}>
              <Ionicons name="radio" size={18} color="#FF9500" />
              <Text style={styles.liveText}>SPOTKANIE W TRAKCIE</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              <CountdownDigit value={days} label="DNI" isDark={isDark} />
              <View style={styles.colonWrap}>
                <Text style={[styles.colon, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>:</Text>
              </View>
              <CountdownDigit value={hours} label="GODZ" isDark={isDark} />
              <View style={styles.colonWrap}>
                <Text style={[styles.colon, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>:</Text>
              </View>
              <CountdownDigit value={minutes} label="MIN" isDark={isDark} />
              <View style={styles.colonWrap}>
                <Text style={[styles.colon, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>:</Text>
              </View>
              <CountdownDigit value={seconds} label="SEK" isDark={isDark} />
            </View>
          )}

          {/* Event Details */}
          <Text style={[styles.eventTitle, { color: isDark ? '#FFFFFF' : '#000000' }]} numberOfLines={1}>
            {active.title}
          </Text>
          {active.location ? (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={13} color={isDark ? '#8E8E93' : '#6C6C70'} />
              <Text style={[styles.locText, { color: isDark ? '#8E8E93' : '#6C6C70' }]} numberOfLines={1}>
                {active.location}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Ionicons name="checkmark-circle-outline" size={26} color="#34C759" />
          <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
            Brak zaplanowanych spotkań
          </Text>
          <Text style={[styles.emptySub, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
            Ustal termin spotkania na ekranie Dodaj Klienta.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(52,199,89,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  kindText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  eventDateText: {
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  digitWrap: {
    alignItems: 'center',
  },
  digitBox: {
    width: 44,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitNum: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  digitLabel: {
    fontSize: 7,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  colonWrap: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colon: {
    fontSize: 16,
    fontWeight: '800',
    paddingBottom: 2,
  },
  liveBox: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,149,0,0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.4)',
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  liveText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
  },
});
