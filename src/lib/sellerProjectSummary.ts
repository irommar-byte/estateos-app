import type {
  AcquisitionRecord,
  AgencyClientDetail,
  ClientPersonProject,
} from '../services/agencyClientService';
import { resolveOfficeOfferUiStatus, type LinkedOfferSnapshot } from './officeOfferStatusUi';
import {
  SELLER_PIPELINE_LABELS,
  sellerPipelineFromClientDetail,
  type SellerPipelineStage,
} from './sellerClientPipeline';
import { resolveMarketingChannel, type MarketingChannelId } from './marketingChannel';

export type SellerProjectSource = {
  project: ClientPersonProject;
  detail: AgencyClientDetail | null;
  acquisition: AcquisitionRecord | null;
  linkedOffer: LinkedOfferSnapshot | null;
  coverUrl: string | null;
};

export type SellerSummaryTone = 'neutral' | 'progress' | 'warning' | 'success' | 'danger';

export type SellerProjectFact = {
  key: string;
  icon: 'calendar-outline' | 'eye-outline' | 'document-text-outline' | 'hourglass-outline' | 'chatbubble-ellipses-outline' | 'sparkles-outline' | 'megaphone-outline';
  label: string;
  value: string;
  tone: SellerSummaryTone;
};

export type SellerProjectSummary = {
  id: number;
  title: string;
  details: string | null;
  location: string | null;
  price: number | null;
  coverUrl: string | null;
  linkedOfferId: number | null;
  status: { label: string; tone: SellerSummaryTone };
  stages: SellerPipelineStage[] | null;
  stageLabel: string | null;
  nextStep: { text: string; dueAt: string | null } | null;
  channels: { id: MarketingChannelId; label: string }[];
  facts: SellerProjectFact[];
  loading: boolean;
};

function shortDate(iso: string | null | undefined, withTime = false): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const day = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  if (!withTime) return day;
  const time = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

function isFuture(iso: string | null | undefined) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function resolveStatus(
  source: SellerProjectSource,
  offerStatus: string,
  signed: boolean,
): SellerProjectSummary['status'] {
  if (offerStatus === 'SOLD') return { label: 'Sprzedane', tone: 'success' };
  if (offerStatus === 'IN_DEAL') return { label: 'W transakcji', tone: 'progress' };
  if (source.linkedOffer || source.project.linkedOfferId) {
    const ui = resolveOfficeOfferUiStatus(
      source.linkedOffer || { id: source.project.linkedOfferId as number, status: offerStatus },
    );
    if (ui.key === 'active') return { label: 'Oferta aktywna', tone: 'success' };
    if (ui.key === 'review') return { label: 'Weryfikacja biura', tone: 'warning' };
    if (ui.key === 'rejected') return { label: 'Oferta odrzucona', tone: 'danger' };
    return { label: 'Szkic ogłoszenia', tone: 'neutral' };
  }
  if (signed) return { label: 'Umowa podpisana', tone: 'progress' };
  const meeting = source.detail?.meeting;
  if (meeting) {
    return meeting.status === 'confirmed'
      ? { label: 'Spotkanie umówione', tone: 'progress' }
      : { label: 'Spotkanie do potwierdzenia', tone: 'warning' };
  }
  return { label: source.project.statusLabel || 'Pozysk', tone: 'neutral' };
}

export function buildSellerProjectSummary(source: SellerProjectSource): SellerProjectSummary {
  const { project, detail, acquisition, linkedOffer } = source;
  const offerStatus = String(linkedOffer?.status || detail?.linkedOfferStatus || '').toUpperCase();
  const signed = acquisition?.status === 'SIGNED' || Boolean(acquisition?.signedAt) || Boolean(detail?.acquisitionSigned);
  const marketing = detail?.sellerMarketing || null;

  const stages = detail ? sellerPipelineFromClientDetail(detail, acquisition, offerStatus || null) : null;
  const allDone = Boolean(stages?.length) && stages!.every((stage) => stage.done);
  const current = stages?.find((stage) => stage.current) || null;
  const stageLabel = allDone ? 'Zakończona' : current ? SELLER_PIPELINE_LABELS[current.id] : null;

  const nextText = marketing?.sellerNextStep?.nextAction?.trim() || detail?.nextStep?.label?.trim() || '';
  const nextStep = nextText ? { text: nextText, dueAt: marketing?.sellerNextStep?.dueAt || null } : null;

  const channels: SellerProjectSummary['channels'] = [];
  const seen = new Set<string>();
  if (marketing?.estateos?.published) {
    seen.add('estateos');
    channels.push({ id: 'estateos', label: 'EstateOS™' });
  }
  for (const channel of marketing?.activeChannels || []) {
    const tone = resolveMarketingChannel({ portal: channel.portal, url: channel.externalUrl });
    if (seen.has(tone.id)) continue;
    seen.add(tone.id);
    channels.push({ id: tone.id, label: tone.label });
  }

  const facts: SellerProjectFact[] = [];
  const meeting = detail?.meeting;
  if (meeting && !signed) {
    facts.push({
      key: 'meeting',
      icon: 'calendar-outline',
      label: 'Spotkanie',
      value: `${shortDate(meeting.startsAt, true) || 'termin'}${meeting.status === 'pending' ? ' · do potwierdzenia' : ''}`,
      tone: meeting.status === 'pending' ? 'warning' : 'progress',
    });
  }
  if (signed && acquisition?.signedAt) {
    facts.push({
      key: 'agreement',
      icon: 'document-text-outline',
      label: 'Umowa',
      value: `podpisana ${shortDate(acquisition.signedAt)}`,
      tone: 'success',
    });
  }
  const presentation = detail?.presentation;
  if (presentation) {
    const value = presentation.heldAt
      ? `odbyta ${shortDate(presentation.heldAt)}`
      : `${shortDate(presentation.startsAt, true) || 'termin'}${presentation.status === 'pending' ? ' · do potwierdzenia' : ''}`;
    facts.push({
      key: 'presentation',
      icon: 'eye-outline',
      label: 'Prezentacja',
      value,
      tone: presentation.heldAt ? 'success' : presentation.status === 'pending' ? 'warning' : 'progress',
    });
  }
  const eventStage = marketing?.sellerEvents?.stage || project.eventStage || null;
  if (eventStage) {
    facts.push({
      key: 'event',
      icon: 'megaphone-outline',
      label: eventStage.kind === 'auction' ? 'Licytacja' : eventStage.kind === 'open_house' ? 'Dzień otwarty' : 'Wydarzenie',
      value: eventStage.label,
      tone: 'progress',
    });
  }
  if (isFuture(marketing?.estateos?.promotedUntil)) {
    facts.push({
      key: 'promoted',
      icon: 'sparkles-outline',
      label: 'Wyróżnienie',
      value: `do ${shortDate(marketing!.estateos!.promotedUntil)}`,
      tone: 'success',
    });
  }
  const decisions = marketing?.pendingDecisions.length || 0;
  if (decisions) {
    facts.push({
      key: 'decisions',
      icon: 'hourglass-outline',
      label: 'Czeka na klienta',
      value: `${decisions} ${decisions === 1 ? 'decyzja' : decisions < 5 ? 'decyzje' : 'decyzji'}`,
      tone: 'warning',
    });
  }
  if (project.portalUnreadCount) {
    facts.push({
      key: 'chat',
      icon: 'chatbubble-ellipses-outline',
      label: 'Czat',
      value: `${project.portalUnreadCount} nowe`,
      tone: 'warning',
    });
  }

  const location = [detail?.sellerCity, detail?.sellerDistrict].filter(Boolean).join(', ') || null;
  const offerTitle = linkedOffer?.title?.trim();
  const title = offerTitle || project.title;
  const rawDetails = (offerTitle ? project.title : project.subtitle)?.trim() || null;
  const details = rawDetails && rawDetails !== title && rawDetails !== location ? rawDetails : null;

  return {
    id: project.id,
    title,
    details,
    location,
    price: detail?.sellerPrice ?? null,
    coverUrl: source.coverUrl,
    linkedOfferId: linkedOffer?.id || project.linkedOfferId || null,
    status: resolveStatus(source, offerStatus, signed),
    stages,
    stageLabel,
    nextStep,
    channels,
    facts,
    loading: !detail,
  };
}
