import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useI18n } from '../i18n';
import { API_URL } from '../config/network';
import OpenHouseSlotBuilder from '../components/openHouse/OpenHouseSlotBuilder';
import type { OpenHouseSlotDraft, OpenHouseVisitMode } from '../contracts/openHouseContract';
import {
  createOpenHouseEvent,
  estimateOpenHouseSlotCount,
  slotDraftToApiPayload,
} from '../services/openHouseService';

type OfferRow = { id: number; title: string; city: string; district: string };

function defaultSlots(): OpenHouseSlotDraft[] {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return [{ date: d, startHour: '10:00', endHour: '14:00', capacity: 8 }];
}

export default function OpenHouseCreateScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visitMode, setVisitMode] = useState<OpenHouseVisitMode>('SLOT_60');
  const [slots, setSlots] = useState<OpenHouseSlotDraft[]>(defaultSlots);

  const bg = isDark ? '#000000' : '#F2F2F7';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    if (!token || !user?.id) return;
    void (async () => {
      setLoadingOffers(true);
      try {
        const res = await fetch(`${API_URL}/api/mobile/v1/offers?userId=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const rows = (Array.isArray(json?.offers) ? json.offers : [])
          .filter((o: any) => String(o?.status || '').toUpperCase() === 'ACTIVE')
          .map((o: any) => ({
            id: Number(o.id),
            title: String(o.title || ''),
            city: String(o.city || ''),
            district: String(o.district || ''),
          }));
        setOffers(rows);
        if (rows[0]) setSelectedOfferId(rows[0].id);
      } finally {
        setLoadingOffers(false);
      }
    })();
  }, [token, user?.id]);

  const generatedCount = useMemo(
    () => estimateOpenHouseSlotCount(slots, visitMode),
    [slots, visitMode]
  );

  const canSubmit = useMemo(
    () => Boolean(token && selectedOfferId && slots.length && generatedCount > 0 && generatedCount <= 48),
    [token, selectedOfferId, slots.length, generatedCount]
  );

  const publish = async (asDraft = false) => {
    if (!token || !selectedOfferId) return;
    if (!slots.length) {
      Alert.alert(t('openHouse.create.title'), t('openHouse.create.slotRequired'));
      return;
    }
    setSubmitting(true);
    const result = await createOpenHouseEvent(token, {
      offerId: selectedOfferId,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      visitMode,
      slots: slotDraftToApiPayload(slots),
      publish: !asDraft,
    });
    setSubmitting(false);

    if (!result.event) {
      Alert.alert(t('openHouse.create.title'), result.message || t('common.error'));
      return;
    }

    Alert.alert(t('openHouse.create.successTitle'), t('openHouse.create.successBody'), [
      {
        text: 'OK',
        onPress: () =>
          navigation.replace('OpenHouseEvent', { eventId: result.event!.id }),
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </Pressable>
        <Text style={[styles.title, { color: text }]}>{t('openHouse.create.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <View style={[styles.section, { backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.create.stepOffer')}</Text>
          {loadingOffers ? (
            <ActivityIndicator color="#F59E0B" />
          ) : offers.length ? (
            offers.map((offer) => {
              const selected = selectedOfferId === offer.id;
              return (
                <Pressable
                  key={offer.id}
                  onPress={() => setSelectedOfferId(offer.id)}
                  style={[
                    styles.offerRow,
                    { borderColor: border, backgroundColor: selected ? 'rgba(245,158,11,0.12)' : 'transparent' },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? '#F59E0B' : '#C7C7CC'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.offerTitle, { color: text }]}>{offer.title}</Text>
                    <Text style={{ color: muted, fontSize: 13 }}>
                      {offer.city} · {offer.district}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={{ color: muted }}>{t('openHouse.create.noOffers')}</Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.create.eventTitle')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('openHouse.create.eventTitle')}
            placeholderTextColor={muted}
            style={[styles.input, { color: text, borderColor: border }]}
          />
          <Text style={[styles.sectionTitle, { color: text, marginTop: 12 }]}>
            {t('openHouse.create.eventDescription')}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder={t('openHouse.create.eventDescription')}
            placeholderTextColor={muted}
            style={[styles.input, styles.textArea, { color: text, borderColor: border }]}
          />
        </View>

        <View style={[styles.section, { backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.create.visitModeSection')}</Text>
          {(
            [
              ['FLEX', t('openHouse.create.visitModeFlex'), t('openHouse.create.visitModeFlexHint')],
              ['SLOT_30', t('openHouse.create.visitModeSlot30'), t('openHouse.create.visitModeSlot30Hint')],
              ['SLOT_60', t('openHouse.create.visitModeSlot60'), t('openHouse.create.visitModeSlot60Hint')],
            ] as const
          ).map(([mode, label, hint]) => {
            const selected = visitMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => {
                  setVisitMode(mode);
                  if (mode !== 'FLEX') {
                    setSlots((prev) => prev.map((s) => ({ ...s, capacity: 1 })));
                  }
                }}
                style={[
                  styles.modeRow,
                  { borderColor: border, backgroundColor: selected ? 'rgba(245,158,11,0.12)' : 'transparent' },
                ]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? '#F59E0B' : '#C7C7CC'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.offerTitle, { color: text }]}>{label}</Text>
                  <Text style={{ color: muted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.section, { backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.create.stepSlots')}</Text>
          <Text style={{ color: muted, fontSize: 13 }}>
            {generatedCount > 0
              ? t('openHouse.create.slotsPreview', { n: String(generatedCount) })
              : t('openHouse.create.slotRequired')}
          </Text>
          <OpenHouseSlotBuilder
            isDark={isDark}
            visitMode={visitMode}
            slots={slots}
            onChange={setSlots}
          />
        </View>

        <Pressable
          disabled={!canSubmit || submitting}
          onPress={() => void publish(false)}
          style={[styles.primaryBtn, (!canSubmit || submitting) && { opacity: 0.6 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('openHouse.create.publish')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800' },
  section: { borderRadius: 16, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  offerTitle: { fontSize: 15, fontWeight: '700' },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
