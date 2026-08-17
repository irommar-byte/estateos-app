/** Pomocniki kalendarza prezentacji w CRM. */

export type PlanningAppointment = {
  id: number;
  dealId: number;
  offerId?: number;
  buyerId?: number;
  sellerId?: number;
  proposedById: number;
  proposedDate: string | Date;
  status: string;
  message?: string | null;
  type?: string | null;
  clientId?: number | null;
  source?: 'appointment' | 'acquisition' | 'presentation' | null;
  offer?: {
    id?: number;
    title?: string | null;
    street?: string | null;
    city?: string | null;
    district?: string | null;
    apartmentNumber?: string | null;
    price?: number | null;
    imageUrl?: string | null;
  } | null;
  counterparty?: {
    id?: number;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    image?: string | null;
  } | null;
  proposedBy?: { id?: number; name?: string | null; email?: string | null } | null;
  deal?: { buyerId?: number; sellerId?: number; offer?: PlanningAppointment['offer'] } | null;
};

export function normalizeAppointmentStatus(raw: unknown): string {
  return String(raw || '').toUpperCase();
}

export function isAppointmentAccepted(status: unknown): boolean {
  return normalizeAppointmentStatus(status) === 'ACCEPTED';
}

export function isAppointmentPending(status: unknown): boolean {
  return normalizeAppointmentStatus(status) === 'PENDING';
}

/** Żółta lampka — propozycja czeka na akceptację (od drugiej strony). */
export function appointmentNeedsMyResponse(app: PlanningAppointment, myUserId: number): boolean {
  if (!isAppointmentPending(app.status)) return false;
  return Number(app.proposedById) !== Number(myUserId);
}

/** Oczekiwanie na kontrahenta po własnej propozycji. */
export function appointmentWaitingOnOther(app: PlanningAppointment, myUserId: number): boolean {
  if (!isAppointmentPending(app.status)) return false;
  return Number(app.proposedById) === Number(myUserId);
}

export function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );
}

export function appointmentsOnDay(appointments: PlanningAppointment[], day: Date): PlanningAppointment[] {
  return appointments.filter((app) => {
    const d = new Date(app.proposedDate);
    return !Number.isNaN(d.getTime()) && isSameCalendarDay(d, day);
  });
}

export function dayIndicators(apps: PlanningAppointment[], myUserId: number) {
  const hasAccepted = apps.some((a) => isAppointmentAccepted(a.status) && a.type !== 'ACQUISITION');
  const hasPendingNegotiation = apps.some((a) => appointmentNeedsMyResponse(a, myUserId));
  const hasWaitingMine = apps.some((a) => appointmentWaitingOnOther(a, myUserId));
  const hasAcquisition = apps.some((a) => String(a.type || '').toUpperCase() === 'ACQUISITION');
  return { hasAccepted, hasPendingNegotiation, hasWaitingMine, hasAcquisition };
}

export function acquisitionActivityToAppointment(row: {
  id: number;
  kind?: string | null;
  title: string | null;
  body: string | null;
  metadata: unknown;
  client?: { id: number; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null;
  agencyUserId: number;
}): PlanningAppointment | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const startsAt = typeof meta.startsAt === 'string' ? meta.startsAt : null;
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return null;
  const name = row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : 'Klient';
  const location = typeof meta.location === 'string' ? meta.location : '';
  const kind = String(row.kind || '');
  const isPresentation = kind.startsWith('PRESENTATION');
  const pending = kind.includes('CHANGE_PROPOSED') || (kind === 'PRESENTATION_PROPOSED' && meta.status !== 'confirmed');
  return {
    id: -Number(row.id),
    dealId: 0,
    proposedById: row.agencyUserId,
    proposedDate: startsAt,
    status: pending ? 'PENDING' : 'ACCEPTED',
    type: isPresentation ? 'PRESENTATION' : 'ACQUISITION',
    source: isPresentation ? 'presentation' : 'acquisition',
    clientId: row.client?.id ?? null,
    message: typeof meta.reason === 'string' && meta.reason ? meta.reason : row.body,
    offer: {
      title: row.title || `${isPresentation ? 'Prezentacja' : 'Pozyskanie'} · ${name}`,
      street: location || String(row.body || ''),
      city: '',
    },
    counterparty: row.client
      ? {
          id: row.client.id,
          name,
          email: row.client.email || null,
          phone: row.client.phone || null,
        }
      : null,
  };
}

/** Poniedziałek jako pierwszy dzień tygodnia (PL). */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  const dow = start.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + mondayOffset);

  const end = new Date(last);
  const endDow = end.getDay();
  const sundayOffset = endDow === 0 ? 0 : 7 - endDow;
  end.setDate(end.getDate() + sundayOffset);

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function formatOfferAddress(offer: PlanningAppointment['offer']): string {
  if (!offer) return '';
  const parts = [offer.street, offer.district, offer.city].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return String(offer.title || '').trim();
}

export function resolveAppointmentCounterparty(
  app: PlanningAppointment,
  myUserId: number,
  contacts: Array<{ id?: number; name?: string; email?: string; phone?: string; image?: string }>
) {
  if (app.counterparty?.id) return app.counterparty;
  const buyerId = Number(app.buyerId ?? app.deal?.buyerId ?? 0);
  const sellerId = Number(app.sellerId ?? app.deal?.sellerId ?? 0);
  const counterId = buyerId === myUserId ? sellerId : sellerId === myUserId ? buyerId : 0;
  if (counterId > 0) {
    const fromContacts = contacts.find((c) => Number(c.id) === counterId);
    if (fromContacts) return fromContacts;
  }
  if (Number(app.proposedById) !== myUserId && app.proposedBy) {
    return {
      id: app.proposedBy.id,
      name: app.proposedBy.name,
      email: app.proposedBy.email,
    };
  }
  return null;
}

export function enrichAppointmentForUi(
  app: PlanningAppointment,
  myUserId: number,
  contacts: Array<{ id?: number; name?: string; email?: string; phone?: string; image?: string }>
): PlanningAppointment & {
  offerId: number;
  offerTitle: string;
  offerAddress: string;
  offerImageUrl: string | null;
  counterpartyDisplay: ReturnType<typeof resolveAppointmentCounterparty>;
  needsMyResponse: boolean;
  waitingOnOther: boolean;
} {
  const offer = app.offer || app.deal?.offer || null;
  const offerId = Number(app.offerId ?? offer?.id ?? app.deal?.offer?.id ?? 0);
  return {
    ...app,
    offerId,
    offer: offer || undefined,
    offerTitle: String(offer?.title || `Oferta #${offerId || '—'}`),
    offerAddress: formatOfferAddress(offer),
    offerImageUrl: offer?.imageUrl || null,
    counterpartyDisplay: resolveAppointmentCounterparty(app, myUserId, contacts),
    needsMyResponse: appointmentNeedsMyResponse(app, myUserId),
    waitingOnOther: appointmentWaitingOnOther(app, myUserId),
  };
}
