import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AgencyClientMatch, ManagedOfferOption } from '../../services/agencyClientService';

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  input: string;
  accent: string;
};

export default function ClientPresentationComposer({
  clientType,
  matches,
  managedOffers,
  presentationOfferId,
  presentationAt,
  guestMode,
  guestName,
  guestEmail,
  guestPhone,
  guestVisitor,
  busy,
  colors,
  onChangeOfferId,
  onPickDate,
  onChangeGuestMode,
  onChangeGuestName,
  onChangeGuestEmail,
  onChangeGuestPhone,
  onChangeGuestVisitor,
  onSubmit,
}: {
  clientType: 'BUYER' | 'SELLER';
  matches: AgencyClientMatch[];
  managedOffers: ManagedOfferOption[];
  presentationOfferId: string;
  presentationAt: string;
  guestMode: boolean;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestVisitor: string;
  busy?: boolean;
  colors: Colors;
  onChangeOfferId: (value: string) => void;
  onPickDate: () => void;
  onChangeGuestMode: (value: boolean) => void;
  onChangeGuestName: (value: string) => void;
  onChangeGuestEmail: (value: string) => void;
  onChangeGuestPhone: (value: string) => void;
  onChangeGuestVisitor: (value: string) => void;
  onSubmit: () => void;
}) {
  const selectedId = Number(presentationOfferId);
  const selectedOffer = useMemo(
    () =>
      managedOffers.find((offer) => offer.id === selectedId) ||
      matches.find((item) => item.offer.id === selectedId)?.offer ||
      null,
    [managedOffers, matches, selectedId],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const filteredOffers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return managedOffers;
    return managedOffers.filter((offer) =>
      `#${offer.id} ${offer.title} ${offer.city || ''}`.toLowerCase().includes(q),
    );
  }, [managedOffers, pickerQuery]);
  const canSubmit =
    Boolean(presentationAt) &&
    Boolean(presentationOfferId.trim()) &&
    (!guestMode || (guestName.trim() && guestEmail.includes('@')));

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>
        {guestMode
          ? 'Wybierz nieruchomość z Twojego portfela i wyślij termin właścicielowi oraz agentowi gościowi — obie strony dostaną e-mail do akceptacji.'
          : 'Wybierz nieruchomość z listy agenta albo wpisz ID oferty i zaproponuj datę — kupujący i sprzedający dostaną ten sam termin na e-mail.'}
      </Text>

      {clientType === 'SELLER' || guestMode ? (
        <Pressable
          onPress={() => onChangeGuestMode(!guestMode)}
          style={[
            styles.toggle,
            {
              borderColor: guestMode ? colors.accent : colors.border,
              backgroundColor: guestMode ? 'rgba(52,199,89,0.12)' : colors.input,
            },
          ]}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>
            {guestMode ? 'Inna agencja pokazuje naszą nieruchomość' : 'Inna agencja chce pokazać naszą nieruchomość'}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }}>
            {guestMode
              ? 'Mail idzie do sprzedającego i do agenta gościa. Nie tworzy drugiego klienta.'
              : 'Włącz, gdy obca agencja chce pokazać mieszkanie Twojego sprzedającego.'}
          </Text>
        </Pressable>
      ) : null}

      {guestMode ? (
        <View style={{ gap: 8, marginTop: 10 }}>
          <TextInput
            value={guestName}
            onChangeText={onChangeGuestName}
            placeholder="Nazwa agencji gościa"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={guestEmail}
            onChangeText={onChangeGuestEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="E-mail agenta gościa"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={guestVisitor}
            onChangeText={onChangeGuestVisitor}
            placeholder="Imię agenta (opcjonalnie)"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={guestPhone}
            onChangeText={onChangeGuestPhone}
            keyboardType="phone-pad"
            placeholder="Telefon agenta (opcjonalnie)"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          />
        </View>
      ) : null}

      {managedOffers.length ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
            NIERUCHOMOŚCI AGENTA
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 8, justifyContent: 'center' }]}
          >
            <Text style={{ color: selectedOffer ? colors.text : colors.secondary, fontWeight: '700' }} numberOfLines={2}>
              {selectedOffer
                ? `#${selectedOffer.id} · ${selectedOffer.title}`
                : 'Wybierz nieruchomość z listy agenta'}
            </Text>
          </Pressable>
          <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
            <View style={styles.modalBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
              <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Nieruchomości agenta</Text>
                <TextInput
                  value={pickerQuery}
                  onChangeText={setPickerQuery}
                  placeholder="Szukaj tytułu, miasta albo ID"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 12 }]}
                />
                <ScrollView style={{ maxHeight: 420, marginTop: 10 }}>
                  {filteredOffers.map((offer) => {
                    const selected = selectedId === offer.id;
                    return (
                      <Pressable
                        key={offer.id}
                        onPress={() => {
                          onChangeOfferId(String(offer.id));
                          setPickerOpen(false);
                          setPickerQuery('');
                        }}
                        style={{
                          paddingVertical: 12,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ color: selected ? colors.accent : colors.text, fontWeight: '800', fontSize: 13 }}>
                          #{offer.id} · {offer.title}
                        </Text>
                        <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                          {[offer.city, offer.linkedClientId ? `klient ${offer.linkedClientId}` : null]
                            .filter(Boolean)
                            .join(' · ') || 'W portfelu'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!filteredOffers.length ? (
                    <Text style={{ color: colors.secondary, paddingVertical: 16 }}>Brak oferty w tej liście.</Text>
                  ) : null}
                </ScrollView>
                <Pressable onPress={() => setPickerOpen(false)} style={{ marginTop: 12, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: colors.accent, fontWeight: '800', textAlign: 'center' }}>Zamknij</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      ) : null}

      {matches.length ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
            DOPASOWANIA KLIENTA
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {[...matches]
              .sort((a, b) => Number(Boolean(b.notifiedAt)) - Number(Boolean(a.notifiedAt)) || b.score - a.score)
              .slice(0, 8)
              .map((m) => {
                const selected = presentationOfferId === String(m.offer.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => onChangeOfferId(String(m.offer.id))}
                    style={{
                      maxWidth: '100%',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? 'rgba(52,199,89,0.14)' : colors.input,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }} numberOfLines={1}>
                      #{m.offer.id} · {m.offer.title}
                    </Text>
                    <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 2 }}>
                      {m.notifiedAt ? 'Wysłana' : 'Match'} · {m.score}%
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        </View>
      ) : null}

      <TextInput
        value={presentationOfferId}
        onChangeText={(value) => onChangeOfferId(value.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        placeholder="Albo wpisz ID oferty"
        placeholderTextColor={colors.secondary}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 10 }]}
      />
      <Pressable
        onPress={onPickDate}
        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 8, justifyContent: 'center' }]}
      >
        <Text style={{ color: presentationAt ? colors.text : colors.secondary, fontWeight: '700' }}>
          {presentationAt || 'Wybierz datę i godzinę prezentacji'}
        </Text>
      </Pressable>
      <Pressable
        disabled={!canSubmit || busy}
        onPress={onSubmit}
        style={[styles.primary, { marginTop: 8, opacity: canSubmit ? 1 : 0.5 }]}
      >
        <Text style={styles.primaryText}>
          {busy
            ? 'Wysyłam…'
            : guestMode
              ? 'Wyślij termin właścicielowi i agencji gościa'
              : 'Zaproponuj termin obu stronom'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggle: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#052e16',
    fontWeight: '900',
    fontSize: 13,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 28,
    maxHeight: '86%',
  },
});
