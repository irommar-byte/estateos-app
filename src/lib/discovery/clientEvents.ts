import { DeviceEventEmitter } from 'react-native';

export const DISCOVERY_UPDATED_EVENT = 'estateos:discovery-updated';
export const INTELLIGENCE_LEARN_EVENT = 'estateos:intelligence-learn';
export const INTELLIGENCE_DISLIKE_PROMPT_EVENT = 'estateos:intelligence-dislike-prompt';
export const GUIDE_OPEN_EVENT = 'estateos:guide-open';
export const INTELLIGENCE_SHEET_OPEN_EVENT = 'estateos:intelligence-sheet-open';

export type DiscoveryUpdatedDetail = {
  offerId?: number;
  eventType?: string;
};

export type IntelligenceLearnDetail = {
  offerId?: number;
  eventType?: string;
  kind?: 'like' | 'dislike' | 'serious' | 'open' | 'other';
};

export type IntelligenceDislikePromptDetail = {
  offerId: number;
  source?: string;
};

function learnKind(eventType?: string): IntelligenceLearnDetail['kind'] {
  const t = String(eventType || '').toUpperCase();
  if (t.includes('LIKE') && !t.includes('DISLIKE')) return 'like';
  if (t.includes('DISLIKE')) return 'dislike';
  if (t.includes('SERIOUS') || t.includes('PRIORITY')) return 'serious';
  if (t.includes('OPEN')) return 'open';
  return 'other';
}

/** Broadcast after taste decisions so Kierunek / For You / Pulse reload. */
export function dispatchDiscoveryUpdated(detail?: DiscoveryUpdatedDetail) {
  DeviceEventEmitter.emit(DISCOVERY_UPDATED_EVENT, detail || {});
  const eventType = detail?.eventType;
  if (!eventType) return;
  const kind = learnKind(eventType);
  if (kind === 'like' || kind === 'dislike' || kind === 'serious') {
    DeviceEventEmitter.emit(INTELLIGENCE_LEARN_EVENT, {
      offerId: detail?.offerId,
      eventType,
      kind,
    } satisfies IntelligenceLearnDetail);
  }
}

export function subscribeDiscoveryUpdated(handler: (detail?: DiscoveryUpdatedDetail) => void) {
  const sub = DeviceEventEmitter.addListener(DISCOVERY_UPDATED_EVENT, handler);
  return () => sub.remove();
}

/** Water-splash cue for the Intelligence orb when the algorithm learns a taste signal. */
export function subscribeIntelligenceLearn(handler: (detail?: IntelligenceLearnDetail) => void) {
  const sub = DeviceEventEmitter.addListener(INTELLIGENCE_LEARN_EVENT, handler);
  return () => sub.remove();
}

/** Open the Intelligence orb sheet to ask why an offer was disliked (catalog rail). */
export function dispatchIntelligenceDislikePrompt(detail: IntelligenceDislikePromptDetail) {
  DeviceEventEmitter.emit(INTELLIGENCE_DISLIKE_PROMPT_EVENT, detail);
}

export function subscribeIntelligenceDislikePrompt(
  handler: (detail: IntelligenceDislikePromptDetail) => void,
) {
  const sub = DeviceEventEmitter.addListener(INTELLIGENCE_DISLIKE_PROMPT_EVENT, handler);
  return () => sub.remove();
}

/** Open Intelligence sheet (Guide + Pulse live in one brain panel). */
export function dispatchGuideOpen() {
  DeviceEventEmitter.emit(GUIDE_OPEN_EVENT);
}

export function subscribeGuideOpen(handler: () => void) {
  const sub = DeviceEventEmitter.addListener(GUIDE_OPEN_EVENT, handler);
  return () => sub.remove();
}

/**
 * Whether the Intelligence genie sheet currently owns the screen.
 * Whispers stay quiet while the brain panel speaks — one voice at a time.
 */
let intelligenceSheetOpen = false;

export function isIntelligenceSheetOpen() {
  return intelligenceSheetOpen;
}

export function dispatchIntelligenceSheetOpen(open: boolean) {
  const next = Boolean(open);
  if (next === intelligenceSheetOpen) return;
  intelligenceSheetOpen = next;
  DeviceEventEmitter.emit(INTELLIGENCE_SHEET_OPEN_EVENT, next);
}

export function subscribeIntelligenceSheetOpen(handler: (open: boolean) => void) {
  const sub = DeviceEventEmitter.addListener(INTELLIGENCE_SHEET_OPEN_EVENT, handler);
  return () => sub.remove();
}
