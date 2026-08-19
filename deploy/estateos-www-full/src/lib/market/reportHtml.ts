import type { ValuationResult } from '@/lib/market/types';
import { formatPln, formatPpsm } from '@/lib/market/format';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMarketReportHtml(result: ValuationResult, opts: { recipientName?: string | null }) {
  const s = result.subject;
  const loc = [s.city, s.district, s.address].filter(Boolean).join(' · ');
  const compsRows = result.comps
    .slice(0, 12)
    .map(
      (c) =>
        `<tr><td>${esc(c.address || 'okolica')}</td><td>${c.area ?? '—'} m²</td><td>${c.rooms ?? '—'}</td><td>${formatPln(c.price)}</td><td>${formatPpsm(c.ppsm)}</td><td>${c.deedAt || '—'}</td></tr>`,
    )
    .join('');
  const score = result.vsListing;
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <title>Analiza wartości nieruchomości — EstateOS™ Market</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; background: #f6f6f8; margin: 0; padding: 32px; }
    .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e7e7ea; border-radius: 20px; padding: 36px 40px; }
    h1 { font-size: 22px; letter-spacing: .04em; text-transform: uppercase; margin: 0 0 6px; }
    .kicker { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #6b6b70; font-weight: 700; }
    .hero { display: flex; justify-content: space-between; gap: 24px; margin: 24px 0 8px; }
    .mid { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; }
    .muted { color: #6b6b70; font-size: 13px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
    th { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #6b6b70; }
    .score { display: inline-block; padding: 8px 12px; border-radius: 12px; background: #ecfdf3; font-weight: 700; }
    .foot { margin-top: 28px; font-size: 11px; color: #8e8e93; line-height: 1.55; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="kicker">EstateOS™ Market</div>
    <h1>Analiza wartości nieruchomości</h1>
    <p class="muted">${esc(loc)}${opts.recipientName ? ` · ${esc(opts.recipientName)}` : ''}</p>
    <div class="hero">
      <div>
        <div class="kicker">Wartość rynkowa</div>
        <div class="mid">${formatPln(result.estimated.mid)}</div>
        <div class="muted">${formatPln(result.estimated.low)} – ${formatPln(result.estimated.high)}</div>
      </div>
      <div>
        <div class="kicker">Cena za m²</div>
        <div class="mid">${formatPpsm(result.estimated.ppsm)}</div>
        <div class="muted">${s.area} m²${s.rooms ? ` · ${s.rooms} pok.` : ''}</div>
      </div>
    </div>
    <p class="muted">Rekomendowana cena ofertowa: <strong>${formatPln(result.estimated.recommendedAsk)}</strong>.
      Podstawa: ${result.stats.count} ${result.stats.basis === 'comps' ? 'porównywalnych transakcji' : result.stats.basis === 'district' ? 'aktów z dzielnicy' : 'aktów z miasta'}
      z ${result.stats.windowMonths} mies. mediana ${formatPpsm(result.stats.medianPpsm)}, średnia ${formatPpsm(result.stats.meanPpsm)}.</p>
    ${
      score
        ? `<p class="score">EstateOS™ Price Score ${score.score}/100 — ${esc(score.label)}<br/><span class="muted">${esc(score.detail)}</span></p>`
        : ''
    }
    <h2 style="font-size:15px;margin-top:28px">Porównywalne transakcje</h2>
    <table>
      <thead><tr><th>Adres budynku</th><th>Metraż</th><th>Pokoje</th><th>Cena</th><th>zł/m²</th><th>Akt</th></tr></thead>
      <tbody>${compsRows || '<tr><td colspan="6">Brak listy comps — użyto mediany obszaru.</td></tr>'}</tbody>
    </table>
    <p class="foot">${esc(result.coverage.disclaimer)} Import: ${result.coverage.ingestedAt ? esc(result.coverage.ingestedAt.slice(0, 10)) : 'w toku'}. ${result.coverage.transactionCount.toLocaleString('pl-PL')} aktów w magazynie dla ${esc(result.coverage.city)}.</p>
  </div>
</body>
</html>`;
}
