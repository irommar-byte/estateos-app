import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useAuthStore } from '../../store/useAuthStore';
import { maskVehicleHistoryReport } from '../../utils/carVehicleDocPrivacy';
import { useCarScreenTheme, type CarScreenColors } from '../../theme/carScreenTheme';

type CarVehicleChecksPanelProps = {
  carId?: number;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  restrictVehicleDocs?: boolean;
  title?: string;
};

export default function CarVehicleChecksPanel({
  carId,
  vin = '',
  registrationNumber = '',
  firstRegistrationDate = '',
  insuranceValidUntil = '',
  restrictVehicleDocs = false,
  title = 'Weryfikacja pojazdu',
}: CarVehicleChecksPanelProps) {
  const { colors, elevation } = useCarScreenTheme();
  const token = useAuthStore((s) => s.token);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [historyReport, setHistoryReport] = useState<VehicleHistoryReport | null>(null);
  const [insuranceMessage, setInsuranceMessage] = useState<string | null>(null);
  const [insuranceOk, setInsuranceOk] = useState<boolean | null>(null);

  const hasHistoryData = Boolean(
    vin.trim().length >= 2 && registrationNumber.trim() && firstRegistrationDate.trim(),
  );
  const hasInsuranceData = Boolean(registrationNumber.trim());

  const historyPayload = carId
    ? { carId }
    : { vin, registrationNumber, firstRegistrationDate };

  const insurancePayload = carId
    ? { carId, insuranceValidUntil }
    : { registrationNumber, insuranceValidUntil, vin, firstRegistrationDate };

  const handleHistory = async () => {
    if (!token) {
      Alert.alert('Historia pojazdu', 'Zaloguj się, aby sprawdzić historię w CEPIK.');
      return;
    }
    if (!hasHistoryData) {
      Alert.alert('Historia pojazdu', 'Sprzedająca osoba nie podała pełnych danych (VIN, tablica, data pierwszej rejestracji).');
      return;
    }
    setHistoryLoading(true);
    try {
      const report = await fetchVehicleHistoryReport(historyPayload, token);
      setHistoryReport(
        restrictVehicleDocs
          ? maskVehicleHistoryReport(report, { vin, registrationNumber, firstRegistrationDate })
          : report,
      );
    } catch (error) {
      Alert.alert('Historia pojazdu', error instanceof Error ? error.message : 'Błąd sprawdzania.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInsurance = async () => {
    if (!token) {
      Alert.alert('Ubezpieczenie', 'Zaloguj się, aby sprawdzić ważność OC.');
      return;
    }
    if (!hasInsuranceData) {
      Alert.alert('Ubezpieczenie', 'Brak numeru rejestracyjnego do weryfikacji OC.');
      return;
    }
    setInsuranceLoading(true);
    try {
      const result = await checkCarInsurance(insurancePayload, token);
      setInsuranceOk(result.hasInsurance);
      setInsuranceMessage(result.message);
    } catch (error) {
      Alert.alert('Ubezpieczenie', error instanceof Error ? error.message : 'Błąd sprawdzania.');
    } finally {
      setInsuranceLoading(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.root, elevation.cardSm]}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.lead}>
        Sprawdź historię w CEPIK i ważność OC (UFG) — dane z ogłoszenia.
        {restrictVehicleDocs ? ' Sprzedający zastrzegł pełne dane VIN, rejestracji i pierwszej rejestracji.' : ''}
      </Text>

      {vin.trim() ? <InfoRow label="VIN" value={vin} /> : null}
      {registrationNumber.trim() ? <InfoRow label="Rejestracja" value={registrationNumber} /> : null}
      {firstRegistrationDate.trim() ? <InfoRow label="Pierwsza rejestracja" value={firstRegistrationDate} /> : null}
      {insuranceValidUntil.trim() ? <InfoRow label="Ważność OC (deklaracja)" value={insuranceValidUntil} /> : null}

      {!hasHistoryData ? (
        <Text style={styles.hint}>Pełna historia CEPIK wymaga VIN, tablicy i daty pierwszej rejestracji od sprzedającego.</Text>
      ) : null}

      {!hasInsuranceData ? (
        <Text style={styles.hint}>Sprawdzenie OC wymaga numeru rejestracyjnego od sprzedającego.</Text>
      ) : null}

      {!token ? (
        <Text style={styles.hint}>Zaloguj się, aby uruchomić weryfikację CEPIK / UFG.</Text>
      ) : null}

      <Pressable onPress={() => void handleHistory()} disabled={historyLoading || !hasHistoryData || !token} style={[styles.actionBtn, (!hasHistoryData || !token) && styles.actionDisabled]}>
        {historyLoading ? (
          <ActivityIndicator color={colors.buttonText} />
        ) : (
          <>
            <FileSearch color={colors.buttonText} size={18} />
            <Text style={styles.actionLabel}>Sprawdź historię pojazdu</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => void handleInsurance()}
        disabled={insuranceLoading || !hasInsuranceData || !token}
        style={[styles.actionBtnSecondary, (!hasInsuranceData || !token) && styles.actionDisabled]}
      >
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

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: {
      gap: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      padding: 14,
      marginTop: 12,
    },
    heading: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    lead: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    hint: { color: colors.placeholder, fontSize: 12, lineHeight: 17 },
    infoRow: { gap: 2 },
    infoLabel: { color: colors.placeholder, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    infoValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
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
    actionDisabled: { opacity: 0.45 },
    actionLabel: { color: colors.buttonText, fontSize: 13, fontWeight: '800' },
    actionLabelSecondary: { color: colors.successButtonText, fontSize: 13, fontWeight: '800' },
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
