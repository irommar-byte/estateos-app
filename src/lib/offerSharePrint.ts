import type { OfferShareCard } from '@/lib/offerShareLanding';

export function truncateOfferShareDescription(text: string | null | undefined, max = 420): string {
  const plain = String(text || '').trim();
  if (!plain) return '';
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

export function buildOfferShareQrSrc(url: string, size = 240): string {
  const safeSize = Number.isFinite(size) ? Math.min(480, Math.max(80, Math.round(size))) : 240;
  return `/api/qr?size=${safeSize}&data=${encodeURIComponent(url)}`;
}

export function buildOfferShareMapSrc(lat: number, lng: number): string {
  return `/api/map/static?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
}

export function offerSharePrintFilename(card: OfferShareCard): string {
  const slug = card.title
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `estateos-oferta-${card.id}${slug ? `-${slug}` : ''}.pdf`;
}

const PRINT_BODY_CLASS = 'offer-share-printing';
const PDF_CAPTURE_CLASS = 'offer-share-pdf-capturing';

export function printOfferShareBrochure(): void {
  document.body.classList.add(PRINT_BODY_CLASS);
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  requestAnimationFrame(() => {
    window.print();
  });
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

export async function downloadOfferSharePdf(root: HTMLElement, filename: string): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
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
    await waitForImages(root);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#f7f3ea',
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
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
              clonePortal.style.zIndex = '1';
            }
            if (cloneRoot) {
              cloneRoot.style.width = '210mm';
              cloneRoot.style.minHeight = '297mm';
              cloneRoot.style.maxHeight = '297mm';
              cloneRoot.style.background = '#f7f3ea';
            }
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css'] },
      })
      .from(root)
      .save();
  } finally {
    if (portal) {
      if (prevStyle == null) portal.removeAttribute('style');
      else portal.setAttribute('style', prevStyle);
    }
    portal?.classList.remove(PDF_CAPTURE_CLASS);
    document.body.classList.remove(PDF_CAPTURE_CLASS);
  }
}
