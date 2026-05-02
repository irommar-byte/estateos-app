import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, ChevronLeft } from 'lucide-react-native';
import PresentationCountdown from './PresentationCountdown';

type AppointmentMode = 'create' | 'respond';

interface AppointmentActionModalProps {
  visible: boolean;
  mode: AppointmentMode;
  dealId: number | null;
  token: string | null;
  title?: string;
  appointmentId?: number | null;
  eventAction?: string | null;
  proposedDate?: string | null;
  history?: Array<{
    action?: string;
    proposedDate?: string | null;
    note?: string | null;
  }>;
  onClose: () => void;
  onDone?: () => void;
}

const API_URL = 'https://estateos.pl';

function normalizeToken(rawToken: string | null) {
  if (!rawToken) return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

function buildNextDays() {
  return Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

function buildHours() {
  const arr: string[] = [];
  for (let h = 8; h <= 20; h += 1) {
    arr.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 20) arr.push(`${String(h).padStart(2, '0')}:30`);
  }
  return arr;
}

export default function AppointmentActionModal({
  visible,
  mode,
  dealId,
  token,
  title,
  appointmentId,
  eventAction,
  proposedDate,
  history = [],
  onClose,
  onDone,
}: AppointmentActionModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const dates = useMemo(() => buildNextDays(), []);
  const hours = useMemo(() => buildHours(), []);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSelectedDate(null);
    setSelectedHour(null);
    setNote('');
    setError(null);
  }, [visible]);

  const isLocked = useMemo(
    () => mode === 'respond' && String(eventAction || '').toUpperCase() === 'ACCEPTED',
    [mode, eventAction]
  );

  /** Akceptacja terminu jest w czacie (panel); modal służy wyłącznie do wysłania własnej propozycji / create. */
  const isSchedulerVisible = useMemo(
    () => !isLocked && (mode === 'create' || mode === 'respond'),
    [mode, isLocked]
  );

  const canSubmit = useMemo(() => {
    const safeToken = normalizeToken(token);
    if (isLocked) return false;
    if (!dealId || !safeToken) return false;
    if (mode === 'respond') {
      if (!appointmentId) return false;
    }
    return Boolean(selectedDate && selectedHour);
  }, [isLocked, dealId, token, mode, appointmentId, selectedDate, selectedHour]);

  const submit = async () => {
    const safeToken = normalizeToken(token);
    if (!dealId || !safeToken || isLocked) return;
    const canRun =
      mode === 'respond'
        ? Boolean(appointmentId) && Boolean(selectedDate && selectedHour)
        : Boolean(selectedDate && selectedHour);
    if (!canRun) return;
    setLoading(true);
    setError(null);

    try {
      let proposedIso = '';
      if (selectedDate && selectedHour) {
        const [hh, mm] = selectedHour.split(':');
        const dt = new Date(selectedDate);
        dt.setHours(Number(hh), Number(mm), 0, 0);
        proposedIso = dt.toISOString();
      }

      const payload: any = {};
      if (mode === 'create') {
        payload.type = 'APPOINTMENT_PROPOSE';
        payload.proposedDate = proposedIso;
        payload.message = note;
      } else {
        payload.type = 'APPOINTMENT_RESPOND';
        payload.appointmentId = appointmentId;
        payload.decision = 'COUNTER';
        payload.message = note;
        payload.counterDate = proposedIso;
      }

      const res = await fetch(`${API_URL}/api/mobile/v1/deals/${dealId}/actions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${safeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Nie udalo sie zapisac terminu.');
        return;
      }
      onDone?.();
      onClose();
    } catch {
      setError('Blad polaczenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedDateLabel = () => {
    if (!selectedDate || !selectedHour) return '';
    return `${selectedDate.toLocaleDateString('pl-PL')} o ${selectedHour}`;
  };

  const getConfirmMessage = () => {
    if (mode === 'create') {
      return `Czy na pewno chcesz zaproponować termin ${getSelectedDateLabel()}?`;
    }
    return `Czy na pewno chcesz wysłać swój termin ${getSelectedDateLabel()}?`;
  };

  const handleSubmitPress = () => {
    if (!canSubmit || loading || isLocked) return;
    setConfirmVisible(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
          style={styles.keyboardWrap}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              {step > 1 ? (
                <TouchableOpacity style={styles.backBtnTop} onPress={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}>
                  <ChevronLeft size={13} color="#ddd" />
                  <Text style={styles.backBtnText}>Wróć</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.headerPlaceholder} />
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
                <X size={16} color="#d1d5db" />
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>DEALROOM</Text>
            <Text style={styles.title}>{title || 'Negocjacja terminu'}</Text>
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
            >

          {isLocked && (
            <View style={styles.lockedBox}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockTitle}>Termin zaakceptowany</Text>
              <Text style={styles.lockDate}>
                {proposedDate ? new Date(proposedDate).toLocaleString('pl-PL') : '-'}
              </Text>
              {proposedDate && new Date(proposedDate).getTime() > Date.now() && (
                <PresentationCountdown presentationIso={proposedDate} variant="modal" />
              )}
              <View style={styles.stamp}>
                <Text style={styles.stampText}>ZAAKCEPTOWANO</Text>
              </View>
            </View>
          )}

          {history.length > 0 && (
            <View style={styles.timelineWrap}>
              <Text style={styles.timelineTitle}>Historia negocjacji</Text>
              {history.map((item, idx) => {
                const label =
                  item.action === 'ACCEPTED'
                    ? 'Zaakceptowano'
                    : item.action === 'COUNTERED'
                      ? 'Kontroferta'
                      : item.action === 'DECLINED'
                        ? 'Odrzucono'
                        : 'Propozycja';
                return (
                  <View key={`${item.action || 'x'}-${idx}`} style={styles.timelineItem}>
                    <Text style={styles.timelineLabel}>{label}</Text>
                    <Text style={styles.timelineDate}>
                      {item.proposedDate ? new Date(item.proposedDate).toLocaleString('pl-PL') : '-'}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

            {isSchedulerVisible && (
              <View style={styles.sectionCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepHeaderLeft}>
                  <Text style={styles.stepTitle}>
                    {step === 1 ? 'Wybierz dzien' : step === 2 ? 'Wybierz godzine' : 'Potwierdz termin'}
                  </Text>
                  <Text style={styles.stepSub}>Krok {step} z 3</Text>
                </View>
              </View>

              {step === 1 && (
                <>
                  <Text style={styles.sectionLabel}>Dzien</Text>
                  <View style={styles.calendarGrid}>
                    {dates.map((d) => {
                      const selected = selectedDate?.toDateString() === d.toDateString();
                      return (
                        <TouchableOpacity
                          key={d.toISOString()}
                          onPress={() => {
                            setSelectedDate(d);
                            setStep(2);
                          }}
                          style={[styles.calendarDayCard, selected && styles.calendarDayCardActive]}
                        >
                          <Text style={[styles.calendarDayWeek, selected && styles.calendarDayWeekActive]}>
                            {d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}
                          </Text>
                          <Text style={[styles.calendarDayNum, selected && styles.calendarDayNumActive]}>
                            {d.getDate()}
                          </Text>
                          <Text style={[styles.calendarDayMonth, selected && styles.calendarDayMonthActive]}>
                            {d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={styles.sectionLabel}>Godzina</Text>
                  <View style={styles.hoursGrid}>
                    {hours.map((h) => {
                      const selected = selectedHour === h;
                      return (
                        <TouchableOpacity
                          key={h}
                          onPress={() => {
                            setSelectedHour(h);
                            setStep(3);
                          }}
                          style={[styles.hourTile, selected && styles.hourTileActive]}
                        >
                          <Text style={[styles.hourTileText, selected && styles.hourTileTextActive]}>{h}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {step === 3 && (
                <View style={styles.selectedTermCard}>
                  <Text style={styles.selectedTermLabel}>Wybrany termin</Text>
                  <Text style={styles.selectedTermValue}>
                    {selectedDate?.toLocaleDateString('pl-PL')} o {selectedHour}
                  </Text>
                </View>
              )}
              </View>
            )}

            {(step === 3 || !isSchedulerVisible) && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Wiadomosc</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Dodaj komentarz (opcjonalnie)"
                  placeholderTextColor="#777"
                  style={[styles.input, styles.note]}
                  multiline
                />
              </View>
            )}

            </ScrollView>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={loading}>
                <Text style={styles.secondaryTxt}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, !canSubmit && styles.disabled]}
                onPress={handleSubmitPress}
                disabled={!canSubmit || loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryTxt}>{mode === 'respond' ? 'Wyslij swoj termin' : 'Wyslij'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Potwierdzenie</Text>
              <Text style={styles.confirmText}>{getConfirmMessage()}</Text>
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.confirmSecondary} onPress={() => setConfirmVisible(false)}>
                  <Text style={styles.confirmSecondaryTxt}>Nie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmPrimary}
                  onPress={async () => {
                    setConfirmVisible(false);
                    await submit();
                  }}
                >
                  <Text style={styles.confirmPrimaryTxt}>Tak, wyślij</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', padding: 10 },
  keyboardWrap: { width: '100%', justifyContent: 'center' },
  card: { backgroundColor: '#0b0b0b', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, maxHeight: '96%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  headerPlaceholder: { width: 30, height: 30 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#141418' },
  eyebrow: { color: '#8a8a8f', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginTop: 4, marginBottom: 6 },
  content: { marginTop: 2 },
  contentInner: { paddingBottom: 8, flexGrow: 0 },
  sectionLabel: { color: '#9da0a6', fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCard: {
    backgroundColor: '#111113',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    marginBottom: 10,
  },
  stepHeader: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  stepHeaderLeft: {
    marginBottom: 8,
  },
  stepTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  stepSub: { color: '#8d8d8d', fontSize: 11, fontWeight: '700', marginTop: 3, textTransform: 'uppercase' },
  backBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#151515',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  backBtnText: { color: '#ddd', fontSize: 11, fontWeight: '800' },
  dayPill: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, backgroundColor: '#151515' },
  dayPillActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' },
  dayText: { color: '#bbb', fontWeight: '700' },
  dayTextActive: { color: '#10b981' },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  calendarDayCard: {
    width: '18.5%',
    minWidth: 52,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  calendarDayCardActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.17)',
    shadowColor: '#10b981',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  calendarDayWeek: { color: '#888', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  calendarDayWeekActive: { color: '#89e9bd' },
  calendarDayNum: { color: '#f4f4f4', fontSize: 18, fontWeight: '900', marginTop: 1 },
  calendarDayNumActive: { color: '#10b981' },
  calendarDayMonth: { color: '#8f8f8f', fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  calendarDayMonthActive: { color: '#89e9bd' },
  hoursWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  hourTile: {
    width: '23%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  hourTileActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  hourTileText: { color: '#c9c9c9', fontWeight: '800', fontSize: 12 },
  hourTileTextActive: { color: '#10b981' },
  hourPill: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#151515' },
  hourPillActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' },
  hourText: { color: '#bbb', fontWeight: '700', fontSize: 12 },
  hourTextActive: { color: '#10b981' },
  selectedTermCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.08)',
    padding: 12,
  },
  selectedTermLabel: { color: '#9edec0', fontSize: 10, textTransform: 'uppercase', fontWeight: '800' },
  selectedTermValue: { color: '#ddffe8', fontSize: 16, fontWeight: '800', marginTop: 4 },
  input: { backgroundColor: '#161618', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 0 },
  note: { minHeight: 70, textAlignVertical: 'top' },
  lockedBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.08)',
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  lockIcon: { fontSize: 24, marginBottom: 6 },
  lockTitle: { color: '#e5ffe5', fontWeight: '800', fontSize: 15 },
  lockDate: { color: '#a8f5cb', fontWeight: '700', marginTop: 4 },
  stamp: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  stampText: { color: '#10b981', fontWeight: '900', letterSpacing: 0.6, fontSize: 10 },
  timelineWrap: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#111',
  },
  timelineTitle: { color: '#c7c7c7', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  timelineItem: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    backgroundColor: '#151515',
  },
  timelineLabel: { color: '#f3f4f6', fontWeight: '700', fontSize: 12 },
  timelineDate: { color: '#9ca3af', fontWeight: '600', fontSize: 12, marginTop: 2 },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  primaryBtn: { flex: 1, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  primaryTxt: { color: '#04120d', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 },
  secondaryBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, backgroundColor: '#131316' },
  secondaryTxt: { color: '#e1e1e4', fontWeight: '700', fontSize: 12 },
  error: { color: '#ff6b6b', marginBottom: 8, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  confirmCard: { width: '100%', maxWidth: 380, borderRadius: 18, backgroundColor: '#101113', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14 },
  confirmTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  confirmText: { color: '#d1d5db', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmSecondary: { flex: 1, borderRadius: 10, backgroundColor: '#1b1d20', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingVertical: 10, alignItems: 'center' },
  confirmPrimary: { flex: 1, borderRadius: 10, backgroundColor: '#10b981', paddingVertical: 10, alignItems: 'center' },
  confirmSecondaryTxt: { color: '#d1d5db', fontSize: 12, fontWeight: '800' },
  confirmPrimaryTxt: { color: '#032014', fontSize: 12, fontWeight: '900' },
});
