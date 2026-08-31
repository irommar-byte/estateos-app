export const CLIENT_PREP_ITEMS = [
  { id: 'photo_ready', label: 'Przygotować mieszkanie do sesji zdjęciowej' },
  { id: 'ownership_deed', label: 'Podstawa nabycia / akt notarialny' },
  { id: 'id_docs', label: 'Dowód tożsamości właściciela / właścicieli' },
  { id: 'land_register', label: 'Numer księgi wieczystej lub wydruk KW' },
  { id: 'admin_fees', label: 'Ostatni wymiar opłat administracyjnych' },
  { id: 'utilities', label: 'Rachunki lub informacje o kosztach mediów' },
  { id: 'mortgage', label: 'Zaświadczenie banku o saldzie kredytu (jeśli dotyczy)' },
  { id: 'energy', label: 'Świadectwo charakterystyki energetycznej' },
  { id: 'keys_access', label: 'Zapewnić dostęp i klucze na spotkanie' },
  { id: 'parking_docs', label: 'Dokumenty garażu / miejsca postojowego / komórki' },
] as const;

export type ClientPrepItemId = (typeof CLIENT_PREP_ITEMS)[number]['id'];

export const PROPERTY_AMENITIES = [
  { id: 'garage', label: 'Garaż' },
  { id: 'parkingSpot', label: 'Miejsce postojowe' },
  { id: 'storageUnit', label: 'Komórka lokatorska' },
  { id: 'basement', label: 'Piwnica' },
  { id: 'balcony', label: 'Balkon' },
  { id: 'terrace', label: 'Taras' },
  { id: 'garden', label: 'Ogródek' },
  { id: 'elevator', label: 'Winda' },
] as const;

export type PropertyAmenityId = (typeof PROPERTY_AMENITIES)[number]['id'];

export type PropertyAmenities = Record<PropertyAmenityId, boolean>;

export const JOURNEY_ACTIVITY = {
  MEETING: 'ACQUISITION_MEETING',
  MEETING_CHANGE: 'MEETING_CHANGE_PROPOSED',
  MEETING_CONFIRMED: 'MEETING_CONFIRMED',
  PRESENTATION: 'PRESENTATION_PROPOSED',
  PRESENTATION_CHANGE: 'PRESENTATION_CHANGE_PROPOSED',
  PRESENTATION_CONFIRMED: 'PRESENTATION_CONFIRMED',
  PORTAL_MESSAGE: 'PORTAL_MESSAGE',
} as const;

export type JourneyActivityKind = (typeof JOURNEY_ACTIVITY)[keyof typeof JOURNEY_ACTIVITY];

export type ScheduleActor = 'agent' | 'client';

export type ScheduleSlot = {
  startsAt: string;
  location: string | null;
  notes: string | null;
  status: 'confirmed' | 'pending';
  proposedBy: ScheduleActor;
  reason: string | null;
  previousStartsAt: string | null;
  prepItems: ClientPrepItemId[];
};

export type JourneyStageId =
  | 'added'
  | 'meeting'
  | 'visit'
  | 'signed'
  | 'offer'
  | 'presentation'
  | 'criteria'
  | 'proposals'
  | 'reaction'
  | 'done';

export type JourneyStage = {
  id: JourneyStageId;
  label: string;
  done: boolean;
  current: boolean;
  hint?: string;
  at?: string | null;
};

export type PortalAttachment = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

export type PortalChatMessage = {
  id: number;
  content: string;
  createdAt: string;
  fromAgent: boolean;
  fromMe: boolean;
  attachments: PortalAttachment[];
  checkbackQuickReplies?: {
    activityId: number;
    options: Array<{ id: string; label: string }>;
  };
};

export type ActivityLike = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: Date | string;
  metadata?: unknown;
};

export function emptyPropertyAmenities(): PropertyAmenities {
  return {
    garage: false,
    parkingSpot: false,
    storageUnit: false,
    basement: false,
    balcony: false,
    terrace: false,
    garden: false,
    elevator: false,
  };
}

export function normalizePrepItemIds(raw: unknown): ClientPrepItemId[] {
  const allowed = new Set(CLIENT_PREP_ITEMS.map((item) => item.id));
  if (!Array.isArray(raw)) return [];
  const seen = new Set<ClientPrepItemId>();
  for (const value of raw) {
    const id = String(value) as ClientPrepItemId;
    if (allowed.has(id)) seen.add(id);
  }
  return [...seen];
}

export function prepItemLabels(ids: string[]): string[] {
  const map = new Map(CLIENT_PREP_ITEMS.map((item) => [item.id, item.label]));
  return ids.map((id) => map.get(id as ClientPrepItemId) || id);
}

export function parseAmenities(raw: unknown): PropertyAmenities {
  const base = emptyPropertyAmenities();
  if (!raw) return base;
  if (typeof raw === 'string') {
    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
    for (const item of PROPERTY_AMENITIES) {
      if (parts.includes(item.id) || parts.includes(item.label)) base[item.id] = true;
    }
    return base;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const item of PROPERTY_AMENITIES) {
      base[item.id] = Boolean(obj[item.id]);
    }
  }
  return base;
}

export function amenitiesSummary(amenities: Partial<PropertyAmenities> | string | null | undefined): string {
  const parsed = typeof amenities === 'string' || !amenities ? parseAmenities(amenities) : amenities;
  return PROPERTY_AMENITIES.filter((item) => Boolean(parsed[item.id])).map((item) => item.label).join(', ');
}

export function selectedAmenityIds(amenities: PropertyAmenities): PropertyAmenityId[] {
  return PROPERTY_AMENITIES.filter((item) => amenities[item.id]).map((item) => item.id);
}

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function parseIso(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : new Date(raw).toISOString();
}

function parseActor(raw: unknown, fallback: ScheduleActor): ScheduleActor {
  return raw === 'client' || raw === 'agent' ? raw : fallback;
}

export function parseAttachments(raw: unknown): PortalAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const url = String(row.url || '').trim();
      if (!url) return null;
      return {
        url,
        name: String(row.name || 'załącznik').slice(0, 180),
        mimeType: String(row.mimeType || 'application/octet-stream'),
        size: Number(row.size) || 0,
      };
    })
    .filter((item): item is PortalAttachment => Boolean(item));
}

function slotFromMeta(meta: Record<string, unknown>, fallback: Partial<ScheduleSlot>): ScheduleSlot | null {
  const startsAt = parseIso(meta.startsAt);
  if (!startsAt) return null;
  return {
    startsAt,
    location: meta.location ? String(meta.location) : fallback.location || null,
    notes: meta.notes ? String(meta.notes) : fallback.notes || null,
    status: meta.status === 'pending' ? 'pending' : fallback.status || 'confirmed',
    proposedBy: parseActor(meta.proposedBy, fallback.proposedBy || 'agent'),
    reason: meta.reason ? String(meta.reason) : null,
    previousStartsAt: parseIso(meta.previousStartsAt),
    prepItems: normalizePrepItemIds(meta.prepItems ?? fallback.prepItems),
  };
}

function slotBits(slot: ScheduleSlot | null) {
  if (!slot) {
    return { startsAt: null as string | null, prepItems: [] as ClientPrepItemId[], location: null as string | null };
  }
  return { startsAt: slot.startsAt, prepItems: slot.prepItems, location: slot.location };
}

export function resolveSchedule(
  activities: ActivityLike[],
  kinds: { seed: string; change: string; confirmed: string },
): ScheduleSlot | null {
  const relevant = activities
    .filter((row) => [kinds.seed, kinds.change, kinds.confirmed].includes(row.kind))
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let current: ScheduleSlot | null = null;
  for (const row of relevant) {
    const meta = asMeta(row.metadata);
    const next = slotFromMeta(meta, current || {});
    if (!next) continue;
    const prev = slotBits(current);
    if (row.kind === kinds.seed) {
      current = { ...next, status: 'confirmed', proposedBy: parseActor(meta.proposedBy, 'agent') };
    } else if (row.kind === kinds.change) {
      current = {
        ...next,
        status: 'pending',
        proposedBy: parseActor(meta.proposedBy, 'client'),
        previousStartsAt: next.previousStartsAt || prev.startsAt,
        prepItems: next.prepItems.length ? next.prepItems : prev.prepItems,
        location: next.location || prev.location,
      };
    } else if (row.kind === kinds.confirmed) {
      current = {
        ...next,
        status: 'confirmed',
        reason: null,
        previousStartsAt: null,
        prepItems: next.prepItems.length ? next.prepItems : prev.prepItems,
        location: next.location || prev.location,
      };
    }
  }
  return current;
}

export function resolveMeeting(activities: ActivityLike[]): ScheduleSlot | null {
  return resolveSchedule(activities, {
    seed: JOURNEY_ACTIVITY.MEETING,
    change: JOURNEY_ACTIVITY.MEETING_CHANGE,
    confirmed: JOURNEY_ACTIVITY.MEETING_CONFIRMED,
  });
}

export function resolvePresentation(activities: ActivityLike[]): ScheduleSlot | null {
  return resolveSchedule(activities, {
    seed: JOURNEY_ACTIVITY.PRESENTATION,
    change: JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
    confirmed: JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
  });
}

export function buildJourneyStages(params: {
  hasMeeting: boolean;
  meetingConfirmed: boolean;
  acquisitionStarted: boolean;
  signed: boolean;
  hasOffer: boolean;
  hasPresentation: boolean;
  presentationConfirmed: boolean;
  clientType?: 'BUYER' | 'SELLER';
  hasCriteria?: boolean;
  sentOfferCount?: number;
  reactedCount?: number;
  criteriaUpdatedAt?: string | null;
  lastOfferSentAt?: string | null;
  lastReactionAt?: string | null;
  listingSold?: boolean;
}): JourneyStage[] {
  const stages: Array<{ id: JourneyStageId; label: string; done: boolean; hint?: string; at?: string | null }> =
    params.clientType === 'BUYER'
      ? [
          {
            id: 'added',
            label: 'Jesteś z nami',
            done: true,
            hint: 'Agent prowadzi Twój proces poszukiwań krok po kroku.',
          },
          {
            id: 'criteria',
            label: 'Kryteria poszukiwań',
            done: Boolean(params.hasCriteria),
            hint: 'Tu widać dzielnice, budżet i to, co jest obowiązkowe. Jeśli coś zmienimy — pojawi się data.',
            at: params.criteriaUpdatedAt || null,
          },
          {
            id: 'proposals',
            label: 'Oferty od agenta',
            done: (params.sentOfferCount || 0) > 0,
            hint: 'Otwórz zdjęcie albo tytuł, obejrzyj ogłoszenie i oceń każdą propozycję osobno.',
            at: params.lastOfferSentAt || null,
          },
          {
            id: 'reaction',
            label: 'Twoja odpowiedź',
            done: (params.reactedCount || 0) > 0 && (params.reactedCount || 0) >= (params.sentOfferCount || 0),
            hint: 'Przy każdej ofercie napisz, co konkretnie się podoba, a co nie. Agent widzi to przy tym samym ogłoszeniu.',
            at: params.lastReactionAt || null,
          },
          {
            id: 'presentation',
            label: 'Prezentacja na żywo',
            done: params.hasPresentation && params.presentationConfirmed,
            hint: params.hasPresentation
              ? 'Termin prezentacji jest ustalony. Szczegóły znajdziesz poniżej.'
              : 'Gdy któraś oferta naprawdę pasuje, agent umówi prezentację.',
          },
          {
            id: 'done',
            label: 'Blisko mety',
            done: params.hasPresentation && params.presentationConfirmed,
            hint: 'Jesteśmy w procesie sprzedaży: kryteria → oferty → Twoja opinia → prezentacja.',
          },
        ]
      : [
          {
            id: 'meeting',
            label: 'Umówienie spotkania',
            done: params.hasMeeting,
            hint: 'Termin jest ustalony. Poniżej data i lista rzeczy do przygotowania na wizytę.',
          },
          {
            id: 'visit',
            label: 'Umowa',
            done: params.signed,
            hint: 'Umowa pośrednictwa i ustalenia ze spotkania. Podpisaną kopię dostajesz na e-mail.',
          },
          {
            id: 'offer',
            label: 'Ogłoszenie',
            done: params.hasOffer,
            hint: 'Przygotowanie i publikacja ogłoszenia na rynku — to jeszcze nie transakcja sprzedaży.',
          },
          {
            id: 'presentation',
            label: 'Prezentacje',
            done: params.hasPresentation && params.presentationConfirmed,
            hint: 'Pokazywanie nieruchomości kupującym. Termin prezentacji widać poniżej, gdy jest ustalony.',
          },
          {
            id: 'done',
            label: 'Transakcja',
            done: Boolean(params.listingSold),
            hint: 'Akt notarialny i przekazanie kluczy — dopiero przy finalizacji sprzedaży.',
          },
        ];
  const firstOpen = stages.findIndex((stage) => !stage.done);
  return stages.map((stage, index) => ({
    ...stage,
    current: firstOpen === -1 ? index === stages.length - 1 : index === firstOpen,
  }));
}

function resolvePortalMessageFrom(
  meta: Record<string, unknown>,
  title: string | null | undefined,
): 'agent' | 'client' {
  const from = String(meta.from || '').toLowerCase();
  if (from === 'agent') return 'agent';
  if (from === 'client') return 'client';

  const t = String(title || '').toLowerCase();
  if (t.includes('od klienta')) return 'client';
  if (t.includes('do klienta')) return 'agent';

  if (meta.fromAgent === true) return 'agent';
  if (meta.fromAgent === false) return 'client';

  return 'client';
}

export function parsePortalMessages(
  activities: ActivityLike[],
  viewer: 'client' | 'agent',
): PortalChatMessage[] {
  return activities
    .filter((row) => row.kind === JOURNEY_ACTIVITY.PORTAL_MESSAGE)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((row) => {
      const meta = asMeta(row.metadata);
      const from = resolvePortalMessageFrom(meta, row.title);
      const fromAgent = from === 'agent';
      return {
        id: row.id,
        content: String(meta.content || row.body || ''),
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString(),
        fromAgent,
        fromMe: viewer === 'agent' ? fromAgent : !fromAgent,
        attachments: parseAttachments(meta.attachments),
        checkbackQuickReplies:
          meta.checkbackQuickReplies &&
          typeof meta.checkbackQuickReplies === 'object' &&
          !Array.isArray(meta.checkbackQuickReplies)
            ? (meta.checkbackQuickReplies as PortalChatMessage['checkbackQuickReplies'])
            : undefined,
      };
    });
}

export function parseStartsAtInput(raw: unknown): Date | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
