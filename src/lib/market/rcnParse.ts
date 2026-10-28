import { parseCs92Pos } from '@/lib/market/rcnCrs';

export type RcnLocalFeature = {
  gmlId: string;
  sourceIip: string;
  unitId: string;
  teryt: string;
  functionCode: string;
  rooms: number | null;
  floor: number | null;
  areaM2: number | null;
  ancillaryM2: number | null;
  priceGross: number | null;
  vatAmount: number | null;
  deedAt: Date | null;
  marketType: string | null;
  transactionKind: string | null;
  share: string;
  shareRatio: number;
  addressRaw: string;
  city: string;
  street: string;
  streetNo: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
};

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<ms:${name}>([\\s\\S]*?)</ms:${name}>`, 'i'));
  return m ? m[1].trim() : '';
}

function num(raw: string): number | null {
  const cleaned = String(raw || '').replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseShareRatio(share: string): number {
  const s = String(share || '').trim();
  if (!s) return 1;
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (b > 0) return a / b;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function parseRcnAddress(raw: string): { city: string; street: string; streetNo: string; formatted: string } {
  const parts = String(raw || '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  let city = '';
  let street = '';
  let streetNo = '';
  for (const part of parts) {
    const [k, ...rest] = part.split(':');
    const v = rest.join(':').trim();
    const key = String(k || '').toUpperCase();
    if (key === 'MSC' || key === 'MIEJSCOWOSC') city = v;
    else if (key === 'UL' || key === 'ULICA') street = v.replace(/^ulica\s+/i, '').trim();
    else if (key === 'NR_PORZ' || key === 'NR') streetNo = v;
  }
  const formatted = [street, streetNo].filter(Boolean).join(' ');
  return { city, street, streetNo, formatted };
}

export function parseDeedAt(raw: string): Date | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const normalized = s.replace(' ', 'T').replace(/(\+\d{2})$/, '$1:00');
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime())) {
    const fallback = new Date(s.slice(0, 10));
    return Number.isFinite(fallback.getTime()) ? fallback : null;
  }
  return d;
}

export function parseRcnLocalesGml(xml: string): RcnLocalFeature[] {
  const members = xml.match(/<wfs:member>[\s\S]*?<\/wfs:member>/g) || [];
  const out: RcnLocalFeature[] = [];
  for (const member of members) {
    const gmlId = member.match(/gml:id="([^"]+)"/)?.[1] || '';
    if (!gmlId) continue;
    const pos = member.match(/<gml:pos>([^<]+)<\/gml:pos>/)?.[1] || '';
    const coords = parseCs92Pos(pos);
    const addressRaw = tag(member, 'lok_adres');
    const parsedAddr = parseRcnAddress(addressRaw);
    const share = tag(member, 'nier_udzial');
    const lokPrice = num(tag(member, 'lok_cena_brutto'));
    const nierPrice = num(tag(member, 'nier_cena_brutto'));
    out.push({
      gmlId,
      sourceIip: tag(member, 'tran_lokalny_id_iip'),
      unitId: tag(member, 'lok_id_lokalu'),
      teryt: tag(member, 'teryt'),
      functionCode: tag(member, 'lok_funkcja'),
      rooms: num(tag(member, 'lok_liczba_izb')),
      floor: num(tag(member, 'lok_nr_kond')),
      areaM2: num(tag(member, 'lok_pow_uzyt')),
      ancillaryM2: num(tag(member, 'lok_pow_przyn')),
      priceGross: lokPrice ?? nierPrice,
      vatAmount: num(tag(member, 'lok_vat')),
      deedAt: parseDeedAt(tag(member, 'dok_data')),
      marketType: tag(member, 'tran_rodzaj_rynku') || null,
      transactionKind: tag(member, 'tran_rodzaj_trans') || null,
      share,
      shareRatio: parseShareRatio(share),
      addressRaw,
      city: parsedAddr.city,
      street: parsedAddr.street,
      streetNo: parsedAddr.streetNo,
      formattedAddress: parsedAddr.formatted,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
  }
  return out;
}

export function wfsNumberReturned(xml: string): number {
  const m = xml.match(/numberReturned="(\d+)"/);
  return m ? Number(m[1]) : 0;
}

export function wfsNumberMatched(xml: string): number | null {
  const m = xml.match(/numberMatched="(\d+)"/);
  return m ? Number(m[1]) : null;
}

/** Wszystkie proste pola <ms:nazwa>wartość</ms:nazwa> obiektu WFS. */
export function rcnTags(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/<ms:([a-z0-9_]+)>([^<]*)<\/ms:\1>/gi)) {
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (value && !(key in out)) out[key] = value;
  }
  return out;
}

function pickTag(tags: Record<string, string>, patterns: RegExp[]): { key: string; value: string } | null {
  for (const pattern of patterns) {
    const key = Object.keys(tags).find((k) => pattern.test(k));
    if (key) return { key, value: tags[key] };
  }
  return null;
}

/**
 * Budynki i działki z RCN. Nazwy pól różnią się między warstwami (bud_*, dzi_*), więc dobieramy je
 * po wzorcu: powierzchnia (…_pow…), cena (…_cena_brutto, a gdy brak — cena całej nieruchomości),
 * funkcja/rodzaj. Powierzchnia działki bywa w hektarach — przeliczamy na m².
 */
export function parseRcnGenericGml(xml: string, kind: 'BUILDING' | 'PLOT'): Array<RcnLocalFeature & { priceScope: 'unit' | 'property' }> {
  const prefix = kind === 'BUILDING' ? 'bud' : 'dzi';
  const members = xml.match(/<wfs:member>[\s\S]*?<\/wfs:member>/g) || [];
  const out: Array<RcnLocalFeature & { priceScope: 'unit' | 'property' }> = [];
  for (const member of members) {
    const gmlId = member.match(/gml:id="([^"]+)"/)?.[1] || '';
    if (!gmlId) continue;
    const tags = rcnTags(member);
    const pos =
      member.match(/<gml:pos>([^<]+)<\/gml:pos>/)?.[1] ||
      (member.match(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/)?.[1] || '').trim().split(/\s+/).slice(0, 2).join(' ');
    const coords = parseCs92Pos(pos);
    const areaTag =
      kind === 'BUILDING'
        ? pickTag(tags, [new RegExp(`^${prefix}_pow_uzyt`), new RegExp(`^${prefix}_pow`)])
        : pickTag(tags, [new RegExp(`^${prefix}_pow`), /pow_ewid/]);
    let areaM2 = areaTag ? num(areaTag.value) : null;
    if (kind === 'PLOT' && areaM2 != null && (/_ha$|_ha_/.test(areaTag!.key) || areaM2 < 30)) areaM2 = areaM2 * 10_000;
    const unitPrice = pickTag(tags, [new RegExp(`^${prefix}_cena_brutto`), new RegExp(`^${prefix}_cena`)]);
    const propertyPrice = pickTag(tags, [/^nier_cena_brutto/, /^tran_cena_brutto/, /cena_brutto/]);
    const addressRaw = pickTag(tags, [new RegExp(`^${prefix}_adres`), /_adres$/, /adres/])?.value || '';
    const parsedAddr = parseRcnAddress(addressRaw);
    const share = tags.nier_udzial || '';
    out.push({
      gmlId,
      sourceIip: tags.tran_lokalny_id_iip || gmlId,
      unitId: pickTag(tags, [new RegExp(`^${prefix}_id`), /_id_iip$/])?.value || '',
      teryt: tags.teryt || '',
      functionCode:
        pickTag(tags, [new RegExp(`^${prefix}_funkcja`), new RegExp(`^${prefix}_rodzaj`), new RegExp(`^${prefix}_przezn`), /funkcja/])?.value || '',
      rooms: num(tags.bud_liczba_izb || ''),
      floor: null,
      areaM2,
      ancillaryM2: null,
      priceGross: num(unitPrice?.value || '') ?? num(propertyPrice?.value || ''),
      priceScope: unitPrice ? 'unit' : 'property',
      vatAmount: num(tags[`${prefix}_vat`] || ''),
      deedAt: parseDeedAt(tags.dok_data || ''),
      marketType: tags.tran_rodzaj_rynku || null,
      transactionKind: tags.tran_rodzaj_trans || null,
      share,
      shareRatio: parseShareRatio(share),
      addressRaw,
      city: parsedAddr.city,
      street: parsedAddr.street,
      streetNo: parsedAddr.streetNo,
      formattedAddress: parsedAddr.formatted,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
  }
  return out;
}
