'use client';

import { create } from 'zustand';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import {
  applyKeiExportEvent,
  type KeiExportItemProgress,
  type KeiExportRequestBody,
} from '@/lib/keiAmerExportWebClient';

type KeiImportJobSnapshot = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  message: string;
  items: KeiExportItemProgress[];
  exported: Array<{
    offerId: number;
    portalUrl: string;
    publicUrl: string;
    editUrl: string;
    keiListingId?: string;
  }>;
  skipped: Array<{ portalUrl: string; reason: string; existingOfferId?: number; keiListingId?: string }>;
};

type KeiAmerExportState = {
  running: boolean;
  modalVisible: boolean;
  message: string;
  items: KeiExportItemProgress[];
  results: Array<{
    offerId: number;
    portalUrl: string;
    publicUrl: string;
    editUrl: string;
    keiListingId?: string;
  }>;
  skipped: number;
  jobId: string | null;
  onComplete?: () => void;
  setModalVisible: (visible: boolean) => void;
  startExport: (body: KeiExportRequestBody, initialItems: KeiExportItemProgress[], onComplete?: () => void) => void;
  cancelExport: () => void;
  hydrateFromServer: () => Promise<void>;
  clearSession: () => void;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let exportCancelledByUser = false;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function mapJob(job: KeiImportJobSnapshot): Partial<KeiAmerExportState> {
  const running = job.status === 'queued' || job.status === 'running';
  return {
    jobId: job.id,
    running,
    message: job.message || (running ? 'Import w toku na serwerze…' : 'Import zakończony.'),
    items: job.items || [],
    results: job.exported || [],
    skipped: job.skipped?.length || 0,
  };
}

async function pollOnce() {
  const state = useKeiAmerExportStore.getState();
  if (!state.jobId || exportCancelledByUser) return;
  try {
    const res = await fetch(`/api/admin/kei-amer/export-jobs/${state.jobId}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.job) return;
    const onComplete = state.onComplete;
    useKeiAmerExportStore.setState({
      ...mapJob(data.job as KeiImportJobSnapshot),
      ...(data.job.status === 'queued' || data.job.status === 'running'
        ? {}
        : { onComplete: undefined }),
    });
    if (data.job.status !== 'queued' && data.job.status !== 'running') {
      stopPolling();
      if (onComplete) queueMicrotask(() => onComplete());
    }
  } catch {
    /* keep last snapshot */
  }
}

function startPolling() {
  stopPolling();
  void pollOnce();
  pollTimer = setInterval(() => {
    void pollOnce();
  }, 1500);
}

export const useKeiAmerExportStore = create<KeiAmerExportState>((set, get) => ({
  running: false,
  modalVisible: false,
  message: '',
  items: [],
  results: [],
  skipped: 0,
  jobId: null,
  onComplete: undefined,

  setModalVisible: (visible) => set({ modalVisible: visible }),

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

  cancelExport: () => {
    const { running, jobId } = get();
    if (!running || !jobId) return;
    exportCancelledByUser = true;
    stopPolling();
    void fetch(`/api/admin/kei-amer/export-jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => undefined);
    set((state) => ({
      running: false,
      message: 'Anulowanie na serwerze…',
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
  },

  hydrateFromServer: async () => {
    try {
      const res = await fetch('/api/admin/kei-amer/export-jobs/active', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const active = (data.active?.[0] || null) as KeiImportJobSnapshot | null;
      if (!active) return;
      exportCancelledByUser = false;
      set({
        ...mapJob(active),
        modalVisible: active.status === 'queued' || active.status === 'running',
      });
      if (active.status === 'queued' || active.status === 'running') startPolling();
    } catch {
      /* ignore */
    }
  },

  startExport: (body, initialItems, onComplete) => {
    if (get().running) return;
    exportCancelledByUser = false;
    set({
      running: true,
      modalVisible: true,
      message: 'Uruchamiam import na serwerze…',
      items: initialItems,
      results: [],
      skipped: 0,
      jobId: null,
      onComplete,
    });

    void (async () => {
      try {
        const res = await fetch('/api/admin/kei-amer/export-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.job) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (exportCancelledByUser) return;
        set({
          ...mapJob(data.job as KeiImportJobSnapshot),
          onComplete,
          modalVisible: true,
        });
        if (data.job.status === 'queued' || data.job.status === 'running') {
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
      }
    })();
  },
}));

// Keep event helper type referenced for compatibility with older SSE UI paths.
export type { KeiExportProgressEvent };
