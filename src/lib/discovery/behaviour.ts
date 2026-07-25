import { DISCOVERY_DNA } from './dna';
import {
  createDiscoveryProfileSnapshot,
  deriveProfileConfidence,
  estimateContradictionIndex,
} from './engine';
import type { DiscoveryCandidate, DiscoveryIncomingEvent, DiscoveryProfileSnapshot, TasteVector } from './types';

function bump(map: Record<string, number>, key: string, delta: number) {
  const clean = String(key || '').trim();
  if (!clean) return;
  map[clean] = Number(map[clean] || 0) + delta;
}

function priceOf(candidate: DiscoveryCandidate): number {
  return Number(candidate.pricePln ?? candidate.price ?? 0);
}

function isPositive(event: DiscoveryIncomingEvent): boolean {
  return event.eventType === 'DISCOVERY_LIKE' ||
    event.eventType === 'DISCOVERY_PRIORITY' ||
    (event.eventType === 'DISCOVERY_VISIT_FEEDBACK' && event.visitOutcome === 'YES');
}

function isNegative(event: DiscoveryIncomingEvent): boolean {
  return event.eventType === 'DISCOVERY_DISLIKE' ||
    (event.eventType === 'DISCOVERY_VISIT_FEEDBACK' && event.visitOutcome === 'NO');
}

export function eventWeight(event: DiscoveryIncomingEvent): number {
  if (event.eventType === 'DISCOVERY_PRIORITY') return DISCOVERY_DNA.priorityWeight;
  if (event.eventType === 'DISCOVERY_LIKE') return DISCOVERY_DNA.likeWeight;
  if (event.eventType === 'DISCOVERY_DISLIKE') return DISCOVERY_DNA.dislikeWeight;
  if (event.eventType === 'DISCOVERY_VISIT_FEEDBACK') {
    if (event.visitOutcome === 'YES') return DISCOVERY_DNA.visitWeight;
    if (event.visitOutcome === 'NO') return DISCOVERY_DNA.visitNegativeWeight;
  }
  if (event.eventType === 'DISCOVERY_CORRECTION') return -DISCOVERY_DNA.correctionWeight;
  return 0;
}

export function updateDiscoveryProfileFromEvent(input: {
  existing: DiscoveryProfileSnapshot;
  event: DiscoveryIncomingEvent;
  candidate: DiscoveryCandidate;
}): DiscoveryProfileSnapshot {
  const { existing, event, candidate } = input;
  const next: DiscoveryProfileSnapshot = structuredClone(existing);
  const taste: TasteVector = next.tasteVector;
  const weight = eventWeight(event);

  if (weight !== 0) {
    bump(taste.affinity.city, candidate.city, weight);
    bump(taste.affinity.district, candidate.district, weight);
    bump(taste.affinity.propertyType, candidate.propertyType, weight);
    bump(taste.affinity.transactionType, candidate.transactionType, weight);
  }

  const price = priceOf(candidate);
  if (isPositive(event)) {
    taste.price.likedSum += price;
    taste.price.likedCount += 1;
    taste.space.likedAreaSum += Number(candidate.area || 0);
    taste.space.likedAreaCount += candidate.area > 0 ? 1 : 0;
    taste.space.likedRoomsSum += Number(candidate.rooms || 0);
    taste.space.likedRoomsCount += candidate.rooms ? 1 : 0;
  } else if (isNegative(event)) {
    taste.price.dislikedSum += price;
    taste.price.dislikedCount += 1;
  }

  if (event.eventType === 'DISCOVERY_PRIORITY') taste.behavioural.priorityCount += 1;
  if (event.eventType === 'DISCOVERY_VISIT_FEEDBACK' && event.visitOutcome === 'YES') {
    taste.behavioural.visitPositiveCount += 1;
  }
  if (event.eventType === 'DISCOVERY_VISIT_FEEDBACK' && event.visitOutcome === 'NO') {
    taste.behavioural.visitNegativeCount += 1;
  }
  if (weight !== 0) taste.behavioural.decisionCount += 1;

  if (event.decisionLatencyMs && event.decisionLatencyMs > 0) {
    const previous = taste.behavioural.medianDecisionLatencyMs;
    taste.behavioural.medianDecisionLatencyMs = previous == null
      ? event.decisionLatencyMs
      : Math.round(previous * 0.75 + event.decisionLatencyMs * 0.25);
    const hesitant = event.decisionLatencyMs > 7_000 ? 1 : 0;
    taste.behavioural.hesitationRate = Math.max(
      0,
      Math.min(1, taste.behavioural.hesitationRate * 0.85 + hesitant * 0.15),
    );
  }

  if (candidate.embeddingVector?.length && isPositive(event)) {
    const previous = taste.semantic.mu;
    const alpha = Math.min(0.28, 0.12 + 0.04 * Math.abs(weight));
    taste.semantic.mu = previous && previous.length === candidate.embeddingVector.length
      ? candidate.embeddingVector.map((value, index) => (1 - alpha) * previous[index] + alpha * value)
      : [...candidate.embeddingVector];
    taste.semantic.count += 1;
  }

  if (event.eventType === 'DISCOVERY_CORRECTION' && event.correctionTarget) {
    const [dimension, ...keyParts] = event.correctionTarget.split(':');
    const key = keyParts.join(':');
    const mapByDimension: Record<string, Record<string, number>> = {
      city: taste.affinity.city,
      district: taste.affinity.district,
      propertyType: taste.affinity.propertyType,
      transactionType: taste.affinity.transactionType,
    };
    const map = mapByDimension[dimension];
    if (map && key) map[key] = Number(map[key] || 0) * DISCOVERY_DNA.correctionDecay;
  }

  taste.updatedAt = event.at.toISOString();
  next.contradictionIndex = estimateContradictionIndex(taste);
  next.confidence = deriveProfileConfidence(taste, next.contradictionIndex);
  next.explorationHunger = Math.max(
    0.15,
    Math.min(1, next.contradictionIndex * 0.7 + (next.confidence < 0.35 ? 0.55 : 0.2)),
  );
  if (event.eventType === 'DISCOVERY_PHASE_END') next.searchPhase = 'COMPLETED';
  if (event.eventType === 'DISCOVERY_RESUME' && next.searchPhase === 'COMPLETED') next.searchPhase = 'ACTIVE';

  return createDiscoveryProfileSnapshot(next);
}
