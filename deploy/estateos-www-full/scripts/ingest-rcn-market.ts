#!/usr/bin/env npx tsx
import { ingestWarsawRcn } from '../src/lib/market/ingestRcn';

async function main() {
  const result = await ingestWarsawRcn({ source: 'cli' });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
