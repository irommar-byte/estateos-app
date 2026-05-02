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

async function fetchPublicProfile(token: string, userId: number): Promise<any | null> {
  try {
    const res = await fetch(`${API_URL}/api/users/${userId}/public`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) return null;
    return data;
  } catch {
    return null;
  }
}

function extractPhoneFromPublicPayload(profile: any): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const u = profile.user || profile;
  const raw = firstDefined(
    u?.phone,
    u?.phoneNumber,
    u?.mobile,
    u?.mobilePhone,
    u?.tel,
    profile?.phone,
    profile?.metadata?.phone,
    profile?.profile?.phone
  );
  const s = String(raw ?? '').trim();
  return s || null;
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

function extractEmailFromPublicPayload(profile: any): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const u = profile.user || profile;
  const raw = firstDefined(
    u?.email,
    profile?.email,
    profile?.profile?.email,
    profile?.metadata?.email,
    u?.contactEmail
  );
  const s = String(raw ?? '').trim();
  if (!s || !s.includes('@')) return null;
  return s;
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

function buildContactSectionLines(params: {
  ownerHeading: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  peerHeading: string;
  peerPhone: string | null;
  peerEmail: string | null;
  peerUserId: number;
}): string[] {
  const lines: string[] = [];

  const person = (heading: string, phone: string | null, email: string | null) => {
    lines.push(`   ▸ ${heading}`);
    if (phone) {
      lines.push(`   Telefon    ${phone.trim()}`);
      const uri = toTelUri(phone);
      if (uri) lines.push(`              ${uri}`);
    }
    if (email) {
      lines.push(`   E-mail     ${email.trim()}`);
      lines.push(`              mailto:${email.trim()}`);
    }
    if (!phone && !email) {
      lines.push('   (brak telefonu i e-mailu w profilu publicznym / ogłoszeniu — sprawdź czat EstateOS™)');
    }
    lines.push('');
  };

  person(params.ownerHeading, params.ownerPhone, params.ownerEmail);
  if (params.peerUserId > 0) {
    person(params.peerHeading, params.peerPhone, params.peerEmail);
  }

  return lines;
}

function buildProfessionalCalendarNotes(input: {
  dealId: number | string;
  offerTitle: string | null;
  displayLocation: string;
  geoNote: boolean;
  landingUrl: string | null;
  mapsUrl: string | null;
  ownerLabel: string;
  ownerPhone: string | null;
  ownerEmail: string | null;
  peerLabel: string;
  peerPhone: string | null;
  peerEmail: string | null;
  peerUserId: number;
  tailBlocks: string[];
}): string {
  const rule = '══════════════════════════════════════';
  const out: string[] = [];
  out.push(rule);
  out.push(`  ESTATEOS™   ·   Dealroom TX-${input.dealId}`);
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
  if (input.geoNote) out.push('   Adres został dopasowany do map (geokodowanie).');
  out.push('');
  if (input.landingUrl) {
    out.push('▸ Wizytówka oferty (www)');
    out.push(`   ${input.landingUrl}`);
    out.push('   Zdjęcia, parametry, opis — ten sam link jest w polu „URL” wydarzenia na iPhone.');
    out.push('');
  }
  if (input.mapsUrl) {
    out.push('▸ Dojazd · Mapy');
    out.push(`   ${input.mapsUrl}`);
    out.push('');
  }
  out.push('▸ Kontakt');
  out.push('');
  out.push(
    ...buildContactSectionLines({
      ownerHeading: `Ogłoszenie / właściciel — ${input.ownerLabel}`,
      ownerPhone: input.ownerPhone,
      ownerEmail: input.ownerEmail,
      peerHeading: `Druga strona transakcji — ${input.peerLabel}`,
      peerPhone: input.peerPhone,
      peerEmail: input.peerEmail,
      peerUserId: input.peerUserId,
    })
  );
  for (const block of input.tailBlocks) {
    if (block.trim()) {
      out.push(block);
    }
  }
  return out.join('\n');
}

function formatPersonLabel(profile: any, fallbackId: number): string {
  const u = profile?.user || profile;
  const name = String(firstDefined(u?.fullName, u?.name, profile?.name, profile?.fullName) || '').trim();
  if (name) return name;
  return `Użytkownik #${fallbackId}`;
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

  const ownerProfile =
    ownerOfferUserId > 0 ? await fetchPublicProfile(params.token, ownerOfferUserId) : null;
  const peerProfile = peerUserId > 0 ? await fetchPublicProfile(params.token, peerUserId) : null;

  const ownerPhone = extractPhoneFromPublicPayload(ownerProfile);
  const peerPhone = extractPhoneFromPublicPayload(peerProfile);
  const ownerPhoneResolved = ownerPhone || extractPhoneFromOffer(offer);
  const ownerEmailResolved = extractEmailFromPublicPayload(ownerProfile) || extractEmailFromOffer(offer);
  const peerEmailResolved = peerUserId > 0 ? extractEmailFromPublicPayload(peerProfile) : null;
  const ownerLabel = formatPersonLabel(ownerProfile, ownerOfferUserId);
  const peerLabel = formatPersonLabel(peerProfile, peerUserId);

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
          '──────────────────────────────────────',
          ' iPhone · „Czas na wyjazd”',
          ' Po zapisaniu otwórz wydarzenie → Edytuj → Powiadomienia →',
          ' włącz „Czas na wyjazd” / Time to Leave oraz sposób dojazdu (Mapy).',
          ' Ustawienia → Kalendarz → Czas na wyjazd · dostęp do lokalizacji.',
        ].join('\n')
      : '';

  const androidTail =
    Platform.OS === 'android'
      ? [
          '',
          '──────────────────────────────────────',
          ` Przypomnienia w wydarzeniu: ${ANDROID_FIRST_REMINDER_MINUTES_BEFORE} min oraz ${ANDROID_SECOND_REMINDER_MINUTES_BEFORE} min przed startem.`,
        ].join('\n')
      : '';

  const notes = buildProfessionalCalendarNotes({
    dealId: params.dealId,
    offerTitle: offer?.title ? String(offer.title) : null,
    displayLocation,
    geoNote: refined.latitude != null,
    landingUrl,
    mapsUrl,
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
    ...(Platform.OS === 'ios' && landingUrl ? { url: landingUrl } : {}),
  };

  const previewPhones = [ownerPhoneResolved, peerUserId > 0 ? peerPhone : null].filter(Boolean).join(', ');
  const previewEmails = [ownerEmailResolved, peerUserId > 0 ? peerEmailResolved : null].filter(Boolean).join(', ');
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
