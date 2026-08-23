import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { postAgencyClientAction } from '../../services/agencyClientService';
import { API_URL } from '../../config/network';

export type IntelligenceSettings = {
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  minLearns: number;
  minScore: number;
  lastSentAt: string | null;
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
};

export const DEFAULT_INTELLIGENCE_SETTINGS: IntelligenceSettings = {
  enabled: false,
  intervalHours: 24,
  dailyLimit: 1,
  minLearns: 3,
  minScore: 92,
  lastSentAt: null,
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
  onSave,
}: {
  clientId: number;
  token: string;
  value?: IntelligenceSettings | null;
  colors: { text: string; secondary: string; accent: string; border: string; card: string; input: string };
  busy?: boolean;
  onSave: (next: IntelligenceSettings) => void;
}) {
  const [draft, setDraft] = useState<IntelligenceSettings>(value || DEFAULT_INTELLIGENCE_SETTINGS);
  const [pick, setPick] = useState<IntelligencePickPreview | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [smartAdd, setSmartAdd] = useState(false);

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

  const field = (label: string, key: 'intervalHours' | 'dailyLimit' | 'minLearns' | 'minScore', min: number, max: number) => (
    <View style={{ flex: 1, minWidth: '46%' }}>
      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(draft[key] ?? '')}
        onChangeText={(raw) => {
          const n = Number(raw.replace(/\D/g, ''));
          setDraft((current) => ({ ...current, [key]: Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min }));
        }}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
      />
    </View>
  );

  const nextWhen = pick?.nextSendAt
    ? new Date(pick.nextSendAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {field('Interwał (godziny)', 'intervalHours', 6, 168)}
            {field('Ofert na cykl', 'dailyLimit', 1, 3)}
            {field('Ile reakcji zanim wyśle', 'minLearns', 1, 12)}
            {field('Minimalna pewność (%)', 'minScore', 70, 100)}
          </View>
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
                    ? `Wyślę przy najbliższym cyklu${nextWhen ? ` · ${nextWhen}` : ''}`
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
              {busy ? 'Zapisuję…' : 'Zapisz asystenta'}
            </Text>
          </Pressable>
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
