import { prisma } from '@/lib/prisma';

/**
 * Dziennik zespołu: każda akcja agenta zapisana na serwerze z godziną.
 * Kierownik biura widzi, co który agent danego dnia zrobił.
 * Zapis nigdy nie blokuje akcji — błąd dziennika jest tylko logowany.
 */
export type TeamEventInput = {
  userId: number;
  kind: string;
  title: string;
  body?: string | null;
  refType?: string | null;
  refId?: number | null;
};

async function companyIdFor(userId: number): Promise<number | null> {
  const member = await prisma.agencyCompanyMember.findUnique({ where: { userId }, select: { companyId: true } });
  if (member?.companyId) return member.companyId;
  const owned = await prisma.agencyCompany.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
  return owned?.id ?? null;
}

export async function logTeamEvent(event: TeamEventInput): Promise<void> {
  try {
    const companyId = await companyIdFor(event.userId);
    if (!companyId) return;
    await prisma.$executeRawUnsafe(
      `INSERT INTO AgencyTeamEvent (companyId, userId, kind, title, body, refType, refId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      companyId,
      event.userId,
      event.kind.slice(0, 48),
      event.title.slice(0, 255),
      event.body ? event.body.slice(0, 4000) : null,
      event.refType ?? null,
      event.refId ?? null,
    );
  } catch (error) {
    console.warn('[teamLog] skip', error instanceof Error ? error.message : error);
  }
}

/** Akcja na ogłoszeniu — tytuł ogłoszenia trafia do treści wpisu; bez podanego agenta wpis dostaje właściciel oferty. */
export async function logOfferEvent(params: { offerId: number; userId?: number | null; kind: string; title: string }): Promise<void> {
  try {
    const offer = await prisma.offer.findUnique({ where: { id: params.offerId }, select: { userId: true, title: true } });
    const userId = params.userId || offer?.userId;
    if (!userId) return;
    await logTeamEvent({ userId, kind: params.kind, title: params.title, body: offer?.title || null, refType: 'offer', refId: params.offerId });
  } catch (error) {
    console.warn('[teamLog] offer skip', error instanceof Error ? error.message : error);
  }
}

/** Akcja w Dealroomie (termin, wiadomość) — wpis z tytułem oferty, której dotyczy transakcja. */
export async function logDealroomEvent(params: { dealId: number; userId: number; kind: string; title: string; detail?: string | null }): Promise<void> {
  try {
    const deal = await prisma.deal.findUnique({ where: { id: params.dealId }, select: { offerId: true, offer: { select: { title: true } } } });
    const body = [params.detail, deal?.offer?.title].filter(Boolean).join(' · ') || null;
    await logTeamEvent({ userId: params.userId, kind: params.kind, title: params.title, body, refType: 'offer', refId: deal?.offerId ?? null });
  } catch (error) {
    console.warn('[teamLog] dealroom skip', error instanceof Error ? error.message : error);
  }
}

/** Data i godzina terminu do treści wpisu. */
export function termLabel(value: Date | string): string {
  return new Date(value).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export type TeamDayEvent = {
  id: number;
  at: string;
  userId: number;
  kind: string;
  title: string;
  body: string | null;
  refType: string | null;
  refId: number | null;
  source: 'log' | 'client';
};

/** Zdarzenia całego biura z jednego dnia: dziennik + aktywności z kart klientów. */
export async function listTeamDay(params: { companyId: number; day: Date }): Promise<{
  agents: Array<{ userId: number; name: string; role: string }>;
  events: TeamDayEvent[];
}> {
  const start = new Date(params.day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const company = await prisma.agencyCompany.findUnique({
    where: { id: params.companyId },
    select: {
      ownerUserId: true,
      owner: { select: { id: true, name: true } },
      members: { select: { userId: true, role: true, status: true, user: { select: { id: true, name: true } } } },
    },
  });
  if (!company) return { agents: [], events: [] };

  const agentMap = new Map<number, { userId: number; name: string; role: string }>();
  agentMap.set(company.ownerUserId, { userId: company.ownerUserId, name: company.owner?.name || 'Kierownik biura', role: 'ADMIN' });
  for (const m of company.members) {
    if (m.status !== 'ACTIVE' && m.userId !== company.ownerUserId) continue;
    agentMap.set(m.userId, { userId: m.userId, name: m.user?.name || `Agent #${m.userId}`, role: m.role });
  }
  const userIds = [...agentMap.keys()];

  const logged = (await prisma
    .$queryRawUnsafe<Array<{ id: bigint; userId: number; kind: string; title: string; body: string | null; refType: string | null; refId: number | null; createdAt: Date }>>(
      `SELECT id, userId, kind, title, body, refType, refId, createdAt FROM AgencyTeamEvent
       WHERE (companyId = ? OR userId IN (${userIds.map(() => '?').join(',')})) AND createdAt >= ? AND createdAt < ?
       ORDER BY createdAt DESC LIMIT 1500`,
      params.companyId,
      ...userIds,
      start,
      end,
    )
    .catch(() => [])) as Array<{ id: bigint; userId: number; kind: string; title: string; body: string | null; refType: string | null; refId: number | null; createdAt: Date }>;

  const activities = await prisma.agencyClientActivity.findMany({
    where: { agencyUserId: { in: userIds }, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'desc' },
    take: 1500,
    select: { id: true, agencyUserId: true, kind: true, title: true, body: true, clientId: true, createdAt: true, client: { select: { firstName: true, lastName: true } } },
  });

  const events: TeamDayEvent[] = [
    ...logged.map((row) => ({
      id: Number(row.id),
      at: new Date(row.createdAt).toISOString(),
      userId: row.userId,
      kind: row.kind,
      title: row.title,
      body: row.body,
      refType: row.refType,
      refId: row.refId,
      source: 'log' as const,
    })),
    ...activities.map((row) => ({
      id: -row.id,
      at: row.createdAt.toISOString(),
      userId: row.agencyUserId,
      kind: row.kind,
      title: row.title || row.kind,
      body: [row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : null, row.body].filter(Boolean).join(' · ') || null,
      refType: 'client',
      refId: row.clientId,
      source: 'client' as const,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { agents: [...agentMap.values()], events };
}

/* ───────── automatyczny zapis akcji z API CRM ───────── */

const CLIENT_ACTION_LABELS: Record<string, string> = {
  accept_schedule_change: 'Potwierdził termin zaproponowany przez klienta',
  add_external_portal: 'Dodał ogłoszenie na portalu zewnętrznym',
  add_marketing_note: 'Dodał notatkę marketingową',
  complete_presentation_visit: 'Zakończył prezentację (podsumowanie wizyty)',
  create_offer_from_acquisition: 'Utworzył ofertę z pozyskania',
  create_person_project: 'Założył nowy projekt klienta',
  intelligence_approve: 'Zatwierdził wysyłkę ofert z agenta poszukiwań',
  intelligence_send: 'Wysłał oferty z agenta poszukiwań',
  intelligence_skip: 'Pominął propozycję agenta poszukiwań',
  link_offer: 'Powiązał ofertę z klientem',
  mark_presentation_held: 'Oznaczył prezentację jako odbytą',
  notify_offer: 'Wysłał ofertę klientowi',
  notify_offers: 'Wysłał oferty klientowi',
  portal_hunt: 'Uruchomił poszukiwanie na portalach',
  propose_auction: 'Zaproponował aukcję',
  propose_meeting: 'Zaproponował spotkanie',
  propose_open_house: 'Zaproponował dzień otwarty',
  propose_presentation: 'Zaproponował terminy prezentacji',
  publish_latest_estateos_promotion: 'Opublikował promocję EstateOS',
  publish_other_agencies: 'Udostępnił ofertę innym agencjom',
  record_facebook_group_post: 'Zapisał publikację w grupie Facebook',
  remove_external_portal: 'Usunął ogłoszenie z portalu zewnętrznego',
  reply_to_offer_feedback: 'Odpowiedział na opinię klienta o ofercie',
  request_client_decision: 'Poprosił klienta o decyzję',
  request_listing_showing: 'Poprosił inną agencję o prezentację',
  resend_attendance_email: 'Wysłał ponownie potwierdzenie obecności',
  resolve_buyer_agent_task: 'Załatwił zadanie kupującego',
  resume_intelligence: 'Wznowił agenta poszukiwań',
  send_business_card: 'Wysłał wizytówkę',
  send_portal_message: 'Napisał do klienta w panelu',
  send_visit_prep_packet: 'Wysłał pakiet przed wizytą',
  set_marketing_visibility: 'Zmienił widoczność marketingu',
  set_seller_next_step: 'Ustalił następny krok ze sprzedającym',
  start_auction: 'Rozpoczął aukcję',
  start_open_house: 'Rozpoczął dzień otwarty',
  update_external_portal: 'Zaktualizował ogłoszenie na portalu',
};

const DEAL_ACTION_LABELS: Record<string, string> = {
  add_buyer: 'Dodał kupującego do oferty',
  confirm_intent: 'Potwierdził zainteresowanie kupującego',
  schedule_external: 'Ustalił termin prezentacji',
  mark_viewed: 'Oznaczył prezentację jako odbytą',
  set_feedback: 'Zapisał opinię kupującego',
  request_feedback: 'Poprosił kupującego o opinię',
  inform_seller: 'Poinformował sprzedającego',
  set_status: 'Zmienił status transakcji',
  start_negotiation: 'Rozpoczął negocjacje',
  add_offer: 'Zapisał propozycję ceny',
  set_offer_status: 'Zmienił status propozycji ceny',
  send_offer_to_seller: 'Wysłał propozycję ceny sprzedającemu',
  message_buyer: 'Napisał do kupującego',
  set_negotiation: 'Zaktualizował negocjacje',
  set_reservation: 'Zapisał rezerwację',
  decide_others: 'Zdecydował o pozostałych kupujących',
  set_step: 'Zaktualizował etap transakcji',
  send_offer: 'Wysłał propozycję ceny',
  record_response: 'Zapisał odpowiedź strony',
  approve_response: 'Zatwierdził odpowiedź strony',
  skip_reservation: 'Pominął rezerwację',
  start_documents: 'Rozpoczął etap dokumentów',
};

/**
 * Owija handler POST: po udanej akcji zapisuje ją w dzienniku zespołu.
 * Odczytuje akcję z kopii żądania, więc handler dostaje nienaruszone body.
 */
export async function withTeamLog(
  req: Request,
  scope: 'client' | 'deal',
  userId: () => Promise<number | null>,
  refId: number | null,
  handler: () => Promise<Response>,
): Promise<Response> {
  let action = '';
  let ref = refId;
  try {
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const body = (await req.clone().json().catch(() => ({}))) as Record<string, unknown>;
      action = String(body.action || '');
      if (!ref && body.dealId) ref = Number(body.dealId) || null;
    }
  } catch {
    action = '';
  }
  const res = await handler();
  const labels = scope === 'client' ? CLIENT_ACTION_LABELS : DEAL_ACTION_LABELS;
  if (res.ok && action && labels[action]) {
    const uid = await userId().catch(() => null);
    if (uid) {
      let title = labels[action];
      let body: string | null = null;
      try {
        const data = await res.clone().json();
        const deal = data?.deal;
        if (deal?.offer?.title) {
          const buyer = deal.buyer?.name || deal.buyer?.agency || 'kupujący';
          body = `${buyer} · ${deal.offer.title}`;
        }
      } catch {
        body = null;
      }
      if (scope === 'client' && ref) {
        const client = await prisma.agencyClient.findUnique({ where: { id: ref }, select: { firstName: true, lastName: true } }).catch(() => null);
        if (client) body = `${client.firstName} ${client.lastName}`.trim();
      }
      if (action === 'set_status') title = 'Zmienił status transakcji (zamknięcie / wznowienie)';
      void logTeamEvent({ userId: uid, kind: `${scope.toUpperCase()}_${action.toUpperCase()}`.slice(0, 48), title, body, refType: scope, refId: ref });
    }
  }
  return res;
}
