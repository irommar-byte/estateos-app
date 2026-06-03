import { Alert, Platform } from 'react-native';
import type { Event as CalendarEvent } from 'expo-calendar';
import { formatOfferLocationForCalendar } from './presentationCalendar';

type ExpoCalendarModule = typeof import('expo-calendar');

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

async function saveEvent(Calendar: ExpoCalendarModule, payload: Omit<Partial<CalendarEvent>, 'id'>) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Brak dostępu', 'Zezwól na kalendarz w ustawieniach, aby zapisać wizytę.');
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

export type OpenHouseCalendarParams = {
  eventTitle: string;
  offer: {
    title?: string | null;
    city?: string | null;
    district?: string | null;
    street?: string | null;
  };
  startsAt: string;
  endsAt: string;
};

export async function offerOpenHouseCalendarAfterReserve(params: OpenHouseCalendarParams): Promise<void> {
  if (Platform.OS === 'web') return;

  const Calendar = loadExpoCalendar();
  if (!Calendar) return;

  const available = await Calendar.isAvailableAsync().catch(() => false);
  if (!available) return;

  const start = new Date(params.startsAt);
  const end = new Date(params.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  const location = formatOfferLocationForCalendar({
    title: params.offer.title,
    city: params.offer.city,
    district: params.offer.district,
    street: params.offer.street,
  });

  const whenLabel = start.toLocaleString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const eventPayload: Omit<Partial<CalendarEvent>, 'id'> = {
    title: `Dzień otwarty · ${params.eventTitle || params.offer.title || 'Nieruchomość'}`,
    startDate: start,
    endDate: end,
    location: location || undefined,
    notes: `Rezerwacja wizyty w EstateOS.\n${whenLabel}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  Alert.alert('Termin zarezerwowany', `Dodać wizytę do kalendarza?\n\n${whenLabel}${location ? `\n📍 ${location}` : ''}`, [
    { text: 'Nie teraz', style: 'cancel' },
    {
      text: 'Dodaj do kalendarza',
      onPress: () => {
        void saveEvent(Calendar, eventPayload);
      },
    },
  ]);
}
