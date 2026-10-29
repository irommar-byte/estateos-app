import {
  MARKET_FUNCTION_RESIDENTIAL,
  RCN_WFS_URL,
  WARSAW_TERYT_PREFIX,
} from '@/lib/market/constants';
import {
  parseRcnGenericGml,
  parseRcnLocalesGml,
  wfsNumberMatched,
  wfsNumberReturned,
  type RcnLocalFeature,
} from '@/lib/market/rcnParse';
import { MARKET_KIND_LOCAL, type MarketKind } from '@/lib/market/marketKinds';

const TYPE_NAMES: Record<MarketKind, string> = { LOCAL: 'ms:lokale', BUILDING: 'ms:budynki', PLOT: 'ms:dzialki' };

const UA = 'EstateOS-Market/1.0 (rcn-ingest; estateos.pl)';

/** Warszawa + data aktu; dla mieszkań dodatkowo tylko lokale mieszkalne (funkcję domów sprawdza jakość). */
function warsawFilter(kind: MarketKind, sinceIsoDate: string, untilIsoDate?: string) {
  return (
    `<Filter xmlns="http://www.opengis.net/fes/2.0"><And>` +
    `<PropertyIsLike wildCard="*" singleChar="." escapeChar="\\">` +
    `<ValueReference>teryt</ValueReference><Literal>${WARSAW_TERYT_PREFIX}*</Literal></PropertyIsLike>` +
    (kind === MARKET_KIND_LOCAL
      ? `<PropertyIsEqualTo><ValueReference>lok_funkcja</ValueReference>` +
        `<Literal>${MARKET_FUNCTION_RESIDENTIAL}</Literal></PropertyIsEqualTo>`
      : '') +
    `<PropertyIsGreaterThanOrEqualTo><ValueReference>dok_data</ValueReference>` +
    `<Literal>${sinceIsoDate}</Literal></PropertyIsGreaterThanOrEqualTo>` +
    (untilIsoDate
      ? `<PropertyIsLessThan><ValueReference>dok_data</ValueReference><Literal>${untilIsoDate}</Literal></PropertyIsLessThan>`
      : '') +
    `</And></Filter>`
  );
}

async function wfsGet(params: Record<string, string>, attempt = 1): Promise<string> {
  const url = new URL(RCN_WFS_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 55_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/gml+xml, text/xml' },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`WFS HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 600 * attempt));
    return wfsGet(params, attempt + 1);
  } finally {
    clearTimeout(t);
  }
}

export async function countWarsawSince(kind: MarketKind, sinceIsoDate: string, untilIsoDate?: string): Promise<number | null> {
  const xml = await wfsGet({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: TYPE_NAMES[kind],
    resultType: 'hits',
    FILTER: warsawFilter(kind, sinceIsoDate, untilIsoDate),
  });
  return wfsNumberMatched(xml);
}

export async function fetchWarsawPage(opts: {
  kind: MarketKind;
  sinceIsoDate: string;
  /** Koniec okna (bez tej daty) — import idzie miesiąc po miesiącu. */
  untilIsoDate?: string;
  startIndex: number;
  count: number;
}): Promise<{ features: Array<RcnLocalFeature & { priceScope?: 'unit' | 'property' }>; returned: number; sample: string | null }> {
  const xml = await wfsGet({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: TYPE_NAMES[opts.kind],
    count: String(opts.count),
    startIndex: String(opts.startIndex),
    FILTER: warsawFilter(opts.kind, opts.sinceIsoDate, opts.untilIsoDate),
    SORTBY: 'dok_data D',
  });
  if (xml.includes('Exception')) {
    throw new Error(`WFS exception (${TYPE_NAMES[opts.kind]}): ${xml.slice(0, 400)}`);
  }
  const features = opts.kind === MARKET_KIND_LOCAL ? parseRcnLocalesGml(xml) : parseRcnGenericGml(xml, opts.kind);
  return {
    features,
    returned: wfsNumberReturned(xml),
    // Pierwszy obiekt strony — do logu, żeby było widać, jakie pola zwraca warstwa.
    sample: opts.startIndex === 0 ? (xml.match(/<wfs:member>[\s\S]*?<\/wfs:member>/)?.[0] || null) : null,
  };
}
