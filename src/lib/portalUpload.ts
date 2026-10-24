/**
 * Wysyłanie plików z panelu klienta (przeglądarka): limit 20 MB, sprawdzenie przed wysłaniem,
 * pasek postępu (XHR) i zawsze konkretna przyczyna błędu — nigdy samo „nie udało się”.
 */
import { isAllowedContactAttachment } from '@/lib/contactAttachmentShared';

export const PORTAL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const PORTAL_UPLOAD_ACCEPT =
  'image/*,application/pdf,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.txt';

export type UploadProblem = { title: string; detail: string };

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
  /** bajty na sekundę (wygładzone) */
  speed: number;
  /** sekundy do końca, null gdy jeszcze nie wiadomo */
  etaSeconds: number | null;
  /** plik doszedł do serwera, serwer go zapisuje */
  processing: boolean;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

export function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  if (seconds < 1) return 'za chwilę';
  if (seconds < 60) return `ok. ${Math.ceil(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `ok. ${m} min${s ? ` ${s} s` : ''}`;
}

export function fileKind(file: { name: string; type: string }): 'image' | 'pdf' | 'heic' | 'other' {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif') || /\.(heic|heif)$/.test(name)) return 'heic';
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'other';
}

/** Sprawdzenie w przeglądarce, zanim cokolwiek poleci przez sieć. */
export function validatePortalFile(file: File): UploadProblem | null {
  if (!file.size) {
    return {
      title: 'Plik jest pusty (0 B)',
      detail:
        'Telefon nie zdążył go zapisać albo to skrót do pliku w chmurze (iCloud / Google Drive), który nie jest pobrany. Otwórz go raz w aplikacji Pliki i wybierz ponownie.',
    };
  }
  if (file.size > PORTAL_UPLOAD_MAX_BYTES) {
    return {
      title: `Plik jest za duży — ${formatBytes(file.size)}`,
      detail: `Limit to ${formatBytes(PORTAL_UPLOAD_MAX_BYTES)}. Zrób zdjęcie dokumentu zamiast skanu w najwyższej jakości, wyślij każdą stronę osobno albo zapisz PDF jako „zmniejszony rozmiar”.`,
    };
  }
  if (!isAllowedContactAttachment(file.type, file.name)) {
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : null;
    return {
      title: `Nieobsługiwany typ pliku${ext ? ` (.${ext})` : ''}`,
      detail: 'Wyślij zdjęcie (JPG, PNG, HEIC), PDF albo dokument Word / Excel.',
    };
  }
  return null;
}

function problemFromStatus(status: number, serverMessage: string | null, file: File, percent: number): UploadProblem {
  if (serverMessage) {
    const titles: Record<number, string> = {
      400: 'Serwer nie przyjął pliku',
      403: 'Brak uprawnień do wysłania',
      404: 'Link do panelu jest nieaktualny',
      409: 'Nie można dodać pliku do tej pozycji',
      413: 'Plik jest za duży',
      415: 'Nieobsługiwany typ pliku',
    };
    return { title: titles[status] || `Serwer odrzucił plik (kod ${status})`, detail: serverMessage };
  }
  if (status === 413) {
    return {
      title: `Plik jest za duży — ${formatBytes(file.size)}`,
      detail: `Serwer przyjmuje maksymalnie ${formatBytes(PORTAL_UPLOAD_MAX_BYTES)}. Zmniejsz plik albo wyślij strony osobno.`,
    };
  }
  if (status === 0) {
    return navigator.onLine
      ? {
          title: 'Połączenie zostało przerwane',
          detail: `Wysyłanie zatrzymało się przy ${percent}%. Najczęściej to słaby zasięg albo przełączenie z Wi-Fi na sieć komórkową. Spróbuj ponownie — plik nie został zapisany.`,
        }
      : { title: 'Brak internetu', detail: 'Telefon nie ma teraz połączenia z internetem. Połącz się z Wi-Fi lub siecią komórkową i spróbuj ponownie.' };
  }
  if (status >= 500) {
    return {
      title: `Serwer EstateOS chwilowo nie odpowiada (błąd ${status})`,
      detail: 'To nie jest problem z Twoim plikiem. Spróbuj ponownie za minutę — jeśli się powtórzy, napisz do agenta w czacie poniżej.',
    };
  }
  return { title: `Nieoczekiwana odpowiedź serwera (kod ${status})`, detail: 'Spróbuj ponownie. Jeśli to się powtórzy, napisz do agenta — podaj ten kod.' };
}

export type UploadHandle<T> = { promise: Promise<T>; abort: () => void };

/**
 * Wysyła FormData z postępem. Rozwiązuje się odpowiedzią JSON; odrzuca się obiektem UploadProblem
 * (title + detail) — zawsze z przyczyną.
 */
export function uploadWithProgress<T = Record<string, unknown>>(params: {
  url: string;
  form: FormData;
  file: File;
  onProgress?: (p: UploadProgress) => void;
  timeoutMs?: number;
}): UploadHandle<T> {
  const xhr = new XMLHttpRequest();
  let aborted = false;
  const promise = new Promise<T>((resolve, reject) => {
    const startedAt = performance.now();
    let lastAt = startedAt;
    let lastLoaded = 0;
    let speed = 0;
    let percent = 0;
    xhr.open('POST', params.url);
    xhr.timeout = params.timeoutMs ?? 5 * 60_000;
    xhr.responseType = 'text';
    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : params.file.size;
      const now = performance.now();
      const dt = (now - lastAt) / 1000;
      if (dt > 0.15) {
        const instant = (event.loaded - lastLoaded) / dt;
        speed = speed ? speed * 0.7 + instant * 0.3 : instant;
        lastAt = now;
        lastLoaded = event.loaded;
      }
      percent = total ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
      params.onProgress?.({
        loaded: event.loaded,
        total,
        percent,
        speed,
        etaSeconds: speed > 0 ? Math.max(0, (total - event.loaded) / speed) : null,
        processing: false,
      });
    };
    xhr.upload.onload = () => {
      percent = 100;
      params.onProgress?.({
        loaded: params.file.size,
        total: params.file.size,
        percent: 100,
        speed,
        etaSeconds: 0,
        processing: true,
      });
    };
    xhr.onload = () => {
      let json: Record<string, unknown> | null = null;
      try {
        json = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : null;
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && json) {
        resolve(json as T);
        return;
      }
      const message = json && typeof json.error === 'string' && json.error.trim() ? json.error.trim() : null;
      reject(problemFromStatus(xhr.status, message, params.file, percent));
    };
    xhr.onerror = () => reject(problemFromStatus(0, null, params.file, percent));
    xhr.ontimeout = () =>
      reject({
        title: 'Wysyłanie trwało zbyt długo',
        detail: `Po ${Math.round((xhr.timeout || 0) / 60000)} min przesłano ${percent}% pliku. Połączenie jest bardzo wolne — spróbuj przy Wi-Fi albo wyślij mniejszy plik.`,
      } satisfies UploadProblem);
    xhr.onabort = () => {
      if (aborted) reject({ title: 'Anulowano', detail: 'Przerwałeś wysyłanie — plik nie został zapisany.' } satisfies UploadProblem);
    };
    xhr.send(params.form);
  });
  return {
    promise,
    abort: () => {
      aborted = true;
      xhr.abort();
    },
  };
}

export function isUploadProblem(value: unknown): value is UploadProblem {
  return Boolean(value && typeof value === 'object' && 'title' in value && 'detail' in value);
}
