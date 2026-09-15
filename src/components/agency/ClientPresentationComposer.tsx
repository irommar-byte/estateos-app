import React, { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import type { AgencyClientMatch, AgencyShowingCard, ManagedOfferOption } from '../../services/agencyClientService';
import { formatCurrencyPLN } from '../../utils/crmFormatters';

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  input: string;
  accent: string;
};

function photosFor(offer: { imageUrl?: string | null; imageUrls?: string[] | null }) {
  const urls = (offer.imageUrls || []).map((item) => String(item || '').trim()).filter(Boolean);
  const primary = String(offer.imageUrl || '').trim();
  if (primary && !urls.includes(primary)) urls.unshift(primary);
  return urls;
}

function OfferTile({
  offer,
  selected,
  expanded,
  meta,
  colors,
  onSelect,
  onToggle,
}: {
  offer: { id: number; title: string; city?: string | null; street?: string | null; area?: number | null; price?: number | null; imageUrl?: string | null; imageUrls?: string[] | null };
  selected: boolean;
  expanded: boolean;
  meta: string;
  colors: Colors;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const photos = photosFor(offer);
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? 'rgba(52,199,89,0.12)' : colors.input,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <Pressable onPress={onSelect} style={{ flexDirection: 'row', gap: 10, padding: 8 }}>
        {photos[0] ? (
          <Image source={{ uri: photos[0] }} style={{ width: 72, height: 60, borderRadius: 10 }} contentFit="cover" />
        ) : (
          <View style={{ width: 72, height: 60, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.secondary, fontWeight: '700', fontSize: 11 }}>#{offer.id}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }} numberOfLines={2}>
            #{offer.id} · {offer.title}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
            {[meta, offer.city, offer.price != null ? formatCurrencyPLN(offer.price) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onToggle} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 10, paddingVertical: 7 }}>
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
          {expanded ? 'Zwiń podgląd' : 'Rozwiń zdjęcia i szczegóły'}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 8 }}>
          {photos.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {photos.slice(1, 5).map((url) => (
                <Image key={url} source={{ uri: url }} style={{ width: 88, height: 64, borderRadius: 8 }} contentFit="cover" />
              ))}
            </ScrollView>
          ) : null}
          <Text style={{ color: colors.secondary, fontSize: 11, lineHeight: 16 }}>
            {[offer.street, offer.city, offer.area ? `${offer.area} m²` : null, offer.price != null ? formatCurrencyPLN(offer.price) : null]
              .filter(Boolean)
              .join(' · ') || 'Oferta z portfela agenta.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ClientPresentationComposer({
  clientType,
  matches,
  managedOffers,
  presentationOfferId,
  presentationSlots,
  guestMode,
  guestName,
  guestEmail,
  guestPhone,
  guestVisitor,
  busy,
  colors,
  showing,
  quote,
  statusLabel,
  listingNotes,
  presentation,
  onChangeOfferId,
  onPickSlot,
  onChangeGuestMode,
  onChangeGuestName,
  onChangeGuestEmail,
  onChangeGuestPhone,
  onChangeGuestVisitor,
  onChangeListingNotes,
  onSubmit,
  onRequestListing,
  onMarkHeld,
  onCall,
}: {
  clientType: 'BUYER' | 'SELLER';
  matches: AgencyClientMatch[];
  managedOffers: ManagedOfferOption[];
  presentationOfferId: string;
  presentationSlots: string[];
  guestMode: boolean;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestVisitor: string;
  busy?: boolean;
  colors: Colors;
  showing?: AgencyShowingCard | null;
  quote?: string | null;
  statusLabel?: string | null;
  listingNotes?: string;
  presentation?: {
    startsAt: string;
    status: 'confirmed' | 'pending';
    heldAt?: string | null;
    offerId?: number | null;
  } | null;
  onChangeOfferId: (value: string) => void;
  onPickSlot: (index: number) => void;
  onChangeGuestMode: (value: boolean) => void;
  onChangeGuestName: (value: string) => void;
  onChangeGuestEmail: (value: string) => void;
  onChangeGuestPhone: (value: string) => void;
  onChangeGuestVisitor: (value: string) => void;
  onChangeListingNotes?: (value: string) => void;
  onSubmit: () => void;
  onRequestListing?: () => void;
  onMarkHeld?: () => void;
  onCall?: (phone: string) => void;
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [otherOpen, setOtherOpen] = useState(!showing);
  const filteredOffers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return managedOffers;
    return managedOffers.filter((offer) =>
      `#${offer.id} ${offer.title} ${offer.city || ''}`.toLowerCase().includes(q),
    );
  }, [managedOffers, pickerQuery]);
  const filledSlots = presentationSlots.filter(Boolean);
  const listingKind = showing?.kind === 'other_agent' || showing?.kind === 'external_import';
  const importKind = showing?.kind === 'own_import' || showing?.kind === 'external_import';
  const canSubmit =
    filledSlots.length > 0 &&
    Boolean(presentationOfferId.trim()) &&
    (!guestMode || (guestName.trim() && guestEmail.includes('@')));

  return (
    <View style={{ marginTop: 14 }}>
      {showing ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, padding: 10 }}>
            {showing.imageUrl ? (
              <Image source={{ uri: showing.imageUrl }} style={{ width: 86, height: 72, borderRadius: 12 }} contentFit="cover" />
            ) : (
              <View style={{ width: 86, height: 72, borderRadius: 12, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.secondary, fontWeight: '800' }}>#{showing.offerId}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '900' }}>
                {showing.kindLabel}
                {statusLabel ? ` · ${statusLabel}` : ''}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, marginTop: 3 }}>
                #{showing.offerId} · {showing.title}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }}>
                {[showing.street, showing.city].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
          {quote ? (
            <Text style={{ color: colors.text, fontSize: 13, fontStyle: 'italic', paddingHorizontal: 12, paddingBottom: 10 }}>
              „{quote}”
            </Text>
          ) : null}
          {importKind && showing.sourcePhone ? (
            <Text style={{ color: colors.text, fontSize: 12, paddingHorizontal: 12, paddingBottom: 8 }}>
              Telefon ze snapshotu: {showing.sourcePhone}
              {showing.sourceAgencyName ? ` · ${showing.sourceAgencyName}` : ''}
            </Text>
          ) : null}
          {showing.kind === 'other_agent' && showing.listingAgent ? (
            <Text style={{ color: colors.text, fontSize: 12, paddingHorizontal: 12, paddingBottom: 8 }}>
              Agent wystawiający: {[showing.listingAgent.name, showing.listingAgent.companyName].filter(Boolean).join(' · ') || 'konto EstateOS'}
              {showing.listingAgent.phone ? ` · ${showing.listingAgent.phone}` : ''}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
            {showing.canCallSource && showing.sourcePhone ? (
              <Pressable onPress={() => onCall?.(showing.sourcePhone!)} style={[styles.primary, { minHeight: 40, paddingHorizontal: 12 }]}>
                <Text style={styles.primaryText}>Zadzwoń</Text>
              </Pressable>
            ) : null}
            {showing.sourceUrl ? (
              <Pressable
                onPress={() => void Linking.openURL(showing.sourceUrl!)}
                style={[styles.input, { borderColor: colors.border, justifyContent: 'center' }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>Oryginał na portalu</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>
          {guestMode
            ? 'Wybierz nieruchomość z Twojego portfela i wyślij termin właścicielowi oraz agentowi gościowi — obie strony dostaną e-mail do akceptacji.'
            : 'Wybierz nieruchomość, której chce klient, i zaproponuj 2–3 terminy.'}
        </Text>
      )}

      {presentation && !presentation.heldAt && (!showing || presentation.offerId === showing.offerId) ? (
        <Pressable
          onPress={onMarkHeld}
          style={[styles.primary, { marginBottom: 10, opacity: onMarkHeld ? 1 : 0.5 }]}
        >
          <Text style={styles.primaryText}>
            {presentation.status === 'pending' ? 'Oznacz pokaz jako odbytą' : 'Oznacz prezentację jako odbytą'}
          </Text>
        </Pressable>
      ) : null}

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

      {showing ? (
        <Pressable onPress={() => setOtherOpen((open) => !open)} style={{ marginTop: 4, minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
            {otherOpen ? 'Ukryj inną nieruchomość' : 'Inna nieruchomość'}
          </Text>
        </Pressable>
      ) : null}

      {managedOffers.length && (otherOpen || !showing) ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
            NIERUCHOMOŚCI AGENTA
          </Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {managedOffers.slice(0, 8).map((offer) => (
              <OfferTile
                key={`managed-${offer.id}`}
                offer={offer}
                selected={selectedId === offer.id}
                expanded={expandedId === offer.id}
                meta={offer.city || 'W portfelu'}
                colors={colors}
                onSelect={() => onChangeOfferId(String(offer.id))}
                onToggle={() => setExpandedId((current) => (current === offer.id ? null : offer.id))}
              />
            ))}
            {managedOffers.length > 8 ? (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, justifyContent: 'center' }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '700' }}>
                  {selectedOffer ? `Wybrano #${selectedOffer.id} · pokaż całą listę` : 'Pokaż całą listę agenta'}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
                    const photos = photosFor(offer);
                    return (
                      <Pressable
                        key={offer.id}
                        onPress={() => {
                          onChangeOfferId(String(offer.id));
                          setPickerOpen(false);
                          setPickerQuery('');
                        }}
                        style={{ paddingVertical: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}
                      >
                        {photos[0] ? (
                          <Image source={{ uri: photos[0] }} style={{ width: 52, height: 44, borderRadius: 8 }} contentFit="cover" />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: selected ? colors.accent : colors.text, fontWeight: '800', fontSize: 13 }}>
                            #{offer.id} · {offer.title}
                          </Text>
                          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                            {[offer.city, offer.linkedClientId ? `klient ${offer.linkedClientId}` : null]
                              .filter(Boolean)
                              .join(' · ') || 'W portfelu'}
                          </Text>
                        </View>
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

      {matches.length && (otherOpen || !showing) ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
            DOPASOWANIA KLIENTA
          </Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {[...matches]
              .sort((a, b) => Number(Boolean(b.notifiedAt)) - Number(Boolean(a.notifiedAt)) || b.score - a.score)
              .slice(0, 8)
              .map((m) => (
                <OfferTile
                  key={m.id}
                  offer={m.offer}
                  selected={presentationOfferId === String(m.offer.id)}
                  expanded={expandedId === m.offer.id}
                  meta={`${m.notifiedAt ? 'Wysłana' : 'Match'} · ${m.score}%`}
                  colors={colors}
                  onSelect={() => onChangeOfferId(String(m.offer.id))}
                  onToggle={() => setExpandedId((current) => (current === m.offer.id ? null : m.offer.id))}
                />
              ))}
          </View>
        </View>
      ) : null}

      {(otherOpen || !showing) ? (
      <TextInput
        value={presentationOfferId}
        onChangeText={(value) => onChangeOfferId(value.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        placeholder="Albo wpisz ID oferty"
        placeholderTextColor={colors.secondary}
        style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 10 }]}
      />
      ) : null}
      <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800', marginTop: 12 }}>
        2–3 TERMINY
      </Text>
      {[0, 1, 2].map((index) => (
        <Pressable
          key={index}
          onPress={() => onPickSlot(index)}
          style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, marginTop: 8, justifyContent: 'center' }]}
        >
          <Text style={{ color: presentationSlots[index] ? colors.text : colors.secondary, fontWeight: '700' }}>
            {presentationSlots[index] || `Termin ${index + 1}${index === 0 ? '' : ' (opcjonalnie)'}`}
          </Text>
        </Pressable>
      ))}
      {listingKind ? (
        <TextInput
          value={listingNotes || ''}
          onChangeText={onChangeListingNotes}
          placeholder="Krótka wiadomość do agenta wystawiającego"
          placeholderTextColor={colors.secondary}
          multiline
          style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, marginTop: 8, minHeight: 72 }]}
        />
      ) : null}
      <Pressable
        disabled={!canSubmit || busy}
        onPress={listingKind && onRequestListing ? onRequestListing : onSubmit}
        style={[styles.primary, { marginTop: 8, opacity: canSubmit ? 1 : 0.5 }]}
      >
        <Text style={styles.primaryText}>
          {busy
            ? 'Wysyłam…'
            : guestMode
              ? 'Wyślij termin właścicielowi i agencji gościa'
              : listingKind
                ? 'Poproś o pokaz'
                : importKind
                  ? 'Zaproponuj terminy kupującemu'
                  : 'Zaproponuj terminy'}
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
