import { DISCOVERY_DNA_VERSION } from './types';

export const DISCOVERY_DNA = {
  version: DISCOVERY_DNA_VERSION,
  maxSingleComponent: 20,
  minExplorationRatio: 0.15,
  maxEchoChamberRatio: 0.8,
  visitWeight: 2.2,
  priorityWeight: 1.6,
  likeWeight: 1,
  dislikeWeight: -1,
  visitNegativeWeight: -2,
  correctionWeight: 3,
  correctionDecay: 0.15,
  maxProfilePriorWeight: 0.45,
  maxDislikePenalty: 28,
  maxPricePenalty: 14,
  maxAmenityContribution: 8,
} as const;

export function capComponent(value: number): number {
  return Math.max(-DISCOVERY_DNA.maxSingleComponent, Math.min(DISCOVERY_DNA.maxSingleComponent, value));
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function safeRatio(value: number, denominator: number): number {
  if (!(denominator > 0)) return 0;
  return Math.max(0, Math.min(1, value / denominator));
}
