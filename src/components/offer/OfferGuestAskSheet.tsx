import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X } from 'lucide-react-native';
import type { CountryCode } from 'libphonenumber-js';
import PhoneCountryPickerModal from '../phone/PhoneCountryPickerModal';
import {
  buildE164FromNational,
  dialCodeFor,
  flagEmojiFromIso2,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  parseStoredPhoneToLine,
} from '../../utils/phoneRegions';
import { API_URL } from '../../config/network';
import { t } from '../../i18n';

const QUESTIONS = [
  { key: 'isAvailable', labelKey: 'offer.guestAsk.qAvailable' },
  { key: 'viewingWhen', labelKey: 'offer.guestAsk.qViewing' },
  { key: 'priceNegotiable', labelKey: 'offer.guestAsk.qPrice' },
  { key: 'moreInfo', labelKey: 'offer.guestAsk.qMore' },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  offerId: number;
  offerTitle: string;
  isDark?: boolean;
  defaultPhone?: string;
  defaultName?: string;
  defaultEmail?: string;
};

export default function OfferGuestAskSheet({
  visible,
  onClose,
  offerId,
  offerTitle,
  isDark,
  defaultPhone,
  defaultName,
  defaultEmail,
}: Props) {
  const styles = useMemo(() => createStyles(Boolean(isDark)), [isDark]);
  const [questionKey, setQuestionKey] = useState<(typeof QUESTIONS)[number]['key']>('isAvailable');
  const [countryIso, setCountryIso] = useState<CountryCode>('PL');
  const [nationalDigits, setNationalDigits] = useState('');
  const [nationalDisplay, setNationalDisplay] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const first = QUESTIONS[0];
    setQuestionKey(first.key);
    setMessage(t(first.labelKey));
    setEmail(defaultEmail || '');
    setGuestName(defaultName || '');
    setSent(false);
    const line = parseStoredPhoneToLine(defaultPhone, getDeviceRegionCountry());
    setCountryIso(line.iso);
    setNationalDigits(line.nationalDigits);
    setNationalDisplay(formatNationalAsYouType(line.iso, line.nationalDigits));
  }, [visible, defaultPhone, defaultName, defaultEmail]);

  const handleNationalChange = (text: string) => {
    const d = text.replace(/\D/g, '');
    setNationalDigits(d);
    setNationalDisplay(formatNationalAsYouType(countryIso, d));
  };

  const selectQuestion = (key: (typeof QUESTIONS)[number]['key'], label: string) => {
    setQuestionKey(key);
    const known = QUESTIONS.some((item) => t(item.labelKey) === message.trim());
    if (!message.trim() || known) setMessage(label);
  };

  const handleSubmit = async () => {
    const phoneE164 = buildE164FromNational(countryIso, nationalDigits);
    if (!phoneE164) {
      Alert.alert('EstateOS', t('offer.guestAsk.phoneInvalid'));
      return;
    }
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('EstateOS', t('offer.guestAsk.emailInvalid'));
      return;
    }
    if (message.trim().length < 8) {
      Alert.alert('EstateOS', t('offer.guestAsk.errorGeneric'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/offers/${offerId}/guest-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionKey,
          phone: phoneE164,
          email: trimmedEmail,
          message: message.trim(),
          guestName: guestName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : t('offer.guestAsk.errorGeneric'));
      }
      setSent(true);
    } catch (error) {
      Alert.alert('EstateOS', error instanceof Error ? error.message : t('offer.guestAsk.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('offer.guestAsk.title')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X color={isDark ? '#a1a1aa' : '#6b7280'} size={22} />
          </Pressable>
        </View>
        {sent ? (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={42} color="#10b981" />
            <Text style={styles.successTitle}>{t('offer.guestAsk.successTitle')}</Text>
            <Text style={styles.successBody}>{t('offer.guestAsk.successBody')}</Text>
            <Pressable onPress={onClose} style={styles.submit}>
              <Text style={styles.submitText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>{offerTitle}</Text>
            <Text style={styles.hint}>{t('offer.guestAsk.subtitle')}</Text>

            <Text style={styles.label}>{t('offer.guestAsk.questionsLabel')}</Text>
            <View style={styles.chips}>
              {QUESTIONS.map((item) => {
                const label = t(item.labelKey);
                const active = item.key === questionKey;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => selectQuestion(item.key, label)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t('offer.guestAsk.nameLabel')}</Text>
            <TextInput
              value={guestName}
              onChangeText={setGuestName}
              placeholder={t('offer.guestAsk.namePlaceholder')}
              placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
              style={styles.input}
            />

            <Text style={styles.label}>{t('offer.guestAsk.phoneLabel')}</Text>
            <View style={styles.phoneRow}>
              <Pressable onPress={() => setPickerOpen(true)} style={styles.countryBtn}>
                <Text style={styles.countryFlag}>{flagEmojiFromIso2(countryIso)}</Text>
                <Text style={styles.countryDial}>+{dialCodeFor(countryIso)}</Text>
                <Ionicons name="chevron-down" size={16} color={isDark ? '#a1a1aa' : '#6b7280'} />
              </Pressable>
              <TextInput
                value={nationalDisplay}
                onChangeText={handleNationalChange}
                placeholder={countryIso === 'PL' ? '500 600 700' : ''}
                placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
                keyboardType="phone-pad"
                style={[styles.input, styles.phoneInput]}
              />
            </View>

            <Text style={styles.label}>{t('offer.guestAsk.emailLabel')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('offer.guestAsk.emailPlaceholder')}
              placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.label}>{t('offer.guestAsk.messageLabel')}</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.message]}
            />

            <Pressable onPress={() => void handleSubmit()} disabled={submitting} style={styles.submit}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>{t('offer.guestAsk.send')}</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
        <PhoneCountryPickerModal
          visible={pickerOpen}
          selectedIso={countryIso}
          isDark={isDark}
          onClose={() => setPickerOpen(false)}
          onSelect={(iso) => {
            setCountryIso(iso);
            setNationalDisplay(formatNationalAsYouType(iso, nationalDigits));
            setPickerOpen(false);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(isDark: boolean) {
  const text = isDark ? '#f8fafc' : '#111827';
  const muted = isDark ? '#a1a1aa' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
  const inputBg = isDark ? '#1c1c1e' : '#f8fafc';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#ffffff' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border,
    },
    title: { fontSize: 18, fontWeight: '800', color: text },
    content: { padding: 20, paddingBottom: 40, gap: 10 },
    subtitle: { fontSize: 16, fontWeight: '700', color: text },
    hint: { fontSize: 13, lineHeight: 19, color: muted, marginBottom: 8 },
    label: { marginTop: 8, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: muted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: inputBg,
    },
    chipActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)' },
    chipLabel: { fontSize: 12, fontWeight: '600', color: text, maxWidth: 220 },
    chipLabelActive: { color: isDark ? '#6ee7b7' : '#047857' },
    input: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: inputBg,
      color: text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: inputBg,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    countryFlag: { fontSize: 18 },
    countryDial: { fontSize: 14, fontWeight: '800', color: text },
    phoneInput: { flex: 1 },
    message: { minHeight: 110 },
    submit: {
      marginTop: 16,
      borderRadius: 999,
      backgroundColor: '#10b981',
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    success: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    successTitle: { fontSize: 20, fontWeight: '800', color: text, textAlign: 'center' },
    successBody: { fontSize: 14, lineHeight: 20, color: muted, textAlign: 'center' },
  });
}
