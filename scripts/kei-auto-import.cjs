#!/usr/bin/env node
/**
 * Legacy PM2 cron. Import execution belongs to `kei-import-worker`.
 * This script is a no-op so an old catalog click cannot wake HTTP workers.
 */
console.info('[kei-auto-import] disabled; use kei-import-worker');
process.exit(0);
