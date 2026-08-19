import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  KEI_IMPORT_STEPS,
  type KeiAiRewriteProgress,
  type KeiExportRequest,
  type KeiExportResultItem,
  type KeiImportJobSnapshot,
  type KeiImportStepId,
} from '../contracts/keiAmerContract';
import {
  keiAmerCancelExportJob,
  keiAmerFetchActiveExportJobs,
  keiAmerFetchExportJob,
  keiAmerStartExportJob,
} from '../services/keiAmerService';

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

function mapJobItems(job: KeiImportJobSnapshot): KeiExportItemProgress[] {
  return (job.items || []).map((item) => ({
    index: item.index,
    keiListingId: item.keiListingId,
    portalUrl: item.portalUrl,
    address: item.address,
    status: item.status,
    completedSteps: (item.completedSteps || []) as KeiImportStepId[],
    currentStep: item.currentStep,
    stepLabel: item.stepLabel,
    stepDetail: item.stepDetail,
    imageProgress: item.imageProgress,
    offerId: item.offerId,
    publicUrl: item.publicUrl,
    editUrl: item.editUrl,
    reason: item.reason,
  }));
}

type KeiAmerExportState = {
  running: boolean;
  modalVisible: boolean;
  message: string;
  source: 'manual' | 'auto';
  items: KeiExportItemProgress[];
  results: KeiExportResultItem[];
  skipped: number;
  jobId: string | null;
  authToken: string | null;
  onComplete?: () => void;
  setModalVisible: (visible: boolean) => void;
  cancelExport: () => void;
  startExport: (
    token: string,
    body: KeiExportRequest,
    initialItems: KeiExportItemProgress[],
    onComplete?: () => void,
  ) => void;
  hydrateFromServer: (token: string) => Promise<void>;
  clearSession: () => void;
};

function applyJobSnapshot(
  job: KeiImportJobSnapshot,
  onComplete?: () => void,
): Partial<KeiAmerExportState> {
  const running = job.status === 'queued' || job.status === 'running';
  const patch: Partial<KeiAmerExportState> = {
    jobId: job.id,
    running,
    source: job.source === 'auto' ? 'auto' : 'manual',
    message: job.message || (running ? 'Import w toku na serwerze…' : 'Import zakończony.'),
    items: mapJobItems(job),
    results: job.exported || [],
    skipped: job.skipped?.length || 0,
  };
  if (!running) {
    patch.onComplete = undefined;
    if (onComplete) queueMicrotask(() => onComplete());
    if (job.status === 'done') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (job.status === 'error') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (job.status === 'cancelled') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }
  return patch;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let exportCancelledByUser = false;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollOnce() {
  const state = useKeiAmerExportStore.getState();
  if (!state.authToken || !state.jobId || exportCancelledByUser) return;
  try {
    const res = await keiAmerFetchExportJob(state.authToken, state.jobId);
    if (exportCancelledByUser) return;
    if (!res.job) return;
    if (res.job.cancelRequested || res.job.status === 'cancelled') {
      stopPolling();
      useKeiAmerExportStore.setState({
        ...applyJobSnapshot({ ...res.job, status: 'cancelled' }),
        running: false,
      });
      return;
    }
    const onComplete = state.onComplete;
    useKeiAmerExportStore.setState(applyJobSnapshot(res.job, onComplete));
    if (res.job.status !== 'queued' && res.job.status !== 'running') {
      stopPolling();
    }
  } catch {
    /* keep last known progress — server job continues */
  }
}

function startPolling() {
  stopPolling();
  void pollOnce();
  pollTimer = setInterval(() => {
    void pollOnce();
  }, 1500);
}

export function isKeiExportStreamAlive(): boolean {
  const state = useKeiAmerExportStore.getState();
  return Boolean(state.running && state.jobId);
}

/** Po powrocie z tła: dociągnij postęp z serwera (job działa niezależnie od aplikacji). */
export function reconcileKeiExportAfterForeground(): void {
  const state = useKeiAmerExportStore.getState();
  if (!state.authToken) return;
  if (state.jobId) {
    startPolling();
    return;
  }
  void useKeiAmerExportStore.getState().hydrateFromServer(state.authToken);
}

export const useKeiAmerExportStore = create<KeiAmerExportState>((set, get) => ({
  running: false,
  modalVisible: false,
  message: '',
  source: 'manual',
  items: [],
  results: [],
  skipped: 0,
  jobId: null,
  authToken: null,
  onComplete: undefined,

  setModalVisible: (visible) => set({ modalVisible: visible }),

  cancelExport: () => {
    const { running, jobId, authToken } = get();
    if (!running) return;
    exportCancelledByUser = true;
    stopPolling();
    if (jobId && authToken) {
      void keiAmerCancelExportJob(authToken, jobId).catch(() => undefined);
    }
    set((state) => ({
      running: false,
      modalVisible: false,
      message: 'Import zatrzymany. Ukończone oferty zostają.',
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
    stopPolling();
    set({
      message: '',
      items: [],
      results: [],
      skipped: 0,
      jobId: null,
      onComplete: undefined,
    });
  },

  hydrateFromServer: async (token) => {
    set({ authToken: token });
    if (exportCancelledByUser) return;
    try {
      const res = await keiAmerFetchActiveExportJobs(token);
      if (exportCancelledByUser) return;
      const active =
        res.active?.[0] ||
        res.jobs?.find((j) => j.status === 'queued' || j.status === 'running') ||
        null;
      if (!active) return;
      if (active.cancelRequested || active.status === 'cancelled') return;
      set({
        ...applyJobSnapshot(active),
        authToken: token,
        modalVisible: false,
      });
      if (active.status === 'queued' || active.status === 'running') {
        startPolling();
      }
    } catch {
      /* ignore — offline / no admin */
    }
  },

  startExport: (token, body, initialItems, onComplete) => {
    if (get().running) return;

    exportCancelledByUser = false;
    set({
      running: true,
      modalVisible: false,
      message: 'Uruchamiam import na serwerze…',
      source: 'manual',
      items: initialItems,
      results: [],
      skipped: 0,
      jobId: null,
      authToken: token,
      onComplete,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    void (async () => {
      try {
        const started = await keiAmerStartExportJob(token, body);
        if (exportCancelledByUser) return;
        const job = started.job;
        set({
          ...applyJobSnapshot(job),
          authToken: token,
          onComplete,
          modalVisible: false,
        });
        if (job.status === 'queued' || job.status === 'running') {
          startPolling();
        } else {
          stopPolling();
          queueMicrotask(() => onComplete?.());
        }
      } catch (error) {
        if (exportCancelledByUser) return;
        set({
          running: false,
          message: error instanceof Error ? error.message : 'Eksport nie powiódł się',
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    })();
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
