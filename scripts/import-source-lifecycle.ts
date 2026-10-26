import 'dotenv/config';
import { runImportSourceLifecycle } from '@/lib/importSourceLifecycle';
import { prisma } from '@/lib/prisma';

/** Nocna weryfikacja źródeł ofert z KEI (PM2 cron). Uruchom z --dry, żeby tylko sprawdzić. */
async function main() {
  const dryRun = process.argv.includes('--dry');
  const summary = await runImportSourceLifecycle({ dryRun, limit: 400 });
  console.info('[import-source-lifecycle]', JSON.stringify(summary));
}

main()
  .catch((error) => {
    console.error('[import-source-lifecycle] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
