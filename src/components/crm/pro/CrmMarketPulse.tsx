'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PricePulsePayload } from '@/lib/market/types';

function zl(v: number | null | undefined): string {
  return v ? `${Math.round(v).toLocaleString('pl-PL')} zł` : '—';
}
function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}
function tone(v: number | null | undefined) {
  if (v == null) return '';
  return v > 0.2 ? 'crmx-chip--good' : v < -0.2 ? 'crmx-chip--bad' : '';
}
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/**
 * Puls rynku na biurku — jedno źródło (RCN + oferty EstateOS): ceny ofertowe z 30 dni,
 * mediana z aktów i 12 miesięcy mediany z aktów. Miesiąc z za małą liczbą aktów jest oznaczony jako wstępny.
 */
export default function CrmMarketPulse() {
  const [data, setData] = useState<PricePulsePayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/market/price-pulse', { credentials: 'include', cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => alive && (d?.ok ? setData(d) : setFailed(true)))
        .catch(() => alive && setFailed(true));
    void load();
    const t = window.setInterval(load, 5 * 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const chart = useMemo(() => {
    const month = data?.trends?.month;
    const pts = (month?.points || []).filter((p) => p.ppsm != null).slice(-12) as Array<{ key: string; ppsm: number }>;
    if (pts.length < 3) return null;
    const lastPreliminary = month?.changePct == null;
    const vals = pts.map((p) => p.ppsm);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const W = 300;
    const H = 86;
    const pad = 6;
    const x = (i: number) => pad + (i * (W - pad * 2)) / (pts.length - 1);
    const y = (v: number) => pad + (1 - (v - min) / Math.max(1, max - min)) * (H - pad * 2);
    const solid = lastPreliminary ? pts.slice(0, -1) : pts;
    const line = solid.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.ppsm).toFixed(1)}`).join(' ');
    const area = `${line} L${x(solid.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    return {
      W, H, line, area, min, max, pts, lastPreliminary,
      dash: lastPreliminary ? `M${x(pts.length - 2).toFixed(1)} ${y(prev.ppsm).toFixed(1)} L${x(pts.length - 1).toFixed(1)} ${y(last.ppsm).toFixed(1)}` : null,
      lastX: x(pts.length - 1),
      lastY: y(last.ppsm),
      first: pts[0].key,
      lastKey: last.key,
    };
  }, [data]);

  const label = (key: string) => {
    const [yy, mm] = key.split('-').map(Number);
    return `${MONTHS[(mm || 1) - 1]} ${String(yy).slice(2)}`;
  };

  const w30 = data?.windows?.d30;
  const year = data?.trends?.year;
  const asOf = data?.asOf ? new Date(data.asOf).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="crmx-pulse">
      <div className="crmx-desk__head">
        <p className="crmx-desk__month">Rynek</p>
        <span className="crmx-desk__hint">{data ? `${data.city} · mieszkania` : failed ? 'brak danych' : 'ładowanie…'}</span>
      </div>

      <div className="crmx-pulse__pair">
        <div>
          <span>Oferty · 30 dni</span>
          <b>{zl(w30?.listingPpsm ?? data?.listingPpsm)}</b>
          <small className={`crmx-chip ${tone(w30?.listingChangePct)}`}>{pct(w30?.listingChangePct)} m/m</small>
        </div>
        <div>
          <span>Akty notarialne</span>
          <b>{zl(data?.deedPpsm)}</b>
          <small className={`crmx-chip ${tone(year?.changePct)}`}>{pct(year?.changePct)} r/r</small>
        </div>
      </div>

      {chart ? (
        <figure className="crmx-pulse__chart">
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none" aria-label="Mediana ceny z aktów, 12 miesięcy">
            <defs>
              <linearGradient id="crmxPulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--x-gold)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--x-gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chart.area} fill="url(#crmxPulseFill)" />
            <path d={chart.line} fill="none" stroke="var(--x-gold)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {chart.dash ? <path d={chart.dash} fill="none" stroke="var(--x-gold)" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          <span className="crmx-pulse__dot" style={{ left: `${(chart.lastX / chart.W) * 100}%`, top: `${(chart.lastY / chart.H) * 100}%` }} data-pre={chart.lastPreliminary ? '1' : undefined} />
          <figcaption>
            <span>{label(chart.first)}</span>
            <span>Mediana z aktów · 12 mies.{chart.lastPreliminary ? ' · ostatni miesiąc wstępnie' : ''}</span>
            <span>{label(chart.lastKey)}</span>
          </figcaption>
        </figure>
      ) : (
        <p className="crmx-desk__free">{failed ? 'Nie udało się pobrać danych rynku.' : 'Ładowanie wykresu…'}</p>
      )}

      <div className="crmx-pulse__foot">
        <span>
          Oferty vs akty: <b className={data?.vsDeedsPct != null && data.vsDeedsPct < 0 ? 'neg' : 'pos'}>{pct(data?.vsDeedsPct)}</b>
        </span>
        <span>{w30 ? `${w30.listingCount} ofert · ${w30.deedCount} aktów` : ''}</span>
      </div>
      {asOf ? <p className="crmx-pulse__src">Źródło: RCN (akty kompletne do {asOf}) i oferty EstateOS™</p> : null}
    </div>
  );
}
