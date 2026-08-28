#!/usr/bin/env npx tsx
/**
 * Portal hunt + optional import + Intelligence send for one buyer client.
 * CLIENT_ID=123 MODE=import SEND=1 npx tsx scripts/portal-hunt-once.ts
 * TOKEN=abc... MODE=preview npx tsx scripts/portal-hunt-once.ts
 */
import { prisma } from '../src/lib/prisma';
import { huntNieruchomosciOnlineForClient } from '../src/lib/nieruchomosciOnlineClientHunt';

async function main() {
  const token = process.env.TOKEN?.trim();
  let clientId = Number(process.env.CLIENT_ID || process.argv[2] || 0);
  const mode = process.env.MODE === 'import' ? 'import' : 'preview';
  const send = process.env.SEND === '1';

  if (!clientId && token) {
    const client = await prisma.agencyClient.findFirst({
      where: { portalToken: token, status: 'ACTIVE' },
      select: { id: true, agencyUserId: true, firstName: true, lastName: true },
    });
    if (!client) throw new Error(`Brak klienta dla tokenu ${token.slice(0, 8)}…`);
    clientId = client.id;
    console.error(`Klient: ${client.firstName} ${client.lastName} (#${client.id})`);
  }

  if (!clientId) throw new Error('Podaj CLIENT_ID lub TOKEN');

  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: { id: true, agencyUserId: true, firstName: true, lastName: true },
  });
  if (!client) throw new Error(`Brak klienta ${clientId}`);

  const result = await huntNieruchomosciOnlineForClient({
    clientId: client.id,
    agencyUserId: client.agencyUserId,
    mode,
    send: mode === 'import' && send,
    count: Number(process.env.COUNT) || 1,
    urls: process.env.URLS ? process.env.URLS.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
