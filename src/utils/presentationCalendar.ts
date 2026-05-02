import type { Alarm as CalendarAlarm } from 'expo-calendar';
import type { Event as CalendarEvent } from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import { API_URL } from '../config/network';
import { buildOfferLandingPageUrl } from './offerShareUrls';

const CALENDAR_PROMPT_STORAGE_PREFIX = '@estateos_dealroom_calendar_prompt_v1';

function calendarPromptStorageKey(dealId: number | string, proposedDateIso: string): string {
  const d = String(dealId ?? '').trim() || '0';
  const ms = new Date(proposedDateIso).getTime();
  const slot = Number.isFinite(ms) ? String(ms) : String(proposedDateIso).replace(/\s+/g, '').slice(0, 64);
  return `${CALENDAR_PROMPT_STORAGE_PREFIX}:${d}:${slot}`;
}

async function markCalendarPromptHandled(dealId: number | string, proposedDateIso: string): Promise<void> {
  try {
    await AsyncStorage.setItem(calendarPromptStorageKey(dealId, proposedDateIso), '1');
  } catch {
    /* noop */
  }
}

async function wasCalendarPromptHandled(dealId: number | string, proposedDateIso: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(calendarPromptStorageKey(dealId, proposedDateIso));
    return v === '1';
  } catch {
    return false;
  }
}

type ExpoCalendarModule = typeof import('expo-calendar');

/**
 * expo-calendar ładuje natywne `ExpoCalendar` przez requireNativeModule — jeśli CocoaPods / binarka
 * nie zawiera modułu (stary build, brak `pod install`), require rzuca i pokazujemy komunikat z hintem.
 * Dynamiczny import('expo-calendar') generuje chunk Metro („unknown module …”) — zostaje require().
 */
function loadExpoCalendar(): { calendar: ExpoCalendarModule | null; loadError?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { calendar: require('expo-calendar') as ExpoCalendarModule };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (__DEV__) {
      console.warn('[presentationCalendar] expo-calendar:', e);
    }
    return { calendar: null, loadError: msg };
  }
}

const PRESENTATION_DURATION_MS = 60 * 60 * 1000;

/**
 * Na Androidzie brak „Czas na wyjazd” jak w Kalendarzu Apple — zostawiamy klasyczne minuty przed.
 * Na iOS nie ustawiamy tu „fałszywego” wyjazdu; inteligentny czas z Map użytkownik włącza w edycji wydarzenia.
 */
export const ANDROID_FIRST_REMINDER_MINUTES_BEFORE = 90;
export const ANDROID_SECOND_REMINDER_MINUTES_BEFORE = 30;

const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

function normalizeDealsPayload(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.deals)) return payload.deals;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data?.deals)) return payload.data.deals;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  return [];
}

async function fetchDealRow(token: string, dealId: number | string): Promise<any | null> {
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const deals = normalizeDealsPayload(json);
    return deals.find((d: any) => String(d?.id) === String(dealId)) || null;
  } catch {
    return null;
  }
}

async function fetchOfferById(token: string, offerId: number | string): Promise<any | null> {
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const offers = Array.isArray(json?.offers) ? json.offers : [];
    const id = Number(offerId);
    return offers.find((o: any) => Number(o?.id || 0) === id) || null;
  } catch {
    return null;
  }
}

/**
 * Strony deala z GET /api/mobile/v1/deals — buyer/seller/otherParty z email i phone (bez publicznego profilu).
 */
function dealPartyFields(p: any): { name: string; email: string | null; phone: string | null } {
  if (!p || typeof p !== 'object') return { name: '', email: null, phone: null };
  const o = p.user && typeof p.user === 'object' ? { ...p, ...p.user } : p;
  const name = String(o.name || o.fullName || '').trim();
  const emailRaw = String(o.email || '').trim();
  const email = emailRaw.includes('@') ? emailRaw : null;
  const phone = String(o.phone || o.phoneNumber || o.mobile || o.mobilePhone || '').trim() || null;
  return { name, email, phone };
}

function partyFromDealByUserId(deal: any, userId: number): any | null {
  if (!deal || !userId) return null;
  const b = deal.buyer;
  const s = deal.seller;
  if (b && Number(b.id) === userId) return b;
  if (s && Number(s.id) === userId) return s;
  return null;
}

/** Numer z ogłoszenia — wiele backendów trzyma telefon tylko na ofercie. */
function extractPhoneFromOffer(offer: any): string | null {
  if (!offer || typeof offer !== 'object') return null;
  const raw = firstDefined(
    offer.phone,
    offer.contactPhone,
    offer.ownerPhone,
    offer.mobilePhone,
    offer.mobile,
    offer.tel,
    offer.listingPhone,
    offer.sellerPhone,
    offer.publicPhone,
    offer.publisherPhone,
    offer.agentPhone,
    offer.contact?.phone,
    offer.user?.phone,
    offer.user?.phoneNumber
  );
  const s = String(raw ?? '').trim();
  return s || null;
}

/** Zapis `tel:+48…` do opisu wydarzenia — systemowy Kalendarz podświetla to jako kontakt. */
function toTelUri(displayPhone: string): string | null {
  const s = String(displayPhone || '').trim();
  if (!s) return null;
  const hadPlus = s.trim().startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;
  if (hadPlus) return `tel:+${digits}`;
  if (digits.length === 9 && /^[1-9]/.test(digits)) return `tel:+48${digits}`;
  if (digits.length === 11 && digits.startsWith('48')) return `tel:+${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `tel:+48${digits.slice(1)}`;
  if (digits.length >= 9 && digits.length <= 15) return `tel:+${digits}`;
  return null;
}

function extractEmailFromOffer(offer: any): string | null {
  if (!offer || typeof offer !== 'object') return null;
  const raw = firstDefined(
    offer.email,
    offer.contactEmail,
    offer.ownerEmail,
    offer.contact?.email,
    offer.user?.email,
    offer.publisherEmail
  );
  const s = String(raw ?? '').trim();
  if (!s || !s.includes('@')) return null;
  return s;
}

function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function normalizedEmail(email: string | null | undefined): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/** Ta sama osoba po obu stronach (np. ten sam userId albo ten sam tel+mail). */
function contactsRepresentSamePerson(params: {
  ownerOfferUserId: number;
  peerUserId: number;
  ownerPhone: string | null;
  ownerEmail: string | null;
  peerPhone: string | null;
  peerEmail: string | null;
}): boolean {
  const { ownerOfferUserId, peerUserId } = params;
  if (ownerOfferUserId > 0 && peerUserId > 0 && ownerOfferUserId === peerUserId) return true;
  const od = normalizePhoneDigits(params.ownerPhone);
  const pd = normalizePhoneDigits(params.peerPhone);
  const oe = normalizedEmail(params.ownerEmail);
  const pe = normalizedEmail(params.peerEmail);
  if (od && pd && od === pd) {
    if (oe && pe) return oe === pe;
    return true;
  }
  if (!od && !pd && oe && pe && oe === pe) return true;
  return false;
}

function buildContactSectionLines(params: {
  ownerLabel: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  peerLabel: string;
  peerPhone: string | null;
  peerEmail: string | null;
  peerUserId: number;
  ownerOfferUserId: number;
}): string[] {
  const lines: string[] = [];

  const writeChannels = (phone: string | null, email: string | null) => {
    if (phone) {
      lines.push(`   Telefon   ${phone.trim()}`);
      const uri = toTelUri(phone);
      if (uri) lines.push(`             ${uri}`);
    }
    if (email) {
      lines.push(`   E-mail    ${email.trim()}`);
      lines.push(`             mailto:${email.trim()}`);
    }
    if (!phone && !email) {
      lines.push('   (brak telefonu i e-mailu w Dealroom / ogłoszeniu — sprawdź czat EstateOS™)');
    }
    lines.push('');
  };

  const merged =
    params.peerUserId > 0 &&
    contactsRepresentSamePerson({
      ownerOfferUserId: params.ownerOfferUserId,
      peerUserId: params.peerUserId,
      ownerPhone: params.ownerPhone,
      ownerEmail: params.ownerEmail,
      peerPhone: params.peerPhone,
      peerEmail: params.peerEmail,
    });

  if (merged) {
    lines.push(`   ${params.ownerLabel}`);
    const alt = params.peerLabel.trim();
    if (alt && alt !== params.ownerLabel.trim()) {
      lines.push(`   (${alt} — w Dealroom ten sam zestaw kontaktowy)`);
    }
    lines.push(
      '   Obie role (ogłoszenie i druga strona) mają tu identyczne dane — pełny kontekst w EstateOS™.'
    );
    lines.push('');
    writeChannels(
      params.ownerPhone || params.peerPhone,
      params.ownerEmail || params.peerEmail
    );
    return lines;
  }

  const personBlock = (role: string, name: string, phone: string | null, email: string | null) => {
    lines.push(`   ▸ ${role} — ${name}`);
    writeChannels(phone, email);
  };

  personBlock('Ogłoszenie', params.ownerLabel, params.ownerPhone, params.ownerEmail);
  if (params.peerUserId > 0) {
    personBlock('Druga strona', params.peerLabel, params.peerPhone, params.peerEmail);
  }

  return lines;
}

function buildProfessionalCalendarNotes(input: {
  dealId: number | string;
  offerTitle: string | null;
  displayLocation: string;
  geoNote: boolean;
  landingUrl: string | null;
  /** Gdy true (np. iOS + pole URL wydarzenia), nie powielamy pełnego HTTPS w notatkach. */
  landingUrlOnlyInEventUrlField: boolean;
  mapsUrl: string | null;
  ownerOfferUserId: number;
  ownerLabel: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  peerLabel: string;
  peerPhone: string | null;
  peerEmail: string | null;
  peerUserId: number;
  tailBlocks: string[];
}): string {
  const rule = '────────────────────────────────────────';
  const out: string[] = [];
  out.push(rule);
  out.push(`  ESTATEOS™  ·  Dealroom TX-${input.dealId}`);
  out.push(rule);
  out.push('');
  out.push('PREZENTACJA NIERUCHOMOŚCI');
  out.push('Termin potwierdzony w czacie negocjacji (Dealroom).');
  out.push('');
  if (input.offerTitle) {
    out.push('▸ Oferta');
    out.push(`   ${input.offerTitle}`);
    out.push('');
  }
  out.push('▸ Adres spotkania');
  out.push(`   ${input.displayLocation || '— uzupełnij ręcznie w kalendarzu, jeśli brak w ogłoszeniu'}`);
  if (input.geoNote) out.push('   · dopasowanie adresu z map (geokodowanie)');
  out.push('');
  if (input.landingUrl) {
    out.push('▸ Wizytówka www');
    if (input.landingUrlOnlyInEventUrlField) {
      out.push('   Link do zdjęć i parametrów: pole „URL” tego wydarzenia (Kalendarz Apple).');
    } else {
      out.push(`   ${input.landingUrl}`);
    }
    out.push('');
  }
  if (input.mapsUrl) {
    out.push('▸ Dojazd (Mapy)');
    out.push(`   ${input.mapsUrl}`);
    out.push('');
  }
  out.push('▸ Kontakt');
  out.push('');
  out.push(
    ...buildContactSectionLines({
      ownerLabel: input.ownerLabel,
      ownerPhone: input.ownerPhone,
      ownerEmail: input.ownerEmail,
      peerLabel: input.peerLabel,
      peerPhone: input.peerPhone,
      peerEmail: input.peerEmail,
      peerUserId: input.peerUserId,
      ownerOfferUserId: input.ownerOfferUserId,
    })
  );
  for (const block of input.tailBlocks) {
    if (block.trim()) {
      out.push(block);
    }
  }
  return out.join('\n');
}

function partyDisplayName(party: any, fallbackId: number): string {
  const { name } = dealPartyFields(party);
  if (name) return name;
  if (fallbackId > 0) return `Użytkownik #${fallbackId}`;
  return 'Nieznany';
}

export function formatOfferLocationForCalendar(offer: any): string {
  if (!offer || typeof offer !== 'object') return '';
  const street = String(offer.street || '').trim();
  const city = String(offer.city || '').trim();
  const district = String(offer.district || '').trim();
  const parts = [
    street,
    [district, city].filter(Boolean).join(', ') || city,
  ].filter(Boolean);
  return parts.join(', ') || '';
}

/**
 * Uściśla adres i zwraca współrzędne — Apple Kalendarz + „Czas na wyjazd” korzystają z Map przy rozwiązanym miejscu.
 * expo geocode zwraca tylko lat/lng; reverseGeocode dopina ulice i miasto.
 */
async function refineLocationWithGeocode(rawAddress: string): Promise<{
  displayLocation: string;
  latitude?: number;
  longitude?: number;
}> {
  const trimmed = rawAddress.trim();
  if (!trimmed) return { displayLocation: '' };
  try {
    const results = await Location.geocodeAsync(`${trimmed}, Polska`);
    const point = results?.[0];
    if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
      const rev = await Location.reverseGeocodeAsync({
        latitude: point.latitude,
        longitude: point.longitude,
      });
      const a = rev?.[0];
      const structured =
        a &&
        [a.street && a.streetNumber ? `${a.street} ${a.streetNumber}`.trim() : a.street || null, a.city || a.district]
          .filter(Boolean)
          .join(', ');
      return {
        displayLocation: structured?.trim() || trimmed,
        latitude: point.latitude,
        longitude: point.longitude,
      };
    }
  } catch {
    /* geokodowanie opcjonalne */
  }
  return { displayLocation: trimmed };
}

function buildAppleMapsUrl(displayLocation: string, latitude?: number, longitude?: number): string {
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const q = encodeURIComponent(displayLocation);
    return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`;
  }
  return `https://maps.apple.com/?q=${encodeURIComponent(displayLocation)}`;
}

async function pickWritableCalendarId(Cal: ExpoCalendarModule): Promise<string | null> {
  const calendars = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  const writable =
    calendars.find((c) => c.allowsModifications && c.accessLevel === Cal.CalendarAccessLevel.OWNER) ||
    calendars.find((c) => c.allowsModifications) ||
    calendars[0];
  return writable?.id ?? null;
}

export type PresentationCalendarPromptParams = {
  token: string;
  dealId: number | string;
  offerId: number | string | null | undefined;
  proposedDateIso: string;
  fallbackTitle: string;
  viewerUserId: number | string | null | undefined;
  /** Z GET /api/mobile/v1/auth (lub store po logowaniu) — uzupełnia kontakt „ja”, gdy jestem stroną ogłoszenia. */
  viewerEmail?: string | null;
  viewerPhone?: string | null;
};

/**
 * Wywołaj po pojawieniu się w czacie zdarzenia APPOINTMENT + ACCEPTED (nowa wiadomość).
 * Pokazuje Alert i opcjonalnie otwiera natywny zapis do kalendarza z adresem i telefonami.
 */
export async function offerPresentationCalendarAfterAcceptance(params: PresentationCalendarPromptParams): Promise<void> {
  if (Platform.OS === 'web') return;

  if (await wasCalendarPromptHandled(params.dealId, params.proposedDateIso)) {
    return;
  }

  const { calendar: Calendar, loadError } = loadExpoCalendar();
  if (!Calendar) {
    const hint =
      'Biblioteka jest w JavaScript, ale brakuje natywnego modułu ExpoCalendar w uruchomionej binarce — zwykle po dodaniu expo-calendar do projektu nie zrobiono odświeżenia iOS / CocoaPods albo instalacja jest starsza niż zmiana.\n\n' +
      'Zrób: w katalogu aplikacji `cd ios && pod install`, potem w Xcode Product → Clean Build Folder i pełny build na urządzeniu (albo `npx expo run:ios`).\n\n' +
      'Jeśli nie masz folderu ios: `npx expo prebuild -p ios`, potem build z Xcode.';
    Alert.alert(
      'Kalendarz — brak modułu natywnego',
      __DEV__ && loadError ? `${hint}\n\n(${loadError})` : hint
    );
    return;
  }

  const available = await Calendar.isAvailableAsync().catch(() => false);
  if (!available) return;

  const start = new Date(params.proposedDateIso);
  if (Number.isNaN(start.getTime())) return;

  const deal = await fetchDealRow(params.token, params.dealId);
  let offerIdNum = Number(params.offerId || 0);
  if (!offerIdNum || offerIdNum <= 0) {
    const fromDeal = Number(
      firstDefined(deal?.offerId, deal?.offer?.id, deal?.listingId, deal?.propertyId) || 0
    );
    if (Number.isFinite(fromDeal) && fromDeal > 0) offerIdNum = fromDeal;
  }

  const offer = offerIdNum > 0 ? await fetchOfferById(params.token, offerIdNum) : null;
  const rawLocation = formatOfferLocationForCalendar(offer);
  const refined = await refineLocationWithGeocode(rawLocation);
  const displayLocation = (refined.displayLocation || rawLocation).trim();
  const titleShort = String(offer?.title || params.fallbackTitle || 'Prezentacja').trim();

  const buyerId = Number(firstDefined(deal?.buyerId, deal?.buyer?.id) || 0);
  const sellerId = Number(firstDefined(deal?.sellerId, deal?.seller?.id) || 0);
  const ownerOfferUserId = Number(offer?.userId || 0);
  const me = Number(params.viewerUserId || 0);

  let peerUserId = 0;
  if (me && buyerId && me === buyerId && sellerId) peerUserId = sellerId;
  else if (me && sellerId && me === sellerId && buyerId) peerUserId = buyerId;
  else if (ownerOfferUserId && me !== ownerOfferUserId) peerUserId = ownerOfferUserId;
  else if (buyerId && buyerId !== me) peerUserId = buyerId;
  else if (sellerId && sellerId !== me) peerUserId = sellerId;

  const viewerEmailRaw = String(params.viewerEmail ?? '').trim();
  const viewerEmailOk = viewerEmailRaw.includes('@') ? viewerEmailRaw : null;
  const viewerPhoneRaw = String(params.viewerPhone ?? '').trim();
  const viewerPhoneOk =
    viewerPhoneRaw && viewerPhoneRaw !== 'Brak numeru' ? viewerPhoneRaw : null;

  const ownerPartyRow =
    ownerOfferUserId > 0 ? partyFromDealByUserId(deal, ownerOfferUserId) : null;
  const ownerFields = dealPartyFields(ownerPartyRow);
  let ownerPhoneResolved = ownerFields.phone || extractPhoneFromOffer(offer);
  let ownerEmailResolved = ownerFields.email || extractEmailFromOffer(offer);
  if (me > 0 && ownerOfferUserId > 0 && me === ownerOfferUserId) {
    ownerPhoneResolved = ownerPhoneResolved || viewerPhoneOk;
    ownerEmailResolved = ownerEmailResolved || viewerEmailOk;
  }
  const ownerLabel = ownerFields.name || partyDisplayName(ownerPartyRow, ownerOfferUserId);

  const otherPartyFields = deal?.otherParty ? dealPartyFields(deal.otherParty) : null;
  const peerPartyRow = peerUserId > 0 ? partyFromDealByUserId(deal, peerUserId) : null;
  const peerFields = dealPartyFields(peerPartyRow);

  let peerPhone = otherPartyFields?.phone || peerFields.phone || null;
  let peerEmail = otherPartyFields?.email || peerFields.email || null;
  let peerLabel =
    (otherPartyFields?.name || '').trim() ||
    peerFields.name ||
    partyDisplayName(peerPartyRow, peerUserId);

  const peerEmailResolved = peerUserId > 0 ? peerEmail : null;

  const sameContactPreview =
    peerUserId > 0 &&
    contactsRepresentSamePerson({
      ownerOfferUserId,
      peerUserId,
      ownerPhone: ownerPhoneResolved,
      ownerEmail: ownerEmailResolved,
      peerPhone,
      peerEmail: peerEmailResolved,
    });

  const end = new Date(start.getTime() + PRESENTATION_DURATION_MS);
  const whenLabel = start.toLocaleString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const landingUrl = offerIdNum > 0 ? buildOfferLandingPageUrl(offerIdNum) : null;
  const mapsUrl =
    displayLocation.trim().length > 0
      ? buildAppleMapsUrl(displayLocation, refined.latitude, refined.longitude)
      : null;

  const iphoneTail =
    Platform.OS === 'ios'
      ? [
          '',
          '────────────────────────────────────────',
          'iPhone — „Czas na wyjazd”',
          'Po zapisaniu: wydarzenie → Edytuj → Powiadomienia → Time to Leave / dojazd (Mapy).',
          'Ustawienia → Kalendarz → Czas na wyjazd · lokalizacja dla Kalendarza i Map.',
        ].join('\n')
      : '';

  const androidTail =
    Platform.OS === 'android'
      ? [
          '',
          '────────────────────────────────────────',
          `Przypomnienia: ${ANDROID_FIRST_REMINDER_MINUTES_BEFORE} min i ${ANDROID_SECOND_REMINDER_MINUTES_BEFORE} min przed startem.`,
        ].join('\n')
      : '';

  const landingUrlOnlyInEventUrlField = Platform.OS === 'ios' && !!landingUrl;

  const notes = buildProfessionalCalendarNotes({
    dealId: params.dealId,
    offerTitle: offer?.title ? String(offer.title) : null,
    displayLocation,
    geoNote: refined.latitude != null,
    landingUrl,
    landingUrlOnlyInEventUrlField,
    mapsUrl,
    ownerOfferUserId,
    ownerLabel,
    ownerPhone: ownerPhoneResolved,
    ownerEmail: ownerEmailResolved,
    peerLabel,
    peerPhone,
    peerEmail: peerEmailResolved,
    peerUserId,
    tailBlocks: [iphoneTail, androidTail].filter((t) => t.length > 0),
  });

  const androidAlarms: CalendarAlarm[] = [
    { relativeOffset: -ANDROID_FIRST_REMINDER_MINUTES_BEFORE },
    { relativeOffset: -ANDROID_SECOND_REMINDER_MINUTES_BEFORE },
  ];

  const eventPayload: Omit<Partial<CalendarEvent>, 'id'> = {
    title: `Prezentacja · ${titleShort}`,
    startDate: start,
    endDate: end,
    location: displayLocation || undefined,
    notes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(Platform.OS === 'android' ? { alarms: androidAlarms } : {}),
    ...(landingUrl ? { url: landingUrl } : {}),
  };

  const previewPhones = (
    sameContactPreview
      ? [ownerPhoneResolved || peerPhone]
      : [ownerPhoneResolved, peerUserId > 0 ? peerPhone : null]
  )
    .filter(Boolean)
    .join(', ');
  const previewEmails = (
    sameContactPreview
      ? [ownerEmailResolved || peerEmailResolved]
      : [ownerEmailResolved, peerUserId > 0 ? peerEmailResolved : null]
  )
    .filter(Boolean)
    .join(', ');
  const previewBody = [
    whenLabel,
    displayLocation ? `\n📍 ${displayLocation}` : '',
    landingUrl ? `\n🔗 ${landingUrl}` : '',
    previewPhones ? `\n📞 ${previewPhones}` : '',
    previewEmails ? `\n✉️ ${previewEmails}` : '',
    Platform.OS === 'ios'
      ? '\n\nZapisz w Kalendarzu — adres jest dopasowany pod Mapy. Na iPhone możesz potem włączyć „Czas na wyjazd”, żeby powiadomienia uwzględniały dojazd i korki (patrz opis w wydarzeniu).'
      : `\n\nDodać spotkanie z przypomnieniami ${ANDROID_FIRST_REMINDER_MINUTES_BEFORE} min i ${ANDROID_SECOND_REMINDER_MINUTES_BEFORE} min przed startem?`,
  ].join('');

  Alert.alert('Termin prezentacji potwierdzony', previewBody, [
    {
      text: 'Nie teraz',
      style: 'cancel',
      onPress: () => {
        void markCalendarPromptHandled(params.dealId, params.proposedDateIso);
      },
    },
    {
      text: 'Dodaj do kalendarza',
      onPress: () => {
        void markCalendarPromptHandled(params.dealId, params.proposedDateIso);
        void savePresentationEventFlow(Calendar, eventPayload);
      },
    },
  ]);
}

async function savePresentationEventFlow(
  Calendar: ExpoCalendarModule,
  eventPayload: Omit<Partial<CalendarEvent>, 'id'>
): Promise<void> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Brak dostępu', 'Zezwól na kalendarz w ustawieniach systemu, aby zapisać prezentację.');
      return;
    }

    try {
      const dialogResult = await Calendar.createEventInCalendarAsync(eventPayload);
      if (dialogResult.action === 'saved' || dialogResult.action === 'done') {
        return;
      }
    } catch {
      /* fallback — bez natywnego arkusza */
    }

    const calendarId = await pickWritableCalendarId(Calendar);
    if (!calendarId) {
      Alert.alert('Kalendarz', 'Nie znaleziono zapisywalnego kalendarza na tym urządzeniu.');
      return;
    }

    await Calendar.createEventAsync(calendarId, eventPayload);
    Alert.alert(
      'Zapisano',
      Platform.OS === 'ios'
        ? 'W Kalendarzu otwórz to wydarzenie → Edytuj → Powiadomienia i włącz „Czas na wyjazd”, żeby iPhone uwzględniał dojazd i korki (Mapy).'
        : 'Spotkanie zostało dodane do kalendarza wraz z przypomnieniami.'
    );
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : 'Nie udało się zapisać wydarzenia.';
    Alert.alert('Kalendarz', msg);
  }
}
