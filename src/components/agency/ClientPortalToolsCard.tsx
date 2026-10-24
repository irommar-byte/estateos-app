import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import { API_URL } from '../../config/network';
import ClientDocumentPreview, { documentKind, type PreviewableDocument } from './ClientDocumentPreview';
import ContactPdfThumbnail from '../messaging/ContactPdfThumbnail';
import { normalizeContactMediaUrl } from '../../utils/contactAttachment';

type Colors = { card: string; text: string; secondary: string; border: string; accent: string };
type Sentiment = 'like' | 'maybe' | 'dislike' | null;

type ToolDocument = {
  key: string;
  label: string;
  /** komentarz pod nazwą pola — co dokładnie, skąd wziąć */
  hint?: string | null;
  required: boolean;
  custom?: boolean;
  status: 'missing' | 'uploaded' | 'accepted' | 'rejected' | 'na';
  fileName: string | null;
  fileUrl: string | null;
  mimeType?: string | null;
  note: string | null;
  uploadedAt?: string | null;
};

type DocTemplate = { id: number; label: string; hint: string | null; required: boolean };

type Tools = {
  documents?: ToolDocument[];
  documentsSummary?: { total?: number; required: number; done: number; missing: number; toReview: number };
  documentTemplates?: DocTemplate[];
  permissions: Record<string, boolean>;
  portalUrl: string | null;
  appInvite: { code: string; link: string; qrSvg?: string } | null;
  companions: Array<{ id: number; name: string; lastSeenAt: string | null }>;
  ratings: Array<{
    matchId: number;
    title: string;
    favorite: boolean;
    client: Sentiment;
    partners: Array<{ name: string; sentiment: Sentiment; note: string | null }>;
  }>;
  criteriaRequests: Array<{ id: number; title: string | null; createdAt: string; status: string }>;
  seller: null | {
    stats: { views: number; matches: number; showings: number; buyerOffers: number } | null;
    buyerOffers: Array<{
      id: number;
      buyerLabel: string;
      amount: number;
      financing: string;
      status: string;
      clientResponse?: string | null;
      counterAmount?: number | null;
    }>;
    showingFeedback: { showings: number; items: Array<{ tag: string; count: number; negative: boolean }> };
    feedbackTags: { positive: string[]; negative: string[] };
    netAtListPrice: { net: number } | null;
  };
};

const PERMISSION_LABELS: Array<{ key: string; label: string; seller?: boolean; buyer?: boolean }> = [
  { key: 'selfBooking', label: 'Klient sam umawia oglądania (Ty potwierdzasz)', buyer: true },
  { key: 'criteriaEdit', label: 'Klient zmienia obszar bez Twojej akceptacji', buyer: true },
  { key: 'earlyAccess', label: 'Wcześniejszy dostęp do nowych ofert', buyer: true },
  { key: 'partnerAccess', label: 'Druga osoba w panelu' },
  { key: 'sellerStats', label: 'Statystyki ogłoszenia', seller: true },
  { key: 'sellerFeedback', label: 'Opinie z oglądań', seller: true },
  { key: 'sellerCompetition', label: 'Konkurencja w okolicy', seller: true },
  { key: 'weeklyDigest', label: 'Piątkowe podsumowanie (po Twojej akceptacji)' },
  { key: 'viewingReminders', label: 'Przypomnienie dzień i 2 h przed potwierdzonym terminem' },
  { key: 'documents', label: 'Lista dokumentów z wrzucaniem plików' },
];

const DOC_STATUS: Record<string, { label: string; color: string }> = {
  missing: { label: 'brakuje', color: '#8E8E93' },
  uploaded: { label: 'do sprawdzenia', color: '#FF9F0A' },
  accepted: { label: 'gotowe', color: '#34C759' },
  rejected: { label: 'do poprawy', color: '#FF453A' },
  na: { label: 'klient: nie dotyczy', color: '#8E8E93' },
};

const SENT: Record<string, { label: string; color: string }> = {
  like: { label: 'Chce obejrzeć', color: '#34C759' },
  maybe: { label: 'Do przemyślenia', color: '#FF9F0A' },
  dislike: { label: 'Nie pasuje', color: '#FF453A' },
};

const pln = (value: number) => `${Math.round(value).toLocaleString('pl-PL')} zł`;

/**
 * Narzędzia panelu klienta po stronie agenta: kod do aplikacji (QR), uprawnienia,
 * druga osoba, oceny, prośby o zmianę obszaru, a u sprzedającego — oferty kupujących
 * i opinie z oglądań. Karta dodatkowa — nie zmienia reszty ekranu.
 */
export default function ClientPortalToolsCard({
  token,
  clientId,
  clientType,
  colors,
}: {
  token: string | null;
  clientId: number;
  clientType: 'BUYER' | 'SELLER' | string;
  colors: Colors;
}) {
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState<Tools | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [offerLabel, setOfferLabel] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerFinancing, setOfferFinancing] = useState<'cash' | 'mortgage'>('cash');
  const [offerRecommendation, setOfferRecommendation] = useState('');
  const [offerKind, setOfferKind] = useState<'accept' | 'counter' | 'reject' | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [newDoc, setNewDoc] = useState('');
  const [newDocHint, setNewDocHint] = useState('');
  const [newDocRequired, setNewDocRequired] = useState(true);
  const [newDocTemplate, setNewDocTemplate] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ToolDocument | null>(null);
  const isSeller = clientType === 'SELLER';

  const endpoint = `${API_URL}/api/crm/clients/${clientId}/portal-tools`;
  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint, { headers: headers() });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.tools) setTools(json.tools as Tools);
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, payload: Record<string, unknown>, okMessage?: string) => {
    if (!token) return false;
    setBusy(key);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Panel klienta', String(json?.error || 'Nie udało się.'));
        return false;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (okMessage) Alert.alert('Panel klienta', okMessage);
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  };

  const shareInvite = () => {
    if (!tools?.appInvite) return;
    const { code, link } = tools.appInvite;
    void Share.share({
      message: `Twój dostęp do aplikacji EstateOS: kod ${code}. Otwórz aplikację, wybierz „Jestem klientem” i wpisz kod — albo kliknij: ${link}`,
    });
  };

  const pendingCriteria = tools?.criteriaRequests.filter((r) => r.status === 'pending') || [];
  const subtitle = tools?.appInvite
    ? `Kod do aplikacji ${tools.appInvite.code.slice(0, 3)} ${tools.appInvite.code.slice(3)}${
        tools.companions.length ? ` · ${tools.companions.length} os. towarzysząca` : ''
      }${pendingCriteria.length ? ' · prośba o zmianę obszaru' : ''}${tools.documentsSummary?.toReview ? ` · ${tools.documentsSummary.toReview} dok. do sprawdzenia` : ''}`
    : 'Kod do aplikacji, uprawnienia, oceny';

  const visiblePermissions = PERMISSION_LABELS.filter((p) => (isSeller ? !p.buyer : !p.seller));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((current) => !current);
        }}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={[styles.icon, { backgroundColor: 'rgba(16,185,129,0.16)' }]}>
          <Ionicons name="qr-code" size={17} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Panel klienta i aplikacja</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {pendingCriteria.length || tools?.documentsSummary?.toReview ? <View style={styles.dot} /> : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.secondary} />
      </Pressable>

      {open ? (
        <View style={{ marginTop: 10 }}>
          {loading && !tools ? <ActivityIndicator color={colors.secondary} /> : null}

          {tools?.appInvite ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>ZAPROSZENIE DO APLIKACJI</Text>
              <View style={styles.inviteRow}>
                {tools.appInvite.qrSvg ? (
                  <View style={styles.qrBox}>
                    <SvgXml xml={tools.appInvite.qrSvg} width={132} height={132} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.code, { color: colors.text }]}>
                    {tools.appInvite.code.slice(0, 3)} {tools.appInvite.code.slice(3)}
                  </Text>
                  <Text style={[styles.small, { color: colors.secondary }]}>
                    Klient wybiera „Jestem klientem” i skanuje QR albo wpisuje kod.
                  </Text>
                  <View style={styles.btnRow}>
                    <Pressable onPress={shareInvite} style={[styles.btn, { backgroundColor: colors.text }]}>
                      <Ionicons name="share-outline" size={15} color={colors.card} />
                      <Text style={[styles.btnText, { color: colors.card }]}>Wyślij</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Nowy kod', 'Stary kod przestanie działać. Kontynuować?', [
                          { text: 'Anuluj', style: 'cancel' },
                          { text: 'Nowy kod', onPress: () => void act('invite', { action: 'regenerate_invite' }) },
                        ])
                      }
                      style={[styles.btn, { borderColor: colors.border, borderWidth: 1 }]}
                    >
                      {busy === 'invite' ? (
                        <ActivityIndicator size="small" color={colors.secondary} />
                      ) : (
                        <Text style={[styles.btnText, { color: colors.text }]}>Nowy kod</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {pendingCriteria.map((req) => (
            <View key={req.id} style={[styles.section, { borderColor: '#FF9F0A' }]}>
              <Text style={[styles.kicker, { color: '#FF9F0A' }]}>PROŚBA KLIENTA</Text>
              <Text style={[styles.body, { color: colors.text }]}>{req.title || 'Zmiana obszaru poszukiwań na mapie'}</Text>
              <View style={styles.btnRow}>
                <Pressable
                  onPress={() => void act(`cr-${req.id}`, { action: 'approve_criteria_request', requestId: req.id })}
                  style={[styles.btn, { backgroundColor: '#34C759' }]}
                >
                  <Text style={[styles.btnText, { color: '#fff' }]}>Akceptuj</Text>
                </Pressable>
                <Pressable
                  onPress={() => void act(`cr-${req.id}`, { action: 'reject_criteria_request', requestId: req.id })}
                  style={[styles.btn, { borderColor: colors.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.btnText, { color: colors.text }]}>Odrzuć</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {tools?.documents ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>
                DOKUMENTY ·{' '}
                {tools.documentsSummary?.missing
                  ? `BRAKUJE ${tools.documentsSummary.missing} Z ${tools.documentsSummary.total ?? tools.documents.length}`
                  : `KOMPLET ${tools.documents.length} Z ${tools.documents.length}`}
                {tools.documentsSummary?.toReview ? ` · ${tools.documentsSummary.toReview} DO SPRAWDZENIA` : ''}
              </Text>
              {tools.documents.map((doc) => {
                const st = DOC_STATUS[doc.status] || DOC_STATUS.missing;
                const fileUrl = doc.fileUrl ? normalizeContactMediaUrl(doc.fileUrl) : null;
                const kind = documentKind(doc);
                const removeDoc = () =>
                  Alert.alert(
                    'Usunąć z listy?',
                    `„${doc.label}” zniknie z panelu klienta${doc.fileUrl ? ' razem z dołączonym plikiem' : ''}, a licznik się zmniejszy.`,
                    [
                      { text: 'Anuluj', style: 'cancel' },
                      { text: 'Usuń', style: 'destructive', onPress: () => void act(`doc-${doc.key}`, { action: 'remove_document', itemKey: doc.key }) },
                    ],
                  );
                const editHint = () => {
                  if (Platform.OS !== 'ios') return;
                  Alert.prompt(
                    'Komentarz pod nazwą',
                    `Co dokładnie klient ma dołączyć do „${doc.label}”? Zobaczy to pod tytułem pola.`,
                    (hint) => void act(`doc-${doc.key}`, { action: 'update_document', itemKey: doc.key, hint: hint ?? '' }),
                    'plain-text',
                    doc.hint || '',
                  );
                };
                return (
                  <View key={doc.key} style={[styles.docRow, { borderColor: colors.border }]}>
                    {fileUrl ? (
                      <Pressable onPress={() => setPreviewDoc(doc)} style={styles.docThumb} accessibilityLabel={`Podgląd: ${doc.label}`}>
                        {kind === 'image' ? (
                          <Image source={{ uri: fileUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : kind === 'pdf' ? (
                          <ContactPdfThumbnail url={fileUrl} width={46} height={58} onPress={() => setPreviewDoc(doc)} />
                        ) : (
                          <Ionicons name="document-text" size={22} color={colors.secondary} />
                        )}
                      </Pressable>
                    ) : (
                      <View style={[styles.docThumb, { borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
                        <Ionicons name={doc.status === 'na' ? 'remove' : 'add'} size={18} color={colors.secondary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Pressable onLongPress={editHint} delayLongPress={350}>
                        <Text style={[styles.body, { color: colors.text, fontWeight: '700' }]}>
                          {doc.label}
                          {!doc.required ? <Text style={{ color: colors.secondary, fontWeight: '400' }}> · jeśli dotyczy</Text> : null}
                        </Text>
                        {doc.hint ? <Text style={[styles.small, { color: colors.secondary }]}>{doc.hint}</Text> : null}
                      </Pressable>
                      <Text style={[styles.small, { color: st.color, fontWeight: '700', marginTop: 2 }]}>{st.label}</Text>
                      {doc.status === 'rejected' && doc.note ? (
                        <Text style={[styles.small, { color: '#FF453A' }]}>Twoja uwaga: {doc.note}</Text>
                      ) : null}
                      {fileUrl ? (
                        <Pressable onPress={() => setPreviewDoc(doc)} hitSlop={6}>
                          <Text style={[styles.small, { color: '#0A84FF', fontWeight: '600' }]} numberOfLines={1}>
                            Podgląd · {doc.fileName || 'plik'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {doc.status === 'uploaded' ? (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <Pressable
                            onPress={() => void act(`doc-${doc.key}`, { action: 'review_document', itemKey: doc.key, status: 'accepted' })}
                            style={[styles.btn, { backgroundColor: '#34C759', paddingHorizontal: 12 }]}
                          >
                            <Ionicons name="checkmark" size={15} color="#fff" />
                            <Text style={[styles.btnText, { color: '#fff' }]}>Akceptuj</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              const reject = (note?: string) =>
                                void act(`doc-${doc.key}`, { action: 'review_document', itemKey: doc.key, status: 'rejected', note: note || null });
                              if (Platform.OS === 'ios') {
                                Alert.prompt('Do poprawy', 'Co klient ma poprawić? Zobaczy to w panelu i dostanie powiadomienie.', (note) => reject(note));
                              } else {
                                reject();
                              }
                            }}
                            style={[styles.btn, { borderColor: colors.border, borderWidth: 1, paddingHorizontal: 12 }]}
                          >
                            <Text style={[styles.btnText, { color: colors.text }]}>Do poprawy</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ gap: 12, alignItems: 'center', paddingTop: 2 }}>
                      {Platform.OS === 'ios' ? (
                        <Pressable onPress={editHint} hitSlop={10} accessibilityLabel={`Komentarz: ${doc.label}`}>
                          <Ionicons name="create-outline" size={18} color={colors.secondary} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={removeDoc} hitSlop={10} accessibilityLabel={`Usuń: ${doc.label}`}>
                        <Ionicons name="trash-outline" size={18} color={colors.secondary} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {tools.documentTemplates?.length ? (
                <>
                  <Text style={[styles.small, { color: colors.secondary, marginTop: 12, fontWeight: '700' }]}>
                    TWOJE ZAPISANE POLA — dotknij, by dodać · przytrzymaj, by usunąć
                  </Text>
                  <View style={styles.chips}>
                    {tools.documentTemplates
                      .filter((t) => !tools.documents?.some((d) => d.label.trim().toLowerCase() === t.label.trim().toLowerCase()))
                      .map((t) => (
                        <Pressable
                          key={t.id}
                          onPress={() => void act(`tpl-${t.id}`, { action: 'add_document', label: t.label, hint: t.hint, required: t.required })}
                          onLongPress={() =>
                            Alert.alert('Usunąć zapisane pole?', `„${t.label}” zniknie z Twoich szablonów (u klientów zostaje).`, [
                              { text: 'Anuluj', style: 'cancel' },
                              { text: 'Usuń', style: 'destructive', onPress: () => void act(`tpl-${t.id}`, { action: 'delete_document_template', templateId: t.id }) },
                            ])
                          }
                          style={[styles.chip, { borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                        >
                          <Ionicons name="add" size={13} color={colors.text} />
                          <Text style={[styles.chipText, { color: colors.text }]}>{t.label}</Text>
                        </Pressable>
                      ))}
                  </View>
                </>
              ) : null}

              <View style={[styles.addBox, { borderColor: colors.border }]}>
                <Text style={[styles.small, { color: colors.secondary, fontWeight: '700' }]}>NOWE POLE NA LIŚCIE</Text>
                <TextInput
                  value={newDoc}
                  onChangeText={setNewDoc}
                  placeholder="Nazwa, np. Zaświadczenie ze spółdzielni"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
                <TextInput
                  value={newDocHint}
                  onChangeText={setNewDocHint}
                  placeholder="Komentarz pod tytułem (opcjonalnie) — skąd wziąć, co ma zawierać"
                  placeholderTextColor={colors.secondary}
                  multiline
                  style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 64, textAlignVertical: 'top' }]}
                />
                <View style={styles.permRow}>
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]}>Obowiązkowy (bez „jeśli dotyczy”)</Text>
                  <Switch value={newDocRequired} onValueChange={setNewDocRequired} />
                </View>
                <View style={styles.permRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.body, { color: colors.text }]}>Zapisz na zawsze jako szablon</Text>
                    <Text style={[styles.small, { color: colors.secondary }]}>Dodasz je jednym dotknięciem u kolejnych klientów</Text>
                  </View>
                  <Switch value={newDocTemplate} onValueChange={setNewDocTemplate} />
                </View>
                <Pressable
                  onPress={async () => {
                    const ok = await act('doc-add', {
                      action: 'add_document',
                      label: newDoc,
                      hint: newDocHint.trim() || null,
                      required: newDocRequired,
                      saveAsTemplate: newDocTemplate,
                    });
                    if (ok) {
                      setNewDoc('');
                      setNewDocHint('');
                      setNewDocRequired(true);
                      setNewDocTemplate(false);
                    }
                  }}
                  disabled={!newDoc.trim() || busy === 'doc-add'}
                  style={[styles.btn, { backgroundColor: colors.text, marginTop: 6, justifyContent: 'center', opacity: newDoc.trim() ? 1 : 0.4 }]}
                >
                  {busy === 'doc-add' ? <ActivityIndicator color={colors.card} /> : <Ionicons name="add" size={16} color={colors.card} />}
                  <Text style={[styles.btnText, { color: colors.card }]}>Dodaj do listy klienta</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {tools?.ratings.length ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>OCENY OFERT</Text>
              {tools.ratings.slice(0, 8).map((row) => (
                <View key={row.matchId} style={styles.ratingRow}>
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {row.favorite ? '♥ ' : ''}
                    {row.title}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    {row.client ? (
                      <Text style={[styles.small, { color: SENT[row.client]?.color }]}>Klient: {SENT[row.client]?.label}</Text>
                    ) : null}
                    {row.partners.map((p) => (
                      <Text key={p.name} style={[styles.small, { color: p.sentiment ? SENT[p.sentiment]?.color : colors.secondary }]}>
                        {p.name}: {p.sentiment ? SENT[p.sentiment]?.label : '—'}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {isSeller && tools?.seller ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>OFERTY KUPUJĄCYCH</Text>
              {tools.seller.buyerOffers.map((o) => (
                <View key={o.id} style={styles.ratingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.body, { color: colors.text }]}>
                      {o.buyerLabel} · {pln(o.amount)}
                    </Text>
                    <Text style={[styles.small, { color: colors.secondary }]}>
                      {o.financing === 'mortgage' ? 'Kredyt' : 'Gotówka'} · {o.status === 'OPEN' ? 'czeka na decyzję' : o.status.toLowerCase()}
                      {o.clientResponse ? ` · klient: ${o.clientResponse}` : ''}
                      {o.counterAmount ? ` (${pln(o.counterAmount)})` : ''}
                    </Text>
                  </View>
                  {o.status === 'OPEN' ? (
                    <Pressable onPress={() => void act(`bo-${o.id}`, { action: 'close_buyer_offer', buyerOfferId: o.id })} hitSlop={10}>
                      <Ionicons name="close-circle-outline" size={20} color={colors.secondary} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <TextInput
                value={offerLabel}
                onChangeText={setOfferLabel}
                placeholder="Kupujący (np. Para z Mokotowa)"
                placeholderTextColor={colors.secondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
              <TextInput
                value={offerAmount}
                onChangeText={(v) => setOfferAmount(v.replace(/\D/g, ''))}
                placeholder="Kwota (zł)"
                keyboardType="number-pad"
                placeholderTextColor={colors.secondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
              <View style={styles.chips}>
                {(['cash', 'mortgage'] as const).map((f) => (
                  <Chip key={f} label={f === 'cash' ? 'Gotówka' : 'Kredyt'} on={offerFinancing === f} onPress={() => setOfferFinancing(f)} colors={colors} />
                ))}
              </View>
              <Text style={[styles.small, { color: colors.secondary, marginTop: 8 }]}>Twoja rekomendacja</Text>
              <View style={styles.chips}>
                {(['accept', 'counter', 'reject'] as const).map((k) => (
                  <Chip
                    key={k}
                    label={k === 'accept' ? 'Przyjąć' : k === 'counter' ? 'Kontra' : 'Odrzucić'}
                    on={offerKind === k}
                    onPress={() => setOfferKind(offerKind === k ? null : k)}
                    colors={colors}
                  />
                ))}
              </View>
              <TextInput
                value={offerRecommendation}
                onChangeText={setOfferRecommendation}
                placeholder="Dlaczego tak (klient zobaczy to w panelu)"
                placeholderTextColor={colors.secondary}
                multiline
                style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 60 }]}
              />
              <Pressable
                onPress={async () => {
                  const ok = await act(
                    'offer-new',
                    {
                      action: 'save_buyer_offer',
                      buyerLabel: offerLabel,
                      amount: Number(offerAmount),
                      financing: offerFinancing,
                      recommendation: offerRecommendation,
                      recommendationKind: offerKind,
                      notify: true,
                    },
                    'Oferta jest w panelu sprzedającego — dostał powiadomienie.',
                  );
                  if (ok) {
                    setOfferLabel('');
                    setOfferAmount('');
                    setOfferRecommendation('');
                    setOfferKind(null);
                  }
                }}
                disabled={!offerAmount || busy === 'offer-new'}
                style={[styles.btn, { backgroundColor: colors.text, alignSelf: 'flex-start', marginTop: 8, opacity: offerAmount ? 1 : 0.4 }]}
              >
                <Text style={[styles.btnText, { color: colors.card }]}>Dodaj ofertę i powiadom</Text>
              </Pressable>
            </View>
          ) : null}

          {isSeller && tools?.seller ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>
                OPINIE Z OGLĄDAŃ{tools.seller.showingFeedback.showings ? ` · ${tools.seller.showingFeedback.showings}` : ''}
              </Text>
              {tools.seller.showingFeedback.items.length ? (
                <Text style={[styles.small, { color: colors.secondary, marginBottom: 6 }]}>
                  {tools.seller.showingFeedback.items
                    .slice(0, 5)
                    .map((i) => `${i.tag} ×${i.count}`)
                    .join(' · ')}
                </Text>
              ) : null}
              <View style={styles.chips}>
                {[...tools.seller.feedbackTags.positive, ...tools.seller.feedbackTags.negative].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    on={feedbackTags.includes(tag)}
                    negative={tools.seller?.feedbackTags.negative.includes(tag)}
                    onPress={() =>
                      setFeedbackTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
                    }
                    colors={colors}
                  />
                ))}
              </View>
              <Pressable
                onPress={async () => {
                  const ok = await act('fb', { action: 'add_showing_feedback', tags: feedbackTags });
                  if (ok) setFeedbackTags([]);
                }}
                disabled={!feedbackTags.length || busy === 'fb'}
                style={[styles.btn, { backgroundColor: colors.text, alignSelf: 'flex-start', marginTop: 8, opacity: feedbackTags.length ? 1 : 0.4 }]}
              >
                <Text style={[styles.btnText, { color: colors.card }]}>Zapisz opinię z oglądania</Text>
              </Pressable>
            </View>
          ) : null}

          {tools?.companions.length ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>DRUGA OSOBA</Text>
              {tools.companions.map((c) => (
                <View key={c.id} style={styles.ratingRow}>
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]}>
                    {c.name}
                    <Text style={{ color: colors.secondary }}>
                      {c.lastSeenAt ? ` · ostatnio ${new Date(c.lastSeenAt).toLocaleDateString('pl-PL')}` : ' · jeszcze nie otworzył(a)'}
                    </Text>
                  </Text>
                  <Pressable onPress={() => void act(`cmp-${c.id}`, { action: 'revoke_companion', companionId: c.id })} hitSlop={10}>
                    <Text style={[styles.small, { color: '#FF453A', fontWeight: '700' }]}>Odbierz dostęp</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {tools ? (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.secondary }]}>CO KLIENT MOŻE W PANELU</Text>
              {visiblePermissions.map((p) => (
                <View key={p.key} style={styles.permRow}>
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]}>{p.label}</Text>
                  {busy === `perm-${p.key}` ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : (
                    <Switch
                      value={Boolean(tools.permissions[p.key])}
                      onValueChange={(next) =>
                        void act(`perm-${p.key}`, { action: 'set_permissions', permissions: { [p.key]: next } })
                      }
                    />
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <ClientDocumentPreview
        doc={previewDoc as PreviewableDocument | null}
        onClose={() => setPreviewDoc(null)}
        footer={
          previewDoc?.status === 'uploaded' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => {
                  const doc = previewDoc;
                  setPreviewDoc(null);
                  if (doc) void act(`doc-${doc.key}`, { action: 'review_document', itemKey: doc.key, status: 'accepted' });
                }}
                style={[styles.btn, { backgroundColor: '#34C759', flex: 1, justifyContent: 'center' }]}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={[styles.btnText, { color: '#fff' }]}>Akceptuj</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const doc = previewDoc;
                  if (!doc) return;
                  const reject = (note?: string) => {
                    setPreviewDoc(null);
                    void act(`doc-${doc.key}`, { action: 'review_document', itemKey: doc.key, status: 'rejected', note: note || null });
                  };
                  if (Platform.OS === 'ios') Alert.prompt('Do poprawy', 'Co klient ma poprawić?', (note) => reject(note));
                  else reject();
                }}
                style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.12)', flex: 1, justifyContent: 'center' }]}
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>Do poprawy</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

    </View>
  );
}

function Chip({
  label,
  on,
  negative,
  onPress,
  colors,
}: {
  label: string;
  on: boolean;
  negative?: boolean;
  onPress: () => void;
  colors: Colors;
}) {
  const active = negative ? '#FF453A' : '#10b981';
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, { borderColor: on ? active : colors.border, backgroundColor: on ? `${active}22` : 'transparent' }]}
    >
      <Text style={[styles.chipText, { color: on ? active : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9F0A' },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  inviteRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  qrBox: { backgroundColor: '#fff', padding: 8, borderRadius: 14 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  small: { fontSize: 12, lineHeight: 17 },
  body: { fontSize: 14, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    minHeight: 36,
  },
  btnText: { fontSize: 14, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  docRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  docThumb: {
    width: 46,
    height: 58,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  addBox: { marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
});
