import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchAgencyClients, type AgencyClientListItem } from '../../services/agencyClientService';
import { crmEventClientId, useCrmSchedule, type CrmScheduleEvent } from '../../hooks/useCrmSchedule';
import TitaniumHomeKeyBackdrop from '../profile/TitaniumHomeKeyBackdrop';
import InsetMetalRecess, { InsetMetalIconWell } from '../profile/InsetMetalRecess';
import { profilePremiumCardShellStyle } from '../profile/profileCardElevation';
import AnalogAppleClock from './AnalogAppleClock';
import CrmMonthCalendar from './CrmMonthCalendar';
import MobilePulseScheduleWidget from './MobilePulseScheduleWidget';
import ProfileConciergeCard from './ProfileConciergeCard';

type Props = {
  isDark: boolean;
  isAgency: boolean;
};

const GOLD = '#E3B94F';
const BUYER_COLOR = '#FF9500';
const SELLER_COLOR = '#34C759';

function configureCrmLayoutAnimation(expanding: boolean) {
  const duration = expanding ? 360 : 280;
  LayoutAnimation.configureNext({
    duration,
    create: {
      type: LayoutAnimation.Types.easeIn,
      property: LayoutAnimation.Properties.opacity,
      duration: Math.round(duration * 0.85),
    },
    update: { type: LayoutAnimation.Types.keyboard },
    delete: {
      type: LayoutAnimation.Types.easeOut,
      property: LayoutAnimation.Properties.opacity,
      duration: Math.round(duration * 0.7),
    },
  });
}

function LivePulseDot({ color }: { color: string }) {
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
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
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
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <InsetMetalRecess
        isDark={isDark}
        variant="gold"
        borderRadius={13}
        onPress={
          onPress
            ? () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
              }
            : undefined
        }
        contentStyle={styles.metricContent}
      >
        <Ionicons name={icon} size={13} color={accent} />
        <Text style={[styles.metricValue, { color: isDark ? '#FFF8E4' : '#2B1E04' }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,240,205,0.6)' : 'rgba(43,30,4,0.62)' }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.metricHint, { color: accent }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </InsetMetalRecess>
    </Animated.View>
  );
}

export default function ProfileCrmSection({ isDark, isAgency }: Props) {
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const { events } = useCrmSchedule();
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);
  const [expanded, setExpanded] = useState(true);

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

  const text = isDark ? '#FFF8E4' : '#2B1E04';
  const secondary = isDark ? 'rgba(255,240,205,0.55)' : 'rgba(43,30,4,0.58)';
  const cardBorder = isDark ? 'rgba(255,226,163,0.24)' : 'rgba(120,86,18,0.26)';

  const sellers = clients.filter((c) => c.type === 'SELLER').length;
  const buyers = clients.filter((c) => c.type === 'BUYER').length;
  const matchTotal = clients.reduce((sum, c) => sum + (Number(c.matchCount) || 0), 0);

  const now = Date.now();
  const weekEvents = events.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    return !Number.isNaN(start) && start >= now - 2 * 3600 * 1000 && start <= now + 7 * 86400 * 1000;
  });
  const nextEvent = weekEvents[0] || null;

  const handleEventPress = useCallback(
    (event: CrmScheduleEvent) => {
      const clientId = crmEventClientId(event);
      if (clientId) navigation.navigate('AgencyClientDetail', { clientId });
      else navigation.navigate('AgencyClients');
    },
    [navigation],
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
      return start.toDateString() === new Date().toDateString() && start.getTime() > now;
    });
    if (todayEvents.length > 0) {
      const first = todayEvents[0];
      list.push({
        id: 'today',
        icon: 'today',
        color: GOLD,
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

  return (
    <View style={[profilePremiumCardShellStyle(isDark, 20), styles.shell]}>
      <View style={[styles.card, { borderColor: cardBorder }]}>
        <TitaniumHomeKeyBackdrop isDark={isDark} variant="gold" />

        <View style={styles.cardContent}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              configureCrmLayoutAnimation(!expanded);
              setExpanded((v) => !v);
            }}
            style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Zwiń panel CRM' : 'Rozwiń panel CRM'}
          >
            <View style={styles.headerCopy}>
              <View style={styles.eyebrowRow}>
                <LivePulseDot color={GOLD} />
                <Text style={[styles.sectionEyebrow, { color: secondary }]}>CENTRUM SPRZEDAŻY</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: text }]}>EstateOS™ CRM</Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? 'rgba(255,240,205,0.5)' : 'rgba(43,30,4,0.45)'}
            />
          </Pressable>

          <AnalogAppleClock size={170} isDark={isDark} variant="gold" accent={GOLD} />

          {expanded ? (
            <>
              <View style={styles.metricsRow}>
                <MetricTile
                  value={String(clients.length)}
                  label="Klienci"
                  hint={`${sellers} sprz. · ${buyers} kup.`}
                  icon="people"
                  accent={GOLD}
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

              <Text style={[styles.blockLabel, { color: secondary }]}>DO ZROBIENIA</Text>
              <View style={styles.blockList}>
                {tasks.length === 0 ? (
                  <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.taskContent}>
                    <InsetMetalIconWell isDark={isDark} variant="gold" size={34} borderRadius={10}>
                      <Ionicons name="checkmark-circle" size={17} color={SELLER_COLOR} />
                    </InsetMetalIconWell>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.taskTitle, { color: text }]}>Wszystko ogarnięte</Text>
                      <Text style={[styles.taskDetail, { color: secondary }]} numberOfLines={1}>
                        Brak zaległości w pozyskaniu i obsłudze klientów
                      </Text>
                    </View>
                  </InsetMetalRecess>
                ) : (
                  tasks.map((task) => (
                    <InsetMetalRecess
                      key={task.id}
                      isDark={isDark}
                      variant="gold"
                      onPress={
                        task.onPress
                          ? () => {
                              void Haptics.selectionAsync();
                              task.onPress?.();
                            }
                          : undefined
                      }
                      contentStyle={styles.taskContent}
                    >
                      <InsetMetalIconWell isDark={isDark} variant="gold" size={34} borderRadius={10}>
                        <Ionicons name={task.icon} size={16} color={task.color} />
                      </InsetMetalIconWell>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.taskTitle, { color: text }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text style={[styles.taskDetail, { color: secondary }]} numberOfLines={1}>
                          {task.detail}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={isDark ? 'rgba(255,240,205,0.35)' : 'rgba(43,30,4,0.3)'} />
                    </InsetMetalRecess>
                  ))
                )}
              </View>

              <Text style={[styles.blockLabel, { color: secondary }]}>NAJBLIŻSZY TERMIN</Text>
              <View style={styles.blockList}>
                <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.wellContent}>
                  <MobilePulseScheduleWidget isDark={isDark} embedded events={events} />
                </InsetMetalRecess>
              </View>

              <Text style={[styles.blockLabel, { color: secondary }]}>KALENDARZ MIESIĄCA</Text>
              <View style={styles.blockList}>
                <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.wellContent}>
                  <CrmMonthCalendar
                    events={events}
                    isDark={isDark}
                    plain
                    accent={isDark ? GOLD : '#5F430A'}
                    onEventPress={handleEventPress}
                  />
                </InsetMetalRecess>
              </View>

              <View style={styles.actionsRow}>
                <View style={styles.actionFlex}>
                  <InsetMetalRecess
                    isDark={isDark}
                    variant="gold"
                    contentStyle={styles.actionContent}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate('AgencyClientCreate');
                    }}
                  >
                    <Ionicons name="person-add" size={16} color={SELLER_COLOR} />
                    <Text style={[styles.actionText, { color: text }]}>Dodaj klienta</Text>
                  </InsetMetalRecess>
                </View>

                <View style={styles.actionFlex}>
                  <InsetMetalRecess
                    isDark={isDark}
                    variant="gold"
                    contentStyle={styles.actionContent}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate('AgencyClients');
                    }}
                  >
                    <Ionicons name="people" size={16} color={GOLD} />
                    <Text style={[styles.actionText, { color: text }]}>Moi klienci</Text>
                  </InsetMetalRecess>
                </View>
              </View>

              <Text style={[styles.blockLabel, { color: secondary }]}>CONCIERGE</Text>
              <View style={styles.blockList}>
                <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.wellContent}>
                  <ProfileConciergeCard isDark={isDark} isAgency={isAgency} embedded />
                </InsetMetalRecess>
              </View>

              <Text style={[styles.footer, { color: isDark ? 'rgba(255,240,205,0.38)' : 'rgba(43,30,4,0.38)' }]}>
                Terminy, karty pozyskania i panel klienta działają w jednym obiegu z wersją WWW.
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  cardContent: {
    position: 'relative',
    zIndex: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  pulseWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseCore: { width: 8, height: 8, borderRadius: 4 },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metricContent: { paddingVertical: 10, paddingHorizontal: 10, gap: 2 },
  metricValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.7, fontVariant: ['tabular-nums'], marginTop: 4 },
  metricLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
  metricHint: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  blockLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 18,
  },
  blockList: { marginTop: 8, gap: 10 },
  taskContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  taskTitle: { fontSize: 14, fontWeight: '700' },
  taskDetail: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  wellContent: { padding: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionFlex: { flex: 1 },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  actionText: { fontSize: 13, fontWeight: '800' },
  footer: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
