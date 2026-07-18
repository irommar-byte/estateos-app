import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Camera,
  FileSearch,
  Keyboard,
  Link2,
  ScanLine,
  ShieldCheck,
  Upload,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCarScreenTheme, type CarScreenColors, carCardElevation } from '../../theme/carScreenTheme';
import {
  importCarFromOtomotoUrl,
  isSupportedOtomotoOfferUrl,
  type OtomotoCarImportPrefill,
} from '../../services/carsOtomotoImport';
import type { CarListingMissingFieldKey } from '../../utils/carRegistrationPrefill';

export type CarAddEntryMethod = 'scan' | 'upload' | 'capture' | 'manual' | 'otomoto';

type CarAddEntryPanelProps = {
  restrictDocsDefault?: boolean;
  onRestrictChange?: (value: boolean) => void;
  onChoose: (method: CarAddEntryMethod) => void;
  onOtomotoImported: (payload: {
    prefill: OtomotoCarImportPrefill;
    missingFields: CarListingMissingFieldKey[];
  }) => void;
};

type DocMode = 'scan' | 'upload' | 'capture';

export default function CarAddEntryPanel({
  restrictDocsDefault = true,
  onRestrictChange,
  onChoose,
  onOtomotoImported,
}: CarAddEntryPanelProps) {
  const { colors, isDark } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [restrictDocs, setRestrictDocs] = useState(restrictDocsDefault);
  const [path, setPath] = useState<'otomoto' | 'doc' | null>(null);
  const [docMode, setDocMode] = useState<DocMode>('scan');
  const [otomotoUrl, setOtomotoUrl] = useState('');
  const [otomotoLoading, setOtomotoLoading] = useState(false);

  const toggleRestrict = () => {
    const next = !restrictDocs;
    setRestrictDocs(next);
    onRestrictChange?.(next);
    void Haptics.selectionAsync();
  };

  const runOtomotoImport = async () => {
    const trimmed = otomotoUrl.trim();
    if (!trimmed) {
      Alert.alert('Otomoto', 'Wklej link do ogłoszenia Otomoto.');
      return;
    }
    if (!isSupportedOtomotoOfferUrl(trimmed)) {
      Alert.alert('Otomoto', 'Potrzebujemy bezpośredniego linku Otomoto z /oferta/…');
      return;
    }
    setOtomotoLoading(true);
    try {
      const result = await importCarFromOtomotoUrl(trimmed);
      onOtomotoImported(result);
      onChoose('otomoto');
    } catch (error) {
      Alert.alert('Otomoto', error instanceof Error ? error.message : 'Import nie powiódł się.');
    } finally {
      setOtomotoLoading(false);
    }
  };

  const docModes: { id: DocMode; icon: typeof ScanLine; title: string; description: string }[] = [
    {
      id: 'scan',
      icon: ScanLine,
      title: 'Skan na żywo',
      description: 'Skieruj kamerę na kod Aztec w dowodzie rejestracyjnym.',
    },
    {
      id: 'upload',
      icon: Upload,
      title: 'Wgraj zdjęcie',
      description: 'Wybierz zdjęcie dowodu z galerii.',
    },
    {
      id: 'capture',
      icon: Camera,
      title: 'Zrób zdjęcie',
      description: 'Sfotografuj dowód aparatem i odczytaj kod.',
    },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>EstateOS™Car</Text>
        <Text style={styles.heroTitle}>Jak chcesz dodać ogłoszenie?</Text>
        <Text style={styles.heroBody}>
          Możesz przenieść ogłoszenie z Otomoto albo uzupełnić formularz z dowodu rejestracyjnego. Konto
          zakładamy dopiero przed publikacją.
        </Text>
      </View>

      <View style={styles.privacyCard}>
        <View style={styles.privacyTop}>
          <View style={styles.privacyIcon}>
            <ShieldCheck color={colors.accentSoft} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyEyebrow}>Prywatność dokumentów</Text>
            <Text style={styles.privacyTitle}>VIN i rejestracja mogą być ukryte</Text>
            <Text style={styles.privacyBody}>
              Historia CEPIK / UFG działa dla kupujących nawet gdy dane dokumentu są ograniczone.
            </Text>
          </View>
        </View>
        <Pressable onPress={toggleRestrict} style={styles.switchRow}>
          <View style={[styles.checkbox, restrictDocs && styles.checkboxOn]}>
            {restrictDocs ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Ogranicz widoczność dokumentów</Text>
            <Text style={styles.switchHint}>Zalecane — kupujący widzą tylko status weryfikacji.</Text>
          </View>
        </Pressable>
        <View style={styles.hintRow}>
          <FileSearch color={colors.accentSoft} size={14} />
          <Text style={styles.hintText}>Możesz to zmienić później w formularzu.</Text>
        </View>
      </View>

      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setPath(path === 'otomoto' ? null : 'otomoto');
        }}
        style={[styles.pathCard, path === 'otomoto' && styles.pathCardActive]}
      >
        <View style={styles.pathHeader}>
          <View style={styles.pathIcon}>
            <Link2 color={colors.accentSoft} size={20} />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Szybko</Text>
          </View>
        </View>
        <Text style={styles.pathTitle}>Import z Otomoto</Text>
        <Text style={styles.pathBody}>Wklej link do ogłoszenia — przeniesiemy dane i zdjęcia.</Text>
      </Pressable>

      {path === 'otomoto' ? (
        <View style={styles.otomotoBox}>
          <TextInput
            value={otomotoUrl}
            onChangeText={setOtomotoUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://www.otomoto.pl/osobowe/oferta/…"
            placeholderTextColor={colors.placeholder}
            style={styles.otomotoInput}
          />
          <Pressable onPress={runOtomotoImport} disabled={otomotoLoading} style={styles.otomotoBtn}>
            {otomotoLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.otomotoBtnLabel}>Przenieś</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setPath(path === 'doc' ? null : 'doc');
        }}
        style={[styles.pathCard, path === 'doc' && styles.pathCardActive]}
      >
        <View style={styles.pathHeader}>
          <View style={styles.pathIcon}>
            <ScanLine color={colors.accentSoft} size={20} />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Dowód</Text>
          </View>
        </View>
        <Text style={styles.pathTitle}>Z dowodu rejestracyjnego</Text>
        <Text style={styles.pathBody}>Skan Aztec, zdjęcie lub wgranie — uzupełnimy markę, model i VIN.</Text>
      </Pressable>

      {path === 'doc' ? (
        <View style={styles.docModes}>
          {docModes.map((mode) => {
            const Icon = mode.icon;
            const active = docMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                onPress={() => {
                  setDocMode(mode.id);
                  void Haptics.selectionAsync();
                }}
                style={[styles.docModeCard, active && styles.docModeCardActive]}
              >
                <Icon color={active ? colors.accentSoft : colors.muted} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docModeTitle}>{mode.title}</Text>
                  <Text style={styles.docModeBody}>{mode.description}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onChoose(docMode);
            }}
            style={styles.continueBtn}
          >
            <Text style={styles.continueLabel}>Kontynuuj ze skanem</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onChoose('manual');
        }}
        style={styles.manualBtn}
      >
        <Keyboard color={colors.textSecondary} size={18} />
        <Text style={styles.manualLabel}>Wypełnij formularz ręcznie</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: CarScreenColors, isDark: boolean) {
  return StyleSheet.create({
    root: { gap: 14 },
    hero: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      padding: 18,
      ...carCardElevation(isDark, 'sm'),
    },
    heroEyebrow: {
      color: colors.accentSoft,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
    heroBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    privacyCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(14,165,233,0.28)',
      backgroundColor: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.06)',
      padding: 16,
      gap: 12,
    },
    privacyTop: { flexDirection: 'row', gap: 12 },
    privacyIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(14,165,233,0.14)',
    },
    privacyEyebrow: {
      color: colors.accentSoft,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    privacyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
    privacyBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: {
      borderColor: colors.accentSoft,
      backgroundColor: 'rgba(14,165,233,0.2)',
    },
    checkboxMark: { color: colors.accentSoft, fontWeight: '900', fontSize: 12 },
    switchLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
    switchHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
    hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hintText: { color: colors.accentSoft, fontSize: 12, flex: 1 },
    pathCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      padding: 16,
      ...carCardElevation(isDark, 'sm'),
    },
    pathCardActive: {
      borderColor: 'rgba(14,165,233,0.55)',
    },
    pathHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pathIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(14,165,233,0.12)',
    },
    badge: {
      borderRadius: 999,
      backgroundColor: 'rgba(14,165,233,0.14)',
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      color: colors.accentSoft,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    pathTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
    pathBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
    otomotoBox: { gap: 10 },
    otomotoInput: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
    },
    otomotoBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingVertical: 13,
      alignItems: 'center',
    },
    otomotoBtnLabel: {
      color: colors.primaryButtonText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    docModes: { gap: 10 },
    docModeCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    docModeCardActive: {
      borderColor: 'rgba(14,165,233,0.5)',
      backgroundColor: 'rgba(14,165,233,0.08)',
    },
    docModeTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    docModeBody: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
    continueBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingVertical: 13,
      alignItems: 'center',
    },
    continueLabel: {
      color: colors.primaryButtonText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    manualBtn: {
      marginTop: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    manualLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  });
}
