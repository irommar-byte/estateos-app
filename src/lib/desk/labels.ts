import type { BuyPipelineStage, DeskHealth, DeskTaskPriority, DeskTemperature, SellPipelineStage } from '@/lib/desk/types';
import { SELL_STAGE_LABELS } from '@/lib/desk/types';

export const DESK_NAV = [
  { href: '/crm', label: 'Dziś', dockLabel: 'Dziś' },
  { href: '/crm/prospecting', label: 'Pozysk', dockLabel: 'Pozysk' },
  { href: '/crm/cases', label: 'Sprawy', dockLabel: 'Sprawy' },
  { href: '/crm/buyers', label: 'Kupujący', dockLabel: 'Kupuj.' },
  { href: '/crm/calendar', label: 'Kalendarz', dockLabel: 'Kal.' },
  { href: '/crm/map', label: 'Mapa', dockLabel: 'Mapa' },
  { href: '/crm/inbox', label: 'Skrzynka', dockLabel: 'Skrz.' },
] as const;

export const BUY_STAGE_LABELS: Record<BuyPipelineStage, string> = {
  INQUIRY: 'Zapytanie',
  QUALIFIED: 'Kwalifikacja',
  MATCHING: 'Dopasowanie',
  PRESENTATION: 'Prezentacja',
  OFFER: 'Oferta cenowa',
  NEGOTIATION: 'Negocjacje',
  DEAL: 'Transakcja',
  ACT: 'Akt',
  AFTERCARE: 'Opieka posprzedażowa',
  LOST: 'Utracony',
};

export function labelDeskKind(kind: string): string {
  if (kind === 'SELL') return 'Sprzedaż';
  if (kind === 'BUY') return 'Kupno';
  return kind;
}

export function labelDeskStage(kind: string, stage: string): string {
  if (kind === 'SELL' && stage in SELL_STAGE_LABELS) {
    return SELL_STAGE_LABELS[stage as SellPipelineStage];
  }
  if (kind === 'BUY' && stage in BUY_STAGE_LABELS) {
    return BUY_STAGE_LABELS[stage as BuyPipelineStage];
  }
  return stage;
}

export function labelTemperature(t: string): string {
  switch (t) {
    case 'HOT':
      return 'Gorący';
    case 'WARM':
      return 'Ciepły';
    case 'COLD':
      return 'Zimny';
    default:
      return t;
  }
}

export function labelHealth(h: string): string {
  switch (h) {
    case 'HEALTHY':
      return 'W normie';
    case 'ATTENTION':
      return 'Uwaga';
    case 'AT_RISK':
      return 'Ryzyko';
    default:
      return h;
  }
}

export function labelPriority(p: string): string {
  switch (p) {
    case 'URGENT':
      return 'Pilne';
    case 'HIGH':
      return 'Wysoki';
    case 'NORMAL':
      return 'Normalny';
    case 'LOW':
      return 'Niski';
    default:
      return p;
  }
}

export type DeskInspectorSection =
  | 'SUMMARY'
  | 'CHECKLIST'
  | 'CONTACT'
  | 'ACQUISITION'
  | 'CONTRACT'
  | 'LISTING'
  | 'MARKETING'
  | 'REPORT'
  | 'MATCHING'
  | 'GUESTS'
  | 'DEAL'
  | 'DEBRIEF'
  | 'TEMPLATES'
  | 'TIMELINE';

export const DESK_SECTION_LABELS: Record<DeskInspectorSection, string> = {
  SUMMARY: 'Podsumowanie',
  CHECKLIST: 'Checklista',
  CONTACT: 'Kontakt',
  ACQUISITION: 'Pozysk',
  CONTRACT: 'Umowa',
  LISTING: 'Oferta',
  MARKETING: 'Marketing',
  REPORT: 'Raport',
  MATCHING: 'Dopasowanie',
  GUESTS: 'Goście',
  DEAL: 'Transakcja',
  DEBRIEF: 'Debrief',
  TEMPLATES: 'Szablony',
  TIMELINE: 'Oś czasu',
};

export function labelDeskSection(section: string): string {
  return DESK_SECTION_LABELS[section as DeskInspectorSection] || section;
}

export const DESK_UI = {
  commandCenter: 'Centrum dowodzenia',
  nextBestAction: 'Następna najlepsza akcja',
  doItNow: 'Wykonaj teraz',
  lastContact: 'Ostatni kontakt',
  nbaDeadline: 'Termin akcji',
  nextStep: 'Następny krok',
  searchCmdK: 'Szukaj ⌘K',
  searchDialogTitle: 'Szybkie wyszukiwanie',
  newProspect: 'Nowy prospect',
  openCase: 'Otwórz sprawę',
  debriefInInspector: 'Debrief w inspektorze',
  myOffers: 'Moje ogłoszenia',
  backToCase: '← Sprawa',
  noPlannedAction: 'Brak zaplanowanej akcji',
  loading: 'Ładuję…',
  searching: 'Szukam…',
  todayTitle: 'Dziś',
  todayKicker: 'Centrum operacyjne',
  prospectingKicker: 'Pozyskiwanie',
  casesKicker: 'Sprawy',
  buyersKicker: 'Kupujący',
  calendarKicker: 'Kalendarz',
  inboxKicker: 'Skrzynka',
  mapKicker: 'Mapa',
} as const;
