import { prisma } from '@/lib/prisma';
import {
  DEFAULT_RADAR_SEARCH_HISTORY_LIMIT,
  resolveRadarSearchHistoryLimit,
  shapeRadarSearchHistoryList,
} from '@/lib/radarSearchHistoryShape';

export async function fetchRadarSearchHistoryForUser(
  userId: number,
  limitRaw?: unknown
) {
  const limit = resolveRadarSearchHistoryLimit(limitRaw ?? DEFAULT_RADAR_SEARCH_HISTORY_LIMIT);
  const rows = await prisma.radarSearchHistory.findMany({
    where: { userId },
    orderBy: [{ searchedAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return shapeRadarSearchHistoryList(rows);
}
