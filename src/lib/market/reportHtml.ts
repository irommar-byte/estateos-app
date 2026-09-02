import type { MarketComp, ValuationResult } from '@/lib/market/types';
import { sortCompsBySimilarity } from '@/lib/market/compSimilarity';
import { formatPln, formatPpsm } from '@/lib/market/format';

export const REPORT_PAGE1_COMPS = 8;

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSqm(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${String(n).replace('.', ',')} m²`;
}

function formatDistance(m: number) {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatFloor(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return 'parter';
  return String(n);
}

function formatLongDate(value?: Date | string | null) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function basisLabel(basis: ValuationResult['stats']['basis'], count: number) {
  if (basis === 'comps') return `${count} porównywalnych transakcji z najbliższej okolicy`;
  if (basis === 'district') return `${count} aktów z tej samej dzielnicy`;
  return `${count} aktów z tego miasta`;
}

function barRow(params: {
  label: string;
  amount: number;
  fill: string;
  max: number;
  accent?: boolean;
}) {
  const pct = params.max > 0 ? Math.max(8, Math.min(100, Math.round((params.amount / params.max) * 100))) : 8;
  const rest = 100 - pct;
  return `<tr>
    <td style="padding:10px 0 4px;border:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="font-size:12px;color:#5c5c63;padding:0 0 6px;border:0">${esc(params.label)}</td>
          <td align="right" style="font-size:14px;font-weight:700;letter-spacing:-0.02em;color:${params.accent ? '#0f766e' : '#111'};padding:0 0 6px;border:0;white-space:nowrap">${formatPln(params.amount)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:0;padding:0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef0f3;border-radius:999px">
              <tr>
                <td width="${pct}%" style="background:${params.fill};height:10px;border-radius:999px;font-size:0;line-height:0">&nbsp;</td>
                ${rest > 0 ? `<td width="${rest}%" style="font-size:0;line-height:0">&nbsp;</td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function buildPriceCompareChartHtml(result: ValuationResult) {
  const offerPrice = result.listingPrice && result.listingPrice > 0 ? result.listingPrice : null;
  const recommended = result.estimated.recommendedAsk;
  if (!offerPrice || !recommended) return '';

  const max = Math.max(offerPrice, recommended, result.estimated.high);
  const delta = offerPrice - recommended;
  const pct = recommended > 0 ? (delta / recommended) * 100 : 0;
  const absPct = Math.abs(pct).toFixed(1).replace('.', ',');
  const absPln = formatPln(Math.abs(delta));
  let caption: string;
  if (Math.abs(pct) < 1.5) {
    caption = 'Cena w ofercie jest zbliżona do rekomendacji wynikającej z porównywalnych aktów notarialnych.';
  } else if (delta < 0) {
    caption = `Cena w ofercie jest o ${absPln} (${absPct}%) niższa niż rekomendacja z aktów notarialnych.`;
  } else {
    caption = `Cena w ofercie jest o ${absPln} (${absPct}%) wyższa niż rekomendacja z aktów notarialnych.`;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;border-collapse:collapse">
    <tr><td style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b6b70;font-weight:700;padding:0 0 8px;border:0">Porównanie ceny oferty</td></tr>
    ${barRow({ label: 'Cena w ofercie', amount: offerPrice, fill: '#1d4ed8', max })}
    ${barRow({ label: 'Rekomendacja na podstawie aktów notarialnych', amount: recommended, fill: '#0f766e', max, accent: true })}
    <tr>
      <td style="padding:14px 0 0;border:0;font-size:13px;color:#44444a;line-height:1.55">
        Przedział z aktów: <strong style="color:#111">${formatPln(result.estimated.low)} – ${formatPln(result.estimated.high)}</strong>.
        ${esc(caption)}
      </td>
    </tr>
  </table>`;
}

function compsTable(comps: MarketComp[]) {
  if (!comps.length) {
    return `<p style="font-size:13px;color:#5c5c63;line-height:1.55;margin:12px 0 0">Brak listy pojedynczych transakcji w najbliższym promieniu — oszacowanie oparto o medianę obszaru.</p>`;
  }
  const rows = comps
    .map(
      (c) =>
        `<tr>
          <td>${esc(c.address || c.district || 'okolica')}</td>
          <td>${formatSqm(c.area)}</td>
          <td>${c.rooms ?? '—'}</td>
          <td>${formatFloor(c.floor)}</td>
          <td>${formatPln(c.price)}</td>
          <td>${formatPpsm(c.ppsm)}</td>
          <td>${formatDistance(c.distanceM)}</td>
          <td>${c.deedAt || '—'}</td>
        </tr>`,
    )
    .join('');
  return `<table class="grid">
    <thead>
      <tr>
        <th>Adres / okolica</th>
        <th>Metraż</th>
        <th>Pokoje</th>
        <th>Piętro</th>
        <th>Cena aktu</th>
        <th>zł/m²</th>
        <th>Odległość</th>
        <th>Data aktu</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function buildMarketReportHtml(
  result: ValuationResult,
  opts: { recipientName?: string | null; generatedAt?: Date | string | null } = {},
) {
  const s = result.subject;
  const comps = sortCompsBySimilarity(result.comps || [], s);
  const page1Comps = comps.slice(0, REPORT_PAGE1_COMPS);
  const page2Comps = comps.slice(REPORT_PAGE1_COMPS);
  const loc = [s.address, s.district, s.city].filter(Boolean).join(', ');
  const recipient = String(opts.recipientName || '').trim();
  const generated = formatLongDate(opts.generatedAt);
  const specs = [
    s.area ? formatSqm(s.area) : null,
    s.rooms != null ? `${s.rooms} pok.` : null,
    s.floor != null ? `piętro: ${formatFloor(s.floor)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const score = result.vsListing;
  const page2 =
    page2Comps.length > 0
      ? `<div class="page">
    <div class="kicker">Załącznik nr 1 · EstateOS™ Market</div>
    <h1>Porównywalne transakcje — ciąg dalszy</h1>
    <p class="lead">Kolejne akty notarialne z Rejestru Cen Nieruchomości, uporządkowane według zbliżenia parametrów do nieruchomości będącej przedmiotem analizy (metraż, liczba pokoi, piętro, następnie odległość).</p>
    ${compsTable(page2Comps)}
    <p class="foot">${esc(result.coverage.disclaimer)} Import: ${result.coverage.ingestedAt ? esc(result.coverage.ingestedAt.slice(0, 10)) : 'w toku'}. ${result.coverage.transactionCount.toLocaleString('pl-PL')} aktów w magazynie dla ${esc(result.coverage.city)}.</p>
  </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <title>Analiza wartości nieruchomości — EstateOS™ Market</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif; color: #16161a; background: #f3f2ef; margin: 0; padding: 24px 12px; }
    .page { max-width: 760px; margin: 0 auto 28px; background: #fff; border: 1px solid #e4e0d6; padding: 36px 40px 32px; }
    .kicker { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6b6b70; font-weight: 700; }
    h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 8px 0 4px; }
    .meta { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; color: #6b6b70; margin: 0 0 22px; }
    .lead { font-size: 15px; line-height: 1.55; color: #2a2a30; margin: 0 0 18px; }
    .hero { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    .hero td { vertical-align: top; padding: 0 18px 0 0; }
    .mid { font-size: 32px; font-weight: 650; letter-spacing: -0.03em; }
    .muted { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #5c5c63; font-size: 13px; line-height: 1.5; }
    .grid { width: 100%; border-collapse: collapse; margin-top: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; }
    .grid th, .grid td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ece8df; }
    .grid th { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #6b6b70; font-weight: 700; }
    .score { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px 0 0; padding: 12px 14px; border: 1px solid #ece8df; background: #faf8f4; }
    .score strong { display: block; font-size: 13px; margin-bottom: 4px; }
    .foot { margin-top: 26px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; color: #8a8a90; line-height: 1.55; }
    h2 { font-size: 16px; font-weight: 600; margin: 26px 0 6px; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { border: 0; margin: 0; padding: 0; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="kicker">EstateOS™ Market · dokument dla klienta</div>
    <h1>Analiza wartości nieruchomości</h1>
    <p class="meta">${esc(generated)}${recipient ? ` · przygotowano dla: ${esc(recipient)}` : ''} · źródło: Rejestr Cen Nieruchomości (GUGiK)</p>
    <p class="lead">Szanowni Państwo,<br/><br/>
    przekazujemy opracowanie wartości rynkowej nieruchomości na podstawie rzeczywistych aktów notarialnych, a nie ogłoszeń portalowych. Transakcje porównawcze uszeregowano od najbardziej zbliżonych parametrami (metraż, liczba pokoi, piętro), a następnie odległością od przedmiotu analizy. Dokument ma charakter informacyjny i nie stanowi operatu szacunkowego rzeczoznawcy.</p>
    <p class="muted" style="margin:0 0 6px"><strong style="color:#16161a">${esc(loc || 'Nieruchomość')}</strong>${specs ? ` · ${esc(specs)}` : ''}</p>
    <table class="hero" role="presentation">
      <tr>
        <td>
          <div class="kicker">Szacowana wartość rynkowa</div>
          <div class="mid">${formatPln(result.estimated.mid)}</div>
          <div class="muted">${formatPln(result.estimated.low)} – ${formatPln(result.estimated.high)}</div>
        </td>
        <td>
          <div class="kicker">Cena za m²</div>
          <div class="mid">${formatPpsm(result.estimated.ppsm)}</div>
          <div class="muted">Rekomendowana cena ofertowa: <strong>${formatPln(result.estimated.recommendedAsk)}</strong></div>
        </td>
      </tr>
    </table>
    <p class="muted">Podstawa oszacowania: ${esc(basisLabel(result.stats.basis, result.stats.count))}
      z ostatnich ${result.stats.windowMonths} mies.${result.stats.basis === 'comps' ? ` (promień ${result.stats.radiusM} m)` : ''}.
      Mediana ${formatPpsm(result.stats.medianPpsm)}, średnia ${formatPpsm(result.stats.meanPpsm)}.</p>
    ${buildPriceCompareChartHtml(result)}
    ${
      score
        ? `<div class="score"><strong>Ocena ceny oferty względem transakcji: ${score.score}/100 — ${esc(score.label)}</strong><span class="muted">${esc(score.detail)}</span></div>`
        : ''
    }
    <h2>Najbliższe parametrami transakcje</h2>
    <p class="muted" style="margin:0">Poniżej ${page1Comps.length || 0} aktów najbardziej zbliżonych do parametrów nieruchomości.${page2Comps.length ? ` Pozostałe ${page2Comps.length} transakcje znajdują się na drugiej stronie.` : ''}</p>
    ${compsTable(page1Comps)}
    <p class="foot">${esc(result.coverage.disclaimer)} Import: ${result.coverage.ingestedAt ? esc(result.coverage.ingestedAt.slice(0, 10)) : 'w toku'}. ${result.coverage.transactionCount.toLocaleString('pl-PL')} aktów w magazynie dla ${esc(result.coverage.city)}.</p>
  </div>
  ${page2}
</body>
</html>`;
}
