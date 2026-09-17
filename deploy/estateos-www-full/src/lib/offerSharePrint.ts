import type { OfferShareCard } from '@/lib/offerShareLanding';

export type OfferShareDownloadFormat = 'pdf' | 'jpeg';

const A4_MM_WIDTH = 210;
const A4_MM_HEIGHT = 297;
const PRINT_CAPTURE_BG = '#efe6d2';

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

export function formatOfferShareFloor(floor: number | string | null | undefined): string | null {
  if (floor == null || String(floor).trim() === '') return null;
  const n = Number(floor);
  if (Number.isFinite(n) && n === 0) return 'Parter';
  return String(floor);
}

export function buildOfferShareQrSrc(url: string, size = 240): string {
  const safeSize = Number.isFinite(size) ? Math.min(480, Math.max(80, Math.round(size))) : 240;
  return `/api/qr?size=${safeSize}&data=${encodeURIComponent(url)}`;
}

export function buildOfferShareMapSrc(lat: number, lng: number): string {
  return `/api/map/static?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
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

const PRINT_BODY_CLASS = 'offer-share-printing';
const PDF_CAPTURE_CLASS = 'offer-share-pdf-capturing';

function isLikelyMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
}

function waitForImages(root: HTMLElement, timeoutMs = 10000): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return Promise.resolve();
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

async function withVisiblePrintPortal<T>(run: () => Promise<T>): Promise<T> {
  const portal = document.getElementById('offer-share-print-portal');
  const prevStyle = portal?.getAttribute('style');
  portal?.classList.add(PDF_CAPTURE_CLASS);
  document.body.classList.add(PDF_CAPTURE_CLASS);
  if (portal) {
    portal.style.position = 'fixed';
    portal.style.left = '0px';
    portal.style.top = '0px';
    portal.style.opacity = '1';
    portal.style.pointerEvents = 'none';
    portal.style.width = '210mm';
    portal.style.zIndex = '1';
  }

  try {
    return await run();
  } finally {
    if (portal) {
      if (prevStyle == null) portal.removeAttribute('style');
      else portal.setAttribute('style', prevStyle);
    }
    portal?.classList.remove(PDF_CAPTURE_CLASS);
    document.body.classList.remove(PDF_CAPTURE_CLASS);
  }
}

function lockBrochureToA4(el: HTMLElement): void {
  el.style.width = '210mm';
  el.style.height = '297mm';
  el.style.minHeight = '297mm';
  el.style.maxHeight = '297mm';
  el.style.overflow = 'hidden';
  el.style.margin = '0';
  el.style.boxSizing = 'border-box';
}

async function captureOfferShareCanvas(root: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = await loadHtml2Canvas();
  await waitForImages(root);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  lockBrochureToA4(root);
  const width = Math.max(1, root.offsetWidth);
  const height = Math.max(1, root.offsetHeight);
  return html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: PRINT_CAPTURE_BG,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    onclone: (doc: Document) => {
      const clonePortal = doc.getElementById('offer-share-print-portal');
      const cloneRoot = doc.getElementById('offer-share-print-brochure');
      if (clonePortal) {
        clonePortal.style.position = 'static';
        clonePortal.style.left = '0';
        clonePortal.style.top = '0';
        clonePortal.style.opacity = '1';
        clonePortal.style.pointerEvents = 'none';
        clonePortal.style.width = '210mm';
        clonePortal.style.height = '297mm';
        clonePortal.style.overflow = 'hidden';
      }
      if (cloneRoot) lockBrochureToA4(cloneRoot);
    },
  });
}

async function deliverBlobFile(blob: Blob, filename: string, mime: string): Promise<void> {
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };

  // iOS Safari often ignores <a download> — share sheet is the reliable path.
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch (err) {
      // User cancel should not fall through as failure noise for share-only flows.
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    if (isLikelyMobileBrowser()) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) {
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
  } catch {
    window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

async function buildOfferSharePdfBlob(root: HTMLElement): Promise<Blob> {
  const canvas = await captureOfferShareCanvas(root);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const img = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(img, 'JPEG', 0, 0, A4_MM_WIDTH, A4_MM_HEIGHT, undefined, 'FAST');
  return pdf.output('blob');
}

/** Prefer A4 PDF print — Safari Letter defaults no longer spill a hairline onto page 2. */
export async function printOfferShareBrochure(): Promise<void> {
  const root = document.getElementById('offer-share-print-brochure');
  if (!root) {
    window.print();
    return;
  }

  try {
    await withVisiblePrintPortal(async () => {
      const blob = await buildOfferSharePdfBlob(root);
      const url = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.src = url;
      document.body.appendChild(frame);

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('print-timeout')), 12_000);
        frame.onload = () => {
          window.clearTimeout(timeout);
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            resolve();
          } catch (err) {
            reject(err);
          }
        };
      });

      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    });
    return;
  } catch {
    // Fall back to classic DOM print with tightened @media print CSS.
  }

  document.body.classList.add(PRINT_BODY_CLASS);
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  await waitForImages(root);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  window.print();
}

export async function downloadOfferSharePdf(root: HTMLElement, filename: string): Promise<void> {
  await withVisiblePrintPortal(async () => {
    const blob = await buildOfferSharePdfBlob(root);
    await deliverBlobFile(blob, filename, 'application/pdf');
  });
}

export async function downloadOfferShareJpeg(root: HTMLElement, filename: string): Promise<void> {
  await withVisiblePrintPortal(async () => {
    const canvas = await captureOfferShareCanvas(root);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Nie udało się zbudować JPEG.'));
            return;
          }
          resolve(result);
        },
        'image/jpeg',
        0.92,
      );
    });
    await deliverBlobFile(blob, filename, 'image/jpeg');
  });
}
