import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { PortalSourceBadge } from './MatchImportAgentMeta';
import { importPortalBadge } from '../../lib/importPortalBadge';
import { LinearGradient } from 'expo-linear-gradient';
import { postAgencyClientAction } from '../../services/agencyClientService';
import { API_URL } from '../../config/network';
import {
  DEFAULT_INTELLIGENCE_LOCKS,
  INTELLIGENCE_DAILY_LIMIT_OPTIONS,
  INTELLIGENCE_INTERVAL_OPTIONS,
  INTELLIGENCE_MIN_LEARNS_OPTIONS,
  INTELLIGENCE_MIN_SCORE_OPTIONS,
  type IntelligenceChoice,
  type IntelligenceLocks,
} from '../../lib/intelligenceAssistantOptions';

export type IntelligenceSettings = {
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  minLearns: number;
  minScore: number;
  lastSentAt: string | null;
  lockedFields?: IntelligenceLocks;
};

export type IntelligenceLessonPreview = {
  offerId: number;
  title: string;
  when?: string | null;
  said: string;
  vsNext?: string;
};

export type IntelligencePickPreview = {
  ready?: boolean;
  skipReason?: string | null;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  price?: number | null;
  area?: number | null;
  score?: number | null;
  analysis?: string[];
  reasons?: string[];
  nextSendAt?: string | null;
  offerId?: number | null;
  calibrating?: boolean;
  learnCount?: number;
  clientWhy?: string | null;
  lessons?: IntelligenceLessonPreview[];
};

export const DEFAULT_INTELLIGENCE_SETTINGS: IntelligenceSettings = {
  enabled: false,
  intervalHours: 24,
  dailyLimit: 1,
  minLearns: 3,
  minScore: 92,
  lastSentAt: null,
  lockedFields: { ...DEFAULT_INTELLIGENCE_LOCKS },
};

const BUBBLES = [
  { color: '#ff4d6d', size: 88, left: '6%', top: '62%' },
  { color: '#ffd166', size: 64, left: '72%', top: '8%' },
  { color: '#06d6a0', size: 74, left: '58%', top: '68%' },
  { color: '#4cc9f0', size: 54, left: '14%', top: '12%' },
  { color: '#c77dff', size: 80, left: '82%', top: '42%' },
  { color: '#ff70a6', size: 48, left: '38%', top: '78%' },
];

function Bubble({
  color,
  size,
  left,
  top,
  active,
  delay,
}: {
  color: string;
  size: number;
  left: `${number}%` | string;
  top: `${number}%` | string;
  active: boolean;
  delay: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    if (active) loop.start();
    else progress.setValue(0);
    return () => loop.stop();
  }, [active, delay, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: active ? 0.38 : 0.12,
        transform: [
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }),
          },
          {
            scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] }),
          },
        ],
      }}
    />
  );
}

export default function IntelligenceAssistantCard({
  clientId,
  token,
  value,
  colors,
  busy,
  pendingCheckback,
  onSave,
}: {
  clientId: number;
  token: string;
  value?: IntelligenceSettings | null;
  colors: { text: string; secondary: string; accent: string; border: string; card: string; input: string };
  busy?: boolean;
  pendingCheckback?: {
    activityId: number;
    type: string;
    body: string;
    options: Array<{ id: string; label: string }>;
    createdAt: string;
  } | null;
  onSave: (next: IntelligenceSettings) => void;
}) {
  const [draft, setDraft] = useState<IntelligenceSettings>(value || DEFAULT_INTELLIGENCE_SETTINGS);
  const [pick, setPick] = useState<IntelligencePickPreview | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [smartAdd, setSmartAdd] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [huntBusy, setHuntBusy] = useState<'preview' | 'import' | null>(null);
  const [huntNote, setHuntNote] = useState<string | null>(null);
  const [huntHits, setHuntHits] = useState<
    Array<{
      url: string;
      title: string;
      price: number | null;
      area: number | null;
      rooms: number | null;
      city: string | null;
      street: string | null;
      alreadyImported?: boolean;
    }>
  >([]);

  useEffect(() => {
    setDraft(value || DEFAULT_INTELLIGENCE_SETTINGS);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/mobile/v1/intelligence-smart-add`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && typeof json?.enabled === 'boolean') setSmartAdd(json.enabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const saveSmartAdd = async (enabled: boolean) => {
    setSmartAdd(enabled);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/intelligence-smart-add`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setSmartAdd(!enabled);
      else if (typeof json.enabled === 'boolean') setSmartAdd(json.enabled);
    } catch {
      setSmartAdd(!enabled);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setQueueBusy(true);
    postAgencyClientAction(token, clientId, { action: 'intelligence_preview' })
      .then((res) => {
        if (!cancelled && res.ok && (res as { pick?: IntelligencePickPreview }).pick) {
          setPick((res as { pick: IntelligencePickPreview }).pick);
        }
      })
      .finally(() => {
        if (!cancelled) setQueueBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, token, value?.lastSentAt, value?.enabled, value?.minScore, value?.minLearns, value?.intervalHours]);

  const choiceRow = (
    label: string,
    key: 'intervalHours' | 'dailyLimit' | 'minLearns' | 'minScore',
    options: IntelligenceChoice[],
  ) => (
    <View style={{ width: '100%' }}>
      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {options.map((option) => {
          const active = draft[key] === option.value;
          return (
            <Pressable
              key={`${key}-${option.value}`}
              onPress={() => setDraft((current) => ({ ...current, [key]: option.value }))}
              style={[
                styles.choice,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent : colors.input,
                },
              ]}
            >
              <Text style={{ color: active ? '#000' : colors.text, fontSize: 11, fontWeight: '800' }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const nextWhen = pick?.nextSendAt
    ? new Date(pick.nextSendAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSendNow = async () => {
    setSendingNow(true);
    setSendNote(null);
    try {
      const res = await postAgencyClientAction(token, clientId, { action: 'intelligence_send' });
      if (!res.ok) {
        setSendNote(res.message || 'Nie udało się wysłać.');
        return;
      }
      const sent = Boolean((res as { sent?: boolean }).sent);
      const emailSent = Boolean((res as { emailSent?: boolean }).emailSent);
      const nextPick = (res as { pick?: IntelligencePickPreview }).pick;
      if (nextPick) setPick(nextPick);
      setSendNote(
        sent
          ? emailSent
            ? 'Wysłane teraz — klient dostał maila.'
            : 'Wysłane teraz — propozycja jest w panelu.'
          : nextPick?.skipReason || 'Nic nie poszło — brak gotowego kandydata.',
      );
      const preview = await postAgencyClientAction(token, clientId, { action: 'intelligence_preview' });
      if (preview.ok && (preview as { pick?: IntelligencePickPreview }).pick) {
        setPick((preview as { pick: IntelligencePickPreview }).pick);
      }
    } catch {
      setSendNote('Nie udało się wysłać.');
    } finally {
      setSendingNow(false);
    }
  };

  const runPortalHunt = async (mode: 'preview' | 'import') => {
    setHuntBusy(mode);
    setHuntNote(
      mode === 'preview'
        ? 'Szukam na Nieruchomości-Online według ankiety…'
        : 'Importuję z portalu i podaję mózgowi…',
    );
    try {
      const res = await postAgencyClientAction(token, clientId, {
        action: 'portal_hunt',
        mode,
        send: mode === 'import',
      });
      if (!res.ok) {
        setHuntNote(res.message || 'Nie udało się przeszukać portalu.');
        return;
      }
      const hits = Array.isArray((res as { hits?: unknown[] }).hits)
        ? ((res as { hits: typeof huntHits }).hits || []).slice(0, 8)
        : [];
      setHuntHits(hits);
      setHuntNote(String((res as { message?: string }).message || 'Gotowe.'));
      const nextPick = (res as { pick?: IntelligencePickPreview }).pick;
      if (nextPick) setPick(nextPick);
      if (mode === 'import') {
        const preview = await postAgencyClientAction(token, clientId, { action: 'intelligence_preview' });
        if (preview.ok && (preview as { pick?: IntelligencePickPreview }).pick) {
          setPick((preview as { pick: IntelligencePickPreview }).pick);
        }
      }
    } catch {
      setHuntNote('Nie udało się przeszukać Nieruchomości-Online.');
    } finally {
      setHuntBusy(null);
    }
  };

  return (
    <LinearGradient
      colors={['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.frame}
    >
      <View style={[styles.inner, { backgroundColor: colors.card }]}>
        {BUBBLES.map((bubble, index) => (
          <Bubble key={bubble.color} {...bubble} active={draft.enabled} delay={index * 180} />
        ))}
        <View style={{ position: 'relative', zIndex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Tęczowy asystent · EstateOS™ Intelligence</Text>
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
                Uczy się z reakcji klienta i po kilku próbach sam wysyła jedną pewną propozycję w Twoim imieniu.
              </Text>
            </View>
            <Switch
              value={draft.enabled}
              onValueChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
              trackColor={{ false: '#D1D1D6', true: '#BF5AF2' }}
              ios_backgroundColor="#D1D1D6"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Inteligentne dodawanie</Text>
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
                Przy imporcie mózg pyta o balkon, komórkę i ogród z opisu. Zmiany widać na ofercie i można cofnąć.
              </Text>
            </View>
            <Switch
              value={smartAdd}
              onValueChange={(enabled) => void saveSmartAdd(enabled)}
              trackColor={{ false: '#D1D1D6', true: '#BF5AF2' }}
              ios_backgroundColor="#D1D1D6"
            />
          </View>
          <View style={{ gap: 12, marginTop: 12 }}>
            {choiceRow('Interwał', 'intervalHours', INTELLIGENCE_INTERVAL_OPTIONS)}
            {choiceRow('Ofert na cykl (wyśle naraz, gdy cykl minie)', 'dailyLimit', INTELLIGENCE_DAILY_LIMIT_OPTIONS)}
            {choiceRow('Ile reakcji zanim wyśle', 'minLearns', INTELLIGENCE_MIN_LEARNS_OPTIONS)}
            {choiceRow('Minimalna pewność', 'minScore', INTELLIGENCE_MIN_SCORE_OPTIONS)}
          </View>
          {draft.enabled ? (
            <View style={[styles.queue, { borderColor: colors.border, backgroundColor: colors.input }]}>
              {pendingCheckback ? (
                <View style={{ marginBottom: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(245,158,11,0.08)' }}>
                  <Text style={{ color: '#B45309', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>CZEKA NA KLIENTA</Text>
                  <Text style={{ color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 17 }}>{pendingCheckback.body}</Text>
                </View>
              ) : null}
              <Text style={styles.kicker}>Konsola asystenta</Text>
              <Text style={{ color: colors.text, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
                Teraz:{' '}
                {pendingCheckback
                  ? 'asystent czeka na odpowiedź w panelu klienta.'
                  : !draft.enabled
                  ? 'asystent wyłączony.'
                  : queueBusy
                    ? 'analizuję opisy i reakcje…'
                    : pick?.ready && pick.title
                      ? `${pick.title}${pick.calibrating ? ' · kalibracja' : pick.score != null ? ` · ${pick.score}%` : ''}`
                      : pick?.skipReason || 'czeka na cykl albo reakcję.'}
              </Text>
              <Text style={{ color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
                Zaplanowane: gdy cykl minie, wyślę do {draft.dailyLimit}{' '}
                {draft.dailyLimit === 1 ? 'oferty' : 'ofert'} naraz
                {nextWhen ? ` · ${nextWhen}` : ''}.
              </Text>
              {(pick?.lessons || []).length ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
                    LEKCJE Z REAKCJI
                  </Text>
                  {(pick?.lessons || []).slice(0, 3).map((lesson) => (
                    <Text key={lesson.offerId} style={{ color: colors.text, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                      • {lesson.title}: {lesson.said}
                      {lesson.vsNext ? ` · ${lesson.vsNext}` : ''}
                    </Text>
                  ))}
                </View>
              ) : (pick?.learnCount || 0) === 0 ? (
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6 }}>
                  Brak jeszcze lekcji — pierwsza wysyłka to kalibracja.
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.queue, { borderColor: colors.border, backgroundColor: colors.input }]}>
            <Text style={styles.kicker}>Następne w kolejce</Text>
            {queueBusy ? (
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6 }}>Analizuję opisy i reakcje…</Text>
            ) : pick?.offerId ? (
              <>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginTop: 6 }}>{pick.title}</Text>
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 2 }}>
                  {[pick.city, pick.district].filter(Boolean).join(' · ')}
                  {pick.price ? ` · ${Math.round(pick.price).toLocaleString('pl-PL')} zł` : ''}
                  {pick.score != null ? ` · ${pick.score}%` : ''}
                </Text>
                <Text style={{ color: colors.text, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
                  {pick.ready
                    ? `${pick.calibrating ? 'Kalibracja · ' : ''}Wyślę przy najbliższym cyklu${nextWhen ? ` · ${nextWhen}` : ''}`
                    : `${pick.skipReason || 'Czeka na kolejne reakcje.'}${nextWhen ? ` Plan: ${nextWhen}.` : ''}`}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 10 }}>
                  DLACZEGO AKURAT TO
                </Text>
                {(pick.analysis?.length ? pick.analysis : pick.reasons || []).map((line) => (
                  <Text key={line} style={{ color: colors.text, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    • {line}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6 }}>
                {pick?.skipReason || 'Brak jeszcze kandydata w kolejce.'}
              </Text>
            )}
          </View>
          {draft.lastSentAt ? (
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 8 }}>
              Ostatni domysł: {new Date(draft.lastSentAt).toLocaleString('pl-PL')}
            </Text>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={() => onSave(draft)}
            style={[styles.save, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
              {busy ? 'Zapisuję…' : 'Zapisz asystenta i ankietę'}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy || sendingNow || !pick?.offerId}
            onPress={() => void handleSendNow()}
            style={[
              styles.save,
              {
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: busy || sendingNow || !pick?.offerId ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
              {sendingNow ? 'Wysyłam…' : 'Wyślij teraz'}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy || sendingNow || huntBusy != null}
            onPress={() => void runPortalHunt('preview')}
            style={[
              styles.save,
              {
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: busy || sendingNow || huntBusy != null ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
              {huntBusy === 'preview' ? 'Szukam…' : 'Szukaj na N-O'}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy || sendingNow || huntBusy != null}
            onPress={() => void runPortalHunt('import')}
            style={[
              styles.save,
              {
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: busy || sendingNow || huntBusy != null ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
              {huntBusy === 'import' ? 'Importuję…' : 'Importuj i wyślij'}
            </Text>
          </Pressable>
          {sendNote ? (
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 8 }}>{sendNote}</Text>
          ) : null}
          {huntNote ? (
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 8 }}>{huntNote}</Text>
          ) : null}
          {huntHits.map((hit) => (
            <View key={hit.url} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <PortalSourceBadge badge={importPortalBadge(null, hit.url)} />
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800', flex: 1 }}>{hit.title}</Text>
              </View>
              <Text style={{ color: colors.secondary, fontSize: 11, lineHeight: 15 }}>
                {[
                  hit.city,
                  hit.street,
                  hit.price != null ? `${hit.price.toLocaleString('pl-PL')} zł` : null,
                  hit.area != null ? `${hit.area} m²` : null,
                  hit.alreadyImported ? 'już w EstateOS' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Pressable onPress={() => void Linking.openURL(hit.url)}>
                <Text style={{ color: '#0A84FF', fontSize: 11, fontWeight: '800', marginTop: 2 }}>Oryginał na portalu</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 16,
  },
  inner: {
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#7B4DFF',
  },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  queue: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  save: {
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
