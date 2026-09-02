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

export async function printOfferShareBrochure(): Promise<void> {
  const root = document.getElementById('offer-share-print-brochure');
  document.body.classList.add(PRINT_BODY_CLASS);
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  if (root) await waitForImages(root);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  window.print();
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

function triggerBrowserDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadOfferSharePdf(root: HTMLElement, filename: string): Promise<void> {
  await withVisiblePrintPortal(async () => {
    const canvas = await captureOfferShareCanvas(root);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const img = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(img, 'JPEG', 0, 0, A4_MM_WIDTH, A4_MM_HEIGHT, undefined, 'FAST');
    pdf.save(filename);
  });
}

export async function downloadOfferShareJpeg(root: HTMLElement, filename: string): Promise<void> {
  await withVisiblePrintPortal(async () => {
    const canvas = await captureOfferShareCanvas(root);
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Nie udało się zbudować JPEG.'));
            return;
          }
          const url = URL.createObjectURL(blob);
          triggerBrowserDownload(url, filename);
          window.setTimeout(() => URL.revokeObjectURL(url), 2500);
          resolve();
        },
        'image/jpeg',
        0.92,
      );
    });
  });
}
