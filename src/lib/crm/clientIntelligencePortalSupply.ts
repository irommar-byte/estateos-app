import { prisma } from '@/lib/prisma';
import { importListingsForClientFromNierOnline } from '@/lib/nieruchomosciOnlineClientHunt';

const AUTO_HUNT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function isAutoPortalHunt(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  return Boolean((metadata as Record<string, unknown>).auto);
}

export async function autoSupplyClientFromNieruchomosciOnline(params: {
  clientId: number;
  agencyUserId: number;
}): Promise<{ attempted: boolean; imported: number; message: string }> {
  const since = new Date(Date.now() - AUTO_HUNT_COOLDOWN_MS);
  const recent = await prisma.agencyClientActivity.findMany({
    where: {
      clientId: params.clientId,
      kind: 'PORTAL_HUNT',
      createdAt: { gte: since },
    },
    select: { metadata: true },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  if (recent.some((row) => isAutoPortalHunt(row.metadata))) {
    return { attempted: false, imported: 0, message: 'Auto hunt w cooldownie (6 h).' };
  }

  try {
    const supply = await importListingsForClientFromNierOnline({
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      count: 2,
    });

    await prisma.agencyClientActivity.create({
      data: {
        clientId: params.clientId,
        agencyUserId: params.agencyUserId,
        kind: 'PORTAL_HUNT',
        title: 'Intelligence → Nieruchomości-Online (auto)',
        body: supply.message,
        offerId: supply.imported[0]?.offerId ?? null,
        metadata: {
          auto: true,
          portal: 'nieruchomosci-online',
          searchUrl: supply.searchUrl,
          imported: supply.imported,
          skipped: supply.skipped,
        },
      },
    });

    return {
      attempted: true,
      imported: supply.imported.length,
      message: supply.message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto hunt nie powiódł się.';
    return { attempted: true, imported: 0, message };
  }
}
