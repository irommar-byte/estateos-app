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
import { crmGoldPalette, type CrmPalette } from './crmGoldTheme';
import {
  AddClientNudgeIcon,
  ClientsBreathIcon,
  LiveMeetingIcon,
  OnTrackCheckIcon,
  RadarPulseIcon,
  SparkleOrbitIcon,
  TickingClockIcon,
  TodayCalendarIcon,
} from './CrmAnimatedIcons';

type Props = {
  isDark: boolean;
  isAgency: boolean;
};

type TaskTone = 'attention' | 'pending' | 'onTrack';

type CrmTask = {
  id: string;
  tone: TaskTone;
  chip: string;
  title: string;
  detail: string;
  icon: (color: string) => React.ReactNode;
  onPress?: () => void;
};

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

function toneColor(palette: CrmPalette, tone: TaskTone) {
  if (tone === 'attention') return palette.attention;
  if (tone === 'onTrack') return palette.onTrack;
  return palette.pending;
}

/** Breathing halo that marks the one row needing attention right now. */
function AttentionHalo({ color, radius }: { color: string; radius: number }) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          borderWidth: 1.5,
          borderColor: color,
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
        },
      ]}
    />
  );
}

function StatusChip({ label, color, palette }: { label: string; color: string; palette: CrmPalette }) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.isDark ? `${color}26` : `${color}1A`, borderColor: `${color}80` },
      ]}
    >
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function BlockHeading({
  label,
  hint,
  palette,
  icon,
}: {
  label: string;
  hint?: string;
  palette: CrmPalette;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.blockHeading}>
      {icon}
      <Text style={[styles.blockLabel, { color: palette.secondary }]}>{label}</Text>
      <View style={[styles.blockRule, { backgroundColor: palette.hairline }]} />
      {hint ? <Text style={[styles.blockHint, { color: palette.muted }]}>{hint}</Text> : null}
    </View>
  );
}

function MetricTile({
  value,
  label,
  hint,
  hintTone,
  icon,
  palette,
  isDark,
  delay,
  onPress,
}: {
  value: string;
  label: string;
  hint?: string;
  hintTone: string;
  icon: React.ReactNode;
  palette: CrmPalette;
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
        {icon}
        <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: palette.secondary }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.metricHint, { color: hintTone }]} numberOfLines={1}>
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

  const palette = useMemo(() => crmGoldPalette(isDark), [isDark]);

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

  const tasks = useMemo<CrmTask[]>(() => {
    const list: CrmTask[] = [];

    const live = events.find((event) => {
      const start = new Date(event.startsAt).getTime();
      return !Number.isNaN(start) && start <= now && now - start < 2 * 3600 * 1000;
    });
    if (live) {
      list.push({
        id: 'live',
        tone: 'attention',
        chip: 'TERAZ',
        title: 'Spotkanie trwa teraz',
        detail: [live.subtitle, live.location].filter(Boolean).join(' · ') || live.title,
        icon: (color) => <LiveMeetingIcon color={color} />,
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
        tone: 'attention',
        chip: 'DZIŚ',
        title: `Dziś ${todayEvents.length === 1 ? 'jedno wydarzenie' : `${todayEvents.length} wydarzenia`}`,
        detail: `${new Date(first.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · ${first.subtitle || first.title}`,
        icon: (color) => <TodayCalendarIcon color={color} />,
        onPress: () => handleEventPress(first),
      });
    }

    const withoutMeeting = clients.filter((c) => !c.upcomingMeetingStartsAt).length;
    if (withoutMeeting > 0) {
      list.push({
        id: 'no-meeting',
        tone: 'pending',
        chip: 'USTAL',
        title: `${withoutMeeting} ${withoutMeeting === 1 ? 'klient bez terminu' : 'klientów bez terminu'}`,
        detail: 'Ustal spotkanie i wyślij wizytówkę z kalendarzem',
        icon: (color) => <TickingClockIcon color={color} />,
        onPress: () => navigation.navigate('AgencyClients'),
      });
    }

    if (matchTotal > 0) {
      list.push({
        id: 'matches',
        tone: 'onTrack',
        chip: 'GOTOWE',
        title: `${matchTotal} ${matchTotal === 1 ? 'dopasowanie' : 'dopasowań'} gotowych`,
        detail: 'Radar znalazł oferty pod preferencje klientów',
        icon: (color) => <RadarPulseIcon color={color} />,
        onPress: () => navigation.navigate('AgencyClients'),
      });
    }

    if (clients.length === 0) {
      list.push({
        id: 'first-client',
        tone: 'pending',
        chip: 'START',
        title: 'Dodaj pierwszego klienta',
        detail: 'Umów spotkanie i uruchom kartę pozyskania',
        icon: (color) => <AddClientNudgeIcon color={color} />,
        onPress: () => navigation.navigate('AgencyClientCreate'),
      });
    }

    return list.slice(0, 3);
  }, [events, clients, matchTotal, now, navigation, handleEventPress]);

  const attentionCount = tasks.filter((task) => task.tone === 'attention').length;

  return (
    <View style={[profilePremiumCardShellStyle(isDark, 20), styles.shell]}>
      <View style={[styles.card, { borderColor: palette.hairline }]}>
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
              <Text style={[styles.sectionEyebrow, { color: palette.secondary }]}>CENTRUM SPRZEDAŻY</Text>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>EstateOS™ CRM</Text>
            </View>
            <View style={styles.headerRight}>
              {attentionCount > 0 ? (
                <StatusChip label={`PILNE ${attentionCount}`} color={palette.attention} palette={palette} />
              ) : (
                <StatusChip label="PLAN OK" color={palette.onTrack} palette={palette} />
              )}
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={palette.muted} />
            </View>
          </Pressable>

          <AnalogAppleClock size={168} isDark={isDark} variant="gold" accent={palette.accent} />

          {expanded ? (
            <>
              <View style={styles.metricsRow}>
                <MetricTile
                  value={String(clients.length)}
                  label="Klienci"
                  hint={`${sellers} sprz. · ${buyers} kup.`}
                  hintTone={palette.secondary}
                  icon={<ClientsBreathIcon color={palette.accent} size={16} />}
                  palette={palette}
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
                  hintTone={
                    nextEvent
                      ? attentionCount > 0
                        ? palette.attention
                        : palette.acquisition
                      : palette.muted
                  }
                  icon={<TodayCalendarIcon color={palette.acquisition} size={16} />}
                  palette={palette}
                  isDark={isDark}
                  delay={140}
                  onPress={nextEvent ? () => handleEventPress(nextEvent) : undefined}
                />
                <MetricTile
                  value={String(matchTotal)}
                  label="Dopasowania"
                  hint={matchTotal > 0 ? 'gotowe do wysłania' : 'radar czuwa'}
                  hintTone={matchTotal > 0 ? palette.onTrack : palette.muted}
                  icon={<SparkleOrbitIcon color={palette.onTrack} size={16} />}
                  palette={palette}
                  isDark={isDark}
                  delay={220}
                  onPress={() => navigation.navigate('AgencyClients')}
                />
              </View>

              <BlockHeading
                label="Do zrobienia"
                hint={attentionCount > 0 ? 'wymaga uwagi' : 'wszystko na czas'}
                palette={palette}
              />
              <View style={styles.blockList}>
                {tasks.length === 0 ? (
                  <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.taskContent}>
                    <InsetMetalIconWell isDark={isDark} variant="gold" size={36} borderRadius={11}>
                      <OnTrackCheckIcon color={palette.onTrack} />
                    </InsetMetalIconWell>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.taskTitleRow}>
                        <Text style={[styles.taskTitle, { color: palette.text }]} numberOfLines={1}>
                          Wszystko ogarnięte
                        </Text>
                        <StatusChip label="PLAN OK" color={palette.onTrack} palette={palette} />
                      </View>
                      <Text style={[styles.taskDetail, { color: palette.secondary }]} numberOfLines={2}>
                        Brak zaległości w pozyskaniu i obsłudze klientów
                      </Text>
                    </View>
                  </InsetMetalRecess>
                ) : (
                  tasks.map((task) => {
                    const tone = toneColor(palette, task.tone);
                    return (
                      <View key={task.id} style={styles.taskWrap}>
                        <InsetMetalRecess
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
                          <InsetMetalIconWell isDark={isDark} variant="gold" size={36} borderRadius={11}>
                            {task.icon(tone)}
                          </InsetMetalIconWell>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.taskTitleRow}>
                              <Text style={[styles.taskTitle, { color: palette.text }]} numberOfLines={1}>
                                {task.title}
                              </Text>
                              <StatusChip label={task.chip} color={tone} palette={palette} />
                            </View>
                            <Text style={[styles.taskDetail, { color: palette.secondary }]} numberOfLines={2}>
                              {task.detail}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={15} color={palette.muted} />
                        </InsetMetalRecess>
                        {task.tone === 'attention' ? <AttentionHalo color={tone} radius={14} /> : null}
                      </View>
                    );
                  })
                )}
              </View>

              <BlockHeading
                label="Najbliższy termin"
                palette={palette}
                icon={<TickingClockIcon color={palette.accent} size={14} />}
              />
              <View style={styles.blockList}>
                <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.wellContent}>
                  <MobilePulseScheduleWidget isDark={isDark} embedded events={events} palette={palette} />
                </InsetMetalRecess>
              </View>

              <BlockHeading label="Kalendarz miesiąca" palette={palette} />
              <View style={styles.blockList}>
                <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.wellContent}>
                  <CrmMonthCalendar
                    events={events}
                    isDark={isDark}
                    plain
                    accent={palette.accent}
                    palette={palette}
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
                    <Ionicons name="person-add" size={16} color={palette.onTrack} />
                    <Text style={[styles.actionText, { color: palette.text }]}>Dodaj klienta</Text>
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
                    <Ionicons name="people" size={16} color={palette.accent} />
                    <Text style={[styles.actionText, { color: palette.text }]}>Moi klienci</Text>
                  </InsetMetalRecess>
                </View>
              </View>

              <BlockHeading label="Concierge" palette={palette} />
              <View style={styles.blockList}>
                <InsetMetalRecess isDark={isDark} variant="gold" contentStyle={styles.wellContent}>
                  <ProfileConciergeCard isDark={isDark} isAgency={isAgency} embedded palette={palette} />
                </InsetMetalRecess>
              </View>

              <Text style={[styles.footer, { color: palette.muted }]}>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metricContent: { paddingVertical: 11, paddingHorizontal: 10, gap: 1 },
  metricValue: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  metricHint: { fontSize: 9.5, fontWeight: '800', marginTop: 3 },
  blockHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  blockRule: { flex: 1, height: StyleSheet.hairlineWidth },
  blockHint: { fontSize: 9.5, fontWeight: '700' },
  blockList: { marginTop: 9, gap: 10 },
  taskWrap: { position: 'relative', borderRadius: 14 },
  taskContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  taskTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  taskDetail: { fontSize: 11.5, fontWeight: '500', marginTop: 3 },
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
