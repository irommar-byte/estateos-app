import { authPasskeyButtonLabel } from '../utils/passkeyPlatformCopy';
import NumericKeyboardAccessory from '../components/NumericKeyboardAccessory';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Modal,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { CountryCode } from 'libphonenumber-js';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import PhoneCountryPickerModal from '../components/phone/PhoneCountryPickerModal';
import { Picker } from '@react-native-picker/picker';
import { fetchAgencyCompanyList } from '../services/agencyCompanyService';
import type { AgencyCompanyListItem } from '../types/agencyMembership';
import { API_URL } from '../config/network';
import {
  buildE164FromNational,
  dialCodeFor,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  flagEmojiFromIso2,
} from '../utils/phoneRegions';
import { useI18n } from '../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AuthLanguageFlags from '../components/AuthLanguageFlags';
import AppleSlidingSegment from '../components/AppleSlidingSegment';
import { patchAgencyCompanyContact } from '../services/agencyCompanyService';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { openLegalDocument } from '../utils/legalDocumentUrls';

const MAX_MEDIA_FILE_BYTES = 15 * 1024 * 1024;

// --- LUKSUSOWE IKONY WALIDACJI ---
const StatusIcon = ({ status }: { status: string }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: status === 'idle' ? 0 : 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: status === 'idle' ? 0.5 : 1, friction: 5, useNativeDriver: true })
    ]).start();
  }, [status]);

  const getBgColor = () => {
    if (status === 'available') return 'rgba(16, 185, 129, 0.15)';
    if (status === 'taken') return 'rgba(239, 68, 68, 0.15)';
    return 'transparent';
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], marginLeft: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: getBgColor(), alignItems: 'center', justifyContent: 'center' }}>
      {status === 'loading' && <ActivityIndicator size="small" color="#10b981" />}
      {status === 'available' && <Ionicons name="checkmark" size={20} color="#10b981" style={{ fontWeight: '900' }} />}
      {status === 'taken' && <Ionicons name="close" size={22} color="#ef4444" style={{ fontWeight: '900' }} />}
    </Animated.View>
  );
};

/** Ikona oka — przełącza podgląd wpisywanego hasła (logowanie, rejestracja, reset). */
function PasswordEyeToggle({
  revealed,
  onToggle,
  iconColor,
  a11yHide,
  a11yShow,
}: {
  revealed: boolean;
  onToggle: () => void;
  iconColor: string;
  a11yHide: string;
  a11yShow: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={revealed ? a11yHide : a11yShow}
    >
      <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={iconColor} />
    </Pressable>
  );
}

// --- ANIMOWANY CHECKBOX Z EFEKTEM GLOW ---
const PremiumCheckbox = ({ checked, onPress, onReadTerms, onReadPrivacy, theme, t }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: checked ? 1 : 0.9, friction: 4, useNativeDriver: true }).start();
  }, [checked]);

  return (
    <View style={styles.checkboxContainer}>
      <Pressable onPress={onPress} style={({pressed}) => [{ opacity: pressed ? 0.7 : 1 }, styles.checkboxTouchArea]}>
        <Animated.View style={[
          styles.checkboxBox, 
          { borderColor: checked ? '#10b981' : theme.subtitle },
          checked && { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5, transform: [{ scale: scaleAnim }] }
        ]}>
          {checked && <Ionicons name="checkmark" size={16} color="#fff" style={{ fontWeight: '900' }} />}
        </Animated.View>
      </Pressable>
      <View style={styles.checkboxTextContainer}>
        <Text style={[styles.checkboxText, { color: theme.subtitle }]}>
          {t('auth.termsPrefix')}
          <Text onPress={onReadTerms} style={{ color: theme.text, fontWeight: '700', textDecorationLine: 'underline' }}>{t('auth.termsLink')}</Text>
          {t('auth.termsMiddle')}
          <Text onPress={onReadPrivacy} style={{ color: theme.text, fontWeight: '700', textDecorationLine: 'underline' }}>{t('auth.privacyLink')}</Text>
          {t('auth.termsSuffix')}
        </Text>
      </View>
    </View>
  );
};

function RegistrationHeroIcon({
  isLogin,
  role,
}: {
  isLogin: boolean;
  role: 'PRIVATE' | 'AGENT';
}) {
  if (isLogin) {
    return <Ionicons name="lock-closed" size={45} color="#10b981" />;
  }

  if (role === 'AGENT') {
    return (
      <View style={styles.heroIconAgentWrap}>
        <Ionicons name="person" size={44} color="#10b981" />
        <Ionicons name="add" size={16} color="#10b981" style={styles.heroIconAdd} />
        <View style={styles.heroBriefcase}>
          <Ionicons name="briefcase" size={12} color="#FFF7ED" />
        </View>
        <Text style={styles.heroAgentLabel}>AGENT</Text>
      </View>
    );
  }

  return (
    <View style={styles.heroIconAgentWrap}>
      <Ionicons name="person" size={44} color="#10b981" />
      <Ionicons name="add" size={16} color="#10b981" style={styles.heroIconAdd} />
    </View>
  );
}

type ImageDraft = {
  uri: string;
  width: number;
  height: number;
  scale: number;
  translateX: number;
  translateY: number;
  frameW: number;
  frameH: number;
  mimeType?: string;
  fileName?: string;
  isAnimated?: boolean;
  fileSize?: number;
};

const LOGO_ASPECT = 56 / 38;
const AVATAR_PREVIEW = { w: 56, h: 56, r: 28 } as const;
const LOGO_PREVIEW = { w: 72, h: 49, r: 10 } as const;
const CROP_GUIDE_INSET = 14;

function CropCheckerboard({ isDark }: { isDark: boolean }) {
  const a = isDark ? '#3A3A3C' : '#D1D5DB';
  const b = isDark ? '#2C2C2E' : '#E5E7EB';
  const cells = Array.from({ length: 64 }, (_, i) => i);
  return (
    <View style={styles.scaleCheckerboard} pointerEvents="none">
      {cells.map((i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const dark = (row + col) % 2 === 0;
        return (
          <View
            key={i}
            style={{
              width: '12.5%',
              height: '12.5%',
              backgroundColor: dark ? a : b,
            }}
          />
        );
      })}
    </View>
  );
}

/** Ten sam kadr co w modalu — skala + przesunięcie mapowane 1:1 na podgląd i slot w formularzu. */
function DraftFramedImage({
  draft,
  width,
  height,
  borderRadius,
  borderColor,
  backgroundColor,
}: {
  draft: Pick<ImageDraft, 'uri' | 'scale' | 'translateX' | 'translateY' | 'frameW' | 'frameH'>;
  width: number;
  height: number;
  borderRadius?: number;
  borderColor?: string;
  backgroundColor?: string;
}) {
  const frameW = Math.max(1, draft.frameW || width);
  const frameH = Math.max(1, draft.frameH || height);
  const tx = (draft.translateX || 0) * (width / frameW);
  const ty = (draft.translateY || 0) * (height / frameH);
  const scale = Math.max(1, draft.scale || 1);
  const imageStyle = {
    width: '100%' as const,
    height: '100%' as const,
    transform: [{ translateX: tx }, { translateY: ty }, { scale }],
  };

  return (
    <View
      style={{
        width,
        height,
        borderRadius: borderRadius ?? 0,
        overflow: 'hidden',
        borderWidth: borderColor ? 1 : 0,
        borderColor: borderColor || 'transparent',
        backgroundColor: backgroundColor || 'transparent',
      }}
    >
      <Image source={{ uri: draft.uri }} style={imageStyle} contentFit="cover" />
    </View>
  );
}

function ImageScalePreviewModal({
  visible,
  draft,
  target,
  title,
  subtitle,
  theme,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  draft: ImageDraft | null;
  target: 'avatar' | 'logo';
  title: string;
  subtitle: string;
  theme: any;
  onCancel: () => void;
  onConfirm: (next: ImageDraft) => void;
}) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [frameW, setFrameW] = useState(280);
  const [frameH, setFrameH] = useState(280);
  const baseScaleRef = useRef(1);
  const baseScaleAnim = useRef(new Animated.Value(1)).current;
  const pinchScaleAnim = useRef(new Animated.Value(1)).current;
  const panBaseXRef = useRef(0);
  const panBaseYRef = useRef(0);
  const panBaseXAnim = useRef(new Animated.Value(0)).current;
  const panBaseYAnim = useRef(new Animated.Value(0)).current;
  const panGestureXAnim = useRef(new Animated.Value(0)).current;
  const panGestureYAnim = useRef(new Animated.Value(0)).current;
  const pinchRef = useRef<any>(null);
  const panRef = useRef<any>(null);
  const pinchCombinedScale = Animated.multiply(baseScaleAnim, pinchScaleAnim);
  const panCombinedX = Animated.add(panBaseXAnim, panGestureXAnim);
  const panCombinedY = Animated.add(panBaseYAnim, panGestureYAnim);

  const isAvatar = target === 'avatar';
  const cropAspect = isAvatar ? 1 : LOGO_ASPECT;
  const guideRadius = isAvatar
    ? 999
    : Math.max(8, frameW * (LOGO_PREVIEW.r / LOGO_PREVIEW.w));

  const clampScale = (value: number) => Math.max(1, Math.min(2.8, value));
  const getPanBounds = (nextScale: number) => {
    const safeW = Math.max(1, frameW);
    const safeH = Math.max(1, frameH);
    const sourceW = Math.max(1, draft?.width || 1);
    const sourceH = Math.max(1, draft?.height || 1);
    const coverScale = Math.max(safeW / sourceW, safeH / sourceH);
    const shownW = sourceW * coverScale * nextScale;
    const shownH = sourceH * coverScale * nextScale;
    return {
      maxX: Math.max(0, (shownW - safeW) / 2),
      maxY: Math.max(0, (shownH - safeH) / 2),
    };
  };
  const syncPan = (nextX: number, nextY: number, scaleForBounds: number) => {
    const { maxX, maxY } = getPanBounds(scaleForBounds);
    const clampedX = Math.max(-maxX, Math.min(maxX, nextX));
    const clampedY = Math.max(-maxY, Math.min(maxY, nextY));
    panBaseXRef.current = clampedX;
    panBaseYRef.current = clampedY;
    setTranslateX(clampedX);
    setTranslateY(clampedY);
    panBaseXAnim.setValue(clampedX);
    panBaseYAnim.setValue(clampedY);
    panGestureXAnim.setValue(0);
    panGestureYAnim.setValue(0);
  };
  const syncScale = (next: number) => {
    const clamped = clampScale(next);
    baseScaleRef.current = clamped;
    setScale(clamped);
    baseScaleAnim.setValue(clamped);
    pinchScaleAnim.setValue(1);
    syncPan(panBaseXRef.current, panBaseYRef.current, clamped);
  };

  useEffect(() => {
    if (!visible || !draft) return;
    if (draft.frameW > 0) setFrameW(draft.frameW);
    if (draft.frameH > 0) setFrameH(draft.frameH);
    syncScale(draft.scale || 1);
    syncPan(draft.translateX || 0, draft.translateY || 0, draft.scale || 1);
  }, [visible, draft]);

  if (!visible || !draft) return null;

  const nextDraft = { ...draft, scale, translateX, translateY, frameW, frameH };
  const isDark = theme.glass === 'dark';
  const border = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
  const cardBg = isDark ? '#1C1C1E' : '#F3F4F6';
  const muted = isDark ? '#A1A1AA' : '#6B7280';
  const guideColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const liveDraft = { ...draft, scale, translateX, translateY, frameW, frameH };
  const preview = isAvatar ? AVATAR_PREVIEW : LOGO_PREVIEW;

  const onPinchGestureEvent = Animated.event([{ nativeEvent: { scale: pinchScaleAnim } }], {
    useNativeDriver: true,
  });
  const onPinchStateChange = (event: any) => {
    const { oldState, scale: gestureScale } = event.nativeEvent || {};
    if (oldState !== State.ACTIVE) return;
    syncScale(baseScaleRef.current * Number(gestureScale || 1));
  };
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panGestureXAnim, translationY: panGestureYAnim } }],
    { useNativeDriver: true },
  );
  const onPanStateChange = (event: any) => {
    const { oldState, translationX, translationY } = event.nativeEvent || {};
    if (oldState !== State.ACTIVE) return;
    const nextX = panBaseXRef.current + Number(translationX || 0);
    const nextY = panBaseYRef.current + Number(translationY || 0);
    syncPan(nextX, nextY, baseScaleRef.current);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scaleModalBackdrop}>
        <View style={[styles.scaleModalCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.scaleModalTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.scaleModalSubtitle, { color: muted }]}>{subtitle}</Text>

          <PanGestureHandler
            ref={panRef}
            simultaneousHandlers={pinchRef}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanStateChange}
          >
            <Animated.View style={[styles.scaleCropFrame, { borderColor: border, aspectRatio: cropAspect }]}>
              <CropCheckerboard isDark={isDark} />
              <View
                style={[
                  styles.scaleCropMask,
                  {
                    margin: CROP_GUIDE_INSET,
                    borderRadius: guideRadius,
                  },
                ]}
                onLayout={(event) => {
                  const nextW = event.nativeEvent.layout.width;
                  const nextH = event.nativeEvent.layout.height;
                  if (nextW > 0 && Math.abs(nextW - frameW) > 0.5) setFrameW(nextW);
                  if (nextH > 0 && Math.abs(nextH - frameH) > 0.5) setFrameH(nextH);
                }}
              >
                <PinchGestureHandler
                  ref={pinchRef}
                  simultaneousHandlers={panRef}
                  onGestureEvent={onPinchGestureEvent}
                  onHandlerStateChange={onPinchStateChange}
                >
                  <Animated.View style={styles.scaleCropInner}>
                    <Animated.Image
                      source={{ uri: draft.uri }}
                      style={[
                        styles.scaleCropImage,
                        {
                          transform: [
                            { translateX: panCombinedX },
                            { translateY: panCombinedY },
                            { scale: pinchCombinedScale },
                          ],
                        },
                      ]}
                      resizeMode="cover"
                    />
                  </Animated.View>
                </PinchGestureHandler>
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.scaleCropGuide,
                  {
                    top: CROP_GUIDE_INSET,
                    left: CROP_GUIDE_INSET,
                    right: CROP_GUIDE_INSET,
                    bottom: CROP_GUIDE_INSET,
                    borderRadius: guideRadius,
                    borderColor: guideColor,
                  },
                ]}
              />
            </Animated.View>
          </PanGestureHandler>

          <View style={styles.scaleControls}>
            <Pressable
              style={[styles.scaleBtn, { borderColor: border, backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}
              onPress={() => syncScale(Number((scale - 0.15).toFixed(2)))}
            >
              <Ionicons name="remove" size={18} color={theme.text} />
            </Pressable>
            <Text style={[styles.scaleValue, { color: theme.text }]}>{Math.round(scale * 100)}%</Text>
            <Pressable
              style={[styles.scaleBtn, { borderColor: border, backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}
              onPress={() => syncScale(Number((scale + 0.15).toFixed(2)))}
            >
              <Ionicons name="add" size={18} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.scalePreviewRow}>
            <View
              style={[
                isAvatar ? styles.scalePreviewMini : styles.scalePreviewLogoWrap,
                {
                  width: preview.w,
                  height: preview.h,
                  borderRadius: preview.r,
                  borderColor: border,
                  backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB',
                  overflow: 'hidden',
                },
              ]}
            >
              <DraftFramedImage
                draft={liveDraft}
                width={preview.w}
                height={preview.h}
                borderRadius={preview.r}
              />
            </View>
          </View>

          <View style={styles.scaleActionRow}>
            <Pressable
              style={[styles.scaleCancelBtn, { borderColor: border, backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}
              onPress={onCancel}
            >
              <Text style={[styles.scaleCancelText, { color: muted }]}>Anuluj</Text>
            </Pressable>
            <Pressable style={styles.scaleConfirmBtn} onPress={() => onConfirm(nextDraft)}>
              <Text style={styles.scaleConfirmText}>Zastosuj</Text>
            </Pressable>
          </View>
        </View>
      </View>
    <NumericKeyboardAccessory />
    </Modal>
  );
}

// --- MODAL: RESET HASŁA ---
const ForgotPasswordModal = ({ visible, onClose, theme, t }: any) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const isDark = theme.glass === 'dark';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setEmail('');
      setOtp('');
      setNewPassword('');
      setNewPasswordVisible(false);
    }
  }, [visible]);

  const handleSendEmailCode = async () => {
    if (!email.includes('@')) return Alert.alert(t('common.error'), t('auth.invalidEmail'));
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep(2);
      } else {
        const d = await res.json();
        Alert.alert(t('common.error'), d.message || t('auth.userNotFound'));
      }
    } catch { Alert.alert(t('common.error'), t('common.networkError')); }
    setLoading(false);
  };

  const handleFinalReset = async () => {
    if (otp.length < 4) return Alert.alert(t('common.error'), t('auth.enterOtp'));
    if (newPassword.length < 6) return Alert.alert(t('common.error'), t('auth.passwordMin6'));
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ identifier: email, otp, newPassword })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('common.successTitle'), t('auth.passwordChanged'), [{ text: t('common.super'), onPress: onClose }]);
      } else {
        Alert.alert(t('common.error'), t('auth.invalidOtp'));
      }
    } catch { Alert.alert(t('common.error'), t('auth.resetFailed')); }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent={true}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: theme.background, borderRadius: 30, padding: 25, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{step === 1 ? t('auth.resetTitle1') : t('auth.resetTitle2')}</Text>
            <Pressable onPress={onClose}><Ionicons name="close-circle" size={28} color={theme.subtitle} /></Pressable>
          </View>
          {step === 1 ? (
            <View>
              <Text style={{ color: theme.subtitle, marginBottom: 20, fontSize: 14 }}>{t('auth.resetHint1')}</Text>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.emailPlaceholder')} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
                </View>
              </View>
              <Pressable onPress={handleSendEmailCode} style={[styles.mainButton, { backgroundColor: '#10b981', marginTop: 20 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>{t('auth.sendCode')}</Text>}
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={{ color: theme.subtitle, marginBottom: 15, fontSize: 14 }}>{t('auth.resetHint2')}</Text>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-open-outline" size={20} color={theme.subtitle} style={{marginRight: 10}} />
                  <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.otpPlaceholder')} keyboardType="numeric" placeholderTextColor={theme.subtitle} value={otp} onChangeText={setOtp} />
                </View>
                <View style={[styles.divider, { backgroundColor: cardBorder }]} />
                <View style={styles.inputRow}>
                  <Ionicons name="key-outline" size={20} color={theme.subtitle} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { color: theme.text, flex: 1 }]}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    secureTextEntry={!newPasswordVisible}
                    placeholderTextColor={theme.subtitle}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <PasswordEyeToggle
                    revealed={newPasswordVisible}
                    onToggle={() => setNewPasswordVisible((v) => !v)}
                    iconColor={theme.subtitle}
                    a11yHide={t('auth.hidePassword')}
                    a11yShow={t('auth.showPassword')}
                  />
                </View>
              </View>
              <Pressable onPress={handleFinalReset} style={[styles.mainButton, { backgroundColor: '#10b981', marginTop: 20 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>{t('auth.changePassword')}</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    <NumericKeyboardAccessory />
    </Modal>
  );
};


export default function AuthScreen({
  theme,
  authIntent,
  prefillEmail,
  embedded = false,
}: {
  theme: any;
  /** Z nawigacji (np. gość z oferty): który formularz pokazać od razu. */
  authIntent?: 'login' | 'register';
  /** E-mail z passkey promptu — wstępne wypełnienie pola logowania. */
  prefillEmail?: string;
  /** Render w zakładce Profil — bez animacji „warp” i bez navigate('Profil'). */
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [isLogin, setIsLogin] = useState(() => (authIntent === 'register' ? false : true));
  const [isForgotModalVisible, setIsForgotModalVisible] = useState(false);
  /**
   * Role dostępne przy rejestracji:
   *  • PRIVATE — osoba prywatna sprzedająca/wynajmująca własną
   *    nieruchomość.
   *  • AGENT   — agent nieruchomości reprezentujący biuro / agencję.
   *    Wymaga podania `companyName` (nazwa biura).
   *
   * UWAGA: rola PARTNER (do współpracy z EstateOS™) celowo NIE jest
   * dostępna przy rejestracji mobilnej — partner zakłada konto przez
   * dedykowany onboarding na stronie WWW. Nie mylić z AGENT.
   */
  const [role, setRole] = useState<'PRIVATE' | 'AGENT'>('PRIVATE');
  const [email, setEmail] = useState(() => String(prefillEmail || '').trim());
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  /** Pełna nazwa biura / agencji — widoczna i wymagana TYLKO dla AGENT (tryb create). */
  const [companyName, setCompanyName] = useState('');
  const [agencySetupMode, setAgencySetupMode] = useState<'create' | 'join'>('create');
  const [joinCompanyId, setJoinCompanyId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<AgencyCompanyListItem[]>([]);
  const [avatarDraft, setAvatarDraft] = useState<ImageDraft | null>(null);
  const [logoDraft, setLogoDraft] = useState<ImageDraft | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ target: 'avatar' | 'logo'; draft: ImageDraft } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [phoneCountryIso, setPhoneCountryIso] = useState<CountryCode>(() => getDeviceRegionCountry());
  const [phonePickerOpen, setPhonePickerOpen] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const store = useAuthStore() as any;
  const isDark = theme.glass === 'dark';

  // 🚀 ZJAWISKOWA ANIMACJA HYPER-DRIVE 🚀
  const warpAnim = useRef(new Animated.Value(0)).current;
  const successGlowAnim = useRef(new Animated.Value(0)).current;

  const handlePhoneChange = (text: string) => {
    const d = text.replace(/\D/g, '');
    setPhone(formatNationalAsYouType(phoneCountryIso, d));
  };

  useEffect(() => {
    if (isLogin) return;
    setPhone((prev) => formatNationalAsYouType(phoneCountryIso, prev.replace(/\D/g, '')));
  }, [phoneCountryIso, isLogin]);

  useEffect(() => {
    if (isLogin || email.length < 5 || !email.includes('@')) { setEmailStatus('idle'); return; }
    const timer = setTimeout(async () => {
      setEmailStatus('loading');
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, field: 'email', value: email })
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (d.exists === true || d.taken === true) {
          setEmailStatus('taken'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          setEmailStatus('available'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch { setEmailStatus('idle'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [email, isLogin]);

  useEffect(() => {
    const cleanDigits = phone.replace(/\D/g, '');
    if (isLogin || !cleanDigits) {
      setPhoneStatus('idle');
      return;
    }
    const e164 = buildE164FromNational(phoneCountryIso, cleanDigits);
    if (!e164 || !isValidPhoneNumber(e164)) {
      setPhoneStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setPhoneStatus('loading');
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: e164, field: 'phone', value: e164 }),
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (d.exists === true || d.taken === true) {
          setPhoneStatus('taken'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          setPhoneStatus('available'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch { setPhoneStatus('idle'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [phone, isLogin, phoneCountryIso]);

  useEffect(() => {
    setPasswordVisible(false);
  }, [isLogin]);

  useEffect(() => {
    if (authIntent === 'register') setIsLogin(false);
    else if (authIntent === 'login') setIsLogin(true);
  }, [authIntent]);

  useEffect(() => {
    const next = String(prefillEmail || '').trim();
    if (next) setEmail(next);
  }, [prefillEmail]);

  useEffect(() => {
    if (isLogin || role !== 'AGENT') return;
    void fetchAgencyCompanyList().then(setCompanyOptions).catch(() => setCompanyOptions([]));
  }, [isLogin, role]);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isLogin) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedPassword = String(password || '');
        const ok = await store.login(normalizedEmail, normalizedPassword);
        if (!ok) {
          Alert.alert(t('auth.loginErrorTitle'), store.error || t('auth.loginFailed'));
          return;
        }
      } else {
        const regDigits = phone.replace(/\D/g, '');
        const regE164 = buildE164FromNational(phoneCountryIso, regDigits);
        if (!firstName || !lastName || !regE164 || !isValidPhoneNumber(regE164)) {
          Alert.alert(t('common.error'), t('auth.fillBusinessCard'));
          return;
        }
        if (role === 'AGENT' && agencySetupMode === 'create' && companyName.trim().length < 2) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('auth.agencyMissingTitle'), t('auth.agencyMissingBody'));
          return;
        }
        if (role === 'AGENT' && agencySetupMode === 'join' && !joinCompanyId) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('auth.agencyJoinMissingTitle'), t('auth.agencyJoinMissingBody'));
          return;
        }
        if (emailStatus === 'taken') { Alert.alert(t('common.error'), t('auth.emailTaken')); return; }
        if (phoneStatus === 'taken') { Alert.alert(t('common.error'), t('auth.phoneTaken')); return; }
        
        if (!termsAccepted) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('auth.termsRequiredTitle'), t('auth.termsRequired'));
          return;
        }

        const isRegistered = await store.register(
          email,
          password,
          firstName,
          lastName,
          regE164,
          role,
          role === 'AGENT' && agencySetupMode === 'create' ? companyName.trim() : null,
          role === 'AGENT'
            ? {
                mode: agencySetupMode,
                joinCompanyId: agencySetupMode === 'join' ? joinCompanyId ?? undefined : undefined,
              }
            : undefined,
        );
        
        if (isRegistered) {
          const isLogged = await store.login(email, password, { registrationPhoneE164: regE164 });
          if (isLogged) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            try {
              setMediaBusy(true);
              if (avatarDraft?.uri) {
                const avatarUrl = await uploadImageAndResolveUrl(
                  avatarDraft.uri,
                  avatarDraft.fileName || `avatar_reg_${Date.now()}.jpg`,
                  avatarDraft.mimeType || 'image/jpeg',
                );
                if (avatarUrl) {
                  await store.updateAvatar?.(avatarUrl);
                  await store.refreshUser?.();
                }
              }
              const freshToken = useAuthStore.getState().token;
              if (role === 'AGENT' && agencySetupMode === 'create' && logoDraft?.uri && freshToken) {
                const logoUrl = await uploadImageAndResolveUrl(
                  logoDraft.uri,
                  logoDraft.fileName || `agency_logo_${Date.now()}.jpg`,
                  logoDraft.mimeType || 'image/jpeg',
                );
                if (logoUrl) {
                  await patchAgencyCompanyContact(freshToken, { logoUrl } as any);
                  await store.refreshAgencyMembership?.();
                }
              }
            } catch (mediaErr: any) {
              Alert.alert(
                t('auth.mediaPartialTitle'),
                t('auth.mediaPartialBody'),
              );
            } finally {
              setMediaBusy(false);
            }
            // Od razu po rejestracji wysyłamy kod weryfikacyjny na podany e-mail (jeśli backend wspiera).
            const verifySend = await store
              .sendCurrentEmailVerification()
              .catch(() => ({ ok: false, error: 'Wysyłka kodu nieudana.' } as { ok: boolean; error?: string }));
            const verifiedMsg = verifySend?.ok
              ? t('auth.accountCreatedVerified', { email })
              : t('auth.accountCreatedFallback');
            Alert.alert(
              t('auth.accountCreatedTitle'),
              verifiedMsg,
              [{ text: t('auth.understand'), style: 'default' }]
            );
          } else {
            Alert.alert(t('common.success'), t('auth.accountCreated'));
            setIsLogin(true);
          }
        }
      }
    } catch (e: any) { Alert.alert(t('common.error'), e.message); }
  };

  // 🔥 MISTRZOWSKA OBSŁUGA PASSKEY Z EFEKTEM 3D 🔥
  const handlePasskey = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
    setIsPasskeyLoading(true);
    
    try { 
      // 1. Oczekujemy na weryfikację Face ID. Store obsłuży dane i token, w ciszy.
      const success = await store.loginWithPasskey(email); 

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (embedded) {
          // Profil sam przełączy się na widok zalogowany — bez navigate i bez 3D (stabilność RN).
          return;
        }
        Animated.sequence([
          Animated.timing(successGlowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(warpAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]).start(() => {
          try {
            navigation.navigate('Profil');
          } catch {
            // noop
          }
        });
      }
    } catch (e: any) {
      // PasskeyService już pokaże konkretny, przyjazny komunikat (Brak klucza / Face ID wyłączone /
      // Brak sieci / Błąd konfiguracji). Tu wyłapujemy tylko sytuacje, których nie objęła warstwa serwisu
      // (np. błędy w samym storze przy zapisie tokena/AsyncStorage) — wówczas pokazujemy generyczny komunikat.
      const msg = String(e?.message || '').toLowerCase();
      const isCancelLike = /cancel|cancelled|canceled|anulow/.test(msg);
      const handledByService =
        /brak klucza|face id|touch id|brak po\u0142\u0105czenia|niezgodno\u015b\u0107|logowanie face id|chwilowy problem|nie uda\u0142o si\u0119 doda\u0107|biometri/i.test(msg);
      if (!isCancelLike && !handledByService && msg) {
        Alert.alert(t('auth.passkeyFailedTitle'), t('auth.passkeyFailedBody'));
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const dividerColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const formTopInset = insets.top + (Platform.OS === 'ios' ? 84 : 72);
  const selectedJoinCompany =
    agencySetupMode === 'join' && joinCompanyId
      ? companyOptions.find((c) => c.id === joinCompanyId) || null
      : null;
  const selectedJoinLogoUrl = (() => {
    const raw = String(selectedJoinCompany?.logoUrl || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${API_URL}${raw}`;
    return `${API_URL}/${raw}`;
  })();
  const readFileSize = async (uri: string) => {
    const info = await FileSystem.getInfoAsync(uri, { size: true } as any);
    return typeof (info as any)?.size === 'number' ? Number((info as any).size) : 0;
  };
  const getFileMeta = (uri: string, fallbackName = `media_${Date.now()}`) => {
    const cleanUri = String(uri || '').split('?')[0];
    const last = cleanUri.split('/').pop() || fallbackName;
    const name = last.includes('.') ? last : `${last}.jpg`;
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const mimeByExt: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      heic: 'image/heic',
      heif: 'image/heif',
    };
    const mimeType = mimeByExt[ext] || 'image/jpeg';
    const isAnimated = ext === 'gif' || ext === 'webp';
    return { name, mimeType, isAnimated };
  };
  const pickRegistrationImage = async (target: 'avatar' | 'logo') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('common.error'), t('auth.mediaPermissionDenied'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.95,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const assetSize =
        typeof (asset as any)?.fileSize === 'number'
          ? Number((asset as any).fileSize)
          : await readFileSize(asset.uri);
      if (assetSize > MAX_MEDIA_FILE_BYTES) {
        Alert.alert(t('common.error'), t('auth.mediaTooLarge'));
        return;
      }
      const fileMeta = getFileMeta(asset.uri, asset.fileName || `${target}_${Date.now()}`);
      const frameW = 280;
      const frameH = target === 'logo' ? Math.round(280 / LOGO_ASPECT) : 280;
      setEditingDraft({
        target,
        draft: {
          uri: asset.uri,
          width: asset.width || 1200,
          height: asset.height || 1200,
          scale: 1,
          translateX: 0,
          translateY: 0,
          frameW,
          frameH,
          mimeType: fileMeta.mimeType,
          fileName: fileMeta.name,
          isAnimated: fileMeta.isAnimated,
          fileSize: Number.isFinite(assetSize) ? assetSize : undefined,
        },
      });
    } catch {
      Alert.alert(t('common.error'), t('auth.mediaPickFailed'));
    }
  };

  const finalizeDraft = async (draft: ImageDraft) => {
    try {
      let fileSize = typeof draft.fileSize === 'number' ? draft.fileSize : 0;
      if (!fileSize) {
        try {
          fileSize = await readFileSize(draft.uri);
        } catch {
          fileSize = 0;
        }
      }
      if (fileSize > MAX_MEDIA_FILE_BYTES) {
        Alert.alert(t('common.error'), t('auth.mediaTooLarge'));
        return;
      }
      const next: ImageDraft = { ...draft };
      if (editingDraft?.target === 'avatar') setAvatarDraft(next);
      else setLogoDraft(next);
      setEditingDraft(null);
    } catch {
      Alert.alert(t('common.error'), t('auth.mediaEditFailed'));
    }
  };

  const uploadImageAndResolveUrl = async (localUri: string, fileName?: string, mimeType?: string) => {
    const current = useAuthStore.getState();
    const freshToken = current.token;
    const freshUser = current.user;
    if (!freshToken || !freshUser?.id) return null;
    const meta = getFileMeta(localUri, fileName || `media_${Date.now()}`);
    const finalName = fileName || meta.name;
    const finalMimeType = mimeType || meta.mimeType;
    const formData = new FormData();
    formData.append('userId', String(freshUser.id));
    formData.append('file', { uri: localUri, name: finalName, type: finalMimeType } as any);
    const res = await fetch(`${API_URL}/api/mobile/v1/user/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshToken}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new Error(data?.message || data?.error || 'UPLOAD_FAILED');
    const rel =
      (typeof data.url === 'string' && data.url) ||
      (typeof data.avatarUrl === 'string' && data.avatarUrl) ||
      (typeof data.avatar === 'string' && data.avatar) ||
      (typeof data.path === 'string' && data.path) ||
      (typeof data?.data?.url === 'string' && data.data.url) ||
      '';
    if (!rel) throw new Error('UPLOAD_NO_URL');
    return /^https?:\/\//i.test(rel) ? rel : rel.startsWith('/') ? `${API_URL}${rel}` : `${API_URL}/${rel}`;
  };

  // 🌟 OBLICZENIA DLA EFEKTU "HYPER-DRIVE" 🌟
  const scale = warpAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [1, 0.85, 3] 
  });

  const rotateX = warpAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['0deg', '-12deg', '0deg']
  });

  const rotateY = warpAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['0deg', '0deg', '180deg']
  });

  const opacity = warpAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 1, 0]
  });

  const FormShell = embedded ? View : Animated.View;
  const formShellStyle: StyleProp<ViewStyle> = embedded
    ? { flex: 1 }
    : {
        flex: 1,
        opacity,
        transform: [
          { perspective: 850 },
          { scale },
          { rotateX },
          { rotateY },
        ],
        elevation: 20,
        backfaceVisibility: 'hidden',
      };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={[styles.langFlagsBar, { top: insets.top + (Platform.OS === 'ios' ? 10 : 14) }]}
        pointerEvents="box-none"
      >
        <AuthLanguageFlags isDark={isDark} />
      </View>

      <FormShell style={formShellStyle}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', padding: 25, paddingTop: formTopInset, paddingBottom: 50 }}>
          
          <View style={[styles.iconWrapper, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <RegistrationHeroIcon isLogin={isLogin} role={role} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{isLogin ? t('auth.welcomeBack') : t('auth.createCard')}</Text>

          {!isLogin ? (
            <View style={[styles.regMediaCard, { backgroundColor: isDark ? cardBg : '#FFFFFF', borderColor: isDark ? cardBorder : 'rgba(0,0,0,0.12)' }]}>
              <View style={styles.regMediaRow}>
                <Pressable
                  style={[styles.regMediaSlot, { borderColor: isDark ? dividerColor : 'rgba(0,0,0,0.14)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }]}
                  onPress={() => void pickRegistrationImage('avatar')}
                >
                  {avatarDraft?.uri ? (
                    <DraftFramedImage
                      draft={avatarDraft}
                      width={AVATAR_PREVIEW.w}
                      height={AVATAR_PREVIEW.h}
                      borderRadius={AVATAR_PREVIEW.r}
                      backgroundColor={isDark ? '#2C2C2E' : '#E5E7EB'}
                    />
                  ) : (
                    <Ionicons name="camera-outline" size={20} color={theme.subtitle} />
                  )}
                  <Text style={[styles.regMediaLabel, { color: theme.text }]}>{t('auth.addProfilePhoto')}</Text>
                </Pressable>

                {role === 'AGENT' && agencySetupMode === 'create' ? (
                  <Pressable
                    style={[styles.regMediaSlot, { borderColor: isDark ? dividerColor : 'rgba(0,0,0,0.14)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' }]}
                    onPress={() => void pickRegistrationImage('logo')}
                  >
                    {logoDraft?.uri ? (
                      <DraftFramedImage
                        draft={logoDraft}
                        width={LOGO_PREVIEW.w}
                        height={LOGO_PREVIEW.h}
                        borderRadius={LOGO_PREVIEW.r}
                        backgroundColor={isDark ? '#2C2C2E' : '#E5E7EB'}
                      />
                    ) : (
                      <Ionicons name="briefcase-outline" size={20} color={theme.subtitle} />
                    )}
                    <Text style={[styles.regMediaLabel, { color: theme.text }]}>{t('auth.addAgencyLogo')}</Text>
                  </Pressable>
                ) : null}

                {role === 'AGENT' && agencySetupMode === 'join' ? (
                  <View
                    style={[
                      styles.regMediaSlot,
                      styles.regMediaSlotReadonly,
                      {
                        borderColor: isDark ? dividerColor : 'rgba(0,0,0,0.14)',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6',
                      },
                    ]}
                    accessibilityRole="image"
                    accessibilityLabel={t('auth.joinOfficeLogo')}
                  >
                    {selectedJoinLogoUrl ? (
                      <Image
                        source={{ uri: selectedJoinLogoUrl }}
                        style={styles.regJoinLogoPreview}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons name="business-outline" size={20} color={theme.subtitle} />
                    )}
                    <Text style={[styles.regMediaLabel, { color: theme.text }]}>{t('auth.joinOfficeLogo')}</Text>
                    <Text style={[styles.regMediaReadonlyHint, { color: theme.subtitle }]}>
                      {selectedJoinCompany
                        ? selectedJoinCompany.name
                        : t('auth.joinOfficeLogoEmpty')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.regMediaHint, { color: theme.subtitle }]}>
                {role === 'AGENT' && agencySetupMode === 'join'
                  ? t('auth.joinOfficeLogoHint')
                  : t('auth.mediaHint')}
              </Text>
            </View>
          ) : null}
          
          {!isLogin && (
            <View style={{ marginBottom: 25 }}>
              <AppleSlidingSegment
                value={role}
                options={[
                  { value: 'PRIVATE', label: t('auth.rolePrivate') },
                  { value: 'AGENT', label: t('auth.roleAgent') },
                ]}
                onChange={setRole}
                isDark={isDark}
                containerStyle={{ backgroundColor: cardBg, borderColor: cardBorder }}
                activeGradient={
                  role === 'AGENT'
                    ? ['#FFB44A', '#FF9F0A', '#F59E0B']
                    : ['#34D399', '#10B981', '#059669']
                }
              />
            </View>
          )}

          {!isLogin && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.firstName')} placeholderTextColor={theme.subtitle} value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.lastName')} placeholderTextColor={theme.subtitle} value={lastName} onChangeText={setLastName} />
              </View>
              {/*
                Pole „Nazwa firmy" pojawia się TYLKO dla roli AGENT —
                między nazwiskiem a telefonem, żeby formularz wizytówki
                czytał się jak naturalna kolejność „Kto + Skąd". Dla
                osoby prywatnej pole nie istnieje w drzewie (nie miga
                opacity, więc nie ma layout-shake).
              */}
              {role === 'AGENT' && (
                <>
                  <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                  <AppleSlidingSegment
                    value={agencySetupMode}
                    options={[
                      { value: 'create', label: t('auth.agencyModeCreate') },
                      { value: 'join', label: t('auth.agencyModeJoin') },
                    ]}
                    onChange={(next) => {
                      if (next === 'create') {
                        setAgencySetupMode('create');
                        setJoinCompanyId(null);
                      } else {
                        setAgencySetupMode('join');
                        setCompanyName('');
                        setLogoDraft(null);
                      }
                    }}
                    isDark={isDark}
                    compact
                    containerStyle={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      marginBottom: 0,
                    }}
                    activeGradient={['#FFB44A', '#FF9F0A', '#F59E0B']}
                  />
                  <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                  {agencySetupMode === 'create' ? (
                    <View style={styles.inputRow}>
                      <Ionicons name="business" size={18} color="#FF9F0A" style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: theme.text, flex: 1 }]}
                        placeholder={t('auth.agencyName')}
                        placeholderTextColor={theme.subtitle}
                        value={companyName}
                        onChangeText={setCompanyName}
                        autoCapitalize="words"
                        maxLength={80}
                      />
                    </View>
                  ) : (
                    <View style={styles.inputRow}>
                      <Ionicons name="business" size={18} color="#FF9F0A" style={{ marginRight: 10 }} />
                      <Picker
                        selectedValue={joinCompanyId ?? 0}
                        onValueChange={(v) => setJoinCompanyId(Number(v) || null)}
                        style={{ flex: 1, color: theme.text }}
                        dropdownIconColor={theme.subtitle}
                      >
                        <Picker.Item label={t('auth.agencyPickCompany')} value={0} />
                        {companyOptions.map((c) => (
                          <Picker.Item key={c.id} label={c.city ? `${c.name} · ${c.city}` : c.name} value={c.id} />
                        ))}
                      </Picker>
                    </View>
                  )}
                </>
              )}
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.inputRow}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPhonePickerOpen(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                >
                  <Text style={{ fontSize: 22, marginRight: 6 }}>{flagEmojiFromIso2(phoneCountryIso)}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>+{dialCodeFor(phoneCountryIso)}</Text>
                  <Ionicons name="chevron-down" size={16} color={theme.subtitle} style={{ marginLeft: 4 }} />
                </Pressable>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.phoneNumber')} placeholderTextColor={theme.subtitle} keyboardType="numeric" value={phone} onChangeText={handlePhoneChange} />
                <StatusIcon status={phoneStatus} />
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, marginTop: isLogin ? 0 : 15 }]}>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.email')} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
              {!isLogin && <StatusIcon status={emailStatus} />}
            </View>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: theme.text, flex: 1 }]}
                placeholder={t('auth.password')}
                secureTextEntry={!passwordVisible}
                placeholderTextColor={theme.subtitle}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <PasswordEyeToggle
                revealed={passwordVisible}
                onToggle={() => setPasswordVisible((v) => !v)}
                iconColor={theme.subtitle}
                a11yHide={t('auth.hidePassword')}
                a11yShow={t('auth.showPassword')}
              />
            </View>
          </View>

          {isLogin && (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsForgotModalVisible(true); }} style={{ alignSelf: 'flex-end', marginTop: 15 }}>
              <Text style={{ color: theme.subtitle, fontSize: 13, fontWeight: '600' }}>{t('auth.forgotPassword')}</Text>
            </Pressable>
          )}

          {!isLogin && (
            <PremiumCheckbox 
              checked={termsAccepted} 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTermsAccepted(!termsAccepted); }}
              onReadTerms={() => {
                Haptics.selectionAsync();
                void openLegalDocument('terms').catch(() => undefined);
              }}
              onReadPrivacy={() => {
                Haptics.selectionAsync();
                void openLegalDocument('privacy').catch(() => undefined);
              }}
              theme={theme}
              t={t}
            />
          )}

          <Pressable onPress={handleSubmit} style={({ pressed }) => [
              styles.mainButton, 
              { opacity: pressed ? 0.8 : 1, backgroundColor: isLogin ? '#10b981' : (role === 'AGENT' ? '#FF9F0A' : '#10b981') },
              !isLogin && role === 'AGENT' && { shadowColor: '#FF9F0A' }
            ]}>
            {mediaBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.mainButtonText}>{isLogin ? t('auth.login') : t('auth.joinEcosystem')}</Text>
            )}
          </Pressable>

          {isLogin && (
            <View style={styles.passkeySection}>
              <View style={styles.dividerRow}>
                <View style={[styles.line, { backgroundColor: dividerColor }]} />
                <Text style={{ color: theme.subtitle, paddingHorizontal: 15, fontSize: 12, fontWeight: '700' }}>{t('auth.orDivider')}</Text>
                <View style={[styles.line, { backgroundColor: dividerColor }]} />
              </View>

              <Pressable onPress={handlePasskey} style={({ pressed }) => [styles.passkeyBtn, { backgroundColor: cardBg, borderColor: cardBorder }, pressed && { opacity: 0.6 }]}>
                {isPasskeyLoading ? <ActivityIndicator size="small" color={theme.text} /> : (
                  <>
                    <Ionicons name="finger-print" size={24} color={theme.text} style={{ marginRight: 12 }} />
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{authPasskeyButtonLabel(t as any)}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsLogin(!isLogin); }} style={{ marginTop: 25, alignItems: 'center' }}>
            <Text style={{ color: theme.subtitle, fontSize: 15 }}>
              {isLogin ? `${t('auth.noAccount')} ` : `${t('auth.haveAccount')} `}
              <Text style={{ color: isLogin ? '#10b981' : (role === 'AGENT' ? '#FF9F0A' : '#10b981'), fontWeight: '700' }}>
                {isLogin ? t('auth.registerLink') : t('auth.loginLink')}
              </Text>
            </Text>
          </Pressable>

        </ScrollView>
      </FormShell>
      <PhoneCountryPickerModal
        visible={phonePickerOpen}
        onClose={() => setPhonePickerOpen(false)}
        selectedIso={phoneCountryIso}
        onSelect={setPhoneCountryIso}
        isDark={isDark}
      />
      <ImageScalePreviewModal
        visible={Boolean(editingDraft)}
        draft={editingDraft?.draft || null}
        target={editingDraft?.target || 'avatar'}
        title={editingDraft?.target === 'logo' ? t('auth.editAgencyLogo') : t('auth.editProfilePhoto')}
        subtitle={t('auth.mediaScaleHint')}
        theme={theme}
        onCancel={() => setEditingDraft(null)}
        onConfirm={(next) => {
          void finalizeDraft(next);
        }}
      />
      <ForgotPasswordModal visible={isForgotModalVisible} onClose={() => setIsForgotModalVisible(false)} theme={theme} t={t} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  langFlagsBar: {
    position: 'absolute',
    right: 22,
    zIndex: 20,
    alignItems: 'flex-end',
  },
  iconWrapper: { width: 80, height: 80, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 25, alignSelf: 'center', borderWidth: 1 },
  heroIconAgentWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconAdd: {
    position: 'absolute',
    left: -2,
    top: 4,
  },
  heroBriefcase: {
    position: 'absolute',
    right: -8,
    bottom: 3,
    minWidth: 30,
    paddingHorizontal: 4,
    height: 22,
    borderRadius: 8,
    backgroundColor: '#FF9F0A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9F0A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 4,
  },
  heroAgentLabel: {
    position: 'absolute',
    right: -9,
    bottom: -8,
    fontSize: 6,
    lineHeight: 7,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 30, letterSpacing: -0.5 },
  regMediaCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
  },
  regMediaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  regMediaSlot: {
    flex: 1,
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 8,
  },
  regMediaSlotReadonly: {
    opacity: 0.95,
  },
  regJoinLogoPreview: {
    width: LOGO_PREVIEW.w,
    height: LOGO_PREVIEW.h,
    borderRadius: LOGO_PREVIEW.r,
  },
  regMediaReadonlyHint: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  regAvatarPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  regLogoPreview: {
    width: 72,
    height: 49,
    borderRadius: 10,
  },
  regMediaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  regMediaHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 14,
  },
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  input: { fontSize: 17, fontWeight: '600' },
  divider: { height: 1, marginHorizontal: 20 },
  mainButton: { padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 15, shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 },
  mainButtonText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 25, paddingHorizontal: 5 },
  checkboxTouchArea: { padding: 5, marginRight: 10 },
  checkboxBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  checkboxTextContainer: { flex: 1 },
  checkboxText: { fontSize: 13, lineHeight: 20 },
  passkeySection: { marginTop: 25 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  line: { flex: 1, height: 1 },
  passkeyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, borderWidth: 1 }
  ,
  scaleModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  scaleModalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  scaleModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scaleModalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  scaleCropFrame: {
    marginTop: 12,
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#E5E7EB',
  },
  scaleCheckerboard: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scaleCropMask: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  scaleCropInner: {
    ...StyleSheet.absoluteFillObject,
  },
  scaleCropImage: {
    width: '100%',
    height: '100%',
  },
  scaleCropGuide: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  scaleControls: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  scaleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleValue: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
  scalePreviewRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scalePreviewMini: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  scalePreviewAvatar: {
    width: '100%',
    height: '100%',
  },
  scalePreviewLogoWrap: {
    width: 72,
    height: 49,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  scalePreviewLogo: {
    width: '100%',
    height: '100%',
  },
  scaleActionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  scaleCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scaleConfirmBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
