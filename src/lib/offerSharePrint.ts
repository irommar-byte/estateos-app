import type { OfferShareCard } from '@/lib/offerShareLanding';

export type OfferShareDownloadFormat = 'pdf' | 'jpeg';

const A4_MM_WIDTH = 210;
const A4_MM_HEIGHT = 297;
const SHEET_ID = 'offer-share-print-brochure';

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

function waitForImages(root: HTMLElement, timeoutMs = 10000): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          window.setTimeout(done, timeoutMs);
        }),
    ),
  ).then(() => undefined);
}

type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

async function loadHtml2Canvas(): Promise<Html2CanvasFn> {
  const mod = await import('html2canvas');
  return ((mod as { default?: Html2CanvasFn }).default || mod) as Html2CanvasFn;
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

function findSheet(): HTMLElement {
  const root = document.getElementById(SHEET_ID);
  if (!root) throw new Error('offer-sheet-missing');
  return root;
}

/**
 * Kartka w podglądzie jest pomniejszona (transform) — kopię do zdjęcia
 * odpinamy od skali i kładziemy w lewym górnym rogu, więc zawsze wychodzi pełne A4.
 */
async function captureSheet(root: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = await loadHtml2Canvas();
  if (document.fonts?.ready) await document.fonts.ready;
  await waitForImages(root);
  const width = root.offsetWidth || 794;
  const height = root.offsetHeight || 1123;
  return html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    x: 0,
    y: 0,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    onclone: (doc: Document) => {
      const clone = doc.getElementById(SHEET_ID);
      if (!clone) return;
      for (let node = clone.parentElement; node; node = node.parentElement) {
        node.style.transform = 'none';
      }
      Object.assign(clone.style, { position: 'fixed', left: '0px', top: '0px', margin: '0', zIndex: '2147483647' });
      fitSheetText(clone, true);
    },
  });
}

async function buildPdfBlob(root: HTMLElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const canvas = await captureSheet(root);
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, A4_MM_WIDTH, A4_MM_HEIGHT, undefined, 'FAST');
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
export async function printOfferShareBrochure(): Promise<void> {
  const blob = await buildPdfBlob(findSheet());
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
export async function exportOfferSharePdfBase64(): Promise<string> {
  return blobToBase64(await buildPdfBlob(findSheet()));
}

export async function downloadOfferSharePdf(filename: string): Promise<void> {
  const blob = await buildPdfBlob(findSheet());
  await deliverBlobFile(blob, filename, 'application/pdf');
}

export async function downloadOfferShareJpeg(filename: string): Promise<void> {
  const canvas = await captureSheet(findSheet());
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Nie udało się zbudować JPEG.'))),
      'image/jpeg',
      0.92,
    );
  });
  await deliverBlobFile(blob, filename, 'image/jpeg');
}
