import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { capturePortalLead } from '../services/agencyClientService';
import { parseOtodomLeadEmail } from '../lib/parseOtodomLeadEmail';
import { mailtoUrl, smsUrl } from '../lib/visitMessageCopy';

export default function CapturePortalLeadScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s: any) => s.token);
  const isDark = true;
  const colors = {
    bg: '#0a0a0a',
    card: '#141414',
    text: '#fff',
    secondary: '#8e8e93',
    border: 'rgba(255,255,255,0.12)',
    input: '#1c1c1e',
    accent: '#34C759',
  };

  const [paste, setPaste] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [offerId, setOfferId] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState<null | {
    clientId: number;
    sms: string;
    emailSubject: string;
    emailBody: string;
    otodomReminder: string;
    portalUrl: string;
    phone: string | null;
    email: string | null;
    offerTitle: string;
  }>(null);

  const applyPaste = () => {
    const p = parseOtodomLeadEmail(paste);
    setFirstName(p.firstName);
    setLastName(p.lastName === '—' ? '' : p.lastName);
    if (p.email) setEmail(p.email);
    if (p.phone) setPhone(p.phone);
    if (p.officeOfferId) setOfferId(String(p.officeOfferId));
    if (p.message) setMessage(p.message);
    if (!p.officeOfferId && p.portalListingId) {
      Alert.alert(
        'Uwaga',
        `Wklejka ma ID portalu (${p.portalListingId}), ale brak „Numeru w biurze”. Wpisz ręcznie ID oferty EstateOS.`,
      );
    }
  };

  const submit = async (forceUseClientId?: number) => {
    if (!token) return;
    const id = Number(offerId);
    if (!Number.isFinite(id) || id <= 0) {
      Alert.alert('Lead', 'Podaj Numer w biurze = ID oferty EstateOS.');
      return;
    }
    setBusy(true);
    const res = await capturePortalLead(token, {
      paste: paste || undefined,
      firstName: firstName.trim(),
      lastName: lastName.trim() || 'Portal',
      email: email.trim() || null,
      phone: phone.trim() || null,
      message: message.trim() || null,
      offerId: id,
      source: 'otodom',
      contactConsent: consent,
      forceUseClientId: forceUseClientId || null,
    });
    setBusy(false);

    if (!res.ok) {
      if ((res as any).code === 'DUPLICATE_CLIENT' && (res as any).matches?.length) {
        const m = (res as any).matches[0];
        Alert.alert(
          'Klient już w CRM',
          `${m.firstName} ${m.lastName}. Dopiąć lead do tej karty?`,
          [
            { text: 'Anuluj', style: 'cancel' },
            { text: 'Dopnij', onPress: () => void submit(m.id) },
            {
              text: 'Otwórz kartę',
              onPress: () => navigation.replace('AgencyClientDetail', { clientId: m.id }),
            },
          ],
        );
        return;
      }
      Alert.alert('Lead', (res as any).message || 'Błąd');
      return;
    }

    const data = res as any;
    setWelcome({
      clientId: data.clientId,
      sms: data.welcome?.sms || '',
      emailSubject: data.welcome?.emailSubject || '',
      emailBody: data.welcome?.emailBody || '',
      otodomReminder: data.welcome?.otodomReminder || '',
      portalUrl: data.client?.portalUrl || '',
      phone: data.client?.phone || null,
      email: data.client?.email || null,
      offerTitle: data.offer?.title || `#${data.offerId}`,
    });
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { multiline?: boolean; keyboardType?: any; placeholder?: string },
  ) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={opts?.multiline}
        keyboardType={opts?.keyboardType}
        placeholder={opts?.placeholder}
        placeholderTextColor={colors.secondary}
        style={[
          styles.input,
          {
            backgroundColor: colors.input,
            color: colors.text,
            borderColor: colors.border,
            minHeight: opts?.multiline ? 88 : 44,
          },
        ]}
      />
    </View>
  );

  if (welcome) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="close" size={28} color="#007AFF" />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]}>Napisz do klienta</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 16, marginBottom: 8 }}>
            Lead zapisany · {welcome.offerTitle}
          </Text>
          <Text style={{ color: colors.secondary, marginBottom: 16 }}>{welcome.otodomReminder}</Text>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>SMS</Text>
            <Text style={{ color: colors.text, marginTop: 8, lineHeight: 20 }}>{welcome.sms}</Text>
            {welcome.phone ? (
              <Pressable
                onPress={() => void Linking.openURL(smsUrl(welcome.phone!, welcome.sms))}
                style={[styles.cta, { backgroundColor: colors.accent, marginTop: 12 }]}
              >
                <Text style={styles.ctaText}>Wyślij w Wiadomościach</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>MAIL</Text>
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 8 }}>{welcome.emailSubject}</Text>
            <Text style={{ color: colors.text, marginTop: 8, lineHeight: 20 }}>{welcome.emailBody}</Text>
            {welcome.email ? (
              <Pressable
                onPress={() =>
                  void Linking.openURL(mailtoUrl(welcome.email!, welcome.emailSubject, welcome.emailBody))
                }
                style={[styles.cta, { backgroundColor: '#0A84FF', marginTop: 12 }]}
              >
                <Text style={styles.ctaText}>Otwórz Mail</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => navigation.replace('AgencyClientDetail', { clientId: welcome.clientId })}
            style={[styles.cta, { backgroundColor: '#fff', marginTop: 20 }]}
          >
            <Text style={[styles.ctaText, { color: '#000' }]}>Przejdź do karty · umów prezentację</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Przechwyć lead</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.secondary, marginBottom: 12, lineHeight: 18 }}>
          Wklej maila z Otodom. Numer w biurze = ID oferty na estateos.pl (nie ID portalu).
        </Text>
        {field('Wklejka maila', paste, setPaste, { multiline: true, placeholder: 'Cała treść maila…' })}
        <Pressable onPress={applyPaste} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.accent, fontWeight: '800' }}>Wypełnij pola z wklejki</Text>
        </Pressable>
        {field('Imię', firstName, setFirstName)}
        {field('Nazwisko', lastName, setLastName)}
        {field('E-mail', email, setEmail, { keyboardType: 'email-address' })}
        {field('Telefon (+48…)', phone, setPhone, { keyboardType: 'phone-pad' })}
        {field('Numer w biurze / ID EstateOS', offerId, setOfferId, { keyboardType: 'number-pad', placeholder: 'np. 1228' })}
        {field('Treść / intencja', message, setMessage, { multiline: true })}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
          <Switch value={consent} onValueChange={setConsent} />
          <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>Zgoda na kontakt z klientem (RODO)</Text>
        </View>
        <Pressable
          disabled={busy}
          onPress={() => void submit()}
          style={[styles.cta, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={styles.ctaText}>{busy ? 'Zapisuję…' : 'Zapisz lead kupującego'}</Text>
        </Pressable>
      </ScrollView>
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
    paddingBottom: 10,
  },
  navTitle: { fontSize: 17, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
});
