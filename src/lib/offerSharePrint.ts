import type { OfferShareCard } from '@/lib/offerShareLanding';

export type OfferShareDownloadFormat = 'pdf' | 'jpeg';

const A4_MM_WIDTH = 210;
const A4_MM_HEIGHT = 297;

export function truncateOfferShareDescription(text: string | null | undefined, max = 420): string {
  const plain = String(text || '').replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  if (plain.length <= max) return plain;

  const window = plain.slice(0, max + 1);
  let sentenceEnd = -1;
  for (let i = 0; i < window.length; i += 1) {
    const ch = window[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    const next = window[i + 1];
    if (next == null || next === ' ') sentenceEnd = i;
  }
  if (sentenceEnd >= Math.floor(max * 0.42)) {
    return window.slice(0, sentenceEnd + 1).trim();
  }

  const hard = plain.slice(0, Math.max(8, max - 1));
  const lastSpace = hard.lastIndexOf(' ');
  const cut = (lastSpace > 24 ? hard.slice(0, lastSpace) : hard).replace(/[,:;–—-]+$/g, '').trimEnd();
  return `${cut}…`;
}

export function buildOfferShareQrSrc(url: string, size = 240): string {
  const safeSize = Number.isFinite(size) ? Math.min(480, Math.max(80, Math.round(size))) : 240;
  return `/api/qr?size=${safeSize}&data=${encodeURIComponent(url)}`;
}

export function offerSharePrintFilename(
  card: OfferShareCard,
  format: OfferShareDownloadFormat = 'pdf',
): string {
  const slug = card.title
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const ext = format === 'jpeg' ? 'jpg' : 'pdf';
  return `estateos-oferta-${card.id}${slug ? `-${slug}` : ''}.${ext}`;
}

/**
 * Dopasowuje teksty kartki do ich ramek bez cięcia w połowie wiersza:
 * akapit, który się nie mieści, traci ostatnie słowa i dostaje „…”; jednowierszowy napis skraca się do szerokości.
 * Potem ramki tekstowe nie muszą już przycinać — html2canvas rysuje litery odrobinę niżej niż przeglądarka,
 * więc przycinanie zjadało dolny pasek liter.
 */
export function fitSheetText(root: HTMLElement, releaseOverflow = false): void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('*'));
  for (const el of nodes) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const cs = getComputedStyle(el);
    const clipsSelf = cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden';
    const parent = el.parentElement;
    const clipsParent = parent ? getComputedStyle(parent).overflow === 'hidden' && !parent.querySelector('img') : false;
    if (!clipsSelf && !clipsParent) continue;
    const box = clipsSelf ? el : parent!;
    const singleLine = cs.whiteSpace === 'nowrap';
    const overflows = () => (singleLine ? el.scrollWidth > el.clientWidth + 1 : box.scrollHeight > box.clientHeight + 1);
    if (overflows()) {
      const words = (el.dataset.fullText || el.textContent || '').trim().split(/\s+/);
      el.dataset.fullText = words.join(' ');
      while (words.length > 1 && overflows()) {
        words.pop();
        el.textContent = `${words.join(' ').replace(/[,;:·–—-]+$/, '')}…`;
      }
    }
    if (releaseOverflow) {
      el.style.overflow = 'visible';
      el.style.textOverflow = 'clip';
      if (clipsParent && parent) parent.style.overflow = 'visible';
      if (!singleLine) el.style.maxHeight = 'none';
    }
  }
}

export type OfferSheetStyleParam = 'galeria' | 'architekt' | 'pelna';

/** Adres ofertówki rysowanej na serwerze; przenosi ?agent= i ?portal= z bieżącej strony. */
export function offerSheetImageUrl(offerId: number, style: OfferSheetStyleParam): string {
  const params = new URLSearchParams({ styl: style });
  if (typeof window !== 'undefined') {
    const current = new URLSearchParams(window.location.search);
    for (const key of ['agent', 'portal']) {
      const value = current.get(key);
      if (value) params.set(key, value);
    }
  }
  return `/api/offer-sheet/${offerId}?${params.toString()}`;
}

const sheetCache = new Map<string, Promise<Blob>>();

/** Jeden obraz na styl — podgląd, PDF, JPEG i druk używają tego samego pliku. */
export function loadOfferSheetBlob(offerId: number, style: OfferSheetStyleParam): Promise<Blob> {
  const url = offerSheetImageUrl(offerId, style);
  let pending = sheetCache.get(url);
  if (!pending) {
    pending = fetch(url, { credentials: 'same-origin' }).then(async (res) => {
      if (!res.ok) throw new Error(`offer-sheet-${res.status}`);
      return res.blob();
    });
    pending.catch(() => sheetCache.delete(url));
    sheetCache.set(url, pending);
  }
  return pending;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('sheet-read'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

async function buildPdfBlob(offerId: number, style: OfferSheetStyleParam): Promise<Blob> {
  const [{ jsPDF }, image] = await Promise.all([import('jspdf'), loadOfferSheetBlob(offerId, style)]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.setProperties({ title: 'Ofertówka EstateOS™', creator: 'EstateOS™' });
  pdf.addImage(await blobToDataUrl(image), 'JPEG', 0, 0, A4_MM_WIDTH, A4_MM_HEIGHT, undefined, 'NONE');
  return pdf.output('blob');
}

/** Zapis pliku: zwykłe pobranie (działa też w Safari na iPhonie od iOS 13); arkusz udostępniania tylko awaryjnie. */
async function deliverBlobFile(blob: Blob, filename: string, mime: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const canDownload = typeof document !== 'undefined' && 'download' in HTMLAnchorElement.prototype;
  if (canDownload) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data?: ShareData) => Promise<void> };
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') return;
    }
  }
  window.location.assign(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Drukujemy gotowy PDF A4 — przeglądarka nie dokłada marginesów ani drugiej strony. */
export async function printOfferShareBrochure(offerId: number, style: OfferSheetStyleParam): Promise<void> {
  const blob = await buildPdfBlob(offerId, style);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.src = url;
  document.body.appendChild(frame);

  const printed = await new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 12_000);
    frame.onload = () => {
      window.clearTimeout(timeout);
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve(true);
      } catch {
        resolve(false);
      }
    };
  });

  // Safari na iOS nie drukuje z ramki — otwieramy PDF, a drukuje się go z podglądu.
  if (!printed) window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('pdf-read'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      const comma = raw.indexOf(',');
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.readAsDataURL(blob);
  });
}

/** PDF wybranej kartki jako base64 — dla aplikacji (WebView). */
export async function exportOfferSharePdfBase64(offerId: number, style: OfferSheetStyleParam): Promise<string> {
  return blobToBase64(await buildPdfBlob(offerId, style));
}

export async function downloadOfferSharePdf(offerId: number, style: OfferSheetStyleParam, filename: string): Promise<void> {
  await deliverBlobFile(await buildPdfBlob(offerId, style), filename, 'application/pdf');
}

export async function downloadOfferShareJpeg(offerId: number, style: OfferSheetStyleParam, filename: string): Promise<void> {
  await deliverBlobFile(await loadOfferSheetBlob(offerId, style), filename, 'image/jpeg');
}
