import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  KEI_IMPORT_STEPS,
  type KeiAiRewriteProgress,
  type KeiExportProgressEvent,
  type KeiExportRequest,
  type KeiExportResultItem,
  type KeiImportStepId,
} from '../contracts/keiAmerContract';
import { keiAmerExportStream, cancelKeiAmerExportStream, reconcileExportItemsFromResult } from '../services/keiAmerService';

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

function applyExportEvent(
  state: Pick<KeiAmerExportState, 'items' | 'message' | 'results' | 'skipped' | 'running'>,
  event: KeiExportProgressEvent,
): Partial<KeiAmerExportState> | null {
  if (event.type === 'connected') {
    return { message: event.message };
  }
  if (event.type === 'batch_start') {
    return { message: `Import ${event.total} ogłoszeń…` };
  }
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
  if (event.type === 'floor_plan_decision') {
    return {
      items: state.items.map((item) =>
        item.index !== event.index
          ? item
          : {
              ...item,
              stepDetail: event.asFloorPlan
                ? 'Wybrane zdjęcie zostanie zapisane jako rzut'
                : 'Zdjęcia trafią tylko do galerii',
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
  if (event.type === 'batch_done') {
    return { message: event.message };
  }
  if (event.type === 'result') {
    const patches = reconcileExportItemsFromResult(state.items, event);
    const nextItems =
      patches.length === 0
        ? state.items
        : state.items.map((item) => {
            const patch = patches.find((p) => p.index === item.index)?.patch;
            return patch ? { ...item, ...(patch as Partial<KeiExportItemProgress>) } : item;
          });
    void Haptics.notificationAsync(
      (event.exported?.length || 0) > 0
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    return {
      items: nextItems,
      results: event.exported || [],
      skipped: event.skipped?.length || 0,
      message: event.message || 'Import zakończony.',
      running: false,
    };
  }
  if (event.type === 'error') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return { message: event.message, running: false };
  }
  return null;
}

type KeiAmerExportState = {
  running: boolean;
  modalVisible: boolean;
  message: string;
  items: KeiExportItemProgress[];
  results: KeiExportResultItem[];
  skipped: number;
  onComplete?: () => void;
  setModalVisible: (visible: boolean) => void;
  cancelExport: () => void;
  startExport: (
    token: string,
    body: KeiExportRequest,
    initialItems: KeiExportItemProgress[],
    onComplete?: () => void,
  ) => void;
  clearSession: () => void;
};

let exportInflight: Promise<void> | null = null;

export const useKeiAmerExportStore = create<KeiAmerExportState>((set, get) => ({
  running: false,
  modalVisible: false,
  message: '',
  items: [],
  results: [],
  skipped: 0,
  onComplete: undefined,

  setModalVisible: (visible) => set({ modalVisible: visible }),

  cancelExport: () => {
    if (!get().running) return;
    cancelKeiAmerExportStream();
    exportInflight = null;
    set((state) => ({
      running: false,
      message: 'Import zatrzymany.',
      onComplete: undefined,
      items: state.items.map((item) =>
        item.status === 'pending' || item.status === 'active'
          ? {
              ...item,
              status: 'skipped' as const,
              currentStep: null,
              stepLabel: 'Anulowano',
              reason: 'Przerwano ręcznie przez administratora',
            }
          : item,
      ),
    }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  clearSession: () => {
    if (get().running) return;
    set({
      message: '',
      items: [],
      results: [],
      skipped: 0,
      onComplete: undefined,
    });
  },

  startExport: (token, body, initialItems, onComplete) => {
    if (exportInflight) return;

    set({
      running: true,
      modalVisible: true,
      message: 'Rozpoczynam import…',
      items: initialItems,
      results: [],
      skipped: 0,
      onComplete,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    exportInflight = keiAmerExportStream(token, body, (event) => {
      if (event.type === 'result') {
        const cb = get().onComplete;
        set((state) => {
          const patch = applyExportEvent(state, event);
          return patch ? { ...state, ...patch, onComplete: undefined } : state;
        });
        queueMicrotask(() => cb?.());
        return;
      }
      set((state) => {
        const patch = applyExportEvent(state, event);
        return patch ? { ...state, ...patch } : state;
      });
    })
      .catch((error) => {
        if (!get().running) return;
        const cancelled = error instanceof Error && error.message.includes('zatrzymany');
        set({
          running: false,
          message: cancelled
            ? 'Import zatrzymany.'
            : error instanceof Error
              ? error.message
              : 'Eksport nie powiódł się',
        });
        if (!cancelled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      })
      .finally(() => {
        exportInflight = null;
        set((state) => (state.running ? { running: false } : state));
      });
  },
}));

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
