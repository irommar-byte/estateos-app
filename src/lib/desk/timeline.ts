export type DeskTimelineItem = {
  id: string;
  at: string;
  kind: string;
  title: string;
  body?: string | null;
  source: 'activity' | 'task' | 'deal' | 'system';
  offerId?: number | null;
  metadata?: unknown;
};

type ActivityLike = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId?: number | null;
  metadata?: unknown;
  createdAt: Date | string;
};

type TaskLike = {
  id: number;
  title: string;
  status: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  trigger?: string | null;
};

const KIND_LABELS: Record<string, string> = {
  DESK_PROSPECT: 'Prospect',
  DESK_CALL: 'Telefon',
  DESK_MEETING: 'Spotkanie',
  DESK_CONTRACT: 'Umowa',
  DESK_LISTING: 'Oferta',
  DESK_PRICE_CHANGE: 'Zmiana ceny',
  DESK_DEBRIEF: 'Debrief',
  DESK_OPEN_HOUSE: 'Open House',
  DESK_BID: 'Oferta cenowa',
  DESK_DEAL: 'Deal',
  DESK_STAGE: 'Etap',
  DESK_NOTE: 'Notatka',
  ACQUISITION_MEETING: 'Pozysk — termin',
  PRESENTATION_PROPOSED: 'Prezentacja',
  PRESENTATION_CONFIRMED: 'Prezentacja',
  PORTAL_MESSAGE: 'Portal',
  EXTERNAL_PORTAL: 'Portal zewnętrzny',
  MARKET_REPORT_SENT: 'Raport rynkowy',
  PRICE_HISTORY: 'Zmiana ceny',
  OFFER_VIEWS: 'Wyświetlenia',
  MATCHING: 'Matching',
  DEAL_ROOM: 'Deal Room',
  DEAL_MESSAGE: 'Deal Room',
  BID: 'Oferta cenowa',
  OPEN_HOUSE: 'Open House',
  OH_GUEST: 'Gość OH',
  AUCTION: 'Aukcja',
  AUCTION_BID: 'Licytacja',
  TASK: 'Zadanie',
  TASK_DONE: 'Zadanie ukończone',
  DESK_CHECKLIST: 'Checklist',
};

export function timelineKindLabel(kind: string): string {
  return KIND_LABELS[kind] || kind.replace(/_/g, ' ');
}

export function labelDeskActivityKind(kind: string) {
  return KIND_LABELS[kind] || kind.replace(/_/g, ' ');
}

export function buildDeskTimeline(params: {
  activities: ActivityLike[];
  tasks?: TaskLike[];
}): DeskTimelineItem[] {
  const items: DeskTimelineItem[] = [];

  for (const a of params.activities) {
    items.push({
      id: `act-${a.id}`,
      at: typeof a.createdAt === 'string' ? a.createdAt : a.createdAt.toISOString(),
      kind: a.kind,
      title: a.title || labelDeskActivityKind(a.kind),
      body: a.body,
      source: 'activity',
      offerId: a.offerId ?? null,
      metadata: a.metadata,
    });
  }

  for (const t of params.tasks || []) {
    const at = t.completedAt || t.dueAt || t.createdAt;
    items.push({
      id: `task-${t.id}`,
      at: typeof at === 'string' ? at : at.toISOString(),
      kind: t.status === 'DONE' ? 'TASK_DONE' : 'TASK',
      title: t.title,
      body: t.trigger ? `Trigger: ${t.trigger}` : null,
      source: 'task',
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items;
}

export function contractDaysRemaining(contractEndsAt: Date | string | null | undefined) {
  if (!contractEndsAt) return null;
  const end = typeof contractEndsAt === 'string' ? new Date(contractEndsAt) : contractEndsAt;
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
