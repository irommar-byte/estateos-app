import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { decodeRegistrationDocument } from '../../services/carsMutations';
import type { CarRegistrationPrefill } from '../../utils/carRegistrationPrefill';
import { useCarScreenTheme, type CarScreenColors } from '../../theme/carScreenTheme';

type CameraScannerComponent = React.ComponentType<{
  loading: boolean;
  scanned: boolean;
  onBarcode: (payload: string) => void;
  onCancel: () => void;
}>;

type CarRegistrationScanPromptProps = {
  visible: boolean;
  token: string | null;
  onSkip: () => void;
  onPrefill: (prefill: CarRegistrationPrefill, missingFields: string[]) => void;
  /** When set, immediately start this capture path when the modal opens. */
  initialMode?: 'live' | 'upload' | 'capture';
};

const hasNativeCameraModule = Boolean(requireOptionalNativeModule('ExpoCamera'));

export default function CarRegistrationScanPrompt({
  visible,
  token,
  onSkip,
  onPrefill,
  initialMode,
}: CarRegistrationScanPromptProps) {
  const { colors, elevation } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [CameraScanner, setCameraScanner] = useState<CameraScannerComponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cameraOpen) {
        setCameraOpen(false);
        setScanned(false);
        return true;
      }
      onSkip();
      return true;
    });
    return () => subscription.remove();
  }, [visible, cameraOpen, onSkip]);

  useEffect(() => {
    if (!cameraOpen || !hasNativeCameraModule) return;
    let cancelled = false;
    void import('./CarAztecCameraScanner')
      .then((mod) => {
        if (!cancelled) setCameraScanner(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraOpen(false);
          setError('Skan na żywo wymaga nowego builda aplikacji z expo-camera (expo run:ios / EAS build).');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cameraOpen]);

  const handleDecode = useCallback(
    async (input: { aztecPayload?: string; imageUri?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await decodeRegistrationDocument(token, input);
        onPrefill(result.prefill, result.missingFields);
        setCameraOpen(false);
        setScanned(false);
      } catch (decodeError) {
        setError(decodeError instanceof Error ? decodeError.message : 'Nie udało się odczytać dowodu.');
        setScanned(false);
      } finally {
        setLoading(false);
      }
    },
    [onPrefill, token],
  );

  const prepareDocumentPhoto = async (uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 2200 } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
    );
    return manipulated.uri;
  };

  const pickImage = async (source: 'library' | 'camera') => {
    setError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Brak dostępu do aparatu. Możesz wybrać zdjęcie dowodu z galerii.');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
          });

    if (result.canceled || !result.assets[0]?.uri) return;
    const preparedUri = await prepareDocumentPhoto(result.assets[0].uri);
    await handleDecode({ imageUri: preparedUri });
  };

  const openLiveScanner = () => {
    if (!hasNativeCameraModule) {
      setError('Skan na żywo wymaga nowego builda aplikacji z expo-camera (expo run:ios / EAS build).');
      return;
    }
    setError(null);
    setScanned(false);
    setCameraScanner(null);
    setCameraOpen(true);
  };

  useEffect(() => {
    if (!visible || !initialMode) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (initialMode === 'live') openLiveScanner();
      else if (initialMode === 'capture') void pickImage('camera');
      else if (initialMode === 'upload') void pickImage('library');
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- launch preferred path once per open
  }, [visible, initialMode]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <View style={[styles.card, elevation.card]}>
          {!cameraOpen ? (
            <>
              <Text style={styles.eyebrow}>Dowód rejestracyjny</Text>
              <Text style={styles.title}>Czy masz dowód rejestracyjny?</Text>
              <Text style={styles.copy}>
                Zeskanuj kod Aztec z tyłu dowodu lub wybierz zdjęcie. Uzupełnimy VIN, nr rejestracyjny, markę, model
                (np. Seria 5), wersję (np. 525d) i parametry silnika.
              </Text>
              <Text style={styles.hint}>
                Kod jest na odwrocie dowodu. Przybliż go tak, żeby wypełniał większość kadru i unikaj odblasków.
              </Text>

              <Pressable onPress={openLiveScanner} disabled={loading} style={styles.primaryBtn}>
                <Text style={styles.primaryLabel}>Skanuj kod na żywo</Text>
              </Pressable>
              <Pressable onPress={() => void pickImage('camera')} disabled={loading} style={styles.secondaryBtn}>
                {loading ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.secondaryLabel}>Zrób zdjęcie dowodu</Text>}
              </Pressable>
              <Pressable onPress={() => void pickImage('library')} disabled={loading} style={styles.secondaryBtn}>
                <Text style={styles.secondaryLabel}>Wybierz zdjęcie z galerii</Text>
              </Pressable>
              <Pressable onPress={onSkip} style={styles.skipBtn}>
                <Text style={styles.skipLabel}>Nie mam dowodu — wypełnię ręcznie</Text>
              </Pressable>
            </>
          ) : CameraScanner ? (
            <CameraScanner
              loading={loading}
              scanned={scanned}
              onBarcode={(payload) => {
                setScanned(true);
                void handleDecode({ aztecPayload: payload });
              }}
              onCancel={() => {
                setCameraOpen(false);
                setScanned(false);
                setCameraScanner(null);
              }}
            />
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.accentSoft} />
              <Text style={styles.copy}>Uruchamianie skanera...</Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.modalBg,
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.modalCard,
      padding: 20,
      gap: 12,
    },
    eyebrow: {
      color: colors.accentSoft,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
    },
    copy: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    hint: {
      color: colors.warningText,
      fontSize: 13,
      lineHeight: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningBg,
      padding: 10,
    },
    loadingBox: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
    },
    primaryBtn: {
      marginTop: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryLabel: {
      color: colors.primaryButtonText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    secondaryBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    skipBtn: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    skipLabel: {
      color: colors.muted,
      fontSize: 13,
    },
    error: {
      color: '#FCA5A5',
      fontSize: 13,
      marginTop: 4,
    },
  });
}
