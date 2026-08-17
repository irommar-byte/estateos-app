import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchAgencyClients, type AgencyClientListItem } from '../../services/agencyClientService';
import {
  crmEventClientId,
  useCrmSchedule,
  type CrmScheduleEvent,
} from '../../hooks/useCrmSchedule';
import CrmMonthCalendar from './CrmMonthCalendar';
import MobilePulseScheduleWidget from './MobilePulseScheduleWidget';
import ProfileConciergeCard from './ProfileConciergeCard';

type Props = {
  isDark: boolean;
  isAgency: boolean;
};

const BUYER_COLOR = '#FF9500';
const SELLER_COLOR = '#34C759';

function LivePulseDot({ color = SELLER_COLOR }: { color?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseHalo,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) }],
          },
        ]}
      />
      <View style={[styles.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}

function MetricTile({
  value,
  label,
  hint,
  icon,
  accent,
  isDark,
  delay,
  onPress,
}: {
  value: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  isDark: boolean;
  delay: number;
  onPress?: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 380,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, delay]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={() => {
          if (!onPress) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        style={[
          styles.metricTile,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
          },
        ]}
      >
        <View style={[styles.metricIcon, { backgroundColor: `${accent}1F` }]}>
          <Ionicons name={icon} size={12} color={accent} />
        </View>
        <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#000000' }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: isDark ? '#8E8E93' : '#6C6C70' }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.metricHint, { color: accent }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function TaskRow({
  task,
  isDark,
  onPress,
}: {
  task: { id: string; icon: keyof typeof Ionicons.glyphMap; color: string; title: string; detail: string };
  isDark: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.taskRow,
        {
          backgroundColor: `${task.color}${isDark ? '1F' : '14'}`,
          borderColor: `${task.color}${isDark ? '4D' : '33'}`,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons name={task.icon} size={15} color={task.color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.taskTitle, { color: isDark ? '#FFFFFF' : '#000000' }]} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[styles.taskDetail, { color: isDark ? '#8E8E93' : '#6C6C70' }]} numberOfLines={1}>
          {task.detail}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={task.color} /> : null}
    </Pressable>
  );
}

export default function ProfileCrmSection({ isDark, isAgency }: Props) {
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const { events } = useCrmSchedule();
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);

  const loadClients = useCallback(async () => {
    if (!token) return;
    const res = await fetchAgencyClients(token);
    if (res.ok) setClients(res.clients);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients]),
  );

  const text = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(52,199,89,0.30)' : 'rgba(52,199,89,0.22)';
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

  const sellers = clients.filter((c) => c.type === 'SELLER').length;
  const buyers = clients.filter((c) => c.type === 'BUYER').length;
  const matchTotal = clients.reduce((sum, c) => sum + (Number(c.matchCount) || 0), 0);

  const now = Date.now();
  const weekEvents = events.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    return !Number.isNaN(start) && start >= now - 2 * 3600 * 1000 && start <= now + 7 * 86400 * 1000;
  });
  const nextEvent = weekEvents[0] || null;

  const openClient = useCallback(
    (clientId: number) => navigation.navigate('AgencyClientDetail', { clientId }),
    [navigation],
  );

  const handleEventPress = useCallback(
    (event: CrmScheduleEvent) => {
      const clientId = crmEventClientId(event);
      if (clientId) openClient(clientId);
      else navigation.navigate('AgencyClients');
    },
    [navigation, openClient],
  );

  const tasks = useMemo(() => {
    const list: Array<{
      id: string;
      icon: keyof typeof Ionicons.glyphMap;
      color: string;
      title: string;
      detail: string;
      onPress?: () => void;
    }> = [];

    const live = events.find((event) => {
      const start = new Date(event.startsAt).getTime();
      return !Number.isNaN(start) && start <= now && now - start < 2 * 3600 * 1000;
    });
    if (live) {
      list.push({
        id: 'live',
        icon: 'radio',
        color: BUYER_COLOR,
        title: 'Spotkanie trwa teraz',
        detail: [live.subtitle, live.location].filter(Boolean).join(' · ') || live.title,
        onPress: () => handleEventPress(live),
      });
    }

    const todayEvents = events.filter((event) => {
      const start = new Date(event.startsAt);
      return (
        start.toDateString() === new Date().toDateString() && start.getTime() > now
      );
    });
    if (todayEvents.length > 0) {
      const first = todayEvents[0];
      list.push({
        id: 'today',
        icon: 'today',
        color: '#007AFF',
        title: `Dziś ${todayEvents.length === 1 ? 'jedno wydarzenie' : `${todayEvents.length} wydarzenia`}`,
        detail: `${new Date(first.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · ${first.subtitle || first.title}`,
        onPress: () => handleEventPress(first),
      });
    }

    const withoutMeeting = clients.filter((c) => !c.upcomingMeetingStartsAt).length;
    if (withoutMeeting > 0) {
      list.push({
        id: 'no-meeting',
        icon: 'calendar-outline',
        color: '#AF52DE',
        title: `${withoutMeeting} ${withoutMeeting === 1 ? 'klient bez terminu' : 'klientów bez terminu'}`,
        detail: 'Ustal spotkanie i wyślij wizytówkę z kalendarzem',
        onPress: () => navigation.navigate('AgencyClients'),
      });
    }

    if (matchTotal > 0) {
      list.push({
        id: 'matches',
        icon: 'sparkles',
        color: SELLER_COLOR,
        title: `${matchTotal} ${matchTotal === 1 ? 'dopasowanie' : 'dopasowań'} do wysłania`,
        detail: 'Radar znalazł oferty pod preferencje klientów',
        onPress: () => navigation.navigate('AgencyClients'),
      });
    }

    if (clients.length === 0) {
      list.push({
        id: 'first-client',
        icon: 'person-add',
        color: SELLER_COLOR,
        title: 'Dodaj pierwszego klienta',
        detail: 'Umów spotkanie i uruchom kartę pozyskania',
        onPress: () => navigation.navigate('AgencyClientCreate'),
      });
    }

    return list.slice(0, 3);
  }, [events, clients, matchTotal, now, navigation, handleEventPress]);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(52,199,89,0.16)', 'rgba(0,122,255,0.06)', 'transparent']
              : ['rgba(52,199,89,0.14)', 'rgba(0,122,255,0.05)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <LivePulseDot />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: text }]} numberOfLines={1}>
                EstateOS™ CRM
              </Text>
              <Text style={[styles.subtitle, { color: secondary }]} numberOfLines={1}>
                Twoje centrum sprzedaży i pozyskania
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${SELLER_COLOR}1F`, borderColor: `${SELLER_COLOR}4D` }]}>
            <Text style={styles.statusPillText}>AKTYWNY</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricTile
            value={String(clients.length)}
            label="Klienci"
            hint={`${sellers} sprz. · ${buyers} kup.`}
            icon="people"
            accent="#007AFF"
            isDark={isDark}
            delay={60}
            onPress={() => navigation.navigate('AgencyClients')}
          />
          <MetricTile
            value={String(weekEvents.length)}
            label="Spotkania 7 dni"
            hint={
              nextEvent
                ? new Date(nextEvent.startsAt).toLocaleString('pl-PL', {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'brak terminów'
            }
            icon="calendar"
            accent={BUYER_COLOR}
            isDark={isDark}
            delay={140}
            onPress={nextEvent ? () => handleEventPress(nextEvent) : undefined}
          />
          <MetricTile
            value={String(matchTotal)}
            label="Dopasowania"
            hint={matchTotal > 0 ? 'do wysłania' : 'radar czuwa'}
            icon="sparkles"
            accent={SELLER_COLOR}
            isDark={isDark}
            delay={220}
            onPress={() => navigation.navigate('AgencyClients')}
          />
        </View>

        <View style={styles.blockLabelRow}>
          <Text style={[styles.blockLabel, { color: secondary }]}>DO ZROBIENIA</Text>
          <View style={[styles.blockLine, { backgroundColor: hairline }]} />
        </View>

        {tasks.length === 0 ? (
          <View style={[styles.allClear, { borderColor: `${SELLER_COLOR}33`, backgroundColor: `${SELLER_COLOR}14` }]}>
            <Ionicons name="checkmark-circle" size={16} color={SELLER_COLOR} />
            <Text style={[styles.allClearText, { color: text }]}>Wszystko ogarnięte — brak zaległości</Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} isDark={isDark} onPress={task.onPress} />
            ))}
          </View>
        )}

        <View style={styles.blockLabelRow}>
          <Text style={[styles.blockLabel, { color: secondary }]}>NAJBLIŻSZY TERMIN</Text>
          <View style={[styles.blockLine, { backgroundColor: hairline }]} />
        </View>

        <MobilePulseScheduleWidget isDark={isDark} embedded events={events} />

        <View style={styles.blockLabelRow}>
          <Text style={[styles.blockLabel, { color: secondary }]}>KALENDARZ MIESIĄCA</Text>
          <View style={[styles.blockLine, { backgroundColor: hairline }]} />
        </View>

        <CrmMonthCalendar events={events} isDark={isDark} onEventPress={handleEventPress} />

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('AgencyClientCreate');
            }}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={['#34C759', '#2AA84A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionFill}
            >
              <Ionicons name="person-add" size={16} color="#FFFFFF" />
              <Text style={styles.actionTextPrimary}>Dodaj klienta</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('AgencyClients');
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionSecondary,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: hairline,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="people" size={16} color="#007AFF" />
            <Text style={[styles.actionTextSecondary, { color: text }]}>Moi klienci</Text>
          </Pressable>
        </View>

        <View style={[styles.blockLine, { backgroundColor: hairline, marginBottom: 10 }]} />

        <ProfileConciergeCard isDark={isDark} isAgency={isAgency} embedded />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  pulseWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseCore: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillText: { fontSize: 9, fontWeight: '900', color: SELLER_COLOR, letterSpacing: 0.7 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricTile: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: { fontSize: 21, fontWeight: '900', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, marginTop: 1 },
  metricHint: { fontSize: 9, fontWeight: '800', marginTop: 3 },
  blockLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  blockLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  blockLine: { flex: 1, height: StyleSheet.hairlineWidth },
  allClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  allClearText: { fontSize: 12.5, fontWeight: '800' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  taskTitle: { fontSize: 12.5, fontWeight: '800' },
  taskDetail: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 14 },
  actionBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  actionFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionTextPrimary: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  actionTextSecondary: { fontSize: 13, fontWeight: '800' },
});
