import { backfillAgencyOfficesForLegacyAgents } from '../src/lib/agencyCompany';

async function main() {
  const report = await backfillAgencyOfficesForLegacyAgents();
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
