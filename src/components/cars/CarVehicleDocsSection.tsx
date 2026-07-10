import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { FileSearch, ShieldCheck, X } from 'lucide-react-native';
import {
  checkCarInsurance,
  fetchVehicleHistoryReport,
  type VehicleHistoryReport,
} from '../../services/carVehicleChecks';
import { formatPolishDateInput, isCompletePolishDate } from '../../utils/polishDateInput';
import { useCarScreenTheme, type CarScreenColors } from '../../theme/carScreenTheme';

export type CarVehicleDocsState = {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  insuranceValidUntil: string;
};

type CarVehicleDocsSectionProps = {
  value: CarVehicleDocsState;
  onChange: (patch: Partial<CarVehicleDocsState>) => void;
};

function isValidVinQuick(vin: string) {
  const normalized = vin.trim().toUpperCase();
  return normalized.length === 17 && !/[IOQ]/.test(normalized);
}

export default function CarVehicleDocsSection({ value, onChange }: CarVehicleDocsSectionProps) {
  const { colors, elevation } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const [historyReport, setHistoryReport] = useState<VehicleHistoryReport | null>(null);
  const [insuranceMessage, setInsuranceMessage] = useState<string | null>(null);
  const [insuranceOk, setInsuranceOk] = useState<boolean | null>(null);
  const autoCheckSeq = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const canAutoVerify = Boolean(
    isValidVinQuick(value.vin) &&
      value.registrationNumber.trim() &&
      isCompletePolishDate(value.firstRegistrationDate),
  );

  useEffect(() => {
    if (!canAutoVerify) return;
    const seq = ++autoCheckSeq.current;
    const timer = setTimeout(() => {
      setAutoChecking(true);
      checkCarInsurance({
        registrationNumber: value.registrationNumber,
        vin: value.vin,
        firstRegistrationDate: value.firstRegistrationDate,
        insuranceValidUntil: value.insuranceValidUntil,
      })
        .then((result) => {
          if (seq !== autoCheckSeq.current) return;
          setInsuranceOk(result.hasInsurance);
          setInsuranceMessage(result.message);
          if (result.validUntil && result.validUntil !== value.insuranceValidUntil) {
            onChangeRef.current({ insuranceValidUntil: result.validUntil });
          }
        })
        .catch(() => {
          if (seq !== autoCheckSeq.current) return;
        })
        .finally(() => {
          if (seq === autoCheckSeq.current) setAutoChecking(false);
        });
    }, 900);
    return () => clearTimeout(timer);
  }, [canAutoVerify, value.vin, value.registrationNumber, value.firstRegistrationDate, value.insuranceValidUntil]);

  const handleHistory = async () => {
    setHistoryLoading(true);
    try {
      const report = await fetchVehicleHistoryReport({
        vin: value.vin,
        registrationNumber: value.registrationNumber,
        firstRegistrationDate: value.firstRegistrationDate,
      });
      setHistoryReport(report);
    } catch (error) {
      Alert.alert('Historia pojazdu', error instanceof Error ? error.message : 'Błąd sprawdzania.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInsurance = async () => {
    setInsuranceLoading(true);
    try {
      const result = await checkCarInsurance({
        registrationNumber: value.registrationNumber,
        insuranceValidUntil: value.insuranceValidUntil,
        vin: value.vin,
        firstRegistrationDate: value.firstRegistrationDate,
      });
      setInsuranceOk(result.hasInsurance);
      setInsuranceMessage(result.message);
      if (result.validUntil) {
        onChange({ insuranceValidUntil: result.validUntil });
      }
    } catch (error) {
      Alert.alert('Ubezpieczenie', error instanceof Error ? error.message : 'Błąd sprawdzania.');
    } finally {
      setInsuranceLoading(false);
    }
  };

  return (
    <View style={[styles.root, elevation.cardSm]}>
      <Text style={styles.heading}>Dokumenty pojazdu</Text>
      <Text style={styles.lead}>Weryfikacja CEPIK Historia Pojazdu i OC (UFG) przez serwer EstateOS.</Text>

      <Field label="Numer VIN" value={value.vin} onChangeText={(vin) => onChange({ vin: vin.toUpperCase() })} autoCapitalize="characters" placeholder="17 znaków" styles={styles} colors={colors} />
      <Field
        label="Numer rejestracyjny"
        value={value.registrationNumber}
        onChangeText={(registrationNumber) => onChange({ registrationNumber: registrationNumber.toUpperCase() })}
        autoCapitalize="characters"
        placeholder="np. WW 12345"
        styles={styles}
        colors={colors}
      />
      <Field
        label="Data pierwszej rejestracji"
        value={value.firstRegistrationDate}
        onChangeText={(raw) => onChange({ firstRegistrationDate: formatPolishDateInput(raw) })}
        placeholder="DD.MM.RRRR"
        keyboardType="number-pad"
        styles={styles}
        colors={colors}
      />

      <Pressable onPress={() => void handleHistory()} disabled={historyLoading || !canAutoVerify} style={styles.actionBtn}>
        {historyLoading ? (
          <ActivityIndicator color={colors.buttonText} />
        ) : (
          <>
            <FileSearch color={colors.buttonText} size={18} />
            <Text style={styles.actionLabel}>Sprawdź historię pojazdu</Text>
          </>
        )}
      </Pressable>

      <Field
        label="Ważność polisy OC"
        value={value.insuranceValidUntil}
        onChangeText={(raw) => onChange({ insuranceValidUntil: formatPolishDateInput(raw) })}
        placeholder="DD.MM.RRRR"
        keyboardType="number-pad"
        styles={styles}
        colors={colors}
      />

      {autoChecking ? (
        <View style={styles.autoRow}>
          <ActivityIndicator color={colors.success} size="small" />
          <Text style={styles.autoText}>Sprawdzam OC w CEPIK/UFG...</Text>
        </View>
      ) : null}

      <Pressable onPress={() => void handleInsurance()} disabled={insuranceLoading || !canAutoVerify} style={styles.actionBtnSecondary}>
        {insuranceLoading ? (
          <ActivityIndicator color={colors.successButtonText} />
        ) : (
          <>
            <ShieldCheck color={colors.successButtonText} size={18} />
            <Text style={styles.actionLabelSecondary}>Sprawdź ubezpieczenie</Text>
          </>
        )}
      </Pressable>

      {insuranceMessage ? (
        <View style={[styles.resultBox, insuranceOk ? styles.resultOk : styles.resultBad]}>
          <Text style={styles.resultText}>{insuranceMessage}</Text>
        </View>
      ) : null}

      <Modal visible={Boolean(historyReport)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryReport(null)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Historia pojazdu</Text>
            <Pressable onPress={() => setHistoryReport(null)} hitSlop={12}>
              <X color={colors.muted} size={24} />
            </Pressable>
          </View>
          {historyReport ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.reportSummary}>{historyReport.summary}</Text>
              {historyReport.sections.map((section) => (
                <View key={section.title} style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>{section.title}</Text>
                  {section.rows.map((row) => (
                    <View key={row.label} style={styles.reportRow}>
                      <Text style={styles.reportLabel}>{row.label}</Text>
                      <Text style={styles.reportValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words';
  keyboardType?: 'default' | 'number-pad';
  styles: ReturnType<typeof createStyles>;
  colors: CarScreenColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={false}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: {
      gap: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      padding: 14,
    },
    heading: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    lead: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 4 },
    field: { gap: 6 },
    fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.buttonBorder,
      backgroundColor: colors.buttonBg,
      paddingVertical: 12,
      marginTop: 4,
    },
    actionLabel: { color: colors.buttonText, fontSize: 13, fontWeight: '800' },
    actionBtnSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.successButtonBorder,
      backgroundColor: colors.successButtonBg,
      paddingVertical: 12,
    },
    actionLabelSecondary: { color: colors.successButtonText, fontSize: 13, fontWeight: '800' },
    autoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    autoText: { color: colors.muted, fontSize: 12 },
    resultBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
    resultOk: { borderColor: colors.successSurfaceBorder, backgroundColor: colors.successSurfaceBg },
    resultBad: { borderColor: colors.dangerButtonBorder, backgroundColor: colors.dangerButtonBg },
    resultText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    modalRoot: { flex: 1, backgroundColor: colors.bg },
    modalHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
    modalContent: { padding: 20, paddingBottom: 40, gap: 14 },
    reportSummary: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    reportSection: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 8,
    },
    reportSectionTitle: { color: colors.accent, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    reportRow: { gap: 2 },
    reportLabel: { color: colors.placeholder, fontSize: 11, fontWeight: '600' },
    reportValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  });
}
