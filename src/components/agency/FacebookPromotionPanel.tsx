import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  LayoutAnimation,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { API_URL } from '../../config/network';
import { isFacebookPostPermalink } from '../../lib/marketingChannel';

type Colors = { card: string; border: string; text: string; secondary: string; accent: string; bg: string; input: string };

type Group = {
  id: number;
  name: string;
  url: string;
  city: string | null;
  members: number | null;
  note: string | null;
  lastPostedAt: string | null;
  postedThisOffer: boolean;
};

type ReachItem = {
  id: number;
  channel: 'fb_page' | 'fb_group';
  name: string;
  members: number | null;
  postUrl: string | null;
  publishedAt: string | null;
  visits: number;
  inquiries: number;
  stats: { views: number | null; reactions: number; comments: number; shares: number } | null;
};

type Overview = {
  page: { name: string; url: string | null; followers: number | null; lastError: string | null } | null;
  canExchangeToken: boolean;
  offer: { id: number; city: string | null; title: string } | null;
  groups: Group[];
  reach: {
    items: ReachItem[];
    totals: { publications: number; pageViews: number | null; engagements: number; groups: number; groupMembers: number; visits: number; inquiries: number };
  } | null;
};

type Share = { publicationId: number; groupId: number; groupName: string; groupUrl: string; members: number | null; link: string; text: string };

const FB = '#1877F2';
const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('pl-PL'));
const GRAPH_EXPLORER = 'https://developers.facebook.com/tools/explorer/';

/**
 * Promocja na Facebooku dla jednego ogłoszenia:
 *  1) post na stronie firmy jednym dotknięciem (API Meta),
 *  2) udostępnienie w wybranych grupach biura — aplikacja kopiuje tekst z osobnym linkiem śledzącym,
 *     otwiera grupę i sama wykrywa skopiowany link do posta po powrocie,
 *  3) zasięg: wyświetlenia na stronie, członkowie grup, wejścia i zapytania z każdego miejsca.
 */
export default function FacebookPromotionPanel({
  token,
  clientId,
  offers,
  initialOfferId,
  colors,
  onRecorded,
}: {
  token: string;
  clientId: number;
  offers: Array<{ id: number; title: string }>;
  initialOfferId: number | null;
  colors: Colors;
  onRecorded?: () => void;
}) {
  const [offerId, setOfferId] = useState<number | null>(initialOfferId || offers[0]?.id || null);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [showClient, setShowClient] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [pageToken, setPageToken] = useState('');
  const [pageChoices, setPageChoices] = useState<Array<{ id: string; name: string }> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [gName, setGName] = useState('');
  const [gUrl, setGUrl] = useState('');
  const [gCity, setGCity] = useState('');
  const [gMembers, setGMembers] = useState('');
  const [flow, setFlow] = useState<{ shares: Share[]; index: number; pagePostUrl: string | null } | null>(null);
  const [postUrl, setPostUrl] = useState('');
  const [detected, setDetected] = useState(false);
  const copiedRef = useRef<string>('');
  const openedRef = useRef(false);

  const endpoint = `${API_URL}/api/crm/marketing/facebook`;
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}${offerId ? `?offerId=${offerId}` : ''}`, { headers });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json as Overview);
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers, offerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Facebook', String(json?.error || `Serwer odpowiedział błędem ${res.status}.`));
        return null;
      }
      return json as Record<string, unknown>;
    } catch {
      Alert.alert('Facebook', 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  // ── strona firmy ──
  const connect = async (pageId?: string) => {
    const json = await post('connect', { action: 'connect_page', token: pageToken.trim(), pageId: pageId || null });
    if (!json) return;
    if (json.needsChoice && Array.isArray(json.pages)) {
      setPageChoices(json.pages as Array<{ id: string; name: string }>);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPageToken('');
    setPageChoices(null);
    setConnectOpen(false);
    await load();
  };

  const publishPage = async () => {
    if (!offerId) return;
    const json = await post('publish', { action: 'publish_page', offerId, clientId, visibleToClient: showClient });
    if (!json) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Opublikowane', `Ogłoszenie jest na stronie ${String(json.pageName || 'firmy')}. Teraz udostępnij je w grupach.`, [
      { text: 'Zobacz post', onPress: () => json.postUrl && void Linking.openURL(String(json.postUrl)) },
      { text: 'OK' },
    ]);
    await load();
    onRecorded?.();
  };

  // ── grupy ──
  const groups = data?.groups || [];
  const city = data?.offer?.city || null;
  const toggle = (id: number) => {
    void Haptics.selectionAsync();
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const selectCity = () => {
    const ids = groups.filter((g) => !g.postedThisOffer && (!city || g.city?.toLowerCase() === city.toLowerCase())).map((g) => g.id);
    setSelected(ids.slice(0, 12));
  };

  const saveGroup = async () => {
    const json = await post('group', { action: 'save_group', name: gName, url: gUrl, city: gCity || city, members: gMembers });
    if (!json) return;
    setGName('');
    setGUrl('');
    setGMembers('');
    setAddOpen(false);
    await load();
  };

  const removeGroup = (g: Group) =>
    Alert.alert('Usunąć grupę z listy biura?', `„${g.name}” zniknie z listy. Opublikowane posty i statystyki zostają.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          if (await post(`rm-${g.id}`, { action: 'remove_group', id: g.id })) await load();
        },
      },
    ]);

  const startFlow = async () => {
    if (!offerId || !selected.length) return;
    const json = await post('prepare', { action: 'prepare_groups', offerId, clientId, groupIds: selected });
    if (!json) return;
    setFlow({ shares: (json.shares as Share[]) || [], index: 0, pagePostUrl: (json.pagePostUrl as string) || null });
    setPostUrl('');
    setDetected(false);
  };

  const current = flow ? flow.shares[flow.index] : null;

  const openGroup = async () => {
    if (!current) return;
    await Clipboard.setStringAsync(current.text);
    copiedRef.current = current.text;
    openedRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Linking.openURL(current.groupUrl).catch(() => Alert.alert('Facebook', 'Nie udało się otworzyć grupy.'));
  };

  // Po powrocie z Facebooka: jeśli w schowku jest link do posta, wpisujemy go sami.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !openedRef.current) return;
      openedRef.current = false;
      try {
        const text = (await Clipboard.getStringAsync()).trim();
        if (text && text !== copiedRef.current && isFacebookPostPermalink(text)) {
          setPostUrl(text);
          setDetected(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {
        /* brak dostępu do schowka — agent wklei ręcznie */
      }
    });
    return () => sub.remove();
  }, []);

  const next = async (mode: 'save' | 'nolink' | 'skip') => {
    if (!flow || !current) return;
    if (mode === 'save' && !isFacebookPostPermalink(postUrl)) {
      Alert.alert('Link do posta', 'To link do grupy, a nie do posta. Pod wrzuconym postem: ⋯ → Kopiuj link.');
      return;
    }
    const json = await post('record', {
      action: 'record_group',
      publicationId: current.publicationId,
      postUrl: mode === 'save' ? postUrl.trim() : null,
      skipped: mode === 'skip',
      visibleToClient: showClient,
    });
    if (!json) return;
    if (mode !== 'skip') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPostUrl('');
    setDetected(false);
    if (flow.index + 1 >= flow.shares.length) {
      setFlow(null);
      setSelected([]);
      await load();
      onRecorded?.();
      Alert.alert('Gotowe', 'Udostępnienia zapisane. Wejścia z każdej grupy zobaczysz w statystykach poniżej, a klient w swoim panelu.');
      return;
    }
    setFlow({ ...flow, index: flow.index + 1 });
  };

  const totals = data?.reach?.totals;
  const items = data?.reach?.items || [];

  return (
    <View style={{ gap: 12, marginTop: 10 }}>
      {offers.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {offers.slice(0, 12).map((o) => (
            <Pressable
              key={o.id}
              onPress={() => {
                setOfferId(o.id);
                setSelected([]);
              }}
              style={[styles.chip, { borderColor: o.id === offerId ? FB : colors.border, backgroundColor: o.id === offerId ? 'rgba(24,119,242,0.14)' : colors.input }]}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                {o.id === initialOfferId ? 'To ogłoszenie' : o.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* 1 · Strona firmy */}
      <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={[styles.fbMark]}>
            <Text style={styles.fbF}>f</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h, { color: colors.text }]}>{data?.page ? data.page.name : 'Strona firmy na Facebooku'}</Text>
            <Text style={[styles.sub, { color: colors.secondary }]}>
              {data?.page
                ? `${data.page.followers ? `${fmt(data.page.followers)} obserwujących · ` : ''}publikacja jednym dotknięciem`
                : 'Połącz raz — potem każde ogłoszenie trafia na stronę jednym dotknięciem'}
            </Text>
          </View>
          {loading ? <ActivityIndicator color={colors.secondary} /> : null}
        </View>

        {data?.page?.lastError ? (
          <Text style={[styles.err]}>{data.page.lastError}</Text>
        ) : null}

        {data?.page ? (
          <>
            <View style={styles.switchRow}>
              <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>Pokaż publikacje klientowi w panelu</Text>
              <Switch value={showClient} onValueChange={setShowClient} />
            </View>
            <Pressable
              disabled={!offerId || Boolean(busy)}
              onPress={() => void publishPage()}
              style={[styles.primary, { backgroundColor: FB, opacity: !offerId || busy ? 0.6 : 1 }]}
            >
              {busy === 'publish' ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane" size={16} color="#fff" />}
              <Text style={styles.primaryText}>Opublikuj na stronie firmy</Text>
            </Pressable>
            <Pressable onPress={() => setConnectOpen((v) => !v)} hitSlop={8}>
              <Text style={[styles.link, { color: colors.secondary }]}>Zmień stronę albo połącz ponownie</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => setConnectOpen((v) => !v)} style={[styles.primary, { backgroundColor: FB }]}>
            <Ionicons name="link" size={16} color="#fff" />
            <Text style={styles.primaryText}>Połącz stronę firmy</Text>
          </Pressable>
        )}

        {connectOpen ? (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Text style={[styles.sub, { color: colors.secondary, lineHeight: 18 }]}>
              {'1. Otwórz Graph API Explorer i wybierz aplikację biura.\n2. Dodaj uprawnienia: pages_show_list, pages_manage_posts, pages_read_engagement.\n3. Wygeneruj token, skopiuj go i wklej poniżej.'}
              {data?.canExchangeToken ? '\nToken zamienimy na stały — nie trzeba go odnawiać.' : ''}
            </Text>
            <Pressable onPress={() => void Linking.openURL(GRAPH_EXPLORER)} hitSlop={6}>
              <Text style={[styles.link, { color: FB }]}>Otwórz Graph API Explorer</Text>
            </Pressable>
            <TextInput
              value={pageToken}
              onChangeText={setPageToken}
              placeholder="Wklej token z Facebooka"
              placeholderTextColor={colors.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            {pageChoices ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sub, { color: colors.text, fontWeight: '700' }]}>Którą stronę połączyć?</Text>
                {pageChoices.map((p) => (
                  <Pressable key={p.id} onPress={() => void connect(p.id)} style={[styles.choice, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                disabled={!pageToken.trim() || Boolean(busy)}
                onPress={() => void connect()}
                style={[styles.primary, { backgroundColor: colors.text, opacity: pageToken.trim() ? 1 : 0.4 }]}
              >
                {busy === 'connect' ? <ActivityIndicator color={colors.card} /> : null}
                <Text style={[styles.primaryText, { color: colors.card }]}>Połącz</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      {/* 2 · Grupy */}
      <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Ionicons name="people" size={20} color={FB} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.h, { color: colors.text }]}>Grupy biura · {groups.length}</Text>
            <Text style={[styles.sub, { color: colors.secondary }]}>
              {city ? `Najpierw grupy z miasta ${city}, potem od największych` : 'Od największych'}
            </Text>
          </View>
          <Pressable onPress={() => { LayoutAnimation.easeInEaseOut(); setAddOpen((v) => !v); }} hitSlop={10}>
            <Ionicons name={addOpen ? 'close' : 'add-circle'} size={24} color={FB} />
          </Pressable>
        </View>

        {addOpen ? (
          <View style={{ gap: 8 }}>
            <TextInput value={gName} onChangeText={setGName} placeholder="Nazwa grupy" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <TextInput value={gUrl} onChangeText={setGUrl} placeholder="https://www.facebook.com/groups/…" autoCapitalize="none" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={gCity} onChangeText={setGCity} placeholder={city || 'Miasto'} placeholderTextColor={colors.secondary} style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border }]} />
              <TextInput value={gMembers} onChangeText={setGMembers} placeholder="Członków" keyboardType="number-pad" placeholderTextColor={colors.secondary} style={[styles.input, { width: 120, color: colors.text, borderColor: colors.border }]} />
            </View>
            <Pressable disabled={!gName.trim() || !gUrl.trim() || Boolean(busy)} onPress={() => void saveGroup()} style={[styles.primary, { backgroundColor: colors.text, opacity: gName.trim() && gUrl.trim() ? 1 : 0.4 }]}>
              <Text style={[styles.primaryText, { color: colors.card }]}>Zapisz grupę dla całego biura</Text>
            </Pressable>
          </View>
        ) : null}

        {groups.length ? (
          <>
            <Pressable onPress={selectCity} hitSlop={6}>
              <Text style={[styles.link, { color: FB }]}>{city ? `Zaznacz grupy z miasta ${city}` : 'Zaznacz wszystkie'}</Text>
            </Pressable>
            {groups.map((g) => {
              const on = selected.includes(g.id);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => toggle(g.id)}
                  onLongPress={() => removeGroup(g)}
                  style={[styles.groupRow, { borderColor: on ? FB : colors.border, backgroundColor: on ? 'rgba(24,119,242,0.1)' : 'transparent' }]}
                >
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? FB : colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={[styles.sub, { color: colors.secondary }]} numberOfLines={1}>
                      {[g.city, g.members ? `${fmt(g.members)} członków` : null, g.postedThisOffer ? 'to ogłoszenie już tu jest' : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              disabled={!selected.length || !offerId || Boolean(busy)}
              onPress={() => void startFlow()}
              style={[styles.primary, { backgroundColor: FB, opacity: selected.length && offerId ? 1 : 0.4 }]}
            >
              {busy === 'prepare' ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-social" size={16} color="#fff" />}
              <Text style={styles.primaryText}>
                {selected.length ? `Udostępnij w ${selected.length} ${selected.length === 1 ? 'grupie' : 'grupach'}` : 'Zaznacz grupy'}
              </Text>
            </Pressable>
            <Text style={[styles.sub, { color: colors.secondary }]}>Przytrzymaj grupę, aby usunąć ją z listy biura.</Text>
          </>
        ) : !addOpen ? (
          <Text style={[styles.sub, { color: colors.secondary }]}>Dodaj grupy, w których biuro publikuje (+). Lista jest wspólna dla wszystkich agentów biura.</Text>
        ) : null}
      </View>

      {/* 3 · Zasięg */}
      {totals && items.length ? (
        <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Ionicons name="stats-chart" size={18} color={colors.accent} />
            <Text style={[styles.h, { color: colors.text, flex: 1 }]}>Zasięg tego ogłoszenia</Text>
            <Pressable onPress={async () => { if (await post('stats', { action: 'refresh_stats', offerId })) await load(); }} hitSlop={10}>
              {busy === 'stats' ? <ActivityIndicator color={colors.secondary} /> : <Ionicons name="refresh" size={18} color={colors.secondary} />}
            </Pressable>
          </View>
          <View style={styles.tiles}>
            {totals.pageViews != null ? <Tile label="wyświetleń na stronie" value={totals.pageViews} colors={colors} /> : null}
            {totals.groups ? <Tile label={`członków w ${totals.groups} grupach`} value={totals.groupMembers} colors={colors} /> : null}
            <Tile label="wejść z promocji" value={totals.visits} colors={colors} />
            <Tile label="zapytań" value={totals.inquiries} colors={colors} />
          </View>
          {items.slice(0, 15).map((it) => (
            <Pressable key={it.id} disabled={!it.postUrl} onPress={() => it.postUrl && void Linking.openURL(it.postUrl)} style={[styles.statRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  {it.channel === 'fb_page' ? 'Strona: ' : ''}
                  {it.name}
                </Text>
                <Text style={[styles.sub, { color: colors.secondary }]} numberOfLines={1}>
                  {[
                    it.publishedAt ? new Date(it.publishedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : null,
                    it.stats ? `${fmt(it.stats.views)} wyśw. · ${it.stats.reactions} reakcji · ${it.stats.comments} kom. · ${it.stats.shares} udost.` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{fmt(it.visits)}</Text>
                <Text style={[styles.sub, { color: colors.secondary }]}>wejść{it.inquiries ? ` · ${it.inquiries} zap.` : ''}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Przewodnik po grupach */}
      <Modal visible={Boolean(flow && current)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFlow(null)}>
        {flow && current ? (
          <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
            <View style={styles.row}>
              <Text style={[styles.sub, { color: colors.secondary, flex: 1 }]}>
                Grupa {flow.index + 1} z {flow.shares.length}
              </Text>
              <Pressable onPress={() => setFlow(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.secondary} />
              </Pressable>
            </View>
            <View style={styles.progress}>
              {flow.shares.map((s, i) => (
                <View key={s.publicationId} style={[styles.progressSeg, { backgroundColor: i <= flow.index ? FB : colors.border }]} />
              ))}
            </View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{current.groupName}</Text>
            {current.members ? <Text style={[styles.sub, { color: colors.secondary }]}>{fmt(current.members)} członków</Text> : null}

            <View style={[styles.step, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.stepNum, { color: FB }]}>1</Text>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Skopiuj tekst i otwórz grupę</Text>
                <Text style={[styles.sub, { color: colors.secondary }]}>
                  W grupie: „Napisz coś…” → wklej. Link w tekście sam pokaże kartę ze zdjęciem ogłoszenia; możesz dodać więcej zdjęć z galerii.
                </Text>
                <Pressable onPress={() => void openGroup()} style={[styles.primary, { backgroundColor: FB }]}>
                  <Ionicons name="copy" size={16} color="#fff" />
                  <Text style={styles.primaryText}>Kopiuj tekst i otwórz grupę</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.step, { borderColor: detected ? '#34C759' : colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.stepNum, { color: FB }]}>2</Text>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {detected ? 'Mamy link do posta' : 'Po publikacji skopiuj link do posta'}
                </Text>
                <Text style={[styles.sub, { color: colors.secondary }]}>
                  {detected ? 'Wykryliśmy go w schowku po powrocie z Facebooka.' : 'Pod postem: ⋯ → Kopiuj link, wróć tutaj — wpiszemy go sami.'}
                </Text>
                <TextInput
                  value={postUrl}
                  onChangeText={(v) => {
                    setPostUrl(v);
                    setDetected(false);
                  }}
                  placeholder="https://www.facebook.com/groups/…/posts/…"
                  placeholderTextColor={colors.secondary}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
                <Pressable
                  disabled={Boolean(busy) || !isFacebookPostPermalink(postUrl)}
                  onPress={() => void next('save')}
                  style={[styles.primary, { backgroundColor: '#34C759', opacity: isFacebookPostPermalink(postUrl) ? 1 : 0.4 }]}
                >
                  {busy === 'record' ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                  <Text style={styles.primaryText}>{flow.index + 1 < flow.shares.length ? 'Zapisz i następna grupa' : 'Zapisz i zakończ'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Pressable onPress={() => void next('nolink')} hitSlop={8}>
                <Text style={[styles.link, { color: colors.secondary }]}>Opublikowane, bez linku</Text>
              </Pressable>
              <Pressable onPress={() => void next('skip')} hitSlop={8}>
                <Text style={[styles.link, { color: colors.secondary }]}>Pomiń tę grupę</Text>
              </Pressable>
            </View>
            {flow.pagePostUrl ? (
              <Pressable onPress={() => void Linking.openURL(flow.pagePostUrl as string)} hitSlop={8} style={{ marginTop: 14 }}>
                <Text style={[styles.link, { color: FB }]}>Albo udostępnij post ze strony firmy (Udostępnij → W grupie)</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function Tile({ label, value, colors }: { label: string; value: number; colors: Colors }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.input }]}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{fmt(value)}</Text>
      <Text style={[styles.sub, { color: colors.secondary }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  h: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, lineHeight: 16 },
  err: { color: '#FF453A', fontSize: 12, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '700' },
  fbMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: FB, alignItems: 'center', justifyContent: 'center' },
  fbF: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 12, paddingHorizontal: 14 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  choice: { borderWidth: 1, borderRadius: 12, padding: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 220 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: 12, padding: 10, gap: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  sheet: { flex: 1, padding: 20, paddingTop: 18, gap: 12 },
  sheetTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  progress: { flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  step: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  stepNum: { fontSize: 20, fontWeight: '900', width: 18 },
});
