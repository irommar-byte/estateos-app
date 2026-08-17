import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AcquisitionDatePickerModal({
  visible,
  initialValue,
  onClose,
  onSelect,
  isDark,
}: {
  visible: boolean;
  initialValue?: string;
  onClose: () => void;
  onSelect: (formattedDate: string) => void;
  isDark?: boolean;
}) {
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = dzisiaj, 1 = jutro, 2 = pojutrze, 3 = za 3 dni, 7 = za tydzień
  const [selectedTime, setSelectedTime] = useState('12:00');

  const colors = {
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    accent: '#34C759',
  };

  const dayOptions = [
    { label: 'Dzisiaj', offset: 0 },
    { label: 'Jutro', offset: 1 },
    { label: 'Pojutrze', offset: 2 },
    { label: 'Za 3 dni', offset: 3 },
    { label: 'Za 5 dni', offset: 5 },
    { label: 'Za tydzień', offset: 7 },
  ];

  const timeOptions = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00',
  ];

  const formatSelectedDate = () => {
    const target = new Date();
    target.setDate(target.getDate() + selectedDayOffset);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${selectedTime}`;
  };

  const handleConfirm = () => {
    onSelect(formatSelectedDate());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.overlay}>
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Wybierz termin spotkania</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={24} color={colors.secondary} />
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>DZIEŃ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {dayOptions.map((item) => {
              const active = selectedDayOffset === item.offset;
              const date = new Date();
              date.setDate(date.getDate() + item.offset);
              const dateStr = `${date.getDate()}.${date.getMonth() + 1}`;

              return (
                <Pressable
                  key={item.offset}
                  onPress={() => setSelectedDayOffset(item.offset)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.accent : colors.input,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? '#000' : colors.text, fontWeight: active ? '800' : '600' }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.chipSub, { color: active ? '#000' : colors.secondary }]}>{dateStr}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>GODZINA</Text>
          <View style={styles.timeGrid}>
            {timeOptions.map((time) => {
              const active = selectedTime === time;
              return (
                <Pressable
                  key={time}
                  onPress={() => setSelectedTime(time)}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: active ? colors.accent : colors.input,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#000' : colors.text, fontWeight: active ? '800' : '600', fontSize: 13 }}>
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '700' }}>
              Wybrano: <Text style={{ color: colors.accent }}>{formatSelectedDate()}</Text>
            </Text>
            <Pressable onPress={handleConfirm} style={[styles.btn, { backgroundColor: colors.accent }]}>
              <Text style={styles.btnText}>Zatwierdź termin</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
  },
  chipSub: {
    fontSize: 10,
    marginTop: 2,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
  },
});
