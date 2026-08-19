import {
  MARKET_FUNCTION_RESIDENTIAL,
  RCN_WFS_URL,
  WARSAW_TERYT_PREFIX,
} from '@/lib/market/constants';
import { parseRcnLocalesGml, wfsNumberMatched, wfsNumberReturned, type RcnLocalFeature } from '@/lib/market/rcnParse';

const UA = 'EstateOS-Market/1.0 (rcn-ingest; estateos.pl)';

function warsawResidentialFilter(sinceIsoDate: string) {
  return (
    `<Filter xmlns="http://www.opengis.net/fes/2.0"><And>` +
    `<PropertyIsLike wildCard="*" singleChar="." escapeChar="\\">` +
    `<ValueReference>teryt</ValueReference><Literal>${WARSAW_TERYT_PREFIX}*</Literal></PropertyIsLike>` +
    `<PropertyIsEqualTo><ValueReference>lok_funkcja</ValueReference>` +
    `<Literal>${MARKET_FUNCTION_RESIDENTIAL}</Literal></PropertyIsEqualTo>` +
    `<PropertyIsGreaterThanOrEqualTo><ValueReference>dok_data</ValueReference>` +
    `<Literal>${sinceIsoDate}</Literal></PropertyIsGreaterThanOrEqualTo>` +
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

export async function countWarsawResidentialSince(sinceIsoDate: string): Promise<number | null> {
  const xml = await wfsGet({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'ms:lokale',
    resultType: 'hits',
    FILTER: warsawResidentialFilter(sinceIsoDate),
  });
  return wfsNumberMatched(xml);
}

export async function fetchWarsawResidentialPage(opts: {
  sinceIsoDate: string;
  startIndex: number;
  count: number;
}): Promise<{ features: RcnLocalFeature[]; returned: number }> {
  const xml = await wfsGet({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'ms:lokale',
    count: String(opts.count),
    startIndex: String(opts.startIndex),
    FILTER: warsawResidentialFilter(opts.sinceIsoDate),
    SORTBY: 'dok_data D',
  });
  if (xml.includes('Exception')) {
    throw new Error(`WFS exception: ${xml.slice(0, 400)}`);
  }
  return {
    features: parseRcnLocalesGml(xml),
    returned: wfsNumberReturned(xml),
  };
}
