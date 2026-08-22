import { prisma } from '@/lib/prisma';
import { CLIENT_PREP_ITEMS } from '@/lib/crm/clientJourney';
import { ACQUISITION_DOCUMENTS } from '@/lib/acquisitionWorkflow';

export type ChecklistStageKey =
  | 'PROSPECT'
  | 'MEETING'
  | 'ACQUISITION'
  | 'CONTRACT'
  | 'LISTING_PREP'
  | 'PUBLICATION'
  | 'PRESENTATION'
  | 'OPEN_HOUSE'
  | 'AUCTION'
  | 'NEGOTIATION'
  | 'DEAL'
  | 'ACT'
  | 'AFTERCARE'
  | 'BUY_INQUIRY'
  | 'BUY_QUALIFIED'
  | 'BUY_MATCHING';

type ChecklistDef = { id: string; label: string; dueDays?: number; catalog?: 'CLIENT_PREP' | 'ACQUISITION' };

const STAGE_ITEMS: Record<ChecklistStageKey, ChecklistDef[]> = {
  PROSPECT: [
    { id: 'prospect_verify_owner', label: 'Zweryfikuj właściciela / źródło', dueDays: 1 },
    { id: 'prospect_first_call', label: 'Pierwszy kontakt telefoniczny', dueDays: 1 },
    { id: 'prospect_notes', label: 'Notatka z rozmowy w timeline', dueDays: 2 },
  ],
  MEETING: [
    { id: 'meeting_confirm', label: 'Potwierdź termin spotkania', dueDays: 1 },
    { id: 'meeting_location', label: 'Adres + trasa / mapa', dueDays: 1 },
    { id: 'meeting_materials', label: 'Materiały rynkowe / CMA', dueDays: 2 },
  ],
  ACQUISITION: ACQUISITION_DOCUMENTS.map((d) => ({
    id: d.id,
    label: d.label,
    dueDays: 7,
    catalog: 'ACQUISITION' as const,
  })),
  CONTRACT: [
    { id: 'contract_send', label: 'Wyślij umowę do podpisu', dueDays: 2 },
    { id: 'contract_followup', label: 'Follow-up podpisu umowy', dueDays: 5 },
    { id: 'contract_portal', label: 'Portal klienta aktywny', dueDays: 3 },
  ],
  LISTING_PREP: CLIENT_PREP_ITEMS.map((d) => ({
    id: d.id,
    label: d.label,
    dueDays: 5,
    catalog: 'CLIENT_PREP' as const,
  })),
  PUBLICATION: [
    { id: 'pub_estateos', label: 'Publikacja EstateOS™', dueDays: 1 },
    { id: 'pub_portals', label: 'Portale zewnętrzne (Otodom/OLX)', dueDays: 2 },
    { id: 'pub_social', label: 'Facebook / share kit', dueDays: 3 },
    { id: 'pub_matching', label: 'Uruchom matching kupujących', dueDays: 1 },
  ],
  PRESENTATION: [
    { id: 'pres_confirm', label: 'Potwierdzenie prezentacji', dueDays: 1 },
    { id: 'pres_debrief', label: 'Debrief w 15 min po wizycie', dueDays: 0 },
    { id: 'pres_feedback', label: 'Feedback do sprzedającego', dueDays: 1 },
  ],
  OPEN_HOUSE: [
    { id: 'oh_prep', label: 'Przygotowanie OH (materiały, rezerwacje)', dueDays: 2 },
    { id: 'oh_guest_list', label: 'Lista gości + lookup klientów', dueDays: 0 },
    { id: 'oh_followup', label: 'Follow-up gości w 24h', dueDays: 1 },
  ],
  AUCTION: [
    { id: 'auction_rules', label: 'Regulamin + kwota wywoławcza', dueDays: 3 },
    { id: 'auction_bidders', label: 'Rejestr licytantów → DeskCase', dueDays: 0 },
    { id: 'auction_followup', label: 'Follow-up licytantów', dueDays: 1 },
  ],
  NEGOTIATION: [
    { id: 'neg_summary', label: 'Podsumowanie ofert cenowych', dueDays: 1 },
    { id: 'neg_seller_update', label: 'Aktualizacja sprzedającego', dueDays: 1 },
  ],
  DEAL: [
    { id: 'deal_room', label: 'Deal Room aktywny', dueDays: 1 },
    { id: 'deal_docs', label: 'Dokumenty przed aktem', dueDays: 7 },
  ],
  ACT: [
    { id: 'act_handover', label: 'Przekazanie kluczy / protokół', dueDays: 0 },
    { id: 'act_invoice', label: 'Faktura prowizji', dueDays: 3 },
  ],
  AFTERCARE: [
    { id: 'after_7', label: 'Aftercare day 7 — kontakt', dueDays: 7 },
    { id: 'after_30', label: 'Aftercare day 30 — opinia', dueDays: 30 },
    { id: 'after_180', label: 'Aftercare 6 mies.', dueDays: 180 },
    { id: 'after_365', label: 'Aftercare 12 mies. — polecenie', dueDays: 365 },
  ],
  BUY_INQUIRY: [
    { id: 'buy_qualify', label: 'Pełna kwalifikacja kupującego', dueDays: 2 },
    { id: 'buy_callback', label: 'Oddzwonić / potwierdzić kontakt', dueDays: 1 },
  ],
  BUY_QUALIFIED: [
    { id: 'buy_matching', label: 'Uruchom matching ofert', dueDays: 1 },
    { id: 'buy_send_top3', label: 'Wyślij 3 najlepsze oferty', dueDays: 2 },
  ],
  BUY_MATCHING: [
    { id: 'buy_pres_schedule', label: 'Umów prezentację TOP oferty', dueDays: 3 },
    { id: 'buy_comparison', label: 'Przygotuj porównanie 2–4 ofert', dueDays: 5 },
  ],
};

const PIPELINE_TO_CHECKLIST: Record<string, ChecklistStageKey> = {
  FOUND: 'PROSPECT',
  CONTACTED: 'PROSPECT',
  NO_ANSWER: 'PROSPECT',
  CALLBACK: 'PROSPECT',
  INTERESTED: 'PROSPECT',
  MEETING: 'MEETING',
  ACQUISITION: 'ACQUISITION',
  CONTRACT: 'CONTRACT',
  PREP: 'LISTING_PREP',
  LISTING: 'LISTING_PREP',
  LIVE: 'PUBLICATION',
  NEGOTIATION: 'NEGOTIATION',
  DEAL: 'DEAL',
  ACT: 'ACT',
  AFTERCARE: 'AFTERCARE',
  INQUIRY: 'BUY_INQUIRY',
  QUALIFIED: 'BUY_QUALIFIED',
  MATCHING: 'BUY_MATCHING',
  PRESENTATION: 'PRESENTATION',
  OFFER: 'NEGOTIATION',
};

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function resolveChecklistStage(pipelineStage: string, kind: string): ChecklistStageKey | null {
  if (pipelineStage === 'PRESENTATION' && kind === 'BUY') return 'PRESENTATION';
  return PIPELINE_TO_CHECKLIST[pipelineStage] || null;
}

/** Create checklist tasks for a pipeline stage (skips duplicates). */
export async function syncChecklistsForCase(params: {
  caseId: number;
  agencyUserId: number;
  clientId: number;
  kind: string;
  pipelineStage: string;
}) {
  const stageKey = resolveChecklistStage(params.pipelineStage, params.kind);
  if (!stageKey) return { created: 0 };

  const defs = STAGE_ITEMS[stageKey];
  const existing = await prisma.deskTask.findMany({
    where: {
      caseId: params.caseId,
      trigger: 'CHECKLIST',
      status: { in: ['OPEN', 'DONE'] },
    },
    select: { metadata: true },
  });

  const existingIds = new Set(
    existing
      .map((t) => {
        const m = t.metadata as Record<string, unknown> | null;
        return typeof m?.catalogId === 'string' ? m.catalogId : null;
      })
      .filter(Boolean),
  );

  let created = 0;
  for (const def of defs) {
    if (existingIds.has(def.id)) continue;
    await prisma.deskTask.create({
      data: {
        agencyUserId: params.agencyUserId,
        caseId: params.caseId,
        clientId: params.clientId,
        title: def.label,
        status: 'OPEN',
        priority: def.dueDays === 0 ? 'URGENT' : 'NORMAL',
        dueAt: daysFromNow(def.dueDays ?? 3),
        trigger: 'CHECKLIST',
        metadata: {
          catalogId: def.id,
          stageKey,
          catalog: def.catalog || 'STAGE',
        },
      },
    });
    created += 1;
  }

  return { created, stageKey };
}

export async function listChecklistTasks(caseId: number) {
  return prisma.deskTask.findMany({
    where: { caseId, trigger: 'CHECKLIST' },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { id: 'asc' }],
  });
}

export async function markOverdueChecklistAlerts(agencyUserId: number) {
  const now = new Date();
  const overdue = await prisma.deskTask.findMany({
    where: {
      agencyUserId,
      trigger: 'CHECKLIST',
      status: 'OPEN',
      dueAt: { lt: now },
    },
    select: { caseId: true },
    distinct: ['caseId'],
  });

  for (const row of overdue) {
    if (!row.caseId) continue;
    await prisma.deskCase.update({
      where: { id: row.caseId },
      data: { health: 'ATTENTION', nextAction: 'Przeterminowana checklista — odhacz lub zaplanuj' },
    });
  }

  return overdue.length;
}
