export const DESK_CASE_KINDS = ['SELL', 'BUY'] as const;
export type DeskCaseKind = (typeof DESK_CASE_KINDS)[number];

export const SELL_PIPELINE = [
  'FOUND',
  'CONTACTED',
  'NO_ANSWER',
  'CALLBACK',
  'INTERESTED',
  'MEETING',
  'ACQUISITION',
  'CONTRACT',
  'PREP',
  'LISTING',
  'LIVE',
  'NEGOTIATION',
  'DEAL',
  'ACT',
  'AFTERCARE',
  'LOST',
] as const;

export const BUY_PIPELINE = [
  'INQUIRY',
  'QUALIFIED',
  'MATCHING',
  'PRESENTATION',
  'OFFER',
  'NEGOTIATION',
  'DEAL',
  'ACT',
  'AFTERCARE',
  'LOST',
] as const;

export type SellPipelineStage = (typeof SELL_PIPELINE)[number];
export type BuyPipelineStage = (typeof BUY_PIPELINE)[number];
export type DeskPipelineStage = SellPipelineStage | BuyPipelineStage;

export const DESK_TEMPERATURES = ['HOT', 'WARM', 'COLD'] as const;
export type DeskTemperature = (typeof DESK_TEMPERATURES)[number];

export const DESK_HEALTH = ['HEALTHY', 'ATTENTION', 'AT_RISK'] as const;
export type DeskHealth = (typeof DESK_HEALTH)[number];

export const DESK_TASK_STATUSES = ['OPEN', 'DONE', 'CANCELLED'] as const;
export type DeskTaskStatus = (typeof DESK_TASK_STATUSES)[number];

export const DESK_TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type DeskTaskPriority = (typeof DESK_TASK_PRIORITIES)[number];

export type DeskPropertySnapshot = {
  address?: string | null;
  city?: string | null;
  district?: string | null;
  propertyType?: string | null;
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  note?: string | null;
  draft?: Record<string, unknown> | null;
};

export type DeskWorkflowTrigger =
  | 'PROSPECT_CREATED'
  | 'CALL_NO_ANSWER'
  | 'CALL_CALLBACK'
  | 'CALL_NOT_INTERESTED'
  | 'CALL_INTERESTED'
  | 'MEETING_BOOKED'
  | 'MEETING_COMPLETED'
  | 'CONTRACT_SIGNED'
  | 'LISTING_PUBLISHED'
  | 'PRICE_CHANGED'
  | 'PRESENTATION_COMPLETED'
  | 'OPEN_HOUSE_COMPLETED'
  | 'BID_RECEIVED'
  | 'DEAL_FINALIZED'
  | 'BUYER_QUALIFIED'
  | 'TASK_COMPLETED'
  | 'MANUAL_STAGE'
  | 'SLA_SWEEP';

export type DeskDispatchInput = {
  agencyUserId: number;
  caseId: number;
  trigger: DeskWorkflowTrigger;
  payload?: Record<string, unknown>;
};

export function isSellStage(stage: string): stage is SellPipelineStage {
  return (SELL_PIPELINE as readonly string[]).includes(stage);
}

export function isBuyStage(stage: string): stage is BuyPipelineStage {
  return (BUY_PIPELINE as readonly string[]).includes(stage);
}

export const PROSPECTING_BOARD_STAGES: SellPipelineStage[] = [
  'FOUND',
  'CONTACTED',
  'NO_ANSWER',
  'CALLBACK',
  'INTERESTED',
  'MEETING',
  'ACQUISITION',
  'CONTRACT',
  'LOST',
];

export const SELL_STAGE_LABELS: Record<SellPipelineStage, string> = {
  FOUND: 'Znaleziony',
  CONTACTED: 'Kontakt',
  NO_ANSWER: 'Brak odpowiedzi',
  CALLBACK: 'Oddzwonić',
  INTERESTED: 'Zainteresowany',
  MEETING: 'Spotkanie',
  ACQUISITION: 'Pozysk',
  CONTRACT: 'Umowa',
  PREP: 'Przygotowanie',
  LISTING: 'Oferta',
  LIVE: 'Opublikowana',
  NEGOTIATION: 'Negocjacje',
  DEAL: 'Deal',
  ACT: 'Akt',
  AFTERCARE: 'Aftercare',
  LOST: 'Utracony',
};
