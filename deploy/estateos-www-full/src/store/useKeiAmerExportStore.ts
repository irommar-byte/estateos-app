'use client';

import { create } from 'zustand';
import type { KeiExportProgressEvent } from '@/lib/keiAmerExportProgress';
import {
  applyKeiExportEvent,
  keiAmerExportStreamWeb,
  type KeiExportItemProgress,
  type KeiExportRequestBody,
} from '@/lib/keiAmerExportWebClient';

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
  onComplete?: () => void;
  setModalVisible: (visible: boolean) => void;
  startExport: (body: KeiExportRequestBody, initialItems: KeiExportItemProgress[], onComplete?: () => void) => void;
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

  startExport: (body, initialItems, onComplete) => {
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

    exportInflight = keiAmerExportStreamWeb(body, (event: KeiExportProgressEvent) => {
      if (event.type === 'result') {
        const cb = get().onComplete;
        set((state) => {
          const patch = applyKeiExportEvent(state, event);
          return patch ? { ...state, ...patch, onComplete: undefined } : state;
        });
        queueMicrotask(() => cb?.());
        return;
      }
      set((state) => {
        const patch = applyKeiExportEvent(state, event);
        return patch ? { ...state, ...patch } : state;
      });
    })
      .catch((error) => {
        set({
          running: false,
          message: error instanceof Error ? error.message : 'Eksport nie powiódł się',
        });
      })
      .finally(() => {
        exportInflight = null;
        set((state) => (state.running ? { running: false } : state));
      });
  },
}));
