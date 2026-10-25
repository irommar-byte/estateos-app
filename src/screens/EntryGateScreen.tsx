import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractInviteCode, isInviteLink, redeemClientInviteCode, redeemClientInviteLink } from '../services/clientPortalService';
import { getActivePortalToken, listPortalSessions } from '../lib/clientPortalSession';
import { extractPortalTokenFromDeeplink } from '../utils/deeplinkParse';

type Mode = 'choose' | 'client' | 'scan';

const ACCENT = '#10b981';

/**
 * Wejście klienta: skan QR od agenta albo 6-cyfrowy kod.
 *  • jako pełny ekran (tryb „tylko na zaproszenie”, INVITE_ONLY_ENTRY) — z wyborem agent/klient,
 *  • jako okno „Mam kod od agenta” (domyślnie) — startMode="client" + onClose; aplikacja działa normalnie.
 */
export default function EntryGateScreen({
  onAgent,
  onClientToken,
  startMode = 'choose',
  onClose,
}: {
  onAgent?: () => void;
  onClientToken: (portalToken: string) => void;
  startMode?: 'choose' | 'client';
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(startMode);
  const [lastSession, setLastSession] = useState<{ token: string; label: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [active, sessions] = await Promise.all([getActivePortalToken(), listPortalSessions()]);
      const token = active || sessions[0]?.token || null;
      if (!alive || !token) return;
      const row = sessions.find((s) => s.token === token);
      setLastSession({ token, label: [row?.clientName, row?.agencyName].filter(Boolean).join(' · ') || 'Twój panel' });
    })();
    return () => {
      alive = false;
    };
  }, []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (mode === 'client') setTimeout(() => inputRef.current?.focus(), 250);
    if (mode === 'scan') scannedRef.current = false;
  }, [mode]);

  const redeem = async (value: string) => {
    const digits = extractInviteCode(value);
    if (!digits) {
      setError('Kod ma 6 cyfr — sprawdź go w wiadomości od agenta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const portalToken = await redeemClientInviteCode(digits);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClientToken(portalToken);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Nie udało się. Spróbuj ponownie.');
      setCode('');
      if (mode === 'scan') setMode('client');
    } finally {
      setBusy(false);
    }
  };

  const redeemLink = async (raw: string) => {
    setBusy(true);
    setError('');
    try {
      const portalToken = await redeemClientInviteLink(raw);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClientToken(portalToken);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Nie udało się. Spróbuj ponownie.');
      setMode('client');
    } finally {
      setBusy(false);
    }
  };

  const onScanned = (raw: string) => {
    if (scannedRef.current || busy) return;
    if (isInviteLink(raw)) {
      scannedRef.current = true;
      void redeemLink(raw);
      return;
    }
    const portalToken = extractPortalTokenFromDeeplink(raw);
    if (portalToken) {
      scannedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClientToken(portalToken);
      return;
    }
    const digits = extractInviteCode(raw);
    if (!digits) return;
    scannedRef.current = true;
    void redeem(digits);
  };

  const openScanner = async () => {
    setError('');
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Bez dostępu do aparatu wpisz kod ręcznie.');
        setMode('client');
        return;
      }
    }
    setMode('scan');
  };

  if (mode === 'scan') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.root]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScanned(String(data || ''))}
        />
        <View style={[styles.scanTop, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => setMode('client')} hitSlop={14} style={styles.roundBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.scanFrameWrap} pointerEvents="none">
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Nakieruj aparat na kod QR od agenta</Text>
        </View>
        {busy ? (
          <View style={styles.scanBusy}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.brand}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandName}>EstateOS</Text>
      </View>

      {mode === 'choose' ? (
        <View style={styles.body}>
          <Text style={styles.title}>Witaj</Text>
          <Text style={styles.subtitle}>Wybierz, jak chcesz wejść.</Text>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setMode('client');
            }}
            style={({ pressed }) => [styles.option, styles.optionPrimary, pressed && styles.pressed]}
          >
            <Ionicons name="qr-code-outline" size={26} color="#000" />
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: '#000' }]}>Jestem klientem</Text>
              <Text style={[styles.optionDesc, { color: 'rgba(0,0,0,0.6)' }]}>Mam kod QR albo 6-cyfrowy kod od agenta</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.5)" />
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAgent?.();
            }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <Ionicons name="briefcase-outline" size={24} color="#fff" />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Jestem agentem</Text>
              <Text style={styles.optionDesc}>Zaloguj się do swojego konta</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
          </Pressable>

          <Text style={styles.footnote}>
            Dostęp do aplikacji jest teraz na zaproszenie. Kod dostaniesz od swojego agenta.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Pressable
            onPress={() => {
              if (startMode === 'client' && onClose) {
                onClose();
                return;
              }
              setMode('choose');
              setError('');
              setCode('');
            }}
            hitSlop={12}
            style={styles.back}
          >
            <Ionicons name={startMode === 'client' ? 'close' : 'chevron-back'} size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.backText}>{startMode === 'client' ? 'Zamknij' : 'Wróć'}</Text>
          </Pressable>
          <Text style={styles.title}>Kod od agenta</Text>
          <Text style={styles.subtitle}>
            Wpisz 6 cyfr albo zeskanuj kod QR. Najprościej: otwórz link z wiadomości od agenta — panel otworzy się sam.
          </Text>

          <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.codeCell, code.length === i && styles.codeCellActive]}>
                <Text style={styles.codeDigit}>{code[i] || ''}</Text>
              </View>
            ))}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              setError('');
              if (digits.length === 6) void redeem(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            style={styles.hiddenInput}
            editable={!busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={ACCENT} style={{ marginTop: 18 }} /> : null}

          <Pressable onPress={() => void openScanner()} style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}>
            <Ionicons name="scan-outline" size={20} color="#fff" />
            <Text style={styles.scanBtnText}>Zeskanuj kod QR</Text>
          </Pressable>

          {lastSession ? (
            <Pressable
              onPress={() => onClientToken(lastSession.token)}
              style={({ pressed }) => [styles.lastBtn, pressed && styles.pressed]}
            >
              <Ionicons name="time-outline" size={18} color="#000" />
              <View style={{ flex: 1 }}>
                <Text style={styles.lastTitle}>Wróć do ostatniego panelu</Text>
                <Text style={styles.lastSub} numberOfLines={1}>
                  {lastSession.label}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
            </Pressable>
          ) : null}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000', paddingHorizontal: 24, zIndex: 1000, elevation: 1000 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 8 },
  brandName: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  body: { flex: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 36, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 8, marginBottom: 28, lineHeight: 22 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 12,
  },
  optionPrimary: { backgroundColor: '#fff', borderColor: '#fff' },
  optionText: { flex: 1 },
  optionTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  optionDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  footnote: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 17, marginTop: 18, textAlign: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 18 },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeCell: {
    flex: 1,
    aspectRatio: 0.82,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellActive: { borderColor: ACCENT },
  codeDigit: { color: '#fff', fontSize: 28, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  error: { color: '#FF453A', fontSize: 14, marginTop: 14, lineHeight: 19 },
  scanBtn: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lastBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  lastTitle: { color: '#000', fontSize: 15, fontWeight: '700' },
  lastSub: { color: 'rgba(0,0,0,0.55)', fontSize: 12, marginTop: 1 },
  scanTop: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'flex-end' },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: '#fff' },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 20, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  scanBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
