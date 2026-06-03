import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { shouldAutoPromptPasskeyOnLaunch } from '../utils/passkeyBootstrap';
import { useI18n } from '../i18n';

type Props = {
  /** Splash zakończony i sesja odtworzona z dysku. */
  ready: boolean;
  /** Zamknięcie passkey → standardowy ekran logowania (Profil). */
  onUsePassword?: (email: string) => void;
};

export default function PasskeyLaunchPrompt({ ready, onUsePassword }: Props) {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const loginWithPasskey = useAuthStore((s) => s.loginWithPasskey);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const autoStarted = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (!ready || token) return;
    let cancelled = false;
    void (async () => {
      const { shouldPrompt, email: savedEmail } = await shouldAutoPromptPasskeyOnLaunch();
      if (cancelled || !shouldPrompt || dismissed.current) return;
      setEmail(savedEmail);
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const runPasskey = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const ok = await loginWithPasskey(email || null);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  }, [email, loading, loginWithPasskey]);

  useEffect(() => {
    if (!visible || token || autoStarted.current) return;
    autoStarted.current = true;
    const timer = setTimeout(() => {
      void runPasskey();
    }, 500);
    return () => clearTimeout(timer);
  }, [visible, token, runPasskey]);

  if (!visible || token) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.iconWrap}>
              <Ionicons name="finger-print" size={42} color="#10b981" />
            </View>
            <Text style={[styles.title, isDark && styles.titleDark]}>{t('auth.passkeyLaunchTitle')}</Text>
            <Text style={[styles.sub, isDark && styles.subDark]}>{t('auth.passkeyLaunchBody')}</Text>
            {email ? (
              <Text style={[styles.email, isDark && styles.emailDark]} numberOfLines={1}>
                {email}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void runPasskey()}
              disabled={loading}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>{t('auth.passkeyFaceId')}</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                dismissed.current = true;
                Haptics.selectionAsync();
                setVisible(false);
                setTimeout(() => {
                  onUsePassword?.(email);
                }, 220);
              }}
              style={styles.secondaryBtn}
            >
              <Text style={[styles.secondaryText, isDark && styles.secondaryTextDark]}>
                {t('auth.passkeyLaunchUsePassword')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  cardDark: {
    backgroundColor: 'rgba(20,20,22,0.96)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleDark: { color: '#fff' },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 10,
  },
  subDark: { color: '#9ca3af' },
  email: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 18,
    maxWidth: '100%',
  },
  emailDark: { color: '#6ee7b7' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#10b981',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { paddingVertical: 10 },
  secondaryText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  secondaryTextDark: { color: '#9ca3af' },
});
