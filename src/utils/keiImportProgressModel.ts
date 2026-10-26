/**
 * Uczciwy model postępu importu — wspólny dla okna, pigułki i panelu automatyzacji.
 *
 * Wagi etapów odpowiadają realnemu czasowi: pobranie z portalu ~15%, opis AI ~35%,
 * zdjęcia ~40% (liczone zdjęcie po zdjęciu), reszta ~10%. Dla importu automatycznego
 * cel to liczba ofert do opublikowania, a nie wielkość puli kandydatów.
 */

export type KeiStepId = 'check_duplicate' | 'fetch_portal' | 'create_offer' | 'images' | 'activate';

export const KEI_STEP_ORDER: KeiStepId[] = ['check_duplicate', 'fetch_portal', 'create_offer', 'images', 'activate'];

export const KEI_STEP_TITLES: Record<KeiStepId, string> = {
  check_duplicate: 'Sprawdzenie',
  fetch_portal: 'Portal',
  create_offer: 'Opis AI',
  images: 'Zdjęcia',
  activate: 'Publikacja',
};

const STEP_WEIGHT: Record<KeiStepId, number> = {
  check_duplicate: 5,
  fetch_portal: 15,
  create_offer: 35,
  images: 40,
  activate: 5,
};

export type KeiProgressItem = {
  index: number;
  status: 'pending' | 'active' | 'done' | 'skipped';
  currentStep: KeiStepId | null;
  completedSteps: KeiStepId[];
  imageProgress?: { index: number; total: number } | null;
  skipKind?: string | null;
  publishState?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export function keiItemPercent(item: KeiProgressItem): number {
  if (item.status === 'done' || item.status === 'skipped') return 100;
  if (item.status === 'pending') return 0;
  let total = 0;
  for (const step of KEI_STEP_ORDER) {
    if (item.completedSteps.includes(step) && step !== item.currentStep) total += STEP_WEIGHT[step];
  }
  if (item.currentStep) {
    const weight = STEP_WEIGHT[item.currentStep];
    if (item.currentStep === 'images' && item.imageProgress && item.imageProgress.total > 0) {
      total += weight * Math.min(1, item.imageProgress.index / item.imageProgress.total);
    } else {
      // Etap w toku liczymy do 40% jego wagi — pasek nie skacze, a 100% oznacza naprawdę koniec.
      total += weight * 0.4;
    }
  }
  return Math.max(1, Math.min(99, Math.round(total)));
}

export type KeiJobProgress = {
  percent: number;
  published: number;
  review: number;
  duplicates: number;
  failed: number;
  skipped: number;
  goal: number;
  finished: boolean;
  /** Szacowany czas do końca w sekundach (null, dopóki nie ma choć jednej ukończonej oferty). */
  etaSeconds: number | null;
  headline: string;
};

export function summarizeKeiJob(params: {
  items: KeiProgressItem[];
  running: boolean;
  source?: 'manual' | 'auto';
  targetCount?: number;
}): KeiJobProgress {
  const items = params.items;
  const done = items.filter((item) => item.status === 'done');
  const published = done.filter((item) => item.publishState !== 'review').length;
  const review = done.length - published;
  const skippedItems = items.filter((item) => item.status === 'skipped');
  const duplicates = skippedItems.filter((item) => item.skipKind === 'duplicate').length;
  const failed = skippedItems.filter((item) => item.skipKind === 'error').length;
  const isAuto = params.source === 'auto';
  const goal = isAuto ? Math.max(1, params.targetCount || 1) : Math.max(1, items.length);
  const active = items.find((item) => item.status === 'active');

  let percent: number;
  if (!params.running) {
    percent = 100;
  } else if (isAuto) {
    const partial = active ? keiItemPercent(active) / 100 : 0;
    percent = Math.round(Math.min(0.99, (done.length + partial) / goal) * 100);
  } else {
    percent = Math.round(items.reduce((sum, item) => sum + keiItemPercent(item), 0) / goal);
    percent = Math.min(99, percent);
  }

  const durations = done
    .map((item) => (item.startedAt && item.finishedAt ? new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime() : NaN))
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  let etaSeconds: number | null = null;
  if (params.running && durations.length > 0) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const remainingItems = isAuto ? Math.max(0, goal - done.length) : items.filter((i) => i.status === 'pending' || i.status === 'active').length;
    const activeShare = active ? 1 - keiItemPercent(active) / 100 : 0;
    const remaining = Math.max(0, remainingItems - (active ? 1 : 0) + activeShare);
    etaSeconds = Math.round((avg * remaining) / 1000);
  }

  const parts: string[] = [];
  if (isAuto) parts.push(`${published + review} z ${goal} ${goal === 1 ? 'oferty' : 'ofert'}`);
  else parts.push(`${done.length} z ${items.length} gotowe`);
  if (review) parts.push(`${review} do przejrzenia`);
  if (duplicates) parts.push(`${duplicates} już w bazie`);
  if (failed) parts.push(`${failed} z błędem`);

  return {
    percent,
    published,
    review,
    duplicates,
    failed,
    skipped: skippedItems.length,
    goal,
    finished: !params.running,
    etaSeconds,
    headline: parts.join(' · '),
  };
}

export function formatEta(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 45) return 'mniej niż minuta';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `ok. ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `ok. ${hours} godz. ${minutes % 60} min`;
}

export function formatPricePl(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(price)} zł`;
}
