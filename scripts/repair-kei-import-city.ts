import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { extractWarsawDistrictFromKeiAddress, isWarsawAddress, resolveWarsawDistrict } from '@/lib/keiAmerDistrict';
import { geocodeWarsawPlace, keiNeighborhoodFromAddress, keiStreetFromAddress, repairKeiAddress, titleCasePlace } from '@/lib/keiWarsawGeocode';
import { replacePlaceAfterWarsaw, replaceWrongCityInText } from '@/lib/importCityTextFix';
import { getDistrictsForCity } from '@/lib/location/locationCatalog';

/**
 * Naprawa ofert z KEI zapisanych z błędnym miastem (np. „Białystok” zamiast „Warszawa”).
 * Źródłem prawdy jest adres z KEI („warszawa, dzielnica, osiedle”) zapisany przy imporcie:
 * poprawiamy miasto, dzielnicę, pinezkę (szukaną w granicach Warszawy) oraz złe miasto w tytule i opisie.
 * Oferty bez adresu KEI w Warszawie albo bez pinezki w Warszawie tylko wypisujemy.
 *
 *   npx tsx scripts/repair-kei-import-city.ts          → tylko lista (nic nie zmienia)
 *   npx tsx scripts/repair-kei-import-city.ts --apply  → zapisuje poprawki
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT o.id, o.city, o.district, o.title, o.description, o.lat, o.lng, opn.importSnapshotJson AS snapshot
     FROM \`Offer\` o
     JOIN KeiAmerListingState kls ON kls.importedOfferId = o.id
     LEFT JOIN OfferPrivateNote opn ON opn.offerId = o.id
     WHERE o.city <> 'Warszawa'`,
  )) as Array<{
    id: number;
    city: string;
    district: string | null;
    title: string | null;
    description: string | null;
    lat: number | null;
    lng: number | null;
    snapshot: string | null;
  }>;

  if (rows.length === 0) {
    console.info('[repair-kei-import-city] wszystkie oferty z KEI mają miasto Warszawa — nic do poprawy.');
    return;
  }

  let fixed = 0;
  let exactPins = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    let kei: { address?: string; district?: string; street?: string } = {};
    try {
      kei = (JSON.parse(row.snapshot || '{}') as { kei?: typeof kei }).kei || {};
    } catch {
      /* brak migawki */
    }
    const address = repairKeiAddress(kei.address);
    if (!address || !isWarsawAddress(address)) {
      skipped.push(`#${row.id} ${row.city} · adres KEI: ${address || '(brak)'} · ${String(row.title || '').slice(0, 50)}`);
      continue;
    }

    const district =
      resolveWarsawDistrict(extractWarsawDistrictFromKeiAddress(address), kei.district, row.district) || null;
    const neighborhood = keiNeighborhoodFromAddress(address);
    const street = kei.street || keiStreetFromAddress(address) || null;
    const pin = await geocodeWarsawPlace({ street, neighborhood, district });
    await sleep(120);
    if (!pin) {
      skipped.push(`#${row.id} ${row.city} · adres KEI: ${address} · brak dzielnicy Warszawy w adresie`);
      continue;
    }

    // Osiedle z KEI tylko wtedy, gdy mapa je potwierdziła albo ma litery spoza Latin-1 (uszkodzone migawki je gubiły).
    // Migawka jest cała, gdy gdziekolwiek w adresie zostały litery spoza Latin-1 (ą, ł, ś…).
    const snapshotIntact = /[ąćęłńśźż]/i.test(String(kei.address || ''));
    const neighborhoodTrusted = Boolean(neighborhood) && (pin.neighborhoodVerified || snapshotIntact || /[ąćęłńśźż]/i.test(neighborhood));
    const place = titleCasePlace((neighborhoodTrusted ? neighborhood : '') || district || '');
    // Osiedle ze złego miasta: zapisane w ofercie albo dowolna dzielnica tamtego miasta (np. „Kamień” w Rybniku).
    const wrongPlaces = [row.district, ...getDistrictsForCity(row.city)].filter((name): name is string => Boolean(name));
    const fixText = (text: string) =>
      wrongPlaces.reduce((acc, wrong) => replacePlaceAfterWarsaw(acc, wrong, place), replaceWrongCityInText(text, row.city));
    const title = fixText(String(row.title || ''));
    const description = row.description == null ? null : fixText(row.description);
    const descriptionChanged = description !== row.description;
    if (pin.exact) exactPins += 1;

    console.info(
      `#${row.id} ${row.city} → Warszawa / ${district || '(bez dzielnicy)'} · KEI: ${address}\n` +
        `      pinezka: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} (${pin.source === 'street' ? 'ulica' : pin.source === 'neighborhood' ? 'osiedle' : 'środek dzielnicy'})\n` +
        `      tytuł: ${title === row.title ? '(bez zmian) ' : ''}${title.slice(0, 90)}` +
        (descriptionChanged ? '\n      opis: poprawiony' : ''),
    );
    if (apply) {
      await prisma.offer.update({
        where: { id: row.id },
        data: {
          city: 'Warszawa',
          ...(district ? { district } : {}),
          lat: pin.lat,
          lng: pin.lng,
          isExactLocation: pin.exact,
          street: street && pin.exact ? titleCasePlace(street) : null,
          ...(title && title !== row.title ? { title } : {}),
          ...(descriptionChanged ? { description } : {}),
          updatedAt: new Date(),
        },
      });
    }
    fixed += 1;
  }

  if (skipped.length) {
    console.info(`\n[repair-kei-import-city] pominięte (${skipped.length}) — NIE zmieniam:`);
    for (const line of skipped) console.info(`  ${line}`);
  }
  console.info(
    `\n[repair-kei-import-city] ${apply ? 'poprawiono' : 'do poprawy'}: ${fixed} ofert (pinezka na ulicy: ${exactPins}, przybliżona: ${fixed - exactPins})` +
      (apply ? '.' : ' — uruchom z --apply, żeby zapisać.'),
  );
}

main()
  .catch((error) => {
    console.error('[repair-kei-import-city] błąd', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
