import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SignatureCanvas } from './SignaturePad';

export type AttendanceSignFacts = {
  agencyName: string;
  agentName: string;
  agentPhone: string | null;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress?: string | null;
  peselLabel: string | null;
  offerId: number | null;
  offerTitle: string;
  offerAddress: string;
  offerPriceLabel: string | null;
  viewingAtLabel: string | null;
  viewingDatePart: string | null;
  viewingTimePart: string | null;
};

type Props = {
  visible: boolean;
  busy: boolean;
  facts: AttendanceSignFacts;
  attested: boolean;
  signature: string;
  onAttestedChange: (value: boolean) => void;
  onSignatureChange: (dataUrl: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.kicker}>{label}</Text>
      {children}
    </View>
  );
}

export default function PresentationAttendanceSignSheet({
  visible,
  busy,
  facts,
  attested,
  signature,
  onAttestedChange,
  onSignatureChange,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const paperW = Math.min(720, width - 28);
  const canvasH = height < 720 ? 156 : Math.min(230, Math.round(height * 0.24));
  const ready = attested && signature.startsWith('data:image');
  const [drawing, setDrawing] = useState(true);
  const signatureAtOpen = useRef(signature);
  signatureAtOpen.current = signature;

  useEffect(() => {
    if (!visible) return;
    setDrawing(!signatureAtOpen.current.startsWith('data:image'));
  }, [visible]);
  const whenLine =
    facts.viewingDatePart && facts.viewingTimePart
      ? `${facts.viewingDatePart} o godz. ${facts.viewingTimePart}`
      : facts.viewingAtLabel;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} disabled={busy} style={styles.headerSide}>
            <Text style={styles.cancel}>Anuluj</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Potwierdzenie oglądania</Text>
          <View style={styles.headerSide} />
        </View>
        <Text style={styles.handoff}>Przekaż tablet klientowi — najpierw treść, potem zgoda, na końcu podpis.</Text>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: 16, paddingHorizontal: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.paper, { width: paperW }]}>
            <View style={styles.brand}>
              <Text style={styles.brandMark}>ESTATEOS</Text>
              {facts.agencyName ? <Text style={styles.brandSub}>{facts.agencyName}</Text> : null}
            </View>
            <View style={styles.inner}>
              <Text style={styles.docTitle}>POTWIERDZENIE OGLĄDANIA NIERUCHOMOŚCI</Text>
              <View style={styles.rule} />

              <Fact label="Nieruchomość">
                <Text style={styles.strong}>{facts.offerTitle || 'Nieruchomość'}</Text>
                {facts.offerAddress ? <Text style={styles.body}>{facts.offerAddress}</Text> : null}
                {facts.offerId ? <Text style={styles.body}>ID oferty #{facts.offerId}</Text> : null}
                {facts.offerPriceLabel ? <Text style={styles.body}>Cena: {facts.offerPriceLabel}</Text> : null}
                <Text style={styles.body}>
                  Data oglądania: <Text style={styles.strong}>{facts.viewingAtLabel || '—'}</Text>
                </Text>
              </Fact>
              <View style={styles.rule} />

              <Fact label="Klient">
                <Text style={styles.strong}>{facts.clientName || 'Klient'}</Text>
                {facts.clientPhone ? <Text style={styles.body}>Tel. {facts.clientPhone}</Text> : null}
                {facts.clientEmail ? <Text style={styles.body}>E-mail: {facts.clientEmail}</Text> : null}
                {facts.clientAddress ? <Text style={styles.body}>Adres: {facts.clientAddress}</Text> : null}
                {facts.peselLabel ? <Text style={styles.body}>PESEL: {facts.peselLabel}</Text> : (
                  <Text style={styles.muted}>Bez PESEL — można uzupełnić później</Text>
                )}
              </Fact>
              <View style={styles.rule} />

              <Fact label="Agent">
                <Text style={styles.body}>
                  {facts.agentName}
                  {facts.agencyName ? ` · ${facts.agencyName}` : ''}
                  {facts.agentPhone ? ` · tel. ${facts.agentPhone}` : ''}
                </Text>
              </Fact>
              <View style={styles.rule} />

              <Fact label="Oświadczenie">
                <Text style={styles.oath}>
                  Ja, niżej podpisany/a, potwierdzam, że {whenLine ? `w dniu ${whenLine} ` : ''}
                  obejrzałem/am wskazaną nieruchomość w obecności agenta {facts.agentName}. Niniejszy dokument
                  służy wyłącznie jako potwierdzenie obecności na oglądaniu i nie stanowi umowy pośrednictwa,
                  umowy przedwstępnej ani oferty kupna.
                </Text>
              </Fact>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 12, width: paperW, alignSelf: 'center' }]}>
          <Pressable
            disabled={busy}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onAttestedChange(!attested);
            }}
            style={[styles.checkRow, attested && styles.checkRowOn]}
          >
            <View style={[styles.box, attested && styles.boxOn]}>
              {attested ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkTitle}>
                Zgadzam się i potwierdzam, że oglądałem/am tę nieruchomość
                {facts.offerId ? ` (oferta #${facts.offerId})` : ''}.
              </Text>
              <Text style={styles.checkSub}>
                Zaznaczenie razem z podpisem poniżej trafia na kopię dokumentu
                {facts.clientEmail ? ` wysłaną na ${facts.clientEmail}` : ''}.
              </Text>
            </View>
          </Pressable>

          <View style={{ marginTop: 12, opacity: attested ? 1 : 0.38 }} pointerEvents={attested && !busy ? 'auto' : 'none'}>
            <Text style={styles.signLabel}>PODPIS KLIENTA{facts.clientName ? ` · ${facts.clientName}` : ''}</Text>
            {!drawing && signature.startsWith('data:image') ? (
              <View>
                <View style={[styles.stampLine, { height: Math.min(canvasH, 140) }]}>
                  <Image source={{ uri: signature }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <Text style={styles.signCap}>Podpis klienta — tak pojawi się na kopii</Text>
                <Pressable
                  onPress={() => {
                    onSignatureChange('');
                    setDrawing(true);
                  }}
                  style={styles.redo}
                >
                  <Ionicons name="refresh-outline" size={16} color="#ef4444" />
                  <Text style={styles.redoText}>Podpisz ponownie</Text>
                </Pressable>
              </View>
            ) : (
              <SignatureCanvas
                disabled={!attested || busy}
                isDark={false}
                height={canvasH}
                onCapture={onSignatureChange}
              />
            )}
            {!attested ? (
              <Text style={styles.lockHint}>Najpierw zaznacz zgodę — potem pole podpisu się odblokuje.</Text>
            ) : null}
          </View>

          <Pressable
            disabled={!ready || busy}
            onPress={onSubmit}
            style={[styles.cta, { opacity: ready && !busy ? 1 : 0.45 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                Zapisz i wyślij kopię{facts.clientEmail ? ` na ${facts.clientEmail}` : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ececef' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerSide: { minWidth: 72 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  cancel: { color: '#111', fontWeight: '700', fontSize: 16 },
  handoff: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  paper: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  brand: { backgroundColor: '#000', paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center' },
  brandMark: { color: '#fff', fontWeight: '800', letterSpacing: 3, fontSize: 13 },
  brandSub: { color: 'rgba(255,255,255,0.72)', marginTop: 6, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  inner: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 8 },
  docTitle: { textAlign: 'center', fontWeight: '900', letterSpacing: 0.6, fontSize: 15, color: '#111' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginVertical: 12 },
  block: { gap: 2 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#8e8e93', marginBottom: 4 },
  strong: { color: '#111', fontWeight: '800', fontSize: 15, lineHeight: 20 },
  body: { color: '#1c1c1e', fontSize: 14, lineHeight: 20 },
  muted: { color: '#c2410c', fontSize: 13, marginTop: 2 },
  oath: { color: '#333', fontSize: 14, lineHeight: 21 },
  dock: { paddingHorizontal: 4, paddingTop: 8 },
  checkRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  checkRowOn: { borderColor: '#34C759', backgroundColor: '#f0fdf4' },
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: '#34C759', borderColor: '#34C759' },
  checkTitle: { color: '#111', fontWeight: '800', fontSize: 15, lineHeight: 20 },
  checkSub: { color: '#6b7280', fontSize: 12, lineHeight: 17, marginTop: 4 },
  signLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#6b7280', marginBottom: 8 },
  stampLine: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  signCap: { marginTop: 6, color: '#8e8e93', fontSize: 12, fontWeight: '600' },
  redo: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  redoText: { color: '#ef4444', fontWeight: '800', fontSize: 13 },
  lockHint: { marginTop: 8, color: '#6b7280', fontSize: 12, fontWeight: '600' },
  cta: {
    marginTop: 12,
    backgroundColor: '#34C759',
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: { color: '#052e16', fontWeight: '900', fontSize: 16, textAlign: 'center' },
});
