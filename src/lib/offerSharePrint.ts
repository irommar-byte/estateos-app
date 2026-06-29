import type { OfferShareCard } from '@/lib/offerShareLanding';

export function truncateOfferShareDescription(text: string | null | undefined, max = 320): string {
  const plain = String(text || '').trim();
  if (!plain) return '';
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

export function buildOfferShareQrSrc(url: string, size = 140): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&bgcolor=ffffff&color=141416&data=${encodeURIComponent(url)}`;
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

export async function downloadOfferSharePdf(root: HTMLElement, filename: string): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const previous = root.getAttribute('style') || '';
  root.setAttribute(
    'style',
    'position:fixed;left:0;top:0;z-index:99999;background:#fff;width:210mm;max-width:210mm;',
  );
  try {
    await html2pdf()
      .set({
        margin: [7, 7, 7, 7],
        filename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(root)
      .save();
  } finally {
    if (previous) root.setAttribute('style', previous);
    else root.removeAttribute('style');
  }
}
