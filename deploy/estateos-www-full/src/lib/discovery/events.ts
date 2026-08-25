import crypto from 'crypto';
import { noteCorrectionTarget, parseTasteNote } from './parseTasteNote';
import {
  DISCOVERY_DISLIKE_REASONS,
  DISCOVERY_EVENT_TYPES,
  DISCOVERY_LEGACY_EVENT_ALIASES,
  DISCOVERY_VISIT_OUTCOMES,
  type DiscoveryIncomingEvent,
} from './types';

const PLATFORMS = new Set(['ios', 'android', 'web']);

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function optionalNonNegativeInt(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function boundedString(value: unknown, max: number): string | null {
  const parsed = String(value ?? '').trim();
  return parsed && parsed.length <= max ? parsed : null;
}

export function normalizeDiscoveryEventType(value: unknown): DiscoveryIncomingEvent['eventType'] | null {
  const raw = String(value || '').trim().toUpperCase();
  const normalized = DISCOVERY_LEGACY_EVENT_ALIASES[raw] || raw;
  return (DISCOVERY_EVENT_TYPES as readonly string[]).includes(normalized)
    ? normalized as DiscoveryIncomingEvent['eventType']
    : null;
}

export function buildDiscoveryEventIdempotencyKey(userId: number, input: {
  idempotencyKey?: string | null;
  eventType: string;
  offerId?: number | null;
  sessionId?: string | null;
  at: Date;
}): string {
  const supplied = String(input.idempotencyKey || '').trim();
  if (supplied && /^[A-Za-z0-9._:-]{12,96}$/.test(supplied)) return supplied;
  return crypto
    .createHash('sha256')
    .update(`${userId}:${input.eventType}:${input.offerId}:${input.sessionId || 'none'}:${input.at.toISOString()}`)
    .digest('hex');
}

export function parseDiscoveryIncomingEvent(raw: unknown): { ok: true; event: DiscoveryIncomingEvent } | { ok: false; error: string } {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rawEventType = String(body.eventType || '').trim().toUpperCase();
  const eventType = normalizeDiscoveryEventType(body.eventType);
  const offerId = body.offerId == null ? null : positiveInt(body.offerId);
  const platform = String(body.platform || '').trim().toLowerCase();
  const at = body.at ? new Date(String(body.at)) : new Date();
  const source = boundedString(body.source || 'mobile_discovery', 32) || 'mobile_discovery';
  const sessionId = body.sessionId == null ? null : boundedString(body.sessionId, 64);
  const idempotencyKey = body.idempotencyKey == null ? null : boundedString(body.idempotencyKey, 96);
  const reasonNote = boundedString(body.reasonNote ?? body.note, 280);
  const parsedNote = reasonNote ? parseTasteNote(reasonNote) : null;
  let reasonCode = body.reasonCode == null ? null : String(body.reasonCode).trim().toUpperCase();
  if (!reasonCode && parsedNote?.reasonCode) reasonCode = parsedNote.reasonCode;
  const visitOutcome = body.visitOutcome == null ? null : String(body.visitOutcome).trim().toUpperCase();
  let correctionTarget = body.correctionTarget == null ? null : boundedString(body.correctionTarget, 128);
  if (!correctionTarget && reasonNote && (eventType === 'DISCOVERY_DISLIKE' || eventType === 'DISCOVERY_CORRECTION')) {
    correctionTarget = boundedString(noteCorrectionTarget(reasonNote), 128);
  } else if (!correctionTarget && parsedNote?.correctionTarget) {
    correctionTarget = parsedNote.correctionTarget.slice(0, 128);
  }
  const score = body.score == null ? null : optionalNonNegativeInt(body.score);

  if (!eventType) return { ok: false, error: 'Niepoprawne eventType' };
  const requiresOffer = ![
    'DISCOVERY_OPEN_SESSION',
    'DISCOVERY_PAUSE',
    'DISCOVERY_RESUME',
    'DISCOVERY_PHASE_END',
  ].includes(eventType);
  if (requiresOffer && !offerId) return { ok: false, error: 'offerId musi być > 0 dla tego zdarzenia' };
  if (!PLATFORMS.has(platform)) return { ok: false, error: 'Niepoprawna platform' };
  if (Number.isNaN(at.getTime())) return { ok: false, error: 'Niepoprawne at (ISO datetime)' };
  if (reasonCode && !(DISCOVERY_DISLIKE_REASONS as readonly string[]).includes(reasonCode)) {
    return { ok: false, error: 'Niepoprawne reasonCode' };
  }
  if (rawEventType === 'DISCOVERY_DISLIKE_REASON' && !reasonCode) {
    return { ok: false, error: 'reasonCode jest wymagane dla DISCOVERY_DISLIKE_REASON' };
  }
  if (eventType === 'DISCOVERY_DISLIKE' && body.reasonCode != null && !reasonCode) {
    return { ok: false, error: 'Niepoprawne reasonCode' };
  }
  if (eventType === 'DISCOVERY_VISIT_FEEDBACK' &&
    !(DISCOVERY_VISIT_OUTCOMES as readonly string[]).includes(String(visitOutcome || ''))) {
    return { ok: false, error: 'visitOutcome jest wymagane dla DISCOVERY_VISIT_FEEDBACK' };
  }
  if (eventType === 'DISCOVERY_CORRECTION' && !correctionTarget) {
    return { ok: false, error: 'correctionTarget jest wymagane dla DISCOVERY_CORRECTION' };
  }
  if (score != null && score > 100) return { ok: false, error: 'score musi być w zakresie 0..100' };

  return {
    ok: true,
    event: {
      eventType,
      offerId,
      sessionId,
      idempotencyKey,
      photoIndex: optionalNonNegativeInt(body.photoIndex),
      score,
      reasonCode: reasonCode as DiscoveryIncomingEvent['reasonCode'],
      visitOutcome: visitOutcome as DiscoveryIncomingEvent['visitOutcome'],
      correctionTarget,
      dwellMs: optionalNonNegativeInt(body.dwellMs),
      decisionLatencyMs: optionalNonNegativeInt(body.decisionLatencyMs),
      source,
      platform: platform as DiscoveryIncomingEvent['platform'],
      at,
      ...(rawEventType === 'DISCOVERY_DISLIKE_REASON' ? { legacyReasonOnly: true } : {}),
    },
  };
}
