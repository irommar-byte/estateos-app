import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { canonicalizeDistrict } from '@/lib/location/locationCatalog';
import { extractWarsawDistrictFromKeiAddress } from '@/lib/keiAmerDistrict';

/**
 * Naprawa ofert z KEI zapisanych z błędnym miastem (np. „Białystok” zamiast „Warszawa”).
 * KEI importuje wyłącznie Warszawę (getOgl.php?miasto=1), więc każda taka oferta z innym miastem jest pomyłką.
 *
 *   npx tsx scripts/repair-kei-import-city.ts          → tylko lista (nic nie zmienia)
 *   npx tsx scripts/repair-kei-import-city.ts --apply  → poprawia miasto i dzielnicę z adresu KEI
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT o.id, o.city, o.district, o.title, opn.importSnapshotJson AS snapshot
     FROM \`Offer\` o
     JOIN KeiAmerListingState kls ON kls.importedOfferId = o.id
     LEFT JOIN OfferPrivateNote opn ON opn.offerId = o.id
     WHERE o.city <> 'Warszawa'`,
  )) as Array<{ id: number; city: string; district: string | null; title: string | null; snapshot: string | null }>;

  if (rows.length === 0) {
    console.info('[repair-kei-import-city] wszystkie oferty z KEI mają miasto Warszawa — nic do poprawy.');
    return;
  }

  for (const row of rows) {
    let keiAddress = '';
    let keiDistrict = '';
    try {
      const snap = JSON.parse(row.snapshot || '{}') as { kei?: { address?: string; district?: string } };
      keiAddress = String(snap.kei?.address || '');
      keiDistrict = String(snap.kei?.district || '');
    } catch {
      /* brak migawki */
    }
    const district =
      canonicalizeDistrict('Warszawa', keiDistrict) ||
      extractWarsawDistrictFromKeiAddress(keiAddress) ||
      canonicalizeDistrict('Warszawa', row.district || '');
    console.info(
      `#${row.id} ${row.city} / ${row.district || '—'} → Warszawa / ${district || '—'} · ${String(row.title || '').slice(0, 60)}`,
    );
    if (apply) {
      await prisma.offer.update({
        where: { id: row.id },
        data: { city: 'Warszawa', ...(district ? { district } : {}), updatedAt: new Date() },
      });
    }
  }
  console.info(
    apply
      ? `[repair-kei-import-city] poprawiono ${rows.length} ofert.`
      : `[repair-kei-import-city] znaleziono ${rows.length} ofert — uruchom z --apply, żeby poprawić.`,
  );
}

main()
  .catch((error) => {
    console.error('[repair-kei-import-city] błąd', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
