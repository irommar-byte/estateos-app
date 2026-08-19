#!/usr/bin/env npx tsx
import { tickKeiAutoImport } from '../src/lib/keiAutoImport';

async function main() {
  const result = await tickKeiAutoImport();
  console.log(JSON.stringify({ ts: new Date().toISOString(), job: 'kei-auto-import', ...result }));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
