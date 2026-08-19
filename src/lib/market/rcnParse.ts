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
