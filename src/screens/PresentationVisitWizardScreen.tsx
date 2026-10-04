import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { API_URL } from '../config/network';
import { parsePesel, formatPeselDecode } from '../lib/pesel';
import { buildPresentationBrief } from '../lib/presentationBrief';
import PresentationAttendanceSignSheet from '../components/agency/PresentationAttendanceSignSheet';
import PresentationBriefView from '../components/agency/PresentationBriefView';
import PresentationOfferSheet, { type PresentationOfferSheetHandle } from '../components/agency/PresentationOfferSheet';
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

const STEPS = ['Ofertówka', 'Ściąga', 'Rozmowa', 'Dane', 'Podpis'] as const;

function normalizeVisitPhone(raw: string): string | null {
  const input = raw.trim();
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (input.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 9) return `+48${digits}`;
  if (digits.length === 11 && digits.startsWith('48')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

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
  const viewing = useMemo(() => {
    const raw = p.viewingStartsAt || null;
    if (!raw) return { label: null as string | null, date: null as string | null, time: null as string | null };
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return { label: null as string | null, date: null as string | null, time: null as string | null };
    }
    return {
      label: d.toLocaleString('pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      date: d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    };
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
  const nameParts = String(p.clientName || '').trim().split(/\s+/).filter(Boolean);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' '));
  const [email, setEmail] = useState(String(p.clientEmail || ''));
  const [phone, setPhone] = useState(String(p.clientPhone || ''));
  const [address, setAddress] = useState('');
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(true);
  const [pesel, setPesel] = useState(String(p.clientPesel || '').replace(/\D/g, ''));
  const [offerRecord, setOfferRecord] = useState<Record<string, unknown> | null>(null);
  const sheetRef = useRef<PresentationOfferSheetHandle>(null);
  const [attested, setAttested] = useState(false);
  const [signature, setSignature] = useState('');
  const [signOpen, setSignOpen] = useState(false);
  const [offerFacts, setOfferFacts] = useState<{ title: string; address: string; price: string | null }>({
    title: '',
    address: '',
    price: null,
  });
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

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    void fetch(`${API_URL}/api/offers/${offerId}`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const offer = json.offer || json.data?.offer || json.data || json;
        if (!offer || typeof offer !== 'object') return;
        setOfferRecord(offer as Record<string, unknown>);
        const line = [offer?.street, offer?.district, offer?.city].filter(Boolean).join(', ');
        const priceNum = Number(offer?.price);
        setOfferFacts({
          title: typeof offer?.title === 'string' ? offer.title : '',
          address: line,
          price:
            Number.isFinite(priceNum) && priceNum > 0
              ? `${Math.round(priceNum).toLocaleString('pl-PL')} zł`
              : null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [offerId, token]);

  useEffect(() => {
    if (!token || !clientId) return;
    let cancelled = false;
    void fetch(`${API_URL}/api/crm/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.client) return;
        const client = json.client;
        if (client.firstName) setFirstName(String(client.firstName));
        if (client.lastName) setLastName(String(client.lastName));
        if (client.email) setEmail(String(client.email));
        if (client.phone) setPhone(String(client.phone));
        if (client.contactAddress) setAddress(String(client.contactAddress));
        if (client.pesel) setPesel(String(client.pesel).replace(/\D/g, ''));
        const stamp = client.profileVerifiedAt ? String(client.profileVerifiedAt) : null;
        setVerifiedAt(stamp);
        setEditingProfile(!stamp);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, clientId]);

  const agentName = user?.name || 'Agent';
  const agencyName = user?.companyName || 'EstateOS';
  const clientFullName = `${firstName} ${lastName}`.trim() || p.clientName || 'Klient';
  const brief = useMemo(
    () => buildPresentationBrief(offerRecord, offerFacts.title || p.offerTitle || (offerId ? `Oferta #${offerId}` : 'Nieruchomość')),
    [offerRecord, offerFacts.title, p.offerTitle, offerId],
  );

  const profileIssue = (): string | null => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) return 'Uzupełnij imię i nazwisko.';
    if (address.trim().length < 3) return 'Uzupełnij adres klienta.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Uzupełnij prawidłowy e-mail.';
    if (!normalizeVisitPhone(phone)) return 'Uzupełnij telefon, na przykład 501 234 567.';
    if (!peselParsed) return 'Uzupełnij prawidłowy PESEL — 11 cyfr.';
    return null;
  };

  const finish = async () => {
    if (!token || !outcome) return;
    if (!attested) {
      Alert.alert('Potwierdzenie', 'Poproś klienta o zaznaczenie zgody, że oglądał nieruchomość.');
      setSignOpen(true);
      return;
    }
    if (!signature.startsWith('data:image')) {
      Alert.alert('Podpis', 'Poproś klienta o podpis na tablecie. Bez niego pole na dokumencie zostaje puste.');
      setSignOpen(true);
      return;
    }
    const issue = profileIssue();
    if (issue) {
      Alert.alert('Dane klienta', issue);
      setSignOpen(false);
      setStep(3);
      return;
    }
    setBusy(true);

    const res = await completePresentationVisit(token, clientId, {
      attestationConfirmed: true,
      signatureDataUrl: signature,
      pesel,
      profile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone,
        contactAddress: address.trim(),
        pesel,
      },
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
    setSignOpen(false);
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

  const portalUrl = p.portalUrl || 'https://estateos.pl';

  if (done) {
    const sms = buildPostVisitSms({
      firstName: firstName || (p.clientName || 'Klient').split(' ')[0],
      outcome: outcome!,
      offerTitle: p.offerTitle || 'oferta',
      priceHint: priceHint || undefined,
      remindDays,
      portalUrl,
      agentName,
    });
    const mail = buildPostVisitEmail({
      firstName: firstName || (p.clientName || 'Klient').split(' ')[0],
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

      {step === 0 ? (
        <PresentationOfferSheet ref={sheetRef} offerId={offerId} agentId={Number(user?.id) || null} />
      ) : (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? <PresentationBriefView brief={brief} /> : null}

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
            <Text style={[styles.h, { color: colors.text }]}>Dane klienta</Text>
            {verifiedAt && !editingProfile ? (
              <View style={{ marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: 'rgba(52,199,89,0.12)' }}>
                <Text style={{ color: colors.accent, fontWeight: '900' }}>Klient zweryfikowany</Text>
                <Text style={{ color: colors.text, marginTop: 8, fontWeight: '800', fontSize: 18 }}>{clientFullName}</Text>
                <Text style={{ color: colors.secondary, marginTop: 6 }}>{address}</Text>
                <Text style={{ color: colors.secondary, marginTop: 4 }}>{email}</Text>
                <Text style={{ color: colors.secondary, marginTop: 4 }}>{phone}</Text>
                <Text style={{ color: colors.secondary, marginTop: 4 }}>PESEL {pesel}</Text>
                <Pressable onPress={() => setEditingProfile(true)} style={{ marginTop: 12 }}>
                  <Text style={{ color: '#0A84FF', fontWeight: '800' }}>Popraw dane</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={{ color: colors.secondary, marginTop: 8, lineHeight: 20 }}>
                  Sprawdź dane z klientem. Po poprawnym zapisie nie pytamy o nie przy następnym pokazie.
                </Text>
                <Text style={styles.fieldLabel}>Imię</Text>
                <TextInput value={firstName} onChangeText={setFirstName} autoCapitalize="words" placeholder="Imię" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
                <Text style={styles.fieldLabel}>Nazwisko</Text>
                <TextInput value={lastName} onChangeText={setLastName} autoCapitalize="words" placeholder="Nazwisko" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
                <Text style={styles.fieldLabel}>Adres</Text>
                <TextInput value={address} onChangeText={setAddress} placeholder="Ulica, kod, miasto" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
                <Text style={styles.fieldLabel}>E-mail</Text>
                <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="e-mail" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
                <Text style={styles.fieldLabel}>Telefon</Text>
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="501 234 567" placeholderTextColor={colors.secondary} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} />
                <Text style={styles.fieldLabel}>PESEL</Text>
                <TextInput
                  value={pesel}
                  onChangeText={(v) => setPesel(v.replace(/\D/g, '').slice(0, 11))}
                  keyboardType="number-pad"
                  placeholder="11 cyfr"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                {pesel.length > 0 ? (
                  <Text style={{ marginTop: 10, fontWeight: '800', color: peselParsed ? colors.accent : '#FF3B30' }}>
                    {peselParsed
                      ? `PESEL poprawny · ${peselParsed.gender === 'M' ? 'Mężczyzna' : 'Kobieta'} · ${peselParsed.birthDate} · ${peselDecode}`
                      : 'PESEL niepoprawny'}
                  </Text>
                ) : null}
              </View>
            )}
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
              PODPIS NA TABLECIE
            </Text>
            <Text style={[styles.h, { color: colors.text, marginTop: 8 }]}>Potwierdzenie czeka na klienta</Text>
            <Text style={{ color: colors.secondary, marginTop: 8, lineHeight: 20 }}>
              {clientFullName} dostaje kartkę z nieruchomością, zgodą i polem podpisu. Podpis wkleja się
              w kopię
              {email ? ` na ${email.trim()}` : ''}.
            </Text>
            <Text style={{ color: signature.startsWith('data:image') && attested ? colors.accent : '#FF9F0A', marginTop: 12, fontWeight: '700' }}>
              {signature.startsWith('data:image') && attested
                ? 'Zgoda i podpis są na dokumencie.'
                : 'Brakuje zgody albo podpisu odręcznego.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        {step === 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable
              onPress={() => void sheetRef.current?.share().catch((err) => Alert.alert('Ofertówka', err?.message || 'Nie udało się wysłać.'))}
              style={[styles.cta, { flex: 1, backgroundColor: '#fff' }]}
            >
              <Text style={styles.ctaDark}>Wyślij</Text>
            </Pressable>
            <Pressable
              onPress={() => void sheetRef.current?.print().catch((err) => Alert.alert('Ofertówka', err?.message || 'Nie udało się wydrukować.'))}
              style={[styles.cta, { flex: 1, backgroundColor: '#fff' }]}
            >
              <Text style={styles.ctaDark}>Drukuj</Text>
            </Pressable>
          </View>
        ) : null}
        {step < 4 ? (
          <Pressable
            onPress={() => {
              if (step === 2 && !outcome) {
                Alert.alert('Rozmowa', 'Wybierz jedną z trzech ścieżek.');
                return;
              }
              if (step === 3) {
                const issue = profileIssue();
                if (issue) {
                  setEditingProfile(true);
                  Alert.alert('Dane klienta', issue);
                  return;
                }
              }
              const next = step + 1;
              setStep(next);
              if (next === 4) setSignOpen(true);
            }}
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.ctaDark}>Dalej</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={busy}
            onPress={() => setSignOpen(true)}
            style={[styles.cta, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.ctaDark}>Otwórz potwierdzenie do podpisu</Text>
          </Pressable>
        )}
      </View>

      <PresentationAttendanceSignSheet
        visible={signOpen}
        busy={busy}
        attested={attested}
        signature={signature}
        onAttestedChange={setAttested}
        onSignatureChange={setSignature}
        onClose={() => {
          if (!busy) setSignOpen(false);
        }}
        onSubmit={() => void finish()}
        facts={{
          agencyName,
          agentName,
          agentPhone: user?.phone ? String(user.phone) : null,
          clientName: clientFullName,
          clientPhone: phone || null,
          clientEmail: email.trim() || null,
          clientAddress: address.trim() || null,
          peselLabel: peselParsed ? pesel : null,
          offerId,
          offerTitle: offerFacts.title || p.offerTitle || (offerId ? `Oferta #${offerId}` : 'Nieruchomość'),
          offerAddress: offerFacts.address,
          offerPriceLabel: offerFacts.price,
          viewingAtLabel: viewing.label,
          viewingDatePart: viewing.date,
          viewingTimePart: viewing.time,
        }}
      />
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
  fieldLabel: { color: '#8e8e93', fontSize: 12, fontWeight: '800', marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  signBox: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', minHeight: 160 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaDark: { color: '#000', fontWeight: '900', fontSize: 15 },
});
