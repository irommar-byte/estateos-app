'use client';

import type { DoItNowAction } from '@/lib/desk/nextActionRouter';
import { DeskField, DeskTruncate } from '@/components/desk/DeskText';
import {
  DESK_UI,
  labelDeskKind,
  labelDeskStage,
  labelHealth,
  labelPriority,
  labelTemperature,
} from '@/lib/desk/labels';

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function healthClass(health: string) {
  if (health === 'AT_RISK') return 'eos-desk-chip eos-desk-chip-risk';
  if (health === 'ATTENTION') return 'eos-desk-chip eos-desk-chip-attention';
  return 'eos-desk-chip eos-desk-chip-ok';
}

function doItNowHint(action: DoItNowAction): string {
  switch (action.type) {
    case 'section':
      return `Otwiera sekcję ${action.section}`;
    case 'call':
      return 'Dzwoni do klienta';
    case 'sms':
      return 'Otwiera SMS';
    case 'email':
      return 'Otwiera e-mail';
    case 'radar_send':
      return 'Przechodzi do wysyłki Radar';
    case 'offer_inspector':
      return 'Otwiera inspektor oferty';
    case 'task_complete':
      return 'Oznacza zadanie jako wykonane';
    default:
      return 'Wykonuje następną akcję';
  }
}

type Props = {
  clientName: string;
  kind: string;
  stage: string;
  temperature: string;
  health: string;
  lastContactedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  nextBestAction: { id: number | null; title: string; dueAt: string | null; priority: string } | null;
  onDoItNow: (action: DoItNowAction) => void;
  resolveAction: () => DoItNowAction;
  busy?: boolean;
};

export function DeskCaseCommandCenter({
  clientName,
  kind,
  stage,
  temperature,
  health,
  lastContactedAt,
  nextAction,
  nextActionAt,
  nextBestAction,
  onDoItNow,
  resolveAction,
  busy,
}: Props) {
  const stageLabel = labelDeskStage(kind, stage);
  const kindLabel = labelDeskKind(kind);

  const nbaTitle = nextBestAction?.title || nextAction || 'Brak zaplanowanej akcji';
  const dueAt = nextActionAt || nextBestAction?.dueAt;
  const resolved = resolveAction();

  return (
    <div className="eos-desk-command-center">
      <div className="eos-desk-command-hero">
        <div className="eos-desk-command-hero__main">
          <p className="eos-desk-kicker eos-desk-command-kicker">{DESK_UI.commandCenter}</p>
          <DeskTruncate className="eos-desk-command-client" lines={2}>
            {clientName}
          </DeskTruncate>
        </div>
        <div className="eos-desk-command-hero__badges">
          <span className="eos-desk-chip eos-desk-chip-kind">{kindLabel}</span>
          <span className="eos-desk-chip">{stageLabel}</span>
        </div>
      </div>

      <div className="eos-desk-command-status">
        <span className={temperature === 'HOT' ? 'eos-desk-chip eos-desk-chip-hot' : 'eos-desk-chip'}>
          {labelTemperature(temperature)}
        </span>
        <span className={healthClass(health)}>{labelHealth(health)}</span>
      </div>

      <div className="eos-desk-command-grid">
        <DeskField label={DESK_UI.lastContact} value={fmtWhen(lastContactedAt)} />
        <DeskField label={DESK_UI.nbaDeadline} value={fmtWhen(dueAt)} />
        <div className="eos-desk-field eos-desk-field--wide">
          <span className="eos-desk-command-label">{DESK_UI.nextStep}</span>
          <DeskTruncate className="eos-desk-field-value" lines={3}>
            {nextAction || '—'}
          </DeskTruncate>
        </div>
      </div>

      <div className="eos-desk-nba-panel">
        <div className="eos-desk-nba-panel__body">
          <span className="eos-desk-command-label">{DESK_UI.nextBestAction}</span>
          <p className="eos-desk-nba-title">
            <DeskTruncate lines={3}>{nbaTitle}</DeskTruncate>
          </p>
          <div className="eos-desk-nba-meta">
            {nextBestAction?.priority ? (
              <span className="eos-desk-chip eos-desk-chip-priority">
                {labelPriority(nextBestAction.priority)}
              </span>
            ) : null}
            {dueAt ? (
              <span className="eos-desk-nba-due">Do: {fmtWhen(dueAt)}</span>
            ) : null}
          </div>
          <p className="eos-desk-nba-hint">{doItNowHint(resolved)}</p>
        </div>
        <button
          type="button"
          className="eos-desk-btn eos-desk-btn-primary eos-desk-do-it-now"
          disabled={busy}
          onClick={() => onDoItNow(resolved)}
        >
          {busy ? '…' : DESK_UI.doItNow}
        </button>
      </div>
    </div>
  );
}
