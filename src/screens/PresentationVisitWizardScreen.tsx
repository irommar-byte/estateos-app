import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../store/useAuthStore';
import { parsePesel, formatPeselDecode } from '../lib/pesel';
import {
  completePresentationVisit,
  refreshClientMatches,
} from '../services/agencyClientService';
import {
  buildPostVisitEmail,
  buildPostVisitSms,
  mailtoUrl,
  smsUrl,
  type DebriefOutcome,
} from '../lib/visitMessageCopy';
import { SITE_ORIGIN } from '../utils/offerShareUrls';

const STEPS = ['Ofertówka', 'Pokaz', 'Rozmowa', 'PESEL', 'Potwierdzenie'] as const;

export default function PresentationVisitWizardScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s: any) => s.token);
  const user = useAuthStore((s: any) => s.user);
  const p = (route?.params || {}) as {
    clientId: number;
    offerId?: number;
    clientName?: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientPesel?: string | null;
    offerTitle?: string;
    portalUrl?: string;
    viewingStartsAt?: string | null;
  };
  const clientId = Number(p.clientId);
  const offerId = Number(p.offerId || 0) || null;
  const viewingLabel = useMemo(() => {
    const raw = p.viewingStartsAt || null;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [p.viewingStartsAt]);

  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState<DebriefOutcome | null>(null);
  const [priceHint, setPriceHint] = useState('');
  const [remindDays, setRemindDays] = useState(5);
  const [liked, setLiked] = useState('');
  const [disliked, setDisliked] = useState('');
  const [budget, setBudget] = useState('');
  const [district, setDistrict] = useState('');
  const [rooms, setRooms] = useState('');
  const [pesel, setPesel] = useState(String(p.clientPesel || '').replace(/\D/g, ''));
  const [skipPesel, setSkipPesel] = useState(false);
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | {
    html: string;
    documentId: string;
    emailSent: boolean;
    emailSkippedReason: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
  }>(null);

  const colors = {
    bg: '#0a0a0a',
    card: '#141414',
    text: '#fff',
    secondary: '#8e8e93',
    border: 'rgba(255,255,255,0.12)',
    accent: '#34C759',
  };

  const peselParsed = useMemo(() => (pesel.length ? parsePesel(pesel) : null), [pesel]);
  const peselDecode = useMemo(() => (pesel.length ? formatPeselDecode(pesel) : null), [pesel]);

  const shareOfferSheet = async () => {
    if (!offerId) {
      Alert.alert('Ofertówka', 'Brak ID oferty — otwórz wizytę z karty powiązanej z ofertą.');
      return;
    }
    const url = `${SITE_ORIGIN}/oferta/${offerId}?print=1`;
    try {
      await Share.share({ message: `Ofertówka #${offerId}\n${url}`, url });
    } catch {
      void Linking.openURL(url);
    }
  };

  const printOffer = async () => {
    if (!offerId) return;
    const html = `<html><body style="font-family:-apple-system;padding:24px"><h1>Ofertówka #${offerId}</h1><p>${p.offerTitle || ''}</p><p>Otwórz pełną ofertówkę: ${SITE_ORIGIN}/oferta/${offerId}</p></body></html>`;
    try {
      await Print.printAsync({ html });
    } catch {
      await shareOfferSheet();
    }
  };

  const finish = async () => {
    if (!token || !outcome) return;
    if (!attested) {
      Alert.alert('Potwierdzenie', 'Poproś klienta o zaznaczenie checkboxa potwierdzenia oglądania.');
      return;
    }
    if (pesel && !peselParsed) {
      Alert.alert('PESEL', 'Numer jest niepoprawny — popraw albo wyczyść i kontynuuj bez PESEL.');
      return;
    }
    setBusy(true);

    const res = await completePresentationVisit(token, clientId, {
      attestationConfirmed: true,
      signatureDataUrl: null,
      pesel: peselParsed ? pesel : null,
      skipPesel: skipPesel || (!pesel && true),
      offerId,
      debrief: {
        outcome,
        priceHint: priceHint.trim() || null,
        remindDays: outcome === 'maybe' ? remindDays : null,
        liked: liked.trim() || null,
        disliked: disliked.trim() || null,
        criteria:
          outcome === 'reject'
            ? {
                maxPrice: budget ? Number(budget.replace(/\s/g, '')) : null,
                district: district.trim() || null,
                minRooms: rooms ? Number(rooms) : null,
              }
            : null,
      },
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Wizyta', (res as any).message || 'Nie udało się zapisać.');
      return;
    }
    const data = res as any;
    setDone({
      html: data.html || '',
      documentId: data.documentId || '',
      emailSent: Boolean(data.emailSent),
      emailSkippedReason: data.emailSkippedReason || null,
      clientEmail: data.clientEmail || p.clientEmail || null,
      clientPhone: data.clientPhone || p.clientPhone || null,
    });
    if (data.emailSent) {
      Alert.alert(
        'Wysłano do klienta',
        `Kopia potwierdzenia oglądania poszła na ${data.clientEmail || 'e-mail klienta'}.`,
      );
    } else if (data.emailSkippedReason) {
      Alert.alert('Dokument zapisany', String(data.emailSkippedReason));
    }
    if (outcome === 'reject') {
      void refreshClientMatches(token, clientId).catch(() => {});
    }
  };

  const agentName = user?.name || 'Agent';
  const agencyName = user?.companyName || 'EstateOS';
  const portalUrl = p.portalUrl || 'https://estateos.pl';

  if (done) {
    const sms = buildPostVisitSms({
      firstName: (p.clientName || 'Klient').split(' ')[0],
      outcome: outcome!,
      offerTitle: p.offerTitle || 'oferta',
      priceHint: priceHint || undefined,
      remindDays,
      portalUrl,
      agentName,
    });
    const mail = buildPostVisitEmail({
      firstName: (p.clientName || 'Klient').split(' ')[0],
      outcome: outcome!,
      offerTitle: p.offerTitle || 'oferta',
      priceHint: priceHint || undefined,
      remindDays,
      portalUrl,
      agentName,
      agencyName,
    });
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="checkmark-circle" size={28} color={colors.accent} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]}>Wizyta zakończona</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 16 }}>
            Potwierdzenie zapisane · {done.documentId}
          </Text>
          <Text style={{ color: colors.secondary, marginTop: 8 }}>
            {done.emailSent
              ? `Kopia poszła na ${done.clientEmail}`
              : done.emailSkippedReason || 'Dokument zapisany.'}
          </Text>

          {done.clientPhone ? (
            <Pressable
              onPress={() => void Linking.openURL(smsUrl(done.clientPhone!, sms))}
              style={[styles.cta, { backgroundColor: colors.accent, marginTop: 16 }]}
            >
              <Text style={styles.ctaDark}>Wyślij SMS follow-up</Text>
            </Pressable>
          ) : null}
          {done.clientEmail ? (
            <Pressable
              onPress={() => void Linking.openURL(mailtoUrl(done.clientEmail!, mail.subject, mail.body))}
              style={[styles.cta, { backgroundColor: '#0A84FF', marginTop: 10 }]}
            >
              <Text style={styles.ctaDark}>Wyślij mail follow-up</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigation.replace('AgencyClientDetail', { clientId })}
            style={[styles.cta, { backgroundColor: '#fff', marginTop: 16 }]}
          >
            <Text style={[styles.ctaDark, { color: '#000' }]}>Wróć do karty klienta</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => (step === 0 ? navigation.goBack() : setStep((s) => s - 1))}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Wizyta · {STEPS[step]}</Text>
        <Text style={{ color: colors.secondary, fontWeight: '700' }}>{step + 1}/{STEPS.length}</Text>
      </View>

      <View style={styles.progressRow}>
        {STEPS.map((_, i) => (
          <View
            key={STEPS[i]}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= step ? colors.accent : colors.border,
              marginHorizontal: 2,
            }}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View>
            <Text style={[styles.h, { color: colors.text }]}>Ofertówka na start</Text>
            <Text style={{ color: colors.secondary, marginTop: 8, lineHeight: 20 }}>
              Wydrukuj lub udostępnij ofertówkę klientowi zanim wejdziecie do mieszkania.
            </Text>
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 16 }}>{p.offerTitle || `Oferta #${offerId}`}</Text>
            <Pressable onPress={() => void printOffer()} style={[styles.cta, { backgroundColor: '#fff', marginTop: 20 }]}>
              <Text style={[styles.ctaDark, { color: '#000' }]}>Drukuj / PDF</Text>
            </Pressable>
            <Pressable onPress={() => void shareOfferSheet()} style={[styles.cta, { backgroundColor: colors.accent, marginTop: 10 }]}>
              <Text style={styles.ctaDark}>Udostępnij link ofertówki</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={[styles.h, { color: colors.text }]}>Pokaz</Text>
            <Text style={{ color: colors.secondary, marginTop: 8, lineHeight: 20 }}>
              Schowaj iPada i prowadź prezentację. Gdy skończycie — wróćcie do rozmowy.
            </Text>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 20 }]}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{p.clientName || 'Klient'}</Text>
              <Text style={{ color: colors.secondary, marginTop: 6 }}>{p.offerTitle || `Oferta #${offerId}`}</Text>
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text style={[styles.h, { color: colors.text }]}>Jak zakończyć rozmowę?</Text>
            {(
              [
                ['interested', 'To mieszkanie mnie interesuje'],
                ['maybe', 'Potrzebuję czasu'],
                ['reject', 'Szukam czegoś innego'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => setOutcome(id)}
                style={[
                  styles.choice,
                  {
                    borderColor: outcome === id ? colors.accent : colors.border,
                    backgroundColor: outcome === id ? 'rgba(52,199,89,0.15)' : colors.card,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>{label}</Text>
              </Pressable>
            ))}
            {outcome === 'interested' ? (
              <TextInput
                value={priceHint}
                onChangeText={setPriceHint}
                placeholder="Orientacyjna kwota / zakres"
                placeholderTextColor={colors.secondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              />
            ) : null}
            {outcome === 'maybe' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {[2, 5, 7].map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setRemindDays(d)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: remindDays === d ? colors.accent : colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: remindDays === d ? '#000' : colors.text, fontWeight: '800' }}>{d} dni</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {outcome === 'reject' ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                <TextInput
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="Budżet max (zł)"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                <TextInput
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="Dzielnica / okolica"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                <TextInput
                  value={rooms}
                  onChangeText={setRooms}
                  placeholder="Min. pokoi"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                <TextInput
                  value={liked}
                  onChangeText={setLiked}
                  placeholder="Co było OK"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                <TextInput
                  value={disliked}
                  onChangeText={setDisliked}
                  placeholder="Co nie pasowało"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text style={[styles.h, { color: colors.text }]}>PESEL (opcjonalnie)</Text>
            <Text style={{ color: '#FF9F0A', marginTop: 8, lineHeight: 20 }}>
              Bez PESEL potwierdzenie jest słabiej identyfikowalne. Możesz uzupełnić później.
            </Text>
            <TextInput
              value={pesel}
              onChangeText={(v) => {
                setPesel(v.replace(/\D/g, '').slice(0, 11));
                setSkipPesel(false);
              }}
              keyboardType="number-pad"
              placeholder="11 cyfr"
              placeholderTextColor={colors.secondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, marginTop: 14 }]}
            />
            {pesel.length > 0 ? (
              <Text
                style={{
                  marginTop: 10,
                  fontWeight: '800',
                  color: peselParsed ? colors.accent : '#FF3B30',
                }}
              >
                {peselParsed
                  ? `PESEL poprawny · ${peselParsed.gender === 'M' ? 'Mężczyzna' : 'Kobieta'} · ${peselParsed.birthDate} · ${peselDecode}`
                  : 'PESEL niepoprawny'}
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                setPesel('');
                setSkipPesel(true);
                setStep(4);
              }}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: colors.secondary, fontWeight: '700' }}>Kontynuuj bez PESEL — uzupełnię później</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 4 ? (
          <View
            style={{
              marginTop: 4,
              padding: 20,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>
              DOKUMENT NA TABLECIE
            </Text>
            <Text style={[styles.h, { color: colors.text, marginTop: 8 }]}>Potwierdzenie oglądania</Text>
            <Text style={{ color: colors.secondary, marginTop: 8, lineHeight: 20 }}>
              {p.clientName || 'Klient'} potwierdza obecność na oglądaniu
              {offerId ? ` oferty #${offerId}` : ''}
              {p.offerTitle ? ` — ${p.offerTitle}` : ''}.
              {viewingLabel ? ` Termin: ${viewingLabel}.` : ''} To nie jest umowa pośrednictwa.
            </Text>
            {peselParsed ? (
              <Text style={{ color: colors.accent, marginTop: 10, fontWeight: '700' }}>
                PESEL OK · {formatPeselDecode(pesel)}
              </Text>
            ) : (
              <Text style={{ color: '#FF9F0A', marginTop: 10 }}>Bez PESEL — można uzupełnić później</Text>
            )}
            <Pressable
              onPress={() => setAttested((v) => !v)}
              style={{
                marginTop: 20,
                padding: 18,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: attested ? colors.accent : colors.border,
                backgroundColor: attested ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.03)',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: attested ? colors.accent : colors.secondary,
                  backgroundColor: attested ? colors.accent : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {attested ? <Ionicons name="checkmark" size={18} color="#000" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, lineHeight: 22 }}>
                  Potwierdzam oglądanie
                  {p.offerTitle ? ` „${p.offerTitle}”` : offerId ? ` oferty #${offerId}` : ' tej nieruchomości'}
                  {viewingLabel ? ` · ${viewingLabel}` : ''}.
                </Text>
                <Text style={{ color: colors.secondary, marginTop: 8, fontSize: 13, lineHeight: 18 }}>
                  Zaznaczenie zastępuje podpis odręczny i jest stemplem czasu na dokumencie. Kopia pójdzie na
                  {p.clientEmail ? ` ${p.clientEmail}` : ' e-mail klienta'}.
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        {step < 4 ? (
          <Pressable
            onPress={() => {
              if (step === 2 && !outcome) {
                Alert.alert('Rozmowa', 'Wybierz jedną z trzech ścieżek.');
                return;
              }
              if (step === 3 && pesel && !peselParsed) {
                Alert.alert('PESEL', 'Popraw numer albo kontynuuj bez PESEL.');
                return;
              }
              setStep((s) => s + 1);
            }}
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.ctaDark}>Dalej</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={busy}
            onPress={() => void finish()}
            style={[styles.cta, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#000" /> : (
              <Text style={styles.ctaDark}>
                Zapisz i wyślij kopię{p.clientEmail ? ` na ${p.clientEmail}` : ' PDF/HTML na mail'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  navTitle: { fontSize: 16, fontWeight: '800' },
  progressRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  h: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  choice: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  signBox: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', minHeight: 160 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaDark: { color: '#000', fontWeight: '900', fontSize: 15 },
});
