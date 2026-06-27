import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';

export type KeiExportRequestBody = {
  targetUserId?: number;
  agentCommissionPercent?: number;
  count?: number;
  propertyKind?: 'apartment' | 'house';
  transactionKind?: 'sale' | 'rent';
  selections?: Array<{ keiId?: string; portalUrl: string; address?: string }>;
  floorPlanOverrides?: Record<string, boolean>;
  floorPlanSelections?: Record<string, { enabled: boolean; imageIndex: number }>;
};

function normalizeSseBuffer(raw: string): string {
  return raw.replace(/\r\n/g, '\n');
}

export function parseSseEvents(buffer: string, onEvent: (event: KeiExportProgressEvent) => void): string {
  const normalized = normalizeSseBuffer(buffer);
  const parts = normalized.split('\n\n');
  const rest = parts.pop() || '';
  for (const block of parts) {
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.replace(/^data:\s?/, '');
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as KeiExportProgressEvent);
      } catch {
        /* ignore malformed */
      }
    }
  }
  return rest;
}

export async function keiAmerExportStreamWeb(
  body: KeiExportRequestBody,
  onEvent: (event: KeiExportProgressEvent) => void,
): Promise<void> {
  const res = await fetch('/api/admin/kei-amer/export-stream', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(String((data as { error?: string })?.error || `Eksport nie powiódł się (${res.status})`));
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Brak strumienia odpowiedzi.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseEvents(buffer, onEvent);
  }
  if (buffer.trim()) parseSseEvents(`${buffer}\n\n`, onEvent);
}

export const KEI_IMPORT_STEPS = [
  'check_duplicate',
  'fetch_portal',
  'create_offer',
  'images',
  'activate',
] as const;

export type KeiImportStepId = (typeof KEI_IMPORT_STEPS)[number];

export const KEI_STEP_LABELS: Record<KeiImportStepId, string> = {
  check_duplicate: 'Duplikat',
  fetch_portal: 'Portal',
  create_offer: 'Oferta',
  images: 'Zdjęcia',
  activate: 'Publikacja',
};

export type KeiAiRewriteProgress = {
  working: boolean;
  rewrittenByAi: boolean;
  titleBefore: string;
  titleAfter: string;
  descriptionBefore: string;
  descriptionAfter: string;
  skipReason?: string;
};

export type KeiExportItemProgress = {
  index: number;
  keiListingId: string;
  portalUrl: string;
  address?: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
  completedSteps: KeiImportStepId[];
  currentStep: KeiImportStepId | null;
  stepLabel: string;
  stepDetail?: string;
  imageProgress?: { index: number; total: number; label: string; asFloorPlan: boolean };
  offerId?: number;
  publicUrl?: string;
  editUrl?: string;
  reason?: string;
  aiRewrite?: KeiAiRewriteProgress;
};

function mergeCompletedSteps(existing: KeiImportStepId[], step: KeiImportStepId): KeiImportStepId[] {
  const stepIdx = KEI_IMPORT_STEPS.indexOf(step);
  const completedSteps = [...existing];
  for (let i = 0; i < stepIdx; i += 1) {
    const prior = KEI_IMPORT_STEPS[i];
    if (!completedSteps.includes(prior)) completedSteps.push(prior);
  }
  return completedSteps;
}

export function applyKeiExportEvent(
  state: {
    items: KeiExportItemProgress[];
    message: string;
    results: Array<{
      offerId: number;
      portalUrl: string;
      publicUrl: string;
      editUrl: string;
      keiListingId?: string;
    }>;
    skipped: number;
    running: boolean;
  },
  event: KeiExportProgressEvent,
): Partial<typeof state> | null {
  if (event.type === 'connected') return { message: event.message };
  if (event.type === 'batch_start') return { message: `Import ${event.total} ogłoszeń…` };
  if (event.type === 'item_start') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              status: 'active',
              keiListingId: event.keiListingId,
              portalUrl: event.portalUrl,
              address: event.address ?? item.address,
              currentStep: 'check_duplicate',
              stepLabel: 'Sprawdzanie duplikatu…',
            },
      ),
    };
  }
  if (event.type === 'step') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              status: 'active',
              currentStep: event.step,
              stepLabel: event.label,
              stepDetail: event.detail ?? item.stepDetail,
              completedSteps: mergeCompletedSteps(item.completedSteps, event.step),
            },
      ),
    };
  }
  if (event.type === 'ai_rewrite') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              status: 'active',
              currentStep: 'create_offer',
              stepLabel: event.rewrite.working ? 'AI przepisuje opis…' : 'Opis gotowy',
              stepDetail: event.rewrite.working ? 'GPT' : event.rewrite.rewrittenByAi ? 'AI ✓' : 'reguły',
              completedSteps: mergeCompletedSteps(item.completedSteps, 'create_offer'),
              aiRewrite: event.rewrite,
            },
      ),
    };
  }
  if (event.type === 'image_progress') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              status: 'active',
              currentStep: 'images',
              stepLabel: event.asFloorPlan
                ? `Zdjęcie ${event.imageIndex}/${event.imageTotal} (rzut)`
                : event.label,
              stepDetail: event.asFloorPlan
                ? 'Wybrane zdjęcie zapisywane jako rzut mieszkania'
                : item.stepDetail,
              completedSteps: mergeCompletedSteps(item.completedSteps, 'images'),
              imageProgress: {
                index: event.imageIndex,
                total: event.imageTotal,
                label: event.label,
                asFloorPlan: event.asFloorPlan,
              },
            },
      ),
    };
  }
  if (event.type === 'item_done') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              status: 'done',
              currentStep: null,
              stepLabel: 'Gotowe',
              offerId: event.offerId,
              publicUrl: event.publicUrl,
              editUrl: event.editUrl,
              completedSteps: [...KEI_IMPORT_STEPS],
            },
      ),
      results: [
        ...state.results.filter((r) => r.portalUrl !== event.portalUrl),
        {
          offerId: event.offerId,
          portalUrl: event.portalUrl,
          publicUrl: event.publicUrl,
          editUrl: event.editUrl,
          keiListingId: event.keiListingId,
        },
      ],
    };
  }
  if (event.type === 'item_skip') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              status: 'skipped',
              currentStep: null,
              stepLabel: 'Pominięto',
              reason: event.existingOfferId
                ? `${event.reason} (oferta #${event.existingOfferId})`
                : event.reason,
              completedSteps: [],
            },
      ),
      skipped: state.skipped + 1,
    };
  }
  if (event.type === 'batch_done') return { message: event.message };
  if (event.type === 'result') {
    const patches = reconcileExportItemsFromResult(state.items, event);
    const nextItems =
      patches.length === 0
        ? state.items
        : state.items.map((item) => {
            const patch = patches.find((p) => p.index === item.index)?.patch;
            return patch ? { ...item, ...(patch as Partial<KeiExportItemProgress>) } : item;
          });
    return {
      items: nextItems,
      results: event.exported || [],
      skipped: event.skipped?.length || 0,
      message: event.message || 'Import zakończony.',
      running: false,
    };
  }
  if (event.type === 'error') return { message: event.message, running: false };
  return null;
}

export function reconcileExportItemsFromResult(
  items: Array<{ index: number; portalUrl: string; status: string }>,
  result: Extract<KeiExportProgressEvent, { type: 'result' }>,
): Array<{ index: number; patch: Record<string, unknown> }> {
  const patches: Array<{ index: number; patch: Record<string, unknown> }> = [];
  const skippedByUrl = new Map((result.skipped || []).map((r) => [r.portalUrl, r]));

  for (const item of items) {
    if (item.status !== 'pending' && item.status !== 'active') continue;
    const exported = (result.exported || []).find((r) => r.portalUrl === item.portalUrl);
    if (exported) {
      patches.push({
        index: item.index,
        patch: {
          status: 'done',
          stepLabel: 'Gotowe',
          currentStep: null,
          completedSteps: [...KEI_IMPORT_STEPS],
          offerId: exported.offerId,
          publicUrl: exported.publicUrl,
          editUrl: exported.editUrl,
        },
      });
      continue;
    }
    const skipped = skippedByUrl.get(item.portalUrl);
    if (skipped) {
      patches.push({
        index: item.index,
        patch: {
          status: 'skipped',
          stepLabel: 'Pominięto',
          currentStep: null,
          reason: skipped.existingOfferId
            ? `${skipped.reason} (oferta #${skipped.existingOfferId})`
            : skipped.reason,
        },
      });
      continue;
    }
    patches.push({
      index: item.index,
      patch: {
        status: 'skipped',
        stepLabel: 'Pominięto',
        currentStep: null,
        reason: 'Import zakończony bez tej pozycji',
      },
    });
  }
  return patches;
}

export function computeKeiItemPercent(item: KeiExportItemProgress): number {
  if (item.status === 'done' || item.status === 'skipped') return 100;
  if (item.status === 'pending') return 0;
  const stepIdx = item.currentStep ? KEI_IMPORT_STEPS.indexOf(item.currentStep) : 0;
  const base = (Math.max(stepIdx, 0) + 0.35) / KEI_IMPORT_STEPS.length;
  let imagePart = 0;
  if (item.currentStep === 'images' && item.imageProgress && item.imageProgress.total > 0) {
    imagePart = item.imageProgress.index / item.imageProgress.total / KEI_IMPORT_STEPS.length;
  }
  return Math.min(98, Math.round((base + imagePart) * 100));
}

export function computeKeiOverallPercent(items: KeiExportItemProgress[]): number {
  if (items.length === 0) return 0;
  return Math.round(items.reduce((acc, item) => acc + computeKeiItemPercent(item), 0) / items.length);
}
