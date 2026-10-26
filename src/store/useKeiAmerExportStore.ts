'use client';

import { create } from 'zustand';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import type { KeiExportItemProgress, KeiExportRequestBody } from '@/lib/keiAmerExportWebClient';

export type KeiWebJobSnapshot = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  message: string;
  source?: 'manual' | 'auto';
  targetCount?: number;
  cancelRequested?: boolean;
  createdAt?: string;
  finishedAt?: string | null;
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
  /** Użytkownik poprosił o zatrzymanie — serwer kończy bieżącą pozycję. */
  stopping: boolean;
  modalVisible: boolean;
  message: string;
  jobStatus: KeiWebJobSnapshot['status'] | null;
  source: 'manual' | 'auto';
  targetCount: number;
  items: KeiExportItemProgress[];
  results: KeiWebJobSnapshot['exported'];
  skipped: number;
  jobId: string | null;
  error: string | null;
  onComplete?: () => void;
  setModalVisible: (visible: boolean) => void;
  startExport: (body: KeiExportRequestBody, initialItems: KeiExportItemProgress[], onComplete?: () => void) => void;
  cancelExport: () => void;
  /** Podgląd dowolnego zadania (np. z historii w Automatyzacji). */
  openJob: (jobId: string) => void;
  hydrateFromServer: () => Promise<void>;
  clearSession: () => void;
};

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollFailures = 0;

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function isLive(status: string | null | undefined) {
  return status === 'queued' || status === 'running';
}

function mapJob(job: KeiWebJobSnapshot): Partial<KeiAmerExportState> {
  const running = isLive(job.status);
  return {
    jobId: job.id,
    running,
    stopping: running && Boolean(job.cancelRequested),
    jobStatus: job.status,
    source: job.source === 'auto' ? 'auto' : 'manual',
    targetCount: Number(job.targetCount) || 0,
    message: job.message || (running ? 'Import w toku na serwerze…' : 'Import zakończony.'),
    items: job.items || [],
    results: job.exported || [],
    skipped: job.skipped?.length || 0,
    error: job.status === 'error' ? job.message || 'Import zakończył się błędem.' : null,
  };
}

async function pollOnce(): Promise<boolean> {
  const state = useKeiAmerExportStore.getState();
  if (!state.jobId) return false;
  try {
    const res = await fetch(`/api/admin/kei-amer/export-jobs/${state.jobId}`, { cache: 'no-store', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.job) {
      pollFailures += 1;
      return pollFailures < 20;
    }
    pollFailures = 0;
    const job = data.job as KeiWebJobSnapshot;
    const onComplete = state.onComplete;
    useKeiAmerExportStore.setState({
      ...mapJob(job),
      ...(isLive(job.status) ? {} : { onComplete: undefined }),
    });
    if (!isLive(job.status)) {
      if (onComplete) queueMicrotask(() => onComplete());
      return false;
    }
    return true;
  } catch {
    pollFailures += 1;
    return pollFailures < 20;
  }
}

/** Odpytywanie z rytmem: szybko, gdy karta jest widoczna; rzadziej w tle. */
function startPolling() {
  stopPolling();
  pollFailures = 0;
  const loop = async () => {
    const keepGoing = await pollOnce();
    if (!keepGoing) {
      pollTimer = null;
      return;
    }
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    pollTimer = setTimeout(loop, visible ? 1200 : 5000);
  };
  void loop();
}

export const useKeiAmerExportStore = create<KeiAmerExportState>((set, get) => ({
  running: false,
  stopping: false,
  modalVisible: false,
  message: '',
  jobStatus: null,
  source: 'manual',
  targetCount: 0,
  items: [],
  results: [],
  skipped: 0,
  jobId: null,
  error: null,
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
      jobStatus: null,
      error: null,
      stopping: false,
      onComplete: undefined,
    });
  },

  cancelExport: () => {
    const { running, jobId } = get();
    if (!running || !jobId) return;
    // Uczciwy stan: serwer kończy bieżącą ofertę, a okno pokazuje to, co naprawdę się stało.
    set({ stopping: true, message: 'Zatrzymuję import — kończę bieżącą ofertę…' });
    void fetch(`/api/admin/kei-amer/export-jobs/${jobId}/cancel`, { method: 'POST', credentials: 'include' })
      .catch(() => undefined)
      .finally(() => startPolling());
  },

  openJob: (jobId) => {
    stopPolling();
    set({ jobId, modalVisible: true, items: [], message: 'Wczytuję postęp…', error: null });
    startPolling();
  },

  hydrateFromServer: async () => {
    try {
      const res = await fetch('/api/admin/kei-amer/export-jobs/active', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = (data.active || data.jobs || []) as KeiWebJobSnapshot[];
      const live = list.find((job) => isLive(job.status)) || null;
      if (!live) return;
      set({ ...mapJob(live) });
      startPolling();
    } catch {
      /* offline / brak uprawnień */
    }
  },

  startExport: (body, initialItems, onComplete) => {
    if (get().running) return;
    set({
      running: true,
      stopping: false,
      modalVisible: true,
      message: 'Uruchamiam import na serwerze…',
      jobStatus: 'queued',
      source: 'manual',
      targetCount: initialItems.length,
      items: initialItems,
      results: [],
      skipped: 0,
      jobId: null,
      error: null,
      onComplete,
    });

    void (async () => {
      try {
        const res = await fetch('/api/admin/kei-amer/export-jobs', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.job) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        set({ ...mapJob(data.job as KeiWebJobSnapshot), onComplete, modalVisible: true });
        if (isLive(data.job.status)) startPolling();
        else queueMicrotask(() => onComplete?.());
      } catch (error) {
        set({
          running: false,
          jobStatus: 'error',
          error: error instanceof Error ? error.message : 'Import nie wystartował.',
          message: error instanceof Error ? error.message : 'Import nie wystartował.',
        });
      }
    })();
  },
}));

export type { KeiExportProgressEvent };
