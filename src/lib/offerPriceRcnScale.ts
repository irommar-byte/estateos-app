export const RCN_SCALE_DOMAIN_PCT = 30;

export type OfferPriceRcnScaleModel = {
  ok: true;
  recommendedAsk: number;
  listingPrice: number;
  deltaPln: number;
  deltaPct: number;
  /** 0–100 position on the bar; 50 = recommended. */
  positionPct: number;
  clamped: boolean;
  tone: 'below' | 'at' | 'above';
};

export type OfferPriceRcnScaleInvalid = {
  ok: false;
  reason: 'invalid_price' | 'invalid_recommended';
};

export function buildOfferPriceRcnScale(params: {
  listingPrice: number;
  recommendedAsk: number;
  domainPct?: number;
}): OfferPriceRcnScaleModel | OfferPriceRcnScaleInvalid {
  const listing = Number(params.listingPrice);
  const recommended = Number(params.recommendedAsk);
  if (!Number.isFinite(listing) || listing <= 0) {
    return { ok: false, reason: 'invalid_price' };
  }
  if (!Number.isFinite(recommended) || recommended <= 0) {
    return { ok: false, reason: 'invalid_recommended' };
  }

  const domain = Math.max(5, Number(params.domainPct) || RCN_SCALE_DOMAIN_PCT);
  const deltaPln = listing - recommended;
  const deltaPct = (deltaPln / recommended) * 100;
  const raw = 50 + (deltaPct / domain) * 50;
  const positionPct = Math.min(100, Math.max(0, raw));
  const clamped = raw < 0 || raw > 100;

  let tone: OfferPriceRcnScaleModel['tone'] = 'at';
  if (Math.abs(deltaPct) < 1.5) tone = 'at';
  else if (deltaPct < 0) tone = 'below';
  else tone = 'above';

  return {
    ok: true,
    recommendedAsk: Math.round(recommended),
    listingPrice: Math.round(listing),
    deltaPln: Math.round(deltaPln),
    deltaPct: Number(deltaPct.toFixed(1)),
    positionPct: Number(positionPct.toFixed(2)),
    clamped,
    tone,
  };
}

export function formatRcnDeltaLabel(deltaPln: number, deltaPct: number, locale = 'pl-PL'): string {
  const absPln = Math.abs(Math.round(deltaPln)).toLocaleString(locale);
  const sign = deltaPln > 0 ? '+' : deltaPln < 0 ? '−' : '';
  const pctAbs = Math.abs(deltaPct).toFixed(1).replace('.', ',');
  const pctSign = deltaPct > 0 ? '+' : deltaPct < 0 ? '−' : '';
  if (Math.abs(deltaPct) < 0.05) return `0 zł · 0%`;
  return `${sign}${absPln} zł · ${pctSign}${pctAbs}%`;
}
