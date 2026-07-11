import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import type { Alarm as CalendarAlarm } from 'expo-calendar';
import type { Event as CalendarEvent } from 'expo-calendar';
import {
  photoSessionPaymentAdminHint,
  photoSessionPaymentLabel,
} from './photoSessionBilling';

const CALENDAR_PROMPT_STORAGE_PREFIX = '@estateos_photo_session_calendar_v1';

type ExpoCalendarModule = typeof import('expo-calendar');

export type PhotoSessionCalendarParams = {
  requestId: number;
  proposedAtIso: string;
  propertyLabel?: string | null;
  propertyType?: string | null;
  transactionType?: string | null;
  isProFree: boolean;
  note?: string | null;
  adminNote?: string | null;
  requesterName?: string | null;
  requesterPhone?: string | null;
  requesterEmail?: string | null;
  viewerRole: 'user' | 'admin';
};

function calendarPromptStorageKey(requestId: number, proposedAtIso: string): string {
  return `${CALENDAR_PROMPT_STORAGE_PREFIX}:${requestId}:${proposedAtIso}`;
}

async function markCalendarPromptHandled(requestId: number, proposedAtIso: string): Promise<void> {
  try {
    await AsyncStorage.setItem(calendarPromptStorageKey(requestId, proposedAtIso), '1');
  } catch {
    // noop
  }
}

async function wasCalendarPromptHandled(requestId: number, proposedAtIso: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(calendarPromptStorageKey(requestId, proposedAtIso));
    return v === '1';
  } catch {
    return false;
  }
}

function loadExpoCalendar(): ExpoCalendarModule | null {
  try {
    return require('expo-calendar') as ExpoCalendarModule;
  } catch {
    return null;
  }
}

async function pickWritableCalendarId(Cal: ExpoCalendarModule): Promise<string | null> {
  const calendars = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  const writable =
    calendars.find((c) => c.allowsModifications && c.accessLevel === Cal.CalendarAccessLevel.OWNER) ||
    calendars.find((c) => c.allowsModifications) ||
    calendars[0];
  return writable?.id ?? null;
}

function formatWhenLong(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buildMapsUrl(location: string): string | null {
  const q = location.trim();
  if (!q) return null;
  return `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
}

function buildCalendarNotes(params: PhotoSessionCalendarParams, whenLabel: string): string {
  const rule = '────────────────────────────────────────';
  const location = String(params.propertyLabel || '').trim() || 'Adres uzupełnisz przed wizytą w aplikacji / u klienta';
  const payment = photoSessionPaymentLabel(params.isProFree);
  const mapsUrl = buildMapsUrl(location);

  const lines: string[] = [];
  lines.push(rule);
  lines.push(`  ESTATEOS™ STUDIO  ·  Sesja #${params.requestId}`);
  lines.push(rule);
  lines.push('');
  lines.push('SESJA ZDJĘCIOWA NIERUCHOMOŚCI');
  lines.push('Termin potwierdzony w aplikacji EstateOS.');
  lines.push('');
  lines.push('▸ Kiedy');
  lines.push(`   ${whenLabel}`);
  lines.push('');
  lines.push('▸ Gdzie (nieruchomość)');
  lines.push(`   ${location}`);
  if (params.propertyType || params.transactionType) {
    lines.push('');
    lines.push('▸ Typ ogłoszenia');
    if (params.propertyType) lines.push(`   · ${params.propertyType}`);
    if (params.transactionType) lines.push(`   · ${params.transactionType}`);
  }
  lines.push('');
  lines.push('▸ Rozliczenie');
  lines.push(`   ${payment}`);
  if (params.viewerRole === 'admin') {
    lines.push(`   ${photoSessionPaymentAdminHint(params.isProFree)}`);
  }
  lines.push('');

  if (params.viewerRole === 'admin') {
    lines.push('▸ Kontakt klienta');
    lines.push(`   ${params.requesterName?.trim() || '—'}`);
    if (params.requesterPhone?.trim()) lines.push(`   Tel: ${params.requesterPhone.trim()}`);
    if (params.requesterEmail?.trim()) lines.push(`   E-mail: ${params.requesterEmail.trim()}`);
    lines.push('');
  } else {
    lines.push('▸ Przed wizytą');
    lines.push('   · Przygotuj dostęp do wszystkich pomieszczeń');
    lines.push('   · Posprzątaj i odsłoń okna');
    lines.push('   · Zabierz klucze / zapewnij obecność osoby upoważnionej');
    lines.push('   · Zespół EstateOS Studio kontaktuje się przed terminem');
    lines.push('');
  }

  if (params.note?.trim()) {
    lines.push('▸ Notatka klienta');
    lines.push(`   ${params.note.trim()}`);
    lines.push('');
  }
  if (params.adminNote?.trim()) {
    lines.push('▸ Uwagi administratora');
    lines.push(`   ${params.adminNote.trim()}`);
    lines.push('');
  }

  if (mapsUrl) {
    lines.push('▸ Dojazd (Mapy)');
    lines.push(`   ${mapsUrl}`);
    lines.push('');
  }

  lines.push('▸ Aplikacja');
  lines.push('   estateos://profil → Sesje zdjęciowe');
  return lines.join('\n');
}

async function saveEvent(Calendar: ExpoCalendarModule, payload: Omit<Partial<CalendarEvent>, 'id'>) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Brak dostępu', 'Zezwól na kalendarz w ustawieniach, aby zapisać sesję zdjęciową.');
    return;
  }
  try {
    const dialogResult = await Calendar.createEventInCalendarAsync(payload);
    if (dialogResult.action === 'saved' || dialogResult.action === 'done') return;
  } catch {
    /* fallback */
  }
  const calendarId = await pickWritableCalendarId(Calendar);
  if (!calendarId) {
    Alert.alert('Kalendarz', 'Nie znaleziono zapisywalnego kalendarza.');
    return;
  }
  await Calendar.createEventAsync(calendarId, payload);
}

/** Po akceptacji terminu — od razu proponuje zapis do kalendarza z pełnymi danymi. */
export async function offerPhotoSessionCalendarAfterAcceptance(
  params: PhotoSessionCalendarParams,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!params.requestId || !params.proposedAtIso) return;

  if (await wasCalendarPromptHandled(params.requestId, params.proposedAtIso)) {
    return;
  }

  const Calendar = loadExpoCalendar();
  if (!Calendar) return;

  const available = await Calendar.isAvailableAsync().catch(() => false);
  if (!available) return;

  const start = new Date(params.proposedAtIso);
  if (Number.isNaN(start.getTime())) return;

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const whenLabel = formatWhenLong(params.proposedAtIso);
  const location = String(params.propertyLabel || '').trim();
  const titleBase = location.split('·')[0]?.trim() || location || 'Nieruchomość';
  const title =
    params.viewerRole === 'admin'
      ? `EstateOS Studio · ${titleBase} · ${params.requesterName || 'Klient'}`
      : `EstateOS Studio · Sesja zdjęciowa · ${titleBase}`;

  const notes = buildCalendarNotes(params, whenLabel);
  const mapsUrl = buildMapsUrl(location);

  const androidAlarms: CalendarAlarm[] = [
    { relativeOffset: -24 * 60, method: Calendar.AlarmMethod.ALERT },
    { relativeOffset: -60, method: Calendar.AlarmMethod.ALERT },
  ];

  const eventPayload: Omit<Partial<CalendarEvent>, 'id'> = {
    title,
    startDate: start,
    endDate: end,
    location: location || undefined,
    notes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: Platform.OS === 'android' ? androidAlarms : undefined,
  };

  const paymentShort = params.isProFree ? 'GRATIS (Investor Pro)' : '199 zł';

  Alert.alert(
    'Termin potwierdzony',
    `${whenLabel}\n\n📍 ${location || 'Lokalizacja w notatce'}\n💳 ${paymentShort}\n\nDodać sesję do kalendarza?`,
    [
      {
        text: 'Nie teraz',
        style: 'cancel',
        onPress: () => {
          void markCalendarPromptHandled(params.requestId, params.proposedAtIso);
        },
      },
      ...(mapsUrl
        ? [
            {
              text: 'Mapy',
              onPress: () => {
                void Linking.openURL(mapsUrl);
              },
            },
          ]
        : []),
      {
        text: 'Dodaj do kalendarza',
        onPress: () => {
          void markCalendarPromptHandled(params.requestId, params.proposedAtIso);
          void saveEvent(Calendar, eventPayload);
        },
      },
    ],
  );
}

export function photoSessionCalendarParamsFromItem(
  item: {
    id: number;
    proposedAt: string;
    propertyLabel?: string | null;
    propertyType?: string | null;
    transactionType?: string | null;
    isProFree: boolean;
    note?: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    requesterEmail?: string | null;
  },
  viewerRole: 'user' | 'admin',
  extra?: { adminNote?: string | null },
): PhotoSessionCalendarParams {
  return {
    requestId: item.id,
    proposedAtIso: item.proposedAt,
    propertyLabel: item.propertyLabel,
    propertyType: item.propertyType,
    transactionType: item.transactionType,
    isProFree: item.isProFree,
    note: item.note,
    adminNote: extra?.adminNote ?? null,
    requesterName: item.requesterName,
    requesterPhone: item.requesterPhone,
    requesterEmail: item.requesterEmail,
    viewerRole,
  };
}
