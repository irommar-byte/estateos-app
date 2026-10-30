import type { MarketComp, MarketReportVariant, ValuationResult } from '@/lib/market/types';
import { sortCompsBySimilarity } from '@/lib/market/compSimilarity';
import { formatPln, formatPpsm, formatSignedPct } from '@/lib/market/format';
import { buildCompsMapHtml, formatMarketType, streetStem } from '@/lib/market/reportMap';

export const REPORT_PAGE1_COMPS = 8;

/* Motywy raportu. Wszystkie elementy czytają kolory i fonty z bieżącego motywu. */
export type ReportThemeName = 'atrament' | 'biel' | 'kancelaria';
type ReportTheme = {
  ink: string; inkSoft: string; muted: string; line: string; paper: string; page: string;
  gold: string; goldSoft: string; goldLine: string; goldText: string;
  value: string; valueSoft: string; valueHint: string; valueKicker: string; warm: string;
  sans: string; serif: string;
  headerBg: string; headerTitle: string; headerSub: string; headerMeta: string; headerChip: string; headerChipText: string; headerRule: string;
  radius: number;
};
// Pojedyncze cudzysłowy: fonty trafiają do atrybutu style="…".
const SANS_STACK = `-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Inter,Helvetica,Arial,sans-serif`;
const SERIF_STACK = `'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif`;
export const REPORT_THEMES: Record<ReportThemeName, ReportTheme> = {
  /** Atrament i złoto — ciemny nagłówek, złoty akcent, zieleń wartości (spójne z ofertówką). */
  atrament: {
    ink: '#14161b', inkSoft: '#4a4d55', muted: '#7a7d86', line: '#e8e3d8', paper: '#fbfaf7', page: '#f1eee7',
    gold: '#b08d3c', goldSoft: '#f4ecd9', goldLine: '#e8d9b3', goldText: '#8a6a22',
    value: '#0f766e', valueSoft: '#e6f3f1', valueHint: '#d5efea', valueKicker: '#bfe6df', warm: '#c2410c',
    sans: SANS_STACK, serif: SERIF_STACK,
    headerBg: '#14161b', headerTitle: '#ffffff', headerSub: '#e9e4d6', headerMeta: '#9ea1a9', headerChip: 'rgba(176,141,60,.55)', headerChipText: '#f1e6c8', headerRule: '#b08d3c',
    radius: 18,
  },
  /** Biel — minimalizm w stylu Apple: biały papier, duże liczby, jeden niebieski akcent. */
  biel: {
    ink: '#1d1d1f', inkSoft: '#424245', muted: '#86868b', line: '#e8e8ed', paper: '#f5f5f7', page: '#ececf0',
    gold: '#0071e3', goldSoft: '#eef5ff', goldLine: '#cfe3fb', goldText: '#0058b0',
    value: '#1d1d1f', valueSoft: '#f5f5f7', valueHint: '#c7c7cc', valueKicker: '#a1a1a6', warm: '#e8590c',
    sans: SANS_STACK, serif: SANS_STACK,
    headerBg: 'linear-gradient(180deg,#ffffff,#f5f5f7)', headerTitle: '#1d1d1f', headerSub: '#424245', headerMeta: '#86868b', headerChip: '#d2d2d7', headerChipText: '#1d1d1f', headerRule: '#0071e3',
    radius: 22,
  },
  /** Kancelaria — klasyczny dokument wyceny: granat, szeryfowe nagłówki, ostre krawędzie. */
  kancelaria: {
    ink: '#0b2545', inkSoft: '#3d4a5c', muted: '#6b7685', line: '#dde2e8', paper: '#f6f8fa', page: '#e9edf1',
    gold: '#9a7b2f', goldSoft: '#f7f3e8', goldLine: '#e4d8b8', goldText: '#7a5f1e',
    value: '#0b2545', valueSoft: '#eef2f7', valueHint: '#c6d2e2', valueKicker: '#9fb3cc', warm: '#9b2c2c',
    sans: SANS_STACK, serif: SERIF_STACK,
    headerBg: '#0b2545', headerTitle: '#ffffff', headerSub: '#dbe4ef', headerMeta: '#9fb3cc', headerChip: 'rgba(255,255,255,.35)', headerChipText: '#ffffff', headerRule: '#9a7b2f',
    radius: 4,
  },
};

/** Motyw używany w raportach wysyłanych klientom. */
export const DEFAULT_REPORT_THEME: ReportThemeName = 'atrament';

let INK = '', INK_SOFT = '', MUTED = '', LINE = '', PAPER = '', PAGE = '', GOLD = '', GOLD_SOFT = '', GOLD_LINE = '', GOLD_TEXT = '';
let VALUE = '', VALUE_SOFT = '', VALUE_HINT = '', VALUE_KICKER = '', WARM = '', SANS = '', SERIF = '';
let H: ReportTheme = REPORT_THEMES.atrament;

export function setReportTheme(name: ReportThemeName = DEFAULT_REPORT_THEME) {
  const t = REPORT_THEMES[name] || REPORT_THEMES.atrament;
  H = t;
  INK = t.ink; INK_SOFT = t.inkSoft; MUTED = t.muted; LINE = t.line; PAPER = t.paper; PAGE = t.page;
  GOLD = t.gold; GOLD_SOFT = t.goldSoft; GOLD_LINE = t.goldLine; GOLD_TEXT = t.goldText;
  VALUE = t.value; VALUE_SOFT = t.valueSoft; VALUE_HINT = t.valueHint; VALUE_KICKER = t.valueKicker; WARM = t.warm;
  SANS = t.sans; SERIF = t.serif;
}
setReportTheme();

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatSqm(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${String(Math.round(n * 100) / 100).replace('.', ',')} m²`;
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

function formatDeedDate(raw: string | null | undefined) {
  if (!raw) return '—';
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(raw);
}

function formatLongDate(value?: Date | string | null) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function looksLikeEmail(value?: string | null) {
  return Boolean(value && String(value).includes('@'));
}

function clientDisplayName(name?: string | null) {
  const trimmed = String(name || '').trim();
  if (!trimmed || looksLikeEmail(trimmed)) return '';
  return trimmed;
}

function polishLetterOpening(name: string): { greeting: string; dative: string } {
  if (!name) return { greeting: 'Szanowni Państwo,', dative: 'Państwu' };
  const first = name.split(/\s+/)[0] || '';
  const female = /a$/i.test(first) && !/^(kosma|barnaba|kuba|bonawentura)$/i.test(first);
  if (female) return { greeting: 'Szanowna Pani,', dative: 'Pani' };
  return { greeting: 'Szanowny Panie,', dative: 'Panu' };
}

export type ReportHtmlOpts = {
  recipientName?: string | null;
  recipientEmail?: string | null;
  generatedAt?: Date | string | null;
  variant?: MarketReportVariant;
  theme?: ReportThemeName;
};

function basisLabel(basis: ValuationResult['stats']['basis'], count: number) {
  if (basis === 'comps') return `${count} porównywalnych transakcji z najbliższej okolicy`;
  if (basis === 'district') return `${count} transakcji z tej samej dzielnicy`;
  return `${count} transakcji z całego miasta`;
}

function kicker(text: string, color = MUTED) {
  return `<div style="font:700 10.5px/1.3 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${color}">${esc(text)}</div>`;
}

function sectionTitle(no: string, title: string, lead?: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:30px 0 10px">
    <tr>
      <td style="width:34px;vertical-align:top;padding:2px 0 0;border:0">
        <div style="width:26px;height:26px;border-radius:99px;background:${INK};color:#fff;font:700 11px/26px ${SANS};text-align:center">${esc(no)}</div>
      </td>
      <td style="border:0;padding:0">
        <div style="font:600 19px/1.25 ${SERIF};color:${INK};letter-spacing:-.01em">${esc(title)}</div>
        ${lead ? `<div style="font:400 12.5px/1.55 ${SANS};color:${MUTED};margin-top:3px">${lead}</div>` : ''}
      </td>
    </tr>
  </table>`;
}

/* ───────────────────────── nagłówek i kluczowe liczby ───────────────────────── */

function headerBand(result: ValuationResult, opts: ReportHtmlOpts, subtitle: string) {
  const s = result.subject;
  const loc = [s.address, s.district, s.city].filter(Boolean).join(', ') || 'Nieruchomość';
  const chips = [
    s.area ? formatSqm(s.area) : null,
    s.rooms != null ? `${s.rooms} ${s.rooms === 1 ? 'pokój' : s.rooms < 5 ? 'pokoje' : 'pokoi'}` : null,
    s.floor != null ? `piętro ${formatFloor(s.floor)}` : null,
  ].filter(Boolean) as string[];
  const ctx = result.reportContext;
  const asOf = ctx?.asOf ? new Date(ctx.asOf).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }) : '';
  const name = clientDisplayName(opts.recipientName);
  const meta = [
    formatLongDate(opts.generatedAt),
    name ? `dla: ${name}` : '',
    asOf ? `akty kompletne do: ${asOf}` : '',
  ].filter(Boolean);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${H.headerBg};border-radius:${H.radius}px ${H.radius}px 0 0">
    <tr><td style="padding:30px 34px 28px;border:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
        <td style="border:0;padding:0">${kicker(`EstateOS™ Market · ${subtitle}`, GOLD)}</td>
        <td align="right" style="border:0;padding:0;font:600 10.5px/1.3 ${SANS};color:${H.headerMeta};letter-spacing:.06em">ŹRÓDŁO: RCN · GUGiK</td>
      </tr></table>
      <div style="font:600 30px/1.15 ${SERIF};color:${H.headerTitle};letter-spacing:-.02em;margin:14px 0 6px">Analiza wartości nieruchomości</div>
      <div style="font:500 16px/1.4 ${SANS};color:${H.headerSub}">${esc(loc)}</div>
      ${
        chips.length
          ? `<div style="margin-top:12px">${chips
              .map(
                (c) =>
                  `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 11px;border-radius:99px;border:1px solid ${H.headerChip};color:${H.headerChipText};font:600 12px/1 ${SANS}">${esc(c)}</span>`,
              )
              .join('')}</div>`
          : ''
      }
      <div style="font:400 12px/1.5 ${SANS};color:${H.headerMeta};margin-top:10px">${esc(meta.join('  ·  '))}</div>
    </td></tr>
    <tr><td style="height:4px;background:${H.headerRule};font-size:0;line-height:0;border:0">&nbsp;</td></tr>
  </table>`;
}

function keyFigures(result: ValuationResult) {
  const e = result.estimated;
  const tile = (label: string, value: string, hint: string, accent = false) => `<td style="width:33.33%;vertical-align:top;padding:0 6px;border:0">
      <div style="border-radius:${Math.min(14, H.radius)}px;padding:16px 16px 14px;background:${accent ? VALUE : PAPER};border:1px solid ${accent ? VALUE : LINE}">
        ${kicker(label, accent ? VALUE_KICKER : MUTED)}
        <div style="font:700 23px/1.15 ${SANS};letter-spacing:-.03em;color:${accent ? '#fff' : INK};margin-top:8px;white-space:nowrap">${value}</div>
        <div style="font:400 11.5px/1.45 ${SANS};color:${accent ? VALUE_HINT : MUTED};margin-top:6px">${hint}</div>
      </div>
    </td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:22px -6px 0;width:calc(100% + 12px)">
    <tr>
      ${tile('Rekomendowana cena ofertowa', formatPln(e.recommendedAsk), 'Kwota, z którą warto wystawić ofertę — zostawia miejsce na negocjacje.', true)}
      ${tile('Wartość rynkowa', formatPln(e.mid), `Przedział: ${formatPln(e.low)} – ${formatPln(e.high)}`)}
      ${tile('Cena za m²', formatPpsm(e.ppsm), `Mediana z próby: ${formatPpsm(result.stats.medianPpsm)}`)}
    </tr>
  </table>`;
}

/** Skala przedziału: dolna granica — wartość — górna granica, z zaznaczoną ceną oferty i rekomendacją. */
function rangeGauge(result: ValuationResult) {
  const e = result.estimated;
  const listing = result.listingPrice && result.listingPrice > 0 ? result.listingPrice : null;
  const values = [e.low, e.high, e.recommendedAsk, ...(listing ? [listing] : [])];
  const span0 = Math.max(...values) - Math.min(...values) || 1;
  const min = Math.min(...values) - span0 * 0.12;
  const max = Math.max(...values) + span0 * 0.12;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const lowP = pos(e.low);
  const highP = pos(e.high);
  const markers = [
    { v: e.mid, label: 'wartość', color: INK, top: true },
    { v: e.recommendedAsk, label: 'rekomendacja', color: VALUE, top: false },
    ...(listing ? [{ v: listing, label: 'cena w ofercie', color: WARM, top: true }] : []),
  ];
  const marker = (m: (typeof markers)[number]) => {
    const p = pos(m.v);
    const align = p < 12 ? 'left' : p > 88 ? 'right' : 'center';
    const shift = align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%';
    return `<div style="position:absolute;left:${p.toFixed(2)}%;${m.top ? 'bottom:22px' : 'top:22px'};transform:translateX(${shift});text-align:${align};white-space:nowrap">
        <div style="font:700 12px/1.2 ${SANS};color:${m.color}">${formatPln(m.v)}</div>
        <div style="font:500 10px/1.2 ${SANS};color:${MUTED};text-transform:uppercase;letter-spacing:.08em">${esc(m.label)}</div>
      </div>
      <div style="position:absolute;left:${p.toFixed(2)}%;top:2px;width:3px;height:14px;margin-left:-1.5px;border-radius:2px;background:${m.color}"></div>`;
  };
  return `<div style="margin:26px 0 6px">
    ${kicker('Gdzie wypada cena')}
    <div style="position:relative;height:96px;margin-top:6px">
      <div style="position:absolute;left:0;right:0;top:40px;height:18px">
        <div style="position:absolute;left:0;right:0;top:4px;height:10px;border-radius:99px;background:#efece4"></div>
        <div style="position:absolute;left:${lowP.toFixed(2)}%;width:${(highP - lowP).toFixed(2)}%;top:4px;height:10px;border-radius:99px;background:${VALUE}"></div>
        ${markers.map(marker).join('')}
      </div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
      <td style="border:0;padding:0;font:500 11px/1.4 ${SANS};color:${MUTED}">Pogrubiony pas = przedział wartości z aktów notarialnych (${formatPln(e.low)} – ${formatPln(e.high)})</td>
    </tr></table>
  </div>`;
}

function listingVerdict(result: ValuationResult) {
  const listing = result.listingPrice && result.listingPrice > 0 ? result.listingPrice : null;
  const score = result.vsListing;
  if (!listing && !score) return '';
  let text = '';
  if (listing) {
    const delta = listing - result.estimated.recommendedAsk;
    const pct = result.estimated.recommendedAsk > 0 ? (delta / result.estimated.recommendedAsk) * 100 : 0;
    const absPct = Math.abs(pct).toFixed(1).replace('.', ',');
    text =
      Math.abs(pct) < 1.5
        ? 'Cena w ofercie jest praktycznie równa rekomendacji wynikającej z aktów notarialnych.'
        : delta < 0
          ? `Cena w ofercie jest o <strong>${formatPln(Math.abs(delta))} (${absPct}%) niższa</strong> niż rekomendacja z aktów — oferta jest atrakcyjna dla kupujących.`
          : `Cena w ofercie jest o <strong>${formatPln(Math.abs(delta))} (${absPct}%) wyższa</strong> niż rekomendacja z aktów — warto przygotować argumenty za ceną albo zostawić miejsce na negocjację.`;
  }
  const scoreBar = score
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px"><tr>
        <td style="border:0;padding:0;width:110px;font:700 20px/1 ${SANS};color:${INK}">${score.score}<span style="font:500 12px ${SANS};color:${MUTED}">/100</span></td>
        <td style="border:0;padding:0;vertical-align:middle">
          <div style="height:8px;border-radius:99px;background:#efece4"><div style="height:8px;width:${Math.max(4, Math.min(100, score.score))}%;border-radius:99px;background:${score.score >= 60 ? VALUE : score.score >= 40 ? GOLD : WARM}"></div></div>
          <div style="font:600 12px/1.4 ${SANS};color:${INK};margin-top:6px">${esc(score.label)}</div>
          <div style="font:400 11.5px/1.45 ${SANS};color:${MUTED}">${esc(score.detail)}</div>
        </td>
      </tr></table>`
    : '';
  return `<div style="margin:18px 0 0;padding:16px 18px;border-radius:${Math.min(14, H.radius)}px;background:${GOLD_SOFT};border:1px solid ${GOLD_LINE}">
    ${kicker('Ocena ceny oferty', GOLD_TEXT)}
    ${text ? `<div style="font:400 13.5px/1.6 ${SANS};color:${INK};margin-top:6px">${text}</div>` : ''}
    ${scoreBar}
  </div>`;
}

function methodTiles(result: ValuationResult) {
  const ctx = result.reportContext;
  const asOf = ctx?.asOf ? new Date(ctx.asOf).toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' }) : 'bieżący';
  const tile = (label: string, value: string) => `<td style="width:25%;padding:0 5px;border:0;vertical-align:top">
      <div style="border-radius:${Math.min(12, H.radius)}px;background:${PAPER};border:1px solid ${LINE};padding:12px">
        <div style="font:600 10px/1.3 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:${MUTED}">${esc(label)}</div>
        <div style="font:700 16px/1.2 ${SANS};color:${INK};margin-top:5px">${esc(value)}</div>
      </div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 -5px;width:calc(100% + 10px)"><tr>
    ${tile('Transakcji w próbie', String(result.stats.count))}
    ${tile('Promień', result.stats.basis === 'comps' ? `${result.stats.radiusM} m` : result.stats.basis === 'district' ? 'dzielnica' : 'miasto')}
    ${tile('Okres', `${result.stats.windowMonths} mies.`)}
    ${tile('Rejestr do', asOf)}
  </tr></table>
  <div style="font:400 12.5px/1.6 ${SANS};color:${INK_SOFT};margin-top:12px">
    Podstawa: ${esc(basisLabel(result.stats.basis, result.stats.count))}. Do próby trafiają wyłącznie lokale mieszkalne sprzedane w całości
    (bez udziałów), o metrażu ±15% i liczbie pokoi ±1 względem analizowanej nieruchomości. Promień poszerzamy stopniowo
    (400 → 800 → 1500 → 2500 m), aż zbierze się wiarygodna próba. Okres liczymy wstecz od ostatniego kompletnego miesiąca w rejestrze.
    Średnia z próby: ${formatPpsm(result.stats.meanPpsm)}, mediana: ${formatPpsm(result.stats.medianPpsm)}.
  </div>`;
}

function listingVsDeeds(result: ValuationResult) {
  const ctx = result.reportContext;
  if (!ctx?.listingPpsm || !ctx.listingDeedPpsm) return '';
  const gap = ctx.listingVsDeedsPct;
  const max = Math.max(ctx.listingPpsm, ctx.listingDeedPpsm);
  const bar = (label: string, v: number, color: string) => `<tr>
      <td style="border:0;padding:6px 10px 6px 0;width:150px;font:500 12px/1.3 ${SANS};color:${INK_SOFT}">${esc(label)}</td>
      <td style="border:0;padding:6px 0"><div style="height:12px;border-radius:99px;background:#efece4"><div style="height:12px;width:${Math.max(6, (v / max) * 100).toFixed(1)}%;border-radius:99px;background:${color}"></div></div></td>
      <td style="border:0;padding:6px 0 6px 12px;width:120px;text-align:right;font:700 13px/1.3 ${SANS};color:${INK};white-space:nowrap">${formatPpsm(v)}</td>
    </tr>`;
  return `${sectionTitle('4', `Ogłoszenia a faktyczne ceny — ${ctx.listingScope || 'okolica'}`, 'Ile sprzedający żądają w ogłoszeniach, a ile kupujący naprawdę płacą u notariusza.')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${bar('Mediana ogłoszeń', ctx.listingPpsm, GOLD)}
    ${bar('Mediana aktów notarialnych', ctx.listingDeedPpsm, VALUE)}
  </table>
  ${
    gap != null
      ? `<div style="font:400 12.5px/1.55 ${SANS};color:${INK_SOFT};margin-top:8px">Ogłoszenia są średnio <strong>${formatSignedPct(gap)}</strong> względem cen z aktów${ctx.listingCount ? ` (na podstawie ${ctx.listingCount} ofert)` : ''}. ${gap > 3 ? 'To typowy „zapas negocjacyjny” sprzedających.' : gap < -3 ? 'Oferty są obecnie tańsze niż ostatnie transakcje.' : 'Ceny ofertowe są blisko realnych transakcji.'}</div>`
      : ''
  }`;
}

/* ───────────────────────── tabela porównań ───────────────────────── */

function compsTable(comps: MarketComp[], result: ValuationResult, opts: { startIndex: number; subjectAddress?: string | null; numbered: boolean }) {
  if (!comps.length) {
    return `<div style="font:400 13px/1.55 ${SANS};color:${MUTED};padding:14px 16px;border-radius:12px;background:${PAPER};border:1px solid ${LINE}">Brak pojedynczych transakcji w najbliższym promieniu — oszacowanie oparto o medianę obszaru.</div>`;
  }
  const median = result.stats.medianPpsm;
  const subjectStem = streetStem(opts.subjectAddress);
  const th = (t: string, right = false) =>
    `<th style="text-align:${right ? 'right' : 'left'};padding:9px 8px;border-bottom:1.5px solid ${INK};font:700 9.5px/1.2 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${MUTED};white-space:nowrap">${t}</th>`;
  const rows = comps
    .map((c, i) => {
      const idx = opts.startIndex + i;
      const same = Boolean(subjectStem && streetStem(c.address) === subjectStem);
      const market = formatMarketType(c.marketType);
      const primary = market === 'pierwotny';
      const badgeColor = primary ? WARM : same ? VALUE : INK;
      const diff = median > 0 ? ((c.ppsm - median) / median) * 100 : null;
      const diffColor = diff == null ? MUTED : diff > 2 ? WARM : diff < -2 ? VALUE : MUTED;
      const tags = [same ? 'ta sama ulica' : '', market && market !== '—' ? `rynek ${market}` : ''].filter(Boolean).join(' · ');
      const td = (content: string, right = false, extra = '') =>
        `<td style="padding:10px 8px;border-bottom:1px solid ${LINE};text-align:${right ? 'right' : 'left'};vertical-align:top;font:400 12.5px/1.35 ${SANS};color:${INK};${extra}">${content}</td>`;
      const params = [formatSqm(c.area), c.rooms != null ? `${c.rooms} pok.` : null, c.floor != null ? (c.floor === 0 ? 'parter' : `${c.floor} p.`) : null]
        .filter(Boolean)
        .join(' · ');
      return `<tr style="background:${i % 2 ? '#fff' : PAPER}">
        ${td(
          `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
            ${opts.numbered ? `<td style="border:0;padding:0 9px 0 0;vertical-align:top"><div style="width:22px;height:22px;border-radius:99px;background:${badgeColor};color:#fff;font:700 11px/22px ${SANS};text-align:center">${idx}</div></td>` : ''}
            <td style="border:0;padding:0"><div style="font:600 13px/1.3 ${SANS};color:${INK}">${esc(c.address || c.district || 'okolica')}</div>${tags ? `<div style="font:400 11px/1.3 ${SANS};color:${MUTED};margin-top:2px">${esc(tags)}</div>` : ''}</td>
          </tr></table>`,
        )}
        ${td(`${esc(params)}`, false, 'white-space:nowrap;color:' + INK_SOFT)}
        ${td(`<strong>${formatPln(c.price)}</strong>`, true, 'white-space:nowrap')}
        ${td(`<strong>${formatPpsm(c.ppsm)}</strong>${diff != null ? `<div style="font:600 11px/1.3 ${SANS};color:${diffColor};margin-top:2px">${formatSignedPct(diff, 1)} od mediany</div>` : ''}`, true, 'white-space:nowrap')}
        ${td(`${formatDeedDate(c.deedAt)}<div style="font:400 11px/1.3 ${SANS};color:${MUTED};margin-top:2px">${formatDistance(c.distanceM)} od nieruch.</div>`, true, 'white-space:nowrap')}
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px">
    <thead><tr>
      ${th(opts.numbered ? 'Nr · adres' : 'Adres')}${th('Parametry')}${th('Cena aktu', true)}${th('Cena za m²', true)}${th('Data · odległość', true)}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function glossary() {
  const item = (term: string, body: string) => `<tr>
      <td style="border:0;padding:8px 14px 8px 0;width:170px;vertical-align:top;font:700 12.5px/1.4 ${SANS};color:${INK}">${esc(term)}</td>
      <td style="border:0;padding:8px 0;vertical-align:top;font:400 12.5px/1.55 ${SANS};color:${INK_SOFT}">${body}</td>
    </tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid ${LINE}">
    ${item('Akt notarialny (RCN)', 'Rzeczywista sprzedaż zgłoszona przez notariusza do państwowego Rejestru Cen Nieruchomości (GUGiK). To cena, za którą naprawdę sprzedano — nie cena z ogłoszenia.')}
    ${item('Mediana', 'Cena „środkowa”: połowa transakcji była tańsza, połowa droższa. Pojedyncza bardzo droga lub tania sprzedaż jej nie zniekształca.')}
    ${item('Wartość rynkowa', 'Mediana ceny za m² z próby pomnożona przez metraż nieruchomości. Przedział pokazuje typowy rozrzut cen w okolicy.')}
    ${item('Rekomendowana cena ofertowa', 'Cena, z którą rekomendujemy wejść na rynek — nieco powyżej wartości, aby zostawić przestrzeń na negocjacje i nie zniechęcić kupujących.')}
    ${item('Opóźnienie rejestru', 'Urzędy wprowadzają akty z opóźnieniem kilku tygodni, dlatego analiza kończy się na ostatnim kompletnym miesiącu, a nie na dzisiejszej dacie.')}
  </table>`;
}

function footer(result: ValuationResult) {
  return `<div style="margin-top:30px;padding-top:14px;border-top:1px solid ${LINE};font:400 10.5px/1.6 ${SANS};color:${MUTED}">
    ${esc(result.coverage.disclaimer)} Dokument ma charakter informacyjny i nie stanowi operatu szacunkowego w rozumieniu ustawy o gospodarce nieruchomościami.
    Baza: ${result.coverage.transactionCount.toLocaleString('pl-PL')} aktów dla ${esc(result.coverage.city)}${result.coverage.ingestedAt ? ` · ostatnia aktualizacja ${esc(formatDeedDate(result.coverage.ingestedAt.slice(0, 10)))}` : ''}.
    <div style="margin-top:8px;font:700 10px/1.3 ${SANS};letter-spacing:.14em;color:${GOLD}">ESTATEOS™ MARKET · ESTATEOS.PL</div>
  </div>`;
}

function pageShell(inner: string, opts: { first?: boolean } = {}) {
  return `<div class="page" style="max-width:780px;margin:0 auto 26px;background:#fff;border:1px solid ${LINE};border-radius:${H.radius}px;box-shadow:0 18px 50px rgba(20,22,27,.08);overflow:hidden">
    ${inner}
  </div>${opts.first ? '' : ''}`;
}

function documentShell(body: string) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Analiza wartości nieruchomości — EstateOS™ Market</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { margin:0; padding:28px 12px; background:${PAGE}; color:${INK}; font-family:${SANS}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .pad { padding: 4px 34px 30px; }
    @media (max-width: 640px) { .pad { padding: 4px 18px 22px; } }
    @media print {
      body { background:#fff; padding:0; }
      .page { box-shadow:none !important; border:0 !important; border-radius:0 !important; margin:0 !important; page-break-after:always; }
      .page:last-child { page-break-after:auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

/* ───────────────────────── warianty ───────────────────────── */

async function buildReport(result: ValuationResult, opts: ReportHtmlOpts, mode: 'classic' | 'pro') {
  setReportTheme(opts.theme);
  const s = result.subject;
  const comps = sortCompsBySimilarity(result.comps || [], s);
  const page1Comps = comps.slice(0, REPORT_PAGE1_COMPS);
  const page2Comps = comps.slice(REPORT_PAGE1_COMPS);
  const loc = [s.address, s.district, s.city].filter(Boolean).join(', ') || 'nieruchomości';
  const name = clientDisplayName(opts.recipientName);
  const opening = polishLetterOpening(name);
  const withMap = mode === 'pro';

  const letter = `<div style="font:400 14px/1.7 ${SERIF};color:${INK_SOFT};margin:24px 0 0">
    ${esc(opening.greeting)}<br/>
    przekazujemy ${esc(opening.dative)} analizę wartości ${esc(loc)}. Opiera się ona na <strong style="color:${INK}">rzeczywistych transakcjach</strong>
    z aktów notarialnych, a nie na cenach z ogłoszeń. Na pierwszej stronie znajdą ${opening.dative === 'Państwu' ? 'Państwo' : opening.dative === 'Pani' ? 'Pani' : 'Pan'}
    najważniejsze liczby, dalej — skąd się wzięły${withMap ? ', mapę transakcji' : ''} i pełną listę porównań.
  </div>`;

  const sectionMap = withMap
    ? `${sectionTitle('3', 'Gdzie leżą porównywane transakcje', 'Numery na mapie odpowiadają wierszom tabeli poniżej. Zielony punkt to analizowana nieruchomość.')}
       ${await buildCompsMapHtml(result, REPORT_PAGE1_COMPS)}`
    : '';

  const tableNo = withMap ? (result.reportContext?.listingPpsm && result.reportContext.listingDeedPpsm ? '5' : '4') : '3';
  const glossaryNo = String(Number(tableNo) + 1);

  const page1 = pageShell(`${headerBand(result, opts, mode === 'pro' ? 'raport profesjonalny' : 'raport')}
    <div class="pad">
      ${letter}
      ${sectionTitle('1', 'Najważniejsze liczby', 'Wynik analizy w jednym miejscu.')}
      ${keyFigures(result)}
      ${rangeGauge(result)}
      ${listingVerdict(result)}
      ${sectionTitle('2', 'Jak powstała wycena', 'Skąd pochodzą dane i jak dobraliśmy porównania.')}
      ${methodTiles(result)}
      ${sectionMap}
      ${withMap ? listingVsDeeds(result) : ''}
      ${sectionTitle(tableNo, 'Najbardziej podobne transakcje', `Uporządkowane od najbardziej zbliżonych parametrami (metraż, pokoje, piętro), potem odległością.${page2Comps.length ? ` Kolejne ${page2Comps.length} — w załączniku.` : ''}`)}
      ${compsTable(page1Comps, result, { startIndex: 1, subjectAddress: s.address, numbered: true })}
      ${sectionTitle(glossaryNo, 'Jak czytać ten raport')}
      ${glossary()}
      ${footer(result)}
    </div>`);

  const page2 = page2Comps.length
    ? pageShell(`<div style="background:${H.headerBg};padding:20px 34px;border-bottom:4px solid ${H.headerRule}">
          ${kicker('Załącznik · pozostałe transakcje', GOLD)}
          <div style="font:600 22px/1.2 ${SERIF};color:${H.headerTitle};margin-top:6px">Porównywalne transakcje — ciąg dalszy</div>
        </div>
        <div class="pad">
          <div style="font:400 12.5px/1.55 ${SANS};color:${MUTED};margin:18px 0 4px">Kolejne akty notarialne, uporządkowane tak samo jak na pierwszej stronie.</div>
          ${compsTable(page2Comps, result, { startIndex: REPORT_PAGE1_COMPS + 1, subjectAddress: s.address, numbered: true })}
          ${footer(result)}
        </div>`)
    : '';

  return documentShell(`${page1}${page2}`);
}

/** Zachowujemy dawny eksport (używany w innych miejscach) — teraz w nowej szacie. */
export function buildPriceCompareChartHtml(result: ValuationResult) {
  return listingVerdict(result);
}

export function buildClassicMarketReportHtml(result: ValuationResult, opts: ReportHtmlOpts = {}): string {
  return buildClassicSync(result, opts);
}

function buildClassicSync(result: ValuationResult, opts: ReportHtmlOpts) {
  setReportTheme(opts.theme);
  const s = result.subject;
  const comps = sortCompsBySimilarity(result.comps || [], s);
  const page1Comps = comps.slice(0, REPORT_PAGE1_COMPS);
  const page2Comps = comps.slice(REPORT_PAGE1_COMPS);
  const loc = [s.address, s.district, s.city].filter(Boolean).join(', ') || 'nieruchomości';
  const name = clientDisplayName(opts.recipientName);
  const opening = polishLetterOpening(name);
  const page1 = pageShell(`${headerBand(result, opts, 'raport')}
    <div class="pad">
      <div style="font:400 14px/1.7 ${SERIF};color:${INK_SOFT};margin:24px 0 0">${esc(opening.greeting)}<br/>
        przekazujemy ${esc(opening.dative)} analizę wartości ${esc(loc)} opartą na rzeczywistych transakcjach z aktów notarialnych, a nie na cenach z ogłoszeń.</div>
      ${sectionTitle('1', 'Najważniejsze liczby', 'Wynik analizy w jednym miejscu.')}
      ${keyFigures(result)}
      ${rangeGauge(result)}
      ${listingVerdict(result)}
      ${sectionTitle('2', 'Jak powstała wycena', 'Skąd pochodzą dane i jak dobraliśmy porównania.')}
      ${methodTiles(result)}
      ${sectionTitle('3', 'Najbardziej podobne transakcje', `Uporządkowane od najbardziej zbliżonych parametrami, potem odległością.${page2Comps.length ? ` Kolejne ${page2Comps.length} — w załączniku.` : ''}`)}
      ${compsTable(page1Comps, result, { startIndex: 1, subjectAddress: s.address, numbered: true })}
      ${sectionTitle('4', 'Jak czytać ten raport')}
      ${glossary()}
      ${footer(result)}
    </div>`);
  const page2 = page2Comps.length
    ? pageShell(`<div style="background:${H.headerBg};padding:20px 34px;border-bottom:4px solid ${H.headerRule}">
          ${kicker('Załącznik · pozostałe transakcje', GOLD)}
          <div style="font:600 22px/1.2 ${SERIF};color:${H.headerTitle};margin-top:6px">Porównywalne transakcje — ciąg dalszy</div>
        </div>
        <div class="pad">
          ${compsTable(page2Comps, result, { startIndex: REPORT_PAGE1_COMPS + 1, subjectAddress: s.address, numbered: true })}
          ${footer(result)}
        </div>`)
    : '';
  return documentShell(`${page1}${page2}`);
}

export async function buildProfessionalMarketReportHtml(result: ValuationResult, opts: ReportHtmlOpts = {}) {
  return buildReport(result, opts, 'pro');
}

export async function buildMarketReportHtml(result: ValuationResult, opts: ReportHtmlOpts = {}) {
  if (opts.variant === 'pro') return buildProfessionalMarketReportHtml(result, opts);
  return buildClassicSync(result, opts);
}

export async function buildMarketReportPair(result: ValuationResult, opts: ReportHtmlOpts = {}) {
  return {
    html: buildClassicSync(result, opts),
    htmlPro: await buildProfessionalMarketReportHtml(result, opts),
  };
}
