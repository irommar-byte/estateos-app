#!/usr/bin/env npx tsx
import { cs92ToWgs84, parseCs92Pos } from '../src/lib/market/rcnCrs';
import { parseRcnAddress, parseShareRatio, parseRcnLocalesGml } from '../src/lib/market/rcnParse';
import { assessRcnQuality } from '../src/lib/market/rcnQuality';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const ciasna = parseCs92Pos('489266.737325 636821.284984');
assert(ciasna, 'pos parse');
assert(Math.abs(ciasna!.lat - 52.252) < 0.01, `lat ${ciasna!.lat}`);
assert(Math.abs(ciasna!.lng - 21.005) < 0.02, `lng ${ciasna!.lng}`);

const palace = cs92ToWgs84(637855, 486175);
assert(palace.lat > 52.2 && palace.lat < 52.26, 'palace lat');

const addr = parseRcnAddress('MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15');
assert(addr.city === 'Warszawa', addr.city);
assert(addr.street === 'Ciasna', addr.street);
assert(addr.formatted === 'Ciasna 15', addr.formatted);

assert(parseShareRatio('1/1') === 1, 'share 1/1');
assert(parseShareRatio('1/2') === 0.5, 'share 1/2');
assert(parseShareRatio('') === 1, 'empty share');

const gml = `
<wfs:member>
  <ms:lokale gml:id="lokale.1">
    <gml:pos>489266.737325 636821.284984</gml:pos>
    <ms:tran_lokalny_id_iip>abc</ms:tran_lokalny_id_iip>
    <ms:lok_funkcja>mieszkalna</ms:lok_funkcja>
    <ms:lok_liczba_izb>3</ms:lok_liczba_izb>
    <ms:lok_nr_kond>4</ms:lok_nr_kond>
    <ms:lok_pow_uzyt>62.0</ms:lok_pow_uzyt>
    <ms:lok_cena_brutto>1174000</ms:lok_cena_brutto>
    <ms:dok_data>2026-05-14 02:00:00+02</ms:dok_data>
    <ms:tran_rodzaj_rynku>wtorny</ms:tran_rodzaj_rynku>
    <ms:nier_udzial>1/1</ms:nier_udzial>
    <ms:lok_adres>MSC:Warszawa;UL:ulica Ciasna;NR_PORZ:15</ms:lok_adres>
  </ms:lokale>
</wfs:member>`;
const feats = parseRcnLocalesGml(gml);
assert(feats.length === 1, 'gml count');
assert(feats[0].formattedAddress === 'Ciasna 15', feats[0].formattedAddress);
const q = assessRcnQuality(feats[0]);
assert(q.ok, `quality ${q.flags.join(',')}`);
assert(q.ppsm && q.ppsm > 18000 && q.ppsm < 20000, String(q.ppsm));

console.log('market-engine tests ok');
