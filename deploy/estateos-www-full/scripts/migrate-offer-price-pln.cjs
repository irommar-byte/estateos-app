/**
 * Migracja: istniejące oferty → priceCurrency='PLN', pricePln=price
 * Uruchom: node scripts/migrate-offer-price-pln.cjs
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE \`Offer\`
    SET
      \`priceCurrency\` = 'PLN',
      \`pricePln\` = \`price\`
    WHERE \`pricePln\` IS NULL
       OR \`priceCurrency\` IS NULL
       OR TRIM(\`priceCurrency\`) = ''
  `);
  console.log('migrate-offer-price-pln: rows affected (driver-dependent):', updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
