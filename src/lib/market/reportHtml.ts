import type { ValuationResult } from '@/lib/market/types';
import { formatPln, formatPpsm } from '@/lib/market/format';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
          <td style="font-size:12px;color:#6b6b70;padding:0 0 6px;border:0">${esc(params.label)}</td>
          <td align="right" style="font-size:14px;font-weight:800;letter-spacing:-0.02em;color:${params.accent ? '#0f766e' : '#111'};padding:0 0 6px;border:0;white-space:nowrap">${formatPln(params.amount)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:0;padding:0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef0f3;border-radius:999px">
              <tr>
                <td width="${pct}%" style="background:${params.fill};height:12px;border-radius:999px;font-size:0;line-height:0">&nbsp;</td>
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
  const clientPrice = result.listingPrice && result.listingPrice > 0 ? result.listingPrice : null;
  const recommended = result.estimated.recommendedAsk;
  if (!clientPrice || !recommended) return '';

  const max = Math.max(clientPrice, recommended, result.estimated.high);
  const delta = clientPrice - recommended;
  const pct = recommended > 0 ? (delta / recommended) * 100 : 0;
  const absPct = Math.abs(pct).toFixed(1).replace('.', ',');
  const absPln = formatPln(Math.abs(delta));
  let caption: string;
  if (Math.abs(pct) < 1.5) {
    caption = 'Cena zaproponowana przez klienta jest zbliżona do rekomendacji z realnych transakcji.';
  } else if (delta < 0) {
    caption = `Klient wycenia nieruchomość o ${absPln} (${absPct}%) poniżej rekomendacji z transakcji RCN.`;
  } else {
    caption = `Klient wycenia nieruchomość o ${absPln} (${absPct}%) powyżej rekomendacji z transakcji RCN.`;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;border-collapse:collapse">
    <tr><td style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b6b70;font-weight:700;padding:0 0 8px;border:0">Porównanie ceny</td></tr>
    ${barRow({ label: 'Cena zaproponowana przez klienta', amount: clientPrice, fill: '#0071e3', max })}
    ${barRow({ label: 'Rekomendacja z transakcji RCN', amount: recommended, fill: '#10b981', max, accent: true })}
    <tr>
      <td style="padding:14px 0 0;border:0;font-size:12px;color:#6b6b70;line-height:1.5">
        Zakres rynkowy z aktów: <strong style="color:#111">${formatPln(result.estimated.low)} – ${formatPln(result.estimated.high)}</strong>.
        ${esc(caption)}
      </td>
    </tr>
  </table>`;
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
    ${buildPriceCompareChartHtml(result)}
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
