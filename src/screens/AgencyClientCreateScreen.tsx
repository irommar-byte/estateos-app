import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { createAgencyClient } from '../services/agencyClientService';

export default function AgencyClientCreateScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const [type, setType] = useState<'BUYER' | 'SELLER'>('SELLER');
  const [busy, setBusy] = useState(false);
  const [alsoSearching, setAlsoSearching] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    sellerCity: '',
    sellerPrice: '',
    buyerCity: 'Warszawa',
    maxPrice: '',
  });

  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
  };

  const submit = async () => {
    if (!token) return;
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert('Klient', 'Imię i nazwisko są wymagane.');
      return;
    }
    setBusy(true);
    try {
      const res = await createAgencyClient(token, {
        type,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        ...(type === 'SELLER'
          ? {
              sellerCity: form.sellerCity || null,
              sellerPrice: form.sellerPrice ? Number(form.sellerPrice.replace(/\s/g, '')) : null,
              ...(alsoSearching
                ? {
                    buyerFilters: {
                      calibrationMode: 'CITY',
                      transactionType: 'SELL',
                      propertyType: 'FLAT',
                      city: form.buyerCity || 'Warszawa',
                      selectedDistricts: [],
                      maxPrice: Number(form.maxPrice) || 0,
                      minArea: 0,
                      minYear: 1900,
                      requireBalcony: false,
                      requireGarden: false,
                      requireElevator: false,
                      requireParking: false,
                      requireFurnished: false,
                      requireTwoLevel: false,
                      pushNotifications: false,
                      matchThreshold: 70,
                      lat: null,
                      lng: null,
                      radiusKm: null,
                    },
                  }
                : {}),
            }
          : {
              buyerFilters: {
                calibrationMode: 'CITY',
                transactionType: 'SELL',
                propertyType: 'FLAT',
                city: form.buyerCity || 'Warszawa',
                selectedDistricts: [],
                maxPrice: Number(form.maxPrice) || 0,
                minArea: 0,
                minYear: 1900,
                requireBalcony: false,
                requireGarden: false,
                requireElevator: false,
                requireParking: false,
                requireFurnished: false,
                requireTwoLevel: false,
                pushNotifications: false,
                matchThreshold: 70,
                lat: null,
                lng: null,
                radiusKm: null,
              },
            }),
      });
      if (!res.ok) {
        Alert.alert('Klient', res.message);
        return;
      }
      navigation.replace('AgencyClientDetail', { clientId: res.clientId });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string, keyboardType: 'default' | 'email-address' | 'phone-pad' | 'numeric' = 'default') => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        placeholderTextColor={colors.secondary}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Dodaj klienta</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          <View style={styles.row}>
            {(['SELLER', 'BUYER'] as const).map((id) => (
              <Pressable
                key={id}
                onPress={() => setType(id)}
                style={[styles.typeBtn, { backgroundColor: type === id ? '#34C759' : colors.card, borderColor: colors.border }]}
              >
                <Text style={{ fontWeight: '800', color: type === id ? '#000' : colors.text }}>
                  {id === 'SELLER' ? 'Sprzedający' : 'Kupujący'}
                </Text>
              </Pressable>
            ))}
          </View>
          {field('firstName', 'IMIĘ')}
          {field('lastName', 'NAZWISKO')}
          {field('email', 'E-MAIL', 'email-address')}
          {field('phone', 'TELEFON (+48...)', 'phone-pad')}
          {type === 'SELLER' ? (
            <>
              {field('sellerCity', 'MIASTO NIERUCHOMOŚCI')}
              {field('sellerPrice', 'CENA OCZEKIWANA', 'numeric')}
              <Pressable onPress={() => setAlsoSearching((v) => !v)} style={[styles.check, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name={alsoSearching ? 'checkbox' : 'square-outline'} size={22} color="#34C759" />
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Klient też szuka nieruchomości</Text>
              </Pressable>
            </>
          ) : null}
          {(type === 'BUYER' || alsoSearching) ? (
            <>
              {field('buyerCity', 'MIASTO POSZUKIWAŃ')}
              {field('maxPrice', 'MAKSYMALNY BUDŻET', 'numeric')}
            </>
          ) : null}
          <Pressable onPress={() => void submit()} disabled={busy} style={styles.save}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Zapisz i otwórz kartę</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, alignItems: 'center' },
  input: { marginTop: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 12 },
  save: { marginTop: 12, backgroundColor: '#34C759', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveText: { fontWeight: '800', fontSize: 16, color: '#000' },
});
