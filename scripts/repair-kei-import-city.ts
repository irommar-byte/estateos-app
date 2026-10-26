import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { extractWarsawDistrictFromKeiAddress, isInsideWarsaw, resolveWarsawDistrict } from '@/lib/keiAmerDistrict';
import { replaceWrongCityInText } from '@/lib/importCityTextFix';

/**
 * Naprawa ofert z KEI zapisanych z błędnym miastem (np. „Białystok” zamiast „Warszawa”).
 * Poprawiamy tylko oferty, których pinezka leży w Warszawie: miasto, dzielnicę (z adresu KEI)
 * oraz nazwę złego miasta w tytule i opisie. Oferty z pinezką poza Warszawą tylko wypisujemy.
 *
 *   npx tsx scripts/repair-kei-import-city.ts          → tylko lista (nic nie zmienia)
 *   npx tsx scripts/repair-kei-import-city.ts --apply  → zapisuje poprawki
 */
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
  const outside: string[] = [];
  for (const row of rows) {
    if (!isInsideWarsaw(row.lat, row.lng)) {
      outside.push(`#${row.id} ${row.city} (pinezka ${row.lat ?? '—'}, ${row.lng ?? '—'}) · ${String(row.title || '').slice(0, 60)}`);
      continue;
    }
    let keiAddress = '';
    let keiDistrict = '';
    try {
      const snap = JSON.parse(row.snapshot || '{}') as { kei?: { address?: string; district?: string } };
      keiAddress = String(snap.kei?.address || '');
      keiDistrict = String(snap.kei?.district || '');
    } catch {
      /* brak migawki */
    }
    const district = resolveWarsawDistrict(extractWarsawDistrictFromKeiAddress(keiAddress), keiDistrict, row.district) || null;
    const title = replaceWrongCityInText(String(row.title || ''), row.city);
    const description = row.description == null ? null : replaceWrongCityInText(row.description, row.city);
    const descriptionChanged = description !== row.description;

    console.info(
      `#${row.id} ${row.city} / ${row.district || '—'} → Warszawa / ${district || '(bez dzielnicy)'}\n` +
        `      tytuł: ${title === row.title ? '(bez zmian) ' : ''}${title.slice(0, 90)}` +
        (descriptionChanged ? '\n      opis: poprawiony' : ''),
    );
    if (apply) {
      await prisma.offer.update({
        where: { id: row.id },
        data: {
          city: 'Warszawa',
          district,
          ...(title && title !== row.title ? { title } : {}),
          ...(descriptionChanged ? { description } : {}),
          updatedAt: new Date(),
        },
      });
    }
    fixed += 1;
  }

  if (outside.length) {
    console.info(`\n[repair-kei-import-city] ${outside.length} ofert ma pinezkę poza Warszawą — NIE zmieniam ich:`);
    for (const line of outside) console.info(`  ${line}`);
  }
  console.info(
    apply
      ? `\n[repair-kei-import-city] poprawiono ${fixed} ofert.`
      : `\n[repair-kei-import-city] do poprawy: ${fixed} ofert — uruchom z --apply, żeby zapisać.`,
  );
}

main()
  .catch((error) => {
    console.error('[repair-kei-import-city] błąd', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
