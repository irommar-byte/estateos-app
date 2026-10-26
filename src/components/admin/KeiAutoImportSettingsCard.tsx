import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  KEI_FALLBACK_DISTRICTS,
  keiAutoIntervalLabel,
  type KeiAutoImportConfig,
  type KeiAutoImportSettings,
  type KeiTargetUserOption,
} from '../../contracts/keiAmerContract';
import { keiAmerFetchAutoImport, keiAmerFetchTargetUsers, keiAmerSaveAutoImport } from '../../services/keiAmerService';
import { LUX_SERIF } from '../clientPortal/lux/luxTheme';
import { useKeiPalette, type KeiPalette } from './keiPalette';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DEFAULT_SETTINGS: KeiAutoImportSettings = {
  districts: [],
  minPrice: null,
  maxPrice: null,
  minArea: null,
  maxArea: null,
  minRooms: null,
  maxRooms: null,
  maxAgeHours: 72,
  directOwnerOnly: false,
  requirePhone: true,
  minImages: 3,
  publishMode: 'publish',
  activeFromHour: 7,
  activeToHour: 22,
  dailyLimit: 30,
  portals: ['otodom', 'olx', 'nieruchomosci-online'],
};

const AGE_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: 24, label: '24 h' },
  { value: 48, label: '2 dni' },
  { value: 72, label: '3 dni' },
  { value: 168, label: 'Tydzień' },
  { value: null, label: 'Bez limitu' },
];

type Draft = {
  intervalMinutes: number;
  count: number;
  targetUserId: number;
  targetName: string | null;
  agentCommissionPercent: number;
  propertyKind: 'apartment' | 'house';
  transactionKind: 'sale' | 'rent';
  settings: KeiAutoImportSettings;
};

function draftFrom(config: KeiAutoImportConfig): Draft {
  return {
    intervalMinutes: config.intervalMinutes,
    count: config.count,
    targetUserId: config.targetUserId,
    targetName: config.targetUser ? config.targetUser.name || config.targetUser.email : null,
    agentCommissionPercent: config.agentCommissionPercent,
    propertyKind: config.propertyKind,
    transactionKind: config.transactionKind,
    settings: { ...DEFAULT_SETTINGS, ...(config.settings || {}) },
  };
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const time = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
  const day = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  const today = new Date();
  if (day(date) === day(today)) return `dziś ${time}`;
  if (day(date) === day(new Date(today.getTime() + 86_400_000))) return `jutro ${time}`;
  return `${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' })}, ${time}`;
}

function numOrNull(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return raw.trim() && Number.isFinite(n) ? n : null;
}

function Seg<T extends string>(props: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; palette: KeiPalette }) {
  return (
    <View style={[s.seg, { backgroundColor: props.palette.well, borderColor: props.palette.line }]}>
      {props.options.map((opt) => {
        const on = opt.id === props.value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              void Haptics.selectionAsync();
              props.onChange(opt.id);
            }}
            style={[s.segBtn, on && { backgroundColor: props.palette.card }]}
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.segText, { color: on ? props.palette.ink : props.palette.ink2 }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip(props: { label: string; on: boolean; onPress: () => void; palette: KeiPalette }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        s.chip,
        {
          backgroundColor: props.on ? props.palette.goldSoft : props.palette.neutralSoft,
          borderColor: props.on ? 'transparent' : props.palette.line,
        },
      ]}
      accessibilityState={{ selected: props.on }}
    >
      <Text style={[s.chipText, { color: props.on ? props.palette.goldInk : props.palette.ink2 }]}>{props.label}</Text>
    </Pressable>
  );
}

function Field(props: { label: string; children: React.ReactNode; palette: KeiPalette; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: props.palette.ink2 }]}>{props.label}</Text>
      {props.children}
      {props.hint ? <Text style={[s.hint, { color: props.palette.ink3 }]}>{props.hint}</Text> : null}
    </View>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder?: string; palette: KeiPalette; suffix?: string }) {
  return (
    <View style={[s.input, { borderColor: props.palette.line, backgroundColor: props.palette.card }]}>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={props.palette.ink3}
        keyboardType="decimal-pad"
        style={[s.inputText, { color: props.palette.ink }]}
      />
      {props.suffix ? <Text style={{ color: props.palette.ink3, fontSize: 12 }}>{props.suffix}</Text> : null}
    </View>
  );
}

export function AgentPicker(props: {
  token: string;
  visible: boolean;
  onClose: () => void;
  onPick: (user: KeiTargetUserOption) => void;
  palette: KeiPalette;
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<KeiTargetUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!props.visible) return;
    const timer = setTimeout(() => {
      setLoading(true);
      keiAmerFetchTargetUsers(props.token, query)
        .then(setUsers)
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [props.visible, props.token, query]);
  const p = props.palette;
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={[s.pickerHead, { borderBottomColor: p.line }]}>
          <Text style={[s.pickerTitle, { color: p.ink }]}>Agent prowadzący</Text>
          <Pressable onPress={props.onClose} hitSlop={10}>
            <Text style={{ color: p.ink2, fontSize: 15, fontWeight: '600' }}>Zamknij</Text>
          </Pressable>
        </View>
        <View style={[s.search, { backgroundColor: p.well }]}>
          <Ionicons name="search" size={16} color={p.ink3} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj po nazwisku, e-mailu lub firmie"
            placeholderTextColor={p.ink3}
            style={{ flex: 1, color: p.ink, fontSize: 15, paddingVertical: 10 }}
          />
          {loading ? <ActivityIndicator size="small" color={p.gold} /> : null}
        </View>
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={!loading ? <Text style={{ color: p.ink3, textAlign: 'center', marginTop: 24 }}>Brak pasujących kont.</Text> : null}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                props.onPick(item);
              }}
              style={({ pressed }) => [s.userRow, { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: p.ink, fontSize: 15, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: p.ink3, fontSize: 12.5, marginTop: 2 }}>
                {item.email}
                {item.companyName ? ` · ${item.companyName}` : ''}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

/** Harmonogram automatycznego importu KEI — ta sama logika i wygląd co na www. */
export default function KeiAutoImportSettingsCard({ token, onChanged }: { token: string | null; onChanged?: (c: KeiAutoImportConfig) => void }) {
  const p = useKeiPalette();
  const [config, setConfig] = useState<KeiAutoImportConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const apply = useCallback(
    (next: KeiAutoImportConfig) => {
      setConfig(next);
      const d = draftFrom(next);
      setDraft(d);
      setSaved(d);
      onChanged?.(next);
    },
    [onChanged],
  );

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = () =>
      keiAmerFetchAutoImport(token)
        .then((res) => {
          if (!alive || !res.config) return;
          setConfig(res.config);
          setSaved(draftFrom(res.config));
          setDraft((current) => current ?? draftFrom(res.config));
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token]);

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return JSON.stringify({ ...draft, targetName: null }) !== JSON.stringify({ ...saved, targetName: null });
  }, [draft, saved]);

  const save = async (enabled?: boolean) => {
    if (!token || !draft || !config) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await keiAmerSaveAutoImport(token, {
        enabled: enabled ?? config.enabled,
        intervalMinutes: draft.intervalMinutes,
        count: draft.count,
        targetUserId: draft.targetUserId,
        agentCommissionPercent: draft.agentCommissionPercent,
        propertyKind: draft.propertyKind,
        transactionKind: draft.transactionKind,
        settings: draft.settings,
      });
      apply(res.config);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice(enabled === true ? 'Włączony — pierwszy cykl ruszy w ciągu minuty.' : enabled === false ? 'Automatyczny import wyłączony.' : 'Ustawienia zapisane.');
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać ustawień.');
    } finally {
      setSaving(false);
    }
  };

  if (!config || !draft || !token) {
    return (
      <View style={[s.card, { backgroundColor: p.card, borderColor: p.line, alignItems: 'center', paddingVertical: 30 }]}>
        <ActivityIndicator color={p.gold} />
      </View>
    );
  }

  const setSetting = <K extends keyof KeiAutoImportSettings>(key: K, value: KeiAutoImportSettings[K]) =>
    setDraft((d) => (d ? { ...d, settings: { ...d.settings, [key]: value } } : d));
  const tone = !config.enabled
    ? { color: p.ink3, label: 'Wyłączony' }
    : config.workerAlive === false
      ? { color: p.danger, label: 'Worker nie odpowiada' }
      : (config.consecutiveErrors || 0) > 0
        ? { color: p.danger, label: 'Przerwa po błędzie' }
        : config.waitingReason
          ? { color: p.warn, label: 'Czeka' }
          : { color: p.good, label: 'Działa' };
  const statusText = !config.enabled
    ? 'Import tylko ręcznie.'
    : config.waitingReason || (config.nextRunAt ? `Następny cykl ${formatWhen(config.nextRunAt)}` : 'Cykl rusza za chwilę.');
  const st = draft.settings;
  const summary = [
    draft.propertyKind === 'house' ? 'Domy' : 'Mieszkania',
    draft.transactionKind === 'rent' ? 'najem' : 'sprzedaż',
    `co ${keiAutoIntervalLabel(draft.intervalMinutes)}`,
    `${draft.count} na cykl`,
    st.districts.length ? st.districts.join(', ') : 'cała Warszawa',
    draft.targetName ? `→ ${draft.targetName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[s.card, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: p.goldInk }]}>AUTOMATYCZNY IMPORT KEI</Text>
          <Text style={[s.title, { color: p.ink }]}>Harmonogram ofert</Text>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: tone.color }]} />
            <Text style={[s.statusText, { color: p.ink2 }]}>
              <Text style={{ color: tone.color, fontWeight: '600' }}>{tone.label}</Text> · {statusText}
            </Text>
          </View>
        </View>
        <Switch
          value={config.enabled}
          disabled={saving}
          onValueChange={(value) => void save(value)}
          trackColor={{ true: p.good, false: p.lineStrong }}
        />
      </View>

      <View style={[s.kpis, { borderColor: p.line }]}>
        {[
          { label: 'Dziś', value: `${config.dayImportedCount ?? 0}${st.dailyLimit ? ` / ${st.dailyLimit}` : ''}` },
          { label: 'Od włączenia', value: String(config.sessionImportedCount ?? 0) },
          { label: 'Cykle', value: String(config.sessionCycles ?? 0) },
        ].map((kpi, idx) => (
          <View key={kpi.label} style={[s.kpi, idx > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.line }]}>
            <Text style={[s.kpiLabel, { color: p.ink3 }]}>{kpi.label}</Text>
            <Text style={[s.kpiValue, { color: p.ink }]}>{kpi.value}</Text>
          </View>
        ))}
      </View>

      {config.lastError ? (
        <View style={[s.errorBox, { backgroundColor: p.dangerSoft }]}>
          <Ionicons name="alert-circle" size={16} color={p.danger} />
          <Text style={{ color: p.danger, fontSize: 12.5, flex: 1 }}>
            {config.lastErrorAt ? `${formatWhen(config.lastErrorAt)} · ` : ''}
            {config.lastError}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((v) => !v);
        }}
        style={s.expander}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.expanderTitle, { color: p.ink }]}>Co i jak importujemy</Text>
          <Text numberOfLines={2} style={[s.expanderSub, { color: p.ink3 }]}>
            {summary}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={p.ink3} />
      </Pressable>

      {expanded ? (
        <View style={{ gap: 18, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Seg
              palette={p}
              value={draft.propertyKind}
              onChange={(propertyKind) => setDraft({ ...draft, propertyKind })}
              options={[
                { id: 'apartment', label: 'Mieszkania' },
                { id: 'house', label: 'Domy' },
              ]}
            />
            <Seg
              palette={p}
              value={draft.transactionKind}
              onChange={(transactionKind) => setDraft({ ...draft, transactionKind })}
              options={[
                { id: 'sale', label: 'Sprzedaż' },
                { id: 'rent', label: 'Najem' },
              ]}
            />
          </View>
          <Field label="Dzielnice" palette={p} hint={st.districts.length ? `${st.districts.length} wybranych` : 'Cała Warszawa'}>
            <View style={s.chips}>
              {KEI_FALLBACK_DISTRICTS.map((d) => {
                const name = d.label;
                const on = st.districts.includes(name);
                return (
                  <Chip
                    key={name}
                    palette={p}
                    label={name}
                    on={on}
                    onPress={() => setSetting('districts', on ? st.districts.filter((x) => x !== name) : [...st.districts, name])}
                  />
                );
              })}
            </View>
          </Field>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Cena od" palette={p}>
                <Input palette={p} value={st.minPrice != null ? String(st.minPrice) : ''} onChange={(v) => setSetting('minPrice', numOrNull(v))} suffix="zł" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cena do" palette={p}>
                <Input palette={p} value={st.maxPrice != null ? String(st.maxPrice) : ''} onChange={(v) => setSetting('maxPrice', numOrNull(v))} suffix="zł" />
              </Field>
            </View>
          </View>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Metraż od" palette={p}>
                <Input palette={p} value={st.minArea != null ? String(st.minArea) : ''} onChange={(v) => setSetting('minArea', numOrNull(v))} suffix="m²" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Metraż do" palette={p}>
                <Input palette={p} value={st.maxArea != null ? String(st.maxArea) : ''} onChange={(v) => setSetting('maxArea', numOrNull(v))} suffix="m²" />
              </Field>
            </View>
          </View>
          <Field label="Wiek ogłoszenia" palette={p}>
            <View style={s.chips}>
              {AGE_OPTIONS.map((opt) => (
                <Chip key={String(opt.value)} palette={p} label={opt.label} on={st.maxAgeHours === opt.value} onPress={() => setSetting('maxAgeHours', opt.value)} />
              ))}
            </View>
          </Field>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleTitle, { color: p.ink }]}>Tylko bez pośredników</Text>
              <Text style={[s.hint, { color: p.ink3 }]}>Ogłoszenia oznaczone w KEI jako prywatne.</Text>
            </View>
            <Switch value={st.directOwnerOnly} onValueChange={(v) => setSetting('directOwnerOnly', v)} trackColor={{ true: p.good, false: p.lineStrong }} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleTitle, { color: p.ink }]}>Wymagaj telefonu</Text>
              <Text style={[s.hint, { color: p.ink3 }]}>Bez telefonu nie zadzwonisz do właściciela.</Text>
            </View>
            <Switch value={st.requirePhone} onValueChange={(v) => setSetting('requirePhone', v)} trackColor={{ true: p.good, false: p.lineStrong }} />
          </View>

          <View style={[s.divider, { backgroundColor: p.line }]} />
          <Field label="Co ile" palette={p}>
            <View style={s.chips}>
              {KEI_AUTO_INTERVALS_MIN.map((min) => (
                <Chip key={min} palette={p} label={keiAutoIntervalLabel(min)} on={draft.intervalMinutes === min} onPress={() => setDraft({ ...draft, intervalMinutes: min })} />
              ))}
            </View>
          </Field>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label={`Ofert na cykl (max ${KEI_AUTO_MAX_COUNT})`} palette={p}>
                <Input
                  palette={p}
                  value={String(draft.count)}
                  onChange={(v) => setDraft({ ...draft, count: Math.min(KEI_AUTO_MAX_COUNT, Math.max(1, Number(v) || 1)) })}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Limit dzienny" palette={p}>
                <Input palette={p} value={String(st.dailyLimit)} onChange={(v) => setSetting('dailyLimit', Math.max(0, Number(v) || 0))} />
              </Field>
            </View>
          </View>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Pracuje od godz." palette={p}>
                <Input palette={p} value={String(st.activeFromHour)} onChange={(v) => setSetting('activeFromHour', Math.min(23, Math.max(0, Number(v) || 0)))} suffix=":00" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="do godz." palette={p}>
                <Input palette={p} value={String(st.activeToHour)} onChange={(v) => setSetting('activeToHour', Math.min(24, Math.max(0, Number(v) || 0)) % 24)} suffix=":00" />
              </Field>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: p.line }]} />
          <Field label="Agent prowadzący" palette={p}>
            <Pressable onPress={() => setPickerOpen(true)} style={[s.input, { borderColor: p.line, backgroundColor: p.card }]}>
              <Text style={{ flex: 1, color: draft.targetName ? p.ink : p.ink3, fontSize: 15 }}>
                {draft.targetName || `Konto #${draft.targetUserId}`}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={p.ink3} />
            </Pressable>
          </Field>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Prowizja" palette={p}>
                <Input
                  palette={p}
                  value={String(draft.agentCommissionPercent)}
                  onChange={(v) => setDraft({ ...draft, agentCommissionPercent: Math.min(10, Math.max(0, numOrNull(v) ?? 0)) })}
                  suffix="%"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Min. zdjęć" palette={p}>
                <Input palette={p} value={String(st.minImages)} onChange={(v) => setSetting('minImages', Math.min(20, Math.max(0, Number(v) || 0)))} />
              </Field>
            </View>
          </View>
          <Field label="Po imporcie" palette={p} hint="Oferta z mniejszą liczbą zdjęć niż minimum zostaje szkicem.">
            <Seg
              palette={p}
              value={st.publishMode}
              onChange={(v) => setSetting('publishMode', v)}
              options={[
                { id: 'publish', label: 'Od razu na rynek' },
                { id: 'review', label: 'Szkic do przejrzenia' },
              ]}
            />
          </Field>
        </View>
      ) : null}

      {dirty || error || notice ? (
        <View style={[s.saveBar, { borderTopColor: p.line }]}>
          <Text style={{ flex: 1, fontSize: 12.5, color: error ? p.danger : dirty ? p.ink2 : p.good }}>
            {error || (dirty ? 'Masz niezapisane zmiany.' : notice)}
          </Text>
          {dirty ? (
            <>
              <Pressable onPress={() => setDraft(saved)} hitSlop={8} style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: p.ink2, fontWeight: '600' }}>Cofnij</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void save()}
                style={({ pressed }) => [s.saveBtn, { backgroundColor: p.isDark ? p.gold : p.ink, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color={p.isDark ? '#0D0C0B' : '#F3E7CF'} size="small" />
                ) : (
                  <Text style={{ color: p.isDark ? '#0D0C0B' : '#F3E7CF', fontWeight: '700', fontSize: 13.5 }}>Zapisz</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      <AgentPicker
        token={token}
        visible={pickerOpen}
        palette={p}
        onClose={() => setPickerOpen(false)}
        onPick={(user) => {
          setDraft({ ...draft, targetUserId: user.id, targetName: user.name || user.email });
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth * 2, padding: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: LUX_SERIF, fontSize: 23, marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, flex: 1 },
  kpis: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  kpi: { flex: 1, paddingVertical: 12, paddingHorizontal: 10 },
  kpiLabel: { fontSize: 11 },
  kpiValue: { fontSize: 19, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
  errorBox: { flexDirection: 'row', gap: 8, borderRadius: 14, padding: 12 },
  expander: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expanderTitle: { fontSize: 14, fontWeight: '600' },
  expanderSub: { fontSize: 12.5, marginTop: 2 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  segBtn: { paddingHorizontal: 12, height: 32, borderRadius: 9, justifyContent: 'center' },
  segText: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 99, paddingHorizontal: 12, height: 32, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 16 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, height: 44 },
  inputText: { flex: 1, fontSize: 15 },
  row2: { flexDirection: 'row', gap: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  saveBtn: { borderRadius: 12, paddingHorizontal: 18, height: 38, justifyContent: 'center' },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerTitle: { fontFamily: LUX_SERIF, fontSize: 22 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 4, borderRadius: 12, paddingHorizontal: 12 },
  userRow: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14 },
});
